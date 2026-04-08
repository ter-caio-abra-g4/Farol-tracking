import { TrendingUp, TrendingDown, Minus } from 'lucide-react'

export default function Metric({ label, value, delta, deltaLabel, status }) {
  const statusColors = {
    ok: '#22C55E',
    warn: '#F59E0B',
    error: '#EF4444',
  }

  const deltaNum = parseFloat(delta)
  const deltaColor = deltaNum > 0 ? '#22C55E' : deltaNum < 0 ? '#EF4444' : '#8A9BAA'
  const DeltaIcon = deltaNum > 0 ? TrendingUp : deltaNum < 0 ? TrendingDown : Minus

  return (
    <div>
      <div style={{ fontSize: 11, color: '#8A9BAA', marginBottom: 6, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
        {label}
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
        <span
          style={{
            fontSize: 28,
            fontWeight: 700,
            color: status ? statusColors[status] ?? '#F5F4F3' : '#F5F4F3',
            fontFamily: 'Manrope, sans-serif',
            lineHeight: 1,
          }}
        >
          {value}
        </span>
        {delta !== undefined && (
          <span
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 3,
              fontSize: 12,
              fontWeight: 600,
              color: deltaColor,
            }}
          >
            <DeltaIcon size={12} />
            {deltaLabel ?? delta}
          </span>
        )}
      </div>
    </div>
  )
}
