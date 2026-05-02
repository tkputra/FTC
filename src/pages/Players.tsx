import React, { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { Trash2, UserPlus } from 'lucide-react'

type Player = {
  id: string;
  name: string;
}

export default function Players() {
  const [players, setPlayers] = useState<Player[]>([])
  const [newPlayerName, setNewPlayerName] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchPlayers()
  }, [])

  async function fetchPlayers() {
    setLoading(true)
    const { data, error } = await supabase
      .from('players')
      .select('*')
      .order('name', { ascending: true })
    
    if (error) {
      console.error('Error fetching players:', error)
    } else {
      setPlayers(data || [])
    }
    setLoading(false)
  }

  async function addPlayer(e: React.FormEvent) {
    e.preventDefault()
    if (!newPlayerName.trim()) return

    const { error } = await supabase
      .from('players')
      .insert([{ name: newPlayerName.trim() }])

    if (error) {
      alert('Gagal menambah pemain: ' + error.message)
    } else {
      setNewPlayerName('')
      fetchPlayers()
    }
  }

  async function deletePlayer(id: string) {
    if (!confirm('Hapus pemain ini dari database? (Pastikan pemain ini tidak sedang ada di jadwal aktif)')) return

    const { error } = await supabase
      .from('players')
      .delete()
      .eq('id', id)

    if (error) {
      alert('Gagal menghapus pemain: ' + error.message)
    } else {
      fetchPlayers()
    }
  }

  return (
    <div className="flex flex-col gap-6 mt-4">
      <div className="glass-panel">
        <h2 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <UserPlus size={24} />
          Manajemen Pemain
        </h2>
        <p style={{ color: 'var(--color-text-light)', marginBottom: '1.5rem' }}>
          Kelola daftar anggota Fortune Tennis Club. Siapa saja dapat menambahkan atau menghapus pemain di sini.
        </p>

        <form onSubmit={addPlayer} className="flex gap-2 mb-6" style={{ width: '100%' }}>
          <input 
            type="text" 
            className="input-field" 
            placeholder="Masukkan Nama Pemain Baru..." 
            value={newPlayerName}
            onChange={(e) => setNewPlayerName(e.target.value)}
          />
          <button type="submit" className="btn" disabled={!newPlayerName.trim()} style={{ whiteSpace: 'nowrap' }}>
            Tambah
          </button>
        </form>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '2rem 0', color: 'var(--color-text-light)' }}>
            <p>Memuat data pemain...</p>
          </div>
        ) : (
          <div style={{ display: 'grid', gap: '0.5rem' }}>
            {players.map(p => (
              <div 
                key={p.id} 
                style={{ 
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '1rem', background: 'rgba(255,255,255,0.05)', borderRadius: 'var(--radius-sm)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  boxShadow: '0 1px 2px rgba(0,0,0,0.2)'
                }}
              >
                <span style={{ fontWeight: 600, fontSize: '1.1rem', color: 'white' }}>{p.name}</span>
                <button 
                  onClick={() => deletePlayer(p.id)}
                  style={{ 
                    background: 'transparent', border: 'none', color: '#ef4444', 
                    cursor: 'pointer', padding: '0.5rem', display: 'flex', alignItems: 'center',
                    borderRadius: '50%', transition: 'background 0.2s'
                  }}
                  onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#fee2e2'}
                  onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                  title="Hapus Pemain"
                >
                  <Trash2 size={20} />
                </button>
              </div>
            ))}
            {players.length === 0 && (
              <div style={{ textAlign: 'center', padding: '3rem 1rem', border: '2px dashed var(--color-border)', borderRadius: 'var(--radius-md)' }}>
                <p style={{ color: 'var(--color-text-light)', margin: 0 }}>Belum ada pemain yang terdaftar di database.</p>
                <p style={{ color: 'var(--color-text-light)', margin: '0.5rem 0 0 0', fontSize: '0.875rem' }}>Silakan tambahkan nama pemain pada kolom di atas.</p>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="glass-panel mt-4" style={{ border: '1px solid #ef4444' }}>
        <h2 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#ef4444', margin: 0 }}>
          <Trash2 size={24} />
          Danger Zone (Zona Bahaya)
        </h2>
        <p style={{ color: 'var(--color-text-light)', marginTop: '0.5rem', marginBottom: '1.5rem', fontSize: '0.9rem' }}>
          Gunakan fitur di bawah ini jika Anda ingin melakukan reset data, misalnya ketika berganti musim kompetisi atau ingin membersihkan data tes sebelum produksi.
        </p>

        <button 
          onClick={async () => {
            if (confirm("PERINGATAN KERAS!\n\nApakah Anda yakin ingin MENGHAPUS SEMUA JADWAL PERTANDINGAN beserta SKOR KLASEMEN?\n\nAksi ini tidak dapat dibatalkan!")) {
              const { error } = await supabase.from('matches').delete().neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all
              if (error) alert("Gagal mereset jadwal: " + error.message);
              else alert("Berhasil! Semua jadwal pertandingan dan poin klasemen telah dihapus.");
            }
          }}
          className="btn"
          style={{ width: '100%', background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', border: '1px solid #ef4444' }}
        >
          Reset Semua Jadwal & Klasemen
        </button>
      </div>
    </div>
  )
}
