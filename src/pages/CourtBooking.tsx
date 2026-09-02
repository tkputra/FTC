import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Calendar, Clock, Mail, CheckCircle2, RefreshCw, ExternalLink, Settings, ShieldCheck, User, Users, Plus, Edit2, Trash2, Check, Sparkles, Phone, MapPin } from 'lucide-react';

interface BookingAccount {
  id?: string;
  first_name: string;
  last_name: string;
  email_prefix: string;
  email_domain: string;
  current_email_index: number;
  address: string;
  phone: string;
  is_active: boolean;
  total_bookings: number;
  last_booked_at?: string | null;
  created_at?: string;
}

interface MasterSettings {
  id?: number;
  target_hours: string[];
  target_days: string[];
  is_active: boolean;
  last_check_at?: string;
  last_check_status?: string;
  last_check_message?: string;
}

interface BookedCourt {
  id: string;
  booking_date: string;
  booking_time: string;
  day_name?: string;
  booked_email: string;
  first_name?: string;
  last_name?: string;
  phone?: string;
  status: string;
  notes?: string;
  created_at: string;
}

const GOOGLE_CALENDAR_URL = 'https://calendar.app.google/iueH4Lnt6qsCgVmZ6';

export default function CourtBooking() {
  const [settings, setSettings] = useState<MasterSettings>({
    target_hours: ['6:00am', '7:00am', '8:00am', '9:00am', '4:00pm', '5:00pm', '6:00pm', '7:00pm'],
    target_days: ['Mon', 'Tue', 'Wed', 'Thu'],
    is_active: true,
    last_check_message: 'Sistem siap memantau jadwal'
  });

  const [accounts, setAccounts] = useState<BookingAccount[]>([]);
  const [bookedCourts, setBookedCourts] = useState<BookedCourt[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'bookings' | 'accounts' | 'settings'>('bookings');

  // Modal State for Add/Edit Member Account
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'add' | 'edit'>('add');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [accountFormData, setAccountFormData] = useState<BookingAccount>({
    first_name: '',
    last_name: '',
    email_prefix: '',
    email_domain: 'gmail.com',
    current_email_index: 1,
    address: 'Fortune spring Blok ',
    phone: '08',
    is_active: true,
    total_bookings: 0
  });
  const [isSavingAccount, setIsSavingAccount] = useState(false);

  // Master Settings Form State
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    setIsLoading(true);
    try {
      // 1. Fetch Master Settings
      const { data: settingsData } = await supabase
        .from('court_booking_settings')
        .select('*')
        .eq('id', 1)
        .single();

      if (settingsData) {
        setSettings(settingsData);
      }

      // 2. Fetch Team Booking Accounts
      const { data: accountsData } = await supabase
        .from('booking_accounts')
        .select('*')
        .order('created_at', { ascending: true });

      if (accountsData) {
        setAccounts(accountsData);
      }

      // 3. Fetch Booked Courts History
      const { data: courtsData } = await supabase
        .from('booked_courts')
        .select('*')
        .order('created_at', { ascending: false });

      if (courtsData) {
        setBookedCourts(courtsData);
      }
    } catch (err) {
      console.error('Error loading court booking data:', err);
    } finally {
      setIsLoading(false);
    }
  }

  // Identify next account in line for round-robin rotation
  const activeAccounts = accounts.filter(a => a.is_active);
  const nextInLineAccount = [...activeAccounts].sort((a, b) => {
    if (!a.last_booked_at) return -1;
    if (!b.last_booked_at) return 1;
    return new Date(a.last_booked_at).getTime() - new Date(b.last_booked_at).getTime();
  })[0];

  // Open Modal to Add
  function handleOpenAddModal() {
    setModalMode('add');
    setEditingId(null);
    setAccountFormData({
      first_name: '',
      last_name: '',
      email_prefix: '',
      email_domain: 'gmail.com',
      current_email_index: 1,
      address: 'Fortune spring Blok ',
      phone: '08',
      is_active: true,
      total_bookings: 0
    });
    setIsModalOpen(true);
  }

  // Open Modal to Edit
  function handleOpenEditModal(acc: BookingAccount) {
    setModalMode('edit');
    setEditingId(acc.id || null);
    setAccountFormData({ ...acc });
    setIsModalOpen(true);
  }

  // Toggle Account Active Status
  async function handleToggleAccountActive(id?: string, currentStatus?: boolean) {
    if (!id) return;
    try {
      const newStatus = !currentStatus;
      const { error } = await supabase
        .from('booking_accounts')
        .update({ is_active: newStatus })
        .eq('id', id);

      if (!error) {
        setAccounts(prev => prev.map(a => a.id === id ? { ...a, is_active: newStatus } : a));
      }
    } catch (err) {
      console.error('Error toggling account status:', err);
    }
  }

  // Delete Account
  async function handleDeleteAccount(id?: string, name?: string) {
    if (!id) return;
    if (!window.confirm(`Yakin ingin menghapus profil pemesan "${name}"?`)) return;

    try {
      const { error } = await supabase
        .from('booking_accounts')
        .delete()
        .eq('id', id);

      if (!error) {
        setAccounts(prev => prev.filter(a => a.id !== id));
      }
    } catch (err) {
      console.error('Error deleting account:', err);
    }
  }

  // Save Account (Add or Edit)
  async function handleSaveAccount(e: React.FormEvent) {
    e.preventDefault();
    setIsSavingAccount(true);
    try {
      if (modalMode === 'add') {
        const { data, error } = await supabase
          .from('booking_accounts')
          .insert([{
            first_name: accountFormData.first_name.trim(),
            last_name: accountFormData.last_name.trim(),
            email_prefix: accountFormData.email_prefix.trim().toLowerCase(),
            email_domain: accountFormData.email_domain.trim().toLowerCase() || 'gmail.com',
            current_email_index: accountFormData.current_email_index || 1,
            address: accountFormData.address.trim(),
            phone: accountFormData.phone.trim(),
            is_active: accountFormData.is_active ?? true,
            total_bookings: 0,
            last_booked_at: null
          }])
          .select()
          .single();

        if (!error && data) {
          setAccounts(prev => [...prev, data]);
          setIsModalOpen(false);
        }
      } else if (modalMode === 'edit' && editingId) {
        const { data, error } = await supabase
          .from('booking_accounts')
          .update({
            first_name: accountFormData.first_name.trim(),
            last_name: accountFormData.last_name.trim(),
            email_prefix: accountFormData.email_prefix.trim().toLowerCase(),
            email_domain: accountFormData.email_domain.trim().toLowerCase() || 'gmail.com',
            current_email_index: accountFormData.current_email_index || 1,
            address: accountFormData.address.trim(),
            phone: accountFormData.phone.trim(),
            is_active: accountFormData.is_active
          })
          .eq('id', editingId)
          .select()
          .single();

        if (!error && data) {
          setAccounts(prev => prev.map(a => a.id === editingId ? data : a));
          setIsModalOpen(false);
        }
      }
    } catch (err) {
      console.error('Error saving account:', err);
    } finally {
      setIsSavingAccount(false);
    }
  }

  // Save Master Settings
  async function handleSaveMasterSettings(e: React.FormEvent) {
    e.preventDefault();
    setIsSavingSettings(true);
    setSaveSuccess(false);
    try {
      const { error } = await supabase
        .from('court_booking_settings')
        .update({
          is_active: settings.is_active,
          updated_at: new Date().toISOString()
        })
        .eq('id', 1);

      if (!error) {
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 3000);
      }
    } catch (err) {
      console.error('Error saving master settings:', err);
    } finally {
      setIsSavingSettings(false);
    }
  }

  return (
    <div className="container" style={{ paddingBottom: '5rem', maxWidth: '1000px', margin: '0 auto' }}>
      
      {/* Header Banner */}
      <div className="card" style={{ 
        background: 'linear-gradient(135deg, rgba(15, 23, 42, 0.95), rgba(30, 41, 59, 0.95))',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        marginBottom: '1.5rem',
        padding: '1.5rem'
      }}>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span style={{ fontSize: '1.5rem' }}>🎾</span>
              <h2 style={{ margin: 0, color: 'white', fontSize: '1.4rem', fontWeight: 800 }}>
                Otomatisasi Booking Lapangan
              </h2>
            </div>
            <p style={{ margin: 0, color: 'var(--color-text-light)', fontSize: '0.9rem' }}>
              Bot pemantau & pemesan jadwal Google Calendar Tennis at Fortune (Senin s/d Kamis).
            </p>
          </div>

          <div className="flex items-center gap-2">
            <a 
              href={GOOGLE_CALENDAR_URL} 
              target="_blank" 
              rel="noopener noreferrer" 
              className="btn"
              style={{ background: 'rgba(255,255,255,0.1)', color: 'white', padding: '0.5rem 0.9rem', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              <ExternalLink size={16} /> Buka Google Calendar
            </a>
            <button 
              onClick={fetchData} 
              className="btn"
              style={{ background: 'var(--color-secondary)', color: '#0f172a', padding: '0.5rem 0.9rem', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 600 }}
            >
              <RefreshCw size={16} className={isLoading ? 'animate-spin' : ''} /> Refresh
            </button>
          </div>
        </div>

        {/* Live Status Summary Cards (Top Row: 3 Columns) */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem', marginTop: '1.5rem' }}>
          
          {/* 1. Status Box */}
          <div style={{ background: 'rgba(255,255,255,0.05)', padding: '1rem', borderRadius: 'var(--radius-md)', border: '1px solid rgba(255,255,255,0.1)', minWidth: 0 }}>
            <div className="flex items-center justify-between mb-2">
              <span style={{ fontSize: '0.8rem', color: 'var(--color-text-light)', fontWeight: 600, textTransform: 'uppercase' }}>Status Auto-Bot</span>
              <span style={{ 
                fontSize: '0.75rem', 
                fontWeight: 700, 
                padding: '2px 8px', 
                borderRadius: '12px',
                background: settings.is_active ? 'rgba(52, 211, 153, 0.2)' : 'rgba(239, 68, 68, 0.2)',
                color: settings.is_active ? '#34d399' : '#ef4444'
              }}>
                {settings.is_active ? 'AKTIF (ON)' : 'NONAKTIF (OFF)'}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <ShieldCheck size={16} color={settings.is_active ? '#34d399' : '#ef4444'} />
              <span style={{ color: 'white', fontSize: '0.85rem' }}>
                {settings.is_active ? 'Memantau per 10 menit' : 'Pengecekan dijeda'}
              </span>
            </div>
          </div>

          {/* 2. Next in Line Person Box */}
          <div style={{ background: 'rgba(255,255,255,0.05)', padding: '1rem', borderRadius: 'var(--radius-md)', border: '1px solid rgba(255,255,255,0.1)', minWidth: 0 }}>
            <div className="flex items-center justify-between mb-2">
              <span style={{ fontSize: '0.8rem', color: 'var(--color-text-light)', fontWeight: 600, textTransform: 'uppercase' }}>Giliran Pemesan</span>
              {nextInLineAccount && (
                <span style={{ fontSize: '0.75rem', color: '#38bdf8', fontWeight: 700, background: 'rgba(56, 189, 248, 0.15)', padding: '2px 8px', borderRadius: '12px' }}>
                  Index +{nextInLineAccount.current_email_index || 1}
                </span>
              )}
            </div>
            {nextInLineAccount ? (
              <div style={{ color: 'white', fontSize: '0.85rem' }}>
                <div style={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <User size={15} color="#38bdf8" /> {nextInLineAccount.first_name} {nextInLineAccount.last_name}
                </div>
                <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={`${nextInLineAccount.email_prefix}+${nextInLineAccount.current_email_index}@${nextInLineAccount.email_domain}`}>
                  {nextInLineAccount.email_prefix}+{nextInLineAccount.current_email_index}@{nextInLineAccount.email_domain}
                </div>
              </div>
            ) : (
              <span style={{ color: '#94a3b8', fontSize: '0.85rem' }}>Belum ada anggota tim aktif</span>
            )}
          </div>

          {/* 3. Target Jam Box */}
          <div style={{ background: 'rgba(255,255,255,0.05)', padding: '1rem', borderRadius: 'var(--radius-md)', border: '1px solid rgba(255,255,255,0.1)', minWidth: 0 }}>
            <div className="flex items-center justify-between mb-2">
              <span style={{ fontSize: '0.8rem', color: 'var(--color-text-light)', fontWeight: 600, textTransform: 'uppercase' }}>Target Jam</span>
              <span style={{ fontSize: '0.75rem', color: '#facc15', fontWeight: 700, background: 'rgba(250, 204, 21, 0.15)', padding: '2px 8px', borderRadius: '12px' }}>
                8 Slot (Sen-Kam)
              </span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexWrap: 'wrap' }}>
                <span style={{ fontSize: '0.7rem', color: '#34d399', fontWeight: 800, width: '32px' }}>Pagi:</span>
                {['06:00', '07:00', '08:00', '09:00'].map(h => (
                  <span key={h} style={{ fontSize: '0.7rem', fontWeight: 700, padding: '1px 5px', borderRadius: '4px', background: 'rgba(52, 211, 153, 0.15)', color: '#34d399' }}>
                    {h}
                  </span>
                ))}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexWrap: 'wrap' }}>
                <span style={{ fontSize: '0.7rem', color: '#f97316', fontWeight: 800, width: '32px' }}>Sore:</span>
                {['16:00', '17:00', '18:00', '19:00'].map(h => (
                  <span key={h} style={{ fontSize: '0.7rem', fontWeight: 700, padding: '1px 5px', borderRadius: '4px', background: 'rgba(249, 115, 22, 0.15)', color: '#f97316' }}>
                    {h}
                  </span>
                ))}
              </div>
            </div>
          </div>

        </div>

        {/* Full Width Bottom Banner: Pengecekan Terakhir */}
        <div style={{ 
          background: 'rgba(255,255,255,0.04)', 
          padding: '0.9rem 1.25rem', 
          borderRadius: 'var(--radius-md)', 
          border: '1px solid rgba(255,255,255,0.08)',
          marginTop: '0.85rem'
        }}>
          <div className="flex items-center justify-between mb-1.5">
            <div className="flex items-center gap-2">
              <Clock size={15} color="var(--color-secondary)" />
              <span style={{ fontSize: '0.8rem', color: 'var(--color-text-light)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Pengecekan Terakhir Bot
              </span>
            </div>
            <span style={{ fontSize: '0.75rem', color: '#94a3b8', background: 'rgba(255,255,255,0.06)', padding: '2px 8px', borderRadius: '10px' }}>
              {settings.last_check_at ? new Date(settings.last_check_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) + ' WIB' : 'Belum dicek'}
            </span>
          </div>
          <p style={{ margin: 0, color: 'white', fontSize: '0.85rem', lineHeight: '1.45', wordBreak: 'break-word' }}>
            {settings.last_check_message || 'Sistem siap memantau jadwal'}
          </p>
        </div>
      </div>

      {/* Navigation Sub-Tabs */}
      <div className="flex bg-[rgba(255,255,255,0.1)] p-1 rounded-[var(--radius-md)] border border-[rgba(255,255,255,0.1)] mb-6">
        <button 
          onClick={() => setActiveTab('bookings')}
          style={{
            flex: 1, padding: '0.75rem', borderRadius: 'calc(var(--radius-md) - 4px)', border: 'none',
            background: activeTab === 'bookings' ? 'var(--color-primary)' : 'transparent',
            color: activeTab === 'bookings' ? 'white' : 'var(--color-text-light)',
            fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px'
          }}
        >
          <Calendar size={18} />
          Riwayat Booking ({bookedCourts.length})
        </button>

        <button 
          onClick={() => setActiveTab('accounts')}
          style={{
            flex: 1, padding: '0.75rem', borderRadius: 'calc(var(--radius-md) - 4px)', border: 'none',
            background: activeTab === 'accounts' ? 'var(--color-primary)' : 'transparent',
            color: activeTab === 'accounts' ? 'white' : 'var(--color-text-light)',
            fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px'
          }}
        >
          <Users size={18} />
          Tim Pemesan ({accounts.length})
        </button>

        <button 
          onClick={() => setActiveTab('settings')}
          style={{
            flex: 1, padding: '0.75rem', borderRadius: 'calc(var(--radius-md) - 4px)', border: 'none',
            background: activeTab === 'settings' ? 'var(--color-primary)' : 'transparent',
            color: activeTab === 'settings' ? 'white' : 'var(--color-text-light)',
            fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px'
          }}
        >
          <Settings size={18} />
          Pengaturan Bot
        </button>
      </div>

      {/* TAB 1: RIWAYAT BOOKING */}
      {activeTab === 'bookings' && (
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 style={{ margin: 0, color: 'white', fontSize: '1.1rem', fontWeight: 700 }}>
                📋 Daftar Lapangan Berhasil Terbooking
              </h3>
              <p style={{ margin: '4px 0 0', color: 'var(--color-text-light)', fontSize: '0.85rem' }}>
                Jadwal yang berhasil didapatkan secara otomatis oleh bot.
              </p>
            </div>
            <span style={{ fontSize: '0.85rem', color: '#34d399', background: 'rgba(52, 211, 153, 0.1)', padding: '4px 12px', borderRadius: '16px', fontWeight: 600 }}>
              {bookedCourts.length} Terkonfirmasi
            </span>
          </div>

          {bookedCourts.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--color-text-light)' }}>
              <Clock size={40} style={{ margin: '0 auto 1rem', opacity: 0.4 }} />
              <p style={{ fontSize: '1rem', fontWeight: 600, margin: '0 0 4px' }}>Belum ada riwayat booking</p>
              <p style={{ fontSize: '0.85rem', margin: 0 }}>Bot akan otomatis mencatat jadwal di sini begitu slot target berhasil dibooking.</p>
            </div>
          ) : (
            <div style={{ display: 'grid', gap: '1rem' }}>
              {bookedCourts.map((court) => (
                <div 
                  key={court.id} 
                  style={{ 
                    background: 'rgba(255,255,255,0.03)', 
                    border: '1px solid rgba(255,255,255,0.1)', 
                    borderRadius: 'var(--radius-md)', 
                    padding: '1.25rem',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.75rem'
                  }}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="flex items-center gap-3">
                      <div style={{ 
                        background: 'rgba(52, 211, 153, 0.15)', 
                        color: '#34d399', 
                        padding: '10px 14px', 
                        borderRadius: 'var(--radius-sm)', 
                        textAlign: 'center',
                        fontWeight: 800,
                        fontSize: '0.9rem',
                        lineHeight: 1.2
                      }}>
                        <div>{court.day_name || 'SEN'}</div>
                      </div>
                      <div>
                        <div style={{ color: 'white', fontWeight: 800, fontSize: '1.1rem' }}>
                          {court.booking_date}
                        </div>
                        <div style={{ color: '#38bdf8', fontWeight: 700, fontSize: '0.95rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <Clock size={15} /> {court.booking_time} WIB
                        </div>
                      </div>
                    </div>

                    <span style={{ 
                      alignSelf: 'flex-start',
                      fontSize: '0.75rem', 
                      fontWeight: 700, 
                      padding: '4px 10px', 
                      borderRadius: '12px',
                      background: 'rgba(52, 211, 153, 0.2)', 
                      color: '#34d399',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}>
                      <CheckCircle2 size={14} /> Terkonfirmasi
                    </span>
                  </div>

                  <div style={{ 
                    display: 'grid', 
                    gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', 
                    gap: '0.5rem', 
                    background: 'rgba(0,0,0,0.2)', 
                    padding: '0.75rem', 
                    borderRadius: 'var(--radius-sm)',
                    fontSize: '0.85rem'
                  }}>
                    <div>
                      <span style={{ color: 'var(--color-text-light)', display: 'block', fontSize: '0.75rem' }}>Pemesan:</span>
                      <strong style={{ color: 'white' }}>{court.first_name || 'Tri'} {court.last_name || 'Putra'}</strong>
                    </div>
                    <div>
                      <span style={{ color: 'var(--color-text-light)', display: 'block', fontSize: '0.75rem' }}>Email Akun:</span>
                      <span style={{ color: '#94a3b8' }}>{court.booked_email}</span>
                    </div>
                    <div>
                      <span style={{ color: 'var(--color-text-light)', display: 'block', fontSize: '0.75rem' }}>No WhatsApp:</span>
                      <span style={{ color: '#94a3b8' }}>{court.phone || '08111819112'}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: TIM PEMESAN (MULTI-PERSON ROSTER) */}
      {activeTab === 'accounts' && (
        <div className="card">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
            <div>
              <h3 style={{ margin: 0, color: 'white', fontSize: '1.1rem', fontWeight: 700 }}>
                👥 Anggota Tim Pemesan Lapangan
              </h3>
              <p style={{ margin: '4px 0 0', color: 'var(--color-text-light)', fontSize: '0.85rem' }}>
                Sistem akan merotasi data pemesan secara adil (round-robin) di antara anggota yang berstatus <strong>Aktif</strong>.
              </p>
            </div>
            <button 
              onClick={handleOpenAddModal}
              className="btn"
              style={{ background: 'var(--color-secondary)', color: '#0f172a', fontWeight: 700, padding: '0.6rem 1.1rem', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              <Plus size={16} /> Tambah Anggota
            </button>
          </div>

          {accounts.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--color-text-light)' }}>
              <Users size={40} style={{ margin: '0 auto 1rem', opacity: 0.4 }} />
              <p style={{ fontSize: '1rem', fontWeight: 600, margin: '0 0 4px' }}>Belum ada anggota tim terdaftar</p>
              <p style={{ fontSize: '0.85rem', margin: '0 0 1rem' }}>Tambahkan data anggota (nama, email, alamat, no WA) untuk rotasi booking.</p>
              <button onClick={handleOpenAddModal} className="btn" style={{ background: 'var(--color-secondary)', color: '#0f172a', fontWeight: 700 }}>
                + Tambah Anggota Sekarang
              </button>
            </div>
          ) : (
            <div style={{ display: 'grid', gap: '1rem' }}>
              {accounts.map((acc) => {
                const isNext = nextInLineAccount && nextInLineAccount.id === acc.id;
                const emailAlias = `${acc.email_prefix}+${acc.current_email_index || 1}@${acc.email_domain || 'gmail.com'}`;

                return (
                  <div 
                    key={acc.id}
                    style={{
                      background: isNext ? 'rgba(56, 189, 248, 0.06)' : 'rgba(255,255,255,0.03)',
                      border: isNext ? '1px solid rgba(56, 189, 248, 0.4)' : '1px solid rgba(255,255,255,0.1)',
                      borderRadius: 'var(--radius-md)',
                      padding: '1.25rem',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.75rem',
                      position: 'relative'
                    }}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div className="flex items-center gap-3">
                        <div style={{
                          width: '42px',
                          height: '42px',
                          borderRadius: '50%',
                          background: isNext ? 'var(--color-secondary)' : 'rgba(255,255,255,0.1)',
                          color: isNext ? '#0f172a' : 'white',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontWeight: 800,
                          fontSize: '1.1rem'
                        }}>
                          {acc.first_name.charAt(0)}
                        </div>

                        <div>
                          <div className="flex items-center gap-2">
                            <span style={{ color: 'white', fontWeight: 800, fontSize: '1.1rem' }}>
                              {acc.first_name} {acc.last_name}
                            </span>
                            {isNext && (
                              <span style={{ 
                                fontSize: '0.7rem', 
                                fontWeight: 800, 
                                background: '#38bdf8', 
                                color: '#0f172a', 
                                padding: '2px 8px', 
                                borderRadius: '12px',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '3px'
                              }}>
                                <Sparkles size={11} /> GILIRAN BERIKUTNYA
                              </span>
                            )}
                          </div>
                          <div style={{ color: '#38bdf8', fontSize: '0.85rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <Mail size={14} /> {emailAlias}
                          </div>
                        </div>
                      </div>

                      {/* Action buttons & Switch */}
                      <div className="flex items-center gap-2">
                        {/* Active toggle button */}
                        <button 
                          onClick={() => handleToggleAccountActive(acc.id, acc.is_active)}
                          className="btn"
                          style={{
                            padding: '4px 10px',
                            fontSize: '0.75rem',
                            fontWeight: 700,
                            borderRadius: '12px',
                            border: 'none',
                            background: acc.is_active ? 'rgba(52, 211, 153, 0.2)' : 'rgba(239, 68, 68, 0.2)',
                            color: acc.is_active ? '#34d399' : '#ef4444',
                            cursor: 'pointer'
                          }}
                        >
                          {acc.is_active ? '● Aktif' : '○ Nonaktif'}
                        </button>

                        <button 
                          onClick={() => handleOpenEditModal(acc)}
                          className="btn"
                          style={{ background: 'rgba(255,255,255,0.08)', color: 'white', padding: '6px 10px', fontSize: '0.8rem' }}
                          title="Edit Data"
                        >
                          <Edit2 size={14} />
                        </button>

                        <button 
                          onClick={() => handleDeleteAccount(acc.id, `${acc.first_name} ${acc.last_name}`)}
                          className="btn"
                          style={{ background: 'rgba(239,68,68,0.1)', color: '#ef4444', padding: '6px 10px', fontSize: '0.8rem' }}
                          title="Hapus"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>

                    {/* Member Details */}
                    <div style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                      gap: '0.5rem',
                      background: 'rgba(0,0,0,0.2)',
                      padding: '0.75rem',
                      borderRadius: 'var(--radius-sm)',
                      fontSize: '0.85rem'
                    }}>
                      <div className="flex items-center gap-2 text-[var(--color-text-light)]">
                        <MapPin size={15} color="#94a3b8" />
                        <span>Alamat: <strong style={{ color: 'white' }}>{acc.address}</strong></span>
                      </div>
                      <div className="flex items-center gap-2 text-[var(--color-text-light)]">
                        <Phone size={15} color="#94a3b8" />
                        <span>WA: <strong style={{ color: 'white' }}>{acc.phone}</strong></span>
                      </div>
                      <div className="flex items-center gap-2 text-[var(--color-text-light)]">
                        <Clock size={15} color="#94a3b8" />
                        <span>Total Booking: <strong style={{ color: '#34d399' }}>{acc.total_bookings || 0} kali</strong></span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 3: PENGATURAN MASTER BOT */}
      {activeTab === 'settings' && (
        <div className="card">
          <h3 style={{ margin: '0 0 1rem 0', color: 'white', fontSize: '1.1rem', fontWeight: 700 }}>
            ⚙️ Pengaturan Master Bot
          </h3>

          {saveSuccess && (
            <div style={{ background: 'rgba(52, 211, 153, 0.2)', border: '1px solid #34d399', color: '#34d399', padding: '0.75rem 1rem', borderRadius: 'var(--radius-sm)', marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.9rem' }}>
              <Check size={18} /> Pengaturan berhasil disimpan!
            </div>
          )}

          <form onSubmit={handleSaveMasterSettings} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            
            {/* Status Bot Active Switch */}
            <div style={{ background: 'rgba(255,255,255,0.03)', padding: '1rem', borderRadius: 'var(--radius-sm)', border: '1px solid rgba(255,255,255,0.08)' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer', color: 'white', fontWeight: 600 }}>
                <input 
                  type="checkbox" 
                  checked={settings.is_active} 
                  onChange={(e) => setSettings(prev => ({ ...prev, is_active: e.target.checked }))}
                  style={{ width: '20px', height: '20px', accentColor: 'var(--color-secondary)', cursor: 'pointer' }}
                />
                <span>Aktifkan Pemeriksaan & Pemesanan Otomatis (Master Auto-Booking Switch)</span>
              </label>
              <p style={{ margin: '6px 0 0 32px', color: 'var(--color-text-light)', fontSize: '0.8rem' }}>
                Jika dicentang, GitHub Actions cron akan otomatis mengecek & membooking lapangan menggunakan rotasi akun anggota tim yang aktif.
              </p>
            </div>

            {/* Target Hours Indicator */}
            <div>
              <label style={{ display: 'block', color: 'var(--color-text-light)', fontSize: '0.85rem', marginBottom: '0.4rem' }}>
                Slot Jam Target Pemesanan (Pagi: 06-09, Sore/Malam: 16-19):
              </label>
              <div className="flex flex-wrap gap-2">
                {[
                  { label: '06:00 (6 AM)', value: '6:00am', color: '#34d399' },
                  { label: '07:00 (7 AM)', value: '7:00am', color: '#34d399' },
                  { label: '08:00 (8 AM)', value: '8:00am', color: '#34d399' },
                  { label: '09:00 (9 AM)', value: '9:00am', color: '#34d399' },
                  { label: '16:00 (4 PM)', value: '4:00pm', color: '#f97316' },
                  { label: '17:00 (5 PM)', value: '5:00pm', color: '#f97316' },
                  { label: '18:00 (6 PM)', value: '6:00pm', color: '#f97316' },
                  { label: '19:00 (7 PM)', value: '7:00pm', color: '#f97316' }
                ].map(item => (
                  <span 
                    key={item.value} 
                    style={{ 
                      padding: '6px 12px', 
                      borderRadius: 'var(--radius-sm)', 
                      background: 'rgba(255,255,255,0.06)', 
                      border: `1px solid ${item.color}40`, 
                      color: item.color,
                      fontSize: '0.85rem',
                      fontWeight: 600
                    }}
                  >
                    ✓ {item.label}
                  </span>
                ))}
              </div>
              <p style={{ margin: '6px 0 0 0', color: 'var(--color-text-light)', fontSize: '0.75rem' }}>
                *Bot otomatis memprioritaskan slot pagi (06:00 - 09:00) dan sore/malam (16:00 - 19:00) pada hari Senin s/d Kamis.
              </p>
            </div>

            <button 
              type="submit" 
              className="btn"
              disabled={isSavingSettings}
              style={{ alignSelf: 'flex-start', background: 'var(--color-secondary)', color: '#0f172a', fontWeight: 700, padding: '0.75rem 1.5rem', marginTop: '0.5rem' }}
            >
              {isSavingSettings ? 'Menyimpan...' : 'Simpan Pengaturan'}
            </button>

          </form>
        </div>
      )}

      {/* MODAL: TAMBAH / EDIT ANGGOTA TIM */}
      {isModalOpen && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.7)',
          backdropFilter: 'blur(6px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: '1rem'
        }}>
          <div style={{
            background: 'var(--color-surface)',
            border: '1px solid rgba(255,255,255,0.15)',
            borderRadius: 'var(--radius-md)',
            padding: '1.5rem',
            width: '100%',
            maxWidth: '520px',
            maxHeight: '90vh',
            overflowY: 'auto'
          }}>
            <h3 style={{ margin: '0 0 0.5rem', color: 'white', fontSize: '1.2rem', fontWeight: 800 }}>
              {modalMode === 'add' ? '➕ Tambah Anggota Tim Pemesan' : '✏️ Edit Data Anggota Tim'}
            </h3>
            <p style={{ margin: '0 0 1.25rem', color: 'var(--color-text-light)', fontSize: '0.85rem' }}>
              Data ini akan digunakan untuk mengisi formulir pemesanan Google Calendar saat giliran tiba.
            </p>

            <form onSubmit={handleSaveAccount} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div>
                  <label style={{ display: 'block', color: 'var(--color-text-light)', fontSize: '0.85rem', marginBottom: '0.3rem' }}>
                    First Name:
                  </label>
                  <input 
                    type="text" 
                    className="input-field" 
                    value={accountFormData.first_name} 
                    onChange={(e) => setAccountFormData(prev => ({ ...prev, first_name: e.target.value }))}
                    placeholder="Contoh: Dias"
                    required 
                  />
                </div>

                <div>
                  <label style={{ display: 'block', color: 'var(--color-text-light)', fontSize: '0.85rem', marginBottom: '0.3rem' }}>
                    Last Name:
                  </label>
                  <input 
                    type="text" 
                    className="input-field" 
                    value={accountFormData.last_name} 
                    onChange={(e) => setAccountFormData(prev => ({ ...prev, last_name: e.target.value }))}
                    placeholder="Contoh: Pratama"
                    required 
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '0.75rem' }}>
                <div>
                  <label style={{ display: 'block', color: 'var(--color-text-light)', fontSize: '0.85rem', marginBottom: '0.3rem' }}>
                    Email Prefix:
                  </label>
                  <input 
                    type="text" 
                    className="input-field" 
                    value={accountFormData.email_prefix} 
                    onChange={(e) => setAccountFormData(prev => ({ ...prev, email_prefix: e.target.value }))}
                    placeholder="dias.pratama"
                    required 
                  />
                </div>

                <div>
                  <label style={{ display: 'block', color: 'var(--color-text-light)', fontSize: '0.85rem', marginBottom: '0.3rem' }}>
                    Index Alias:
                  </label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <span style={{ color: 'white', fontWeight: 700 }}>+</span>
                    <input 
                      type="number" 
                      className="input-field" 
                      value={accountFormData.current_email_index} 
                      onChange={(e) => setAccountFormData(prev => ({ ...prev, current_email_index: parseInt(e.target.value) || 1 }))}
                      min={1}
                      required 
                    />
                  </div>
                </div>
              </div>

              <div style={{ background: 'rgba(56, 189, 248, 0.1)', padding: '0.6rem 0.85rem', borderRadius: 'var(--radius-sm)', border: '1px solid rgba(56, 189, 248, 0.25)', color: '#38bdf8', fontSize: '0.8rem' }}>
                ℹ️ <strong>Preview Email:</strong> {accountFormData.email_prefix || 'email'}+{accountFormData.current_email_index || 1}@{accountFormData.email_domain || 'gmail.com'}
              </div>

              <div>
                <label style={{ display: 'block', color: 'var(--color-text-light)', fontSize: '0.85rem', marginBottom: '0.3rem' }}>
                  Alamat Fortune dengan No Blok:
                </label>
                <input 
                  type="text" 
                  className="input-field" 
                  value={accountFormData.address} 
                  onChange={(e) => setAccountFormData(prev => ({ ...prev, address: e.target.value }))}
                  placeholder="Fortune spring Blok D2 - J05"
                  required 
                />
              </div>

              <div>
                <label style={{ display: 'block', color: 'var(--color-text-light)', fontSize: '0.85rem', marginBottom: '0.3rem' }}>
                  Nomor WhatsApp Aktif:
                </label>
                <input 
                  type="text" 
                  className="input-field" 
                  value={accountFormData.phone} 
                  onChange={(e) => setAccountFormData(prev => ({ ...prev, phone: e.target.value }))}
                  placeholder="08111819112"
                  required 
                />
              </div>

              <div className="flex items-center justify-end gap-2 mt-4">
                <button 
                  type="button" 
                  onClick={() => setIsModalOpen(false)}
                  className="btn"
                  style={{ background: 'rgba(255,255,255,0.1)', color: 'white' }}
                >
                  Batal
                </button>
                <button 
                  type="submit" 
                  className="btn"
                  disabled={isSavingAccount}
                  style={{ background: 'var(--color-secondary)', color: '#0f172a', fontWeight: 700 }}
                >
                  {isSavingAccount ? 'Menyimpan...' : 'Simpan Data Anggota'}
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

    </div>
  );
}
