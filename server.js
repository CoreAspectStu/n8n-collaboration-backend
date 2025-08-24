
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const compression = require('compression');
const { v4: uuidv4 } = require('uuid');

const LockManager = require('./src/lockManager');
const UserManager = require('./src/userManager');
const RequestManager = require('./src/requestManager');
const apiRoutes = require('./src/routes/api');

class CollaborationServer {
    constructor() {
        this.app = express();
        this.server = http.createServer(this.app);
        this.io = socketIo(this.server, {
            cors: {
                origin: "*",
                methods: ["GET", "POST", "PUT", "DELETE"],
                credentials: false
            },
            transports: ['websocket', 'polling']
        });

        this.lockManager = new LockManager();
        this.userManager = new UserManager();
        this.requestManager = new RequestManager();

        this.setupMiddleware();
        this.setupRoutes();
        this.setupSocketHandlers();
        this.startCleanupTimer();
    }

    setupMiddleware() {
        // CORS configuration for Chrome extension
        this.app.use(cors({
            origin: '*',
            credentials: false
        }));

        this.app.use(compression());
        this.app.use(express.json());
        
        // Request logging middleware
        this.app.use((req, res, next) => {
            console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
            next();
        });

        // Error handling middleware
        this.app.use((err, req, res, next) => {
            console.error('Server Error:', err);
            res.status(500).json({
                success: false,
                error: 'Internal server error',
                message: err.message
            });
        });
    }

    setupRoutes() {
        // Health check endpoint
        this.app.get('/health', (req, res) => {
            res.json({
                success: true,
                status: 'healthy',
                timestamp: new Date().toISOString(),
                uptime: process.uptime()
            });
        });

        // API routes
        this.app.use('/api', apiRoutes(this.lockManager, this.userManager, this.requestManager, this.io));

        // 404 handler for undefined routes
        this.app.use((req, res) => {
            res.status(404).json({
                success: false,
                error: 'Endpoint not found'
            });
        });
    }

