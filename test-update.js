require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_KEY
);

async function testUpdate() {
    console.log('🔄 Updating test balance...');
    
    // Get first wallet
    const { data: wallets } = await supabase
        .from('holder_balances')
        .select('wallet_address')
        .limit(1);
    
    if (!wallets || wallets.length === 0) {
        console.log('❌ No wallets found');
        return;
    }
    
    const wallet = wallets[0].wallet_address;
    console.log(`📝 Updating wallet: ${wallet}`);
    
    // Update balance (add 1000 tokens)
    const { error } = await supabase
        .from('holder_balances')
        .update({ 
            current_balance: '1000000000000000000000',
            last_updated: new Date().toISOString()
        })
        .eq('wallet_address', wallet);
    
    if (error) {
        console.error('❌ Error:', error.message);
    } else {
        console.log('✅ Test balance updated!');
        console.log('🎯 Now refresh dashboard - you should see 1 entry!');
    }
}

testUpdate();