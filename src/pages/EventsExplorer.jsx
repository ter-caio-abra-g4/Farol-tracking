import { useState, useEffect, useMemo } from 'react'
import Header from '../components/layout/Header'
import Card, { CardHeader, CardBody } from '../components/ui/Card'
import { api } from '../services/api'
import { fmtNum } from '../utils/format'
import { useTracking } from '../context/TrackingContext'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from 'recharts'
import { TT } from '../components/ui/DarkTooltip'
import { Search, Filter } from 'lucide-react'

// ── Cores por evento ──────────────────────────────────────────────────────────
const EVENT_COLORS = {
  generate_lead:   '#00BFD3',
  qualify_lead:    '#34D399',
  MQL:             '#C9A962',
  begin_checkout:  '#F59E0B',
  purchase:        '#34D399',
  form_start:      '#A855F7',
  form_submit:     '#6366F1',
  disqualify_lead: '#EF4444',
  page_view:       '#4B6272',
  scroll:          '#374151',
  click:           '#374151',
}

const CONV_EVENTS = new Set(['generate_lead', 'qualify_lead', 'MQL', 'begin_checkout', 'purchase'])

function eventColor(name) {
  return EVENT_COLORS[name] ?? '#4B6272'
}

// ── Período select simples ────────────────────────────────────────────────────
const DAYS_OPTIONS = [
  { value: 7,  label: '7 dias' },
  { value: 14, label: '14 dias' },
  { value: 28, label: '28 dias' },
  { value: 90, label: '90 dias' },
]

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
  backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23B9915B' stroke-width='2'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E")`,
  backgroundRepeat: 'no-repeat',
  backgroundPosition: 'right 8px center',
  fontFamily: 'Manrope, sans-serif',
}

const INPUT_STYLE = {
  background: '#001F35',
  border: '1px solid rgba(185,145,91,0.3)',
  borderRadius: 6,
  color: '#F5F4F3',
  padding: '6px 12px 6px 32px',
  fontSize: 12,
  outline: 'none',
  fontFamily: 'Manrope, sans-serif',
  width: 200,
}

// ── Custom tooltip ────────────────────────────────────────────────────────────
function EventTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div style={TT.contentStyle}>
      <div style={{ fontWeight: 700, marginBottom: 4, fontSize: 11, fontFamily: 'monospace' }}>{label}</div>
      {payload.map((p, i) => (
        <div key={i} style={{ color: p.fill ?? p.color, fontSize: 11 }}>
          {p.name}: {fmtNum(p.value)}
        </div>
      ))}
    </div>
  )
}

