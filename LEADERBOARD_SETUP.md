# Token Holder Leaderboard - Complete Setup Guide

## 🎯 Overview

This system tracks **individual holder scores** for 100K+ token holders. When you reset the baseline, **all previous scores become 0** and tracking starts fresh from that moment.

### How It Works

```
1. Initial State: No baseline set
   - Holder A has 1000 tokens → Score: N/A (no baseline)
   - Holder B has 500 tokens → Score: N/A (no baseline)

2. Admin clicks "Reset Baseline" (takes snapshot)
   - Holder A: Baseline = 1000, Current = 1000 → Score: 0
   - Holder B: Baseline = 500, Current = 500 → Score: 0

3. Later, after balances change
   - Holder A: Baseline = 1000, Current = 1200 → Score: +200
   - Holder B: Baseline = 500, Current = 450 → Score: -50 (displays as 0, below 100 threshold)

4. Admin clicks "Reset Baseline" again
   - Holder A: Baseline = 1200, Current = 1200 → Score: 0 (previous +200 is gone)
   - Holder B: Baseline = 450, Current = 450 → Score: 0
```

## 📊 Database Tables

### 1. `holder_balances`
Current token balance for each holder
- Updated regularly by backend
- 100K+ rows

### 2. `holder_baselines`
Baseline snapshot for scoring
- When admin resets: old ones marked `is_active = false`, new ones created
- Only one active baseline per holder

### 3. `leaderboard_snapshots`
Historical leaderboard records
- Saved periodically for analytics
- Optional table

## 🚀 Quick Start (5 Minutes)

### Step 1: Setup Supabase

