import { useState, useEffect, useRef, useCallback } from 'react'
import Header from '../components/layout/Header'
import Card, { CardHeader, CardBody } from '../components/ui/Card'
import { api } from '../services/api'
import { fmtNum } from '../utils/format'
import { TT } from '../components/ui/DarkTooltip'
import {
  AreaChart, Area, BarChart, Bar, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts'
import { Radio, RefreshCw, Activity, Clock, CheckCircle2, AlertTriangle, Filter, Columns, Plus, X, Search } from 'lucide-react'
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
  qualify_lead:   '#34D399',
  page_view:      '#4B6272',
  scroll:         '#374151',
  click:          '#374151',
}
function evColor(name) { return EVENT_COLORS[name] ?? '#6366F1' }

const CHANNEL_COLORS = {
  'Paid Search':    '#6366F1',
  'Paid Social':    '#E1306C',
  'Organic Search': '#22C55E',
  'Direct':         '#F59E0B',
  'Email':          '#06B6D4',
  'Organic Social': '#A855F7',
  'Referral':       '#B9915B',
}
function chColor(name) { return CHANNEL_COLORS[name] ?? '#4B6272' }

function fmtTime(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

function fmtDelta(curr, prev) {
  if (prev == null || prev === 0) return null
  const pct = ((curr - prev) / prev) * 100
  return { pct: pct.toFixed(1), up: pct >= 0 }
}

const SELECT_STYLE = {
  background: '#001F35', border: '1px solid rgba(99,102,241,0.35)',
  borderRadius: 6, color: '#F5F4F3', padding: '5px 28px 5px 10px',
  fontSize: 12, cursor: 'pointer', outline: 'none', appearance: 'none',
  backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23A5B4FC' stroke-width='2'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E")`,
  backgroundRepeat: 'no-repeat', backgroundPosition: 'right 8px center',
  fontFamily: 'Manrope, sans-serif',
}

function StatusBadge({ loading, mock, error }) {
  const isFatal = !mock && error
  const color = isFatal ? '#EF4444' : mock ? '#F59E0B' : '#22C55E'
  const icon  = isFatal ? <AlertTriangle size={12} /> : mock ? <Clock size={12} /> : <CheckCircle2 size={12} />
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 6,
      background: `${color}12`, border: `1px solid ${color}40`,
      borderRadius: 6, padding: '4px 10px',
    }}>
      <span style={{ color }}>{icon}</span>
      <span style={{ fontSize: 11, fontWeight: 700, color }}>GA4 Realtime</span>
      <span style={{ fontSize: 10, color: '#6B7280' }}>~1 min</span>
      {loading && <RefreshCw size={10} color="#6B7280" style={{ animation: 'spin 1s linear infinite' }} />}
    </div>
  )
}

