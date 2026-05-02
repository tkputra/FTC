import { Outlet, Link, useLocation } from 'react-router-dom'
import { Home, Users, Shuffle, UsersRound, User } from 'lucide-react'

export default function Layout() {
  const location = useLocation()

  const tabs = [
    { path: '/', label: 'Beranda', icon: <Home size={20} /> },
    { path: '/random-doubles', label: 'Ganda Acak', icon: <Shuffle size={20} /> },
    { path: '/fixed-doubles', label: 'Ganda Tetap', icon: <UsersRound size={20} /> },
    { path: '/singles', label: 'Tunggal', icon: <User size={20} /> },
    { path: '/players', label: 'Pemain', icon: <Users size={20} /> },
  ]

  return (
    <>
      <header style={{ 
        backgroundColor: 'rgba(15, 23, 42, 0.8)', 
        backdropFilter: 'blur(12px)',
        borderBottom: '1px solid rgba(255,255,255,0.1)',
        padding: '1rem 0', 
        position: 'sticky', top: 0, zIndex: 100
      }}>
        <div className="container flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h1 style={{ margin: 0, fontSize: '1.5rem', color: 'white', fontWeight: 700, letterSpacing: '-0.5px' }}>Fortune Tennis Club</h1>
          </div>
          
          {/* Desktop Navigation */}
          <nav style={{ display: 'none' }} className="desktop-nav">
            <div className="flex gap-4">
              {tabs.map(tab => (
                <Link 
                  key={tab.path} 
                  to={tab.path}
                  style={{ 
                    color: 'white', 
                    textDecoration: 'none',
                    fontWeight: location.pathname === tab.path ? 'bold' : 'normal',
                    borderBottom: location.pathname === tab.path ? '2px solid var(--color-secondary)' : 'none',
                    paddingBottom: '4px'
                  }}
                >
                  {tab.label}
                </Link>
              ))}
            </div>
          </nav>
        </div>
      </header>

      <main className="container">
        <Outlet />
      </main>

      {/* Mobile Bottom Navigation Bar */}
      <nav className="mobile-nav" style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        backgroundColor: 'var(--color-surface)',
        backdropFilter: 'blur(12px)',
        borderTop: '1px solid var(--color-border)',
        display: 'flex',
        justifyContent: 'space-around',
        padding: '0.5rem 0',
        zIndex: 50,
        boxShadow: '0 -4px 6px -1px rgb(0 0 0 / 0.05)'
      }}>
        {tabs.map(tab => {
          const isActive = location.pathname === tab.path || (tab.path !== '/' && location.pathname.startsWith(tab.path))
          return (
            <Link 
              key={tab.path} 
              to={tab.path}
              className="flex flex-col items-center"
              style={{ 
                color: isActive ? 'var(--color-primary)' : 'var(--color-text-light)',
                textDecoration: 'none',
                fontSize: '0.75rem',
                gap: '0.25rem'
              }}
            >
              <div style={{ color: isActive ? 'var(--color-secondary)' : 'inherit' }}>
                {tab.icon}
              </div>
              <span style={{ fontWeight: isActive ? '600' : '400' }}>{tab.label}</span>
            </Link>
          )
        })}
      </nav>

      <style>{`
        @media (min-width: 768px) {
          .desktop-nav { display: block !important; }
          .mobile-nav { display: none !important; }
        }
        @media (max-width: 767px) {
          body { padding-bottom: 70px; } /* Space for bottom nav */
        }
      `}</style>
    </>
  )
}
