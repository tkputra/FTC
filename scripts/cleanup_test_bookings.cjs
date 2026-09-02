const { Client } = require('pg');

async function cleanup() {
  const connectionString = 'postgresql://postgres:Fortunetennisclub121@db.xdrsowoekbqalkonezcw.supabase.co:5432/postgres';
  const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 10000
  });

  try {
    await client.connect();
    console.log('Connected to PostgreSQL!');

    // 1. Delete testing bookings (10:00, 14:00, 15:00)
    const delRes = await client.query(`
      DELETE FROM public.booked_courts 
      WHERE booking_time LIKE '%10:00%' 
         OR booking_time LIKE '%14:00%' 
         OR booking_time LIKE '%15:00%';
    `);
    console.log(`Deleted ${delRes.rowCount} testing booking records from booked_courts.`);

    // 2. Reset target_hours in court_booking_settings
    await client.query(`
      UPDATE public.court_booking_settings
      SET target_hours = ARRAY['6:00am', '7:00am', '8:00am', '9:00am', '4:00pm', '5:00pm', '6:00pm', '7:00pm'],
          last_check_status: 'idle',
          last_check_message: 'Sistem siap memantau 8 slot target (06-09 AM & 16-19 PM)',
          updated_at = timezone('utc'::text, now())
      WHERE id = 1;
    `);

    // 3. Reset booking counters on booking_accounts
    await client.query(`
      UPDATE public.booking_accounts
      SET total_bookings = CASE WHEN email LIKE '%tri%' THEN 1 ELSE 0 END,
          last_booked_at = CASE WHEN email LIKE '%tri%' THEN timezone('utc'::text, now()) ELSE NULL END;
    `);

    // 4. Reload schema cache
    await client.query(`NOTIFY pgrst, 'reload schema';`);
    console.log('Database cleanup completed successfully!');
  } catch (err) {
    console.error('Cleanup error:', err);
  } finally {
    await client.end();
  }
}

cleanup();
