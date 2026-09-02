const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://xdrsowoekbqalkonezcw.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_5486NL5JTIMKrmB-hxNv_Q_eF1bx5qa';
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function checkAndSeed() {
  const { data: accounts } = await supabase.from('booking_accounts').select('*');
  console.log('Existing accounts:', accounts);

  // If only Tri exists, let's add Dias Pratama and Adi Nugroho for immediate round-robin testing!
  if (accounts.length === 1) {
    const { data: inserted, error } = await supabase.from('booking_accounts').insert([
      {
        first_name: 'Dias',
        last_name: 'Pratama',
        email_prefix: 'dias.pratama',
        email: 'dias.pratama@gmail.com',
        address: 'Fortune spring Blok C1 - No 08',
        phone: '081234567890',
        is_active: true,
        total_bookings: 0,
        last_booked_at: null
      },
      {
        first_name: 'Adi',
        last_name: 'Nugroho',
        email_prefix: 'adi.nugroho',
        email: 'adi.nugroho@gmail.com',
        address: 'Fortune spring Blok B3 - No 15',
        phone: '081398765432',
        is_active: true,
        total_bookings: 0,
        last_booked_at: null
      }
    ]).select();

    console.log('Added Dias & Adi for testing:', inserted, error);
  }
}

checkAndSeed();
