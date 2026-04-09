require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_KEY
);

async function resetBaseline() {
    console.log('🔄 Resetting baseline...');
    const { data, error } = await supabase.rpc('reset_holder_baselines');
    
    if (error) {
        console.error('❌ Error:', error.message);
    } else {
        console.log('✅ Baseline reset! All scores are now 0.');
        console.log(`📊 ${data} baselines set.`);
    }
}

resetBaseline();