
const { v4: uuidv4 } = require('uuid');

class RequestManager {
    constructor() {
        // Map of requestId -> request information
        this.requests = new Map();
        
        // Request timeout (5 minutes)
        this.requestTimeout = 5 * 60 * 1000;
    }

    /**
     * Create a new edit request
     * @param {string} workflowId - Workflow ID
     * @param {string} requesterId - User requesting access
     * @param {string} targetUserId - User currently holding the lock
     * @param {string} message - Optional message from requester
     * @returns {Object} Created request object
     */
    createRequest(workflowId, requesterId, targetUserId, message = null) {
        try {
            const requestId = uuidv4();
            const now = new Date();
            
            const request = {
                id: requestId,
                workflowId,
                requesterId,
                targetUserId,
                message,
                status: 'pending',
                timestamp: now,
                expiresAt: new Date(now.getTime() + this.requestTimeout),
                respondedAt: null,
                response: null,
                responseMessage: null
            };

            this.requests.set(requestId, request);

            return { ...request };

        } catch (error) {
            console.error('Error in createRequest:', error);
            throw new Error('Failed to create edit request');
        }
    }

    /**
     * Respond to an edit request
     * @param {string} requestId - Request ID
     * @param {boolean} approved - Whether the request was approved
     * @param {string} message - Optional response message
     * @returns {Object} Updated request object
     */
    respondToRequest(requestId, approved, message = null) {
        try {
            const request = this.requests.get(requestId);
            
            if (!request) {
                throw new Error('Request not found');
            }

            if (request.status !== 'pending') {
                throw new Error('Request has already been responded to');
            }

            if (this.isRequestExpired(request)) {
                request.status = 'expired';
                throw new Error('Request has expired');
            }

            const now = new Date();
            request.status = approved ? 'approved' : 'denied';
            request.response = approved;
            request.responseMessage = message;
            request.respondedAt = now;

            return { ...request };

        } catch (error) {
            console.error('Error in respondToRequest:', error);
            throw error;
        }
    }

    /**
     * Get a request by ID
     * @param {string} requestId - Request ID
     * @returns {Object|null} Request object or null if not found
     */
    getRequest(requestId) {
        const request = this.requests.get(requestId);
        return request ? { ...request } : null;
    }

    /**
     * Get all requests for a user (as target)
     * @param {string} userId - User ID
     * @returns {Array} Array of requests where user is the target
     */
    getRequestsForUser(userId) {
        const userRequests = [];
        
        for (const [requestId, request] of this.requests.entries()) {
            if (request.targetUserId === userId && !this.isRequestExpired(request)) {
                userRequests.push({ ...request });
            }
        }
        
        return userRequests;
    }

    /**
     * Get all requests by a user (as requester)
     * @param {string} userId - User ID
     * @returns {Array} Array of requests made by the user
     */
    getRequestsByUser(userId) {
        const userRequests = [];
        
        for (const [requestId, request] of this.requests.entries()) {
            if (request.requesterId === userId && !this.isRequestExpired(request)) {
                userRequests.push({ ...request });
            }
        }
        
        return userRequests;
    }

    /**
     * Get all requests for a workflow
     * @param {string} workflowId - Workflow ID
     * @returns {Array} Array of requests for the workflow
     */
    getWorkflowRequests(workflowId) {
        const workflowRequests = [];
        
        for (const [requestId, request] of this.requests.entries()) {
            if (request.workflowId === workflowId && !this.isRequestExpired(request)) {
                workflowRequests.push({ ...request });
            }
        }
        
        return workflowRequests;
    }

    /**
     * Cancel a request
     * @param {string} requestId - Request ID
     * @param {string} userId - User canceling (must be requester)
     * @returns {boolean} Success status
     */
    cancelRequest(requestId, userId) {
        try {
            const request = this.requests.get(requestId);
            
            if (!request) {
                return false;
            }

            if (request.requesterId !== userId) {
                throw new Error('Only the requester can cancel the request');
            }

            if (request.status !== 'pending') {
                throw new Error('Can only cancel pending requests');
            }

            request.status = 'cancelled';
            request.respondedAt = new Date();
            
            return true;

        } catch (error) {
            console.error('Error in cancelRequest:', error);
            return false;
        }
    }

    /**
     * Check if a request has expired
     * @param {Object} request - Request object
     * @returns {boolean} True if expired
     */
    isRequestExpired(request) {
        return new Date() > request.expiresAt;
    }

    /**
     * Cleanup expired requests
     * @returns {Array} Array of expired request IDs that were cleaned up
     */
    cleanupExpiredRequests() {
        const expiredRequests = [];
        
        for (const [requestId, request] of this.requests.entries()) {
            if (this.isRequestExpired(request) && request.status === 'pending') {
                request.status = 'expired';
                expiredRequests.push(requestId);
            }
        }
        
        return expiredRequests;
    }

    /**
     * Remove old completed/expired requests to prevent memory leaks
     * @param {number} maxAge - Maximum age in milliseconds (default: 1 hour)
     * @returns {number} Number of requests removed
     */
    cleanupOldRequests(maxAge = 60 * 60 * 1000) {
        const now = new Date();
        const cutoffTime = new Date(now.getTime() - maxAge);
        let removedCount = 0;
        
        for (const [requestId, request] of this.requests.entries()) {
            if (request.timestamp < cutoffTime && request.status !== 'pending') {
                this.requests.delete(requestId);
                removedCount++;
            }
        }
        
        return removedCount;
    }

    /**
     * Get request statistics
     * @returns {Object} Statistics object
     */
    getStats() {
        const now = new Date();
        const stats = {
            total: 0,
            pending: 0,
            approved: 0,
            denied: 0,
            expired: 0,
            cancelled: 0
        };
        
        for (const [requestId, request] of this.requests.entries()) {
            stats.total++;
            
            // Update expired status if needed
            if (request.status === 'pending' && this.isRequestExpired(request)) {
                request.status = 'expired';
            }
            
            stats[request.status]++;
        }
        
        return {
            ...stats,
            requestTimeout: this.requestTimeout / 1000 / 60, // in minutes
            timestamp: now
        };
    }
}

module.exports = RequestManager;
