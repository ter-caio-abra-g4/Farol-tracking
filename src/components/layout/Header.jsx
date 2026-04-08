import { RefreshCw, Clock } from 'lucide-react'
import { useState } from 'react'

export default function Header({ title, subtitle, onRefresh, lastUpdated, select }) {
  const [spinning, setSpinning] = useState(false)

  const handleRefresh = () => {
    setSpinning(true)
    setTimeout(() => setSpinning(false), 800)
    onRefresh?.()
  }

  const time = lastUpdated
    ? new Date(lastUpdated).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
    : null

  return (
    <div
      style={{
        padding: '20px 28px 16px',
        borderBottom: '1px solid rgba(185,145,91,0.15)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexShrink: 0,
      }}
    >
      <div>
        <h1
          style={{
            fontFamily: "'PPMuseum','Georgia',serif",
            fontSize: 22,
            fontWeight: 600,
            color: '#B9915B',
            letterSpacing: '-0.02em',
            lineHeight: 1.2,
          }}
        >
          {title}
        </h1>
        {subtitle && (
          <p style={{ fontSize: 13, color: '#8A9BAA', marginTop: 4 }}>{subtitle}</p>
        )}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        {select && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 12, color: '#8A9BAA', whiteSpace: 'nowrap' }}>{select.label}</span>
            <select
              value={select.value}
              onChange={(e) => select.onChange(e.target.value)}
              style={{
                background: '#001F35',
                border: '1px solid rgba(185,145,91,0.4)',
                borderRadius: 6,
                color: '#F5F4F3',
                padding: '6px 28px 6px 12px',
                fontSize: 13,
                fontWeight: 500,
                cursor: 'pointer',
                outline: 'none',
                appearance: 'none',
                backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23B9915B' stroke-width='2'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E")`,
                backgroundRepeat: 'no-repeat',
                backgroundPosition: 'right 8px center',
              }}
            >
              {select.groups
                ? select.groups.map((g) => (
                    <optgroup key={g.label} label={g.label}>
                      {g.options.map((opt) => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </optgroup>
                  ))
                : select.options.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))
              }
            </select>
          </div>
        )}
        {time && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#8A9BAA', fontSize: 12 }}>
            <Clock size={13} />
            <span>Atualizado {time}</span>
          </div>
        )}
        <button
          onClick={handleRefresh}
          style={{
            background: 'rgba(185,145,91,0.1)',
            border: '1px solid rgba(185,145,91,0.3)',
            borderRadius: 6,
            padding: '7px 14px',
            color: '#B9915B',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            fontSize: 13,
            fontWeight: 500,
          }}
        >
          <RefreshCw
            size={13}
            style={{
              transition: 'transform 0.8s ease',
              transform: spinning ? 'rotate(360deg)' : 'rotate(0deg)',
            }}
          />
          Atualizar
        </button>
      </div>
    </div>
  )
}
