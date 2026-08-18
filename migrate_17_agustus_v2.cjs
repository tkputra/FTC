const { Client } = require('pg');
const client = new Client({ connectionString: 'postgresql://postgres:Fortunetennisclub121@db.xdrsowoekbqalkonezcw.supabase.co:5432/postgres' });
async function run() {
  try {
    await client.connect();
    console.log("Connected to database. Modifying constraints...");
    
    // 1. Drop old constraint
    await client.query("ALTER TABLE public.matches DROP CONSTRAINT IF EXISTS matches_match_type_check;");
    
    // 2. Add new constraint including ftc_17_agustus
    await client.query("ALTER TABLE public.matches ADD CONSTRAINT matches_match_type_check CHECK (match_type IN ('random_doubles', 'fixed_doubles', 'singles', 'ftc_17_agustus'));");
    
    // 3. Add stage column
    await client.query("ALTER TABLE public.matches ADD COLUMN IF NOT EXISTS stage TEXT NOT NULL DEFAULT 'group';");
    
    // 4. Create ftc_17_agustus_teams table
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.ftc_17_agustus_teams (
          id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
          pair_id UUID REFERENCES public.fixed_pairs(id) ON DELETE CASCADE NOT NULL,
          group_name TEXT NOT NULL CHECK (group_name IN ('A', 'B')),
          created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
          UNIQUE(pair_id)
      );
    `);
    
    // 5. Disable RLS
    await client.query("ALTER TABLE public.ftc_17_agustus_teams DISABLE ROW LEVEL SECURITY;");
    
    console.log("Migration completed successfully!");
  } catch(e) {
    console.error("Migration failed:", e);
  } finally {
    await client.end();
  }
}
run();
