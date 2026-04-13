/**
 * DarkTooltip — conteúdo de tooltip compartilhado para gráficos Recharts.
 * Uso: <Tooltip content={<DarkTooltip />} />
 * Ou: <Tooltip content={<DarkTooltip money />} /> para valores monetários.
 *
 * O estilo inline TT (contentStyle + cursorBar/cursorLine) também é exportado
 * para uso direto em <Tooltip contentStyle={TT.contentStyle} cursor={TT.cursorBar} />.
 */

import { fmtNum, fmtMoney } from '../../utils/format'

export default function DarkTooltip({ active, payload, label, money = false }) {
  if (!active || !payload?.length) return null
  return (
    <div style={{
      background: '#0D2236',
      border: '1px solid rgba(185,145,91,0.3)',
      borderRadius: 8,
      padding: '10px 14px',
      fontSize: 12,
      color: '#F5F4F3',
      boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
      fontFamily: 'Manrope, sans-serif',
    }}>
      {label && (
        <div style={{ color: '#8A9BAA', marginBottom: 6, fontWeight: 600 }}>{label}</div>
      )}
      {payload.map((p, i) => (
        <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 2 }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: p.color, flexShrink: 0 }} />
          <span style={{ color: '#8A9BAA' }}>{p.name}:</span>
          <span style={{ fontWeight: 600 }}>
            {money ? fmtMoney(p.value) : fmtNum(p.value)}
          </span>
        </div>
      ))}
    </div>
  )
}

/** Estilo inline para uso direto no prop contentStyle do Tooltip do Recharts */
export const TT = {
  contentStyle: {
    background: '#001A2E',
    border: '1px solid rgba(185,145,91,0.3)',
    borderRadius: 8,
    fontSize: 12,
    color: '#F5F4F3',
    fontFamily: 'Manrope, sans-serif',
  },
  cursorBar:  { fill: 'rgba(255,255,255,0.04)' },
  cursorLine: { stroke: 'rgba(185,145,91,0.25)', strokeWidth: 1 },
}
