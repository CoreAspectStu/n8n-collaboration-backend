
const express = require('express');

// Test each part incrementally
console.log('Testing basic Express...');
const app = express();

console.log('Testing middleware...');
app.use(express.json());

console.log('Testing basic routes...');
app.get('/health', (req, res) => {
    res.json({ success: true, message: 'OK' });
});

console.log('Testing router...');
const router = express.Router();

// Test simple routes first
router.get('/test', (req, res) => {
    res.json({ test: 'ok' });
});

console.log('Testing parameter routes...');
router.get('/locks/:workflowId', (req, res) => {
    res.json({ workflowId: req.params.workflowId });
});

console.log('Testing post routes with params...');
router.post('/locks/:workflowId/request', (req, res) => {
    res.json({ workflowId: req.params.workflowId });
});

console.log('Testing complex parameter patterns...');
router.get('/locks/user/:userId', (req, res) => {
    res.json({ userId: req.params.userId });
});

router.get('/users/workflow/:workflowId', (req, res) => {
    res.json({ workflowId: req.params.workflowId });
});

router.put('/requests/:requestId/respond', (req, res) => {
    res.json({ requestId: req.params.requestId });
});

console.log('Mounting router...');
app.use('/api', router);

console.log('Adding 404 handler...');
app.use((req, res) => {
    res.status(404).json({ error: 'Not found' });
});

console.log('Starting server...');
const server = app.listen(3001, () => {
    console.log('✅ Debug server started on port 3001');
});

process.on('SIGINT', () => {
    console.log('\nShutting down...');
    server.close();
    process.exit(0);
});
