import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Users, Calendar, Trophy, Shuffle, Check, X, Trash2, Plus } from 'lucide-react';

type Player = { id: string; name: string }
type FixedPair = { id: string; player1_id: string; player2_id: string; created_at: string }

type Match = {
  id: string;
  match_date: string;
  status: 'scheduled' | 'ongoing' | 'completed';
  team1_player1_id: string;
  team1_player2_id: string;
  team2_player1_id: string;
  team2_player2_id: string;
  winner_team: 1 | 2 | null;
  team1_score?: number;
  team2_score?: number;
  created_at: string;
}

export default function FixedDoubles() {
  const [activeTab, setActiveTab] = useState<'tim' | 'jadwal' | 'klasemen'>('tim')
  const [date, setDate] = useState(new Date().toISOString().split('T')[0])
  const [allPlayers, setAllPlayers] = useState<Player[]>([])
  const [pairs, setPairs] = useState<FixedPair[]>([])
  
  const [presentPairIds, setPresentPairIds] = useState<Set<string>>(new Set())
  const [matches, setMatches] = useState<Match[]>([])
  const [scoresInput, setScoresInput] = useState<Record<string, { s1: string, s2: string }>>({})
  const [loading, setLoading] = useState(true)

  // Add Pair Form
  const [p1, setP1] = useState('')
  const [p2, setP2] = useState('')

  useEffect(() => {
    fetchData()
  }, [])

  async function fetchData() {
    setLoading(true)
    const { data: playersData } = await supabase.from('players').select('*').order('name')
    if (playersData) setAllPlayers(playersData)

    const { data: pairsData } = await supabase.from('fixed_pairs').select('*').order('created_at')
    if (pairsData) setPairs(pairsData)

    // Fetch ALL matches
    const { data: matchesData } = await supabase
      .from('matches')
      .select('*')
      .eq('match_type', 'fixed_doubles')
    
    if (matchesData) {
      matchesData.sort((a, b) => {
        const timeDiff = new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        if (timeDiff !== 0) return timeDiff
        return a.id.localeCompare(b.id)
      })
      setMatches(matchesData as Match[])
    }

    setLoading(false)
  }

  // --- TAB: MANAJEMEN TIM ---
  async function addPair(e: React.FormEvent) {
    e.preventDefault()
    if (!p1 || !p2) {
      alert('Pilih 2 pemain untuk membuat tim.')
      return
    }
    if (p1 === p2) {
      alert('Pemain 1 dan Pemain 2 tidak boleh orang yang sama.')
      return
    }
    
    // Pastikan tidak ada duplikat (A-B sama dengan B-A)
    const exists = pairs.find(p => 
      (p.player1_id === p1 && p.player2_id === p2) || 
      (p.player1_id === p2 && p.player2_id === p1)
    )
    if (exists) {
      alert('Tim ini sudah ada!')
      return
    }

    const { error } = await supabase.from('fixed_pairs').insert([{ player1_id: p1, player2_id: p2 }])
    if (error) {
      alert('Gagal menambah tim: ' + error.message)
    } else {
      setP1('')
      setP2('')
      fetchData()
    }
  }

  async function deletePair(id: string) {
    if (!window.confirm('Hapus tim ini?')) return
    const { error } = await supabase.from('fixed_pairs').delete().eq('id', id)
    if (error) alert('Gagal menghapus: ' + error.message)
    else fetchData()
  }

  function getPlayerName(id: string) {
    if (!id) return ''
    return allPlayers.find(p => p.id === id)?.name || 'Unknown'
  }

  function getPairName(pair: FixedPair) {
    return `${getPlayerName(pair.player1_id)} & ${getPlayerName(pair.player2_id)}`
  }

  function getPairByPlayerIds(id1: string, id2: string) {
    return pairs.find(p => 
      (p.player1_id === id1 && p.player2_id === id2) || 
      (p.player1_id === id2 && p.player2_id === id1)
    )
  }

  // --- TAB: JADWAL ---
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

  function togglePairPresence(id: string) {
    const newSet = new Set(presentPairIds)
    if (newSet.has(id)) newSet.delete(id)
    else newSet.add(id)
    setPresentPairIds(newSet)
  }

  function getCombinations(arr: FixedPair[]): FixedPair[][] {
    const results = []
    for (let i = 0; i < arr.length; i++) {
      for (let j = i + 1; j < arr.length; j++) {
        results.push([arr[i], arr[j]])
      }
    }
    return results
  }

  async function generateMatches() {
    if (presentPairIds.size < 2) {
      alert('Minimal 2 tim harus hadir untuk mulai mengacak jadwal.')
      return
    }

    const { data: allMatchesData } = await supabase.from('matches').select('*').eq('match_type', 'fixed_doubles')
    const matchesArray = allMatchesData || []
    
    const scheduledMatches = matchesArray.filter(m => m.status === 'scheduled')
    if (scheduledMatches.length > 0) {
      await supabase.from('matches').delete().in('id', scheduledMatches.map(m => m.id))
    }

    const presentPairs = pairs.filter(p => presentPairIds.has(p.id))

    // Hitung kuota main hari ini
    const playCount = new Map<string, number>()
    presentPairs.forEach(p => playCount.set(p.id, 0))
    
    const activeToday = matchesArray.filter(m => m.status === 'ongoing' || (m.status === 'completed' && m.match_date === date))
    activeToday.forEach(m => {
      const pair1 = getPairByPlayerIds(m.team1_player1_id, m.team1_player2_id)
      const pair2 = getPairByPlayerIds(m.team2_player1_id, m.team2_player2_id)
      
      if (pair1 && playCount.has(pair1.id)) playCount.set(pair1.id, playCount.get(pair1.id)! + 1)
      if (pair2 && playCount.has(pair2.id)) playCount.set(pair2.id, playCount.get(pair2.id)! + 1)
    })

    // Rekap histori lawan agar tidak bosan bertemu tim yang sama
    const opponentHistory = new Map<string, number>()
    matchesArray.forEach(m => {
      if (m.status === 'scheduled') return; 
      const pair1 = getPairByPlayerIds(m.team1_player1_id, m.team1_player2_id)
      const pair2 = getPairByPlayerIds(m.team2_player1_id, m.team2_player2_id)
      if (pair1 && pair2) {
        const k = [pair1.id, pair2.id].sort().join('-')
        opponentHistory.set(k, (opponentHistory.get(k) || 0) + 1)
      }
    })

    const newMatches = []
    const TARGET_MATCHES = 10;

    for (let round = 0; round < TARGET_MATCHES; round++) {
      const perms = getCombinations(presentPairs)
      let bestPerm = null
      let bestScore = Infinity

      for (const perm of perms) {
        const p1 = perm[0].id
        const p2 = perm[1].id
        
        const c1 = playCount.get(p1) || 0
        const c2 = playCount.get(p2) || 0
        const playScore = c1 + c2
        const maxPlayCount = Math.max(c1, c2)
        const minPlayCount = Math.min(c1, c2)
        
        const gapPenalty = (maxPlayCount - minPlayCount) * 10
        
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
          match_type: 'fixed_doubles',
          match_date: date,
          status: 'scheduled',
          team1_player1_id: bestPerm[0].player1_id,
          team1_player2_id: bestPerm[0].player2_id,
          team2_player1_id: bestPerm[1].player1_id,
          team2_player2_id: bestPerm[1].player2_id
        })

        const p1 = bestPerm[0].id
        const p2 = bestPerm[1].id
        playCount.set(p1, (playCount.get(p1) || 0) + 1)
        playCount.set(p2, (playCount.get(p2) || 0) + 1)
        
        const k = [p1, p2].sort().join('-')
        opponentHistory.set(k, (opponentHistory.get(k) || 0) + 1)
      } else {
        break;
      }
    }

    if (newMatches.length > 0) {
      const { error } = await supabase.from('matches').insert(newMatches)
      if (error) alert('Gagal menyimpan jadwal: ' + error.message)
      else fetchData()
    }
  }

  const displayMatches = matches.filter(m => m.status === 'scheduled' || m.status === 'ongoing' || (m.status === 'completed' && m.match_date === date))

  return (
    <div className="flex flex-col gap-6 mt-4 pb-12">
      {/* Sub-Tabs */}
      <div className="flex bg-[rgba(255,255,255,0.1)] p-1 rounded-[var(--radius-md)] border border-[rgba(255,255,255,0.1)] overflow-x-auto">
        <button 
          onClick={() => setActiveTab('tim')}
          style={{ flex: 1, minWidth: '120px', padding: '0.75rem', borderRadius: 'calc(var(--radius-md) - 4px)', border: 'none', 
            background: activeTab === 'tim' ? 'var(--color-primary)' : 'transparent',
            color: activeTab === 'tim' ? 'white' : 'var(--color-text-light)',
            fontWeight: activeTab === 'tim' ? 600 : 400, cursor: 'pointer', transition: 'all 0.2s'
          }}
        >
          <Users size={18} style={{ display: 'inline', marginRight: '8px', verticalAlign: 'text-bottom' }} />
          Manajemen Tim
        </button>
        <button 
          onClick={() => setActiveTab('jadwal')}
          style={{ flex: 1, minWidth: '120px', padding: '0.75rem', borderRadius: 'calc(var(--radius-md) - 4px)', border: 'none', 
            background: activeTab === 'jadwal' ? 'var(--color-primary)' : 'transparent',
            color: activeTab === 'jadwal' ? 'white' : 'var(--color-text-light)',
            fontWeight: activeTab === 'jadwal' ? 600 : 400, cursor: 'pointer', transition: 'all 0.2s'
          }}
        >
          <Calendar size={18} style={{ display: 'inline', marginRight: '8px', verticalAlign: 'text-bottom' }} />
          Jadwal Antrean
        </button>
        <button 
          onClick={() => setActiveTab('klasemen')}
          style={{ flex: 1, minWidth: '120px', padding: '0.75rem', borderRadius: 'calc(var(--radius-md) - 4px)', border: 'none', 
            background: activeTab === 'klasemen' ? 'var(--color-primary)' : 'transparent',
            color: activeTab === 'klasemen' ? 'white' : 'var(--color-text-light)',
            fontWeight: activeTab === 'klasemen' ? 600 : 400, cursor: 'pointer', transition: 'all 0.2s'
          }}
        >
          <Trophy size={18} style={{ display: 'inline', marginRight: '8px', verticalAlign: 'text-bottom' }} />
          Klasemen Tim
        </button>
      </div>

      <div className="glass-panel">
        <h2 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'white' }}>
          <Users size={24} color="var(--color-secondary)" />
          Ganda Tetap
        </h2>

        {/* TAB 1: MANAJEMEN TIM */}
        {activeTab === 'tim' && (
          <div className="flex flex-col gap-6 mt-4">
            <form onSubmit={addPair} style={{ display: 'flex', flexDirection: 'column', gap: '1rem', background: 'rgba(255,255,255,0.05)', padding: '1.5rem', borderRadius: 'var(--radius-md)' }}>
              <h3 style={{ margin: 0, color: 'white', fontSize: '1.1rem' }}>Buat Tim Baru</h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--color-text-light)', marginBottom: '0.5rem' }}>Pemain 1</label>
                  <select className="input-field" value={p1} onChange={e => setP1(e.target.value)} required>
                    <option value="">-- Pilih Pemain --</option>
                    {allPlayers.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--color-text-light)', marginBottom: '0.5rem' }}>Pemain 2</label>
                  <select className="input-field" value={p2} onChange={e => setP2(e.target.value)} required>
                    <option value="">-- Pilih Pemain --</option>
                    {allPlayers.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
              </div>
              <button type="submit" className="btn" style={{ alignSelf: 'flex-start', background: 'var(--color-secondary)', color: '#0f172a' }}>
                <Plus size={18} /> Daftarkan Tim
              </button>
            </form>

            <div>
              <h3 style={{ color: 'white', fontSize: '1.1rem', marginBottom: '1rem' }}>Daftar Tim Ganda Tetap</h3>
              {loading ? (
                <p style={{ color: 'var(--color-text-light)' }}>Memuat...</p>
              ) : pairs.length === 0 ? (
                <p style={{ color: 'var(--color-text-light)', fontStyle: 'italic' }}>Belum ada tim yang didaftarkan.</p>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: '1rem' }}>
                  {pairs.map(pair => (
                    <div key={pair.id} style={{ 
                      background: 'rgba(255,255,255,0.05)', padding: '1rem', 
                      borderRadius: 'var(--radius-md)', border: '1px solid rgba(255,255,255,0.1)',
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                    }}>
                      <div style={{ color: 'white', fontWeight: 600 }}>
                        {getPlayerName(pair.player1_id)}<br/>
                        <span style={{ color: 'var(--color-secondary)' }}>&amp;</span> {getPlayerName(pair.player2_id)}
                      </div>
                      <button 
                        onClick={() => deletePair(pair.id)}
                        style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '0.5rem' }}
                        title="Hapus Tim"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 2: JADWAL */}
        {activeTab === 'jadwal' && (
          <div className="flex flex-col gap-6 mt-4">
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
                    Kehadiran Tim ({presentPairIds.size}/{pairs.length})
                  </h3>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '0.5rem' }}>
                    {pairs.map(p => {
                      const isPresent = presentPairIds.has(p.id)
                      return (
                        <div 
                          key={p.id}
                          onClick={() => togglePairPresence(p.id)}
                          style={{
                            padding: '0.75rem', borderRadius: 'var(--radius-sm)', cursor: 'pointer',
                            background: isPresent ? 'rgba(52, 211, 153, 0.2)' : 'rgba(255,255,255,0.05)',
                            border: `1px solid ${isPresent ? 'var(--color-secondary)' : 'rgba(255,255,255,0.1)'}`,
                            color: isPresent ? 'white' : 'var(--color-text-light)',
                            display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                          }}
                        >
                          <span style={{ fontSize: '0.9rem', fontWeight: isPresent ? 600 : 400 }}>{getPairName(p)}</span>
                          {isPresent ? <Check size={16} color="var(--color-secondary)" /> : <X size={16} />}
                        </div>
                      )
                    })}
                  </div>
                  
                  <button onClick={generateMatches} className="btn mt-4" style={{ width: '100%', background: 'var(--color-secondary)', color: '#0f172a' }}>
                    <Shuffle size={18} /> Acak Ulang Sisa Jadwal (10 Match)
                  </button>
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
                              <div style={{ flex: 1, textAlign: 'right', fontWeight: m.winner_team === 1 ? 700 : 400, color: m.winner_team === 1 ? 'var(--color-secondary)' : 'inherit' }}>
                                {getPlayerName(m.team1_player1_id)}<br/>
                                {getPlayerName(m.team1_player2_id)}
                              </div>
                              <div style={{ padding: '0 1rem', color: 'var(--color-text-light)', fontSize: '0.9rem', textAlign: 'center' }}>
                                {isCompleted ? (
                                  <span style={{ fontSize: '1.2rem', fontWeight: 700, color: 'white' }}>{m.team1_score} - {m.team2_score}</span>
                                ) : 'VS'}
                              </div>
                              <div style={{ flex: 1, textAlign: 'left', fontWeight: m.winner_team === 2 ? 700 : 400, color: m.winner_team === 2 ? 'var(--color-secondary)' : 'inherit' }}>
                                {getPlayerName(m.team2_player1_id)}<br/>
                                {getPlayerName(m.team2_player2_id)}
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

        {/* TAB 3: KLASEMEN */}
        {activeTab === 'klasemen' && (
          <div className="flex flex-col gap-6 mt-4">
            <div style={{ textAlign: 'center', marginBottom: '1rem' }}>
              <h3 style={{ color: 'white', fontSize: '1.2rem', margin: 0 }}>Klasemen Tim Hari Ini</h3>
              <p style={{ color: 'var(--color-text-light)', fontSize: '0.9rem', margin: '0.25rem 0 0 0' }}>
                Total poin dihitung dari pertandingan yang berstatus Selesai pada tanggal {date}.
              </p>
            </div>
            
            {(() => {
              const points = new Map<string, number>()
              const completedToday = matches.filter(m => m.status === 'completed' && m.match_date === date)
              
              completedToday.forEach(m => {
                if (m.winner_team === 1) {
                  const pair = getPairByPlayerIds(m.team1_player1_id, m.team1_player2_id)
                  if (pair) points.set(pair.id, (points.get(pair.id) || 0) + 1)
                } else if (m.winner_team === 2) {
                  const pair = getPairByPlayerIds(m.team2_player1_id, m.team2_player2_id)
                  if (pair) points.set(pair.id, (points.get(pair.id) || 0) + 1)
                }
              })
              
              if (completedToday.length === 0) {
                return (
                  <div style={{ textAlign: 'center', padding: '2rem', background: 'rgba(255,255,255,0.05)', borderRadius: 'var(--radius-md)' }}>
                    <p style={{ color: 'var(--color-text-light)' }}>Belum ada pertandingan yang selesai hari ini.</p>
                  </div>
                )
              }

              const leaderboard = Array.from(points.entries())
                .map(([id, score]) => {
                  const pair = pairs.find(p => p.id === id)
                  return { id, name: pair ? getPairName(pair) : 'Unknown', score }
                })
                .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name))

              return (
                <div style={{ background: 'rgba(255,255,255,0.05)', borderRadius: 'var(--radius-md)', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.1)' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', color: 'white' }}>
                    <thead>
                      <tr style={{ background: 'rgba(0,0,0,0.2)' }}>
                        <th style={{ padding: '1rem', borderBottom: '1px solid rgba(255,255,255,0.1)', width: '60px', textAlign: 'center' }}>Rank</th>
                        <th style={{ padding: '1rem', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>Tim</th>
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
           .input-field {
             width: 100%;
           }
         }
      `}</style>
    </div>
  )
}
