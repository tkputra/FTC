const { Client } = require('pg');
const client = new Client({ connectionString: 'postgresql://postgres:Fortunetennisclub121@db.xdrsowoekbqalkonezcw.supabase.co:5432/postgres' });

async function run() {
  try {
    await client.connect();
    console.log("Connected to Supabase PostgreSQL.");

    // 1. Create court_booking_settings table
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.court_booking_settings (
        id SERIAL PRIMARY KEY,
        email_prefix TEXT NOT NULL DEFAULT 'tri.kartika.putra',
        email_domain TEXT NOT NULL DEFAULT 'gmail.com',
        current_email_index INTEGER NOT NULL DEFAULT 2,
        first_name TEXT NOT NULL DEFAULT 'Tri',
        last_name TEXT NOT NULL DEFAULT 'Putra',
        address TEXT NOT NULL DEFAULT 'Fortune spring Blok D2 - J05',
        phone TEXT NOT NULL DEFAULT '08111819112',
        target_hours TEXT[] NOT NULL DEFAULT ARRAY['6:00am', '7:00am', '8:00am', '9:00am', '4:00pm', '5:00pm', '6:00pm'],
        target_days TEXT[] NOT NULL DEFAULT ARRAY['Mon', 'Tue', 'Wed', 'Thu', 'Senin', 'Selasa', 'Rabu', 'Kamis'],
        is_active BOOLEAN NOT NULL DEFAULT true,
        last_check_at TIMESTAMP WITH TIME ZONE,
        last_check_status TEXT DEFAULT 'idle',
        last_check_message TEXT DEFAULT 'Sistem siap',
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
      );
    `);

    // 2. Insert initial settings row if not exists
    await client.query(`
      INSERT INTO public.court_booking_settings (
        id, email_prefix, email_domain, current_email_index, first_name, last_name, address, phone, is_active, last_check_message
      )
      VALUES (
        1, 'tri.kartika.putra', 'gmail.com', 2, 'Tri', 'Putra', 'Fortune spring Blok D2 - J05', '08111819112', true, 'Sistem auto-booking siap'
      )
      ON CONFLICT (id) DO NOTHING;
    `);

    // 3. Create booked_courts table
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.booked_courts (
        id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        booking_date TEXT NOT NULL,
        booking_time TEXT NOT NULL,
        day_name TEXT,
        booked_email TEXT NOT NULL,
        first_name TEXT DEFAULT 'Tri',
        last_name TEXT DEFAULT 'Putra',
        phone TEXT DEFAULT '08111819112',
        status TEXT NOT NULL DEFAULT 'confirmed',
        notes TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
      );
    `);

    // 4. Disable RLS for ease of frontend and automated bot interaction
    await client.query(`ALTER TABLE public.court_booking_settings DISABLE ROW LEVEL SECURITY;`);
    await client.query(`ALTER TABLE public.booked_courts DISABLE ROW LEVEL SECURITY;`);

    console.log("Migration for court booking system completed successfully!");
  } catch(e) {
    console.error("Migration failed:", e);
  } finally {
    await client.end();
  }
}

run();