// ── Componente principal ──────────────────────────────────────────────────────
export default function EventsExplorer() {
  const { selectedGA4 } = useTracking()
  const [rows, setRows]           = useState([])
  const [loading, setLoading]     = useState(false)
  const [isMock, setIsMock]       = useState(false)
  const [days, setDays]           = useState(28)
  const [pageSearch, setPageSearch]   = useState('')
  const [selectedPage, setSelectedPage] = useState(null)
  const [eventFilter, setEventFilter]   = useState('all')
  const [onlyConv, setOnlyConv]         = useState(false)

  const propertyId = selectedGA4 || '521780491'

  useEffect(() => {
    setLoading(true)
    setSelectedPage(null)
    api.ga4EventsByPage(propertyId, days).then(r => {
      setRows(r?.rows ?? [])
      setIsMock(r?.mock ?? false)
      setLoading(false)
    })
  }, [propertyId, days])

  // Páginas únicas ordenadas por total de eventos de conversão
  const pages = useMemo(() => {
    const map = new Map()
    for (const r of rows) {
      if (!map.has(r.pagePath)) map.set(r.pagePath, { pagePath: r.pagePath, total: 0, convTotal: 0 })
      map.get(r.pagePath).total += r.count
      if (CONV_EVENTS.has(r.event)) map.get(r.pagePath).convTotal += r.count
    }
    return [...map.values()]
      .filter(p => !pageSearch || p.pagePath.toLowerCase().includes(pageSearch.toLowerCase()))
      .sort((a, b) => b.convTotal - a.convTotal || b.total - a.total)
  }, [rows, pageSearch])

  // Eventos únicos disponíveis
  const allEvents = useMemo(() => [...new Set(rows.map(r => r.event))].sort(), [rows])

  // Linhas filtradas para a página selecionada
  const pageRows = useMemo(() => {
    if (!selectedPage) return []
    return rows
      .filter(r =>
        r.pagePath === selectedPage &&
        (eventFilter === 'all' || r.event === eventFilter) &&
        (!onlyConv || CONV_EVENTS.has(r.event))
      )
      .sort((a, b) => b.count - a.count)
  }, [rows, selectedPage, eventFilter, onlyConv])

  const maxCount = pageRows[0]?.count ?? 1

  // Dados para o gráfico de barras
  const chartData = pageRows.slice(0, 12).map(r => ({
    event: r.event,
    count: r.count,
    users: r.users,
    fill:  eventColor(r.event),
  }))

  // Totais de conversão para a página selecionada
  const convSummary = useMemo(() => {
    if (!selectedPage) return null
    const get = (ev) => rows.find(r => r.pagePath === selectedPage && r.event === ev)?.count ?? 0
    return {
      leads:    get('generate_lead'),
      qual:     get('qualify_lead'),
      mql:      get('MQL'),
      checkout: get('begin_checkout'),
      purchase: get('purchase'),
    }
  }, [rows, selectedPage])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      <Header
        title="Explorer de Eventos por Página"
        subtitle={`GA4 · property ${propertyId} · ${days} dias`}
        showGA4
        isMock={isMock}
        action={
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 11, color: '#8A9BAA', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Período</span>
            <select value={days} onChange={e => setDays(Number(e.target.value))} style={SELECT_STYLE}>
              {DAYS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
        }
        onRefresh={() => {
          setLoading(true)
          api.ga4EventsByPage(propertyId, days).then(r => {
            setRows(r?.rows ?? [])
            setIsMock(r?.mock ?? false)
            setLoading(false)
          })
        }}
      />

      <div style={{ flex: 1, overflowY: 'auto', padding: '20px 28px', display: 'flex', flexDirection: 'column', gap: 20 }}>

        {/* ── Layout: lista de páginas (esq) + detalhe (dir) ── */}
        <div style={{ display: 'grid', gridTemplateColumns: '260px 1fr', gap: 20, alignItems: 'start' }}>

          {/* ── Lista de páginas ── */}
          <Card>
            <CardHeader
              title="Páginas"
              subtitle={`${pages.length} página${pages.length !== 1 ? 's' : ''} com eventos de conversão`}
            />
            <CardBody style={{ padding: '8px 0' }}>
              {/* Search */}
              <div style={{ padding: '0 12px 10px', position: 'relative' }}>
                <Search size={13} style={{ position: 'absolute', left: 20, top: '50%', transform: 'translateY(-50%)', color: '#4B6272' }} />
                <input
                  style={INPUT_STYLE}
                  placeholder="Buscar página..."
                  value={pageSearch}
                  onChange={e => setPageSearch(e.target.value)}
                />
              </div>
              {loading ? (
                <div style={{ padding: '20px 16px', textAlign: 'center', color: '#6B7280', fontSize: 12 }}>Carregando…</div>
              ) : (
                <div style={{ maxHeight: 520, overflowY: 'auto' }}>
                  {pages.map(p => (
                    <div
                      key={p.pagePath}
                      onClick={() => { setSelectedPage(p.pagePath); setEventFilter('all') }}
                      style={{
                        padding: '8px 16px',
                        cursor: 'pointer',
                        background: selectedPage === p.pagePath ? 'rgba(185,145,91,0.08)' : 'transparent',
                        borderLeft: selectedPage === p.pagePath ? '2px solid #B9915B' : '2px solid transparent',
                        transition: 'background 0.12s',
                      }}
                    >
                      <div style={{
                        fontSize: 11, color: selectedPage === p.pagePath ? '#F5F4F3' : '#C4D0DC',
                        fontFamily: 'monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      }} title={p.pagePath}>
                        {p.pagePath}
                      </div>
                      <div style={{ display: 'flex', gap: 10, marginTop: 3 }}>
                        <span style={{ fontSize: 10, color: '#00BFD3' }}>{fmtNum(p.convTotal)} conv</span>
                        <span style={{ fontSize: 10, color: '#4B6272' }}>{fmtNum(p.total)} total</span>
                      </div>
                    </div>
                  ))}
                  {pages.length === 0 && (
                    <div style={{ padding: '20px 16px', textAlign: 'center', color: '#6B7280', fontSize: 12 }}>
                      {pageSearch ? 'Nenhuma página encontrada' : 'Sem dados'}
                    </div>
                  )}
                </div>
              )}
            </CardBody>
          </Card>

          {/* ── Detalhe da página ── */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {!selectedPage ? (
              <Card>
                <CardBody>
                  <div style={{ padding: '40px 0', textAlign: 'center', color: '#6B7280', fontSize: 13 }}>
                    Selecione uma página para ver os eventos
                  </div>
                </CardBody>
              </Card>
            ) : (
              <>
                {/* Funil rápido de conversão */}
                {convSummary && convSummary.leads > 0 && (
                  <Card>
                    <CardHeader
                      title="Funil de conversão"
                      subtitle={`Eventos de conversão em ${selectedPage}`}
                    />
                    <CardBody>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 10 }}>
                        {[
                          { label: 'Lead',     value: convSummary.leads,    color: '#00BFD3' },
                          { label: 'Qualif.',  value: convSummary.qual,     color: '#34D399' },
                          { label: 'MQL',      value: convSummary.mql,      color: '#C9A962' },
                          { label: 'Checkout', value: convSummary.checkout, color: '#F59E0B' },
                          { label: 'Purchase', value: convSummary.purchase, color: '#34D399' },
                        ].map((s, i, arr) => {
                          const prev = arr[i - 1]?.value
                          const rate = prev && prev > 0 ? ((s.value / prev) * 100).toFixed(1) + '%' : null
                          return (
                            <div key={s.label} style={{
                              background: '#031A26', border: `1px solid ${s.color}30`,
                              borderRadius: 8, padding: '10px 12px', textAlign: 'center',
                              borderTop: `2px solid ${s.color}`,
                            }}>
                              <div style={{ fontSize: 18, fontWeight: 800, color: s.value > 0 ? '#F5F4F3' : '#374151' }}>
                                {fmtNum(s.value)}
                              </div>
                              <div style={{ fontSize: 10, color: s.color, fontWeight: 700, marginTop: 3 }}>{s.label}</div>
                              {rate && <div style={{ fontSize: 9, color: '#6B7280', marginTop: 2 }}>{rate}</div>}
                            </div>
                          )
                        })}
                      </div>
                    </CardBody>
                  </Card>
                )}

                {/* Filtros */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                  <code style={{
                    fontSize: 11, color: '#B9915B', background: 'rgba(185,145,91,0.1)',
                    padding: '4px 10px', borderRadius: 5, fontFamily: 'monospace',
                    maxWidth: 320, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }} title={selectedPage}>{selectedPage}</code>

                  <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                    <Filter size={11} style={{ position: 'absolute', left: 8, color: '#4B6272' }} />
                    <select
                      value={eventFilter}
                      onChange={e => setEventFilter(e.target.value)}
                      style={{ ...SELECT_STYLE, paddingLeft: 24, width: 180 }}
                    >
                      <option value="all">Todos os eventos</option>
                      {allEvents.map(ev => <option key={ev} value={ev}>{ev}</option>)}
                    </select>
                  </div>

                  <button
                    onClick={() => setOnlyConv(v => !v)}
                    style={{
                      padding: '5px 12px', borderRadius: 6, fontSize: 11, fontWeight: 700,
                      cursor: 'pointer', fontFamily: 'Manrope, sans-serif',
                      background: onlyConv ? 'rgba(0,191,211,0.15)' : 'rgba(185,145,91,0.08)',
                      border: `1px solid ${onlyConv ? 'rgba(0,191,211,0.5)' : 'rgba(185,145,91,0.25)'}`,
                      color: onlyConv ? '#00BFD3' : '#B9915B',
                    }}
                  >
                    Só conversões
                  </button>
                </div>

                {/* Gráfico de barras */}
                {chartData.length > 0 && (
                  <Card>
                    <CardHeader title="Distribuição de eventos" subtitle="Contagem de disparos por evento" />
                    <CardBody>
                      <ResponsiveContainer width="100%" height={160}>
                        <BarChart data={chartData} margin={{ top: 4, right: 12, left: 0, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                          <XAxis dataKey="event" tick={{ fill: '#8A9BAA', fontSize: 9, fontFamily: 'monospace' }}
                            axisLine={false} tickLine={false} interval={0}
                            angle={-20} textAnchor="end" height={36}
                          />
                          <YAxis tick={{ fill: '#8A9BAA', fontSize: 9 }} axisLine={false} tickLine={false} allowDecimals={false} />
                          <Tooltip content={<EventTooltip />} cursor={{ fill: 'rgba(255,255,255,0.03)' }} />
                          <Bar dataKey="count" name="Disparos" radius={[3, 3, 0, 0]}>
                            {chartData.map((d, i) => <Cell key={i} fill={d.fill} />)}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </CardBody>
                  </Card>
                )}

                {/* Tabela de eventos */}
                <Card>
                  <CardHeader
                    title="Eventos nesta página"
                    subtitle={`${pageRows.length} evento${pageRows.length !== 1 ? 's' : ''} · ${days} dias`}
                  />
                  <CardBody style={{ padding: 0 }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 80px 80px', gap: 8, padding: '6px 16px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                      {['Evento', 'Disparos', 'Usuários'].map((h, i) => (
                        <div key={i} style={{ fontSize: 10, color: '#6B7280', fontWeight: 700, textAlign: i > 0 ? 'right' : 'left' }}>{h}</div>
                      ))}
                    </div>
                    {pageRows.length === 0 ? (
                      <div style={{ padding: '24px 16px', textAlign: 'center', color: '#6B7280', fontSize: 12 }}>Sem dados para este filtro</div>
                    ) : pageRows.map((r, i) => {
                      const color  = eventColor(r.event)
                      const isConv = CONV_EVENTS.has(r.event)
                      const pct    = (r.count / maxCount) * 100
                      return (
                        <div key={i} style={{
                          padding: '8px 16px',
                          borderBottom: '1px solid rgba(255,255,255,0.04)',
                          background: isConv ? 'rgba(0,191,211,0.03)' : 'transparent',
                          borderLeft: isConv ? `2px solid ${color}` : '2px solid transparent',
                        }}>
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 80px 80px', gap: 8, alignItems: 'center', marginBottom: 5 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <span style={{ width: 8, height: 8, borderRadius: '50%', background: color, flexShrink: 0, display: 'inline-block' }} />
                              <span style={{ fontSize: 12, color: isConv ? color : '#C4D0DC', fontWeight: isConv ? 700 : 400, fontFamily: 'monospace' }}>
                                {r.event}
                              </span>
                              {isConv && <span style={{ fontSize: 9, color: color, background: `${color}18`, borderRadius: 3, padding: '1px 5px', fontFamily: 'Manrope, sans-serif' }}>conv</span>}
                            </div>
                            <div style={{ textAlign: 'right', fontSize: 12, color: '#F5F4F3', fontWeight: 700 }}>{fmtNum(r.count)}</div>
                            <div style={{ textAlign: 'right', fontSize: 11, color: '#8A9BAA' }}>{fmtNum(r.users)}</div>
                          </div>
                          <div style={{ height: 3, background: 'rgba(255,255,255,0.05)', borderRadius: 2 }}>
                            <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: 2, opacity: 0.8, transition: 'width 0.4s ease' }} />
                          </div>
                        </div>
                      )
                    })}
                  </CardBody>
                </Card>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
