import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Calendar, Clock, Mail, CheckCircle2, RefreshCw, ExternalLink, Settings, ShieldCheck, CalendarDays, Check } from 'lucide-react';

interface BookingSettings {
  id?: number;
  email_prefix: string;
  email_domain: string;
  current_email_index: number;
  first_name: string;
  last_name: string;
  address: string;
  phone: string;
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
  const [settings, setSettings] = useState<BookingSettings>({
    email_prefix: 'tri.kartika.putra',
    email_domain: 'gmail.com',
    current_email_index: 2,
    first_name: 'Tri',
    last_name: 'Putra',
    address: 'Fortune spring Blok D2 - J05',
    phone: '08111819112',
    target_hours: ['6:00am', '7:00am', '8:00am', '9:00am', '4:00pm', '5:00pm', '6:00pm', '7:00pm'],
    target_days: ['Mon', 'Tue', 'Wed', 'Thu'],
    is_active: true,
    last_check_message: 'Sistem siap memantau jadwal'
  });

  const [bookedCourts, setBookedCourts] = useState<BookedCourt[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<'bookings' | 'settings'>('bookings');

  // Form State for settings edit
  const [formData, setFormData] = useState<BookingSettings>(settings);
  const [saveSuccess, setSaveSuccess] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    setIsLoading(true);
    try {
      // 1. Fetch Settings
      const { data: settingsData } = await supabase
        .from('court_booking_settings')
        .select('*')
        .eq('id', 1)
        .single();

      if (settingsData) {
        setSettings(settingsData);
        setFormData(settingsData);
      }

      // 2. Fetch Booked Courts
      const { data: courtsData } = await supabase
        .from('booked_courts')
        .select('*')
        .order('created_at', { ascending: false });

      if (courtsData) {
        setBookedCourts(courtsData);
      }
    } catch (err) {
      console.error('Failed to load booking data:', err);
    } finally {
      setIsLoading(false);
    }
  }

