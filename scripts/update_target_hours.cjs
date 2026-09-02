const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://xdrsowoekbqalkonezcw.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_5486NL5JTIMKrmB-hxNv_Q_eF1bx5qa';
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function update() {
  const { data, error } = await supabase
    .from('court_booking_settings')
    .update({
      target_hours: ['6:00am', '7:00am', '8:00am', '9:00am', '4:00pm', '5:00pm', '6:00pm', '7:00pm'],
      updated_at: new Date().toISOString()
    })
    .eq('id', 1);

  if (error) console.error('Error updating target_hours:', error);
  else console.log('Successfully updated Supabase target_hours to 6am, 7am, 8am, 9am, 4pm, 5pm, 6pm, 7pm!');
}

update();
