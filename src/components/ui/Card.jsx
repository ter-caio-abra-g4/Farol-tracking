export default function Card({ children, style = {}, className = '', onClick }) {
  return (
    <div
      className={className}
      onClick={onClick}
      style={{
        background: '#0E2030',
        border: '1px solid rgba(255,255,255,0.09)',
        borderRadius: 12,
        boxShadow: '0 1px 3px rgba(0,0,0,0.35), 0 4px 14px rgba(0,0,0,0.18)',
        ...(onClick ? { cursor: 'pointer' } : {}),
        ...style,
      }}
    >
      {children}
    </div>
  )
}

export function CardHeader({ title, subtitle, action, children }) {
  return (
    <div style={{
      padding: '13px 18px 11px',
      borderBottom: '1px solid rgba(255,255,255,0.07)',
      display: 'flex',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      gap: 12,
    }}>
      <div style={{ minWidth: 0 }}>
        {title && (
          <h3 style={{
            fontFamily: "'PPMuseum','Georgia',serif",
            fontSize: 13,
            fontWeight: 600,
            color: '#C9A962',
            letterSpacing: '-0.01em',
            lineHeight: 1.3,
          }}>
            {title}
          </h3>
        )}
        {subtitle && (
          <div style={{ fontSize: 11, color: '#5A7080', marginTop: 2 }}>{subtitle}</div>
        )}
        {children}
      </div>
      {action && <div style={{ flexShrink: 0 }}>{action}</div>}
    </div>
  )
}

export function CardBody({ children, style = {} }) {
  return (
    <div style={{ padding: '14px 18px', ...style }}>
      {children}
    </div>
  )
}
