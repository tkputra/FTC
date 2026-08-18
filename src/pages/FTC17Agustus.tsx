import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Users, Calendar, Trophy, Shuffle, Trash2, Plus, Flag, Sparkles, Award } from 'lucide-react';

type Player = { id: string; name: string }
type FixedPair = { id: string; player1_id: string; player2_id: string; created_at: string }
type GroupTeam = { id: string; pair_id: string; group_name: 'A' | 'B'; created_at: string }

type Match = {
  id: string;
  match_date: string;
  status: 'scheduled' | 'ongoing' | 'completed';
  stage: 'group' | 'semifinal' | 'final';
  team1_player1_id: string;
  team1_player2_id: string;
  team2_player1_id: string;
  team2_player2_id: string;
  winner_team: 1 | 2 | null;
  team1_score?: number;
  team2_score?: number;
  created_at: string;
}

export default function FTC17Agustus() {
  const [activeTab, setActiveTab] = useState<'tim' | 'jadwal' | 'klasemen' | 'knockout'>('tim')
  const [date, setDate] = useState(new Date().toISOString().split('T')[0])
  
  // Roster States
  const [allPlayers, setAllPlayers] = useState<Player[]>([])
  const [pairs, setPairs] = useState<FixedPair[]>([])
  
  // Tournament States
  const [tournamentTeams, setTournamentTeams] = useState<GroupTeam[]>([])
  const [matches, setMatches] = useState<Match[]>([])
  const [scoresInput, setScoresInput] = useState<Record<string, { s1: string, s2: string }>>({})
  const [loading, setLoading] = useState(true)

  // Roster add state
  const [p1, setP1] = useState('')
  const [p2, setP2] = useState('')

  useEffect(() => {
    fetchData()
  }, [])

  async function fetchData() {
    setLoading(true)
    
    // 1. Fetch Players
    const { data: playersData } = await supabase.from('players').select('*').order('name')
    if (playersData) setAllPlayers(playersData)

    // 2. Fetch Fixed Pairs (Roster)
    const { data: pairsData } = await supabase.from('fixed_pairs').select('*').order('created_at')
    if (pairsData) setPairs(pairsData)

    // 3. Fetch Registered 17 Agustus teams
    const { data: groupTeams } = await supabase.from('ftc_17_agustus_teams').select('*')
    if (groupTeams) setTournamentTeams(groupTeams as GroupTeam[])

    // 4. Fetch 17 Agustus matches
    const { data: matchesData } = await supabase
      .from('matches')
      .select('*')
      .eq('match_type', 'ftc_17_agustus')
    
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

  function getPlayerName(id: string) {
    if (!id) return ''
    return allPlayers.find(p => p.id === id)?.name || 'Unknown'
  }

  function getPairName(pair: FixedPair) {
    return `${getPlayerName(pair.player1_id)} & ${getPlayerName(pair.player2_id)}`
  }

  function getPairNameById(pairId: string) {
    const pair = pairs.find(p => p.id === pairId)
    return pair ? getPairName(pair) : 'Unknown'
  }

  function getPairByPlayerIds(id1: string, id2: string) {
    return pairs.find(p => 
      (p.player1_id === id1 && p.player2_id === id2) || 
      (p.player1_id === id2 && p.player2_id === id1)
    )
  }

  // --- TAB: MANAJEMEN ROSTER & TIM ---
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
    
    const exists = pairs.find(p => 
      (p.player1_id === p1 && p.player2_id === p2) || 
      (p.player1_id === p2 && p.player2_id === p1)
    )
    if (exists) {
      alert('Tim ini sudah terdaftar di roster!')
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
    if (!window.confirm('Hapus tim ini dari roster?')) return
    const { error } = await supabase.from('fixed_pairs').delete().eq('id', id)
    if (error) alert('Gagal menghapus: ' + error.message)
    else fetchData()
  }

  // --- MANAJEMEN GRUP TURNAMEN ---
  async function registerToGroup(pairId: string, groupName: 'A' | 'B') {
    if (tournamentTeams.length >= 9 && !tournamentTeams.find(t => t.pair_id === pairId)) {
      if (!window.confirm('Sudah ada 9 tim terdaftar. Apakah ingin tetap menambahkan tim ini?')) {
        return
      }
    }

    const exists = tournamentTeams.find(t => t.pair_id === pairId)
    if (exists) {
      // Update group
      const { error } = await supabase
        .from('ftc_17_agustus_teams')
        .update({ group_name: groupName })
        .eq('pair_id', pairId)
      if (error) alert('Gagal memindahkan grup: ' + error.message)
      else fetchData()
    } else {
      // Insert new
      const { error } = await supabase
        .from('ftc_17_agustus_teams')
        .insert([{ pair_id: pairId, group_name: groupName }])
      if (error) alert('Gagal mendaftarkan ke grup: ' + error.message)
      else fetchData()
    }
  }

  async function unregisterFromTournament(pairId: string) {
    const { error } = await supabase
      .from('ftc_17_agustus_teams')
      .delete()
      .eq('pair_id', pairId)
    if (error) alert('Gagal menghapus dari turnamen: ' + error.message)
    else fetchData()
  }

  async function autoSplitGroups() {
    if (pairs.length < 2) {
      alert('Daftarkan tim di roster terlebih dahulu sebelum membagi grup.')
      return
    }
    
    // Tanyakan konfirmasi karena akan mereset pembagian grup yang ada
    if (tournamentTeams.length > 0) {
      if (!window.confirm('Membagi grup otomatis akan mereset pendaftaran grup yang ada saat ini dan menjadwalkan ulang pertandingan. Lanjutkan?')) {
        return
      }
    }

    // Ambil maksimal 9 tim untuk diacak (atau seluruh tim jika kurang dari 9)
    const teamsToShuffle = [...pairs].slice(0, 9)
    
    // Acak tim
    for (let i = teamsToShuffle.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [teamsToShuffle[i], teamsToShuffle[j]] = [teamsToShuffle[j], teamsToShuffle[i]];
    }

    // Hapus pendaftaran lama
    await supabase.from('ftc_17_agustus_teams').delete().neq('id', '00000000-0000-0000-0000-000000000000')

    const newRegistrations: { pair_id: string; group_name: 'A' | 'B' }[] = []
    const mid = Math.ceil(teamsToShuffle.length / 2) // Bila 9, Group A = 5, Group B = 4

    for (let i = 0; i < teamsToShuffle.length; i++) {
      newRegistrations.push({
        pair_id: teamsToShuffle[i].id,
        group_name: i < mid ? 'A' : 'B'
      })
    }

    const { error } = await supabase.from('ftc_17_agustus_teams').insert(newRegistrations)
    if (error) {
      alert('Gagal menyimpan pembagian grup otomatis: ' + error.message)
    } else {
      // Automatically generate matches for these teams
      await generateGroupMatches(newRegistrations)
      fetchData()
    }
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

  async function quickCompleteMatch(matchId: string, winnerTeam: 1 | 2) {
    // Quick assign a default set score of 6 - 0 or 0 - 6 to make standings calculation function properly
    const s1 = winnerTeam === 1 ? 6 : 0;
    const s2 = winnerTeam === 2 ? 6 : 0;

    const { error } = await supabase.from('matches').update({ 
      status: 'completed',
      team1_score: s1,
      team2_score: s2,
      winner_team: winnerTeam
    }).eq('id', matchId)
    
    if (error) alert('Gagal menyimpan hasil pemenang: ' + error.message)
    else fetchData()
  }

  // Acak Jadwal Fase Grup (Round Robin)
  async function generateGroupMatches(teamsList?: { pair_id: string; group_name: 'A' | 'B' }[]) {
    const activeTeams = teamsList || tournamentTeams
    const teamsA = activeTeams.filter(t => t.group_name === 'A')
    const teamsB = activeTeams.filter(t => t.group_name === 'B')

    if (teamsA.length < 2 || teamsB.length < 2) {
      if (!teamsList) alert('Setiap grup minimal harus memiliki 2 tim untuk membuat jadwal.')
      return
    }

    if (!teamsList) {
      if (!window.confirm('Menghasilkan jadwal baru akan menghapus semua antrean jadwal FASE GRUP yang belum dimulai. Lanjutkan?')) {
        return
      }
    }

    // Ambil semua match turnamen 17 agustus saat ini
    const scheduledGroupMatches = matches.filter(m => m.stage === 'group' && m.status === 'scheduled')
    if (scheduledGroupMatches.length > 0) {
      await supabase.from('matches').delete().in('id', scheduledGroupMatches.map(m => m.id))
    }

    // Dapatkan data FixedPair detail dari pairs roster
    const pairsA = pairs.filter(p => teamsA.find(t => t.pair_id === p.id))
    const pairsB = pairs.filter(p => teamsB.find(t => t.pair_id === p.id))

    // Buat kombinasi round robin
    const combA = getCombinations(pairsA)
    const combB = getCombinations(pairsB)

    // Acak urutan kombinasi
    combA.sort(() => Math.random() - 0.5)
    combB.sort(() => Math.random() - 0.5)

    // Selang-seling jadwal Grup A dan Grup B agar adil & istirahat seimbang
    const newMatches = []
    const maxLength = Math.max(combA.length, combB.length)

    for (let i = 0; i < maxLength; i++) {
      if (i < combA.length) {
        newMatches.push({
          match_type: 'ftc_17_agustus',
          stage: 'group',
          match_date: date,
          status: 'scheduled',
          team1_player1_id: combA[i][0].player1_id,
          team1_player2_id: combA[i][0].player2_id,
          team2_player1_id: combA[i][1].player1_id,
          team2_player2_id: combA[i][1].player2_id
        })
      }
      if (i < combB.length) {
        newMatches.push({
          match_type: 'ftc_17_agustus',
          stage: 'group',
          match_date: date,
          status: 'scheduled',
          team1_player1_id: combB[i][0].player1_id,
          team1_player2_id: combB[i][0].player2_id,
          team2_player1_id: combB[i][1].player1_id,
          team2_player2_id: combB[i][1].player2_id
        })
      }
    }

    const { error } = await supabase.from('matches').insert(newMatches)
    if (error) {
      if (!teamsList) alert('Gagal menyimpan jadwal fase grup: ' + error.message)
    }
  }

  // --- KLASEMEN GRUP ---
  type StandingEntry = {
    pairId: string;
    name: string;
    played: number;
    won: number;
    lost: number;
    gamesWon: number;
    gamesLost: number;
    diff: number;
    points: number;
  }

  function getGroupStandings(groupName: 'A' | 'B'): StandingEntry[] {
    const groupTeamIds = new Set(tournamentTeams.filter(t => t.group_name === groupName).map(t => t.pair_id))
    
    // Inisialisasi entri
    const standingsMap = new Map<string, StandingEntry>()
    pairs.forEach(p => {
      if (groupTeamIds.has(p.id)) {
        standingsMap.set(p.id, {
          pairId: p.id,
          name: getPairName(p),
          played: 0,
          won: 0,
          lost: 0,
          gamesWon: 0,
          gamesLost: 0,
          diff: 0,
          points: 0
        })
      }
    })

    // Filter match grup yang selesai
    const groupMatchesCompleted = matches.filter(
      m => m.stage === 'group' && m.status === 'completed'
    )

    groupMatchesCompleted.forEach(m => {
      const p1 = getPairByPlayerIds(m.team1_player1_id, m.team1_player2_id)
      const p2 = getPairByPlayerIds(m.team2_player1_id, m.team2_player2_id)

      if (p1 && standingsMap.has(p1.id) && p2 && standingsMap.has(p2.id)) {
        const e1 = standingsMap.get(p1.id)!
        const e2 = standingsMap.get(p2.id)!

        const score1 = m.team1_score || 0
        const score2 = m.team2_score || 0

        e1.played++
        e2.played++

        e1.gamesWon += score1
        e1.gamesLost += score2
        e2.gamesWon += score2
        e2.gamesLost += score1

        if (m.winner_team === 1) {
          e1.won++
          e1.points++
          e2.lost++
        } else {
          e2.won++
          e2.points++
          e1.lost++
        }

        e1.diff = e1.gamesWon - e1.gamesLost
        e2.diff = e2.gamesWon - e2.gamesLost
      }
    })

    return Array.from(standingsMap.values()).sort((a, b) => {
      // 1. Poin (Kemenangan)
      if (b.points !== a.points) return b.points - a.points
      // 2. Selisih Skor Game
      if (b.diff !== a.diff) return b.diff - a.diff
      // 3. Game Memasukkan (GS)
      if (b.gamesWon !== a.gamesWon) return b.gamesWon - a.gamesWon
      // 4. Alfabetis
      return a.name.localeCompare(b.name)
    })
  }

  // --- TAB: FASE GUGUR (KNOCKOUT) ---
  // Generate brackets
  async function generateKnockoutBrackets() {
    const standingsA = getGroupStandings('A')
    const standingsB = getGroupStandings('B')

    if (standingsA.length < 2 || standingsB.length < 2) {
      alert('Setiap grup minimal harus memiliki 2 tim untuk menentukan Semi Final.')
      return
    }

    // Pastikan seluruh pertandingan fase grup selesai
    const ongoingOrScheduledGroup = matches.filter(m => m.stage === 'group' && m.status !== 'completed')
    if (ongoingOrScheduledGroup.length > 0) {
      alert(`Masih ada ${ongoingOrScheduledGroup.length} pertandingan fase grup yang belum selesai. Selesaikan semuanya terlebih dahulu!`)
      return
    }

    if (!window.confirm('Buat jadwal Semi Final berdasarkan klasemen akhir grup? (Jadwal Semi Final lama jika ada akan dihapus)')) {
      return
    }

    // Hapus semi final & final terjadwal sebelumnya
    const scheduledKnockouts = matches.filter(m => (m.stage === 'semifinal' || m.stage === 'final') && m.status === 'scheduled')
    if (scheduledKnockouts.length > 0) {
      await supabase.from('matches').delete().in('id', scheduledKnockouts.map(m => m.id))
    }

    const tA1 = pairs.find(p => p.id === standingsA[0].pairId)!
    const tA2 = pairs.find(p => p.id === standingsA[1].pairId)!
    const tB1 = pairs.find(p => p.id === standingsB[0].pairId)!
    const tB2 = pairs.find(p => p.id === standingsB[1].pairId)!

    // SF 1: Juara Grup A vs Runner-up Grup B
    // SF 2: Juara Grup B vs Runner-up Grup A
    const newSFs = [
      {
        match_type: 'ftc_17_agustus',
        stage: 'semifinal',
        match_date: date,
        status: 'scheduled',
        team1_player1_id: tA1.player1_id,
        team1_player2_id: tA1.player2_id,
        team2_player1_id: tB2.player1_id,
        team2_player2_id: tB2.player2_id
      },
      {
        match_type: 'ftc_17_agustus',
        stage: 'semifinal',
        match_date: date,
        status: 'scheduled',
        team1_player1_id: tB1.player1_id,
        team1_player2_id: tB1.player2_id,
        team2_player1_id: tA2.player1_id,
        team2_player2_id: tA2.player2_id
      }
    ]

    const { error } = await supabase.from('matches').insert(newSFs)
    if (error) alert('Gagal menyimpan jadwal Semi Final: ' + error.message)
    else fetchData()
  }

  // Generate Final
  async function generateFinalBracket() {
    const sfs = matches.filter(m => m.stage === 'semifinal')
    const completedSFs = sfs.filter(m => m.status === 'completed')

    if (completedSFs.length < 2) {
      alert('Selesaikan kedua pertandingan Semi Final terlebih dahulu untuk memulai Final!')
      return
    }

    if (!window.confirm('Mulai pertandingan FINAL?')) {
      return
    }

    // Hapus final terjadwal jika ada
    const scheduledFinal = matches.filter(m => m.stage === 'final' && m.status === 'scheduled')
    if (scheduledFinal.length > 0) {
      await supabase.from('matches').delete().in('id', scheduledFinal.map(m => m.id))
    }

    const sf1 = completedSFs[0]
    const sf2 = completedSFs[1]

    const getWinnerPlayers = (sf: Match) => {
      if (sf.winner_team === 1) {
        return { p1: sf.team1_player1_id, p2: sf.team1_player2_id }
      } else {
        return { p1: sf.team2_player1_id, p2: sf.team2_player2_id }
      }
    }

    const w1 = getWinnerPlayers(sf1)
    const w2 = getWinnerPlayers(sf2)

    const finalMatch = {
      match_type: 'ftc_17_agustus',
      stage: 'final',
      match_date: date,
      status: 'scheduled',
      team1_player1_id: w1.p1,
      team1_player2_id: w1.p2,
      team2_player1_id: w2.p1,
      team2_player2_id: w2.p2
    }

    const { error } = await supabase.from('matches').insert([finalMatch])
    if (error) alert('Gagal menyimpan jadwal Final: ' + error.message)
    else fetchData()
  }

  // Helper
  const displayGroupMatches = matches.filter(m => m.stage === 'group' && (m.status === 'scheduled' || m.status === 'ongoing' || (m.status === 'completed' && m.match_date === date)))
  const displaySFMatches = matches.filter(m => m.stage === 'semifinal')
  const displayFinalMatch = matches.filter(m => m.stage === 'final')

  const standingsA = getGroupStandings('A')
  const standingsB = getGroupStandings('B')

  return (
    <div className="flex flex-col gap-6 mt-4 pb-12">
      {/* Red/White Banner */}
      <div style={{
        background: 'linear-gradient(135deg, #ef4444 0%, #b91c1c 100%)',
        padding: '1.5rem',
        borderRadius: 'var(--radius-lg)',
        border: '1px solid rgba(255,255,255,0.2)',
        boxShadow: '0 10px 15px -3px rgba(185, 28, 28, 0.3)',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.25rem',
        position: 'relative',
        overflow: 'hidden'
      }}>
        <div style={{ position: 'absolute', right: '-10px', bottom: '-20px', opacity: 0.15, transform: 'rotate(-15deg)' }}>
          <Flag size={120} color="white" />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span style={{ fontSize: '0.75rem', fontWeight: 700, letterSpacing: '1px', textTransform: 'uppercase', background: 'white', color: '#b91c1c', padding: '2px 8px', borderRadius: '12px' }}>
            Edisi Khusus Kemerdekaan 🇮🇩
          </span>
        </div>
        <h2 style={{ margin: '0.5rem 0 0 0', color: 'white', fontSize: '1.75rem', fontWeight: 800, letterSpacing: '-0.5px' }}>
          FTC 17 Agustus
        </h2>
        <p style={{ margin: 0, color: 'rgba(255,255,255,0.8)', fontSize: '0.9rem' }}>
          Turnamen Ganda Tetap 9 Tim: Penyisihan 2 Grup &amp; Babak Gugur Semifinal-Final.
        </p>
      </div>

      {/* Navigation Sub-Tabs */}
      <div className="flex bg-[rgba(255,255,255,0.1)] p-1 rounded-[var(--radius-md)] border border-[rgba(255,255,255,0.1)] overflow-x-auto">
        <button 
          onClick={() => setActiveTab('tim')}
          style={{ flex: 1, minWidth: '120px', padding: '0.75rem', borderRadius: 'calc(var(--radius-md) - 4px)', border: 'none', 
            background: activeTab === 'tim' ? '#ef4444' : 'transparent',
            color: activeTab === 'tim' ? 'white' : 'var(--color-text-light)',
            fontWeight: activeTab === 'tim' ? 600 : 400, cursor: 'pointer', transition: 'all 0.2s'
          }}
        >
          <Users size={18} style={{ display: 'inline', marginRight: '8px', verticalAlign: 'text-bottom' }} />
          Grup &amp; Roster
        </button>
        <button 
          onClick={() => setActiveTab('jadwal')}
          style={{ flex: 1, minWidth: '120px', padding: '0.75rem', borderRadius: 'calc(var(--radius-md) - 4px)', border: 'none', 
            background: activeTab === 'jadwal' ? '#ef4444' : 'transparent',
            color: activeTab === 'jadwal' ? 'white' : 'var(--color-text-light)',
            fontWeight: activeTab === 'jadwal' ? 600 : 400, cursor: 'pointer', transition: 'all 0.2s'
          }}
        >
          <Calendar size={18} style={{ display: 'inline', marginRight: '8px', verticalAlign: 'text-bottom' }} />
          Fase Grup
        </button>
        <button 
          onClick={() => setActiveTab('klasemen')}
          style={{ flex: 1, minWidth: '120px', padding: '0.75rem', borderRadius: 'calc(var(--radius-md) - 4px)', border: 'none', 
            background: activeTab === 'klasemen' ? '#ef4444' : 'transparent',
            color: activeTab === 'klasemen' ? 'white' : 'var(--color-text-light)',
            fontWeight: activeTab === 'klasemen' ? 600 : 400, cursor: 'pointer', transition: 'all 0.2s'
          }}
        >
          <Trophy size={18} style={{ display: 'inline', marginRight: '8px', verticalAlign: 'text-bottom' }} />
          Klasemen Grup
        </button>
        <button 
          onClick={() => setActiveTab('knockout')}
          style={{ flex: 1, minWidth: '120px', padding: '0.75rem', borderRadius: 'calc(var(--radius-md) - 4px)', border: 'none', 
            background: activeTab === 'knockout' ? '#ef4444' : 'transparent',
            color: activeTab === 'knockout' ? 'white' : 'var(--color-text-light)',
            fontWeight: activeTab === 'knockout' ? 600 : 400, cursor: 'pointer', transition: 'all 0.2s'
          }}
        >
          <Award size={18} style={{ display: 'inline', marginRight: '8px', verticalAlign: 'text-bottom' }} />
          Fase Gugur
        </button>
      </div>

      <div className="glass-panel" style={{ borderTop: '4px solid #ef4444' }}>
        
        {/* SUBTAB 1: GRUP & ROSTER */}
        {activeTab === 'tim' && (
          <div className="flex flex-col gap-6">
            {/* Split Screen for Group Assignments */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <h3 style={{ color: 'white', margin: 0, fontSize: '1.25rem' }}>Pembagian Grup Turnamen (Maks 9 Tim)</h3>
                <button onClick={autoSplitGroups} className="btn" style={{ background: '#ef4444', color: 'white', padding: '0.5rem 1rem', fontSize: '0.85rem' }}>
                  <Shuffle size={16} /> Acak Grup Otomatis
                </button>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
                {/* Group A Panel */}
                <div style={{ background: 'rgba(255,255,255,0.03)', padding: '1rem', borderRadius: 'var(--radius-md)', border: '1px solid rgba(255,255,255,0.05)' }}>
                  <h4 style={{ color: 'white', margin: '0 0 0.75rem 0', display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '0.5rem' }}>
                    <span>GRUP A</span>
                    <span style={{ color: '#ef4444' }}>{tournamentTeams.filter(t => t.group_name === 'A').length} Tim</span>
                  </h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    {tournamentTeams.filter(t => t.group_name === 'A').length === 0 ? (
                      <p style={{ color: 'var(--color-text-light)', fontStyle: 'italic', fontSize: '0.85rem', margin: 0 }}>Belum ada tim.</p>
                    ) : (
                      tournamentTeams.filter(t => t.group_name === 'A').map(t => (
                        <div key={t.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.05)', padding: '0.5rem 0.75rem', borderRadius: '4px' }}>
                          <span style={{ color: 'white', fontSize: '0.85rem', fontWeight: 600 }}>{getPairNameById(t.pair_id)}</span>
                          <button onClick={() => unregisterFromTournament(t.pair_id)} style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: '0.75rem' }}>Keluarkan</button>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* Group B Panel */}
                <div style={{ background: 'rgba(255,255,255,0.03)', padding: '1rem', borderRadius: 'var(--radius-md)', border: '1px solid rgba(255,255,255,0.05)' }}>
                  <h4 style={{ color: 'white', margin: '0 0 0.75rem 0', display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '0.5rem' }}>
                    <span>GRUP B</span>
                    <span style={{ color: '#ef4444' }}>{tournamentTeams.filter(t => t.group_name === 'B').length} Tim</span>
                  </h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    {tournamentTeams.filter(t => t.group_name === 'B').length === 0 ? (
                      <p style={{ color: 'var(--color-text-light)', fontStyle: 'italic', fontSize: '0.85rem', margin: 0 }}>Belum ada tim.</p>
                    ) : (
                      tournamentTeams.filter(t => t.group_name === 'B').map(t => (
                        <div key={t.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.05)', padding: '0.5rem 0.75rem', borderRadius: '4px' }}>
                          <span style={{ color: 'white', fontSize: '0.85rem', fontWeight: 600 }}>{getPairNameById(t.pair_id)}</span>
                          <button onClick={() => unregisterFromTournament(t.pair_id)} style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: '0.75rem' }}>Keluarkan</button>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </div>

            <hr style={{ border: 'none', borderBottom: '1px solid rgba(255,255,255,0.1)', margin: 0 }} />

            {/* Roster & Pair Registration */}
            <div>
              <h3 style={{ color: 'white', margin: '0 0 1rem 0', fontSize: '1.25rem' }}>Roster Tim Ganda</h3>
              
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1rem' }}>
                {pairs.map(pair => {
                  const reg = tournamentTeams.find(t => t.pair_id === pair.id)
                  return (
                    <div key={pair.id} style={{ 
                      background: 'rgba(255,255,255,0.05)', padding: '1rem', 
                      borderRadius: 'var(--radius-md)', border: '1px solid rgba(255,255,255,0.1)',
                      display: 'flex', flexDirection: 'column', gap: '0.75rem'
                    }}>
                      <div style={{ color: 'white', fontWeight: 600, fontSize: '0.95rem' }}>
                        {getPlayerName(pair.player1_id)} &amp; {getPlayerName(pair.player2_id)}
                      </div>
                      
                      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginTop: 'auto' }}>
                        <button 
                          onClick={() => registerToGroup(pair.id, 'A')}
                          className="btn" 
                          style={{ flex: 1, padding: '4px 8px', fontSize: '0.75rem', background: reg?.group_name === 'A' ? '#ef4444' : 'rgba(255,255,255,0.1)', color: 'white' }}
                        >
                          {reg?.group_name === 'A' ? 'Grup A 🇮🇩' : 'Grup A'}
                        </button>
                        <button 
                          onClick={() => registerToGroup(pair.id, 'B')}
                          className="btn" 
                          style={{ flex: 1, padding: '4px 8px', fontSize: '0.75rem', background: reg?.group_name === 'B' ? '#ef4444' : 'rgba(255,255,255,0.1)', color: 'white' }}
                        >
                          {reg?.group_name === 'B' ? 'Grup B 🇮🇩' : 'Grup B'}
                        </button>
                        <button 
                          onClick={() => deletePair(pair.id)}
                          style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '4px' }}
                          title="Hapus Roster"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            <hr style={{ border: 'none', borderBottom: '1px solid rgba(255,255,255,0.1)', margin: 0 }} />

            {/* Create new pair */}
            <form onSubmit={addPair} style={{ display: 'flex', flexDirection: 'column', gap: '1rem', background: 'rgba(255,255,255,0.05)', padding: '1.5rem', borderRadius: 'var(--radius-md)' }}>
              <h3 style={{ margin: 0, color: 'white', fontSize: '1.1rem' }}>Tambah Pasangan Roster Baru</h3>
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
              <button type="submit" className="btn" style={{ alignSelf: 'flex-start', background: '#ef4444', color: 'white' }}>
                <Plus size={18} /> Daftarkan ke Roster
              </button>
            </form>

          </div>
        )}

        {/* SUBTAB 2: FASE GRUP JADWAL */}
        {activeTab === 'jadwal' && (
          <div className="flex flex-col gap-6">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <label style={{ display: 'block', color: 'var(--color-text-light)', marginBottom: '0.5rem' }}>Tanggal Pertandingan:</label>
                <input 
                  type="date" 
                  className="input-field" 
                  value={date} 
                  onChange={(e) => setDate(e.target.value)}
                  style={{ background: 'rgba(255,255,255,0.9)', color: '#0f172a' }}
                />
              </div>
              <button onClick={() => generateGroupMatches()} className="btn" style={{ background: '#ef4444', color: 'white', marginTop: '1.5rem' }}>
                <Shuffle size={18} /> Urutkan &amp; Buat Jadwal Fase Grup
              </button>
            </div>

            {loading ? (
              <p style={{ color: 'white' }}>Memuat data...</p>
            ) : (
              <div>
                <h3 style={{ color: 'white', fontSize: '1.1rem', marginBottom: '1rem' }}>Daftar Antrean Penyisihan Grup</h3>
                {displayGroupMatches.length === 0 ? (
                  <p style={{ color: 'var(--color-text-light)', fontStyle: 'italic', fontSize: '0.9rem' }}>Belum ada antrean jadwal. Tekan tombol buat jadwal di atas.</p>
                ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1rem' }}>
                    {displayGroupMatches.map((m, idx) => {
                      const isScheduled = m.status === 'scheduled';
                      const isOngoing = m.status === 'ongoing';
                      const isCompleted = m.status === 'completed';
                      
                      const pair1 = getPairByPlayerIds(m.team1_player1_id, m.team1_player2_id)
                      const tTeam = tournamentTeams.find(t => t.pair_id === pair1?.id)
                      const groupLabel = tTeam ? `GRUP ${tTeam.group_name}` : 'GRUP';

                      return (
                        <div key={m.id} style={{ 
                          background: isOngoing ? 'rgba(239, 68, 68, 0.1)' : 'rgba(255,255,255,0.05)', 
                          padding: '1rem', borderRadius: 'var(--radius-md)', 
                          border: `1px solid ${isOngoing ? '#ef4444' : 'rgba(255,255,255,0.1)'}` 
                        }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                            <div style={{ fontSize: '0.8rem', color: isCompleted ? 'gray' : '#ef4444', fontWeight: 600 }}>
                              MATCH {idx + 1} • <span style={{ color: 'white', background: 'rgba(255,255,255,0.1)', padding: '2px 6px', borderRadius: '4px' }}>{groupLabel}</span>
                            </div>
                            <div style={{ fontSize: '0.8rem', fontWeight: 600, color: isOngoing ? '#ef4444' : isCompleted ? 'gray' : 'white', background: isOngoing ? 'rgba(239, 68, 68, 0.2)' : 'transparent', padding: '2px 8px', borderRadius: '12px' }}>
                              {isScheduled ? 'Menunggu' : isOngoing ? 'SEDANG MAIN' : 'Selesai'}
                            </div>
                          </div>
                          
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: isCompleted ? 'gray' : 'white' }}>
                            <div style={{ flex: 1, textAlign: 'right', fontWeight: m.winner_team === 1 ? 700 : 400, color: m.winner_team === 1 ? '#ef4444' : 'inherit' }}>
                              {getPlayerName(m.team1_player1_id)}<br/>
                              {getPlayerName(m.team1_player2_id)}
                            </div>
                            <div style={{ padding: '0 1rem', color: 'var(--color-text-light)', fontSize: '0.9rem', textAlign: 'center' }}>
                              {isCompleted ? (
                                <span style={{ fontSize: '1.2rem', fontWeight: 700, color: 'white' }}>{m.team1_score} - {m.team2_score}</span>
                              ) : 'VS'}
                            </div>
                            <div style={{ flex: 1, textAlign: 'left', fontWeight: m.winner_team === 2 ? 700 : 400, color: m.winner_team === 2 ? '#ef4444' : 'inherit' }}>
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
                            <div className="mt-3 flex flex-col gap-3 border-t border-[rgba(255,255,255,0.1)] pt-3">
                              <span style={{ fontSize: '0.8rem', color: 'var(--color-text-light)', textAlign: 'center', display: 'block' }}>Pilih Pemenang Langsung:</span>
                              <div className="flex gap-2 justify-center">
                                <button 
                                  onClick={() => quickCompleteMatch(m.id, 1)} 
                                  className="btn" 
                                  style={{ padding: '0.5rem 1rem', fontSize: '0.8rem', background: '#ef4444', color: 'white', flex: 1 }}
                                >
                                  🏆 Tim 1 Menang
                                </button>
                                <button 
                                  onClick={() => quickCompleteMatch(m.id, 2)} 
                                  className="btn" 
                                  style={{ padding: '0.5rem 1rem', fontSize: '0.8rem', background: '#ef4444', color: 'white', flex: 1 }}
                                >
                                  🏆 Tim 2 Menang
                                </button>
                              </div>
                              <div style={{ textAlign: 'center', color: 'gray', fontSize: '0.7rem' }}>— ATAU INPUT SKOR GAME —</div>
                              <div className="flex gap-2 items-center justify-center">
                                <input 
                                  type="number" 
                                  placeholder="0"
                                  value={scoresInput[m.id]?.s1 || ''}
                                  onChange={(e) => setScoresInput(prev => ({ ...prev, [m.id]: { ...prev[m.id], s1: e.target.value } }))}
                                  style={{ width: '60px', padding: '0.5rem', textAlign: 'center', borderRadius: '4px', border: 'none', color: '#0f172a', fontWeight: 700 }}
                                />
                                <span style={{ color: 'white' }}>-</span>
                                <input 
                                  type="number" 
                                  placeholder="0"
                                  value={scoresInput[m.id]?.s2 || ''}
                                  onChange={(e) => setScoresInput(prev => ({ ...prev, [m.id]: { ...prev[m.id], s2: e.target.value } }))}
                                  style={{ width: '60px', padding: '0.5rem', textAlign: 'center', borderRadius: '4px', border: 'none', color: '#0f172a', fontWeight: 700 }}
                                />
                                <button onClick={() => completeMatch(m.id)} className="btn" style={{ padding: '0.5rem 1rem', fontSize: '0.85rem', marginLeft: '0.5rem', background: 'white', color: '#0f172a' }}>
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
            )}
          </div>
        )}

        {/* SUBTAB 3: KLASEMEN GRUP */}
        {activeTab === 'klasemen' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
            {/* Group A Standings */}
            <div>
              <h3 style={{ color: 'white', fontSize: '1.25rem', marginBottom: '0.75rem', display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '0.5rem' }}>
                <span>KLASEMEN GRUP A</span>
                <span style={{ color: '#ef4444', fontSize: '0.9rem' }}>Top 2 Lolos Semifinal</span>
              </h3>
              
              {standingsA.length === 0 ? (
                <p style={{ color: 'var(--color-text-light)', fontStyle: 'italic', fontSize: '0.9rem' }}>Belum ada tim terdaftar di Grup A.</p>
              ) : (
                <div style={{ overflowX: 'auto', background: 'rgba(255,255,255,0.03)', borderRadius: 'var(--radius-md)', border: '1px solid rgba(255,255,255,0.1)' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', color: 'white', minWidth: '600px' }}>
                    <thead>
                      <tr style={{ background: 'rgba(0,0,0,0.3)', textAlign: 'left' }}>
                        <th style={{ padding: '0.75rem', textAlign: 'center', width: '60px' }}>Rank</th>
                        <th style={{ padding: '0.75rem' }}>Nama Tim</th>
                        <th style={{ padding: '0.75rem', textAlign: 'center', width: '80px' }}>Main</th>
                        <th style={{ padding: '0.75rem', textAlign: 'center', width: '80px' }}>Menang</th>
                        <th style={{ padding: '0.75rem', textAlign: 'center', width: '80px' }}>Kalah</th>
                        <th style={{ padding: '0.75rem', textAlign: 'center', width: '100px' }}>Skor Game</th>
                        <th style={{ padding: '0.75rem', textAlign: 'center', width: '80px' }}>Selisih</th>
                        <th style={{ padding: '0.75rem', textAlign: 'center', width: '80px' }}>Poin</th>
                      </tr>
                    </thead>
                    <tbody>
                      {standingsA.map((item, index) => {
                        const isQualifying = index < 2;
                        return (
                          <tr key={item.pairId} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', background: isQualifying ? 'rgba(52, 211, 153, 0.05)' : 'transparent' }}>
                            <td style={{ padding: '0.75rem', textAlign: 'center', fontWeight: 700, color: isQualifying ? '#34d399' : 'gray' }}>
                              #{index + 1}
                            </td>
                            <td style={{ padding: '0.75rem', fontWeight: isQualifying ? 600 : 400 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                {item.name}
                                {isQualifying && <span style={{ fontSize: '0.7rem', background: 'rgba(52, 211, 153, 0.2)', color: '#34d399', padding: '2px 6px', borderRadius: '8px', fontWeight: 700 }}>SF 🇮🇩</span>}
                              </div>
                            </td>
                            <td style={{ padding: '0.75rem', textAlign: 'center' }}>{item.played}</td>
                            <td style={{ padding: '0.75rem', textAlign: 'center', color: '#34d399' }}>{item.won}</td>
                            <td style={{ padding: '0.75rem', textAlign: 'center', color: '#ef4444' }}>{item.lost}</td>
                            <td style={{ padding: '0.75rem', textAlign: 'center', color: 'gray' }}>{item.gamesWon}-{item.gamesLost}</td>
                            <td style={{ padding: '0.75rem', textAlign: 'center', fontWeight: 600, color: item.diff >= 0 ? '#34d399' : '#ef4444' }}>
                              {item.diff > 0 ? `+${item.diff}` : item.diff}
                            </td>
                            <td style={{ padding: '0.75rem', textAlign: 'center', fontWeight: 800, color: '#ef4444', fontSize: '1.05rem' }}>{item.points}</td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Group B Standings */}
            <div>
              <h3 style={{ color: 'white', fontSize: '1.25rem', marginBottom: '0.75rem', display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '0.5rem' }}>
                <span>KLASEMEN GRUP B</span>
                <span style={{ color: '#ef4444', fontSize: '0.9rem' }}>Top 2 Lolos Semifinal</span>
              </h3>
              
              {standingsB.length === 0 ? (
                <p style={{ color: 'var(--color-text-light)', fontStyle: 'italic', fontSize: '0.9rem' }}>Belum ada tim terdaftar di Grup B.</p>
              ) : (
                <div style={{ overflowX: 'auto', background: 'rgba(255,255,255,0.03)', borderRadius: 'var(--radius-md)', border: '1px solid rgba(255,255,255,0.1)' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', color: 'white', minWidth: '600px' }}>
                    <thead>
                      <tr style={{ background: 'rgba(0,0,0,0.3)', textAlign: 'left' }}>
                        <th style={{ padding: '0.75rem', textAlign: 'center', width: '60px' }}>Rank</th>
                        <th style={{ padding: '0.75rem' }}>Nama Tim</th>
                        <th style={{ padding: '0.75rem', textAlign: 'center', width: '80px' }}>Main</th>
                        <th style={{ padding: '0.75rem', textAlign: 'center', width: '80px' }}>Menang</th>
                        <th style={{ padding: '0.75rem', textAlign: 'center', width: '80px' }}>Kalah</th>
                        <th style={{ padding: '0.75rem', textAlign: 'center', width: '100px' }}>Skor Game</th>
                        <th style={{ padding: '0.75rem', textAlign: 'center', width: '80px' }}>Selisih</th>
                        <th style={{ padding: '0.75rem', textAlign: 'center', width: '80px' }}>Poin</th>
                      </tr>
                    </thead>
                    <tbody>
                      {standingsB.map((item, index) => {
                        const isQualifying = index < 2;
                        return (
                          <tr key={item.pairId} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', background: isQualifying ? 'rgba(52, 211, 153, 0.05)' : 'transparent' }}>
                            <td style={{ padding: '0.75rem', textAlign: 'center', fontWeight: 700, color: isQualifying ? '#34d399' : 'gray' }}>
                              #{index + 1}
                            </td>
                            <td style={{ padding: '0.75rem', fontWeight: isQualifying ? 600 : 400 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                {item.name}
                                {isQualifying && <span style={{ fontSize: '0.7rem', background: 'rgba(52, 211, 153, 0.2)', color: '#34d399', padding: '2px 6px', borderRadius: '8px', fontWeight: 700 }}>SF 🇮🇩</span>}
                              </div>
                            </td>
                            <td style={{ padding: '0.75rem', textAlign: 'center' }}>{item.played}</td>
                            <td style={{ padding: '0.75rem', textAlign: 'center', color: '#34d399' }}>{item.won}</td>
                            <td style={{ padding: '0.75rem', textAlign: 'center', color: '#ef4444' }}>{item.lost}</td>
                            <td style={{ padding: '0.75rem', textAlign: 'center', color: 'gray' }}>{item.gamesWon}-{item.gamesLost}</td>
                            <td style={{ padding: '0.75rem', textAlign: 'center', fontWeight: 600, color: item.diff >= 0 ? '#34d399' : '#ef4444' }}>
                              {item.diff > 0 ? `+${item.diff}` : item.diff}
                            </td>
                            <td style={{ padding: '0.75rem', textAlign: 'center', fontWeight: 800, color: '#ef4444', fontSize: '1.05rem' }}>{item.points}</td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* SUBTAB 4: FASE GUGUR */}
        {activeTab === 'knockout' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
            {/* Generate Knockouts header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ color: 'white', margin: 0, fontSize: '1.25rem' }}>Bagan Putaran Gugur</h3>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button onClick={generateKnockoutBrackets} className="btn" style={{ background: '#ef4444', color: 'white', fontSize: '0.85rem' }}>
                  <Sparkles size={16} /> Buat Bagan Semi Final
                </button>
                <button onClick={generateFinalBracket} className="btn" style={{ background: 'white', color: '#0f172a', fontSize: '0.85rem' }}>
                  <Award size={16} /> Buat Bagan Final
                </button>
              </div>
            </div>

            {/* Bracket display */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '2rem' }}>
              
              {/* Semi Finals Column */}
              <div>
                <h4 style={{ color: 'white', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '0.5rem', marginBottom: '1rem' }}>
                  Semi Final
                </h4>
                {displaySFMatches.length === 0 ? (
                  <p style={{ color: 'var(--color-text-light)', fontStyle: 'italic', fontSize: '0.9rem' }}>Bagan Semi Final belum dibuat.</p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    {displaySFMatches.map((m, idx) => {
                      const isOngoing = m.status === 'ongoing';
                      const isCompleted = m.status === 'completed';
                      return (
                        <div key={m.id} style={{ background: 'rgba(255,255,255,0.03)', padding: '1rem', borderRadius: 'var(--radius-md)', border: `1px solid ${isOngoing ? '#ef4444' : 'rgba(255,255,255,0.1)'}` }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: '#ef4444', fontWeight: 700, marginBottom: '0.5rem' }}>
                            <span>SEMI FINAL {idx + 1}</span>
                            <span>{m.status === 'scheduled' ? 'Menunggu' : isOngoing ? 'SEDANG MAIN' : 'Selesai'}</span>
                          </div>
                          
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: isCompleted ? 'gray' : 'white' }}>
                            <div style={{ flex: 1, textAlign: 'right', fontWeight: m.winner_team === 1 ? 700 : 400, color: m.winner_team === 1 ? '#ef4444' : 'inherit' }}>
                              {getPlayerName(m.team1_player1_id)}<br/>
                              {getPlayerName(m.team1_player2_id)}
                            </div>
                            <div style={{ padding: '0 1rem', fontSize: '1.2rem', fontWeight: 700 }}>
                              {isCompleted ? `${m.team1_score} - ${m.team2_score}` : 'VS'}
                            </div>
                            <div style={{ flex: 1, textAlign: 'left', fontWeight: m.winner_team === 2 ? 700 : 400, color: m.winner_team === 2 ? '#ef4444' : 'inherit' }}>
                              {getPlayerName(m.team2_player1_id)}<br/>
                              {getPlayerName(m.team2_player2_id)}
                            </div>
                          </div>

                          {/* Scores Input for ongoing */}
                          {isOngoing && (
                            <div className="mt-3 flex flex-col gap-3 border-t border-[rgba(255,255,255,0.1)] pt-3">
                              <span style={{ fontSize: '0.8rem', color: 'var(--color-text-light)', textAlign: 'center', display: 'block' }}>Pilih Pemenang Langsung:</span>
                              <div className="flex gap-2 justify-center">
                                <button 
                                  onClick={() => quickCompleteMatch(m.id, 1)} 
                                  className="btn" 
                                  style={{ padding: '0.5rem 1rem', fontSize: '0.8rem', background: '#ef4444', color: 'white', flex: 1 }}
                                >
                                  🏆 Tim 1 Menang
                                </button>
                                <button 
                                  onClick={() => quickCompleteMatch(m.id, 2)} 
                                  className="btn" 
                                  style={{ padding: '0.5rem 1rem', fontSize: '0.8rem', background: '#ef4444', color: 'white', flex: 1 }}
                                >
                                  🏆 Tim 2 Menang
                                </button>
                              </div>
                              <div style={{ textAlign: 'center', color: 'gray', fontSize: '0.7rem' }}>— ATAU INPUT SKOR GAME —</div>
                              <div className="flex gap-2 items-center justify-center">
                                <input 
                                  type="number" 
                                  placeholder="0"
                                  value={scoresInput[m.id]?.s1 || ''}
                                  onChange={(e) => setScoresInput(prev => ({ ...prev, [m.id]: { ...prev[m.id], s1: e.target.value } }))}
                                  style={{ width: '60px', padding: '0.5rem', textAlign: 'center', borderRadius: '4px', border: 'none', color: '#0f172a', fontWeight: 700 }}
                                />
                                <span style={{ color: 'white' }}>-</span>
                                <input 
                                  type="number" 
                                  placeholder="0"
                                  value={scoresInput[m.id]?.s2 || ''}
                                  onChange={(e) => setScoresInput(prev => ({ ...prev, [m.id]: { ...prev[m.id], s2: e.target.value } }))}
                                  style={{ width: '60px', padding: '0.5rem', textAlign: 'center', borderRadius: '4px', border: 'none', color: '#0f172a', fontWeight: 700 }}
                                />
                                <button onClick={() => completeMatch(m.id)} className="btn" style={{ padding: '0.5rem 1rem', fontSize: '0.85rem', marginLeft: '0.5rem', background: 'white', color: '#0f172a' }}>
                                  Simpan
                                </button>
                              </div>
                            </div>
                          )}

                          {m.status === 'scheduled' && (
                            <button onClick={() => setOngoing(m.id)} className="btn mt-3" style={{ width: '100%', padding: '0.5rem', background: 'white', color: '#0f172a' }}>
                              Mulai Pertandingan
                            </button>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>

              {/* Final Column */}
              <div>
                <h4 style={{ color: 'white', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '0.5rem', marginBottom: '1rem' }}>
                  Final
                </h4>
                {displayFinalMatch.length === 0 ? (
                  <p style={{ color: 'var(--color-text-light)', fontStyle: 'italic', fontSize: '0.9rem' }}>Bagan Final belum dibuat.</p>
                ) : (
                  displayFinalMatch.map(m => {
                    const isOngoing = m.status === 'ongoing';
                    const isCompleted = m.status === 'completed';
                    return (
                      <div key={m.id} style={{ 
                        background: 'linear-gradient(135deg, rgba(239, 68, 68, 0.15) 0%, rgba(255, 255, 255, 0.03) 100%)', 
                        padding: '1.5rem', borderRadius: 'var(--radius-md)', 
                        border: `2px solid ${isOngoing ? '#ef4444' : 'rgba(255,255,255,0.2)'}`,
                        boxShadow: isCompleted ? '0 10px 15px -3px rgba(239, 68, 68, 0.2)' : 'none'
                      }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem', color: '#ef4444', fontWeight: 800, marginBottom: '1rem' }}>
                          <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                            <Award size={18} /> PEREBUTAN JUARA 🇮🇩
                          </span>
                          <span>{m.status === 'scheduled' ? 'Menunggu' : isOngoing ? 'SEDANG MAIN' : 'Selesai'}</span>
                        </div>
                        
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: isCompleted ? 'gray' : 'white', marginBottom: '1rem' }}>
                          <div style={{ flex: 1, textAlign: 'right', fontWeight: m.winner_team === 1 ? 800 : 400, color: m.winner_team === 1 ? '#ef4444' : 'inherit', fontSize: '1.1rem' }}>
                            {getPlayerName(m.team1_player1_id)}<br/>
                            {getPlayerName(m.team1_player2_id)}
                          </div>
                          <div style={{ padding: '0 1.5rem', fontSize: '1.5rem', fontWeight: 800 }}>
                            {isCompleted ? `${m.team1_score} - ${m.team2_score}` : 'VS'}
                          </div>
                          <div style={{ flex: 1, textAlign: 'left', fontWeight: m.winner_team === 2 ? 800 : 400, color: m.winner_team === 2 ? '#ef4444' : 'inherit', fontSize: '1.1rem' }}>
                            {getPlayerName(m.team2_player1_id)}<br/>
                            {getPlayerName(m.team2_player2_id)}
                          </div>
                        </div>

                        {/* Winner presentation */}
                        {isCompleted && (
                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.25rem', background: 'rgba(239, 68, 68, 0.1)', padding: '1rem', borderRadius: '8px', border: '1px solid rgba(239, 68, 68, 0.2)', marginTop: '1rem' }}>
                            <Trophy size={32} color="gold" style={{ filter: 'drop-shadow(0 4px 6px rgba(0,0,0,0.3))' }} />
                            <span style={{ color: 'white', fontWeight: 700, fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '1px' }}>Juara Turnamen 17 Agustus</span>
                            <span style={{ color: 'var(--color-secondary)', fontWeight: 800, fontSize: '1.25rem', textAlign: 'center' }}>
                              {m.winner_team === 1 
                                ? `${getPlayerName(m.team1_player1_id)} & ${getPlayerName(m.team1_player2_id)}`
                                : `${getPlayerName(m.team2_player1_id)} & ${getPlayerName(m.team2_player2_id)}`
                              }
                            </span>
                          </div>
                        )}

                        {/* Scores Input for final */}
                        {isOngoing && (
                          <div className="mt-3 flex flex-col gap-3 border-t border-[rgba(255,255,255,0.1)] pt-3">
                            <span style={{ fontSize: '0.8rem', color: 'var(--color-text-light)', textAlign: 'center', display: 'block' }}>Pilih Pemenang Langsung:</span>
                            <div className="flex gap-2 justify-center">
                              <button 
                                onClick={() => quickCompleteMatch(m.id, 1)} 
                                className="btn" 
                                style={{ padding: '0.5rem 1rem', fontSize: '0.8rem', background: '#ef4444', color: 'white', flex: 1 }}
                              >
                                🏆 Tim 1 Menang
                              </button>
                              <button 
                                onClick={() => quickCompleteMatch(m.id, 2)} 
                                className="btn" 
                                style={{ padding: '0.5rem 1rem', fontSize: '0.8rem', background: '#ef4444', color: 'white', flex: 1 }}
                              >
                                🏆 Tim 2 Menang
                              </button>
                            </div>
                            <div style={{ textAlign: 'center', color: 'gray', fontSize: '0.7rem' }}>— ATAU INPUT SKOR GAME —</div>
                            <div className="flex gap-2 items-center justify-center">
                              <input 
                                type="number" 
                                placeholder="0"
                                value={scoresInput[m.id]?.s1 || ''}
                                onChange={(e) => setScoresInput(prev => ({ ...prev, [m.id]: { ...prev[m.id], s1: e.target.value } }))}
                                style={{ width: '60px', padding: '0.5rem', textAlign: 'center', borderRadius: '4px', border: 'none', color: '#0f172a', fontWeight: 700 }}
                              />
                              <span style={{ color: 'white' }}>-</span>
                              <input 
                                type="number" 
                                placeholder="0"
                                value={scoresInput[m.id]?.s2 || ''}
                                onChange={(e) => setScoresInput(prev => ({ ...prev, [m.id]: { ...prev[m.id], s2: e.target.value } }))}
                                style={{ width: '60px', padding: '0.5rem', textAlign: 'center', borderRadius: '4px', border: 'none', color: '#0f172a', fontWeight: 700 }}
                              />
                              <button onClick={() => completeMatch(m.id)} className="btn" style={{ padding: '0.5rem 1rem', fontSize: '0.85rem', marginLeft: '0.5rem', background: 'white', color: '#0f172a' }}>
                                Simpan
                              </button>
                            </div>
                          </div>
                        )}

                        {m.status === 'scheduled' && (
                          <button onClick={() => setOngoing(m.id)} className="btn mt-3" style={{ width: '100%', padding: '0.5rem', background: '#ef4444', color: 'white' }}>
                            Mulai Final Kemerdekaan
                          </button>
                        )}
                      </div>
                    )
                  })
                )}
              </div>

            </div>

          </div>
        )}

      </div>
    </div>
  )
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
