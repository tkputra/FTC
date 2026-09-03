const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://xdrsowoekbqalkonezcw.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_5486NL5JTIMKrmB-hxNv_Q_eF1bx5qa';
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function checkStatus() {
  const { data } = await supabase.from('court_booking_settings').select('*').eq('id', 1).single();
  console.log('Current status in Supabase:', {
    last_check_at: data.last_check_at,
    last_check_status: data.last_check_status,
    last_check_message: data.last_check_message
  });
}

checkStatus();
