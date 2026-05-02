const { Client } = require('pg');
const client = new Client({ connectionString: 'postgresql://postgres:Fortunetennisclub121@db.xdrsowoekbqalkonezcw.supabase.co:5432/postgres' });
async function run() {
  try {
    await client.connect();
    await client.query("ALTER TABLE public.matches ADD COLUMN IF NOT EXISTS team1_score INTEGER;");
    await client.query("ALTER TABLE public.matches ADD COLUMN IF NOT EXISTS team2_score INTEGER;");
    console.log("Migration score done");
  } catch(e) {
    console.error(e);
  } finally {
    await client.end();
  }
}
run();
