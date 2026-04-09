const fs = require('fs');

console.log('📊 Calculating hourly gains...\n');

// Load files
const baseline = JSON.parse(fs.readFileSync('baseline_1hr.json'));
const current = JSON.parse(fs.readFileSync('holders_data.json'));

console.log(`✅ Loaded ${baseline.length} baseline holders`);
console.log(`✅ Loaded ${current.length} current holders\n`);

// Create lookup
const baselineMap = {};
baseline.forEach(h => {
    baselineMap[h.address] = parseFloat(h.balance);
});

// Calculate gains
const gains = current.map(h => {
    const addr = h.address;
    const curr = parseFloat(h.balance);
    const base = baselineMap[addr] || 0;
    const gain = curr - base;
    
    return {
        address: addr,
        current: curr,
        baseline: base,
        gain: gain
    };
}).filter(h => h.gain > 0) // Only gainers
  .sort((a, b) => b.gain - a.gain) // Sort by gain desc
  .slice(0, 100); // Top 100

fs.writeFileSync('hourly-gainers.json', JSON.stringify(gains, null, 2));

console.log(`🎉 Saved top ${gains.length} hourly gainers!`);
console.log(`🏆 Top gainer: ${(gains[0].gain / 1e18).toFixed(2)} tokens\n`);