
const express = require('express');

function createApiRoutes(lockManager, userManager, requestManager, io) {
    const router = express.Router();

    // Middleware for logging API requests
    router.use((req, res, next) => {
        console.log(`[${new Date().toISOString()}] API ${req.method} ${req.path}`, req.body ? JSON.stringify(req.body) : '');
        next();
    });

    // ============ LOCK ENDPOINTS ============

    /**
     * GET /api/locks
     * Get all active locks
     */
    router.get('/locks', (req, res) => {
        try {
            const locks = lockManager.getAllLocks();
            res.json({
                success: true,
                data: locks,
                count: locks.length
            });
        } catch (error) {
            console.error('Error getting locks:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to retrieve locks'
            });
        }
    });

    /**
     * GET /api/locks/:workflowId
     * Get lock status for a specific workflow
     */
    router.get('/locks/:workflowId', (req, res) => {
        try {
            const { workflowId } = req.params;
            const lock = lockManager.getWorkflowLock(workflowId);
            
            res.json({
                success: true,
                data: lock,
                isLocked: !!lock
            });
        } catch (error) {
            console.error('Error getting workflow lock:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to retrieve workflow lock'
            });
        }
    });

    /**
     * POST /api/locks/:workflowId/request
     * Request a lock on a workflow
     */
    router.post('/locks/:workflowId/request', (req, res) => {
        try {
            const { workflowId } = req.params;
            const { userId, force = false } = req.body;

            if (!userId) {
                return res.status(400).json({
                    success: false,
                    error: 'Missing required field: userId'
                });
            }

            const result = lockManager.requestLock(workflowId, userId, force);
            
            if (result.success) {
                // Update user activity
                userManager.updateUserActivity(userId);
                
                // Broadcast lock acquisition to all clients in the workflow room
                io.to(`workflow:${workflowId}`).emit('lock_acquired', {
                    workflowId,
                    userId,
                    userName: userManager.getUser(userId)?.userName || 'Unknown User',
                    timestamp: new Date()
                });
                
                res.json(result);
            } else {
                res.status(result.error === 'WORKFLOW_LOCKED' ? 409 : 400).json(result);
            }
        } catch (error) {
            console.error('Error requesting lock:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to request lock'
            });
        }
    });

    /**
     * DELETE /api/locks/:workflowId
     * Release a lock on a workflow
     */
    router.delete('/locks/:workflowId', (req, res) => {
        try {
            const { workflowId } = req.params;
            const { userId } = req.body;

            if (!userId) {
                return res.status(400).json({
                    success: false,
                    error: 'Missing required field: userId'
                });
            }

            const result = lockManager.releaseLock(workflowId, userId);
            
            if (result.success) {
                // Broadcast lock release to all clients in the workflow room
                io.to(`workflow:${workflowId}`).emit('lock_released', {
                    workflowId,
                    userId,
                    userName: userManager.getUser(userId)?.userName || 'Unknown User',
                    timestamp: new Date()
                });
                
                res.json(result);
            } else {
                res.status(result.error === 'NO_LOCK' ? 404 : 403).json(result);
            }
        } catch (error) {
            console.error('Error releasing lock:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to release lock'
            });
        }
    });

    /**
     * GET /api/locks/user/:userId
     * Get all locks for a specific user
     */
    router.get('/locks/user/:userId', (req, res) => {
        try {
            const { userId } = req.params;
            const locks = lockManager.getUserLocks(userId);
            
            res.json({
                success: true,
                data: locks,
                count: locks.length
            });
        } catch (error) {
            console.error('Error getting user locks:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to retrieve user locks'
            });
        }
    });

    // ============ USER ENDPOINTS ============

    /**
     * GET /api/users
     * Get all active users
     */
    router.get('/users', (req, res) => {
        try {
            const users = userManager.getAllUsers();
            res.json({
                success: true,
                data: users,
                count: users.length
            });
        } catch (error) {
            console.error('Error getting users:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to retrieve users'
            });
        }
    });

    /**
     * GET /api/users/:userId
     * Get information about a specific user
     */
    router.get('/users/:userId', (req, res) => {
        try {
            const { userId } = req.params;
            const user = userManager.getUser(userId);
            
            if (!user) {
                return res.status(404).json({
                    success: false,
                    error: 'User not found'
                });
            }
            
            res.json({
                success: true,
                data: user
            });
        } catch (error) {
            console.error('Error getting user:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to retrieve user'
            });
        }
    });

    /**
     * GET /api/users/workflow/:workflowId
     * Get all users working on a specific workflow
     */
    router.get('/users/workflow/:workflowId', (req, res) => {
        try {
            const { workflowId } = req.params;
            const users = userManager.getWorkflowUsers(workflowId);
            
            res.json({
                success: true,
                data: users,
                count: users.length
            });
        } catch (error) {
            console.error('Error getting workflow users:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to retrieve workflow users'
            });
        }
    });

    /**
     * PUT /api/users/:userId/workflow
     * Update user's current workflow
     */
    router.put('/users/:userId/workflow', (req, res) => {
        try {
            const { userId } = req.params;
            const { workflowId } = req.body;

            if (!workflowId) {
                return res.status(400).json({
                    success: false,
                    error: 'Missing required field: workflowId'
                });
            }

            const success = userManager.updateUserWorkflow(userId, workflowId);
            
            if (success) {
                res.json({
                    success: true,
                    message: 'User workflow updated successfully'
                });
            } else {
                res.status(404).json({
                    success: false,
                    error: 'User not found'
                });
            }
        } catch (error) {
            console.error('Error updating user workflow:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to update user workflow'
            });
        }
    });

    // ============ REQUEST ENDPOINTS ============

    /**
     * GET /api/requests
     * Get all active requests (with optional filtering)
     */
    router.get('/requests', (req, res) => {
        try {
            const { userId, workflowId, status } = req.query;
            let requests = [];

            if (userId && workflowId) {
                // Get requests for user in specific workflow
                const userRequests = requestManager.getRequestsForUser(userId);
                const workflowRequests = requestManager.getWorkflowRequests(workflowId);
                requests = userRequests.filter(req => req.workflowId === workflowId);
            } else if (userId) {
                // Get requests for user (as target)
                requests = requestManager.getRequestsForUser(userId);
            } else if (workflowId) {
                // Get requests for workflow
                requests = requestManager.getWorkflowRequests(workflowId);
            }

            // Filter by status if provided
            if (status) {
                requests = requests.filter(req => req.status === status);
            }

            res.json({
                success: true,
                data: requests,
                count: requests.length
            });
        } catch (error) {
            console.error('Error getting requests:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to retrieve requests'
            });
        }
    });

    /**
     * POST /api/requests
     * Create a new edit request
     */
    router.post('/requests', (req, res) => {
        try {
            const { workflowId, requesterId, targetUserId, message } = req.body;

            if (!workflowId || !requesterId || !targetUserId) {
                return res.status(400).json({
                    success: false,
                    error: 'Missing required fields: workflowId, requesterId, targetUserId'
                });
            }

            // Verify the workflow is actually locked by the target user
            const lockState = lockManager.getWorkflowLock(workflowId);
            if (!lockState || lockState.userId !== targetUserId) {
                return res.status(400).json({
                    success: false,
                    error: 'Workflow is not locked by the specified user'
                });
            }

            const request = requestManager.createRequest(workflowId, requesterId, targetUserId, message);
            
            // Notify the target user via WebSocket if they're connected
            const targetUser = userManager.getUser(targetUserId);
            const requesterUser = userManager.getUser(requesterId);
            
            if (targetUser?.socketId) {
                io.to(targetUser.socketId).emit('edit_request', {
                    requestId: request.id,
                    workflowId,
                    requesterId,
                    requesterName: requesterUser?.userName || 'Unknown User',
                    message: message || 'Requesting edit access',
                    timestamp: request.timestamp
                });
            }

            res.status(201).json({
                success: true,
                data: request,
                message: 'Edit request created successfully'
            });
        } catch (error) {
            console.error('Error creating request:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to create edit request'
            });
        }
    });

    /**
     * PUT /api/requests/:requestId/respond
     * Respond to an edit request
     */
    router.put('/requests/:requestId/respond', (req, res) => {
        try {
            const { requestId } = req.params;
            const { approved, message, userId } = req.body;

            if (approved === undefined || !userId) {
                return res.status(400).json({
                    success: false,
                    error: 'Missing required fields: approved, userId'
                });
            }

            const request = requestManager.getRequest(requestId);
            if (!request) {
                return res.status(404).json({
                    success: false,
                    error: 'Request not found'
                });
            }

            if (request.targetUserId !== userId) {
                return res.status(403).json({
                    success: false,
                    error: 'Unauthorized to respond to this request'
                });
            }

            const updatedRequest = requestManager.respondToRequest(requestId, approved, message);
            
            // Notify the requester via WebSocket
            const requesterUser = userManager.getUser(request.requesterId);
            if (requesterUser?.socketId) {
                io.to(requesterUser.socketId).emit('request_response', {
                    requestId,
                    workflowId: request.workflowId,
                    approved,
                    message: message || (approved ? 'Request approved' : 'Request denied'),
                    timestamp: updatedRequest.respondedAt
                });
            }

            // If approved, automatically release the lock
            if (approved) {
                const releaseResult = lockManager.releaseLock(request.workflowId, userId);
                if (releaseResult.success) {
                    io.to(`workflow:${request.workflowId}`).emit('lock_released', {
                        workflowId: request.workflowId,
                        userId,
                        userName: userManager.getUser(userId)?.userName || 'Unknown User',
                        timestamp: new Date(),
                        reason: 'Released due to approved edit request'
                    });
                }
            }

            res.json({
                success: true,
                data: updatedRequest,
                message: `Request ${approved ? 'approved' : 'denied'} successfully`
            });
        } catch (error) {
            console.error('Error responding to request:', error);
            res.status(500).json({
                success: false,
                error: error.message || 'Failed to respond to request'
            });
        }
    });

    /**
     * DELETE /api/requests/:requestId
     * Cancel an edit request
     */
    router.delete('/requests/:requestId', (req, res) => {
        try {
            const { requestId } = req.params;
            const { userId } = req.body;

            if (!userId) {
                return res.status(400).json({
                    success: false,
                    error: 'Missing required field: userId'
                });
            }

            const success = requestManager.cancelRequest(requestId, userId);
            
            if (success) {
                res.json({
                    success: true,
                    message: 'Request cancelled successfully'
                });
            } else {
                res.status(404).json({
                    success: false,
                    error: 'Request not found or cannot be cancelled'
                });
            }
        } catch (error) {
            console.error('Error cancelling request:', error);
            res.status(500).json({
                success: false,
                error: error.message || 'Failed to cancel request'
            });
        }
    });

    // ============ STATISTICS ENDPOINTS ============

    /**
     * GET /api/stats
     * Get overall system statistics
     */
    router.get('/stats', (req, res) => {
        try {
            const lockStats = lockManager.getStats();
            const userStats = userManager.getStats();
            const requestStats = requestManager.getStats();

            res.json({
                success: true,
                data: {
                    locks: lockStats,
                    users: userStats,
                    requests: requestStats,
                    server: {
                        uptime: process.uptime(),
                        memory: process.memoryUsage(),
                        timestamp: new Date()
                    }
                }
            });
        } catch (error) {
            console.error('Error getting stats:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to retrieve statistics'
            });
        }
    });

    /**
     * POST /api/cleanup
     * Manually trigger cleanup of expired locks and inactive users
     */
    router.post('/cleanup', (req, res) => {
        try {
            const expiredLocks = lockManager.cleanupExpiredLocks();
            const inactiveUsers = userManager.cleanupInactiveUsers();
            const expiredRequests = requestManager.cleanupExpiredRequests();
            const oldRequests = requestManager.cleanupOldRequests();

            // Broadcast lock releases
            expiredLocks.forEach(({ workflowId, userId }) => {
                io.to(`workflow:${workflowId}`).emit('lock_released', {
                    workflowId,
                    userId,
                    userName: 'System',
                    timestamp: new Date(),
                    reason: 'Lock expired due to inactivity'
                });
            });

            res.json({
                success: true,
                data: {
                    expiredLocks: expiredLocks.length,
                    inactiveUsers: inactiveUsers.length,
                    expiredRequests: expiredRequests.length,
                    oldRequestsRemoved: oldRequests
                },
                message: 'Cleanup completed successfully'
            });
        } catch (error) {
            console.error('Error during cleanup:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to perform cleanup'
            });
        }
    });

    return router;
}

module.exports = createApiRoutes;
