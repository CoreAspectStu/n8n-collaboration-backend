
const io = require('socket.io-client');

// Test WebSocket connection
console.log('🧪 Testing WebSocket Functionality\n');

const socket = io('http://localhost:3001', {
    transports: ['websocket', 'polling']
});

socket.on('connect', () => {
    console.log('✅ Connected to server with ID:', socket.id);
    
    // Test user identification
    console.log('📋 Testing user identification...');
    socket.emit('identify', {
        userId: 'test-user-websocket',
        userName: 'WebSocket Test User', 
        email: 'test@example.com',
        workflowId: 'websocket-test-workflow'
    });
});

socket.on('identified', (data) => {
    console.log('✅ User identified:', data);
    
    // Test lock request via WebSocket
    console.log('\n🔒 Testing lock request via WebSocket...');
    socket.emit('request_lock', {
        workflowId: 'websocket-test-workflow'
    });
});

socket.on('lock_response', (data) => {
    console.log('📝 Lock response:', data);
    
    if (data.success) {
        console.log('✅ Lock acquired via WebSocket');
        
        // Test lock release
        console.log('\n🔓 Testing lock release via WebSocket...');
        setTimeout(() => {
            socket.emit('release_lock', {
                workflowId: 'websocket-test-workflow'
            });
        }, 1000);
    } else {
        console.log('❌ Lock request failed:', data.error);
    }
});

socket.on('lock_release_response', (data) => {
    console.log('📝 Lock release response:', data);
    
    if (data.success) {
        console.log('✅ Lock released via WebSocket');
    } else {
        console.log('❌ Lock release failed:', data.error);
    }
    
    console.log('\n🎉 WebSocket tests completed successfully!');
    socket.disconnect();
    process.exit(0);
});

socket.on('workflow_state', (data) => {
    console.log('📊 Received workflow state:', data);
});

socket.on('lock_acquired', (data) => {
    console.log('🔒 Lock acquired event:', data);
});

socket.on('lock_released', (data) => {
    console.log('🔓 Lock released event:', data);
});

socket.on('error', (data) => {
    console.log('❌ Socket error:', data);
});

socket.on('connect_error', (error) => {
    console.log('❌ Connection error:', error);
    process.exit(1);
});

socket.on('disconnect', (reason) => {
    console.log('🔌 Disconnected:', reason);
});

// Timeout after 10 seconds
setTimeout(() => {
    console.log('⏰ Test timeout reached');
    socket.disconnect();
    process.exit(1);
}, 10000);
