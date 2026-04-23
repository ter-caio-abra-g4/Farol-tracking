import { useState, useRef, useEffect, useCallback } from 'react'
import { api } from '../../services/api'
import { NavLink, useLocation } from 'react-router-dom'
import pkg from '../../../package.json'
import {
  LayoutDashboard,
  Database,
  Tag,
  BarChart2,
  Settings,
  Activity,
  Layers,
  TrendingUp,
  ChevronLeft,
  ChevronDown,
  LineChart,
  Sprout,
  Radio,
  AlertTriangle,
  Users2,
  Triangle,
} from 'lucide-react'

// ── Estrutura de navegação agrupada ──────────────────────────────────────────
const navGroups = [
  {
    // Sem label — Dashboard + Monitor ao vivo no topo
    items: [
      { to: '/',     icon: LayoutDashboard, label: 'Dashboard' },
      { to: '/live', icon: Radio,           label: 'Ao Vivo'   },
    ],
  },
  {
    label: 'Canais',
    defaultOpen: false,
    items: [
      { to: '/gtm',  icon: Tag,       label: 'GTM'      },
      { to: '/ga4',  icon: BarChart2, label: 'GA4'      },
      { to: '/meta', icon: Activity,  label: 'Meta Ads' },
      { to: '/seo',  icon: Sprout,    label: 'Orgânico' },
    ],
  },
  {
    label: 'Análise',
    defaultOpen: false,
    items: [
      { to: '/funil',      icon: TrendingUp,    label: 'Funil'        },
      { to: '/analytics',  icon: LineChart,     label: 'Analytics'    },
      { to: '/comparacao', icon: Triangle,      label: 'Triangulação' },
      { to: '/anomaly',    icon: AlertTriangle, label: 'Anomalias', badge: 'em breve', disabled: true },
      { to: '/cohort',     icon: Users2,        label: 'Cohort',    badge: 'em breve', disabled: true },
    ],
  },
  {
    label: 'Dados',
    defaultOpen: false,
    items: [
      { to: '/explorer',   icon: Database, label: 'Explorador' },
      { to: '/databricks', icon: Layers,   label: 'Databricks' },
    ],
  },
]

const settingsItem = { to: '/settings', icon: Settings, label: 'Config' }

const EXPANDED_W  = 220
const COLLAPSED_W = 56

