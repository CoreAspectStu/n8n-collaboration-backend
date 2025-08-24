
class LockManager {
    constructor() {
        // Map of workflowId -> lock information
        this.locks = new Map();
        
        // Lock timeout in milliseconds (5 minutes default)
        this.lockTimeout = 5 * 60 * 1000;
    }

    /**
     * Request a lock on a workflow
     * @param {string} workflowId - The workflow ID
     * @param {string} userId - The user requesting the lock
     * @param {boolean} force - Whether to force acquire the lock
     * @returns {Object} Result with success status and details
     */
    requestLock(workflowId, userId, force = false) {
        try {
            const currentLock = this.locks.get(workflowId);
            
            // Check if workflow is already locked
            if (currentLock && !this.isLockExpired(currentLock)) {
                if (currentLock.userId === userId) {
                    // User already owns the lock, just refresh the timeout
                    currentLock.acquiredAt = new Date();
                    currentLock.expiresAt = new Date(Date.now() + this.lockTimeout);
                    
                    return {
                        success: true,
                        message: 'Lock refreshed',
                        lockInfo: {
                            workflowId,
                            userId,
                            acquiredAt: currentLock.acquiredAt,
                            expiresAt: currentLock.expiresAt
                        }
                    };
                } else if (!force) {
                    // Another user has the lock
                    return {
                        success: false,
                        error: 'WORKFLOW_LOCKED',
                        message: `Workflow is currently being edited by another user`,
                        lockInfo: {
                            workflowId,
                            userId: currentLock.userId,
                            acquiredAt: currentLock.acquiredAt,
                            expiresAt: currentLock.expiresAt
                        }
                    };
                }
                // If force is true, we'll proceed to acquire the lock
            }

            // Acquire the lock
            const now = new Date();
            const lockInfo = {
                workflowId,
                userId,
                acquiredAt: now,
                expiresAt: new Date(Date.now() + this.lockTimeout),
                isLocked: true
            };

            this.locks.set(workflowId, lockInfo);

            return {
                success: true,
                message: force ? 'Lock forcibly acquired' : 'Lock acquired successfully',
                lockInfo
            };

        } catch (error) {
            console.error('Error in requestLock:', error);
            return {
                success: false,
                error: 'INTERNAL_ERROR',
                message: 'Failed to acquire lock'
            };
        }
    }

    /**
     * Release a lock on a workflow
     * @param {string} workflowId - The workflow ID
     * @param {string} userId - The user releasing the lock
     * @returns {Object} Result with success status
     */
    releaseLock(workflowId, userId) {
        try {
            const currentLock = this.locks.get(workflowId);
            
            if (!currentLock) {
                return {
                    success: false,
                    error: 'NO_LOCK',
                    message: 'No lock exists for this workflow'
                };
            }

            if (currentLock.userId !== userId) {
                return {
                    success: false,
                    error: 'UNAUTHORIZED',
                    message: 'You do not own this lock'
                };
            }

            // Remove the lock
            this.locks.delete(workflowId);

            return {
                success: true,
                message: 'Lock released successfully',
                workflowId
            };

        } catch (error) {
            console.error('Error in releaseLock:', error);
            return {
                success: false,
                error: 'INTERNAL_ERROR',
                message: 'Failed to release lock'
            };
        }
    }

    /**
     * Get lock information for a workflow
     * @param {string} workflowId - The workflow ID
     * @returns {Object|null} Lock information or null if not locked
     */
    getWorkflowLock(workflowId) {
        const lock = this.locks.get(workflowId);
        
        if (!lock) {
            return null;
        }

        // Check if lock has expired
        if (this.isLockExpired(lock)) {
            this.locks.delete(workflowId);
            return null;
        }

        return { ...lock };
    }

    /**
     * Get all active locks
     * @returns {Array} Array of all active lock information
     */
    getAllLocks() {
        const activeLocks = [];
        
        for (const [workflowId, lock] of this.locks.entries()) {
            if (!this.isLockExpired(lock)) {
                activeLocks.push({ ...lock });
            } else {
                // Clean up expired lock
                this.locks.delete(workflowId);
            }
        }
        
        return activeLocks;
    }

    /**
     * Get locks for a specific user
     * @param {string} userId - The user ID
     * @returns {Array} Array of locks owned by the user
     */
    getUserLocks(userId) {
        const userLocks = [];
        
        for (const [workflowId, lock] of this.locks.entries()) {
            if (lock.userId === userId && !this.isLockExpired(lock)) {
                userLocks.push({ ...lock });
            } else if (this.isLockExpired(lock)) {
                // Clean up expired lock
                this.locks.delete(workflowId);
            }
        }
        
        return userLocks;
    }

    /**
     * Check if a lock has expired
     * @param {Object} lock - Lock information
     * @returns {boolean} True if expired
     */
    isLockExpired(lock) {
        return new Date() > lock.expiresAt;
    }

    /**
     * Cleanup expired locks
     * @returns {Array} Array of expired locks that were cleaned up
     */
    cleanupExpiredLocks() {
        const expiredLocks = [];
        
        for (const [workflowId, lock] of this.locks.entries()) {
            if (this.isLockExpired(lock)) {
                expiredLocks.push({ workflowId, userId: lock.userId });
                this.locks.delete(workflowId);
            }
        }
        
        return expiredLocks;
    }

    /**
     * Force release all locks for a user (useful when user disconnects)
     * @param {string} userId - The user ID
     * @returns {Array} Array of released locks
     */
    releaseUserLocks(userId) {
        const releasedLocks = [];
        
        for (const [workflowId, lock] of this.locks.entries()) {
            if (lock.userId === userId) {
                releasedLocks.push({ workflowId, userId });
                this.locks.delete(workflowId);
            }
        }
        
        return releasedLocks;
    }

    /**
     * Get statistics about the lock manager
     * @returns {Object} Statistics object
     */
    getStats() {
        const now = new Date();
        const activeLocks = [];
        const expiredLocks = [];
        
        for (const [workflowId, lock] of this.locks.entries()) {
            if (this.isLockExpired(lock)) {
                expiredLocks.push(workflowId);
            } else {
                activeLocks.push(workflowId);
            }
        }
        
        return {
            totalLocks: this.locks.size,
            activeLocks: activeLocks.length,
            expiredLocks: expiredLocks.length,
            lockTimeout: this.lockTimeout / 1000 / 60, // in minutes
            timestamp: now
        };
    }
}

module.exports = LockManager;
