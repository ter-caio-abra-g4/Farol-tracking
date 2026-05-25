import { useState, useEffect, useRef, useCallback, memo } from 'react'
import Header from '../components/layout/Header'
import Card, { CardHeader, CardBody } from '../components/ui/Card'
import { api } from '../services/api'
import { fmtNum } from '../utils/format'
import {
  Radio, RefreshCw, Filter, Clock, CheckCircle2, AlertTriangle,
  ChevronUp, ChevronDown, MapPin, Search, X,
} from 'lucide-react'
import { useTracking } from '../context/TrackingContext'

const POLL_MS = 30_000

const CONV_EVENTS = ['generate_lead', 'qualify_lead', 'MQL', 'begin_checkout', 'purchase']

const EVENT_COLORS = {
  generate_lead:  '#00BFD3',
  qualify_lead:   '#34D399',
  MQL:            '#C9A962',
  begin_checkout: '#F59E0B',
  purchase:       '#22C55E',
  form_start:     '#A855F7',
  form_submit:    '#6366F1',
  page_view:      '#4B6272',
}
function evColor(name) { return EVENT_COLORS[name] ?? '#6366F1' }

function fmtTime(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

const SELECT_STYLE = {
  background: '#001F35', border: '1px solid rgba(99,102,241,0.35)',
  borderRadius: 6, color: '#F5F4F3', padding: '5px 28px 5px 10px',
  fontSize: 12, cursor: 'pointer', outline: 'none', appearance: 'none',
  backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23A5B4FC' stroke-width='2'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E")`,
  backgroundRepeat: 'no-repeat', backgroundPosition: 'right 8px center',
  fontFamily: 'Manrope, sans-serif',
}

const INPUT_STYLE = {
  background: '#0D1B26', border: '1px solid rgba(99,102,241,0.3)',
  borderRadius: 6, padding: '5px 10px', fontSize: 12, color: '#F5F4F3',
  fontFamily: 'monospace', outline: 'none',
}

// ── Sort icon ─────────────────────────────────────────────────────────────────
function SortIcon({ col, sortBy, sortDir }) {
  if (sortBy !== col) return <ChevronDown size={10} color="#374151" />
  return sortDir === 'asc' ? <ChevronUp size={10} color="#A5B4FC" /> : <ChevronDown size={10} color="#A5B4FC" />
}

// ── Status badge ──────────────────────────────────────────────────────────────
function StatusBadge({ loading, mock, error }) {
  const isFatal = !mock && error
  const color   = isFatal ? '#EF4444' : mock ? '#F59E0B' : '#22C55E'
  const icon    = isFatal ? <AlertTriangle size={12} /> : mock ? <Clock size={12} /> : <CheckCircle2 size={12} />
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: `${color}12`, border: `1px solid ${color}40`, borderRadius: 6, padding: '4px 10px' }}>
      <span style={{ color }}>{icon}</span>
      <span style={{ fontSize: 11, fontWeight: 700, color }}>GA4 Realtime</span>
      <span style={{ fontSize: 10, color: '#6B7280' }}>~1 min</span>
      {loading && <RefreshCw size={10} color="#6B7280" style={{ animation: 'spin 1s linear infinite' }} />}
    </div>
  )
}

