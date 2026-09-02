const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://xdrsowoekbqalkonezcw.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_5486NL5JTIMKrmB-hxNv_Q_eF1bx5qa';
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function seed() {
  const { data: accounts } = await supabase.from('booking_accounts').select('*');
  console.log('Current accounts in Supabase:', accounts);
}

seed();