function KpiCard({ label, value, sub, color = '#6366F1', sparkData, pulse, delta }) {
  return (
    <div style={{
      background: '#0D1B26', border: `1px solid ${color}33`,
      borderRadius: 10, padding: '14px 16px', position: 'relative', overflow: 'hidden',
    }}>
      <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 3, background: color, borderRadius: '10px 0 0 10px' }} />
      {pulse && (
        <div style={{
          position: 'absolute', top: 10, right: 10,
          width: 8, height: 8, borderRadius: '50%', background: '#22C55E',
          animation: 'liveKpiPulse 1.5s ease-out infinite',
        }} />
      )}
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8 }}>
        <div style={{ fontSize: 20, fontWeight: 800, color: '#F5F4F3', lineHeight: 1.1 }}>{value}</div>
        {delta && (
          <div style={{ fontSize: 11, fontWeight: 700, color: delta.up ? '#22C55E' : '#EF4444', marginBottom: 2 }}>
            {delta.up ? '▲' : '▼'} {Math.abs(delta.pct)}%
          </div>
        )}
      </div>
      <div style={{ fontSize: 11, color, marginTop: 4, fontWeight: 700 }}>{label}</div>
      {sub && <div style={{ fontSize: 10, color: '#6B7280', marginTop: 2 }}>{sub}</div>}
      {sparkData?.length >= 3 && (
        <div style={{ marginTop: 8, opacity: 0.7 }}>
          <ResponsiveContainer width="100%" height={28}>
            <AreaChart data={sparkData} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id={`sg4-${color.replace('#', '')}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={color} stopOpacity={0.35} />
                  <stop offset="100%" stopColor={color} stopOpacity={0} />
                </linearGradient>
              </defs>
              <Area type="monotone" dataKey="v" stroke={color} strokeWidth={1.5}
                fill={`url(#sg4-${color.replace('#', '')})`} dot={false} isAnimationActive={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  )
}

// ── Hook de painel individual (reutilizável no modo comparativo) ──────────────
function usePanelData({ propertyId, eventFilter, channelFilter, pageFilter, isRunning }) {
  const [data, setData]       = useState(null)
  const [loading, setLoading] = useState(false)
  const historyRef            = useRef([])
  const [history, setHistory] = useState([])
  const prevCountRef          = useRef(null)
  const prevActiveRef         = useRef(null)
  const [countdown, setCountdown] = useState(POLL_MS / 1000)

  const fetchData = useCallback(async () => {
    setLoading(true)
    const now = new Date()
    const timeLabel = now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    const result = await api.liveGa4(propertyId, eventFilter, channelFilter, pageFilter)
    setData(result)
    setLoading(false)

    const evRow = (result?.topEvents || []).find(e => e.event === eventFilter)
    const count = evRow?.count ?? 0
    const prev  = prevCountRef.current
    const delta = prev != null ? Math.max(0, count - prev) : 0
    prevCountRef.current = count
    prevActiveRef.current = result?.activeUsers ?? 0

    const point = { time: timeLabel, delta, activeUsers: result?.activeUsers ?? 0 }
    const updated = [...historyRef.current, point].slice(-40)
    historyRef.current = updated
    setHistory(updated)
    setCountdown(POLL_MS / 1000)
  }, [propertyId, eventFilter, channelFilter, pageFilter])

  useEffect(() => {
    prevCountRef.current = null
    prevActiveRef.current = null
    historyRef.current = []
    setHistory([])
    fetchData()
    if (!isRunning) return
    const iv = setInterval(fetchData, POLL_MS)
    return () => clearInterval(iv)
  }, [fetchData, isRunning])

  useEffect(() => {
    if (!isRunning) return
    const tick = setInterval(() => setCountdown(c => Math.max(0, c - 1)), 1000)
    return () => clearInterval(tick)
  }, [isRunning, data])

  // Calcula deltas vs ciclo anterior
  const activeUsers = data?.activeUsers ?? 0
  const evCount = (data?.topEvents || []).find(e => e.event === eventFilter)?.count ?? 0
  const prevActive = history.length >= 2 ? history[history.length - 2]?.activeUsers : null
  const prevEv     = history.length >= 2 ? (history[history.length - 2]?.delta ?? null) : null

  return {
    data, loading, history, countdown, fetchData,
    activeUsers, evCount,
    deltaActive: fmtDelta(activeUsers, prevActive),
    deltaEv:     prevEv != null ? fmtDelta(history[history.length - 1]?.delta ?? 0, prevEv) : null,
  }
}

// ── Painel de dados (KPIs + Timeline + UTM) ──────────────────────────────────
function DataPanel({
  propertyId, eventFilter, channelFilter, pageFilter,
  isRunning, compact = false, label,
}) {
  const [utmSourceFilter,   setUtmSourceFilter]   = useState('')
  const [utmMediumFilter,   setUtmMediumFilter]   = useState('')
  const [utmCampaignFilter, setUtmCampaignFilter] = useState('')
  const [hiddenSeries, setHiddenSeries] = useState({})

  const {
    data, loading, history, countdown, fetchData,
    activeUsers, evCount, deltaActive, deltaEv,
  } = usePanelData({ propertyId, eventFilter, channelFilter, pageFilter, isRunning })

  const allUtmRows = data?.utmRows || []
  const utmTotal   = allUtmRows.reduce((s, r) => s + r.count, 0)
  const utmTableData = allUtmRows.filter(r =>
    (!utmSourceFilter   || r.source   === utmSourceFilter)   &&
    (!utmMediumFilter   || r.medium   === utmMediumFilter)   &&
    (!utmCampaignFilter || r.campaign === utmCampaignFilter)
  )
  const utmSources   = data?.utmSources?.length   ? data.utmSources   : [...new Set(allUtmRows.map(r => r.source).filter(Boolean))].sort()
  const utmMediums   = data?.utmMediums?.length   ? data.utmMediums   : [...new Set(allUtmRows.map(r => r.medium).filter(Boolean))].sort()
  const utmCampaigns = data?.utmCampaigns?.length ? data.utmCampaigns : [...new Set(allUtmRows.map(r => r.campaign).filter(Boolean))].sort()

  const timelineData = [...(data?.timeline || [])].reverse()

  const toggleSeries = (key) => setHiddenSeries(prev => ({ ...prev, [key]: !prev[key] }))

  const applyUtmRow = (r) => {
    setUtmSourceFilter(r.source || '')
    setUtmMediumFilter(r.medium || '')
    setUtmCampaignFilter(r.campaign || '')
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* Header do painel (modo comparativo) */}
      {label && (
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          background: 'rgba(99,102,241,0.08)', borderRadius: 8, padding: '8px 14px',
          border: '1px solid rgba(99,102,241,0.2)',
        }}>
          <div>
            <div style={{ fontSize: 12, fontWeight: 800, color: '#A5B4FC' }}>{label}</div>
            {pageFilter && (
              <div style={{ fontSize: 10, color: '#6366F1', fontFamily: 'monospace', marginTop: 2 }}>
                path: {pageFilter}
              </div>
            )}
          </div>
          <StatusBadge loading={loading} mock={data?.mock} error={data?.error} />
        </div>
      )}

      {/* KPIs compactos */}
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${compact ? 3 : 4}, 1fr)`, gap: 10 }}>
        <KpiCard
          label="Usuários ativos"
          value={fmtNum(activeUsers)}
          sub={`${fmtTime(data?.capturedAt)}`}
          color="#6366F1"
          sparkData={history.slice(-12).map(p => ({ v: p.activeUsers }))}
          pulse={!data?.mock}
          delta={deltaActive}
        />
        <KpiCard
          label={`"${eventFilter}" · 30 min`}
          value={fmtNum(evCount)}
          sub={`delta: +${fmtNum(history[history.length - 1]?.delta ?? 0)}`}
          color={evColor(eventFilter)}
          sparkData={history.slice(-12).map(p => ({ v: p.delta }))}
          pulse={!data?.mock}
          delta={deltaEv}
        />
        <KpiCard
          label="Total eventos"
          value={fmtNum(data?.totalEvents ?? 0)}
          sub={`${(data?.topEvents || []).length} tipos`}
          color="#A855F7"
        />
        {!compact && (
          <KpiCard
            label={channelFilter ? `Canal: ${channelFilter}` : 'Canal com + leads'}
            value={(() => {
              if (channelFilter) return fmtNum((data?.channels || []).find(c => c.channel === channelFilter)?.events['generate_lead'] ?? 0) + ' leads'
              const top = (data?.channels || [])[0]
              return top ? `${fmtNum(top.events['generate_lead'] || 0)} leads` : '—'
            })()}
            sub={(() => {
              const ch = channelFilter
                ? (data?.channels || []).find(c => c.channel === channelFilter)
                : (data?.channels || [])[0]
              return ch ? `${ch.channel} · ${fmtNum(ch.users)} u` : '—'
            })()}
            color="#F59E0B"
          />
        )}
      </div>

      {/* Timeline */}
      <Card>
        <CardHeader
          title="Timeline · últimos 30 min"
          subtitle={`"${eventFilter}"${channelFilter ? ` · ${channelFilter}` : ''}${pageFilter ? ` · path: ${pageFilter}` : ''}`}
          action={<div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, color: '#6B7280' }}><Activity size={10} />{fmtTime(data?.capturedAt)}</div>}
        />
        <CardBody>
          {timelineData.length < 2 ? (
            <div style={{ height: 130, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#6B7280', fontSize: 12 }}>
              Aguardando dados…
            </div>
          ) : (
            <>
              {/* Legenda clicável */}
              <div style={{ display: 'flex', gap: 12, marginBottom: 8, flexWrap: 'wrap' }}>
                {[
                  { key: eventFilter, label: eventFilter, color: evColor(eventFilter) },
                  { key: 'page_view', label: 'page_view',  color: '#4B6272'           },
                ].map(s => (
                  <button
                    key={s.key}
                    onClick={() => toggleSeries(s.key)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 5,
                      padding: '2px 8px', borderRadius: 4, cursor: 'pointer', border: 'none',
                      background: hiddenSeries[s.key] ? 'rgba(255,255,255,0.04)' : `${s.color}18`,
                      opacity: hiddenSeries[s.key] ? 0.4 : 1,
                    }}
                  >
                    <span style={{ width: 8, height: 3, background: s.color, borderRadius: 2, display: 'inline-block' }} />
                    <span style={{ fontSize: 10, color: s.color, fontFamily: 'monospace' }}>{s.label}</span>
                  </button>
                ))}
              </div>
              <ResponsiveContainer width="100%" height={130}>
                <AreaChart data={timelineData} margin={{ top: 4, right: 12, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id={`tlEvG-${eventFilter}`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={evColor(eventFilter)} stopOpacity={0.35} />
                      <stop offset="100%" stopColor={evColor(eventFilter)} stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="tlPvGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#4B6272" stopOpacity={0.2} />
                      <stop offset="100%" stopColor="#4B6272" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                  <XAxis dataKey="minute" tick={{ fill: '#8A9BAA', fontSize: 9 }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
                  <YAxis tick={{ fill: '#8A9BAA', fontSize: 9 }} axisLine={false} tickLine={false} allowDecimals={false} />
                  <Tooltip cursor={TT.cursorLine} content={({ active, payload, label }) => {
                    if (!active || !payload?.length) return null
                    return (
                      <div style={TT.contentStyle}>
                        <div style={{ fontWeight: 700, marginBottom: 4, fontSize: 11 }}>{label}</div>
                        {payload.map((p, i) => <div key={i} style={{ color: p.color, fontSize: 11 }}>{p.name}: {fmtNum(p.value)}</div>)}
                      </div>
                    )
                  }} />
                  {!hiddenSeries[eventFilter] && (
                    <Area type="monotone" dataKey={eventFilter} name={eventFilter} stroke={evColor(eventFilter)} strokeWidth={2} fill={`url(#tlEvG-${eventFilter})`} dot={false} activeDot={{ r: 4 }} />
                  )}
                  {!hiddenSeries['page_view'] && (
                    <Area type="monotone" dataKey="page_view" name="page_view" stroke="#4B6272" strokeWidth={1} fill="url(#tlPvGrad)" dot={false} activeDot={{ r: 3 }} strokeDasharray="4 2" />
                  )}
                </AreaChart>
              </ResponsiveContainer>
            </>
          )}
        </CardBody>
      </Card>

      {/* Tabela UTM compacta */}
      <Card>
        <CardHeader
          title="UTM · Origem × Evento"
          subtitle={`${utmTableData.length} linhas${utmSourceFilter || utmMediumFilter || utmCampaignFilter ? ' · filtros ativos' : ''}`}
        />
        {/* Filtros UTM */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap',
          padding: '6px 14px', borderBottom: '1px solid rgba(255,255,255,0.06)',
        }}>
          <Filter size={10} color="#6B7280" />
          {[
            { label: 'Source',   value: utmSourceFilter,   setter: setUtmSourceFilter,   list: utmSources   },
            { label: 'Medium',   value: utmMediumFilter,   setter: setUtmMediumFilter,   list: utmMediums   },
            { label: 'Campaign', value: utmCampaignFilter, setter: setUtmCampaignFilter, list: utmCampaigns },
          ].map(f => (
            <div key={f.label} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <span style={{ fontSize: 10, color: '#6B7280', fontWeight: 700 }}>{f.label}:</span>
              <select
                value={f.value}
                onChange={e => f.setter(e.target.value)}
                style={{ ...SELECT_STYLE, padding: '3px 22px 3px 7px', fontSize: 10, border: `1px solid ${f.value ? 'rgba(99,102,241,0.5)' : 'rgba(99,102,241,0.2)'}` }}
              >
                <option value="">Todos</option>
                {f.list.map(v => <option key={v} value={v}>{v || '(direct)'}</option>)}
              </select>
              {f.value && <button onClick={() => f.setter('')} style={{ padding: '1px 5px', borderRadius: 3, fontSize: 9, cursor: 'pointer', background: 'none', border: '1px solid rgba(239,68,68,0.3)', color: '#EF4444' }}>✕</button>}
            </div>
          ))}
          {(utmSourceFilter || utmMediumFilter || utmCampaignFilter) && (
            <button onClick={() => { setUtmSourceFilter(''); setUtmMediumFilter(''); setUtmCampaignFilter('') }}
              style={{ padding: '2px 7px', borderRadius: 3, fontSize: 9, cursor: 'pointer', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#EF4444', fontWeight: 700 }}>
              Limpar
            </button>
          )}
        </div>
        <CardBody style={{ padding: 0 }}>
          {/* Header */}
          <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr 70px 60px 55px 45px', gap: 6, padding: '5px 14px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
            {['Evento', 'Campaign', 'Source', 'Medium', 'Disparos', '%'].map((h, i) => (
              <div key={i} style={{ fontSize: 9, color: '#6B7280', fontWeight: 700, textAlign: i >= 4 ? 'right' : 'left' }}>{h}</div>
            ))}
          </div>
          {utmTableData.length === 0 ? (
            <div style={{ padding: '20px', textAlign: 'center', color: '#6B7280', fontSize: 11 }}>
              {(utmSourceFilter || utmMediumFilter || utmCampaignFilter) ? 'Sem resultados' : 'Sem dados UTM'}
            </div>
          ) : utmTableData.map((r, i) => {
            const color  = evColor(r.event)
            const isConv = CONV_EVENTS.includes(r.event)
            const pctTot = utmTotal > 0 ? ((r.count / utmTotal) * 100).toFixed(1) : '0.0'
            return (
              <div
                key={i}
                onClick={() => applyUtmRow(r)}
                title="Clique para filtrar por esta origem"
                style={{
                  display: 'grid', gridTemplateColumns: '120px 1fr 70px 60px 55px 45px',
                  gap: 6, padding: '6px 14px',
                  borderBottom: '1px solid rgba(255,255,255,0.03)',
                  background: isConv ? `${color}08` : 'transparent',
                  borderLeft: isConv ? `2px solid ${color}` : '2px solid transparent',
                  cursor: 'pointer',
                  transition: 'background 0.1s',
                }}
                onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.03)'}
                onMouseLeave={e => e.currentTarget.style.background = isConv ? `${color}08` : 'transparent'}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <span style={{ width: 5, height: 5, borderRadius: '50%', background: color, flexShrink: 0, display: 'inline-block' }} />
                  <span style={{ fontSize: 10, color: isConv ? color : '#C4D0DC', fontFamily: 'monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: isConv ? 700 : 400 }}>{r.event}</span>
                </div>
                <div style={{ fontSize: 10, color: r.campaign ? '#8A9BAA' : '#374151', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={r.campaign}>{r.campaign || '—'}</div>
                <div>
                  {r.source
                    ? <span style={{ fontSize: 9, color: '#F5F4F3', background: 'rgba(255,255,255,0.06)', borderRadius: 3, padding: '1px 5px', fontWeight: 600 }}>{r.source}</span>
                    : <span style={{ fontSize: 9, color: '#374151' }}>(direct)</span>
                  }
                </div>
                <div>
                  {r.medium
                    ? <span style={{ fontSize: 9, color: r.medium === 'cpc' ? '#F59E0B' : r.medium === 'organic' ? '#22C55E' : '#A5B4FC', background: 'rgba(255,255,255,0.05)', borderRadius: 3, padding: '1px 5px' }}>{r.medium}</span>
                    : <span style={{ fontSize: 9, color: '#374151' }}>—</span>
                  }
                </div>
                <div style={{ textAlign: 'right', fontSize: 11, color: '#F5F4F3', fontWeight: 700 }}>{fmtNum(r.count)}</div>
                <div style={{ textAlign: 'right', fontSize: 10, color: '#6B7280' }}>{pctTot}%</div>
              </div>
            )
          })}
        </CardBody>
      </Card>
    </div>
  )
}

// ── Componente principal ─────────────────────────────────────────────────────
export default function LiveGA4() {
  const { selectedGA4 } = useTracking()
  const propertyId = selectedGA4 || '381992026'

  // ── Filtros painel A ──
  const [eventFilterA, setEventFilterA] = useState('generate_lead')
  const [inputEventA, setInputEventA]   = useState('generate_lead')
  const [channelFilterA, setChannelFilterA] = useState('')
  const [pageFilterA, setPageFilterA]   = useState('')
  const [inputPageA, setInputPageA]     = useState('')

  // ── Filtros painel B (modo comparativo) ──
  const [eventFilterB, setEventFilterB] = useState('generate_lead')
  const [inputEventB, setInputEventB]   = useState('generate_lead')
  const [channelFilterB, setChannelFilterB] = useState('')
  const [pageFilterB, setPageFilterB]   = useState('')
  const [inputPageB, setInputPageB]     = useState('')

  const [compareMode, setCompareMode] = useState(false)
  const [isRunning, setIsRunning]     = useState(true)

  // Dados do painel A para autocomplete de páginas e status
  const [dataA, setDataA] = useState(null)

  // Busca simples de páginas ativas para autocomplete
  const topPagesA = dataA?.topPages || []
  const [showPageSugA, setShowPageSugA] = useState(false)
  const [showPageSugB, setShowPageSugB] = useState(false)

  // Sincroniza `dataA` via callback — painel A aciona isso
  const onDataAUpdate = useCallback((d) => setDataA(d), [])

  const applyFilterA = () => {
    const ev = inputEventA.trim() || 'generate_lead'
    setEventFilterA(ev)
  }
  const applyFilterB = () => {
    const ev = inputEventB.trim() || 'generate_lead'
    setEventFilterB(ev)
  }
  const applyPageA = () => setPageFilterA(inputPageA.trim())
  const applyPageB = () => setPageFilterB(inputPageB.trim())

  const EVENT_SHORTCUTS = ['generate_lead', 'page_view', 'begin_checkout', 'purchase', 'form_start', 'form_submit', 'qualify_lead']

  function FiltersBar({ inputEvent, setInputEvent, channelFilter, setChannelFilter, pageFilter, setPageFilter,
    inputPage, setInputPage, applyFilter, applyPage, channelList,
    topPages, showPageSug, setShowPageSug, panelLabel }) {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap',
        background: 'rgba(99,102,241,0.05)', border: '1px solid rgba(99,102,241,0.15)',
        borderRadius: 8, padding: '10px 14px',
      }}>
        <Filter size={12} color="#A5B4FC" />
        {panelLabel && <span style={{ fontSize: 10, fontWeight: 800, color: '#6366F1', background: 'rgba(99,102,241,0.15)', borderRadius: 4, padding: '2px 7px' }}>{panelLabel}</span>}

        {/* Evento */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <span style={{ fontSize: 11, color: '#8A9BAA', fontWeight: 700 }}>Evento:</span>
          <input
            value={inputEvent}
            onChange={e => setInputEvent(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && applyFilter()}
            style={{
              background: '#0D1B26', border: '1px solid rgba(99,102,241,0.3)',
              borderRadius: 6, padding: '5px 10px', fontSize: 12, color: '#F5F4F3',
              fontFamily: 'monospace', width: 160, outline: 'none',
            }}
          />
          <button onClick={applyFilter} style={{
            padding: '5px 10px', borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: 'pointer',
            fontFamily: 'Manrope, sans-serif',
            background: 'rgba(99,102,241,0.12)', border: '1px solid rgba(99,102,241,0.35)', color: '#A5B4FC',
          }}>OK</button>
        </div>

        <div style={{ width: 1, height: 18, background: 'rgba(255,255,255,0.08)' }} />

        {/* Página */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, position: 'relative' }}>
          <Search size={11} color="#8A9BAA" />
          <span style={{ fontSize: 11, color: '#8A9BAA', fontWeight: 700 }}>Página:</span>
          <input
            value={inputPage}
            onChange={e => { setInputPage(e.target.value); setShowPageSug(true) }}
            onKeyDown={e => { if (e.key === 'Enter') { applyPage(); setShowPageSug(false) } }}
            onBlur={() => setTimeout(() => setShowPageSug(false), 150)}
            placeholder="ex: /inscricao"
            style={{
              background: '#0D1B26', border: `1px solid ${pageFilter ? 'rgba(99,102,241,0.6)' : 'rgba(99,102,241,0.3)'}`,
              borderRadius: 6, padding: '5px 10px', fontSize: 11, color: '#F5F4F3',
              fontFamily: 'monospace', width: 160, outline: 'none',
            }}
          />
          <button onClick={() => { applyPage(); setShowPageSug(false) }} style={{
            padding: '5px 10px', borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: 'pointer',
            fontFamily: 'Manrope, sans-serif',
            background: pageFilter ? 'rgba(99,102,241,0.25)' : 'rgba(99,102,241,0.08)',
            border: `1px solid ${pageFilter ? 'rgba(99,102,241,0.6)' : 'rgba(99,102,241,0.3)'}`,
            color: pageFilter ? '#A5B4FC' : '#6B7280',
          }}>Filtrar</button>
          {pageFilter && (
            <button onClick={() => { setPageFilter(''); setInputPage('') }} style={{
              padding: '4px 7px', borderRadius: 5, fontSize: 10, cursor: 'pointer',
              background: 'none', border: '1px solid rgba(239,68,68,0.3)', color: '#EF4444',
            }}>✕</button>
          )}
          {/* Sugestões de página */}
          {showPageSug && topPages.length > 0 && inputPage.length > 0 && (
            <div style={{
              position: 'absolute', top: '100%', left: 64, zIndex: 100,
              background: '#0D1B26', border: '1px solid rgba(99,102,241,0.4)',
              borderRadius: 6, marginTop: 2, minWidth: 220, maxHeight: 160, overflowY: 'auto',
              boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
            }}>
              {topPages
                .filter(p => p.page?.includes(inputPage))
                .slice(0, 8)
                .map((p, i) => (
                  <div
                    key={i}
                    onMouseDown={() => { setInputPage(p.page); setPageFilter(p.page); setShowPageSug(false) }}
                    style={{
                      padding: '7px 12px', cursor: 'pointer', fontSize: 11,
                      color: '#C4D0DC', fontFamily: 'monospace',
                      borderBottom: '1px solid rgba(255,255,255,0.04)',
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = 'rgba(99,102,241,0.12)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                  >
                    <div>{p.page}</div>
                    <div style={{ fontSize: 9, color: '#6B7280' }}>{p.views} views</div>
                  </div>
                ))}
            </div>
          )}
        </div>

        <div style={{ width: 1, height: 18, background: 'rgba(255,255,255,0.08)' }} />

        {/* Canal */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <span style={{ fontSize: 11, color: '#8A9BAA', fontWeight: 700 }}>Canal:</span>
          <select value={channelFilter} onChange={e => setChannelFilter(e.target.value)} style={SELECT_STYLE}>
            <option value="">Todos</option>
            {(channelList || []).map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          {channelFilter && (
            <button onClick={() => setChannelFilter('')} style={{ padding: '4px 7px', borderRadius: 4, fontSize: 10, cursor: 'pointer', background: 'none', border: '1px solid rgba(239,68,68,0.3)', color: '#EF4444' }}>✕</button>
          )}
        </div>

        {/* Atalhos evento */}
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          {EVENT_SHORTCUTS.map(ev => (
            <button
              key={ev}
              onClick={() => { setInputEvent(ev); applyFilter.call(null, ev) }}
              style={{
                padding: '3px 7px', borderRadius: 4, fontSize: 9, cursor: 'pointer',
                fontFamily: 'monospace',
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.08)',
                color: '#6B7280',
              }}
            >{ev}</button>
          ))}
        </div>
      </div>
    )
  }

  // Wrapper de painel A que captura os dados para autocomplete
  function PanelAWithCapture() {
    const { data, loading, history, countdown, fetchData, activeUsers, evCount, deltaActive, deltaEv } =
      usePanelData({ propertyId, eventFilter: eventFilterA, channelFilter: channelFilterA, pageFilter: pageFilterA, isRunning })

    useEffect(() => { if (data) onDataAUpdate(data) }, [data])

    const [utmSrcF, setUtmSrcF]   = useState('')
    const [utmMedF, setUtmMedF]   = useState('')
    const [utmCmpF, setUtmCmpF]   = useState('')
    const [hiddenSeries, setHiddenSeries] = useState({})

    const allUtmRows = data?.utmRows || []
    const utmTotal   = allUtmRows.reduce((s, r) => s + r.count, 0)
    const utmTableData = allUtmRows.filter(r =>
      (!utmSrcF || r.source   === utmSrcF) &&
      (!utmMedF || r.medium   === utmMedF) &&
      (!utmCmpF || r.campaign === utmCmpF)
    )
    const utmSources   = data?.utmSources?.length   ? data.utmSources   : [...new Set(allUtmRows.map(r => r.source).filter(Boolean))].sort()
    const utmMediums   = data?.utmMediums?.length   ? data.utmMediums   : [...new Set(allUtmRows.map(r => r.medium).filter(Boolean))].sort()
    const utmCampaigns = data?.utmCampaigns?.length ? data.utmCampaigns : [...new Set(allUtmRows.map(r => r.campaign).filter(Boolean))].sort()

    const timelineData = [...(data?.timeline || [])].reverse()
    const toggleSeries = (key) => setHiddenSeries(prev => ({ ...prev, [key]: !prev[key] }))
    const applyUtmRow = (r) => { setUtmSrcF(r.source || ''); setUtmMedF(r.medium || ''); setUtmCmpF(r.campaign || '') }

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {compareMode && (
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            background: 'rgba(99,102,241,0.08)', borderRadius: 8, padding: '8px 14px',
            border: '1px solid rgba(99,102,241,0.2)',
          }}>
            <div>
              <div style={{ fontSize: 12, fontWeight: 800, color: '#A5B4FC' }}>Painel A</div>
              {pageFilterA && <div style={{ fontSize: 10, color: '#6366F1', fontFamily: 'monospace', marginTop: 2 }}>path: {pageFilterA}</div>}
            </div>
            <StatusBadge loading={loading} mock={data?.mock} error={data?.error} />
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: `repeat(${compareMode ? 3 : 4}, 1fr)`, gap: 10 }}>
          <KpiCard label="Usuários ativos" value={fmtNum(activeUsers)} sub={fmtTime(data?.capturedAt)} color="#6366F1"
            sparkData={history.slice(-12).map(p => ({ v: p.activeUsers }))} pulse={!data?.mock} delta={deltaActive} />
          <KpiCard label={`"${eventFilterA}" · 30 min`} value={fmtNum(evCount)}
            sub={`delta: +${fmtNum(history[history.length - 1]?.delta ?? 0)}`} color={evColor(eventFilterA)}
            sparkData={history.slice(-12).map(p => ({ v: p.delta }))} pulse={!data?.mock} delta={deltaEv} />
          <KpiCard label="Total eventos" value={fmtNum(data?.totalEvents ?? 0)} sub={`${(data?.topEvents || []).length} tipos`} color="#A855F7" />
          {!compareMode && (
            <KpiCard
              label={channelFilterA ? `Canal: ${channelFilterA}` : 'Canal com + leads'}
              value={(() => {
                if (channelFilterA) return fmtNum((data?.channels || []).find(c => c.channel === channelFilterA)?.events['generate_lead'] ?? 0) + ' leads'
                const top = (data?.channels || [])[0]
                return top ? `${fmtNum(top.events['generate_lead'] || 0)} leads` : '—'
              })()}
              sub={(() => {
                const ch = channelFilterA ? (data?.channels || []).find(c => c.channel === channelFilterA) : (data?.channels || [])[0]
                return ch ? `${ch.channel} · ${fmtNum(ch.users)} u` : '—'
              })()}
              color="#F59E0B"
            />
          )}
        </div>

        {/* Timeline */}
        <Card>
          <CardHeader title="Timeline · últimos 30 min"
            subtitle={`"${eventFilterA}"${channelFilterA ? ` · ${channelFilterA}` : ''}${pageFilterA ? ` · path: ${pageFilterA}` : ''}`}
            action={<div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, color: '#6B7280' }}><Activity size={10} />{fmtTime(data?.capturedAt)}</div>}
          />
          <CardBody>
            {timelineData.length < 2 ? (
              <div style={{ height: 130, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#6B7280', fontSize: 12 }}>Aguardando…</div>
            ) : (
              <>
                <div style={{ display: 'flex', gap: 10, marginBottom: 8 }}>
                  {[{ key: eventFilterA, color: evColor(eventFilterA) }, { key: 'page_view', color: '#4B6272' }].map(s => (
                    <button key={s.key} onClick={() => toggleSeries(s.key)} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '2px 8px', borderRadius: 4, cursor: 'pointer', border: 'none', background: hiddenSeries[s.key] ? 'rgba(255,255,255,0.04)' : `${s.color}18`, opacity: hiddenSeries[s.key] ? 0.4 : 1 }}>
                      <span style={{ width: 8, height: 3, background: s.color, borderRadius: 2, display: 'inline-block' }} />
                      <span style={{ fontSize: 10, color: s.color, fontFamily: 'monospace' }}>{s.key}</span>
                    </button>
                  ))}
                </div>
                <ResponsiveContainer width="100%" height={130}>
                  <AreaChart data={timelineData} margin={{ top: 4, right: 12, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="tlEvGA" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={evColor(eventFilterA)} stopOpacity={0.35} />
                        <stop offset="100%" stopColor={evColor(eventFilterA)} stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="tlPvGA" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#4B6272" stopOpacity={0.2} />
                        <stop offset="100%" stopColor="#4B6272" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                    <XAxis dataKey="minute" tick={{ fill: '#8A9BAA', fontSize: 9 }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
                    <YAxis tick={{ fill: '#8A9BAA', fontSize: 9 }} axisLine={false} tickLine={false} allowDecimals={false} />
                    <Tooltip cursor={TT.cursorLine} content={({ active, payload, label }) => {
                      if (!active || !payload?.length) return null
                      return <div style={TT.contentStyle}><div style={{ fontWeight: 700, marginBottom: 4, fontSize: 11 }}>{label}</div>{payload.map((p, i) => <div key={i} style={{ color: p.color, fontSize: 11 }}>{p.name}: {fmtNum(p.value)}</div>)}</div>
                    }} />
                    {!hiddenSeries[eventFilterA] && <Area type="monotone" dataKey={eventFilterA} name={eventFilterA} stroke={evColor(eventFilterA)} strokeWidth={2} fill="url(#tlEvGA)" dot={false} activeDot={{ r: 4 }} />}
                    {!hiddenSeries['page_view'] && <Area type="monotone" dataKey="page_view" name="page_view" stroke="#4B6272" strokeWidth={1} fill="url(#tlPvGA)" dot={false} activeDot={{ r: 3 }} strokeDasharray="4 2" />}
                  </AreaChart>
                </ResponsiveContainer>
              </>
            )}
          </CardBody>
        </Card>

        {/* Tabela UTM */}
        <Card>
          <CardHeader title="UTM · Origem × Evento" subtitle={`${utmTableData.length} linhas${utmSrcF || utmMedF || utmCmpF ? ' · filtros ativos' : ''}`} />
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', padding: '6px 14px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
            <Filter size={10} color="#6B7280" />
            {[
              { label: 'Source', value: utmSrcF, setter: setUtmSrcF, list: utmSources },
              { label: 'Medium', value: utmMedF, setter: setUtmMedF, list: utmMediums },
              { label: 'Campaign', value: utmCmpF, setter: setUtmCmpF, list: utmCampaigns },
            ].map(f => (
              <div key={f.label} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ fontSize: 10, color: '#6B7280', fontWeight: 700 }}>{f.label}:</span>
                <select value={f.value} onChange={e => f.setter(e.target.value)}
                  style={{ ...SELECT_STYLE, padding: '3px 22px 3px 7px', fontSize: 10, border: `1px solid ${f.value ? 'rgba(99,102,241,0.5)' : 'rgba(99,102,241,0.2)'}` }}>
                  <option value="">Todos</option>
                  {f.list.map(v => <option key={v} value={v}>{v || '(direct)'}</option>)}
                </select>
                {f.value && <button onClick={() => f.setter('')} style={{ padding: '1px 5px', borderRadius: 3, fontSize: 9, cursor: 'pointer', background: 'none', border: '1px solid rgba(239,68,68,0.3)', color: '#EF4444' }}>✕</button>}
              </div>
            ))}
            {(utmSrcF || utmMedF || utmCmpF) && (
              <button onClick={() => { setUtmSrcF(''); setUtmMedF(''); setUtmCmpF('') }} style={{ padding: '2px 7px', borderRadius: 3, fontSize: 9, cursor: 'pointer', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#EF4444', fontWeight: 700 }}>Limpar</button>
            )}
          </div>
          <CardBody style={{ padding: 0 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr 70px 60px 55px 45px', gap: 6, padding: '5px 14px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
              {['Evento', 'Campaign', 'Source', 'Medium', 'Disparos', '%'].map((h, i) => (
                <div key={i} style={{ fontSize: 9, color: '#6B7280', fontWeight: 700, textAlign: i >= 4 ? 'right' : 'left' }}>{h}</div>
              ))}
            </div>
            {utmTableData.length === 0 ? (
              <div style={{ padding: '20px', textAlign: 'center', color: '#6B7280', fontSize: 11 }}>
                {(utmSrcF || utmMedF || utmCmpF) ? 'Sem resultados' : 'Sem dados UTM'}
              </div>
            ) : utmTableData.map((r, i) => {
              const color = evColor(r.event)
              const isConv = CONV_EVENTS.includes(r.event)
              const pctTot = utmTotal > 0 ? ((r.count / utmTotal) * 100).toFixed(1) : '0.0'
              return (
                <div key={i} onClick={() => applyUtmRow(r)} title="Clique para filtrar" style={{
                  display: 'grid', gridTemplateColumns: '120px 1fr 70px 60px 55px 45px',
                  gap: 6, padding: '6px 14px', borderBottom: '1px solid rgba(255,255,255,0.03)',
                  background: isConv ? `${color}08` : 'transparent',
                  borderLeft: isConv ? `2px solid ${color}` : '2px solid transparent', cursor: 'pointer',
                }}
                  onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.03)'}
                  onMouseLeave={e => e.currentTarget.style.background = isConv ? `${color}08` : 'transparent'}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span style={{ width: 5, height: 5, borderRadius: '50%', background: color, flexShrink: 0, display: 'inline-block' }} />
                    <span style={{ fontSize: 10, color: isConv ? color : '#C4D0DC', fontFamily: 'monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: isConv ? 700 : 400 }}>{r.event}</span>
                  </div>
                  <div style={{ fontSize: 10, color: r.campaign ? '#8A9BAA' : '#374151', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={r.campaign}>{r.campaign || '—'}</div>
                  <div>{r.source ? <span style={{ fontSize: 9, color: '#F5F4F3', background: 'rgba(255,255,255,0.06)', borderRadius: 3, padding: '1px 5px', fontWeight: 600 }}>{r.source}</span> : <span style={{ fontSize: 9, color: '#374151' }}>(direct)</span>}</div>
                  <div>{r.medium ? <span style={{ fontSize: 9, color: r.medium === 'cpc' ? '#F59E0B' : r.medium === 'organic' ? '#22C55E' : '#A5B4FC', background: 'rgba(255,255,255,0.05)', borderRadius: 3, padding: '1px 5px' }}>{r.medium}</span> : <span style={{ fontSize: 9, color: '#374151' }}>—</span>}</div>
                  <div style={{ textAlign: 'right', fontSize: 11, color: '#F5F4F3', fontWeight: 700 }}>{fmtNum(r.count)}</div>
                  <div style={{ textAlign: 'right', fontSize: 10, color: '#6B7280' }}>{pctTot}%</div>
                </div>
              )
            })}
          </CardBody>
        </Card>

        {/* Canal × Conversões (só no modo simples) */}
        {!compareMode && (data?.channels || []).length > 0 && (
          <ChannelTable channels={data.channels} channelFilter={channelFilterA} setChannelFilter={setChannelFilterA} />
        )}

        {/* Top eventos + Top páginas (só modo simples) */}
        {!compareMode && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <TopEventsCard data={data} eventFilter={eventFilterA} setEventFilter={(ev) => { setEventFilterA(ev); setInputEventA(ev) }} />
            <TopPagesCard data={data} channelFilter={channelFilterA} setPageFilter={(p) => { setPageFilterA(p); setInputPageA(p) }} />
          </div>
        )}
      </div>
    )
  }

  function PanelB() {
    const { data, loading, history, countdown, fetchData, activeUsers, evCount, deltaActive, deltaEv } =
      usePanelData({ propertyId, eventFilter: eventFilterB, channelFilter: channelFilterB, pageFilter: pageFilterB, isRunning })

    const [utmSrcF, setUtmSrcF]   = useState('')
    const [utmMedF, setUtmMedF]   = useState('')
    const [utmCmpF, setUtmCmpF]   = useState('')
    const [hiddenSeries, setHiddenSeries] = useState({})

    const allUtmRows = data?.utmRows || []
    const utmTotal   = allUtmRows.reduce((s, r) => s + r.count, 0)
    const utmTableData = allUtmRows.filter(r =>
      (!utmSrcF || r.source   === utmSrcF) &&
      (!utmMedF || r.medium   === utmMedF) &&
      (!utmCmpF || r.campaign === utmCmpF)
    )
    const utmSources   = data?.utmSources?.length   ? data.utmSources   : [...new Set(allUtmRows.map(r => r.source).filter(Boolean))].sort()
    const utmMediums   = data?.utmMediums?.length   ? data.utmMediums   : [...new Set(allUtmRows.map(r => r.medium).filter(Boolean))].sort()
    const utmCampaigns = data?.utmCampaigns?.length ? data.utmCampaigns : [...new Set(allUtmRows.map(r => r.campaign).filter(Boolean))].sort()

    const timelineData = [...(data?.timeline || [])].reverse()
    const toggleSeries = (key) => setHiddenSeries(prev => ({ ...prev, [key]: !prev[key] }))
    const applyUtmRow = (r) => { setUtmSrcF(r.source || ''); setUtmMedF(r.medium || ''); setUtmCmpF(r.campaign || '') }

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(99,102,241,0.08)', borderRadius: 8, padding: '8px 14px', border: '1px solid rgba(99,102,241,0.2)' }}>
          <div>
            <div style={{ fontSize: 12, fontWeight: 800, color: '#A5B4FC' }}>Painel B</div>
            {pageFilterB && <div style={{ fontSize: 10, color: '#6366F1', fontFamily: 'monospace', marginTop: 2 }}>path: {pageFilterB}</div>}
          </div>
          <StatusBadge loading={loading} mock={data?.mock} error={data?.error} />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
          <KpiCard label="Usuários ativos" value={fmtNum(activeUsers)} sub={fmtTime(data?.capturedAt)} color="#6366F1"
            sparkData={history.slice(-12).map(p => ({ v: p.activeUsers }))} pulse={!data?.mock} delta={deltaActive} />
          <KpiCard label={`"${eventFilterB}" · 30 min`} value={fmtNum(evCount)}
            sub={`delta: +${fmtNum(history[history.length - 1]?.delta ?? 0)}`} color={evColor(eventFilterB)}
            sparkData={history.slice(-12).map(p => ({ v: p.delta }))} pulse={!data?.mock} delta={deltaEv} />
          <KpiCard label="Total eventos" value={fmtNum(data?.totalEvents ?? 0)} sub={`${(data?.topEvents || []).length} tipos`} color="#A855F7" />
        </div>

        <Card>
          <CardHeader title="Timeline · últimos 30 min"
            subtitle={`"${eventFilterB}"${channelFilterB ? ` · ${channelFilterB}` : ''}${pageFilterB ? ` · path: ${pageFilterB}` : ''}`}
            action={<div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, color: '#6B7280' }}><Activity size={10} />{fmtTime(data?.capturedAt)}</div>}
          />
          <CardBody>
            {timelineData.length < 2 ? (
              <div style={{ height: 130, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#6B7280', fontSize: 12 }}>Aguardando…</div>
            ) : (
              <>
                <div style={{ display: 'flex', gap: 10, marginBottom: 8 }}>
                  {[{ key: eventFilterB, color: evColor(eventFilterB) }, { key: 'page_view', color: '#4B6272' }].map(s => (
                    <button key={s.key} onClick={() => toggleSeries(s.key)} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '2px 8px', borderRadius: 4, cursor: 'pointer', border: 'none', background: hiddenSeries[s.key] ? 'rgba(255,255,255,0.04)' : `${s.color}18`, opacity: hiddenSeries[s.key] ? 0.4 : 1 }}>
                      <span style={{ width: 8, height: 3, background: s.color, borderRadius: 2, display: 'inline-block' }} />
                      <span style={{ fontSize: 10, color: s.color, fontFamily: 'monospace' }}>{s.key}</span>
                    </button>
                  ))}
                </div>
                <ResponsiveContainer width="100%" height={130}>
                  <AreaChart data={timelineData} margin={{ top: 4, right: 12, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="tlEvGB" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={evColor(eventFilterB)} stopOpacity={0.35} />
                        <stop offset="100%" stopColor={evColor(eventFilterB)} stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="tlPvGB" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#4B6272" stopOpacity={0.2} />
                        <stop offset="100%" stopColor="#4B6272" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                    <XAxis dataKey="minute" tick={{ fill: '#8A9BAA', fontSize: 9 }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
                    <YAxis tick={{ fill: '#8A9BAA', fontSize: 9 }} axisLine={false} tickLine={false} allowDecimals={false} />
                    <Tooltip cursor={TT.cursorLine} content={({ active, payload, label }) => {
                      if (!active || !payload?.length) return null
                      return <div style={TT.contentStyle}><div style={{ fontWeight: 700, marginBottom: 4, fontSize: 11 }}>{label}</div>{payload.map((p, i) => <div key={i} style={{ color: p.color, fontSize: 11 }}>{p.name}: {fmtNum(p.value)}</div>)}</div>
                    }} />
                    {!hiddenSeries[eventFilterB] && <Area type="monotone" dataKey={eventFilterB} name={eventFilterB} stroke={evColor(eventFilterB)} strokeWidth={2} fill="url(#tlEvGB)" dot={false} activeDot={{ r: 4 }} />}
                    {!hiddenSeries['page_view'] && <Area type="monotone" dataKey="page_view" name="page_view" stroke="#4B6272" strokeWidth={1} fill="url(#tlPvGB)" dot={false} activeDot={{ r: 3 }} strokeDasharray="4 2" />}
                  </AreaChart>
                </ResponsiveContainer>
              </>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="UTM · Origem × Evento" subtitle={`${utmTableData.length} linhas${utmSrcF || utmMedF || utmCmpF ? ' · filtros ativos' : ''}`} />
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', padding: '6px 14px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
            <Filter size={10} color="#6B7280" />
            {[
              { label: 'Source', value: utmSrcF, setter: setUtmSrcF, list: utmSources },
              { label: 'Medium', value: utmMedF, setter: setUtmMedF, list: utmMediums },
              { label: 'Campaign', value: utmCmpF, setter: setUtmCmpF, list: utmCampaigns },
            ].map(f => (
              <div key={f.label} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ fontSize: 10, color: '#6B7280', fontWeight: 700 }}>{f.label}:</span>
                <select value={f.value} onChange={e => f.setter(e.target.value)}
                  style={{ ...SELECT_STYLE, padding: '3px 22px 3px 7px', fontSize: 10, border: `1px solid ${f.value ? 'rgba(99,102,241,0.5)' : 'rgba(99,102,241,0.2)'}` }}>
                  <option value="">Todos</option>
                  {f.list.map(v => <option key={v} value={v}>{v || '(direct)'}</option>)}
                </select>
                {f.value && <button onClick={() => f.setter('')} style={{ padding: '1px 5px', borderRadius: 3, fontSize: 9, cursor: 'pointer', background: 'none', border: '1px solid rgba(239,68,68,0.3)', color: '#EF4444' }}>✕</button>}
              </div>
            ))}
            {(utmSrcF || utmMedF || utmCmpF) && (
              <button onClick={() => { setUtmSrcF(''); setUtmMedF(''); setUtmCmpF('') }} style={{ padding: '2px 7px', borderRadius: 3, fontSize: 9, cursor: 'pointer', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#EF4444', fontWeight: 700 }}>Limpar</button>
            )}
          </div>
          <CardBody style={{ padding: 0 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr 70px 60px 55px 45px', gap: 6, padding: '5px 14px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
              {['Evento', 'Campaign', 'Source', 'Medium', 'Disparos', '%'].map((h, i) => (
                <div key={i} style={{ fontSize: 9, color: '#6B7280', fontWeight: 700, textAlign: i >= 4 ? 'right' : 'left' }}>{h}</div>
              ))}
            </div>
            {utmTableData.length === 0 ? (
              <div style={{ padding: '20px', textAlign: 'center', color: '#6B7280', fontSize: 11 }}>
                {(utmSrcF || utmMedF || utmCmpF) ? 'Sem resultados' : 'Sem dados UTM'}
              </div>
            ) : utmTableData.map((r, i) => {
              const color = evColor(r.event)
              const isConv = CONV_EVENTS.includes(r.event)
              const pctTot = utmTotal > 0 ? ((r.count / utmTotal) * 100).toFixed(1) : '0.0'
              return (
                <div key={i} onClick={() => applyUtmRow(r)} title="Clique para filtrar" style={{
                  display: 'grid', gridTemplateColumns: '120px 1fr 70px 60px 55px 45px',
                  gap: 6, padding: '6px 14px', borderBottom: '1px solid rgba(255,255,255,0.03)',
                  background: isConv ? `${color}08` : 'transparent',
                  borderLeft: isConv ? `2px solid ${color}` : '2px solid transparent', cursor: 'pointer',
                }}
                  onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.03)'}
                  onMouseLeave={e => e.currentTarget.style.background = isConv ? `${color}08` : 'transparent'}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span style={{ width: 5, height: 5, borderRadius: '50%', background: color, flexShrink: 0, display: 'inline-block' }} />
                    <span style={{ fontSize: 10, color: isConv ? color : '#C4D0DC', fontFamily: 'monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: isConv ? 700 : 400 }}>{r.event}</span>
                  </div>
                  <div style={{ fontSize: 10, color: r.campaign ? '#8A9BAA' : '#374151', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={r.campaign}>{r.campaign || '—'}</div>
                  <div>{r.source ? <span style={{ fontSize: 9, color: '#F5F4F3', background: 'rgba(255,255,255,0.06)', borderRadius: 3, padding: '1px 5px', fontWeight: 600 }}>{r.source}</span> : <span style={{ fontSize: 9, color: '#374151' }}>(direct)</span>}</div>
                  <div>{r.medium ? <span style={{ fontSize: 9, color: r.medium === 'cpc' ? '#F59E0B' : r.medium === 'organic' ? '#22C55E' : '#A5B4FC', background: 'rgba(255,255,255,0.05)', borderRadius: 3, padding: '1px 5px' }}>{r.medium}</span> : <span style={{ fontSize: 9, color: '#374151' }}>—</span>}</div>
                  <div style={{ textAlign: 'right', fontSize: 11, color: '#F5F4F3', fontWeight: 700 }}>{fmtNum(r.count)}</div>
                  <div style={{ textAlign: 'right', fontSize: 10, color: '#6B7280' }}>{pctTot}%</div>
                </div>
              )
            })}
          </CardBody>
        </Card>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      <style>{`
        @keyframes liveKpiPulse {
          0%   { box-shadow: 0 0 0 0 rgba(34,197,94,0.5); }
          70%  { box-shadow: 0 0 0 8px rgba(34,197,94,0); }
          100% { box-shadow: 0 0 0 0 rgba(34,197,94,0); }
        }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>

      <Header
        title="GA4 · Ao Vivo"
        subtitle={`Property ${propertyId} · Realtime API · últimos 30 min`}
        showGA4
        action={
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {!compareMode && <StatusBadge loading={false} mock={dataA?.mock} error={dataA?.error} />}
            <div style={{ fontSize: 11, color: isRunning ? '#22C55E' : '#6B7280', display: 'flex', alignItems: 'center', gap: 5 }}>
              <Radio size={11} />
              {isRunning ? 'Ao vivo' : 'Pausado'}
            </div>
            <button onClick={() => setIsRunning(r => !r)} style={{
              padding: '5px 12px', borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: 'pointer',
              fontFamily: 'Manrope, sans-serif',
              background: isRunning ? 'rgba(239,68,68,0.12)' : 'rgba(34,197,94,0.12)',
              border: `1px solid ${isRunning ? 'rgba(239,68,68,0.4)' : 'rgba(34,197,94,0.4)'}`,
              color: isRunning ? '#EF4444' : '#22C55E',
            }}>{isRunning ? 'Pausar' : 'Retomar'}</button>
            <button
              onClick={() => setCompareMode(m => !m)}
              style={{
                padding: '5px 12px', borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: 'pointer',
                fontFamily: 'Manrope, sans-serif', display: 'flex', alignItems: 'center', gap: 5,
                background: compareMode ? 'rgba(99,102,241,0.25)' : 'rgba(99,102,241,0.08)',
                border: `1px solid ${compareMode ? 'rgba(99,102,241,0.6)' : 'rgba(99,102,241,0.25)'}`,
                color: compareMode ? '#A5B4FC' : '#6B7280',
              }}
            >
              {compareMode ? <X size={11} /> : <Plus size={11} />}
              {compareMode ? 'Sair do modo comparativo' : 'Comparar'}
            </button>
          </div>
        }
      />

      <div style={{ flex: 1, overflowY: 'auto', padding: '14px 20px', display: 'flex', flexDirection: 'column', gap: 14 }}>

        {/* ── Filtros ── */}
        {compareMode ? (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            {/* Filtros A */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', background: 'rgba(99,102,241,0.05)', border: '1px solid rgba(99,102,241,0.2)', borderRadius: 8, padding: '10px 14px' }}>
              <span style={{ fontSize: 10, fontWeight: 800, color: '#6366F1', background: 'rgba(99,102,241,0.15)', borderRadius: 4, padding: '2px 7px' }}>A</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <span style={{ fontSize: 10, color: '#8A9BAA', fontWeight: 700 }}>Evento:</span>
                <input value={inputEventA} onChange={e => setInputEventA(e.target.value)} onKeyDown={e => e.key === 'Enter' && applyFilterA()}
                  style={{ background: '#0D1B26', border: '1px solid rgba(99,102,241,0.3)', borderRadius: 5, padding: '4px 8px', fontSize: 11, color: '#F5F4F3', fontFamily: 'monospace', width: 130, outline: 'none' }} />
                <button onClick={applyFilterA} style={{ padding: '4px 8px', borderRadius: 5, fontSize: 10, fontWeight: 700, cursor: 'pointer', fontFamily: 'Manrope', background: 'rgba(99,102,241,0.12)', border: '1px solid rgba(99,102,241,0.35)', color: '#A5B4FC' }}>OK</button>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 5, position: 'relative' }}>
                <span style={{ fontSize: 10, color: '#8A9BAA', fontWeight: 700 }}>Path:</span>
                <input value={inputPageA} onChange={e => setInputPageA(e.target.value)} onKeyDown={e => e.key === 'Enter' && applyPageA()}
                  placeholder="/inscricao"
                  style={{ background: '#0D1B26', border: `1px solid ${pageFilterA ? 'rgba(99,102,241,0.6)' : 'rgba(99,102,241,0.3)'}`, borderRadius: 5, padding: '4px 8px', fontSize: 11, color: '#F5F4F3', fontFamily: 'monospace', width: 120, outline: 'none' }} />
                <button onClick={applyPageA} style={{ padding: '4px 8px', borderRadius: 5, fontSize: 10, cursor: 'pointer', fontFamily: 'Manrope', background: pageFilterA ? 'rgba(99,102,241,0.25)' : 'rgba(99,102,241,0.08)', border: `1px solid ${pageFilterA ? 'rgba(99,102,241,0.6)' : 'rgba(99,102,241,0.25)'}`, color: pageFilterA ? '#A5B4FC' : '#6B7280', fontWeight: 700 }}>Filtrar</button>
                {pageFilterA && <button onClick={() => { setPageFilterA(''); setInputPageA('') }} style={{ padding: '3px 6px', borderRadius: 4, fontSize: 9, cursor: 'pointer', background: 'none', border: '1px solid rgba(239,68,68,0.3)', color: '#EF4444' }}>✕</button>}
              </div>
            </div>
            {/* Filtros B */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', background: 'rgba(99,102,241,0.05)', border: '1px solid rgba(99,102,241,0.2)', borderRadius: 8, padding: '10px 14px' }}>
              <span style={{ fontSize: 10, fontWeight: 800, color: '#6366F1', background: 'rgba(99,102,241,0.15)', borderRadius: 4, padding: '2px 7px' }}>B</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <span style={{ fontSize: 10, color: '#8A9BAA', fontWeight: 700 }}>Evento:</span>
                <input value={inputEventB} onChange={e => setInputEventB(e.target.value)} onKeyDown={e => e.key === 'Enter' && applyFilterB()}
                  style={{ background: '#0D1B26', border: '1px solid rgba(99,102,241,0.3)', borderRadius: 5, padding: '4px 8px', fontSize: 11, color: '#F5F4F3', fontFamily: 'monospace', width: 130, outline: 'none' }} />
                <button onClick={applyFilterB} style={{ padding: '4px 8px', borderRadius: 5, fontSize: 10, fontWeight: 700, cursor: 'pointer', fontFamily: 'Manrope', background: 'rgba(99,102,241,0.12)', border: '1px solid rgba(99,102,241,0.35)', color: '#A5B4FC' }}>OK</button>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <span style={{ fontSize: 10, color: '#8A9BAA', fontWeight: 700 }}>Path:</span>
                <input value={inputPageB} onChange={e => setInputPageB(e.target.value)} onKeyDown={e => e.key === 'Enter' && applyPageB()}
                  placeholder="/inscricao"
                  style={{ background: '#0D1B26', border: `1px solid ${pageFilterB ? 'rgba(99,102,241,0.6)' : 'rgba(99,102,241,0.3)'}`, borderRadius: 5, padding: '4px 8px', fontSize: 11, color: '#F5F4F3', fontFamily: 'monospace', width: 120, outline: 'none' }} />
                <button onClick={applyPageB} style={{ padding: '4px 8px', borderRadius: 5, fontSize: 10, cursor: 'pointer', fontFamily: 'Manrope', background: pageFilterB ? 'rgba(99,102,241,0.25)' : 'rgba(99,102,241,0.08)', border: `1px solid ${pageFilterB ? 'rgba(99,102,241,0.6)' : 'rgba(99,102,241,0.25)'}`, color: pageFilterB ? '#A5B4FC' : '#6B7280', fontWeight: 700 }}>Filtrar</button>
                {pageFilterB && <button onClick={() => { setPageFilterB(''); setInputPageB('') }} style={{ padding: '3px 6px', borderRadius: 4, fontSize: 9, cursor: 'pointer', background: 'none', border: '1px solid rgba(239,68,68,0.3)', color: '#EF4444' }}>✕</button>}
              </div>
            </div>
          </div>
        ) : (
          /* Filtros modo simples */
          <div style={{
            display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap',
            background: 'rgba(99,102,241,0.05)', border: '1px solid rgba(99,102,241,0.15)',
            borderRadius: 8, padding: '10px 16px',
          }}>
            <Filter size={13} color="#A5B4FC" />

            {/* Evento */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 11, color: '#8A9BAA', fontWeight: 700 }}>Evento:</span>
              <input value={inputEventA} onChange={e => setInputEventA(e.target.value)} onKeyDown={e => e.key === 'Enter' && applyFilterA()}
                style={{ background: '#0D1B26', border: '1px solid rgba(99,102,241,0.3)', borderRadius: 6, padding: '5px 10px', fontSize: 12, color: '#F5F4F3', fontFamily: 'monospace', width: 180, outline: 'none' }} />
              <button onClick={applyFilterA} style={{ padding: '5px 10px', borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: 'Manrope, sans-serif', background: 'rgba(99,102,241,0.12)', border: '1px solid rgba(99,102,241,0.35)', color: '#A5B4FC' }}>Aplicar</button>
            </div>

            <div style={{ width: 1, height: 20, background: 'rgba(255,255,255,0.08)' }} />

            {/* Página / path */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, position: 'relative' }}>
              <Search size={12} color="#8A9BAA" />
              <span style={{ fontSize: 11, color: '#8A9BAA', fontWeight: 700 }}>Página:</span>
              <input
                value={inputPageA}
                onChange={e => { setInputPageA(e.target.value); setShowPageSugA(true) }}
                onKeyDown={e => { if (e.key === 'Enter') { applyPageA(); setShowPageSugA(false) } }}
                onBlur={() => setTimeout(() => setShowPageSugA(false), 150)}
                placeholder="ex: /inscricao"
                style={{
                  background: '#0D1B26', border: `1px solid ${pageFilterA ? 'rgba(99,102,241,0.6)' : 'rgba(99,102,241,0.3)'}`,
                  borderRadius: 6, padding: '5px 10px', fontSize: 11, color: '#F5F4F3',
                  fontFamily: 'monospace', width: 180, outline: 'none',
                }}
              />
              <button onClick={() => { applyPageA(); setShowPageSugA(false) }} style={{
                padding: '5px 10px', borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: 'pointer',
                fontFamily: 'Manrope, sans-serif',
                background: pageFilterA ? 'rgba(99,102,241,0.2)' : 'rgba(99,102,241,0.08)',
                border: `1px solid ${pageFilterA ? 'rgba(99,102,241,0.6)' : 'rgba(99,102,241,0.25)'}`,
                color: pageFilterA ? '#A5B4FC' : '#6B7280',
              }}>Filtrar</button>
              {pageFilterA && (
                <button onClick={() => { setPageFilterA(''); setInputPageA('') }} style={{ padding: '4px 8px', borderRadius: 5, fontSize: 10, cursor: 'pointer', background: 'none', border: '1px solid rgba(239,68,68,0.3)', color: '#EF4444' }}>✕</button>
              )}
              {showPageSugA && topPagesA.length > 0 && inputPageA.length > 0 && (
                <div style={{ position: 'absolute', top: '100%', left: 68, zIndex: 100, background: '#0D1B26', border: '1px solid rgba(99,102,241,0.4)', borderRadius: 6, marginTop: 2, minWidth: 240, maxHeight: 160, overflowY: 'auto', boxShadow: '0 8px 24px rgba(0,0,0,0.5)' }}>
                  {topPagesA.filter(p => p.page?.includes(inputPageA)).slice(0, 8).map((p, i) => (
                    <div key={i} onMouseDown={() => { setInputPageA(p.page); setPageFilterA(p.page); setShowPageSugA(false) }}
                      style={{ padding: '7px 12px', cursor: 'pointer', fontSize: 11, color: '#C4D0DC', fontFamily: 'monospace', borderBottom: '1px solid rgba(255,255,255,0.04)' }}
                      onMouseEnter={e => e.currentTarget.style.background = 'rgba(99,102,241,0.12)'}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                    >
                      <div>{p.page}</div>
                      <div style={{ fontSize: 9, color: '#6B7280' }}>{p.views} views</div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div style={{ width: 1, height: 20, background: 'rgba(255,255,255,0.08)' }} />

            {/* Canal */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 11, color: '#8A9BAA', fontWeight: 700 }}>Canal:</span>
              <select value={channelFilterA} onChange={e => setChannelFilterA(e.target.value)} style={SELECT_STYLE}>
                <option value="">Todos os canais</option>
                {(dataA?.channelList || []).map(c => <option key={c} value={c}>{c}</option>)}
              </select>
              {channelFilterA && (
                <button onClick={() => setChannelFilterA('')} style={{ padding: '4px 8px', borderRadius: 5, fontSize: 10, cursor: 'pointer', background: 'none', border: '1px solid rgba(239,68,68,0.3)', color: '#EF4444' }}>✕</button>
              )}
            </div>

            {/* Atalhos */}
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
              {['generate_lead', 'page_view', 'begin_checkout', 'purchase', 'form_start', 'form_submit', 'qualify_lead'].map(ev => (
                <button key={ev} onClick={() => { setEventFilterA(ev); setInputEventA(ev) }} style={{
                  padding: '3px 8px', borderRadius: 4, fontSize: 10, cursor: 'pointer', fontFamily: 'monospace',
                  background: eventFilterA === ev ? `${evColor(ev)}22` : 'rgba(255,255,255,0.04)',
                  border: `1px solid ${eventFilterA === ev ? `${evColor(ev)}60` : 'rgba(255,255,255,0.08)'}`,
                  color: eventFilterA === ev ? evColor(ev) : '#6B7280',
                  fontWeight: eventFilterA === ev ? 700 : 400,
                }}>{ev}</button>
              ))}
            </div>
          </div>
        )}

        {/* ── Conteúdo principal ── */}
        {compareMode ? (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <PanelAWithCapture />
            <PanelB />
          </div>
        ) : (
          <PanelAWithCapture />
        )}

      </div>
    </div>
  )
}

// ── Sub-componentes reutilizáveis ─────────────────────────────────────────────

function ChannelTable({ channels, channelFilter, setChannelFilter }) {
  const channelTableData = (channels || []).map(ch => ({
    channel:  ch.channel,
    users:    ch.users,
    leads:    ch.events['generate_lead'] || 0,
    qual:     ch.events['qualify_lead']  || 0,
    mql:      ch.events['MQL']           || 0,
    checkout: ch.events['begin_checkout']|| 0,
    purchase: ch.events['purchase']      || 0,
  }))

  return (
    <Card>
      <CardHeader title="Canais × Conversões · últimos 30 min" subtitle="Usuários ativos e eventos de conversão por canal" />
      <CardBody style={{ padding: 0 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '160px 60px 70px 60px 50px 70px 60px', gap: 6, padding: '6px 16px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          {[{ label: 'Canal', color: '#6B7280' }, { label: 'Usuários', color: '#6366F1' }, { label: 'Lead', color: '#00BFD3' }, { label: 'Qualif.', color: '#34D399' }, { label: 'MQL', color: '#C9A962' }, { label: 'Checkout', color: '#F59E0B' }, { label: 'Purchase', color: '#22C55E' }].map((h, i) => (
            <div key={i} style={{ fontSize: 10, color: h.color, fontWeight: 700, textAlign: i > 0 ? 'right' : 'left' }}>{h.label}</div>
          ))}
        </div>
        {channelTableData.map((ch, i) => {
          const color = chColor(ch.channel)
          const isActive = channelFilter === ch.channel
          return (
            <div key={i} onClick={() => setChannelFilter(channelFilter === ch.channel ? '' : ch.channel)} style={{
              display: 'grid', gridTemplateColumns: '160px 60px 70px 60px 50px 70px 60px',
              gap: 6, padding: '9px 16px', borderBottom: '1px solid rgba(255,255,255,0.04)',
              background: isActive ? `${color}0D` : 'transparent',
              borderLeft: isActive ? `2px solid ${color}` : '2px solid transparent', cursor: 'pointer', transition: 'background 0.12s',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ width: 7, height: 7, borderRadius: '50%', background: color, flexShrink: 0, display: 'inline-block' }} />
                <span style={{ fontSize: 11, color: isActive ? color : '#C4D0DC', fontWeight: isActive ? 700 : 400, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ch.channel}</span>
              </div>
              <div style={{ textAlign: 'right', fontSize: 11, color: '#6366F1', fontWeight: 600 }}>{fmtNum(ch.users)}</div>
              <div style={{ textAlign: 'right', fontSize: 11, color: ch.leads > 0 ? '#00BFD3' : '#374151', fontWeight: ch.leads > 0 ? 700 : 400 }}>{fmtNum(ch.leads)}</div>
              <div style={{ textAlign: 'right', fontSize: 11, color: ch.qual > 0 ? '#34D399' : '#374151' }}>{fmtNum(ch.qual)}</div>
              <div style={{ textAlign: 'right', fontSize: 11, color: ch.mql > 0 ? '#C9A962' : '#374151' }}>{fmtNum(ch.mql)}</div>
              <div style={{ textAlign: 'right', fontSize: 11, color: ch.checkout > 0 ? '#F59E0B' : '#374151' }}>{fmtNum(ch.checkout)}</div>
              <div style={{ textAlign: 'right', fontSize: 11, color: ch.purchase > 0 ? '#22C55E' : '#374151', fontWeight: ch.purchase > 0 ? 700 : 400 }}>{fmtNum(ch.purchase)}</div>
            </div>
          )
        })}
      </CardBody>
    </Card>
  )
}

function TopEventsCard({ data, eventFilter, setEventFilter }) {
  const maxEventCount = Math.max(...(data?.topEvents || []).map(e => e.count), 1)
  return (
    <Card>
      <CardHeader title="Top eventos · agora" subtitle={`${fmtNum(data?.totalEvents ?? 0)} eventos · ${fmtNum(data?.activeUsers ?? 0)} ativos`} />
      <CardBody style={{ padding: 0 }}>
        {(data?.topEvents || []).length > 0 && (
          <div style={{ padding: '8px 12px 0' }}>
            <ResponsiveContainer width="100%" height={90}>
              <BarChart data={(data.topEvents || []).slice(0, 8)} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
                <XAxis dataKey="event" tick={{ fill: '#8A9BAA', fontSize: 8, fontFamily: 'monospace' }} axisLine={false} tickLine={false} interval={0} angle={-15} textAnchor="end" height={28} />
                <YAxis tick={{ fill: '#8A9BAA', fontSize: 8 }} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip content={({ active, payload, label }) => {
                  if (!active || !payload?.length) return null
                  return <div style={TT.contentStyle}><div style={{ fontWeight: 700, fontSize: 10 }}>{label}</div><div style={{ color: payload[0]?.fill, fontSize: 10 }}>Disparos: {fmtNum(payload[0]?.value)}</div></div>
                }} />
                <Bar dataKey="count" radius={[3, 3, 0, 0]}>
                  {(data.topEvents || []).slice(0, 8).map((ev, i) => <Cell key={i} fill={evColor(ev.event)} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 60px 60px', gap: 8, padding: '6px 12px', borderBottom: '1px solid rgba(255,255,255,0.06)', marginTop: 8 }}>
          {['Evento', 'Disparos', 'Usuários'].map((h, i) => (
            <div key={i} style={{ fontSize: 10, color: '#6B7280', fontWeight: 700, textAlign: i > 0 ? 'right' : 'left' }}>{h}</div>
          ))}
        </div>
        {(data?.topEvents || []).length === 0 ? (
          <div style={{ padding: '24px 12px', textAlign: 'center', color: '#6B7280', fontSize: 12 }}>Sem dados</div>
        ) : (data.topEvents || []).map((ev, i) => {
          const color   = evColor(ev.event)
          const pct     = (ev.count / maxEventCount) * 100
          const isFocus = ev.event === eventFilter
          const isConv  = CONV_EVENTS.includes(ev.event)
          return (
            <div key={i} onClick={() => setEventFilter(ev.event)} style={{
              padding: '7px 12px', borderBottom: '1px solid rgba(255,255,255,0.04)',
              background: isFocus ? `${color}10` : 'transparent',
              borderLeft: isFocus ? `2px solid ${color}` : '2px solid transparent', cursor: 'pointer',
            }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 60px 60px', gap: 8, alignItems: 'center', marginBottom: 4 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ width: 7, height: 7, borderRadius: '50%', background: color, display: 'inline-block', flexShrink: 0 }} />
                  <span style={{ fontSize: 11, color: isFocus ? color : '#F5F4F3', fontFamily: 'monospace', fontWeight: isFocus ? 700 : 400 }}>{ev.event}</span>
                  {isConv && <span style={{ fontSize: 9, color, background: `${color}18`, borderRadius: 3, padding: '1px 4px' }}>conv</span>}
                </div>
                <div style={{ textAlign: 'right', fontSize: 12, color: '#F5F4F3', fontWeight: 700 }}>{fmtNum(ev.count)}</div>
                <div style={{ textAlign: 'right', fontSize: 11, color: '#8A9BAA' }}>{fmtNum(ev.users)}</div>
              </div>
              <div style={{ height: 3, background: 'rgba(255,255,255,0.05)', borderRadius: 2 }}>
                <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: 2, opacity: 0.8, transition: 'width 0.4s ease' }} />
              </div>
            </div>
          )
        })}
      </CardBody>
    </Card>
  )
}

function TopPagesCard({ data, channelFilter, setPageFilter }) {
  const MEDALS = ['#F59E0B', '#9CA3AF', '#B45309', '#6B7280', '#6B7280', '#6B7280', '#6B7280', '#6B7280']
  return (
    <Card>
      <CardHeader title="Páginas mais acessadas agora" subtitle={`Realtime · ${channelFilter ? `canal: ${channelFilter} · ` : ''}últimos 30 min`} />
      <CardBody>
        {!(data?.topPages?.length > 0) ? (
          <div style={{ padding: '40px 0', textAlign: 'center', color: '#6B7280', fontSize: 12 }}>Sem dados de páginas</div>
        ) : (() => {
          const pages    = data.topPages
          const maxViews = pages[0]?.views || 1
          return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {pages.map((p, i) => {
                const pct = (p.views / maxViews) * 100
                const isFirst = i === 0
                return (
                  <div key={i} onClick={() => setPageFilter && setPageFilter(p.page)} style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: setPageFilter ? 'pointer' : 'default' }}>
                    <div style={{ minWidth: 24, textAlign: 'center', fontSize: isFirst ? 15 : 12, fontWeight: 800, color: MEDALS[i] }}>{i + 1}°</div>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                        <span style={{ fontSize: isFirst ? 12 : 11, fontWeight: isFirst ? 700 : 400, color: isFirst ? '#F5F4F3' : '#C4D0DC', fontFamily: 'monospace', maxWidth: '55%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={p.page}>{p.page}</span>
                        <div style={{ display: 'flex', gap: 8, fontSize: 11 }}>
                          <span style={{ color: isFirst ? MEDALS[0] : '#8A9BAA' }}>{fmtNum(p.views)} views</span>
                          <span style={{ color: '#6366F1' }}>{fmtNum(p.users)} u</span>
                        </div>
                      </div>
                      <div style={{ height: isFirst ? 5 : 3, background: 'rgba(255,255,255,0.06)', borderRadius: 3 }}>
                        <div style={{ width: `${pct}%`, height: '100%', background: MEDALS[i], borderRadius: 3, opacity: isFirst ? 1 : 0.7, transition: 'width 0.4s' }} />
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )
        })()}
      </CardBody>
    </Card>
  )
}
