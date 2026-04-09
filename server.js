const express = require('express');
const fs = require('fs');
const path = require('path');
const { startBackgroundUpdate, getUpdateStatus } = require('./background-updater');

const app = express();
const PORT = process.env.PORT || 3000;

// Serve static files
app.use(express.static(__dirname));

// Root redirect
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'LB.html'));
});

app.get('/LB.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'LB.html'));
});

app.get('/admin.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'admin.html'));
});

// API: Trigger Background Update
app.post('/api/update', (req, res) => {
    console.log('🔄 Background update requested...');
    
    const result = startBackgroundUpdate();
    
    res.json(result);
});

// API: Get Update Status
app.get('/api/update-status', (req, res) => {
    res.json(getUpdateStatus());
});

// API: Reset Baseline
app.post('/api/reset-baseline', async (req, res) => {
    console.log('\n⚠️  ======================================');
    console.log('   MANUAL BASELINE RESET');
    console.log('======================================\n');
    
    try {
        const holdersData = fs.readFileSync('holders_data.json', 'utf8');
        fs.writeFileSync('baseline_1hr.json', holdersData);
        
        const data = JSON.parse(holdersData);
        fs.writeFileSync('hourly-gainers.json', '[]');
        
        console.log('✅ Baseline reset complete');
        console.log(`   👥 ${data.length.toLocaleString()} baselines updated`);
        console.log('   📊 All scores are now 0');
        console.log('========================================\n');
        
        res.json({
            success: true,
            totalHolders: data.length,
            message: 'Baseline reset successfully'
        });
        
    } catch (error) {
        console.error('\n❌ Reset failed:', error.message, '\n');
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Health check
app.get('/api/health', (req, res) => {
    res.json({ 
        status: 'ok', 
        timestamp: new Date().toISOString(),
        uptime: Math.floor(process.uptime()) + 's'
    });
});

// Start server
app.listen(PORT, () => {
    console.log('\n🚀 ========================================');
    console.log('   TOKEN LEADERBOARD SERVER');
    console.log('========================================');
    console.log(`   Port: ${PORT}`);
    console.log(`   Status: Running`);
    console.log('========================================');
    console.log(`\n📊 Leaderboard: http://localhost:${PORT}/LB.html`);
    console.log(`🔧 Admin Panel: http://localhost:${PORT}/admin.html`);
    console.log(`💚 Health Check: http://localhost:${PORT}/api/health\n`);
});
