const { Client } = require('pg');
const client = new Client({ connectionString: 'postgresql://postgres:Fortunetennisclub121@db.xdrsowoekbqalkonezcw.supabase.co:5432/postgres' });
async function run() {
  try {
    await client.connect();
    console.log("Connected to database. Dropping old constraint...");
    await client.query("ALTER TABLE public.matches DROP CONSTRAINT IF EXISTS matches_match_type_check;");
    console.log("Adding new constraint for ftc_17_agustus...");
    await client.query("ALTER TABLE public.matches ADD CONSTRAINT matches_match_type_check CHECK (match_type IN ('random_doubles', 'fixed_doubles', 'singles', 'ftc_17_agustus'));");
    console.log("Migration for ftc_17_agustus completed successfully!");
  } catch(e) {
    console.error("Migration failed:", e);
  } finally {
    await client.end();
  }
}
run();
