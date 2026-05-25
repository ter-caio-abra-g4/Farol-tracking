import { RefreshCw, Clock, AlertTriangle } from 'lucide-react'
import { useState } from 'react'
import { useTracking } from '../../context/TrackingContext'

const SELECT_STYLE = {
  background: 'rgba(255,255,255,0.05)',
  border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: 8,
  color: '#EEF2F6',
  padding: '6px 28px 6px 10px',
  fontSize: 12,
  fontWeight: 500,
  cursor: 'pointer',
  outline: 'none',
  appearance: 'none',
  maxWidth: 200,
  backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='11' height='11' viewBox='0 0 24 24' fill='none' stroke='%23C9A962' stroke-width='2'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E")`,
  backgroundRepeat: 'no-repeat',
  backgroundPosition: 'right 8px center',
  fontFamily: 'Manrope, sans-serif',
  transition: 'border-color 0.15s ease, background 0.15s ease',
}

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

  return (
    <div style={{
      borderBottom: '1px solid rgba(255,255,255,0.07)',
      background: 'rgba(6,15,24,0.6)',
      backdropFilter: 'blur(8px)',
      flexShrink: 0,
    }}>

      {/* Linha 1: título · selects · action */}
      <div style={{
        padding: '14px 24px 12px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 16,
      }}>
        {/* Título */}
        <div style={{ flexShrink: 0 }}>
          <h1 style={{
            fontFamily: "'PPMuseum','Georgia',serif",
            fontSize: 19,
            fontWeight: 600,
            color: '#C9A962',
            letterSpacing: '-0.025em',
            lineHeight: 1.2,
          }}>
            {title}
          </h1>
          {subtitle && (
            <p style={{ fontSize: 11.5, color: '#506070', marginTop: 3, letterSpacing: '0.01em' }}>{subtitle}</p>
          )}
        </div>

        {/* Selects contextuais */}
        {hasSelects && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, justifyContent: 'center' }}>
            {showGTM && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 10, color: '#506070', whiteSpace: 'nowrap', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' }}>GTM</span>
                <select value={selectedGTM} onChange={(e) => setSelectedGTM(e.target.value)} style={SELECT_STYLE}>
                  <option value="all">Todos os containers</option>
                  {gtmContainers.map(c => (
                    <option key={c.id} value={c.id}>{c.name || c.id}</option>
                  ))}
                </select>
              </div>
            )}
            {showGTM && showGA4 && (
              <div style={{ width: 1, height: 16, background: 'rgba(255,255,255,0.08)' }} />
            )}
            {showGA4 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 10, color: '#506070', whiteSpace: 'nowrap', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' }}>GA4</span>
                <select value={selectedGA4} onChange={(e) => setSelectedGA4(e.target.value)} style={SELECT_STYLE}>
                  {ga4Properties.map(p => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>
            )}
          </div>
        )}

        {/* Select legado */}
        {select && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 11, color: '#506070', whiteSpace: 'nowrap' }}>{select.label}</span>
            <select value={select.value} onChange={(e) => select.onChange(e.target.value)} style={SELECT_STYLE}>
              {select.groups
                ? select.groups.map((g) => (
                    <optgroup key={g.label} label={g.label}>
                      {g.options.map((opt) => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </optgroup>
                  ))
                : select.options.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))
              }
            </select>
          </div>
        )}
      </div>

      {/* Linha 2: action · hora + refresh */}
      {(action || time || onRefresh) && (
        <div style={{
          padding: '6px 24px 10px',
          borderTop: '1px solid rgba(255,255,255,0.04)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
        }}>
          <div>{action || <span />}</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
            {time && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 5, color: '#506070', fontSize: 11 }}>
                <Clock size={11} />
                <span>Atualizado às {time}</span>
              </div>
            )}
            {onRefresh && (
              <button
                onClick={handleRefresh}
                style={{
                  background: 'rgba(255,255,255,0.04)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: 7,
                  padding: '4px 10px',
                  color: '#C9A962',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 5,
                  fontSize: 11,
                  fontWeight: 500,
                  fontFamily: 'Manrope, sans-serif',
                  transition: 'border-color 0.15s ease, background 0.15s ease',
                }}
                onMouseEnter={e => { e.currentTarget.style.background = 'rgba(201,169,98,0.08)'; e.currentTarget.style.borderColor = 'rgba(201,169,98,0.3)' }}
                onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)' }}
              >
                <RefreshCw size={11} style={{ transition: 'transform 0.8s ease', transform: spinning ? 'rotate(360deg)' : 'rotate(0deg)' }} />
                Atualizar
              </button>
            )}
          </div>
        </div>
      )}

      {/* Badge: Dados simulados */}
      {isMock && (
        <div style={{
          padding: '6px 24px',
          background: 'rgba(245,158,11,0.06)',
          borderTop: '1px solid rgba(245,158,11,0.15)',
          display: 'flex',
          alignItems: 'center',
          gap: 6,
        }}>
          <AlertTriangle size={11} color="#F59E0B" />
          <span style={{ fontSize: 11, color: '#F59E0B', fontWeight: 500, opacity: 0.85 }}>
            Dados simulados — conecte as APIs em Configurações para dados reais
          </span>
        </div>
      )}
    </div>
  )
}
