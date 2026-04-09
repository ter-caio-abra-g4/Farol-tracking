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
    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
      <span style={{
        fontSize: 11, color: '#8A9BAA', fontWeight: 600,
        letterSpacing: '0.04em', textTransform: 'uppercase', marginRight: 4,
      }}>
        Período
      </span>
      {options.map(opt => (
        <button
          key={opt.days}
          onClick={() => onChange(opt.days)}
          style={{
            padding: '3px 10px',
            borderRadius: 5,
            border: value === opt.days
              ? '1px solid rgba(185,145,91,0.6)'
              : '1px solid rgba(185,145,91,0.15)',
            background: value === opt.days
              ? 'rgba(185,145,91,0.12)'
              : 'transparent',
            color: value === opt.days ? '#B9915B' : '#6B7280',
            fontSize: 11,
            fontWeight: value === opt.days ? 700 : 400,
            cursor: 'pointer',
            fontFamily: 'Manrope, sans-serif',
            transition: 'all 0.15s',
          }}
        >
          {opt.label}
        </button>
      ))}
    </div>
  )
}
