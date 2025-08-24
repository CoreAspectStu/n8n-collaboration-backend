
class UserManager {
    constructor() {
        // Map of userId -> user information
        this.users = new Map();
        
        // Inactivity timeout (10 minutes)
        this.inactivityTimeout = 10 * 60 * 1000;
    }

    /**
     * Register a new user session
     * @param {string} userId - Unique user identifier
     * @param {Object} userInfo - User information
     * @returns {Object} Registration result
     */
    registerUser(userId, userInfo) {
        try {
            const now = new Date();
            
            const user = {
                userId,
                socketId: userInfo.socketId,
                userName: userInfo.userName,
                email: userInfo.email || null,
                workflowId: userInfo.workflowId || null,
                connectedAt: now,
                lastActivity: now,
                isActive: true,
                metadata: userInfo.metadata || {}
            };

            this.users.set(userId, user);

            return {
                success: true,
                message: 'User registered successfully',
                user: { ...user }
            };

        } catch (error) {
            console.error('Error in registerUser:', error);
            return {
                success: false,
                error: 'REGISTRATION_FAILED',
                message: 'Failed to register user'
            };
        }
    }

    /**
     * Update user's last activity timestamp
     * @param {string} userId - User ID
     * @returns {boolean} Success status
     */
    updateUserActivity(userId) {
        try {
            const user = this.users.get(userId);
            if (user) {
                user.lastActivity = new Date();
                user.isActive = true;
                return true;
            }
            return false;
        } catch (error) {
            console.error('Error in updateUserActivity:', error);
            return false;
        }
    }

    /**
     * Get user information
     * @param {string} userId - User ID
     * @returns {Object|null} User information or null if not found
     */
    getUser(userId) {
        const user = this.users.get(userId);
        return user ? { ...user } : null;
    }

    /**
     * Get all active users
     * @returns {Array} Array of all active users
     */
    getAllUsers() {
        const activeUsers = [];
        
        for (const [userId, user] of this.users.entries()) {
            if (!this.isUserInactive(user)) {
                activeUsers.push({ ...user });
            }
        }
        
        return activeUsers;
    }

    /**
     * Get users working on a specific workflow
     * @param {string} workflowId - Workflow ID
     * @returns {Array} Array of users working on the workflow
     */
    getWorkflowUsers(workflowId) {
        const workflowUsers = [];
        
        for (const [userId, user] of this.users.entries()) {
            if (user.workflowId === workflowId && !this.isUserInactive(user)) {
                workflowUsers.push({ ...user });
            }
        }
        
        return workflowUsers;
    }

    /**
     * Update user's current workflow
     * @param {string} userId - User ID
     * @param {string} workflowId - New workflow ID
     * @returns {boolean} Success status
     */
    updateUserWorkflow(userId, workflowId) {
        try {
            const user = this.users.get(userId);
            if (user) {
                user.workflowId = workflowId;
                user.lastActivity = new Date();
                return true;
            }
            return false;
        } catch (error) {
            console.error('Error in updateUserWorkflow:', error);
            return false;
        }
    }

    /**
     * Remove a user session
     * @param {string} userId - User ID
     * @returns {boolean} Success status
     */
    removeUser(userId) {
        try {
            return this.users.delete(userId);
        } catch (error) {
            console.error('Error in removeUser:', error);
            return false;
        }
    }

    /**
     * Check if a user is inactive
     * @param {Object} user - User object
     * @returns {boolean} True if user is inactive
     */
    isUserInactive(user) {
        const now = new Date();
        return (now - user.lastActivity) > this.inactivityTimeout;
    }

    /**
     * Cleanup inactive users
     * @returns {Array} Array of cleaned up user IDs
     */
    cleanupInactiveUsers() {
        const inactiveUsers = [];
        
        for (const [userId, user] of this.users.entries()) {
            if (this.isUserInactive(user)) {
                inactiveUsers.push(userId);
                this.users.delete(userId);
            }
        }
        
        return inactiveUsers;
    }

    /**
     * Get user by socket ID
     * @param {string} socketId - Socket ID
     * @returns {Object|null} User information or null if not found
     */
    getUserBySocketId(socketId) {
        for (const [userId, user] of this.users.entries()) {
            if (user.socketId === socketId) {
                return { ...user };
            }
        }
        return null;
    }

    /**
     * Update user metadata
     * @param {string} userId - User ID
     * @param {Object} metadata - New metadata
     * @returns {boolean} Success status
     */
    updateUserMetadata(userId, metadata) {
        try {
            const user = this.users.get(userId);
            if (user) {
                user.metadata = { ...user.metadata, ...metadata };
                user.lastActivity = new Date();
                return true;
            }
            return false;
        } catch (error) {
            console.error('Error in updateUserMetadata:', error);
            return false;
        }
    }

    /**
     * Get user statistics
     * @returns {Object} Statistics object
     */
    getStats() {
        const now = new Date();
        const activeUsers = [];
        const inactiveUsers = [];
        const workflowCounts = new Map();
        
        for (const [userId, user] of this.users.entries()) {
            if (this.isUserInactive(user)) {
                inactiveUsers.push(userId);
            } else {
                activeUsers.push(userId);
                
                if (user.workflowId) {
                    const count = workflowCounts.get(user.workflowId) || 0;
                    workflowCounts.set(user.workflowId, count + 1);
                }
            }
        }
        
        return {
            totalUsers: this.users.size,
            activeUsers: activeUsers.length,
            inactiveUsers: inactiveUsers.length,
            workflowsWithUsers: workflowCounts.size,
            inactivityTimeout: this.inactivityTimeout / 1000 / 60, // in minutes
            timestamp: now
        };
    }
}

module.exports = UserManager;