  async function handleSaveSettings(e: React.FormEvent) {
    e.preventDefault();
    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('court_booking_settings')
        .upsert({
          id: 1,
          ...formData,
          updated_at: new Date().toISOString()
        });

      if (error) {
        alert('Gagal menyimpan pengaturan: ' + error.message);
      } else {
        setSettings(formData);
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 3000);
      }
    } catch (err: any) {
      alert('Error: ' + err.message);
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDeleteBooking(id: string) {
    if (!window.confirm('Hapus riwayat booking ini dari daftar?')) return;
    const { error } = await supabase.from('booked_courts').delete().eq('id', id);
    if (error) {
      alert('Gagal menghapus: ' + error.message);
    } else {
      setBookedCourts(prev => prev.filter(c => c.id !== id));
    }
  }

  const currentEmailTarget = `${settings.email_prefix}+${settings.current_email_index || 2}@${settings.email_domain}`;

  return (
    <div className="flex flex-col gap-6 mt-4 pb-16">
      {/* Top Banner & Header */}
      <div className="glass-panel" style={{ background: 'linear-gradient(135deg, rgba(15, 23, 42, 0.9) 0%, rgba(30, 41, 59, 0.9) 100%)' }}>
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
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

        {/* Live Status Summary Card */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem', marginTop: '1.5rem' }}>
          
          {/* Status Box */}
          <div style={{ background: 'rgba(255,255,255,0.05)', padding: '1rem', borderRadius: 'var(--radius-md)', border: '1px solid rgba(255,255,255,0.1)' }}>
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
              <Clock size={16} color="var(--color-secondary)" />
              <span style={{ color: 'white', fontSize: '0.85rem' }}>
                Setiap 10 mnt (Mulai 07:00 WIB)
              </span>
            </div>
          </div>

          {/* Email Target Box */}
          <div style={{ background: 'rgba(255,255,255,0.05)', padding: '1rem', borderRadius: 'var(--radius-md)', border: '1px solid rgba(255,255,255,0.1)' }}>
            <div className="flex items-center justify-between mb-2">
              <span style={{ fontSize: '0.8rem', color: 'var(--color-text-light)', fontWeight: 600, textTransform: 'uppercase' }}>Target Email Berikutnya</span>
              <span style={{ fontSize: '0.75rem', color: '#38bdf8', fontWeight: 700, background: 'rgba(56, 189, 248, 0.15)', padding: '2px 8px', borderRadius: '12px' }}>
                Index +{settings.current_email_index || 2}
              </span>
            </div>
            <div className="flex items-center gap-2" title={currentEmailTarget}>
              <Mail size={16} color="#38bdf8" />
              <span style={{ color: 'white', fontSize: '0.85rem', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {currentEmailTarget}
              </span>
            </div>
          </div>

          {/* Target Jam Box */}
          <div style={{ background: 'rgba(255,255,255,0.05)', padding: '1rem', borderRadius: 'var(--radius-md)', border: '1px solid rgba(255,255,255,0.1)' }}>
            <div className="flex items-center justify-between mb-2">
              <span style={{ fontSize: '0.8rem', color: 'var(--color-text-light)', fontWeight: 600, textTransform: 'uppercase' }}>Target Jam (8 Slot)</span>
              <span style={{ fontSize: '0.75rem', color: '#facc15', fontWeight: 700, background: 'rgba(250, 204, 21, 0.15)', padding: '2px 8px', borderRadius: '12px' }}>
                Pagi & Sore/Malam
              </span>
            </div>
            <div className="flex flex-wrap gap-1 mt-1">
              {['06:00', '07:00', '08:00', '09:00'].map(h => (
                <span key={h} style={{ fontSize: '0.75rem', fontWeight: 700, padding: '2px 6px', borderRadius: '4px', background: 'rgba(52, 211, 153, 0.2)', color: '#34d399' }}>
                  {h}
                </span>
              ))}
              {['16:00', '17:00', '18:00', '19:00'].map(h => (
                <span key={h} style={{ fontSize: '0.75rem', fontWeight: 700, padding: '2px 6px', borderRadius: '4px', background: 'rgba(249, 115, 22, 0.2)', color: '#f97316' }}>
                  {h}
                </span>
              ))}
            </div>
          </div>

          {/* Last Check Result Box */}
          <div style={{ background: 'rgba(255,255,255,0.05)', padding: '1rem', borderRadius: 'var(--radius-md)', border: '1px solid rgba(255,255,255,0.1)' }}>
            <div className="flex items-center justify-between mb-2">
              <span style={{ fontSize: '0.8rem', color: 'var(--color-text-light)', fontWeight: 600, textTransform: 'uppercase' }}>Pengecekan Terakhir</span>
              <span style={{ fontSize: '0.75rem', color: 'gray' }}>
                {settings.last_check_at ? new Date(settings.last_check_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) : '-'}
              </span>
            </div>
            <p style={{ margin: 0, color: 'var(--color-text-light)', fontSize: '0.8rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {settings.last_check_message || 'Belum ada log pengecekan'}
            </p>
          </div>

        </div>
      </div>

      {/* Navigation Sub-Tabs */}
      <div className="flex bg-[rgba(255,255,255,0.1)] p-1 rounded-[var(--radius-md)] border border-[rgba(255,255,255,0.1)]">
        <button 
          onClick={() => setActiveTab('bookings')}
          style={{
            flex: 1, padding: '0.75rem', borderRadius: 'calc(var(--radius-md) - 4px)', border: 'none',
            background: activeTab === 'bookings' ? 'var(--color-primary)' : 'transparent',
            color: activeTab === 'bookings' ? 'white' : 'var(--color-text-light)',
            fontWeight: activeTab === 'bookings' ? 600 : 400, cursor: 'pointer', transition: 'all 0.2s'
          }}
        >
          <CalendarDays size={18} style={{ display: 'inline', marginRight: '8px', verticalAlign: 'text-bottom' }} />
          Daftar Lapangan Terbooking ({bookedCourts.length})
        </button>

        <button 
          onClick={() => setActiveTab('settings')}
          style={{
            flex: 1, padding: '0.75rem', borderRadius: 'calc(var(--radius-md) - 4px)', border: 'none',
            background: activeTab === 'settings' ? 'var(--color-primary)' : 'transparent',
            color: activeTab === 'settings' ? 'white' : 'var(--color-text-light)',
            fontWeight: activeTab === 'settings' ? 600 : 400, cursor: 'pointer', transition: 'all 0.2s'
          }}
        >
          <Settings size={18} style={{ display: 'inline', marginRight: '8px', verticalAlign: 'text-bottom' }} />
          Pengaturan Bot & Data Pemesan
        </button>
      </div>

      {/* TAB 1: LIST OF BOOKED COURTS */}
      {activeTab === 'bookings' && (
        <div className="glass-panel">
          <div className="flex justify-between items-center mb-4">
            <h3 style={{ color: 'white', fontSize: '1.2rem', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <ShieldCheck size={20} color="var(--color-secondary)" /> Riwayat Lapangan Sukses Terbooking
            </h3>
            <span style={{ fontSize: '0.85rem', color: 'var(--color-text-light)' }}>
              Total: {bookedCourts.length} Booking
            </span>
          </div>

          {isLoading ? (
            <div style={{ textAlign: 'center', padding: '3rem', color: 'white' }}>
              <RefreshCw size={28} className="animate-spin" style={{ margin: '0 auto 1rem auto', color: 'var(--color-secondary)' }} />
              <p>Memuat data riwayat booking...</p>
            </div>
          ) : bookedCourts.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '3rem 1rem', background: 'rgba(255,255,255,0.02)', borderRadius: 'var(--radius-md)', border: '1px dashed rgba(255,255,255,0.1)' }}>
              <Calendar size={48} color="gray" style={{ margin: '0 auto 1rem auto', opacity: 0.5 }} />
              <h4 style={{ color: 'white', margin: '0 0 0.5rem 0' }}>Belum Ada Lapangan Terbooking</h4>
              <p style={{ color: 'var(--color-text-light)', fontSize: '0.9rem', maxWidth: '480px', margin: '0 auto' }}>
                Bot akan otomatis memesan saat menemukan slot kosong di jam 06-09 AM atau 04-06 PM (Senin s/d Kamis) dan mencatat hasilnya di sini.
              </p>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '1rem' }}>
              {bookedCourts.map((court) => (
                <div 
                  key={court.id}
                  style={{
                    background: 'linear-gradient(135deg, rgba(52, 211, 153, 0.08) 0%, rgba(255, 255, 255, 0.03) 100%)',
                    border: '1px solid rgba(52, 211, 153, 0.3)',
                    borderRadius: 'var(--radius-md)',
                    padding: '1.25rem',
                    position: 'relative'
                  }}
                >
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span style={{ fontSize: '1rem', fontWeight: 800, color: 'white' }}>
                          {court.booking_date}
                        </span>
                        {court.day_name && (
                          <span style={{ fontSize: '0.75rem', background: 'rgba(52, 211, 153, 0.2)', color: '#34d399', padding: '2px 8px', borderRadius: '12px', fontWeight: 700 }}>
                            {court.day_name}
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--color-secondary)', marginTop: '4px' }}>
                        🕒 {court.booking_time}
                      </div>
                    </div>

                    <span style={{ display: 'flex', alignItems: 'center', gap: '4px', background: 'rgba(52, 211, 153, 0.2)', color: '#34d399', fontSize: '0.75rem', fontWeight: 700, padding: '4px 8px', borderRadius: '6px' }}>
                      <CheckCircle2 size={14} /> Terkonfirmasi
                    </span>
                  </div>

                  <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '0.75rem', fontSize: '0.85rem', color: 'var(--color-text-light)', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <div>
                      <strong style={{ color: 'white' }}>Email:</strong> {court.booked_email}
                    </div>
                    <div>
                      <strong style={{ color: 'white' }}>Nama:</strong> {court.first_name || 'Tri'} {court.last_name || 'Putra'}
                    </div>
                    <div>
                      <strong style={{ color: 'white' }}>WhatsApp:</strong> {court.phone || '08111819112'}
                    </div>
                    {court.notes && (
                      <div style={{ fontSize: '0.75rem', color: 'gray', marginTop: '4px' }}>
                        {court.notes}
                      </div>
                    )}
                  </div>

                  <button
                    onClick={() => handleDeleteBooking(court.id)}
                    style={{
                      background: 'transparent', border: 'none', color: '#ef4444', fontSize: '0.75rem',
                      cursor: 'pointer', marginTop: '0.75rem', padding: '4px 0', textDecoration: 'underline'
                    }}
                  >
                    Hapus dari Catatan
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: SETTINGS & CONFIGURATION */}
      {activeTab === 'settings' && (
        <div className="glass-panel">
          <h3 style={{ color: 'white', fontSize: '1.2rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Settings size={20} color="var(--color-secondary)" /> Pengaturan Data Auto-Booking
          </h3>

          {saveSuccess && (
            <div style={{ background: 'rgba(52, 211, 153, 0.15)', border: '1px solid #34d399', color: '#34d399', padding: '0.75rem 1rem', borderRadius: 'var(--radius-sm)', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.9rem' }}>
              <Check size={18} /> Pengaturan berhasil disimpan!
            </div>
          )}

          <form onSubmit={handleSaveSettings} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            
            {/* Status Bot Active Switch */}
            <div style={{ background: 'rgba(255,255,255,0.03)', padding: '1rem', borderRadius: 'var(--radius-sm)', border: '1px solid rgba(255,255,255,0.08)' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer', color: 'white', fontWeight: 600 }}>
                <input 
                  type="checkbox" 
                  checked={formData.is_active} 
                  onChange={(e) => setFormData(prev => ({ ...prev, is_active: e.target.checked }))}
                  style={{ width: '20px', height: '20px', accentColor: 'var(--color-secondary)', cursor: 'pointer' }}
                />
                <span>Aktifkan Pemeriksaan & Pemesanan Otomatis (Auto-Booking Bot)</span>
              </label>
              <p style={{ margin: '6px 0 0 32px', color: 'var(--color-text-light)', fontSize: '0.8rem' }}>
                Jika dicentang, GitHub Actions cron akan otomatis mengecek & membooking lapangan saat jadwal dibuka.
              </p>
            </div>

            {/* Email Alias Counter */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', color: 'var(--color-text-light)', fontSize: '0.85rem', marginBottom: '0.4rem' }}>
                  Email Prefix:
                </label>
                <input 
                  type="text" 
                  className="input-field" 
                  value={formData.email_prefix} 
                  onChange={(e) => setFormData(prev => ({ ...prev, email_prefix: e.target.value }))}
                  placeholder="tri.kartika.putra"
                  required 
                />
              </div>

              <div>
                <label style={{ display: 'block', color: 'var(--color-text-light)', fontSize: '0.85rem', marginBottom: '0.4rem' }}>
                  Index Alias Berikutnya (Contoh: +2, +3, +4):
                </label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ color: 'white', fontWeight: 700 }}>+</span>
                  <input 
                    type="number" 
                    className="input-field" 
                    value={formData.current_email_index} 
                    onChange={(e) => setFormData(prev => ({ ...prev, current_email_index: parseInt(e.target.value) || 2 }))}
                    min={1}
                    required 
                  />
                  <span style={{ color: 'var(--color-text-light)', fontSize: '0.85rem', whiteSpace: 'nowrap' }}>@{formData.email_domain}</span>
                </div>
              </div>
            </div>

            <div style={{ background: 'rgba(56, 189, 248, 0.1)', padding: '0.75rem 1rem', borderRadius: 'var(--radius-sm)', border: '1px solid rgba(56, 189, 248, 0.3)', color: '#38bdf8', fontSize: '0.85rem' }}>
              ℹ️ <strong>Email yang akan digunakan pada booking berikutnya:</strong> {formData.email_prefix}+{formData.current_email_index}@{formData.email_domain}
            </div>

            {/* Contact Person Details */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', color: 'var(--color-text-light)', fontSize: '0.85rem', marginBottom: '0.4rem' }}>
                  First Name:
                </label>
                <input 
                  type="text" 
                  className="input-field" 
                  value={formData.first_name} 
                  onChange={(e) => setFormData(prev => ({ ...prev, first_name: e.target.value }))}
                  required 
                />
              </div>

              <div>
                <label style={{ display: 'block', color: 'var(--color-text-light)', fontSize: '0.85rem', marginBottom: '0.4rem' }}>
                  Last Name:
                </label>
                <input 
                  type="text" 
                  className="input-field" 
                  value={formData.last_name} 
                  onChange={(e) => setFormData(prev => ({ ...prev, last_name: e.target.value }))}
                  required 
                />
              </div>
            </div>

            {/* Address & WhatsApp */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', color: 'var(--color-text-light)', fontSize: '0.85rem', marginBottom: '0.4rem' }}>
                  Alamat Fortune dengan No Blok:
                </label>
                <input 
                  type="text" 
                  className="input-field" 
                  value={formData.address} 
                  onChange={(e) => setFormData(prev => ({ ...prev, address: e.target.value }))}
                  required 
                />
              </div>

              <div>
                <label style={{ display: 'block', color: 'var(--color-text-light)', fontSize: '0.85rem', marginBottom: '0.4rem' }}>
                  Nomor WhatsApp Aktif:
                </label>
                <input 
                  type="text" 
                  className="input-field" 
                  value={formData.phone} 
                  onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                  required 
                />
              </div>
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
                *Bot akan memprioritaskan slot pagi (06:00 - 09:00) dan sore/malam (16:00 - 19:00) pada hari Senin s/d Kamis.
              </p>
            </div>

            <button 
              type="submit" 
              className="btn"
              disabled={isSaving}
              style={{ alignSelf: 'flex-start', background: 'var(--color-secondary)', color: '#0f172a', fontWeight: 700, padding: '0.75rem 1.5rem', marginTop: '0.5rem' }}
            >
              {isSaving ? 'Menyimpan...' : 'Simpan Pengaturan'}
            </button>

          </form>
        </div>
      )}

    </div>
  );
}
