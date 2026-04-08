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
          <RaisLogo />
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
              RAIS
            </div>
            <div style={{ fontSize: 10, color: '#8A9BAA', marginTop: 2, letterSpacing: '0.08em' }}>
              TRACKING INTEL
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

function RaisLogo() {
  return (
    <svg width="28" height="28" viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="28" height="28" rx="6" fill="#B9915B" fillOpacity="0.15" />
      <rect x="0.5" y="0.5" width="27" height="27" rx="5.5" stroke="#B9915B" strokeOpacity="0.6" />
      <path
        d="M8 20V9h5.5c1.2 0 2.1.3 2.7.9.6.6.9 1.4.9 2.4 0 .7-.15 1.3-.45 1.8-.3.5-.73.88-1.3 1.12L17.8 20H15.4l-2.1-4.4H10.2V20H8zm2.2-6.3h3.1c.63 0 1.1-.15 1.4-.45.3-.3.45-.72.45-1.25 0-.53-.15-.95-.45-1.25-.3-.3-.77-.45-1.4-.45h-3.1v3.4z"
        fill="#B9915B"
      />
    </svg>
  )
}
