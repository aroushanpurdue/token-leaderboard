const { exec } = require('child_process');
const fs = require('fs');

let isUpdating = false;
let updateStatus = {
    running: false,
    progress: 0,
    totalHolders: 0,
    gainers: 0,
    error: null,
    lastCompleted: null,
    startTime: null
};

function startBackgroundUpdate() {
    if (isUpdating) {
        console.log('⚠️  Update already in progress');
        return { success: false, message: 'Update already running' };
    }

    isUpdating = true;
    updateStatus.running = true;
    updateStatus.error = null;
    updateStatus.progress = 0;
    updateStatus.startTime = new Date().toISOString();
    
    console.log('\n🔄 ========================================');
    console.log('   BACKGROUND UPDATE STARTED');
    console.log('========================================\n');
    
    // Step 0: Save baseline
    try {
        if (fs.existsSync('holders_data.json')) {
            const currentData = fs.readFileSync('holders_data.json', 'utf8');
            fs.writeFileSync('baseline_1hr.json', currentData);
            console.log('✅ Baseline saved\n');
        }
    } catch (err) {
        console.error('❌ Baseline save error:', err.message);
    }
    
    // Step 1: Fetch in background
    const fetchProcess = exec('node fetch-from-api.js', {
        maxBuffer: 50 * 1024 * 1024 // 50MB buffer
    });
    
    fetchProcess.stdout.on('data', (data) => {
        const output = data.toString();
        console.log(output);
        
        // Parse progress
        const match = output.match(/Fetched (\d+) holders/);
        if (match) {
            updateStatus.progress = parseInt(match[1]);
        }
    });
    
    fetchProcess.stderr.on('data', (data) => {
        console.error('FETCH ERROR:', data.toString());
    });
    
    fetchProcess.on('close', (code) => {
        if (code === 0) {
            console.log('\n✅ Fetch complete, calculating gains...\n');
            
            // Step 2: Calculate
            const calcProcess = exec('node calculate-hourly.js');
            
            calcProcess.stdout.on('data', (data) => {
                console.log(data.toString());
            });
            
            calcProcess.on('close', (calcCode) => {
                if (calcCode === 0) {
                    try {
                        const gainers = JSON.parse(fs.readFileSync('hourly-gainers.json', 'utf8'));
                        const holders = JSON.parse(fs.readFileSync('holders_data.json', 'utf8'));
                        
                        updateStatus.running = false;
                        updateStatus.totalHolders = holders.length;
                        updateStatus.gainers = gainers.length;
                        updateStatus.topGain = gainers.length > 0 ? (gainers[0].gain / 1e18).toFixed(2) : '0';
                        updateStatus.lastCompleted = new Date().toISOString();
                        updateStatus.progress = holders.length;
                        
                        console.log('\n🎉 ========================================');
                        console.log('   BACKGROUND UPDATE COMPLETE!');
                        console.log('========================================');
                        console.log(`   👥 Holders: ${holders.length.toLocaleString()}`);
                        console.log(`   📈 Gainers: ${gainers.length}`);
                        console.log('========================================\n');
                    } catch (err) {
                        console.error('❌ Error reading results:', err.message);
                        updateStatus.error = 'Failed to read results';
                    }
                } else {
                    console.error('❌ Calculate failed');
                    updateStatus.running = false;
                    updateStatus.error = 'Calculate failed';
                }
                
                isUpdating = false;
            });
        } else {
            console.error('❌ Fetch failed with code:', code);
            updateStatus.running = false;
            updateStatus.error = 'Fetch failed';
            isUpdating = false;
        }
    });
    
    return { success: true, message: 'Update started in background' };
}

function getUpdateStatus() {
    return updateStatus;
}

module.exports = { startBackgroundUpdate, getUpdateStatus };
