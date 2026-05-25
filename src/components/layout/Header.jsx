import { RefreshCw, Clock, AlertTriangle } from 'lucide-react'
import { useState } from 'react'
import { useTracking } from '../../context/TrackingContext'
import Select from '../ui/Select'

export default function Header({ title, subtitle, onRefresh, lastUpdated, select, action, showGTM = false, showGA4 = false, isMock = false }) {
  const [spinning, setSpinning] = useState(false)
  const { gtmContainers, selectedGTM, setSelectedGTM, ga4Properties, selectedGA4, setSelectedGA4 } = useTracking()

  const handleRefresh = () => {
    setSpinning(true)
    setTimeout(() => setSpinning(false), 800)
    onRefresh?.()
  }

  const time = lastUpdated
    ? new Date(lastUpdated).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
    : null

  const hasSelects = showGTM || showGA4

  const gtmOptions = [
    { value: 'all', label: 'Todos os containers' },
    ...gtmContainers.map(c => ({ value: c.id, label: c.name || c.id })),
  ]

  const ga4Options = ga4Properties.map(p => ({ value: p.id, label: p.name }))

  return (
    <div style={{
      borderBottom: '1px solid rgba(255,255,255,0.07)',
      background: 'rgba(8,20,32,0.75)',
      backdropFilter: 'blur(10px)',
      flexShrink: 0,
    }}>

      {/* Linha 1: título · selects · action */}
      <div style={{ padding: '14px 24px 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>

        {/* Título */}
        <div style={{ flexShrink: 0 }}>
          <h1 style={{ fontFamily: "'PPMuseum','Georgia',serif", fontSize: 19, fontWeight: 600, color: '#C9A962', letterSpacing: '-0.025em', lineHeight: 1.2 }}>
            {title}
          </h1>
          {subtitle && <p style={{ fontSize: 11.5, color: '#4E6070', marginTop: 3 }}>{subtitle}</p>}
        </div>

        {/* Selects contextuais com componente custom */}
        {hasSelects && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, justifyContent: 'center' }}>
            {showGTM && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                <span style={{ fontSize: 10, color: '#4E6070', fontWeight: 700, letterSpacing: '0.09em', textTransform: 'uppercase' }}>GTM</span>
                <Select value={selectedGTM || 'all'} onChange={setSelectedGTM} options={gtmOptions} placeholder="Todos" minWidth={160} />
              </div>
            )}
            {showGTM && showGA4 && <div style={{ width: 1, height: 16, background: 'rgba(255,255,255,0.08)' }} />}
            {showGA4 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                <span style={{ fontSize: 10, color: '#4E6070', fontWeight: 700, letterSpacing: '0.09em', textTransform: 'uppercase' }}>GA4</span>
                <Select value={selectedGA4} onChange={setSelectedGA4} options={ga4Options} placeholder="Property" minWidth={180} />
              </div>
            )}
          </div>
        )}

        {/* Select legado */}
        {select && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 11, color: '#4E6070', whiteSpace: 'nowrap' }}>{select.label}</span>
            <Select
              value={select.value}
              onChange={select.onChange}
              options={select.groups
                ? select.groups.flatMap(g => [{ label: g.label, options: g.options }])
                : select.options}
              minWidth={160}
            />
          </div>
        )}
      </div>

      {/* Linha 2: action · hora + refresh */}
      {(action || time || onRefresh) && (
        <div style={{ padding: '6px 24px 10px', borderTop: '1px solid rgba(255,255,255,0.04)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <div>{action || <span />}</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
            {time && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 5, color: '#4E6070', fontSize: 11 }}>
                <Clock size={11} />
                <span>Atualizado às {time}</span>
              </div>
            )}
            {onRefresh && (
              <button
                onClick={handleRefresh}
                style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 7, padding: '4px 10px', color: '#C9A962', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, fontWeight: 500, fontFamily: 'Manrope, sans-serif', transition: 'border-color 0.15s, background 0.15s' }}
                onMouseEnter={e => { e.currentTarget.style.background = 'rgba(201,169,98,0.09)'; e.currentTarget.style.borderColor = 'rgba(201,169,98,0.3)' }}
                onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)' }}
              >
                <RefreshCw size={11} style={{ transition: 'transform 0.8s', transform: spinning ? 'rotate(360deg)' : 'rotate(0deg)' }} />
                Atualizar
              </button>
            )}
          </div>
        </div>
      )}

      {/* Mock banner */}
      {isMock && (
        <div style={{ padding: '6px 24px', background: 'rgba(245,158,11,0.06)', borderTop: '1px solid rgba(245,158,11,0.12)', display: 'flex', alignItems: 'center', gap: 6 }}>
          <AlertTriangle size={11} color="#F59E0B" />
          <span style={{ fontSize: 11, color: '#F59E0B', fontWeight: 500, opacity: 0.85 }}>Dados simulados — conecte as APIs em Configurações para dados reais</span>
        </div>
      )}
    </div>
  )
}
