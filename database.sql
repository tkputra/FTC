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

-- Court Auto-Booking Settings
CREATE TABLE IF NOT EXISTS public.court_booking_settings (
    id SERIAL PRIMARY KEY,
    email_prefix TEXT NOT NULL DEFAULT 'tri.kartika.putra',
    email_domain TEXT NOT NULL DEFAULT 'gmail.com',
    current_email_index INTEGER NOT NULL DEFAULT 2,
    first_name TEXT NOT NULL DEFAULT 'Tri',
    last_name TEXT NOT NULL DEFAULT 'Putra',
    address TEXT NOT NULL DEFAULT 'Fortune spring Blok D2 - J05',
    phone TEXT NOT NULL DEFAULT '08111819112',
    target_hours TEXT[] NOT NULL DEFAULT ARRAY['6:00am', '7:00am', '8:00am', '9:00am', '4:00pm', '5:00pm', '6:00pm'],
    target_days TEXT[] NOT NULL DEFAULT ARRAY['Mon', 'Tue', 'Wed', 'Thu', 'Senin', 'Selasa', 'Rabu', 'Kamis'],
    is_active BOOLEAN NOT NULL DEFAULT true,
    last_check_at TIMESTAMP WITH TIME ZONE,
    last_check_status TEXT DEFAULT 'idle',
    last_check_message TEXT DEFAULT 'Sistem siap',
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Initial Settings record
INSERT INTO public.court_booking_settings (
    id, email_prefix, email_domain, current_email_index, first_name, last_name, address, phone, is_active, last_check_message
)
VALUES (
    1, 'tri.kartika.putra', 'gmail.com', 2, 'Tri', 'Putra', 'Fortune spring Blok D2 - J05', '08111819112', true, 'Sistem auto-booking siap'
)
ON CONFLICT (id) DO NOTHING;

-- Booked Courts records
CREATE TABLE IF NOT EXISTS public.booked_courts (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    booking_date TEXT NOT NULL,
    booking_time TEXT NOT NULL,
    day_name TEXT,
    booked_email TEXT NOT NULL,
    first_name TEXT DEFAULT 'Tri',
    last_name TEXT DEFAULT 'Putra',
    phone TEXT DEFAULT '08111819112',
    status TEXT NOT NULL DEFAULT 'confirmed',
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.court_booking_settings DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.booked_courts DISABLE ROW LEVEL SECURITY;

