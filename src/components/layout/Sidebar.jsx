import { useState, useRef, useEffect } from 'react'
import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard,
  Database,
  Tag,
  BarChart2,
  Settings,
  Activity,
  Layers,
  TrendingUp,
  GitCompare,
  ChevronLeft,
} from 'lucide-react'

const navItems = [
  { to: '/',           icon: LayoutDashboard, label: 'Dashboard'  },
  { to: '/explorer',   icon: Database,        label: 'Explorador' },
  { to: '/gtm',        icon: Tag,             label: 'GTM'        },
  { to: '/ga4',        icon: BarChart2,       label: 'GA4'        },
  { to: '/meta',       icon: Activity,        label: 'Meta Ads'   },
  { to: '/databricks', icon: Layers,          label: 'Databricks' },
  { to: '/funil',      icon: TrendingUp,      label: 'Funil'      },
  { to: '/comparacao', icon: GitCompare,      label: 'Comparação' },
  { to: '/settings',   icon: Settings,        label: 'Config'     },
]

const EXPANDED_W  = 220
const COLLAPSED_W = 56

export default function Sidebar() {
  const [collapsed, setCollapsed] = useState(false)

  return (
    <aside
      className={collapsed ? 'sidebar sidebar--collapsed' : 'sidebar'}
      style={{ '--sidebar-w': EXPANDED_W + 'px', '--sidebar-collapsed-w': COLLAPSED_W + 'px' }}
    >
      {/* clip interno */}
      <div className="sidebar__clip">

        {/* Logo */}
        <div className="sidebar__logo">
          <FarolLogo />
          <div className="sidebar__logo-text">
            <div className="sidebar__logo-name">Farol</div>
            <div className="sidebar__logo-sub">TRACKING</div>
          </div>
        </div>

        {/* Nav */}
        <nav className="sidebar__nav">
          {navItems.map(({ to, icon: Icon, label }) => (
            <NavItem key={to} to={to} icon={Icon} label={label} collapsed={collapsed} />
          ))}
        </nav>

        {/* Footer */}
        <div className="sidebar__footer">
          <div className="sidebar__footer-company">G4 Education</div>
          <div className="sidebar__footer-version">v1.0.0</div>
        </div>

      </div>

      {/* Toggle */}
      <button
        className="sidebar__toggle"
        onClick={() => setCollapsed(c => !c)}
        title={collapsed ? 'Expandir menu' : 'Recolher menu'}
      >
        <ChevronLeft size={12} strokeWidth={2.5} />
      </button>
    </aside>
  )
}

// ── NavItem ───────────────────────────────────────────────────────────────────
function NavItem({ to, icon: Icon, label, collapsed }) {
  const [hovered, setHovered] = useState(false)
  const [tooltipTop, setTooltipTop] = useState(0)
  const ref = useRef(null)

  useEffect(() => {
    if (collapsed && hovered && ref.current) {
      const r = ref.current.getBoundingClientRect()
      setTooltipTop(r.top + r.height / 2 - 14)
    }
  }, [hovered, collapsed])

  return (
    <div
      style={{ position: 'relative' }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <NavLink
        to={to}
        end={to === '/'}
        ref={ref}
        className={({ isActive }) =>
          ['sidebar__nav-item', isActive ? 'sidebar__nav-item--active' : ''].join(' ')
        }
      >
        <span className="sidebar__nav-icon">
          <Icon size={16} strokeWidth={1.8} />
        </span>
        <span className="sidebar__nav-label">{label}</span>
      </NavLink>

      {collapsed && hovered && (
        <div className="sidebar__tooltip" style={{ top: tooltipTop }}>
          {label}
          <div className="sidebar__tooltip-arrow" />
        </div>
      )}
    </div>
  )
}

// ── Logo SVG ─────────────────────────────────────────────────────────────────
function FarolLogo() {
  return (
    <svg
      width="32" height="32" viewBox="0 0 32 32"
      fill="none" xmlns="http://www.w3.org/2000/svg"
      style={{ flexShrink: 0 }}
    >
      <rect width="32" height="32" rx="7" fill="#B9915B" fillOpacity="0.12" />
      <rect x="0.5" y="0.5" width="31" height="31" rx="6.5" stroke="#B9915B" strokeOpacity="0.5" />
      <rect x="13" y="26" width="6" height="2" rx="1" fill="#B9915B" />
      <rect x="14.5" y="19" width="3" height="7" rx="0.5" fill="#B9915B" />
      <rect x="12" y="15" width="8" height="5" rx="1.5" fill="#B9915B" />
      <rect x="14" y="16.5" width="4" height="2" rx="0.5" fill="#001F35" />
      <path d="M11 15 L16 11 L21 15 Z" fill="#B9915B" />
      <line x1="16" y1="11" x2="10" y2="7" stroke="#B9915B" strokeWidth="1.2" strokeOpacity="0.6" strokeLinecap="round" />
      <line x1="16" y1="11" x2="22" y2="7" stroke="#B9915B" strokeWidth="1.2" strokeOpacity="0.6" strokeLinecap="round" />
      <line x1="16" y1="11" x2="8"  y2="10" stroke="#B9915B" strokeWidth="1"   strokeOpacity="0.35" strokeLinecap="round" />
      <line x1="16" y1="11" x2="24" y2="10" stroke="#B9915B" strokeWidth="1"   strokeOpacity="0.35" strokeLinecap="round" />
    </svg>
  )
}
