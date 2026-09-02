const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://xdrsowoekbqalkonezcw.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_5486NL5JTIMKrmB-hxNv_Q_eF1bx5qa';
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function check() {
  console.log('Testing Supabase Anon Key read/write...');
  
  const { data: settings, error: settingsError } = await supabase
    .from('court_booking_settings')
    .select('*');
  console.log('court_booking_settings:', { settings, settingsError });

  const { data: courts, error: courtsError } = await supabase
    .from('booked_courts')
    .select('*');
  console.log('booked_courts:', { courts, courtsError });
}

check();
