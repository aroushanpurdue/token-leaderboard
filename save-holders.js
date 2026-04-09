require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// Read the holders data that was already fetched
async function saveExistingData() {
    console.log('💾 Attempting to save data to Supabase...');
    
    // Check if we can save test data
    const testData = [{
        address: '0x1234567890123456789012345678901234567890',
        balance: '1000000000000000000'
    }];
    
    const { data, error } = await supabase.rpc(
        'batch_upsert_holder_balances',
        { p_holders: testData }
    );
    
    if (error) {
        console.error('❌ Function still missing:', error.message);
        console.log('\n🔧 Please run the SQL function in Supabase first!');
        return;
    }
    
    console.log('✅ Function works! Ready to save full data.');
    console.log('\n📊 Now run: node fetch-from-api.js');
}

saveExistingData();