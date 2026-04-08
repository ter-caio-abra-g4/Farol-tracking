/**
 * StatusBadge — semáforo visual
 * status: 'ok' | 'warn' | 'error' | 'loading'
 */
const STATUS_CONFIG = {
  ok: {
    color: '#22C55E',
    bg: 'rgba(34,197,94,0.1)',
    border: 'rgba(34,197,94,0.3)',
    label: 'OK',
  },
  warn: {
    color: '#F59E0B',
    bg: 'rgba(245,158,11,0.1)',
    border: 'rgba(245,158,11,0.3)',
    label: 'Atenção',
  },
  error: {
    color: '#EF4444',
    bg: 'rgba(239,68,68,0.1)',
    border: 'rgba(239,68,68,0.3)',
    label: 'Erro',
  },
  loading: {
    color: '#8A9BAA',
    bg: 'rgba(138,155,170,0.1)',
    border: 'rgba(138,155,170,0.3)',
    label: '...',
  },
}

export default function StatusBadge({ status = 'ok', label, size = 'md' }) {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.ok
  const text = label ?? cfg.label

  const dotSize = size === 'sm' ? 7 : 9
  const fontSize = size === 'sm' ? 11 : 12
  const padding = size === 'sm' ? '3px 8px' : '4px 10px'

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        background: cfg.bg,
        border: `1px solid ${cfg.border}`,
        borderRadius: 20,
        padding,
        fontSize,
        fontWeight: 600,
        color: cfg.color,
        letterSpacing: '0.02em',
      }}
    >
      <span
        style={{
          width: dotSize,
          height: dotSize,
          borderRadius: '50%',
          background: cfg.color,
          flexShrink: 0,
          boxShadow: `0 0 6px ${cfg.color}88`,
        }}
      />
      {text}
    </span>
  )
}
