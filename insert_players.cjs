const { Client } = require('pg');
const client = new Client({ connectionString: 'postgresql://postgres:Fortunetennisclub121@db.xdrsowoekbqalkonezcw.supabase.co:5432/postgres' });

const players = [
  "Adit TW",
  "Yudi - Breeze",
  "Dias",
  "Ryan",
  "Tri Spring",
  "Yopi FH",
  "Santos",
  "Suprapto",
  "Nanda",
  "Febri",
  "Rizky",
  "Alfi",
  "riky",
  "nico",
  "Bagoes",
  "Yuda height",
  "Cornel",
  "Nuswardi"
];

async function run() {
  try {
    await client.connect();
    console.log("Inserting 18 players into players table...");
    for (const name of players) {
      await client.query("INSERT INTO public.players (name) VALUES ($1) ON CONFLICT (name) DO NOTHING;", [name]);
    }
    console.log("All 18 players inserted successfully!");
  } catch(e) {
    console.error("Failed to insert players:", e);
  } finally {
    await client.end();
  }
}

run();
