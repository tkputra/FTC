const { Client } = require('pg');
const client = new Client({ connectionString: 'postgresql://postgres:Fortunetennisclub121@db.xdrsowoekbqalkonezcw.supabase.co:5432/postgres' });

async function run() {
  try {
    await client.connect();
    console.log("Connected to Supabase. Truncating data and applying cascades...");

    // 1. Truncate all tables
    await client.query("TRUNCATE TABLE public.matches, public.ftc_17_agustus_teams, public.fixed_pairs, public.players CASCADE;");
    console.log("1. Database truncated successfully (all data cleared).");

    // 2. Modify fixed_pairs foreign keys
    await client.query("ALTER TABLE public.fixed_pairs DROP CONSTRAINT IF EXISTS fixed_pairs_player1_id_fkey;");
    await client.query("ALTER TABLE public.fixed_pairs DROP CONSTRAINT IF EXISTS fixed_pairs_player2_id_fkey;");
    await client.query("ALTER TABLE public.fixed_pairs ADD CONSTRAINT fixed_pairs_player1_id_fkey FOREIGN KEY (player1_id) REFERENCES public.players(id) ON DELETE CASCADE;");
    await client.query("ALTER TABLE public.fixed_pairs ADD CONSTRAINT fixed_pairs_player2_id_fkey FOREIGN KEY (player2_id) REFERENCES public.players(id) ON DELETE CASCADE;");
    console.log("2. Fixed pairs foreign keys set to ON DELETE CASCADE.");

    // 3. Modify matches foreign keys
    await client.query("ALTER TABLE public.matches DROP CONSTRAINT IF EXISTS matches_team1_player1_id_fkey;");
    await client.query("ALTER TABLE public.matches DROP CONSTRAINT IF EXISTS matches_team1_player2_id_fkey;");
    await client.query("ALTER TABLE public.matches DROP CONSTRAINT IF EXISTS matches_team2_player1_id_fkey;");
    await client.query("ALTER TABLE public.matches DROP CONSTRAINT IF EXISTS matches_team2_player2_id_fkey;");
    await client.query("ALTER TABLE public.matches ADD CONSTRAINT matches_team1_player1_id_fkey FOREIGN KEY (team1_player1_id) REFERENCES public.players(id) ON DELETE CASCADE;");
    await client.query("ALTER TABLE public.matches ADD CONSTRAINT matches_team1_player2_id_fkey FOREIGN KEY (team1_player2_id) REFERENCES public.players(id) ON DELETE CASCADE;");
    await client.query("ALTER TABLE public.matches ADD CONSTRAINT matches_team2_player1_id_fkey FOREIGN KEY (team2_player1_id) REFERENCES public.players(id) ON DELETE CASCADE;");
    await client.query("ALTER TABLE public.matches ADD CONSTRAINT matches_team2_player2_id_fkey FOREIGN KEY (team2_player2_id) REFERENCES public.players(id) ON DELETE CASCADE;");
    console.log("3. Matches foreign keys set to ON DELETE CASCADE.");

    console.log("Migration and database clearing finished successfully!");
  } catch (e) {
    console.error("Migration failed:", e);
  } finally {
    await client.end();
  }
}

run();
