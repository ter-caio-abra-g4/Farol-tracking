import { Database } from 'lucide-react'

export default function EmptyState({ icon: Icon = Database, title = 'Sem dados', description }) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '48px 24px',
        color: '#8A9BAA',
        gap: 12,
      }}
    >
      <Icon size={36} strokeWidth={1.2} style={{ opacity: 0.4 }} />
      <div style={{ fontSize: 14, fontWeight: 600, color: '#8A9BAA' }}>{title}</div>
      {description && <div style={{ fontSize: 12, opacity: 0.7, textAlign: 'center' }}>{description}</div>}
    </div>
  )
}
