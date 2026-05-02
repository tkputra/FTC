import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Download } from 'lucide-react';

// Using the exact filename found in the directory
const images = [
  '/team-photo.jpg.jpeg'
];

type Player = { id: string; name: string }
type FixedPair = { id: string; player1_id: string; player2_id: string; created_at: string }
type Match = {
  id: string;
  match_type: string;
  status: 'scheduled' | 'ongoing' | 'completed';
  team1_player1_id: string;
  team1_player2_id?: string;
  team2_player1_id: string;
  team2_player2_id?: string;
  winner_team: 1 | 2 | null;
  created_at: string;
}

export default function Home() {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [activePreviewTab, setActivePreviewTab] = useState<'random_doubles' | 'fixed_doubles' | 'singles'>('random_doubles');
  
  const [players, setPlayers] = useState<Player[]>([]);
  const [pairs, setPairs] = useState<FixedPair[]>([]);
  const [allMatches, setAllMatches] = useState<Match[]>([]);
  
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);

  // PWA Install Prompt
  useEffect(() => {
    const handler = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstallClick = () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      deferredPrompt.userChoice.then(() => {
        setDeferredPrompt(null);
      });
    } else {
      // Fallback for iOS/Safari or if already installed/not ready
      alert(
        "Untuk menginstall aplikasi ini ke layar HP Anda:\n\n" +
        "🍏 Pengguna iPhone/Safari: Tekan tombol 'Share' (Bagikan) di bawah layar, lalu pilih 'Add to Home Screen' (Tambahkan ke Layar Utama).\n\n" +
        "🤖 Pengguna Android/Chrome: Buka menu titik tiga di pojok kanan atas, lalu pilih 'Install App' atau 'Tambahkan ke Layar Utama'."
      );
    }
  };

  // Fetch Data for Previews
  useEffect(() => {
    async function fetchPreviews() {
      const { data: pData } = await supabase.from('players').select('*')
      if (pData) setPlayers(pData)

      const { data: pairsData } = await supabase.from('fixed_pairs').select('*')
      if (pairsData) setPairs(pairsData)

      const { data: mData } = await supabase.from('matches').select('*')
      if (mData) setAllMatches(mData as Match[])
    }
    fetchPreviews();
  }, []);

  // Auto-advance carousel
  useEffect(() => {
    if (images.length <= 1) return;
    const timer = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % images.length);
    }, 4000);
    return () => clearInterval(timer);
  }, []);

  // Compute Upcoming Matches for active tab
  const upcomingMatches = allMatches
    .filter(m => m.match_type === activePreviewTab && (m.status === 'ongoing' || m.status === 'scheduled'))
    .sort((a, b) => {
      if (a.status === 'ongoing' && b.status !== 'ongoing') return -1;
      if (b.status === 'ongoing' && a.status !== 'ongoing') return 1;
      return new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    })
    .slice(0, 3);

  // Compute Leaderboard for active tab
  const getLeaderboard = () => {
    const completed = allMatches.filter(m => m.match_type === activePreviewTab && m.status === 'completed')
    const points = new Map<string, number>()

    if (activePreviewTab === 'fixed_doubles') {
      completed.forEach(m => {
        const getPairId = (id1: string, id2: string) => {
          const pair = pairs.find(p => (p.player1_id === id1 && p.player2_id === id2) || (p.player1_id === id2 && p.player2_id === id1))
          return pair?.id
        }
        if (m.winner_team === 1 && m.team1_player2_id) {
          const pid = getPairId(m.team1_player1_id, m.team1_player2_id);
          if (pid) points.set(pid, (points.get(pid) || 0) + 1)
        } else if (m.winner_team === 2 && m.team2_player2_id) {
          const pid = getPairId(m.team2_player1_id, m.team2_player2_id);
          if (pid) points.set(pid, (points.get(pid) || 0) + 1)
        }
      })
      return Array.from(points.entries())
        .map(([id, score]) => {
          const pair = pairs.find(p => p.id === id)
          const name = pair ? `${players.find(p=>p.id===pair.player1_id)?.name} & ${players.find(p=>p.id===pair.player2_id)?.name}` : 'Unknown'
          return { name, score }
        })
        .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name))
        .slice(0, 5)
    } else {
      // Individual logic (random_doubles or singles)
      completed.forEach(m => {
        if (m.winner_team === 1) {
          if (m.team1_player1_id) points.set(m.team1_player1_id, (points.get(m.team1_player1_id) || 0) + 1)
          if (m.team1_player2_id) points.set(m.team1_player2_id, (points.get(m.team1_player2_id) || 0) + 1)
        } else if (m.winner_team === 2) {
          if (m.team2_player1_id) points.set(m.team2_player1_id, (points.get(m.team2_player1_id) || 0) + 1)
          if (m.team2_player2_id) points.set(m.team2_player2_id, (points.get(m.team2_player2_id) || 0) + 1)
        }
      })
      return Array.from(points.entries())
        .map(([id, score]) => ({ name: players.find(p => p.id === id)?.name || 'Unknown', score }))
        .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name))
        .slice(0, 5)
    }
  }

  const leaderboard = getLeaderboard()
  const getPlayerName = (id?: string) => players.find(p => p.id === id)?.name || ''

  return (
    <div className="home-container mt-4 pb-12">
      {/* Header Section */}
      <div className="glass-panel text-center flex flex-col items-center justify-center p-8">
        <div style={{ padding: '1.5rem', background: 'rgba(255,255,255,0.05)', borderRadius: '50%', marginBottom: '1.5rem', border: '1px solid rgba(255,255,255,0.1)' }}>
          <img 
            src="/logo-ftc.png" 
            alt="Fortune Tennis Club Logo" 
            style={{ width: '220px', height: 'auto', dropShadow: '0 10px 15px rgba(0,0,0,0.5)' }} 
          />
        </div>
        <h2 style={{ marginBottom: '0.5rem', fontSize: '2.5rem', letterSpacing: '-0.025em', color: 'white' }}>Fortune Tennis Club</h2>
        <p style={{ color: 'var(--color-primary)', margin: 0, fontWeight: 600, fontStyle: 'italic', fontSize: '1.1rem', letterSpacing: '1px' }}>
          FUN. FORTUNE. FAULTS <span style={{color: 'var(--color-text-light)', fontWeight: 400}}>(OURS NOT YOURS)</span>
        </p>

        {/* PWA Install Button */}
        <button 
          onClick={handleInstallClick}
          className="btn mt-6"
          style={{ background: 'var(--color-secondary)', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
        >
          <Download size={18} />
          Install Aplikasi (PWA)
        </button>
      </div>

      {/* Carousel Section */}
      <div className="glass-panel" style={{ padding: '0', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        <div style={{ position: 'relative', width: '100%', height: '100%', minHeight: '350px', flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' }}>
          {images.map((src, idx) => (
            <img 
              key={src}
              src={src} 
              alt="Team Photo" 
              style={{
                position: 'absolute',
                top: 0, left: 0, width: '100%', height: '100%', objectFit: 'cover',
                opacity: idx === currentIndex ? 1 : 0,
                transition: 'opacity 0.8s ease-in-out'
              }}
            />
          ))}
          {images.length > 1 && (
            <div style={{ position: 'absolute', bottom: '1.5rem', left: 0, right: 0, display: 'flex', justifyContent: 'center', gap: '0.75rem' }}>
              {images.map((_, idx) => (
                <div 
                  key={idx}
                  style={{ 
                    width: '10px', height: '10px', borderRadius: '50%', 
                    backgroundColor: idx === currentIndex ? 'var(--color-primary)' : 'rgba(255,255,255,0.5)',
                    transition: 'all 0.3s ease', cursor: 'pointer', boxShadow: '0 2px 4px rgba(0,0,0,0.5)'
                  }} 
                  onClick={() => setCurrentIndex(idx)}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Previews Section */}
      <div style={{ gridColumn: '1 / -1' }}>
        <div className="flex bg-[rgba(255,255,255,0.1)] p-1 rounded-[var(--radius-md)] border border-[rgba(255,255,255,0.1)] mb-4 overflow-x-auto">
          <button 
            onClick={() => setActivePreviewTab('random_doubles')}
            style={{ flex: 1, minWidth: '100px', padding: '0.75rem', borderRadius: 'calc(var(--radius-md) - 4px)', border: 'none', 
              background: activePreviewTab === 'random_doubles' ? 'var(--color-primary)' : 'transparent',
              color: activePreviewTab === 'random_doubles' ? 'white' : 'var(--color-text-light)',
              fontWeight: activePreviewTab === 'random_doubles' ? 600 : 400, cursor: 'pointer', transition: 'all 0.2s'
            }}
          >
            Ganda Acak
          </button>
          <button 
            onClick={() => setActivePreviewTab('fixed_doubles')}
            style={{ flex: 1, minWidth: '100px', padding: '0.75rem', borderRadius: 'calc(var(--radius-md) - 4px)', border: 'none', 
              background: activePreviewTab === 'fixed_doubles' ? 'var(--color-primary)' : 'transparent',
              color: activePreviewTab === 'fixed_doubles' ? 'white' : 'var(--color-text-light)',
              fontWeight: activePreviewTab === 'fixed_doubles' ? 600 : 400, cursor: 'pointer', transition: 'all 0.2s'
            }}
          >
            Ganda Tetap
          </button>
          <button 
            onClick={() => setActivePreviewTab('singles')}
            style={{ flex: 1, minWidth: '100px', padding: '0.75rem', borderRadius: 'calc(var(--radius-md) - 4px)', border: 'none', 
              background: activePreviewTab === 'singles' ? 'var(--color-primary)' : 'transparent',
              color: activePreviewTab === 'singles' ? 'white' : 'var(--color-text-light)',
              fontWeight: activePreviewTab === 'singles' ? 600 : 400, cursor: 'pointer', transition: 'all 0.2s'
            }}
          >
            Tunggal
          </button>
        </div>

        <div className="previews-grid">
          {/* Jadwal Preview */}
          <div className="glass-panel p-4 flex flex-col gap-2">
            <h3 style={{ color: 'white', margin: 0, fontSize: '1.25rem', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '0.5rem' }}>
              Jadwal Terdekat
            </h3>
            {upcomingMatches.length === 0 ? (
              <div style={{ color: 'var(--color-text-light)', fontSize: '0.9rem', padding: '1rem 0', textAlign: 'center' }}>
                Belum ada antrean jadwal.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginTop: '0.5rem' }}>
                {upcomingMatches.map((m, idx) => {
                  const isOngoing = m.status === 'ongoing'
                  return (
                    <div key={m.id} style={{ 
                      background: isOngoing ? 'rgba(52, 211, 153, 0.15)' : 'rgba(255,255,255,0.05)', 
                      padding: '0.75rem', borderRadius: 'var(--radius-sm)', 
                      border: `1px solid ${isOngoing ? 'var(--color-secondary)' : 'rgba(255,255,255,0.1)'}`,
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                    }}>
                      <div style={{ flex: 1, textAlign: 'right', fontSize: '0.85rem', color: 'white' }}>
                        {getPlayerName(m.team1_player1_id)}<br/>
                        {m.team1_player2_id && getPlayerName(m.team1_player2_id)}
                      </div>
                      <div style={{ padding: '0 0.5rem', color: isOngoing ? 'var(--color-secondary)' : 'var(--color-text-light)', fontSize: '0.7rem', fontWeight: 700, textAlign: 'center' }}>
                        {isOngoing ? 'MAIN' : 'VS'}
                      </div>
                      <div style={{ flex: 1, textAlign: 'left', fontSize: '0.85rem', color: 'white' }}>
                        {getPlayerName(m.team2_player1_id)}<br/>
                        {m.team2_player2_id && getPlayerName(m.team2_player2_id)}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Klasemen Preview */}
          <div className="glass-panel p-4 flex flex-col gap-2">
            <h3 style={{ color: 'var(--color-primary)', margin: 0, fontSize: '1.25rem', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '0.5rem' }}>
              Top 5 Klasemen
            </h3>
            {leaderboard.length === 0 ? (
              <div style={{ color: 'var(--color-text-light)', fontSize: '0.9rem', padding: '1rem 0', textAlign: 'center' }}>
                Belum ada data klasemen.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '0.5rem' }}>
                {leaderboard.map((item, idx) => (
                  <div key={item.name} style={{ 
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    padding: '0.75rem', background: 'rgba(255,255,255,0.05)', 
                    borderRadius: 'var(--radius-sm)', border: '1px solid rgba(255,255,255,0.05)'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      <span style={{ fontWeight: 700, color: idx === 0 ? 'var(--color-secondary)' : 'var(--color-text-light)', width: '20px' }}>
                        #{idx + 1}
                      </span>
                      <span style={{ color: 'white', fontWeight: idx === 0 ? 600 : 400 }}>{item.name}</span>
                    </div>
                    <span style={{ fontWeight: 700, color: 'var(--color-secondary)' }}>{item.score} pts</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <style>{`
        .home-container {
          display: flex;
          flex-direction: column;
          gap: 1.5rem;
        }
        .previews-grid {
          display: grid;
          grid-template-columns: 1fr;
          gap: 1.5rem;
        }
        @media (min-width: 768px) {
          .home-container {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 2rem;
            align-items: stretch;
            grid-template-rows: auto auto auto;
          }
          .glass-panel:nth-child(1) { grid-column: 1; }
          .glass-panel:nth-child(2) { grid-column: 2; }
          .previews-grid {
            grid-column: 1 / -1;
            grid-template-columns: 1fr 1fr;
          }
        }
        .text-center { text-align: center; }
        .p-8 { padding: 2rem; }
        .p-4 { padding: 1.5rem; }
      `}</style>
    </div>
  )
}