// ── Componente principal ──────────────────────────────────────────────────────
export default function LiveGA4Table() {
  const { selectedGA4 } = useTracking()
  const propertyId = selectedGA4 || '381992026'

  // Filtros de busca
  const [pageFilter,    setPageFilter]    = useState('')
  const [inputPage,     setInputPage]     = useState('')
  const [showPageSug,   setShowPageSug]   = useState(false)
  const [eventFilter,   setEventFilter]   = useState('')
  const [inputEvent,    setInputEvent]    = useState('')

  // Filtros de dropdown (derivados dos dados)
  const [srcFilter, setSrcFilter]   = useState('')
  const [medFilter, setMedFilter]   = useState('')
  const [cmpFilter, setCmpFilter]   = useState('')

  // Ordenação
  const [sortBy,  setSortBy]  = useState('count')
  const [sortDir, setSortDir] = useState('desc')

  // Dados e polling
  const [data,      setData]      = useState(null)
  const [loading,   setLoading]   = useState(false)
  const [isRunning, setIsRunning] = useState(true)
  const [countdown, setCountdown] = useState(POLL_MS / 1000)
  const [lastFetch, setLastFetch] = useState(null)

  const fetchData = useCallback(async () => {
    setLoading(true)
    const result = await api.liveGa4(propertyId, eventFilter || '', '', pageFilter || '')
    setData(result)
    setLoading(false)
    setLastFetch(new Date().toISOString())
    setCountdown(POLL_MS / 1000)
  }, [propertyId, eventFilter, pageFilter])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  useEffect(() => {
    if (!isRunning) return
    const iv = setInterval(fetchData, POLL_MS)
    return () => clearInterval(iv)
  }, [fetchData, isRunning])

  useEffect(() => {
    if (!isRunning) return
    const tick = setInterval(() => setCountdown(c => Math.max(0, c - 1)), 1000)
    return () => clearInterval(tick)
  }, [isRunning, data])

  // Dados brutos
  const allRows   = data?.utmRows   || []
  const topPages  = data?.topPages  || []

  // Listas de filtro derivadas dos rows
  const utmSources   = data?.utmSources?.length   ? data.utmSources   : [...new Set(allRows.map(r => r.source).filter(Boolean))].sort()
  const utmMediums   = data?.utmMediums?.length   ? data.utmMediums   : [...new Set(allRows.map(r => r.medium).filter(Boolean))].sort()
  const utmCampaigns = data?.utmCampaigns?.length ? data.utmCampaigns : [...new Set(allRows.map(r => r.campaign).filter(Boolean))].sort()
  const eventNames   = [...new Set(allRows.map(r => r.event).filter(Boolean))].sort()

  // Filtragem local (source/medium/campaign)
  const filtered = allRows.filter(r =>
    (!srcFilter || r.source   === srcFilter) &&
    (!medFilter || r.medium   === medFilter) &&
    (!cmpFilter || r.campaign === cmpFilter)
  )

  // Total para %
  const grandTotal = filtered.reduce((s, r) => s + r.count, 0)

  // Ordenação
  const sorted = [...filtered].sort((a, b) => {
    const aVal = sortBy === 'event'    ? a.event    :
                 sortBy === 'page'     ? (a.page || '') :
                 sortBy === 'source'   ? (a.source || '') :
                 sortBy === 'medium'   ? (a.medium || '') :
                 sortBy === 'campaign' ? (a.campaign || '') :
                 sortBy === 'users'    ? a.users :
                 a.count
    const bVal = sortBy === 'event'    ? b.event    :
                 sortBy === 'page'     ? (b.page || '') :
                 sortBy === 'source'   ? (b.source || '') :
                 sortBy === 'medium'   ? (b.medium || '') :
                 sortBy === 'campaign' ? (b.campaign || '') :
                 sortBy === 'users'    ? b.users :
                 b.count
    if (typeof aVal === 'string') return sortDir === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal)
    return sortDir === 'asc' ? aVal - bVal : bVal - aVal
  })

  const handleSort = (col) => {
    if (sortBy === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortBy(col); setSortDir('desc') }
  }

  const applyPage = () => { setPageFilter(inputPage.trim()); setShowPageSug(false) }
  const clearAll  = () => {
    setPageFilter(''); setInputPage(''); setEventFilter(''); setInputEvent('')
    setSrcFilter(''); setMedFilter(''); setCmpFilter('')
  }
  const hasFilters = pageFilter || eventFilter || srcFilter || medFilter || cmpFilter

  const COL_HEADERS = [
    { key: 'event',    label: 'Evento',    align: 'left',  flex: '130px' },
    { key: 'page',     label: 'Página',    align: 'left',  flex: '1'     },
    { key: 'source',   label: 'Source',    align: 'left',  flex: '80px'  },
    { key: 'medium',   label: 'Medium',    align: 'left',  flex: '70px'  },
    { key: 'campaign', label: 'Campaign',  align: 'left',  flex: '1'     },
    { key: 'users',    label: 'Usuários',  align: 'right', flex: '65px'  },
    { key: 'count',    label: 'Eventos',   align: 'right', flex: '65px'  },
    { key: 'pct',      label: '%',         align: 'right', flex: '45px', noSort: true },
  ]
  const gridCols = COL_HEADERS.map(c => c.flex).join(' ')

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

      <Header
        title="GA4 · Tabela ao Vivo"
        subtitle={`Property ${propertyId} · Realtime API · últimos 30 min · ${sorted.length} linha${sorted.length !== 1 ? 's' : ''}`}
        showGA4
        action={
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <StatusBadge loading={loading} mock={data?.mock} error={data?.error} />
            <div style={{ fontSize: 11, color: isRunning ? '#22C55E' : '#6B7280', display: 'flex', alignItems: 'center', gap: 5 }}>
              <Radio size={11} />
              {isRunning ? `${countdown}s` : 'Pausado'}
            </div>
            <button onClick={() => setIsRunning(r => !r)} style={{
              padding: '5px 12px', borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: 'pointer',
              fontFamily: 'Manrope, sans-serif',
              background: isRunning ? 'rgba(239,68,68,0.12)' : 'rgba(34,197,94,0.12)',
              border: `1px solid ${isRunning ? 'rgba(239,68,68,0.4)' : 'rgba(34,197,94,0.4)'}`,
              color: isRunning ? '#EF4444' : '#22C55E',
            }}>{isRunning ? 'Pausar' : 'Retomar'}</button>
            <button onClick={fetchData} style={{
              padding: '5px 10px', borderRadius: 6, fontSize: 11, cursor: 'pointer',
              background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.3)',
              color: '#A5B4FC', display: 'flex', alignItems: 'center', gap: 4,
            }}><RefreshCw size={11} /> Agora</button>
          </div>
        }
      />

      <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column', padding: '14px 20px', gap: 12 }}>

        {/* ── Filtros ── */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap',
          background: 'rgba(99,102,241,0.05)', border: '1px solid rgba(99,102,241,0.15)',
          borderRadius: 8, padding: '10px 16px',
        }}>
          <Filter size={13} color="#A5B4FC" />

          {/* Localização */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, position: 'relative' }}>
            <MapPin size={12} color="#8A9BAA" />
            <span style={{ fontSize: 11, color: '#8A9BAA', fontWeight: 700 }}>Localização:</span>
            <input
              value={inputPage}
              onChange={e => { setInputPage(e.target.value); setShowPageSug(true) }}
              onKeyDown={e => { if (e.key === 'Enter') applyPage() }}
              onBlur={() => setTimeout(() => setShowPageSug(false), 150)}
              placeholder="ex: /inscricao, summit"
              style={{ ...INPUT_STYLE, width: 190, border: `1px solid ${pageFilter ? 'rgba(99,102,241,0.6)' : 'rgba(99,102,241,0.3)'}` }}
            />
            <button onClick={applyPage} style={{
              padding: '5px 10px', borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: 'pointer',
              fontFamily: 'Manrope, sans-serif',
              background: pageFilter ? 'rgba(99,102,241,0.2)' : 'rgba(99,102,241,0.08)',
              border: `1px solid ${pageFilter ? 'rgba(99,102,241,0.6)' : 'rgba(99,102,241,0.25)'}`,
              color: pageFilter ? '#A5B4FC' : '#6B7280',
            }}>Filtrar</button>
            {pageFilter && (
              <button onClick={() => { setPageFilter(''); setInputPage('') }}
                style={{ padding: '4px 8px', borderRadius: 5, fontSize: 10, cursor: 'pointer', background: 'none', border: '1px solid rgba(239,68,68,0.3)', color: '#EF4444' }}>✕</button>
            )}
            {/* Autocomplete */}
            {showPageSug && inputPage.length > 0 && topPages.filter(p => p.page?.toLowerCase().includes(inputPage.toLowerCase())).length > 0 && (
              <div style={{ position: 'absolute', top: '100%', left: 86, zIndex: 100, background: '#0D1B26', border: '1px solid rgba(99,102,241,0.4)', borderRadius: 6, marginTop: 2, minWidth: 260, maxHeight: 160, overflowY: 'auto', boxShadow: '0 8px 24px rgba(0,0,0,0.5)' }}>
                {topPages.filter(p => p.page?.toLowerCase().includes(inputPage.toLowerCase())).slice(0, 8).map((p, i) => (
                  <div key={i}
                    onMouseDown={() => { setInputPage(p.page); setPageFilter(p.page); setShowPageSug(false) }}
                    style={{ padding: '7px 12px', cursor: 'pointer', fontSize: 11, color: '#C4D0DC', fontFamily: 'monospace', borderBottom: '1px solid rgba(255,255,255,0.04)' }}
                    onMouseEnter={e => e.currentTarget.style.background = 'rgba(99,102,241,0.12)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                  >
                    <div>{p.page}</div>
                    <div style={{ fontSize: 9, color: '#6B7280' }}>{fmtNum(p.views)} views agora</div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {pageFilter && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'rgba(99,102,241,0.12)', border: '1px solid rgba(99,102,241,0.4)', borderRadius: 5, padding: '3px 8px' }}>
              <MapPin size={9} color="#6366F1" />
              <span style={{ fontSize: 10, color: '#A5B4FC' }}>contém "{pageFilter}"</span>
            </div>
          )}

          <div style={{ width: 1, height: 20, background: 'rgba(255,255,255,0.08)' }} />

          {/* Evento */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 11, color: '#8A9BAA', fontWeight: 700 }}>Evento:</span>
            <select
              value={eventFilter}
              onChange={e => setEventFilter(e.target.value)}
              style={{ ...SELECT_STYLE, padding: '5px 24px 5px 10px', minWidth: 150 }}
            >
              <option value="">Todos os eventos</option>
              {eventNames.map(e => <option key={e} value={e}>{e}</option>)}
            </select>
            {eventFilter && <button onClick={() => setEventFilter('')} style={{ padding: '4px 7px', borderRadius: 4, fontSize: 10, cursor: 'pointer', background: 'none', border: '1px solid rgba(239,68,68,0.3)', color: '#EF4444' }}>✕</button>}
          </div>

          <div style={{ width: 1, height: 20, background: 'rgba(255,255,255,0.08)' }} />

          {/* Source / Medium / Campaign */}
          {[
            { label: 'Source',   value: srcFilter, setter: setSrcFilter, list: utmSources   },
            { label: 'Medium',   value: medFilter, setter: setMedFilter, list: utmMediums   },
            { label: 'Campaign', value: cmpFilter, setter: setCmpFilter, list: utmCampaigns },
          ].map(f => (
            <div key={f.label} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <span style={{ fontSize: 11, color: '#8A9BAA', fontWeight: 700 }}>{f.label}:</span>
              <select value={f.value} onChange={e => f.setter(e.target.value)}
                style={{ ...SELECT_STYLE, padding: '5px 24px 5px 8px', border: `1px solid ${f.value ? 'rgba(99,102,241,0.55)' : 'rgba(99,102,241,0.35)'}` }}>
                <option value="">Todos</option>
                {f.list.map(v => <option key={v} value={v}>{v || '(direct)'}</option>)}
              </select>
              {f.value && <button onClick={() => f.setter('')} style={{ padding: '3px 6px', borderRadius: 4, fontSize: 9, cursor: 'pointer', background: 'none', border: '1px solid rgba(239,68,68,0.3)', color: '#EF4444' }}>✕</button>}
            </div>
          ))}

          {hasFilters && (
            <>
              <div style={{ width: 1, height: 20, background: 'rgba(255,255,255,0.08)' }} />
              <button onClick={clearAll} style={{
                padding: '4px 10px', borderRadius: 5, fontSize: 11, cursor: 'pointer', fontWeight: 700,
                fontFamily: 'Manrope, sans-serif', display: 'flex', alignItems: 'center', gap: 4,
                background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#EF4444',
              }}>
                <X size={11} /> Limpar filtros
              </button>
            </>
          )}
        </div>

        {/* ── Tabela ── */}
        <Card style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
          {/* Header sticky */}
          <div style={{
            display: 'grid', gridTemplateColumns: gridCols, gap: 8,
            padding: '8px 16px', borderBottom: '2px solid rgba(99,102,241,0.2)',
            background: '#0A1825', flexShrink: 0,
          }}>
            {COL_HEADERS.map(col => (
              <div
                key={col.key}
                onClick={() => !col.noSort && handleSort(col.key)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 4,
                  justifyContent: col.align === 'right' ? 'flex-end' : 'flex-start',
                  fontSize: 10, color: sortBy === col.key ? '#A5B4FC' : '#6B7280',
                  fontWeight: 700, cursor: col.noSort ? 'default' : 'pointer',
                  userSelect: 'none',
                }}
              >
                {col.align === 'right' && !col.noSort && <SortIcon col={col.key} sortBy={sortBy} sortDir={sortDir} />}
                {col.label}
                {col.align !== 'right' && !col.noSort && <SortIcon col={col.key} sortBy={sortBy} sortDir={sortDir} />}
              </div>
            ))}
          </div>

          {/* Corpo com scroll */}
          <div style={{ flex: 1, overflowY: 'auto' }}>
            {sorted.length === 0 ? (
              <div style={{ padding: '40px', textAlign: 'center', color: '#6B7280', fontSize: 12 }}>
                {loading ? 'Carregando dados...' : hasFilters ? 'Nenhuma linha para estes filtros' : 'Sem dados nos últimos 30 min'}
              </div>
            ) : sorted.map((r, i) => {
              const color  = evColor(r.event)
              const isConv = CONV_EVENTS.includes(r.event)
              const pct    = grandTotal > 0 ? ((r.count / grandTotal) * 100).toFixed(1) : '0.0'
              return (
                <div
                  key={i}
                  style={{
                    display: 'grid', gridTemplateColumns: gridCols, gap: 8,
                    padding: '8px 16px', borderBottom: '1px solid rgba(255,255,255,0.04)',
                    background: isConv ? `${color}07` : 'transparent',
                    borderLeft: isConv ? `3px solid ${color}` : '3px solid transparent',
                    alignItems: 'center',
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.03)'}
                  onMouseLeave={e => e.currentTarget.style.background = isConv ? `${color}07` : 'transparent'}
                >
                  {/* Evento */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, overflow: 'hidden' }}>
                    <span style={{ width: 7, height: 7, borderRadius: '50%', background: color, flexShrink: 0, display: 'inline-block' }} />
                    <span style={{ fontSize: 11, color: isConv ? color : '#F5F4F3', fontFamily: 'monospace', fontWeight: isConv ? 700 : 400, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.event}</span>
                    {isConv && <span style={{ fontSize: 9, color, background: `${color}18`, borderRadius: 3, padding: '1px 4px', flexShrink: 0 }}>conv</span>}
                  </div>

                  {/* Página */}
                  <div style={{ fontSize: 11, color: '#8A9BAA', fontFamily: 'monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={r.page}>
                    {r.page || '—'}
                  </div>

                  {/* Source */}
                  <div>
                    {r.source
                      ? <span style={{ fontSize: 10, color: '#F5F4F3', background: 'rgba(255,255,255,0.06)', borderRadius: 3, padding: '2px 6px', fontWeight: 600 }}>{r.source}</span>
                      : <span style={{ fontSize: 10, color: '#374151' }}>(direct)</span>
                    }
                  </div>

                  {/* Medium */}
                  <div>
                    {r.medium
                      ? <span style={{ fontSize: 10, color: r.medium === 'cpc' ? '#F59E0B' : r.medium === 'organic' ? '#22C55E' : '#A5B4FC', background: 'rgba(255,255,255,0.05)', borderRadius: 3, padding: '2px 6px' }}>{r.medium}</span>
                      : <span style={{ fontSize: 10, color: '#374151' }}>—</span>
                    }
                  </div>

                  {/* Campaign */}
                  <div style={{ fontSize: 11, color: r.campaign ? '#C4D0DC' : '#374151', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={r.campaign}>
                    {r.campaign || '—'}
                  </div>

                  {/* Usuários */}
                  <div style={{ textAlign: 'right', fontSize: 11, color: '#8A9BAA' }}>{fmtNum(r.users)}</div>

                  {/* Eventos */}
                  <div style={{ textAlign: 'right', fontSize: 12, color: '#F5F4F3', fontWeight: 700 }}>{fmtNum(r.count)}</div>

                  {/* % */}
                  <div style={{ textAlign: 'right', fontSize: 10, color: '#6B7280' }}>{pct}%</div>
                </div>
              )
            })}
          </div>

          {/* Rodapé com totais */}
          {sorted.length > 0 && (
            <div style={{
              display: 'grid', gridTemplateColumns: gridCols, gap: 8,
              padding: '8px 16px', borderTop: '2px solid rgba(99,102,241,0.2)',
              background: '#0A1825', flexShrink: 0,
            }}>
              <div style={{ fontSize: 10, color: '#6B7280', fontWeight: 700 }}>{sorted.length} linhas</div>
              <div /><div /><div /><div />
              <div style={{ textAlign: 'right', fontSize: 11, color: '#8A9BAA', fontWeight: 700 }}>
                {fmtNum(sorted.reduce((s, r) => s + r.users, 0))}
              </div>
              <div style={{ textAlign: 'right', fontSize: 12, color: '#A5B4FC', fontWeight: 800 }}>
                {fmtNum(grandTotal)}
              </div>
              <div style={{ textAlign: 'right', fontSize: 10, color: '#6B7280' }}>100%</div>
            </div>
          )}
        </Card>

        {/* Atualizado às */}
        <div style={{ fontSize: 10, color: '#374151', textAlign: 'right' }}>
          Atualizado às {fmtTime(lastFetch)} · polling {POLL_MS / 1000}s
        </div>
      </div>
    </div>
  )
}
