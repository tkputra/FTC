import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Users, Calendar, Trophy, Shuffle, Check, X } from 'lucide-react';

type Player = { id: string; name: string }
type Match = {
  id: string;
  match_date: string;
  status: 'scheduled' | 'ongoing' | 'completed';
  team1_player1_id: string;
  team2_player1_id: string;
  winner_team: 1 | 2 | null;
  team1_score?: number;
  team2_score?: number;
  created_at: string;
}

export default function Singles() {
  const [activeTab, setActiveTab] = useState<'jadwal' | 'klasemen'>('jadwal')
  const [date, setDate] = useState(new Date().toISOString().split('T')[0])
  const [allPlayers, setAllPlayers] = useState<Player[]>([])
  const [presentPlayerIds, setPresentPlayerIds] = useState<Set<string>>(new Set())
  const [matches, setMatches] = useState<Match[]>([])
  const [scoresInput, setScoresInput] = useState<Record<string, { s1: string, s2: string }>>({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchData()
  }, [])

  async function fetchData() {
    setLoading(true)
    const { data: playersData } = await supabase.from('players').select('*').order('name')
    if (playersData) {
      setAllPlayers(playersData)
      // By default, assume no one is present initially
      setPresentPlayerIds(new Set())
    }

    // Fetch ALL singles matches to handle history and carry-overs
    const { data: matchesData } = await supabase
      .from('matches')
      .select('*')
      .eq('match_type', 'singles')
    
    if (matchesData) {
      // Sort deterministically to prevent UI jumping when status updates
      matchesData.sort((a, b) => {
        const timeDiff = new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        if (timeDiff !== 0) return timeDiff
        return a.id.localeCompare(b.id)
      })
      setMatches(matchesData as Match[])
    }

    setLoading(false)
  }

  async function setOngoing(matchId: string) {
    const { error } = await supabase.from('matches').update({ status: 'ongoing' }).eq('id', matchId)
    if (error) alert('Gagal update status: ' + error.message)
    else fetchData()
  }

  async function completeMatch(matchId: string) {
    const s1 = parseInt(scoresInput[matchId]?.s1 || '0')
    const s2 = parseInt(scoresInput[matchId]?.s2 || '0')
    
    if (isNaN(s1) || isNaN(s2)) {
      alert('Mohon masukkan skor yang valid (angka).')
      return
    }
    if (s1 === s2) {
      alert('Pertandingan tidak boleh seri. Harus ada pemenang.')
      return
    }

    const winnerTeam = s1 > s2 ? 1 : 2;
    const { error } = await supabase.from('matches').update({ 
      status: 'completed',
      team1_score: s1,
      team2_score: s2,
      winner_team: winnerTeam
    }).eq('id', matchId)
    
    if (error) alert('Gagal menyimpan hasil: ' + error.message)
    else fetchData()
  }

  function togglePlayerPresence(id: string) {
    const newSet = new Set(presentPlayerIds)
    if (newSet.has(id)) newSet.delete(id)
    else newSet.add(id)
    setPresentPlayerIds(newSet)
  }

  // Generate 2 player combinations (1v1)
  function getCombinations(arr: Player[]): Player[][] {
    const results = []
    for (let i = 0; i < arr.length; i++) {
      for (let j = i + 1; j < arr.length; j++) {
        results.push([arr[i], arr[j]])
      }
    }
    return results
  }

  async function generateMatches() {
    if (presentPlayerIds.size < 2) {
      alert('Minimal 2 pemain harus hadir untuk mulai mengacak.')
      return
    }

    // 1. Ambil semua data pertandingan singles
    const { data: allMatchesData } = await supabase.from('matches').select('*').eq('match_type', 'singles')
    const matchesArray = allMatchesData || []
    
    // Hapus HANYA jadwal 'scheduled' (yang belum main) agar bisa di-re-roll dengan orang baru
    const scheduledMatches = matchesArray.filter(m => m.status === 'scheduled')
    if (scheduledMatches.length > 0) {
      await supabase.from('matches').delete().in('id', scheduledMatches.map(m => m.id))
    }

    const presentPlayers = allPlayers.filter(p => presentPlayerIds.has(p.id))

    // Hitung kuota main hari ini (berdasarkan match yang sedang ongoing ATAU completed hari ini)
    const playCount = new Map<string, number>()
    presentPlayers.forEach(p => playCount.set(p.id, 0))
    
    const activeToday = matchesArray.filter(m => m.status === 'ongoing' || (m.status === 'completed' && m.match_date === date))
    activeToday.forEach(m => {
      [m.team1_player1_id, m.team2_player1_id].forEach(id => {
        if (id && playCount.has(id)) {
          playCount.set(id, playCount.get(id)! + 1)
        }
      })
    })

    // Rekap histori lawan agar tidak bosan bertemu orang yang sama
    const opponentHistory = new Map<string, number>()
    matchesArray.forEach(m => {
      if (m.status === 'scheduled') return; // abaikan yang dihapus
      const k = [m.team1_player1_id, m.team2_player1_id].sort().join('-')
      opponentHistory.set(k, (opponentHistory.get(k) || 0) + 1)
    })

    const newMatches = []
    const TARGET_MATCHES = 10; // Generate up to 10 matches ke depan

    // Algoritma Generator (Mencari Match Paling Optimal)
    for (let round = 0; round < TARGET_MATCHES; round++) {
      const perms = getCombinations(presentPlayers)
      let bestPerm = null
      let bestScore = Infinity

      for (const perm of perms) {
        // perm is an array of 2 players
        const p1 = perm[0].id
        const p2 = perm[1].id
        
        // Cek kuota main
        const c1 = playCount.get(p1) || 0
        const c2 = playCount.get(p2) || 0
        const playScore = c1 + c2
        const maxPlayCount = Math.max(c1, c2)
        const minPlayCount = Math.min(c1, c2)
        
        // Pinalti jika kesenjangan jumlah main besar
        const gapPenalty = (maxPlayCount - minPlayCount) * 10
        
        // Pinalti jika lawan sudah pernah bertemu
        const k = [p1, p2].sort().join('-')
        const oppPenalty = (opponentHistory.get(k) || 0) * 15

        const totalScore = (playScore * 20) + gapPenalty + oppPenalty

        if (totalScore < bestScore) {
          bestScore = totalScore
          bestPerm = perm
        }
      }

      if (bestPerm) {
        newMatches.push({
          match_type: 'singles',
          match_date: date,
          status: 'scheduled',
          team1_player1_id: bestPerm[0].id,
          team1_player2_id: null,
          team2_player1_id: bestPerm[1].id,
          team2_player2_id: null
        })

        // Update simulasi stat untuk round berikutnya
        const p1 = bestPerm[0].id
        const p2 = bestPerm[1].id
        playCount.set(p1, (playCount.get(p1) || 0) + 1)
        playCount.set(p2, (playCount.get(p2) || 0) + 1)
        
        const k = [p1, p2].sort().join('-')
        opponentHistory.set(k, (opponentHistory.get(k) || 0) + 1)
      } else {
        break; // Tdk bisa dapat perm (should never happen if >=2 present)
      }
    }

    if (newMatches.length > 0) {
      const { error } = await supabase.from('matches').insert(newMatches)
      if (error) alert('Gagal menyimpan jadwal: ' + error.message)
      else fetchData()
    }
  }

  function getPlayerName(id: string) {
    if (!id) return ''
    return allPlayers.find(p => p.id === id)?.name || 'Unknown'
  }

  // Tampilkan Jadwal: Semua yang scheduled/ongoing (carry-over), ditambah yang completed pada tanggal yang dipilih
  const displayMatches = matches.filter(m => m.status === 'scheduled' || m.status === 'ongoing' || (m.status === 'completed' && m.match_date === date))

  return (
    <div className="flex flex-col gap-6 mt-4 pb-12">
      {/* Sub-Tabs */}
      <div className="flex bg-[rgba(255,255,255,0.1)] p-1 rounded-[var(--radius-md)] border border-[rgba(255,255,255,0.1)]">
        <button 
          onClick={() => setActiveTab('jadwal')}
          style={{ flex: 1, padding: '0.75rem', borderRadius: 'calc(var(--radius-md) - 4px)', border: 'none', 
            background: activeTab === 'jadwal' ? 'var(--color-primary)' : 'transparent',
            color: activeTab === 'jadwal' ? 'white' : 'var(--color-text-light)',
            fontWeight: activeTab === 'jadwal' ? 600 : 400,
            cursor: 'pointer', transition: 'all 0.2s'
          }}
        >
          <Calendar size={18} style={{ display: 'inline', marginRight: '8px', verticalAlign: 'text-bottom' }} />
          Jadwal Antrean
        </button>
        <button 
          onClick={() => setActiveTab('klasemen')}
          style={{ flex: 1, padding: '0.75rem', borderRadius: 'calc(var(--radius-md) - 4px)', border: 'none', 
            background: activeTab === 'klasemen' ? 'var(--color-primary)' : 'transparent',
            color: activeTab === 'klasemen' ? 'white' : 'var(--color-text-light)',
            fontWeight: activeTab === 'klasemen' ? 600 : 400,
            cursor: 'pointer', transition: 'all 0.2s'
          }}
        >
          <Trophy size={18} style={{ display: 'inline', marginRight: '8px', verticalAlign: 'text-bottom' }} />
          Klasemen Hari Ini
        </button>
      </div>

      <div className="glass-panel">
        <h2 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'white' }}>
          <Shuffle size={24} color="var(--color-secondary)" />
          Tunggal (Singles)
        </h2>

        {activeTab === 'jadwal' && (
          <div className="flex flex-col gap-6 mt-4">
            {/* Date Selector */}
            <div>
              <label style={{ display: 'block', color: 'var(--color-text-light)', marginBottom: '0.5rem' }}>Tanggal:</label>
              <input 
                type="date" 
                className="input-field" 
                value={date} 
                onChange={(e) => setDate(e.target.value)}
                style={{ background: 'rgba(255,255,255,0.9)', color: '#0f172a' }}
              />
            </div>

            {loading ? (
              <p style={{ color: 'white' }}>Memuat data...</p>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '2rem' }}>
                
                {/* Left Col: Attendance */}
                <div>
                  <h3 style={{ color: 'var(--color-secondary)', fontSize: '1.1rem', marginBottom: '1rem' }}>
                    <Users size={18} style={{ display: 'inline', marginRight: '8px' }} />
                    Kehadiran ({presentPlayerIds.size}/{allPlayers.length})
                  </h3>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '0.5rem' }}>
                    {allPlayers.map(p => {
                      const isPresent = presentPlayerIds.has(p.id)
                      return (
                        <div 
                          key={p.id}
                          onClick={() => togglePlayerPresence(p.id)}
                          style={{
                            padding: '0.75rem', borderRadius: 'var(--radius-sm)', cursor: 'pointer',
                            background: isPresent ? 'rgba(52, 211, 153, 0.2)' : 'rgba(255,255,255,0.05)',
                            border: `1px solid ${isPresent ? 'var(--color-secondary)' : 'rgba(255,255,255,0.1)'}`,
                            color: isPresent ? 'white' : 'var(--color-text-light)',
                            display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                          }}
                        >
                          <span style={{ fontSize: '0.9rem', fontWeight: isPresent ? 600 : 400 }}>{p.name}</span>
                          {isPresent ? <Check size={16} color="var(--color-secondary)" /> : <X size={16} />}
                        </div>
                      )
                    })}
                  </div>
                  
                  <button onClick={generateMatches} className="btn mt-4" style={{ width: '100%', background: 'var(--color-secondary)', color: '#0f172a' }}>
                    <Shuffle size={18} /> Acak Ulang Sisa Jadwal (10 Match)
                  </button>
                  <p style={{ fontSize: '0.8rem', color: 'var(--color-text-light)', marginTop: '0.5rem', textAlign: 'center' }}>
                    *Hanya akan merombak jadwal yang belum dimainkan (Scheduled).
                  </p>
                </div>

                {/* Right Col: Matches */}
                <div>
                  <h3 style={{ color: 'white', fontSize: '1.1rem', marginBottom: '1rem' }}>Antrean Match</h3>
                  {displayMatches.length === 0 ? (
                    <p style={{ color: 'var(--color-text-light)', fontStyle: 'italic' }}>Belum ada antrean jadwal.</p>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                      {displayMatches.map((m, idx) => {
                        const isScheduled = m.status === 'scheduled';
                        const isOngoing = m.status === 'ongoing';
                        const isCompleted = m.status === 'completed';
                        
                        return (
                          <div key={m.id} style={{ 
                            background: isOngoing ? 'rgba(52, 211, 153, 0.15)' : 'rgba(255,255,255,0.05)', 
                            padding: '1rem', borderRadius: 'var(--radius-md)', 
                            border: `1px solid ${isOngoing ? 'var(--color-secondary)' : 'rgba(255,255,255,0.1)'}` 
                          }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                              <div style={{ fontSize: '0.8rem', color: isCompleted ? 'gray' : 'var(--color-secondary)', fontWeight: 600 }}>
                                MATCH {idx + 1}
                              </div>
                              <div style={{ fontSize: '0.8rem', fontWeight: 600, color: isOngoing ? 'var(--color-secondary)' : isCompleted ? 'gray' : 'white', background: isOngoing ? 'rgba(52, 211, 153, 0.2)' : 'transparent', padding: '2px 8px', borderRadius: '12px' }}>
                                {isScheduled ? 'Menunggu' : isOngoing ? 'SEDANG MAIN' : 'Selesai'}
                              </div>
                            </div>
                            
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: isCompleted ? 'gray' : 'white' }}>
                              <div style={{ flex: 1, textAlign: 'right', fontWeight: m.winner_team === 1 ? 700 : 400, color: m.winner_team === 1 ? 'var(--color-secondary)' : 'inherit', fontSize: '1.1rem' }}>
                                {getPlayerName(m.team1_player1_id)}
                              </div>
                              <div style={{ padding: '0 1rem', color: 'var(--color-text-light)', fontSize: '0.9rem', textAlign: 'center' }}>
                                {isCompleted ? (
                                  <span style={{ fontSize: '1.2rem', fontWeight: 700, color: 'white' }}>{m.team1_score} - {m.team2_score}</span>
                                ) : 'VS'}
                              </div>
                              <div style={{ flex: 1, textAlign: 'left', fontWeight: m.winner_team === 2 ? 700 : 400, color: m.winner_team === 2 ? 'var(--color-secondary)' : 'inherit', fontSize: '1.1rem' }}>
                                {getPlayerName(m.team2_player1_id)}
                              </div>
                            </div>

                            {/* Actions */}
                            {isScheduled && (
                              <button 
                                onClick={() => setOngoing(m.id)}
                                className="btn mt-3" style={{ width: '100%', padding: '0.5rem', fontSize: '0.9rem', background: 'white', color: '#0f172a' }}
                              >
                                Mulai Main di Lapangan
                              </button>
                            )}

                            {isOngoing && (
                              <div className="mt-3 flex flex-col gap-2 border-t border-[rgba(255,255,255,0.1)] pt-3">
                                <span style={{ fontSize: '0.8rem', color: 'white', textAlign: 'center' }}>Masukkan Skor Akhir:</span>
                                <div className="flex gap-2 items-center justify-center">
                                  <input 
                                    type="number" 
                                    placeholder="0"
                                    value={scoresInput[m.id]?.s1 || ''}
                                    onChange={(e) => setScoresInput(prev => ({ ...prev, [m.id]: { ...prev[m.id], s1: e.target.value } }))}
                                    style={{ width: '60px', padding: '0.5rem', textAlign: 'center', borderRadius: '4px', border: 'none' }}
                                  />
                                  <span style={{ color: 'white' }}>-</span>
                                  <input 
                                    type="number" 
                                    placeholder="0"
                                    value={scoresInput[m.id]?.s2 || ''}
                                    onChange={(e) => setScoresInput(prev => ({ ...prev, [m.id]: { ...prev[m.id], s2: e.target.value } }))}
                                    style={{ width: '60px', padding: '0.5rem', textAlign: 'center', borderRadius: '4px', border: 'none' }}
                                  />
                                  <button onClick={() => completeMatch(m.id)} className="btn" style={{ padding: '0.5rem 1rem', fontSize: '0.85rem', marginLeft: '0.5rem' }}>
                                    Simpan
                                  </button>
                                </div>
                              </div>
                            )}

                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>

              </div>
            )}
          </div>
        )}

        {activeTab === 'klasemen' && (
          <div className="flex flex-col gap-6 mt-4">
            <div style={{ textAlign: 'center', marginBottom: '1rem' }}>
              <h3 style={{ color: 'white', fontSize: '1.2rem', margin: 0 }}>Klasemen Tunggal Hari Ini</h3>
              <p style={{ color: 'var(--color-text-light)', fontSize: '0.9rem', margin: '0.25rem 0 0 0' }}>
                Total poin dihitung dari pertandingan yang berstatus Selesai pada tanggal {date}.
              </p>
            </div>
            
            {(() => {
              // Hitung poin
              const points = new Map<string, number>()
              const completedToday = matches.filter(m => m.status === 'completed' && m.match_date === date)
              
              completedToday.forEach(m => {
                if (m.winner_team === 1) {
                  points.set(m.team1_player1_id, (points.get(m.team1_player1_id) || 0) + 1)
                } else if (m.winner_team === 2) {
                  points.set(m.team2_player1_id, (points.get(m.team2_player1_id) || 0) + 1)
                }
              })
              
              // Jika belum ada match selesai
              if (completedToday.length === 0) {
                return (
                  <div style={{ textAlign: 'center', padding: '2rem', background: 'rgba(255,255,255,0.05)', borderRadius: 'var(--radius-md)' }}>
                    <p style={{ color: 'var(--color-text-light)' }}>Belum ada pertandingan yang selesai hari ini.</p>
                  </div>
                )
              }

              // Konversi ke array dan sort
              const leaderboard = Array.from(points.entries())
                .map(([id, score]) => ({ id, name: getPlayerName(id), score }))
                .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name))

              return (
                <div style={{ background: 'rgba(255,255,255,0.05)', borderRadius: 'var(--radius-md)', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.1)' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', color: 'white' }}>
                    <thead>
                      <tr style={{ background: 'rgba(0,0,0,0.2)' }}>
                        <th style={{ padding: '1rem', borderBottom: '1px solid rgba(255,255,255,0.1)', width: '60px', textAlign: 'center' }}>Rank</th>
                        <th style={{ padding: '1rem', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>Pemain</th>
                        <th style={{ padding: '1rem', borderBottom: '1px solid rgba(255,255,255,0.1)', width: '100px', textAlign: 'center' }}>Poin Menang</th>
                      </tr>
                    </thead>
                    <tbody>
                      {leaderboard.map((item, index) => (
                        <tr key={item.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                          <td style={{ padding: '1rem', textAlign: 'center', fontWeight: 600, color: index === 0 ? 'var(--color-secondary)' : 'var(--color-text-light)' }}>
                            #{index + 1}
                          </td>
                          <td style={{ padding: '1rem', fontWeight: index === 0 ? 700 : 400 }}>{item.name}</td>
                          <td style={{ padding: '1rem', textAlign: 'center', fontWeight: 700, color: 'var(--color-secondary)' }}>{item.score}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )
            })()}
          </div>
        )}
      </div>
      <style>{`
         @media (min-width: 768px) {
           /* Desktop specific layout if needed */
         }
      `}</style>
    </div>
  )
}
