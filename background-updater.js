const { exec } = require('child_process');

let isUpdating = false;
let lastUpdate = null;
let updateStatus = {
    running: false,
    progress: 0,
    totalHolders: 0,
    gainers: 0,
    error: null,
    lastCompleted: null
};

function startBackgroundUpdate() {
    if (isUpdating) {
        console.log('⚠️  Update already in progress');
        return false;
    }

    isUpdating = true;
    updateStatus.running = true;
    updateStatus.error = null;
    
    console.log('\n🔄 Starting background update...\n');
    
    // Run fetch in background
    const fetchProcess = exec('node fetch-from-api.js');
    
    fetchProcess.stdout.on('data', (data) => {
        console.log(data.toString());
        
        // Parse progress from output
        const match = data.toString().match(/Fetched (\d+) holders/);
        if (match) {
            updateStatus.progress = parseInt(match[1]);
        }
    });
    
    fetchProcess.stderr.on('data', (data) => {
        console.error('FETCH ERROR:', data.toString());
    });
    
    fetchProcess.on('close', (code) => {
        if (code === 0) {
            console.log('✅ Fetch complete, calculating gains...\n');
            
            // Run calculate
            const calcProcess = exec('node calculate-hourly.js');
            
            calcProcess.on('close', (calcCode) => {
                if (calcCode === 0) {
                    const fs = require('fs');
                    const gainers = JSON.parse(fs.readFileSync('hourly-gainers.json', 'utf8'));
                    const holders = JSON.parse(fs.readFileSync('holders_data.json', 'utf8'));
                    
                    updateStatus.running = false;
                    updateStatus.totalHolders = holders.length;
                    updateStatus.gainers = gainers.length;
                    updateStatus.lastCompleted = new Date().toISOString();
                    updateStatus.progress = holders.length;
                    
                    console.log('🎉 Background update complete!');
                    console.log(`   Holders: ${holders.length}`);
                    console.log(`   Gainers: ${gainers.length}\n`);
                } else {
                    updateStatus.error = 'Calculate failed';
                }
                
                isUpdating = false;
            });
        } else {
            updateStatus.running = false;
            updateStatus.error = 'Fetch failed';
            isUpdating = false;
        }
    });
    
    return true;
}

function getUpdateStatus() {
    return updateStatus;
}

module.exports = { startBackgroundUpdate, getUpdateStatus };
