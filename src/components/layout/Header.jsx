import { RefreshCw, Clock } from 'lucide-react'
import { useState } from 'react'
import { useTracking } from '../../context/TrackingContext'

const SELECT_STYLE = {
  background: '#001F35',
  border: '1px solid rgba(185,145,91,0.4)',
  borderRadius: 6,
  color: '#F5F4F3',
  padding: '6px 28px 6px 10px',
  fontSize: 12,
  fontWeight: 500,
  cursor: 'pointer',
  outline: 'none',
  appearance: 'none',
  maxWidth: 180,
  backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23B9915B' stroke-width='2'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E")`,
  backgroundRepeat: 'no-repeat',
  backgroundPosition: 'right 8px center',
  fontFamily: 'Manrope, sans-serif',
}

// showGTM / showGA4: controla quais seletores globais aparecem por tela.
// Padrão false — cada página declara explicitamente o que precisa.
export default function Header({ title, subtitle, onRefresh, lastUpdated, select, action, showGTM = false, showGA4 = false }) {
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
      borderBottom: '1px solid rgba(185,145,91,0.15)',
      flexShrink: 0,
    }}>

      {/* ── Linha 1: título · selects contextuais · action ── */}
      <div style={{
        padding: '14px 28px 12px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 16,
      }}>
        {/* Título */}
        <div style={{ flexShrink: 0 }}>
          <h1 style={{
            fontFamily: "'PPMuseum','Georgia',serif",
            fontSize: 20,
            fontWeight: 600,
            color: '#B9915B',
            letterSpacing: '-0.02em',
            lineHeight: 1.2,
          }}>
            {title}
          </h1>
          {subtitle && (
            <p style={{ fontSize: 12, color: '#8A9BAA', marginTop: 2 }}>{subtitle}</p>
          )}
        </div>

        {/* Selects contextuais — só aparecem quando a tela precisa */}
        {hasSelects && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1, justifyContent: 'center' }}>
            {showGTM && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 11, color: '#8A9BAA', whiteSpace: 'nowrap', fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase' }}>GTM</span>
                <select value={selectedGTM} onChange={(e) => setSelectedGTM(e.target.value)} style={SELECT_STYLE}>
                  <option value="all">Todos os containers</option>
                  {gtmContainers.map(c => (
                    <option key={c.id} value={c.id}>{c.name || c.id}</option>
                  ))}
                </select>
              </div>
            )}

            {showGTM && showGA4 && (
              <div style={{ width: 1, height: 20, background: 'rgba(185,145,91,0.2)' }} />
            )}

            {showGA4 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 11, color: '#8A9BAA', whiteSpace: 'nowrap', fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase' }}>GA4</span>
                <select value={selectedGA4} onChange={(e) => setSelectedGA4(e.target.value)} style={SELECT_STYLE}>
                  {ga4Properties.map(p => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>
            )}
          </div>
        )}

        {/* Select legado (páginas específicas) */}
        {select && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 12, color: '#8A9BAA', whiteSpace: 'nowrap' }}>{select.label}</span>
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

      {/* ── Linha 2: seletor de período · · · hora + Atualizar ── */}
      {(action || time || onRefresh) && <div style={{
        padding: '6px 28px 10px',
        borderTop: '1px solid rgba(185,145,91,0.07)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
      }}>
        {/* Esquerda: action customizado (ex: seletor de período) */}
        <div>
          {action || <span />}
        </div>

        {/* Direita: hora + refresh */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
          {time && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, color: '#8A9BAA', fontSize: 11 }}>
              <Clock size={12} />
              <span>Atualizado às {time}</span>
            </div>
          )}
          <button
            onClick={handleRefresh}
            style={{
              background: 'rgba(185,145,91,0.08)',
              border: '1px solid rgba(185,145,91,0.25)',
              borderRadius: 6,
              padding: '4px 10px',
              color: '#B9915B',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 5,
              fontSize: 11,
              fontWeight: 500,
              fontFamily: 'Manrope, sans-serif',
            }}
          >
            <RefreshCw
              size={11}
              style={{
                transition: 'transform 0.8s ease',
                transform: spinning ? 'rotate(360deg)' : 'rotate(0deg)',
              }}
            />
            Atualizar
          </button>
        </div>
      </div>}

    </div>
  )
}