export default function Sidebar() {
  const [collapsed, setCollapsed] = useState(false)
  const [serverAlive, setServerAlive] = useState(null) // null=checking, true, false
  // Accordion: só um grupo aberto por vez (guarda o label do grupo aberto)
  const location = useLocation()
  const [openGroup, setOpenGroup] = useState(() => {
    // Abre o grupo que contém a rota atual na carga inicial
    const active = navGroups.find(g =>
      g.label && g.items?.some(item => item.to === window.location.pathname)
    )
    return active?.label ?? null
  })

  const checkServer = useCallback(() => {
    api.health().then(r => setServerAlive(!!(r?.ok))).catch(() => setServerAlive(false))
  }, [])

  useEffect(() => {
    checkServer()
    const interval = setInterval(checkServer, 30000) // checa a cada 30s
    return () => clearInterval(interval)
  }, [checkServer])

  return (
    <aside
      className={collapsed ? 'sidebar sidebar--collapsed' : 'sidebar'}
      style={{ '--sidebar-w': EXPANDED_W + 'px', '--sidebar-collapsed-w': COLLAPSED_W + 'px' }}
    >
      <div className="sidebar__clip">

        {/* Logo */}
        <div className="sidebar__logo">
          <FarolLogo />
          <div className="sidebar__logo-text">
            <div className="sidebar__logo-name">Farol</div>
            <div className="sidebar__logo-sub">TRACKING INTELLIGENCE</div>
          </div>
        </div>

        {/* Nav com grupos */}
        <nav className="sidebar__nav">
          {navGroups.map((group, i) =>
            group.label
              ? <NavGroup
                  key={group.label}
                  group={group}
                  collapsed={collapsed}
                  isOpen={openGroup === group.label}
                  onToggle={() => setOpenGroup(g => g === group.label ? null : group.label)}
                />
              : group.items.map(item => (
                  <NavItem key={item.to} {...item} collapsed={collapsed} />
                ))
          )}
        </nav>

        {/* Footer com Config */}
        <div className="sidebar__footer">
          <NavItem {...settingsItem} collapsed={collapsed} />
          <div className="sidebar__footer-info" style={{ gap: 6 }}>
            {/* Bolinha pulsante de status */}
            <span className={
              serverAlive === null ? 'status-dot status-dot--checking'
              : serverAlive ? 'status-dot status-dot--alive'
              : 'status-dot status-dot--dead'
            } title={serverAlive ? 'Sistema online' : serverAlive === null ? 'Verificando...' : 'Servidor offline'} />
            <span className="sidebar__footer-version">v{pkg.version}</span>
          </div>
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

// ── NavGroup — seção colapsável ───────────────────────────────────────────────
function NavGroup({ group, collapsed, isOpen, onToggle }) {
  // Quando a sidebar colapsa, expande todos os grupos (ícones ficam todos visíveis)
  const effectiveOpen = collapsed ? true : isOpen

  return (
    <div className="sidebar__group">
      {/* Header do grupo — só visível quando expandido */}
      <button
        className="sidebar__group-header"
        onClick={() => !collapsed && onToggle()}
        tabIndex={collapsed ? -1 : 0}
      >
        <span className="sidebar__group-label">{group.label}</span>
        <span
          className="sidebar__group-chevron"
          style={{ transform: isOpen ? 'rotate(0deg)' : 'rotate(-90deg)' }}
        >
          <ChevronDown size={10} strokeWidth={2} />
        </span>
      </button>

      {/* Itens do grupo */}
      <div
        className="sidebar__group-items"
        style={{
          maxHeight: effectiveOpen ? group.items.length * 40 + 'px' : '0px',
        }}
      >
        {group.items.map(item => (
          <NavItem key={item.to} {...item} collapsed={collapsed} />
        ))}
      </div>
    </div>
  )
}

// ── NavItem ───────────────────────────────────────────────────────────────────
function NavItem({ to, icon: Icon, label, badge, collapsed, disabled }) {
  const [hovered, setHovered] = useState(false)
  const [tooltipTop, setTooltipTop] = useState(0)
  const ref = useRef(null)

  useEffect(() => {
    if (collapsed && hovered && ref.current) {
      const r = ref.current.getBoundingClientRect()
      setTooltipTop(r.top + r.height / 2 - 14)
    }
  }, [hovered, collapsed])

  // Item desabilitado: visual acinzentado, sem navegação
  if (disabled) {
    return (
      <div
        style={{ position: 'relative' }}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        <div
          ref={ref}
          className="sidebar__nav-item"
          style={{ opacity: 0.35, cursor: 'not-allowed', pointerEvents: 'all' }}
          title="Em desenvolvimento"
        >
          <span className="sidebar__nav-icon">
            <Icon size={16} strokeWidth={1.8} />
          </span>
          <span className="sidebar__nav-label">{label}</span>
          {badge && !collapsed && (
            <span style={{
              fontSize: 8, fontWeight: 700, letterSpacing: '0.04em',
              padding: '1px 5px', borderRadius: 4,
              background: 'rgba(107,114,128,0.2)', color: '#6B7280',
              border: '1px solid rgba(107,114,128,0.3)', marginLeft: 'auto',
              textTransform: 'uppercase', lineHeight: 1.6,
            }}>{badge}</span>
          )}
        </div>
        {collapsed && hovered && (
          <div className="sidebar__tooltip" style={{ top: tooltipTop }}>
            {label} (em desenvolvimento)
            <div className="sidebar__tooltip-arrow" />
          </div>
        )}
      </div>
    )
  }

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
        {badge && !collapsed && (
          <span style={{
            fontSize: 8, fontWeight: 700, letterSpacing: '0.04em',
            padding: '1px 5px', borderRadius: 4,
            background: 'rgba(99,102,241,0.15)', color: '#A5B4FC',
            border: '1px solid rgba(99,102,241,0.25)', marginLeft: 'auto',
            textTransform: 'uppercase', lineHeight: 1.6,
          }}>{badge}</span>
        )}
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
      <defs>
        <linearGradient id="beamGrad" x1="0" y1="0" x2="1" y2="0" gradientUnits="objectBoundingBox">
          <stop offset="0%" stopColor="#E8C17A" stopOpacity="0.9" />
          <stop offset="100%" stopColor="#E8C17A" stopOpacity="0" />
        </linearGradient>
        <clipPath id="boxClip">
          <rect width="32" height="32" rx="7" />
        </clipPath>
      </defs>

      {/* Fundo */}
      <rect width="32" height="32" rx="7" fill="#B9915B" fillOpacity="0.12" />
      <rect x="0.5" y="0.5" width="31" height="31" rx="6.5" stroke="#B9915B" strokeOpacity="0.4" />

      {/* Feixe 3D — rotação 360° + opacidade senoidal simulando perspectiva */}
      <g clipPath="url(#boxClip)">
        <path d="M16 10.75 L42 4 L42 17.5 Z" fill="#E8C17A">
          <animateTransform
            attributeName="transform"
            type="rotate"
            from="0 16 10.75"
            to="360 16 10.75"
            dur="4s"
            repeatCount="indefinite"
          />
          <animate
            attributeName="fill-opacity"
            values="0.55; 0.05; 0.55; 0.05; 0.55"
            keyTimes="0; 0.25; 0.5; 0.75; 1"
            calcMode="spline"
            keySplines="0.5 0 0.5 1; 0.5 0 0.5 1; 0.5 0 0.5 1; 0.5 0 0.5 1"
            dur="4s"
            repeatCount="indefinite"
          />
        </path>
      </g>

      {/* Base */}
      <rect x="12" y="27" width="8" height="3" rx="1.2" fill="#B9915B" />

      {/* Torre */}
      <rect x="14" y="14" width="4" height="13" fill="#B9915B" fillOpacity="0.85" />
      <rect x="14" y="16" width="4" height="1.4" fill="#001F35" fillOpacity="0.3" />
      <rect x="14" y="20" width="4" height="1.4" fill="#001F35" fillOpacity="0.3" />
      <rect x="14" y="24" width="4" height="1.4" fill="#001F35" fillOpacity="0.3" />

      {/* Varanda */}
      <rect x="12.5" y="13" width="7" height="1.5" rx="0.7" fill="#B9915B" />

      {/* Câmara da lanterna */}
      <rect x="13.5" y="8.5" width="5" height="4.5" rx="0.8" fill="#001F35" />
      <rect x="13.5" y="8.5" width="5" height="4.5" rx="0.8" stroke="#B9915B" strokeWidth="0.6" />

      {/* Vidros iluminados */}
      <rect x="14.2" y="9.2" width="1.5" height="3" rx="0.4" fill="#E8C17A" fillOpacity="0.75" />
      <rect x="16.2" y="9.2" width="1.5" height="3" rx="0.4" fill="#E8C17A" fillOpacity="0.35" />

      {/* Cúpula */}
      <path d="M13.5 8.5 Q16 5.5 18.5 8.5 Z" fill="#B9915B" />

      {/* Antena */}
      <line x1="16" y1="5.5" x2="16" y2="4" stroke="#E8C17A" strokeWidth="1" strokeLinecap="round" />
    </svg>
  )
}
