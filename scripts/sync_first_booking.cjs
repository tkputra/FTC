const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://xdrsowoekbqalkonezcw.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_5486NL5JTIMKrmB-hxNv_Q_eF1bx5qa';
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function sync() {
  try {
    const { data: existing } = await supabase.from('booked_courts').select('*').eq('booked_email', 'tri.kartika.putra+2@gmail.com');
    if (!existing || existing.length === 0) {
      await supabase.from('booked_courts').insert([{
        booking_date: '7 September 2026',
        booking_time: '09:00 – 10:00',
        day_name: 'Senin',
        booked_email: 'tri.kartika.putra+2@gmail.com',
        first_name: 'Tri',
        last_name: 'Putra',
        phone: '08111819112',
        status: 'confirmed',
        notes: 'Berhasil dibooking otomatis via Bot (Playwright) pada 02 Sep 2026'
      }]);
      console.log('Synchronized Monday booking to Supabase.');
    } else {
      console.log('Booking already exists in Supabase.');
    }

    await supabase.from('court_booking_settings').upsert({
      id: 1,
      email_prefix: 'tri.kartika.putra',
      email_domain: 'gmail.com',
      current_email_index: 3,
      first_name: 'Tri',
      last_name: 'Putra',
      address: 'Fortune spring Blok D2 - J05',
      phone: '08111819112',
      target_hours: ['6:00am', '7:00am', '8:00am', '9:00am', '4:00pm', '5:00pm', '6:00pm'],
      target_days: ['Mon', 'Tue', 'Wed', 'Thu'],
      is_active: true,
      last_check_at: new Date().toISOString(),
      last_check_status: 'booked',
      last_check_message: 'Berhasil booking Senin, 7 September 09:00 - 10:00 menggunakan tri.kartika.putra+2@gmail.com'
    });
    console.log('Settings updated with current index: +3');
  } catch (err) {
    console.error('Sync error:', err);
  }
}

sync();
