/**
 * PeriodSelect — seletor de período padronizado para usar no action= do Header.
 * Uso: <PeriodSelect value={days} onChange={setDays} />
 * Opções padrão: Hoje, 7d, 15d, 30d, 90d. Customizável via prop `options`.
 */

export const PERIOD_OPTIONS = [
  { label: 'Hoje', days: 1  },
  { label: '7d',   days: 7  },
  { label: '15d',  days: 15 },
  { label: '30d',  days: 30 },
  { label: '90d',  days: 90 },
]

export default function PeriodSelect({ value, onChange, options = PERIOD_OPTIONS }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <span style={{
        fontSize: 11, color: '#8A9BAA', fontWeight: 600,
        letterSpacing: '0.06em', textTransform: 'uppercase', marginRight: 2,
        userSelect: 'none',
      }}>
        Período
      </span>
      <div style={{ display: 'flex', gap: 4 }}>
        {options.map(opt => {
          const active = value === opt.days
          return (
            <button
              key={opt.days}
              onClick={() => onChange(opt.days)}
              style={{
                padding: '4px 12px',
                borderRadius: 6,
                border: active
                  ? '1px solid rgba(185,145,91,0.65)'
                  : '1px solid rgba(185,145,91,0.18)',
                background: active ? 'rgba(185,145,91,0.10)' : 'transparent',
                color: active ? '#B9915B' : '#6B7280',
                fontSize: 12,
                fontWeight: active ? 700 : 400,
                cursor: 'pointer',
                fontFamily: 'Manrope, sans-serif',
                lineHeight: 1,
                transition: 'border-color 0.15s, color 0.15s, background 0.15s',
                outline: 'none',
              }}
              onMouseEnter={e => {
                if (!active) {
                  e.currentTarget.style.borderColor = 'rgba(185,145,91,0.4)'
                  e.currentTarget.style.color = '#9AABB7'
                }
              }}
              onMouseLeave={e => {
                if (!active) {
                  e.currentTarget.style.borderColor = 'rgba(185,145,91,0.18)'
                  e.currentTarget.style.color = '#6B7280'
                }
              }}
            >
              {opt.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}