1. Create free account at [supabase.com](https://supabase.com)
2. Create new project
3. Go to **SQL Editor** → New Query
4. Copy-paste entire `leaderboard_schema.sql` file
5. Click **Run**
6. Get your credentials:
   - Settings → API → Project URL
   - Settings → API → anon/public key

### Step 2: Configure The Graph (RECOMMENDED for 100K holders)

**Option A: Use The Graph (Best Performance)**

1. Visit [thegraph.com/studio](https://thegraph.com/studio)
2. Create new subgraph for your token
3. Deploy subgraph to Somnia network
4. Get subgraph endpoint URL
5. Add to `.env`:
   ```bash
   GRAPH_ENDPOINT=https://api.thegraph.com/subgraphs/name/your-subgraph
   ```

**Option B: Use Moralis (Alternative)**

1. Sign up at [moralis.io](https://moralis.io)
2. Get API key
3. Add to `.env`:
   ```bash
   MORALIS_API_KEY=your_moralis_key
   ```

**Option C: Direct RPC (Slowest - 30+ min for 100K holders)**

- No additional setup needed
- Uses standard RPC endpoint
- ⚠️ Very slow for large holder counts

### Step 3: Install Backend

```bash
# Clone or download the files
cd token-holder-leaderboard

# Install dependencies
npm install

# Setup environment
cp .env.example .env
nano .env  # Edit with your credentials
```

Your `.env` should look like:
```bash
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_KEY=your-anon-key-here
RPC_URL=https://dream.somnia.network
GRAPH_ENDPOINT=https://api.thegraph.com/subgraphs/name/your-subgraph
DEPLOYMENT_BLOCK=0
```

### Step 4: Initial Data Load

```bash
# Update all holder balances (takes 5-30 min depending on method)
npm run update

# Set initial baseline (all scores become 0)
npm run reset

# View leaderboard
npm run leaderboard 50
```

### Step 5: Open Dashboard

1. Open `leaderboard-dashboard.html` in browser
2. Enter your Supabase URL and key
3. Click "Initialize"
4. Done! 🎉

## 🎮 Usage

### Frontend (Dashboard)

**View Leaderboard**
- Automatically loads top 100 holders with scores ≥ 100
- Updates every 30 seconds
- Shows rank, address, current balance, baseline, score

**Refresh Leaderboard**
- Fetches latest data from database
- Updates stats

**Reset Baseline**
- ⚠️ Makes all current scores → 0
- Takes snapshot of current balances
- Future calculations start from this point

**Export to CSV**
- Downloads current leaderboard as CSV
- Includes all visible data

### Backend (Node.js CLI)

```bash
# Update all holder balances from blockchain
npm run update

# Show top 100 leaderboard
npm run leaderboard

# Show top 50 leaderboard
node leaderboard-tracker.js leaderboard 50

# Reset baseline (all scores → 0)
npm run reset

# Save current leaderboard snapshot
npm run snapshot

# Show statistics
npm run stats

# Full refresh (update + show + snapshot)
npm run full-refresh
```

## ⚙️ How Score Calculation Works

```javascript
// For each holder:
score = current_balance - baseline_balance

// Filter rule:
if (Math.abs(score) < 100) {
    // Don't show on leaderboard
    exclude();
}
```

**Examples:**
- Current: 1500, Baseline: 1000 → Score: +500 ✅ (shown)
- Current: 1050, Baseline: 1000 → Score: +50 ❌ (hidden, < 100)
- Current: 900, Baseline: 1000 → Score: -100 ✅ (shown)
- Current: 950, Baseline: 1000 → Score: -50 ❌ (hidden, < 100)

## 🔄 Automated Updates

### Using Cron (Linux/Mac)

```bash
# Edit crontab
crontab -e

# Update balances every hour
0 * * * * cd /path/to/project && /usr/bin/node leaderboard-tracker.js update >> logs/update.log 2>&1

# Save snapshot daily at midnight
0 0 * * * cd /path/to/project && /usr/bin/node leaderboard-tracker.js snapshot >> logs/snapshot.log 2>&1
```

### Using PM2 (Recommended)

```bash
# Install PM2
npm install -g pm2

# Create ecosystem.config.js
module.exports = {
  apps: [{
    name: 'leaderboard-update',
    script: 'leaderboard-tracker.js',
    args: 'update',
    cron_restart: '0 * * * *',  // Every hour
    autorestart: false
  }]
};

# Start
pm2 start ecosystem.config.js
pm2 save
pm2 startup  # Enable on boot
```

## 📈 Performance Tips

### For 100K+ Holders

**1. Use The Graph (Fastest)**
- Queries complete in seconds
- No RPC rate limiting issues
- Recommended for production

**2. Cache Aggressively**
- Update balances hourly, not on every page load
- Use Supabase database as cache
- Frontend reads from database, not blockchain

**3. Batch Processing**
- Default: 500 holders per batch
- Adjust `BATCH_SIZE` in code if needed

**4. Set Deployment Block**
- Reduces event scanning time
- Add to `.env`: `DEPLOYMENT_BLOCK=12345678`

**5. Use Indexes**
- Already configured in schema
- Don't delete the indexes

## 🔒 Security Best Practices

### Supabase RLS (Row Level Security)

Current setup allows:
- ✅ Anyone can READ leaderboard
- ✅ Anyone can INSERT/UPDATE (via anon key)

**For Production, add authentication:**

```sql
-- Restrict writes to authenticated users only
DROP POLICY "Allow authenticated insert on balances" ON holder_balances;

CREATE POLICY "Allow service role writes" 
ON holder_balances FOR ALL 
TO authenticated 
USING (true);
```

Then use service role key in backend `.env`:
```bash
SUPABASE_KEY=your-service-role-key  # Not anon key
```

### API Keys

- Never commit `.env` to git
- Use environment variables in production
- Rotate keys regularly

## 🐛 Troubleshooting

### "No holders found"

**Cause:** Token has no transfers yet OR wrong contract address

**Fix:**
- Verify contract address: `0x597512cbdf1De65AbEEdA7b927A1fB054D2afef7`
- Check network is correct (Somnia mainnet)
- Ensure token has actual holders

### "Update takes forever"

**Cause:** Using direct RPC for 100K holders

**Fix:**
- Setup The Graph indexer
- OR use Moralis API
- OR reduce `CHUNK_SIZE` and `CONCURRENCY_LIMIT` in code

### "Leaderboard is empty"

**Cause:** No scores meet the ≥100 threshold

**Fix:**
- This is normal if all changes are small
- Check actual scores: `npm run stats`
- Reduce threshold in SQL if needed:
  ```sql
  WHERE sh.calculated_score >= 100  -- Change to 10 or 1
  ```

### "Supabase connection failed"

**Cause:** Wrong URL or key

**Fix:**
- Double-check Supabase credentials
- Ensure project is not paused
- Check RLS policies allow access

### "Out of memory"

**Cause:** Processing too many holders at once

**Fix:**
- Reduce `BATCH_SIZE` in code (default 500 → try 100)
- Increase Node.js memory: `node --max-old-space-size=4096 leaderboard-tracker.js update`

## 📊 Analytics Queries

### Top Gainers
```sql
SELECT wallet_address, score
FROM get_live_leaderboard(100)
WHERE score > 0
ORDER BY score DESC
LIMIT 10;
```

### Top Losers
```sql
SELECT wallet_address, score
FROM get_live_leaderboard(100)
WHERE score < 0
ORDER BY score ASC
LIMIT 10;
```

### Total Score Movement
```sql
SELECT 
    SUM(CASE WHEN score > 0 THEN score ELSE 0 END) as total_gains,
    SUM(CASE WHEN score < 0 THEN score ELSE 0 END) as total_losses
FROM get_live_leaderboard(10000);
```

### Baseline Reset History
```sql
SELECT DISTINCT baseline_date
FROM holder_baselines
WHERE is_active = false
ORDER BY baseline_date DESC;
```

## 🎯 Workflow Example

**Scenario: Starting fresh tracking today**

```bash
# Day 1: Initial setup
npm run update      # Load all current balances
npm run reset       # Set baseline (all scores = 0)
npm run leaderboard # Empty (no changes yet)

# Day 2: After some trading
npm run update      # Update balances
npm run leaderboard # Shows changes from Day 1
# Output:
# Rank 1: 0x123...abc → Score: +5000
# Rank 2: 0x456...def → Score: +3200

# Day 7: Reset baseline again
npm run reset       # All scores back to 0
npm run leaderboard # Empty again

# Day 8: New tracking period
npm run update
npm run leaderboard # Shows changes from Day 7
```

## 🚀 Advanced Features

### Custom Score Formula

Edit in `leaderboard_schema.sql`:
```sql
-- Default: simple difference
calculated_score = current_balance - baseline_balance

-- Percentage change:
calculated_score = (current_balance - baseline_balance) / baseline_balance * 100

-- Weighted by baseline:
calculated_score = (current_balance - baseline_balance) * LOG(baseline_balance)
```

### Real-time Updates

Add Supabase realtime subscription in dashboard:
```javascript
const subscription = supabase
    .channel('leaderboard-updates')
    .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'holder_balances' },
        payload => { refreshLeaderboard(); }
    )
    .subscribe();
```

### Multi-Token Support

Add `token_address` column to all tables and filter by it.

## 📞 Support

- Supabase Docs: https://supabase.com/docs
- The Graph Docs: https://thegraph.com/docs
- Ethers.js Docs: https://docs.ethers.org

## 📝 License

MIT
