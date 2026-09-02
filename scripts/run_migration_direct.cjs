const { Client } = require('pg');

async function migrate() {
  // Try connecting with direct connection & SSL
  const connectionStrings = [
    'postgresql://postgres:Fortunetennisclub121@db.xdrsowoekbqalkonezcw.supabase.co:5432/postgres',
    'postgresql://postgres.xdrsowoekbqalkonezcw:Fortunetennisclub121@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres',
    'postgresql://postgres.xdrsowoekbqalkonezcw:Fortunetennisclub121@aws-0-ap-southeast-1.pooler.supabase.com:5432/postgres'
  ];

  let client;
  for (const conn of connectionStrings) {
    try {
      console.log(`Attempting connection to: ${conn.split('@')[1]}...`);
      client = new Client({
        connectionString: conn,
        ssl: { rejectUnauthorized: false },
        connectionTimeoutMillis: 10000
      });
      await client.connect();
      console.log('Connected successfully!');
      break;
    } catch (err) {
      console.warn(`Connection failed to ${conn.split('@')[1]}:`, err.message);
      client = null;
    }
  }

  if (!client) {
    console.error('Could not connect to any Supabase PostgreSQL endpoint.');
    return;
  }

  try {
    console.log('Creating court_booking_settings and booked_courts tables...');
    
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.court_booking_settings (
        id SERIAL PRIMARY KEY,
        email_prefix TEXT NOT NULL DEFAULT 'tri.kartika.putra',
        email_domain TEXT NOT NULL DEFAULT 'gmail.com',
        current_email_index INTEGER NOT NULL DEFAULT 4,
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

    await client.query(`
      INSERT INTO public.court_booking_settings (
        id, email_prefix, email_domain, current_email_index, first_name, last_name, address, phone, is_active, last_check_message
      )
      VALUES (
        1, 'tri.kartika.putra', 'gmail.com', 4, 'Tri', 'Putra', 'Fortune spring Blok D2 - J05', '08111819112', true, 'Sistem auto-booking aktif'
      )
      ON CONFLICT (id) DO UPDATE SET current_email_index = 4;
    `);

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

    // Insert Monday 7 Sep booking
    await client.query(`
      INSERT INTO public.booked_courts (
        booking_date, booking_time, day_name, booked_email, first_name, last_name, phone, status, notes
      )
      VALUES (
        '7 September 2026', '09:00 – 10:00', 'Senin', 'tri.kartika.putra+2@gmail.com', 'Tri', 'Putra', '08111819112', 'confirmed', 'Auto-booked via Bot on 02 Sep 2026'
      );
    `);

    // Disable RLS and grant all permissions to anon/authenticated/service_role
    await client.query(`ALTER TABLE public.court_booking_settings DISABLE ROW LEVEL SECURITY;`);
    await client.query(`ALTER TABLE public.booked_courts DISABLE ROW LEVEL SECURITY;`);
    
    await client.query(`GRANT ALL ON TABLE public.court_booking_settings TO anon, authenticated, service_role;`);
    await client.query(`GRANT ALL ON TABLE public.booked_courts TO anon, authenticated, service_role;`);
    await client.query(`GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;`);

    // Reload PostgREST schema cache
    await client.query(`NOTIFY pgrst, 'reload schema';`);

    console.log('Tables created, permissions granted, and schema cache reloaded successfully!');
  } catch (err) {
    console.error('Migration error:', err);
  } finally {
    await client.end();
  }
}

migrate();
