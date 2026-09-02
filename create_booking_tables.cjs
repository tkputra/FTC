const { Client } = require('pg');
const client = new Client({ connectionString: 'postgresql://postgres:Fortunetennisclub121@db.xdrsowoekbqalkonezcw.supabase.co:5432/postgres' });

async function run() {
  try {
    await client.connect();
    
    // Create booking_settings table
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.booking_settings (
        id SERIAL PRIMARY KEY,
        email_prefix TEXT NOT NULL DEFAULT 'tri.kartika.putra',
        email_domain TEXT NOT NULL DEFAULT 'gmail.com',
        current_email_index INTEGER NOT NULL DEFAULT 1,
        target_url TEXT DEFAULT '',
        check_interval_minutes INTEGER NOT NULL DEFAULT 10,
        is_active BOOLEAN NOT NULL DEFAULT false,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
      );
    `);

    // Insert default row if not exists
    await client.query(`
      INSERT INTO public.booking_settings (id, email_prefix, email_domain, current_email_index, is_active)
      VALUES (1, 'tri.kartika.putra', 'gmail.com', 1, false)
      ON CONFLICT (id) DO NOTHING;
    `);

    // Create booking_logs table
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.booking_logs (
        id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        checked_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
        status TEXT NOT NULL,
        message TEXT,
        booked_email TEXT
      );
    `);

    // Disable RLS for ease of frontend admin configuration
    await client.query(`
      ALTER TABLE public.booking_settings DISABLE ROW LEVEL SECURITY;
      ALTER TABLE public.booking_logs DISABLE ROW LEVEL SECURITY;
    `);

    console.log("Booking migration completed successfully!");
  } catch(e) {
    console.error("Migration failed:", e);
  } finally {
    await client.end();
  }
}

run();
