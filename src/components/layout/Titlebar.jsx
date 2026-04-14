import { Minus, Square, Minimize2, X } from 'lucide-react'
import { useState, useEffect } from 'react'

export default function Titlebar() {
  const isElectron = typeof window !== 'undefined' && window.rais
  const [isMaximized, setIsMaximized] = useState(false)

  useEffect(() => {
    if (!isElectron) return
    window.rais.onWindowState((state) => {
      setIsMaximized(state === 'maximized')
    })
  }, [isElectron])

  if (!isElectron) return null

  const buttons = [
    {
      icon: Minus,
      action: () => window.rais.minimize(),
      hoverBg: 'rgba(138,155,170,0.13)',
      color: '#8A9BAA',
      activeColor: null,
    },
    {
      // Minimize2 = dois quadradinhos (restaurar) · Square = um quadrado (maximizar)
      icon: isMaximized ? Minimize2 : Square,
      action: () => window.rais.maximize(),
      hoverBg: 'rgba(185,145,91,0.13)',
      color: isMaximized ? '#E8C17A' : '#8A9BAA',
    },
    {
      icon: X,
      action: () => window.rais.close(),
      hoverBg: 'rgba(239,68,68,0.18)',
      color: '#8A9BAA',
      activeColor: null,
    },
  ]

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
          lineHeight: 1,
          display: 'flex',
          alignItems: 'center',
        }}
      >
        Farol — Tracking Intelligence
      </span>

      <div style={{ display: 'flex', WebkitAppRegion: 'no-drag' }}>
        {buttons.map(({ icon: Icon, action, hoverBg, color }, i) => (
          <button
            key={i}
            onClick={action}
            style={{
              width: 40,
              height: 36,
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              color,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'color 0.15s, background 0.15s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = hoverBg
              if (i === 1) e.currentTarget.style.color = '#F5D28A'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent'
              e.currentTarget.style.color = color
            }}
          >
            <Icon size={12} />
          </button>
        ))}
      </div>
    </div>
  )
}
