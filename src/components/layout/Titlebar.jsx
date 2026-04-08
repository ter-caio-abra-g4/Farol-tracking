import { Minus, Square, X } from 'lucide-react'

export default function Titlebar() {
  const isElectron = typeof window !== 'undefined' && window.rais

  if (!isElectron) return null

  return (
    <div
      style={{
        height: 36,
        background: '#001F35',
        borderBottom: '1px solid rgba(185,145,91,0.15)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingLeft: 16,
        WebkitAppRegion: 'drag',
        flexShrink: 0,
      }}
    >
      <span
        style={{
          fontSize: 11,
          color: '#8A9BAA',
          letterSpacing: '0.06em',
          userSelect: 'none',
        }}
      >
        RAIS — Tracking Intelligence
      </span>

      <div style={{ display: 'flex', WebkitAppRegion: 'no-drag' }}>
        {[
          { icon: Minus, action: () => window.rais.minimize(), hover: '#8A9BAA22' },
          { icon: Square, action: () => window.rais.maximize(), hover: '#8A9BAA22' },
          { icon: X, action: () => window.rais.close(), hover: '#EF444422' },
        ].map(({ icon: Icon, action, hover }, i) => (
          <button
            key={i}
            onClick={action}
            style={{
              width: 40,
              height: 36,
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              color: '#8A9BAA',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = hover)}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
          >
            <Icon size={12} />
          </button>
        ))}
      </div>
    </div>
  )
}
