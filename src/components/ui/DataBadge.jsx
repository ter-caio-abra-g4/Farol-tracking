// DataBadge — exibe STALE (dado real desatualizado), MOCK (dado fabricado) ou nada (dado fresco)
export default function DataBadge({ data }) {
  if (!data) return null
  if (data._stale) {
    const mins = Math.round((Date.now() - data._stale_ts) / 60000)
    return (
      <span
        title={`Último dado real obtido há ${mins} min — API indisponível, tentando de novo`}
        style={{
          fontSize: 10, color: '#B9915B', background: 'rgba(185,145,91,0.12)',
          border: '1px solid rgba(185,145,91,0.3)', padding: '2px 7px', borderRadius: 4, fontWeight: 700,
        }}
      >STALE {mins}m</span>
    )
  }
  if (data.mock) {
    return (
      <span style={{
        fontSize: 10, color: '#F59E0B', background: 'rgba(245,158,11,0.1)',
        border: '1px solid rgba(245,158,11,0.2)', padding: '2px 7px', borderRadius: 4, fontWeight: 700,
      }}>MOCK</span>
    )
  }
  return null
}
