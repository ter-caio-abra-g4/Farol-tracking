export default function Card({ children, style = {}, className = '' }) {
  return (
    <div
      className={className}
      style={{
        background: '#001F35',
        border: '1px solid #B9915B',
        borderRadius: 8,
        ...style,
      }}
    >
      {children}
    </div>
  )
}

export function CardHeader({ title, action, children }) {
  return (
    <div
      style={{
        padding: '16px 20px 12px',
        borderBottom: '1px solid rgba(185,145,91,0.2)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}
    >
      <div>
        {title && (
          <h3
            style={{
              fontFamily: "'PPMuseum','Georgia',serif",
              fontSize: 14,
              fontWeight: 600,
              color: '#B9915B',
              letterSpacing: '-0.01em',
            }}
          >
            {title}
          </h3>
        )}
        {children}
      </div>
      {action && <div>{action}</div>}
    </div>
  )
}

export function CardBody({ children, style = {} }) {
  return (
    <div style={{ padding: '16px 20px', ...style }}>
      {children}
    </div>
  )
}
