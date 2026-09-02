const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://xdrsowoekbqalkonezcw.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_5486NL5JTIMKrmB-hxNv_Q_eF1bx5qa';
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function inspectBookedCourts() {
  const { data } = await supabase.from('booked_courts').select('*').order('created_at', { ascending: false });
  console.log('Booked courts:', JSON.stringify(data, null, 2));
}

inspectBookedCourts();