    setupSocketHandlers() {
        this.io.on('connection', (socket) => {
            console.log(`[${new Date().toISOString()}] Client connected: ${socket.id}`);

            // Handle user identification
            socket.on('identify', (data) => {
                try {
                    const { userId, userName, email, workflowId } = data;
                    
                    if (!userId || !userName) {
                        socket.emit('error', { message: 'Missing required user information' });
                        return;
                    }

                    // Register user session
                    this.userManager.registerUser(userId, {
                        socketId: socket.id,
                        userName,
                        email: email || null,
                        workflowId: workflowId || null,
                        connectedAt: new Date(),
                        lastActivity: new Date()
                    });

                    socket.userId = userId;
                    socket.workflowId = workflowId;

                    // Join workflow room if specified
                    if (workflowId) {
                        socket.join(`workflow:${workflowId}`);
                        
                        // Send current workflow state
                        const lockState = this.lockManager.getWorkflowLock(workflowId);
                        socket.emit('workflow_state', {
                            workflowId,
                            lockState,
                            connectedUsers: this.userManager.getWorkflowUsers(workflowId)
                        });
                    }

                    socket.emit('identified', { 
                        userId, 
                        userName,
                        sessionId: socket.id 
                    });

                    console.log(`User identified: ${userName} (${userId}) on workflow ${workflowId}`);
                } catch (error) {
                    console.error('Error in identify handler:', error);
                    socket.emit('error', { message: 'Failed to identify user' });
                }
            });

            // Handle lock requests
            socket.on('request_lock', (data) => {
                try {
                    const { workflowId, force = false } = data;
                    const userId = socket.userId;

                    if (!userId || !workflowId) {
                        socket.emit('error', { message: 'Missing user or workflow information' });
                        return;
                    }

                    const result = this.lockManager.requestLock(workflowId, userId, force);
                    
                    if (result.success) {
                        // Update user's last activity
                        this.userManager.updateUserActivity(userId);
                        
                        // Notify all users in the workflow
                        this.io.to(`workflow:${workflowId}`).emit('lock_acquired', {
                            workflowId,
                            userId,
                            userName: this.userManager.getUser(userId)?.userName,
                            timestamp: new Date()
                        });
                        
                        console.log(`Lock acquired by ${userId} for workflow ${workflowId}`);
                    }

                    socket.emit('lock_response', result);
                } catch (error) {
                    console.error('Error in request_lock handler:', error);
                    socket.emit('error', { message: 'Failed to process lock request' });
                }
            });

            // Handle lock release
            socket.on('release_lock', (data) => {
                try {
                    const { workflowId } = data;
                    const userId = socket.userId;

                    if (!userId || !workflowId) {
                        socket.emit('error', { message: 'Missing user or workflow information' });
                        return;
                    }

                    const result = this.lockManager.releaseLock(workflowId, userId);
                    
                    if (result.success) {
                        // Notify all users in the workflow
                        this.io.to(`workflow:${workflowId}`).emit('lock_released', {
                            workflowId,
                            userId,
                            userName: this.userManager.getUser(userId)?.userName,
                            timestamp: new Date()
                        });
                        
                        console.log(`Lock released by ${userId} for workflow ${workflowId}`);
                    }

                    socket.emit('lock_release_response', result);
                } catch (error) {
                    console.error('Error in release_lock handler:', error);
                    socket.emit('error', { message: 'Failed to release lock' });
                }
            });

            // Handle edit requests
            socket.on('request_edit_access', (data) => {
                try {
                    const { workflowId, message } = data;
                    const requesterId = socket.userId;

                    if (!requesterId || !workflowId) {
                        socket.emit('error', { message: 'Missing user or workflow information' });
                        return;
                    }

                    const lockState = this.lockManager.getWorkflowLock(workflowId);
                    if (!lockState?.isLocked) {
                        socket.emit('error', { message: 'Workflow is not locked' });
                        return;
                    }

                    const request = this.requestManager.createRequest(workflowId, requesterId, lockState.userId, message);
                    
                    // Notify the current lock holder
                    const lockHolderUser = this.userManager.getUser(lockState.userId);
                    if (lockHolderUser?.socketId) {
                        this.io.to(lockHolderUser.socketId).emit('edit_request', {
                            requestId: request.id,
                            workflowId,
                            requesterId,
                            requesterName: this.userManager.getUser(requesterId)?.userName,
                            message: message || 'Requesting edit access',
                            timestamp: request.timestamp
                        });
                    }

                    socket.emit('request_sent', { 
                        requestId: request.id,
                        workflowId,
                        timestamp: request.timestamp 
                    });

                    console.log(`Edit request sent by ${requesterId} to ${lockState.userId} for workflow ${workflowId}`);
                } catch (error) {
                    console.error('Error in request_edit_access handler:', error);
                    socket.emit('error', { message: 'Failed to send edit request' });
                }
            });

            // Handle edit request responses
            socket.on('respond_edit_request', (data) => {
                try {
                    const { requestId, approved, message } = data;
                    const userId = socket.userId;

                    const request = this.requestManager.getRequest(requestId);
                    if (!request || request.targetUserId !== userId) {
                        socket.emit('error', { message: 'Invalid request or unauthorized' });
                        return;
                    }

                    this.requestManager.respondToRequest(requestId, approved, message);

                    // Notify the requester
                    const requesterUser = this.userManager.getUser(request.requesterId);
                    if (requesterUser?.socketId) {
                        this.io.to(requesterUser.socketId).emit('request_response', {
                            requestId,
                            workflowId: request.workflowId,
                            approved,
                            message: message || (approved ? 'Request approved' : 'Request denied'),
                            timestamp: new Date()
                        });

                        // If approved, release the lock automatically
                        if (approved) {
                            const releaseResult = this.lockManager.releaseLock(request.workflowId, userId);
                            if (releaseResult.success) {
                                this.io.to(`workflow:${request.workflowId}`).emit('lock_released', {
                                    workflowId: request.workflowId,
                                    userId,
                                    userName: this.userManager.getUser(userId)?.userName,
                                    timestamp: new Date()
                                });
                            }
                        }
                    }

                    console.log(`Edit request ${approved ? 'approved' : 'denied'} by ${userId} for request ${requestId}`);
                } catch (error) {
                    console.error('Error in respond_edit_request handler:', error);
                    socket.emit('error', { message: 'Failed to respond to edit request' });
                }
            });

            // Handle heartbeat/activity updates
            socket.on('heartbeat', (data) => {
                try {
                    const userId = socket.userId;
                    if (userId) {
                        this.userManager.updateUserActivity(userId);
                        socket.emit('heartbeat_ack', { timestamp: new Date() });
                    }
                } catch (error) {
                    console.error('Error in heartbeat handler:', error);
                }
            });

            // Handle disconnect
            socket.on('disconnect', () => {
                try {
                    const userId = socket.userId;
                    const workflowId = socket.workflowId;

                    if (userId) {
                        console.log(`[${new Date().toISOString()}] User disconnected: ${userId}`);
                        
                        // Remove user session
                        this.userManager.removeUser(userId);
                        
                        // Release any locks held by this user
                        if (workflowId) {
                            const lockState = this.lockManager.getWorkflowLock(workflowId);
                            if (lockState?.isLocked && lockState.userId === userId) {
                                this.lockManager.releaseLock(workflowId, userId);
                                
                                // Notify other users
                                this.io.to(`workflow:${workflowId}`).emit('lock_released', {
                                    workflowId,
                                    userId,
                                    userName: 'Disconnected User',
                                    timestamp: new Date(),
                                    reason: 'User disconnected'
                                });
                            }
                        }
                    }
                } catch (error) {
                    console.error('Error in disconnect handler:', error);
                }
            });
        });
    }

    startCleanupTimer() {
        // Clean up expired locks and inactive users every 30 seconds
        setInterval(() => {
            try {
                const expiredLocks = this.lockManager.cleanupExpiredLocks();
                const inactiveUsers = this.userManager.cleanupInactiveUsers();
                
                // Notify about expired locks
                expiredLocks.forEach(({ workflowId, userId }) => {
                    this.io.to(`workflow:${workflowId}`).emit('lock_released', {
                        workflowId,
                        userId,
                        userName: 'System',
                        timestamp: new Date(),
                        reason: 'Lock expired due to inactivity'
                    });
                });

                if (expiredLocks.length > 0 || inactiveUsers.length > 0) {
                    console.log(`[${new Date().toISOString()}] Cleanup: ${expiredLocks.length} expired locks, ${inactiveUsers.length} inactive users`);
                }
            } catch (error) {
                console.error('Error in cleanup timer:', error);
            }
        }, 30000); // 30 seconds
    }

    start(port = 3001) {
        this.server.listen(port, () => {
            console.log(`\n🚀 N8N Collaboration Backend Server started`);
            console.log(`📡 Server running on port ${port}`);
            console.log(`🔗 WebSocket endpoint: ws://localhost:${port}`);
            console.log(`🌐 API base URL: http://localhost:${port}/api`);
            console.log(`💚 Health check: http://localhost:${port}/health`);
            console.log(`\nReady for Chrome extension connections!\n`);
        });

        // Graceful shutdown
        process.on('SIGINT', () => {
            console.log('\nShutting down server...');
            this.server.close(() => {
                console.log('Server stopped.');
                process.exit(0);
            });
        });
    }
}

// Start the server
const server = new CollaborationServer();
server.start();

module.exports = CollaborationServer;
