const { Client } = require('pg');

async function migrate() {
  const connectionString = 'postgresql://postgres:Fortunetennisclub121@db.xdrsowoekbqalkonezcw.supabase.co:5432/postgres';
  const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 10000
  });

  try {
    await client.connect();
    console.log('Connected to PostgreSQL!');

    // Add email column if not exists
    await client.query(`
      ALTER TABLE public.booking_accounts 
      ADD COLUMN IF NOT EXISTS email TEXT;
    `);

    // Populate email from email_prefix and email_domain
    await client.query(`
      UPDATE public.booking_accounts 
      SET email = CASE 
        WHEN email_prefix LIKE '%@%' THEN email_prefix
        ELSE email_prefix || '@' || COALESCE(email_domain, 'gmail.com')
      END
      WHERE email IS NULL OR email = '';
    `);

    // Reload schema cache
    await client.query(`NOTIFY pgrst, 'reload schema';`);
    console.log('Migration completed: email column active without indexing!');
  } catch (err) {
    console.error('Migration error:', err);
  } finally {
    await client.end();
  }
}

migrate();
