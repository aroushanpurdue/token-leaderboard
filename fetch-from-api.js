require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const axios = require('axios');
const fs = require('fs');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const TOKEN_ADDRESS = '0x597512cbdf1De65AbEEdA7b927A1fB054D2afef7';
const API_BASE = 'https://mainnet.somnia.w3us.site/api/v2';
const MAX_RETRIES = 3;
const DELAY_MS = 100;

async function fetchAllHolders() {
    console.log('🚀 Fetching holders from Somnia API...\n');
    
    let allHolders = [];
    let nextPageParams = null;
    let page = 1;
    let consecutiveEmptyPages = 0;
    const MAX_EMPTY_PAGES = 5;
    
    while (true) {
        let retries = 0;
        let success = false;
        let data = null;
        
        while (retries < MAX_RETRIES && !success) {
            try {
                let url = `${API_BASE}/tokens/${TOKEN_ADDRESS}/holders`;
                
                if (nextPageParams) {
                    const params = new URLSearchParams(nextPageParams);
                    url += `?${params.toString()}`;
                }
                
                const response = await axios.get(url, {
                    timeout: 30000,
                    headers: {
                        'Accept': 'application/json'
                    }
                });
                
                data = response.data;
                success = true;
                
            } catch (error) {
                retries++;
                console.error(`❌ Error on page ${page}, retry ${retries}/${MAX_RETRIES}:`, error.message);
                
                if (retries < MAX_RETRIES) {
                    await new Promise(resolve => setTimeout(resolve, 1000 * retries));
                } else {
                    console.error(`💔 Failed after ${MAX_RETRIES} retries, stopping fetch`);
                    break;
                }
            }
        }
        
        if (!success || !data) {
            console.log(`⚠️  Fetch failed, stopping at ${allHolders.length} holders`);
            break;
        }
        
        // Check if we got items
        if (!data.items || data.items.length === 0) {
            consecutiveEmptyPages++;
            console.log(`⚠️  Empty page ${page}, consecutive: ${consecutiveEmptyPages}`);
            
            if (consecutiveEmptyPages >= MAX_EMPTY_PAGES) {
                console.log(`🛑 ${MAX_EMPTY_PAGES} consecutive empty pages, stopping`);
                break;
            }
            
            // Try next page anyway
            if (data.next_page_params) {
                nextPageParams = data.next_page_params;
                page++;
                continue;
            } else {
                break;
            }
        }
        
        // Reset empty counter
        consecutiveEmptyPages = 0;
        
        // Add holders
        allHolders = allHolders.concat(data.items);
        
        // Progress log
        if (allHolders.length % 1000 === 0) {
            console.log(`✅ Fetched ${allHolders.length} holders (page ${page})...`);
        }
        
        // Check for next page
        if (data.next_page_params) {
            nextPageParams = data.next_page_params;
            page++;
            
            // Small delay to avoid rate limits
            await new Promise(resolve => setTimeout(resolve, DELAY_MS));
        } else {
            console.log(`✅ No more pages at ${allHolders.length} holders`);
            break;
        }
        
        // Safety check - don't run forever
        if (page > 10000) {
            console.log(`⚠️  Safety limit reached at page ${page}`);
            break;
        }
    }
    
    console.log(`\n🎉 Total holders fetched: ${allHolders.length}`);
    console.log(`📄 Total pages processed: ${page}\n`);
    return allHolders;
}

async function saveToLocal(holders) {
    console.log('💾 Saving to local files...\n');
    
    // JSON format
    const jsonData = holders.map(h => ({
        address: h.address.hash.toLowerCase(),
        balance: h.value
    }));
    
    fs.writeFileSync('holders_data.json', JSON.stringify(jsonData, null, 2));
    console.log('✅ Saved to holders_data.json\n');
    
    // CSV format
    const csvRows = ['address,balance'];
    holders.forEach(h => {
        csvRows.push(`${h.address.hash.toLowerCase()},${h.value}`);
    });
    
    fs.writeFileSync('holders_data.csv', csvRows.join('\n'));
    console.log('✅ Saved to holders_data.csv\n');
}

async function saveToSupabase(holders) {
    console.log('💾 Saving to Supabase...\n');
    
    const BATCH_SIZE = 500;
    let saved = 0;
    
    for (let i = 0; i < holders.length; i += BATCH_SIZE) {
        const batch = holders.slice(i, i + BATCH_SIZE);
        
        const holdersJson = batch.map(h => ({
            address: h.address.hash.toLowerCase(),
            balance: h.value
        }));
        
        const { error } = await supabase.rpc(
            'batch_upsert_holder_balances',
            { p_holders: holdersJson }
        );
        
        if (error) {
            console.error('❌ Batch error:', error.message);
        } else {
            saved += batch.length;
            
            if (saved % 10000 === 0 || saved === holders.length) {
                console.log(`✅ Saved ${saved}/${holders.length} holders to Supabase`);
            }
        }
    }
    
    console.log('\n🎉 Supabase save complete!\n');
}

async function main() {
    const startTime = Date.now();
    
    try {
        const holders = await fetchAllHolders();
        
        if (holders.length > 0) {
            // Save to local files
            await saveToLocal(holders);
            
            // Save to Supabase (skip if no credentials)
            if (SUPABASE_URL && SUPABASE_KEY) {
                await saveToSupabase(holders);
            } else {
                console.log('⚠️  Supabase credentials not found, skipping upload\n');
            }
        } else {
            console.log('❌ No holders fetched!\n');
        }
        
        const duration = ((Date.now() - startTime) / 1000).toFixed(1);
        console.log(`⏱️  Total time: ${duration} seconds\n`);
        
        process.exit(0);
        
    } catch (error) {
        console.error('\n❌ Fatal error:', error);
        process.exit(1);
    }
}

main();
