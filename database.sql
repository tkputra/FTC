-- Create Players table
CREATE TABLE IF NOT EXISTS public.players (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Create Fixed Pairs table
CREATE TABLE IF NOT EXISTS public.fixed_pairs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    player1_id UUID REFERENCES public.players(id) NOT NULL,
    player2_id UUID REFERENCES public.players(id) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(player1_id, player2_id)
);

-- Create Matches table
CREATE TABLE IF NOT EXISTS public.matches (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    match_type TEXT NOT NULL CHECK (match_type IN ('random_doubles', 'fixed_doubles', 'singles')),
    match_date DATE NOT NULL,
    status TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'completed')),
    team1_player1_id UUID REFERENCES public.players(id) NOT NULL,
    team1_player2_id UUID REFERENCES public.players(id), -- Null for singles
    team2_player1_id UUID REFERENCES public.players(id) NOT NULL,
    team2_player2_id UUID REFERENCES public.players(id), -- Null for singles
    winner_team INTEGER CHECK (winner_team IN (1, 2)), -- 1 for team1, 2 for team2
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Disable Row Level Security for all tables so anyone can read/write without auth
ALTER TABLE public.players DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.fixed_pairs DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.matches DISABLE ROW LEVEL SECURITY;
