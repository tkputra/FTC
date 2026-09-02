const { Client } = require('pg');

async function migrateMultiAccounts() {
  const connectionString = 'postgresql://postgres:Fortunetennisclub121@db.xdrsowoekbqalkonezcw.supabase.co:5432/postgres';

  const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 10000
  });

  try {
    console.log('Connecting to Supabase PostgreSQL...');
    await client.connect();
    console.log('Connected!');

    console.log('Creating booking_accounts table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.booking_accounts (
        id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        first_name TEXT NOT NULL,
        last_name TEXT NOT NULL,
        email_prefix TEXT NOT NULL,
        email_domain TEXT NOT NULL DEFAULT 'gmail.com',
        current_email_index INTEGER NOT NULL DEFAULT 1,
        address TEXT NOT NULL,
        phone TEXT NOT NULL,
        is_active BOOLEAN NOT NULL DEFAULT true,
        total_bookings INTEGER NOT NULL DEFAULT 0,
        last_booked_at TIMESTAMP WITH TIME ZONE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
      );
    `);

    // Insert Tri Putra if not exists
    const res = await client.query(`SELECT id FROM public.booking_accounts WHERE email_prefix = 'tri.kartika.putra';`);
    if (res.rows.length === 0) {
      await client.query(`
        INSERT INTO public.booking_accounts (
          first_name, last_name, email_prefix, email_domain, current_email_index, address, phone, is_active, total_bookings, last_booked_at
        ) VALUES (
          'Tri', 'Putra', 'tri.kartika.putra', 'gmail.com', 4, 'Fortune spring Blok D2 - J05', '08111819112', true, 1, timezone('utc'::text, now())
        );
      `);
      console.log('Inserted default profile for Tri Putra (Index +4).');
    } else {
      console.log('Profile for Tri Putra already exists.');
    }

    // Grant permissions and disable RLS
    await client.query(`ALTER TABLE public.booking_accounts DISABLE ROW LEVEL SECURITY;`);
    await client.query(`GRANT ALL ON TABLE public.booking_accounts TO anon, authenticated, service_role;`);
    await client.query(`NOTIFY pgrst, 'reload schema';`);

    console.log('Migration for booking_accounts completed successfully!');
  } catch (err) {
    console.error('Migration error:', err);
  } finally {
    await client.end();
  }
}

migrateMultiAccounts();
