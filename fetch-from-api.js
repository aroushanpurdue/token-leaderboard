require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const axios = require('axios');
const fs = require('fs');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const TOKEN_ADDRESS = '0x597512cbdf1De65AbEEdA7b927A1fB054D2afef7';
const API_BASE = 'https://mainnet.somnia.w3us.site/api/v2';

async function fetchAllHolders() {
    console.log('🚀 Fetching holders from Somnia API...\n');
    
    let allHolders = [];
    let nextPageParams = null;
    let page = 1;
    
    while (true) {
        try {
            let url = `${API_BASE}/tokens/${TOKEN_ADDRESS}/holders`;
            
            if (nextPageParams) {
                const params = new URLSearchParams(nextPageParams);
                url += `?${params.toString()}`;
            }
            
            const response = await axios.get(url);
            const data = response.data;
            
            if (!data.items || data.items.length === 0) {
                break;
            }
            
            allHolders = allHolders.concat(data.items);
            
            if (allHolders.length % 1000 === 0) {
                console.log(`✅ Fetched ${allHolders.length} holders...`);
            }
            
            if (data.next_page_params) {
                nextPageParams = data.next_page_params;
                page++;
            } else {
                break;
            }
            
        } catch (error) {
            console.error(`❌ Error on page ${page}:`, error.message);
            break;
        }
    }
    
    console.log(`\n🎉 Total holders: ${allHolders.length}\n`);
    return allHolders;
}

async function saveToLocal(holders) {
    console.log('💾 Saving to local file...\n');
    
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
                console.log(`✅ Saved ${saved}/${holders.length} holders`);
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
            
            // Save to Supabase
            await saveToSupabase(holders);
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