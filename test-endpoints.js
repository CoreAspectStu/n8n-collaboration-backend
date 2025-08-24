
const http = require('http');

// Test configuration
const BASE_URL = 'http://localhost:3001';
const TEST_DATA = {
    userId1: 'user-123',
    userId2: 'user-456', 
    userName1: 'John Doe',
    userName2: 'Jane Smith',
    workflowId1: 'workflow-abc',
    workflowId2: 'workflow-def'
};

// Helper function to make HTTP requests
function makeRequest(method, path, data = null) {
    return new Promise((resolve, reject) => {
        const url = new URL(path, BASE_URL);
        const options = {
            method,
            headers: {
                'Content-Type': 'application/json'
            }
        };

        const req = http.request(url, options, (res) => {
            let body = '';
            res.on('data', chunk => body += chunk);
            res.on('end', () => {
                try {
                    const responseData = body ? JSON.parse(body) : null;
                    resolve({
                        status: res.statusCode,
                        headers: res.headers,
                        data: responseData
                    });
                } catch (error) {
                    resolve({
                        status: res.statusCode,
                        headers: res.headers,
                        data: body
                    });
                }
            });
        });

        req.on('error', reject);

        if (data) {
            req.write(JSON.stringify(data));
        }

        req.end();
    });
}

// Test functions
async function testHealthCheck() {
    console.log('\n🔍 Testing Health Check...');
    try {
        const response = await makeRequest('GET', '/health');
        if (response.status === 200 && response.data.success) {
            console.log('✅ Health check passed');
            console.log(`   Server uptime: ${response.data.uptime}s`);
            return true;
        } else {
            console.log('❌ Health check failed');
            return false;
        }
    } catch (error) {
        console.log('❌ Health check error:', error.message);
        return false;
    }
}

async function testLockOperations() {
    console.log('\n🔒 Testing Lock Operations...');
    try {
        // Test requesting a lock
        console.log('  Testing lock request...');
        let response = await makeRequest('POST', `/api/locks/${TEST_DATA.workflowId1}/request`, {
            userId: TEST_DATA.userId1
        });
        
        if (response.status === 200 && response.data.success) {
            console.log('  ✅ Lock request successful');
        } else {
            console.log('  ❌ Lock request failed:', response.data);
            return false;
        }

        // Test getting lock status
        console.log('  Testing lock status...');
        response = await makeRequest('GET', `/api/locks/${TEST_DATA.workflowId1}`);
        
        if (response.status === 200 && response.data.data && response.data.data.userId === TEST_DATA.userId1) {
            console.log('  ✅ Lock status retrieval successful');
        } else {
            console.log('  ❌ Lock status retrieval failed:', response.data);
            return false;
        }

        // Test conflicting lock request
        console.log('  Testing conflicting lock request...');
        response = await makeRequest('POST', `/api/locks/${TEST_DATA.workflowId1}/request`, {
            userId: TEST_DATA.userId2
        });
        
        if (response.status === 409 && !response.data.success) {
            console.log('  ✅ Conflict detection successful');
        } else {
            console.log('  ❌ Conflict detection failed:', response.data);
            return false;
        }

        // Test force lock acquisition
        console.log('  Testing force lock acquisition...');
        response = await makeRequest('POST', `/api/locks/${TEST_DATA.workflowId1}/request`, {
            userId: TEST_DATA.userId2,
            force: true
        });
        
        if (response.status === 200 && response.data.success) {
            console.log('  ✅ Force lock acquisition successful');
        } else {
            console.log('  ❌ Force lock acquisition failed:', response.data);
            return false;
        }

        // Test lock release
        console.log('  Testing lock release...');
        response = await makeRequest('DELETE', `/api/locks/${TEST_DATA.workflowId1}`, {
            userId: TEST_DATA.userId2
        });
        
        if (response.status === 200 && response.data.success) {
            console.log('  ✅ Lock release successful');
        } else {
            console.log('  ❌ Lock release failed:', response.data);
            return false;
        }

        return true;
    } catch (error) {
        console.log('❌ Lock operations test error:', error.message);
        return false;
    }
}

async function testUserOperations() {
    console.log('\n👥 Testing User Operations...');
    try {
        // Get all users
        console.log('  Testing get all users...');
        let response = await makeRequest('GET', '/api/users');
        
        if (response.status === 200 && response.data.success) {
            console.log(`  ✅ Retrieved ${response.data.count} users`);
        } else {
            console.log('  ❌ Get users failed:', response.data);
            return false;
        }

        // Test workflow users (after setting up some locks)
        console.log('  Setting up test scenario for workflow users...');
        await makeRequest('POST', `/api/locks/${TEST_DATA.workflowId2}/request`, {
            userId: TEST_DATA.userId1
        });

        response = await makeRequest('GET', `/api/users/workflow/${TEST_DATA.workflowId2}`);
        
        if (response.status === 200 && response.data.success) {
            console.log(`  ✅ Retrieved ${response.data.count} workflow users`);
        } else {
            console.log('  ❌ Get workflow users failed:', response.data);
            return false;
        }

        return true;
    } catch (error) {
        console.log('❌ User operations test error:', error.message);
        return false;
    }
}

