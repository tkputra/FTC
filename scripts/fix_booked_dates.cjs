const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://xdrsowoekbqalkonezcw.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_5486NL5JTIMKrmB-hxNv_Q_eF1bx5qa';
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function fixDates() {
  const updates = [
    { id: 'a4bbbf53-e94a-4f4c-9683-93c978bb0bbb', booking_date: '2 September 2026', booking_time: '15:00 – 16:00', day_name: 'Rabu' },
    { id: '0fb494f2-fc08-4460-8bdf-a1fd46b25ce7', booking_date: '3 September 2026', booking_time: '10:00 – 11:00', day_name: 'Kamis' },
    { id: '331aebf7-9266-45bd-8018-d498b4488cce', booking_date: '3 September 2026', booking_time: '14:00 – 15:00', day_name: 'Kamis' },
    { id: 'e83b3780-b717-4ed8-997b-bf7a60e7c300', booking_date: '7 September 2026', booking_time: '10:00 – 11:00', day_name: 'Senin' },
    { id: '0daae975-4620-4838-8ab3-bc51d0228b31', booking_date: '7 September 2026', booking_time: '14:00 – 15:00', day_name: 'Senin' }
  ];

  for (const u of updates) {
    await supabase.from('booked_courts').update({
      booking_date: u.booking_date,
      booking_time: u.booking_time,
      day_name: u.day_name
    }).eq('id', u.id);
  }

  console.log('Successfully updated dates for all booked courts in Supabase!');
}

fixDates();
