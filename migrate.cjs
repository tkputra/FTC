const { Client } = require('pg');
const client = new Client({ connectionString: 'postgresql://postgres:Fortunetennisclub121@db.xdrsowoekbqalkonezcw.supabase.co:5432/postgres' });
async function run() {
  try {
    await client.connect();
    await client.query("ALTER TABLE public.matches DROP CONSTRAINT IF EXISTS matches_status_check;");
    await client.query("ALTER TABLE public.matches ADD CONSTRAINT matches_status_check CHECK (status IN ('scheduled', 'ongoing', 'completed'));");
    console.log("Migration done");
  } catch(e) {
    console.error(e);
  } finally {
    await client.end();
  }
}
run();