async function testRequestOperations() {
    console.log('\n📝 Testing Request Operations...');
    try {
        // First, set up a lock
        console.log('  Setting up lock for request testing...');
        await makeRequest('POST', `/api/locks/${TEST_DATA.workflowId1}/request`, {
            userId: TEST_DATA.userId1
        });

        // Create an edit request
        console.log('  Testing create edit request...');
        let response = await makeRequest('POST', '/api/requests', {
            workflowId: TEST_DATA.workflowId1,
            requesterId: TEST_DATA.userId2,
            targetUserId: TEST_DATA.userId1,
            message: 'Please let me edit this workflow'
        });
        
        if (response.status === 201 && response.data.success) {
            console.log('  ✅ Edit request created successfully');
            var requestId = response.data.data.id;
        } else {
            console.log('  ❌ Edit request creation failed:', response.data);
            return false;
        }

        // Get requests
        console.log('  Testing get requests...');
        response = await makeRequest('GET', `/api/requests?userId=${TEST_DATA.userId1}`);
        
        if (response.status === 200 && response.data.success && response.data.count > 0) {
            console.log(`  ✅ Retrieved ${response.data.count} requests`);
        } else {
            console.log('  ❌ Get requests failed:', response.data);
            return false;
        }

        // Respond to request (approve)
        console.log('  Testing approve request...');
        response = await makeRequest('PUT', `/api/requests/${requestId}/respond`, {
            approved: true,
            message: 'Request approved',
            userId: TEST_DATA.userId1
        });
        
        if (response.status === 200 && response.data.success) {
            console.log('  ✅ Request approval successful');
        } else {
            console.log('  ❌ Request approval failed:', response.data);
            return false;
        }

        return true;
    } catch (error) {
        console.log('❌ Request operations test error:', error.message);
        return false;
    }
}

async function testStatistics() {
    console.log('\n📊 Testing Statistics...');
    try {
        let response = await makeRequest('GET', '/api/stats');
        
        if (response.status === 200 && response.data.success) {
            console.log('  ✅ Statistics retrieved successfully');
            console.log(`    Active locks: ${response.data.data.locks.activeLocks}`);
            console.log(`    Active users: ${response.data.data.users.activeUsers}`);
            console.log(`    Total requests: ${response.data.data.requests.total}`);
        } else {
            console.log('  ❌ Statistics retrieval failed:', response.data);
            return false;
        }

        // Test cleanup
        console.log('  Testing cleanup...');
        response = await makeRequest('POST', '/api/cleanup');
        
        if (response.status === 200 && response.data.success) {
            console.log('  ✅ Cleanup successful');
        } else {
            console.log('  ❌ Cleanup failed:', response.data);
            return false;
        }

        return true;
    } catch (error) {
        console.log('❌ Statistics test error:', error.message);
        return false;
    }
}

async function runAllTests() {
    console.log('🧪 Starting N8N Collaboration Backend API Tests\n');
    console.log(`Testing server at: ${BASE_URL}`);
    console.log('=' * 50);

    let passedTests = 0;
    let totalTests = 5;

    // Wait for server to be ready
    await new Promise(resolve => setTimeout(resolve, 2000));

    if (await testHealthCheck()) passedTests++;
    if (await testLockOperations()) passedTests++;
    if (await testUserOperations()) passedTests++;
    if (await testRequestOperations()) passedTests++;
    if (await testStatistics()) passedTests++;

    console.log('\n' + '=' * 50);
    console.log(`🏁 Test Results: ${passedTests}/${totalTests} tests passed`);
    
    if (passedTests === totalTests) {
        console.log('🎉 All tests passed! The backend service is working correctly.');
    } else {
        console.log(`⚠️  ${totalTests - passedTests} tests failed. Please check the server logs.`);
    }
    
    console.log('\n💡 You can now connect your Chrome extension to ws://localhost:3001');
    console.log('📚 API Documentation: All endpoints are available at http://localhost:3001/api/');
}

// Run tests if this file is executed directly
if (require.main === module) {
    runAllTests().catch(console.error);
}

module.exports = { runAllTests, makeRequest };
