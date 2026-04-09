const express = require('express');
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Serve static files
app.use(express.static(__dirname));

// API: Update Leaderboard
app.post('/api/update', async (req, res) => {
    const startTime = Date.now();
    
    console.log('\n🔄 ======================================');
    console.log('   LEADERBOARD UPDATE STARTED');
    console.log('======================================\n');
    
    try {
        // Step 0: Save current as baseline BEFORE fetching new data
        console.log('📸 Step 0: Saving current data as baseline...');
        if (fs.existsSync('holders_data.json')) {
            const currentData = fs.readFileSync('holders_data.json', 'utf8');
            fs.writeFileSync('baseline_1hr.json', currentData);
            console.log('✅ Current data saved as baseline (OLD snapshot)\n');
        } else {
            console.log('⚠️  No existing data - this is the first fetch\n');
        }
        
        // Step 1: Fetch NEW data from API
        console.log('📥 Step 1: Fetching latest holder data from API...');
        await new Promise((resolve, reject) => {
            exec('node fetch-from-api.js', (error, stdout, stderr) => {
                if (error) {
                    console.error('❌ Fetch error:', error.message);
                    reject(error);
                } else {
                    console.log('✅ Fetch complete - new data saved to holders_data.json\n');
                    resolve();
                }
            });
        });
        
        // Step 2: Calculate gains (NEW - OLD baseline)
        console.log('🧮 Step 2: Calculating hourly gains...');
        await new Promise((resolve, reject) => {
            exec('node calculate-hourly.js', (error, stdout, stderr) => {
                if (error) {
                    console.error('❌ Calculate error:', error.message);
                    reject(error);
                } else {
                    console.log('✅ Calculate complete - gains saved to hourly-gainers.json\n');
                    resolve();
                }
            });
        });
        
        // Read results
        const holdersData = JSON.parse(fs.readFileSync('holders_data.json', 'utf8'));
        const gainersData = JSON.parse(fs.readFileSync('hourly-gainers.json', 'utf8'));
        
        const duration = ((Date.now() - startTime) / 1000).toFixed(1);
        
        console.log('🎉 ======================================');
        console.log('   UPDATE COMPLETE!');
        console.log('======================================');
        console.log(`   ⏱️  Duration: ${duration}s`);
        console.log(`   👥 Total Holders: ${holdersData.length.toLocaleString()}`);
        console.log(`   📈 Gainers Found: ${gainersData.length}`);
        if (gainersData.length > 0) {
            console.log(`   🏆 Top Gain: ${(gainersData[0].gain / 1e18).toFixed(2)} tokens`);
        }
        console.log('======================================\n');
        
        res.json({
            success: true,
            totalHolders: holdersData.length,
            gainers: gainersData.length,
            topGain: gainersData.length > 0 ? (gainersData[0].gain / 1e18).toFixed(2) : '0',
            duration: `${duration}s`
        });
        
    } catch (error) {
        console.error('\n❌ ======================================');
        console.error('   UPDATE FAILED!');
        console.error('======================================');
        console.error('   Error:', error.message);
        console.error('======================================\n');
        
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// API: Reset Baseline (Manual reset - all scores become 0)
app.post('/api/reset-baseline', async (req, res) => {
    console.log('\n⚠️  ======================================');
    console.log('   MANUAL BASELINE RESET');
    console.log('======================================\n');
    
    try {
        // Copy current to baseline
        const holdersData = fs.readFileSync('holders_data.json', 'utf8');
        fs.writeFileSync('baseline_1hr.json', holdersData);
        
        const data = JSON.parse(holdersData);
        
        // Clear gainers (since all will be 0)
        fs.writeFileSync('hourly-gainers.json', '[]');
        
        console.log('✅ Baseline reset complete');
        console.log(`   👥 ${data.length.toLocaleString()} baselines updated`);
        console.log('   📊 All scores are now 0');
        console.log('======================================\n');
        
        res.json({
            success: true,
            totalHolders: data.length,
            message: 'Baseline reset successfully - all scores are now 0'
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