import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard,
  Database,
  Tag,
  BarChart2,
  Settings,
  Activity,
} from 'lucide-react'

const navItems = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/explorer', icon: Database, label: 'Explorador' },
  { to: '/gtm', icon: Tag, label: 'GTM' },
  { to: '/ga4', icon: BarChart2, label: 'GA4' },
  { to: '/meta', icon: Activity, label: 'Meta Ads' },
  { to: '/settings', icon: Settings, label: 'Config' },
]

export default function Sidebar() {
  return (
    <aside
      style={{
        width: 220,
        minWidth: 220,
        background: '#001F35',
        borderRight: '1px solid #B9915B',
        display: 'flex',
        flexDirection: 'column',
        padding: '0 0 20px 0',
      }}
    >
      {/* Logo */}
      <div
        style={{
          padding: '24px 20px 20px',
          borderBottom: '1px solid rgba(185,145,91,0.2)',
          marginBottom: 8,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <FarolLogo />
          <div>
            <div
              style={{
                fontFamily: "'PPMuseum','Georgia',serif",
                fontSize: 18,
                fontWeight: 700,
                color: '#B9915B',
                letterSpacing: '-0.03em',
                lineHeight: 1,
              }}
            >
              Farol
            </div>
            <div style={{ fontSize: 10, color: '#8A9BAA', marginTop: 2, letterSpacing: '0.08em' }}>
              TRACKING
            </div>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, padding: '4px 10px' }}>
        {navItems.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            style={({ isActive }) => ({
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '10px 12px',
              borderRadius: 6,
              textDecoration: 'none',
              fontSize: 13,
              fontWeight: 500,
              marginBottom: 2,
              color: isActive ? '#B9915B' : '#8A9BAA',
              background: isActive ? 'rgba(185,145,91,0.08)' : 'transparent',
              borderLeft: isActive ? '2px solid #B9915B' : '2px solid transparent',
              transition: 'all 0.15s ease',
            })}
          >
            <Icon size={16} strokeWidth={1.8} />
            {label}
          </NavLink>
        ))}
      </nav>

      {/* Footer */}
      <div
        style={{
          padding: '12px 20px 0',
          borderTop: '1px solid rgba(185,145,91,0.15)',
          fontSize: 11,
          color: '#8A9BAA',
        }}
      >
        <div style={{ marginBottom: 2 }}>G4 Education</div>
        <div style={{ color: '#B9915B55' }}>v1.0.0</div>
      </div>
    </aside>
  )
}

function FarolLogo() {
  return (
    <svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="32" height="32" rx="7" fill="#B9915B" fillOpacity="0.12" />
      <rect x="0.5" y="0.5" width="31" height="31" rx="6.5" stroke="#B9915B" strokeOpacity="0.5" />
      {/* Base do farol */}
      <rect x="13" y="26" width="6" height="2" rx="1" fill="#B9915B" />
      {/* Torre */}
      <rect x="14.5" y="19" width="3" height="7" rx="0.5" fill="#B9915B" />
      {/* Corpo da lanterna */}
      <rect x="12" y="15" width="8" height="5" rx="1.5" fill="#B9915B" />
      {/* Janela da lanterna */}
      <rect x="14" y="16.5" width="4" height="2" rx="0.5" fill="#001F35" />
      {/* Topo */}
      <path d="M11 15 L16 11 L21 15 Z" fill="#B9915B" />
      {/* Raios de luz */}
      <line x1="16" y1="11" x2="10" y2="7" stroke="#B9915B" strokeWidth="1.2" strokeOpacity="0.6" strokeLinecap="round" />
      <line x1="16" y1="11" x2="22" y2="7" stroke="#B9915B" strokeWidth="1.2" strokeOpacity="0.6" strokeLinecap="round" />
      <line x1="16" y1="11" x2="8" y2="10" stroke="#B9915B" strokeWidth="1" strokeOpacity="0.35" strokeLinecap="round" />
      <line x1="16" y1="11" x2="24" y2="10" stroke="#B9915B" strokeWidth="1" strokeOpacity="0.35" strokeLinecap="round" />
    </svg>
  )
}
