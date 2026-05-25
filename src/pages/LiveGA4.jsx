import { useState, useEffect, useRef, useCallback } from 'react'
import Header from '../components/layout/Header'
import Card, { CardHeader, CardBody } from '../components/ui/Card'
import { api } from '../services/api'
import { fmtNum } from '../utils/format'
import { TT } from '../components/ui/DarkTooltip'
import {
  AreaChart, Area, BarChart, Bar, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'
import { Radio, RefreshCw, Activity, Clock, CheckCircle2, AlertTriangle, Filter, Columns } from 'lucide-react'
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

function KpiCard({ label, value, sub, color = '#6366F1', sparkData, pulse }) {
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
      <div style={{ fontSize: 20, fontWeight: 800, color: '#F5F4F3', lineHeight: 1.1 }}>{value}</div>
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

export default function LiveGA4() {
  const { selectedGA4 } = useTracking()
  const propertyId = selectedGA4 || '381992026'

  const [eventFilter, setEventFilter] = useState('generate_lead')
  const [inputEvent, setInputEvent]   = useState('generate_lead')
  const [channelFilter, setChannelFilter] = useState('')

  // Filtros UTM para a tabela detalhada
  const [utmSourceFilter,   setUtmSourceFilter]   = useState('')
  const [utmMediumFilter,   setUtmMediumFilter]   = useState('')
  const [utmCampaignFilter, setUtmCampaignFilter] = useState('')

  // Colunas visíveis na tabela UTM (toggle)
  const [utmCols, setUtmCols] = useState({
    event: true, page: true, source: true, medium: true, campaign: true, count: true, users: true,
  })
  const toggleCol = (col) => setUtmCols(prev => ({ ...prev, [col]: !prev[col] }))

  const [isRunning, setIsRunning]     = useState(true)
  const [countdown, setCountdown]     = useState(POLL_MS / 1000)

  const [data, setData]       = useState(null)
  const [loading, setLoading] = useState(false)

  // Histórico de ciclos (sparklines + pulso)
  const historyRef = useRef([])
  const [history, setHistory] = useState([])
  const prevCountRef = useRef(null)

  const fetchData = useCallback(async () => {
    setLoading(true)
    const now = new Date()
    const timeLabel = now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    const result = await api.liveGa4(propertyId, eventFilter, channelFilter)
    setData(result)
    setLoading(false)

    const evRow = (result?.topEvents || []).find(e => e.event === eventFilter)
    const count = evRow?.count ?? 0
    const prev  = prevCountRef.current
    const delta = prev != null ? Math.max(0, count - prev) : 0
    prevCountRef.current = count

    const point = { time: timeLabel, delta, activeUsers: result?.activeUsers ?? 0 }
    const updated = [...historyRef.current, point].slice(-40)
    historyRef.current = updated
    setHistory(updated)
    setCountdown(POLL_MS / 1000)
  }, [propertyId, eventFilter, channelFilter])

  useEffect(() => {
    prevCountRef.current = null
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

  const applyFilter = () => {
    const f = inputEvent.trim() || 'generate_lead'
    setEventFilter(f)
  }

  const maxEventCount = Math.max(...(data?.topEvents || []).map(e => e.count), 1)

  // Constrói dados do canal × evento de conversão para a tabela
  const channelTableData = (data?.channels || []).map(ch => ({
    channel:  ch.channel,
    users:    ch.users,
    leads:    ch.events['generate_lead'] || 0,
    qual:     ch.events['qualify_lead']  || 0,
    mql:      ch.events['MQL']           || 0,
    checkout: ch.events['begin_checkout']|| 0,
    purchase: ch.events['purchase']      || 0,
    pageView: ch.events['page_view']     || 0,
  }))

  // Timeline: inverte para mostrar mais antigo → mais recente (esquerda → direita)
  const timelineData = [...(data?.timeline || [])].reverse()

  // Tabela UTM filtrada
  const allUtmRows = data?.utmRows || []
  const utmTableData = allUtmRows.filter(r =>
    (!utmSourceFilter   || r.source   === utmSourceFilter)   &&
    (!utmMediumFilter   || r.medium   === utmMediumFilter)   &&
    (!utmCampaignFilter || r.campaign === utmCampaignFilter)
  )

  // Listas derivadas dos rows (fallback se backend não mandou)
  const utmSources   = data?.utmSources?.length   ? data.utmSources   : [...new Set(allUtmRows.map(r => r.source).filter(Boolean))].sort()
  const utmMediums   = data?.utmMediums?.length   ? data.utmMediums   : [...new Set(allUtmRows.map(r => r.medium).filter(Boolean))].sort()
  const utmCampaigns = data?.utmCampaigns?.length ? data.utmCampaigns : [...new Set(allUtmRows.map(r => r.campaign).filter(Boolean))].sort()

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

      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>

        {/* ── Filtros ── */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap',
          background: 'rgba(99,102,241,0.05)', border: '1px solid rgba(99,102,241,0.15)',
          borderRadius: 8, padding: '10px 16px',
        }}>
          <Filter size={13} color="#A5B4FC" />

          {/* Evento */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 11, color: '#8A9BAA', fontWeight: 700 }}>Evento:</span>
            <input
              value={inputEvent}
              onChange={e => setInputEvent(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && applyFilter()}
              style={{
                background: '#0D1B26', border: '1px solid rgba(99,102,241,0.3)',
                borderRadius: 6, padding: '5px 10px', fontSize: 12, color: '#F5F4F3',
                fontFamily: 'monospace', width: 180, outline: 'none',
              }}
            />
            <button onClick={applyFilter} style={{
              padding: '5px 10px', borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: 'pointer',
              fontFamily: 'Manrope, sans-serif',
              background: 'rgba(99,102,241,0.12)', border: '1px solid rgba(99,102,241,0.35)', color: '#A5B4FC',
            }}>Aplicar</button>
          </div>

          <div style={{ width: 1, height: 20, background: 'rgba(255,255,255,0.08)' }} />

          {/* Canal */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 11, color: '#8A9BAA', fontWeight: 700 }}>Canal:</span>
            <select
              value={channelFilter}
              onChange={e => setChannelFilter(e.target.value)}
              style={SELECT_STYLE}
            >
              <option value="">Todos os canais</option>
              {(data?.channelList || []).map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
            {channelFilter && (
              <button onClick={() => setChannelFilter('')} style={{
                padding: '4px 8px', borderRadius: 5, fontSize: 10, cursor: 'pointer',
                background: 'none', border: '1px solid rgba(239,68,68,0.3)', color: '#EF4444',
              }}>✕</button>
            )}
          </div>

          {/* Atalhos de evento */}
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
            {['generate_lead', 'page_view', 'begin_checkout', 'purchase'].map(ev => (
              <button
                key={ev}
                onClick={() => { setEventFilter(ev); setInputEvent(ev) }}
                style={{
                  padding: '3px 8px', borderRadius: 4, fontSize: 10, cursor: 'pointer',
                  fontFamily: 'monospace',
                  background: eventFilter === ev ? `${evColor(ev)}22` : 'rgba(255,255,255,0.04)',
                  border: `1px solid ${eventFilter === ev ? `${evColor(ev)}60` : 'rgba(255,255,255,0.08)'}`,
                  color: eventFilter === ev ? evColor(ev) : '#6B7280',
                  fontWeight: eventFilter === ev ? 700 : 400,
                }}
              >{ev}</button>
            ))}
          </div>
        </div>

        {/* ── KPIs ── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
          <KpiCard
            label="Usuários ativos agora"
            value={fmtNum(data?.activeUsers ?? 0)}
            sub={`capturado às ${fmtTime(data?.capturedAt)}`}
            color="#6366F1"
            sparkData={history.slice(-12).map(p => ({ v: p.activeUsers }))}
            pulse={!data?.mock}
          />
          <KpiCard
            label={`"${eventFilter}" · últimos 30 min`}
            value={fmtNum((data?.topEvents || []).find(e => e.event === eventFilter)?.count ?? 0)}
            sub={`delta último ciclo: +${fmtNum(history.length > 0 ? history[history.length - 1]?.delta ?? 0 : 0)}`}
            color={evColor(eventFilter)}
            sparkData={history.slice(-12).map(p => ({ v: p.delta }))}
            pulse={!data?.mock}
          />
          <KpiCard
            label="Total de eventos (30 min)"
            value={fmtNum(data?.totalEvents ?? 0)}
            sub={`${(data?.topEvents || []).length} tipos · ${(data?.channels || []).length} canais ativos`}
            color="#A855F7"
          />
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
              return ch ? `${ch.channel} · ${fmtNum(ch.users)} usuários` : '—'
            })()}
            color="#F59E0B"
          />
        </div>

        {/* ── Timeline dos últimos 30 min ── */}
        <Card>
          <CardHeader
            title={`Timeline · últimos 30 min`}
            subtitle={`"${eventFilter}"${channelFilter ? ` · canal: ${channelFilter}` : ''} · granularidade por minuto`}
            action={<div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, color: '#6B7280' }}><Activity size={10} />{fmtTime(data?.capturedAt)}</div>}
          />
          <CardBody>
            {timelineData.length < 2 ? (
              <div style={{ height: 150, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#6B7280', fontSize: 12 }}>
                Aguardando dados…
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={150}>
                <AreaChart data={timelineData} margin={{ top: 4, right: 12, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="tlEventGrad" x1="0" y1="0" x2="0" y2="1">
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
                  <Area type="monotone" dataKey={eventFilter}  name={eventFilter}    stroke={evColor(eventFilter)} strokeWidth={2} fill="url(#tlEventGrad)" dot={false} activeDot={{ r: 4 }} />
                  <Area type="monotone" dataKey="page_view"    name="page_view"      stroke="#4B6272"              strokeWidth={1} fill="url(#tlPvGrad)"    dot={false} activeDot={{ r: 3 }} strokeDasharray="4 2" />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </CardBody>
        </Card>

        {/* ── Canal × Conversões ── */}
        {channelTableData.length > 0 && (
          <Card>
            <CardHeader
              title="Canais × Conversões · últimos 30 min"
              subtitle="Usuários ativos e eventos de conversão por canal de origem"
            />
            <CardBody style={{ padding: 0 }}>
              {/* Header */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: '160px 60px 70px 60px 50px 70px 60px',
                gap: 6, padding: '6px 16px', borderBottom: '1px solid rgba(255,255,255,0.06)',
              }}>
                {[
                  { label: 'Canal',       color: '#6B7280' },
                  { label: 'Usuários',    color: '#6366F1' },
                  { label: 'Lead',        color: '#00BFD3' },
                  { label: 'Qualif.',     color: '#34D399' },
                  { label: 'MQL',         color: '#C9A962' },
                  { label: 'Checkout',    color: '#F59E0B' },
                  { label: 'Purchase',    color: '#22C55E' },
                ].map((h, i) => (
                  <div key={i} style={{ fontSize: 10, color: h.color, fontWeight: 700, textAlign: i > 0 ? 'right' : 'left' }}>{h.label}</div>
                ))}
              </div>
              {channelTableData.map((ch, i) => {
                const color = chColor(ch.channel)
                const isActive = channelFilter === ch.channel
                return (
                  <div
                    key={i}
                    onClick={() => setChannelFilter(channelFilter === ch.channel ? '' : ch.channel)}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '160px 60px 70px 60px 50px 70px 60px',
                      gap: 6, padding: '9px 16px',
                      borderBottom: '1px solid rgba(255,255,255,0.04)',
                      background: isActive ? `${color}0D` : 'transparent',
                      borderLeft: isActive ? `2px solid ${color}` : '2px solid transparent',
                      cursor: 'pointer',
                      transition: 'background 0.12s',
                    }}
                  >
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
        )}

        {/* ── 2 colunas: Top eventos + Top páginas ── */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>

          {/* Top eventos */}
          <Card>
            <CardHeader
              title="Top eventos · agora"
              subtitle={`${fmtNum(data?.totalEvents ?? 0)} eventos · ${fmtNum(data?.activeUsers ?? 0)} ativos`}
            />
            <CardBody style={{ padding: 0 }}>
              {(data?.topEvents || []).length > 0 && (
                <div style={{ padding: '8px 12px 0' }}>
                  <ResponsiveContainer width="100%" height={100}>
                    <BarChart data={(data.topEvents || []).slice(0, 8)} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
                      <XAxis dataKey="event" tick={{ fill: '#8A9BAA', fontSize: 8, fontFamily: 'monospace' }}
                        axisLine={false} tickLine={false} interval={0} angle={-15} textAnchor="end" height={28} />
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
                const color  = evColor(ev.event)
                const pct    = (ev.count / maxEventCount) * 100
                const isFocus = ev.event === eventFilter
                const isConv  = CONV_EVENTS.includes(ev.event)
                return (
                  <div
                    key={i}
                    onClick={() => { setEventFilter(ev.event); setInputEvent(ev.event) }}
                    style={{
                      padding: '7px 12px', borderBottom: '1px solid rgba(255,255,255,0.04)',
                      background: isFocus ? `${color}10` : 'transparent',
                      borderLeft: isFocus ? `2px solid ${color}` : '2px solid transparent',
                      cursor: 'pointer',
                    }}
                  >
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

          {/* Top páginas */}
          <Card>
            <CardHeader
              title="Páginas mais acessadas agora"
              subtitle={`Realtime · ${channelFilter ? `canal: ${channelFilter} · ` : ''}últimos 30 min`}
            />
            <CardBody>
              {!(data?.topPages?.length > 0) ? (
                <div style={{ padding: '40px 0', textAlign: 'center', color: '#6B7280', fontSize: 12 }}>Sem dados de páginas</div>
              ) : (() => {
                const pages    = data.topPages
                const maxViews = pages[0]?.views || 1
                const MEDALS   = ['#F59E0B', '#9CA3AF', '#B45309', '#6B7280', '#6B7280', '#6B7280', '#6B7280', '#6B7280']
                return (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {pages.map((p, i) => {
                      const pct = (p.views / maxViews) * 100
                      const isFirst = i === 0
                      return (
                        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <div style={{ minWidth: 24, textAlign: 'center', fontSize: isFirst ? 15 : 12, fontWeight: 800, color: MEDALS[i] }}>
                            {i + 1}°
                          </div>
                          <div style={{ flex: 1 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                              <span style={{
                                fontSize: isFirst ? 12 : 11, fontWeight: isFirst ? 700 : 400,
                                color: isFirst ? '#F5F4F3' : '#C4D0DC', fontFamily: 'monospace',
                                maxWidth: '55%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                              }} title={p.page}>{p.page}</span>
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
        </div>

        {/* ── Tabela UTM detalhada ── */}
        <Card>
          <CardHeader
            title="Tabela UTM · Evento × Página × Origem"
            subtitle={`${utmTableData.length} linha${utmTableData.length !== 1 ? 's' : ''} · últimos 30 min${utmSourceFilter || utmMediumFilter || utmCampaignFilter ? ' · filtros ativos' : ''}`}
            action={
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <Columns size={11} color="#8A9BAA" />
                {[
                  { key: 'page',     label: 'Página'    },
                  { key: 'source',   label: 'Source'    },
                  { key: 'medium',   label: 'Medium'    },
                  { key: 'campaign', label: 'Campaign'  },
                  { key: 'users',    label: 'Usuários'  },
                ].map(col => (
                  <button
                    key={col.key}
                    onClick={() => toggleCol(col.key)}
                    style={{
                      padding: '2px 7px', borderRadius: 4, fontSize: 9, cursor: 'pointer',
                      fontFamily: 'Manrope, sans-serif', fontWeight: 700,
                      background: utmCols[col.key] ? 'rgba(99,102,241,0.2)' : 'rgba(255,255,255,0.04)',
                      border: `1px solid ${utmCols[col.key] ? 'rgba(99,102,241,0.5)' : 'rgba(255,255,255,0.08)'}`,
                      color: utmCols[col.key] ? '#A5B4FC' : '#6B7280',
                    }}
                  >{col.label}</button>
                ))}
              </div>
            }
          />
          {/* Filtros UTM */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap',
            padding: '8px 16px', borderBottom: '1px solid rgba(255,255,255,0.06)',
          }}>
            <Filter size={11} color="#6B7280" />
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
                  style={{ ...SELECT_STYLE, padding: '4px 24px 4px 8px', fontSize: 11, border: `1px solid ${f.value ? 'rgba(99,102,241,0.5)' : 'rgba(99,102,241,0.2)'}` }}
                >
                  <option value="">Todos</option>
                  {f.list.map(v => <option key={v} value={v}>{v || '(direct)'}</option>)}
                </select>
                {f.value && (
                  <button onClick={() => f.setter('')} style={{ padding: '2px 6px', borderRadius: 4, fontSize: 9, cursor: 'pointer', background: 'none', border: '1px solid rgba(239,68,68,0.3)', color: '#EF4444' }}>✕</button>
                )}
              </div>
            ))}
            {(utmSourceFilter || utmMediumFilter || utmCampaignFilter) && (
              <button
                onClick={() => { setUtmSourceFilter(''); setUtmMediumFilter(''); setUtmCampaignFilter('') }}
                style={{ padding: '3px 8px', borderRadius: 4, fontSize: 10, cursor: 'pointer', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#EF4444', fontWeight: 700 }}
              >Limpar tudo</button>
            )}
          </div>

          <CardBody style={{ padding: 0 }}>
            {/* Header dinâmico */}
            {(() => {
              const activeCols = [
                { key: 'event',    label: 'Evento',    flex: '140px', align: 'left'  },
                utmCols.page     && { key: 'page',     label: 'Página',    flex: '1',      align: 'left'  },
                utmCols.source   && { key: 'source',   label: 'Source',    flex: '90px',   align: 'left'  },
                utmCols.medium   && { key: 'medium',   label: 'Medium',    flex: '80px',   align: 'left'  },
                utmCols.campaign && { key: 'campaign', label: 'Campaign',  flex: '1',      align: 'left'  },
                { key: 'count',   label: 'Disparos',  flex: '70px',   align: 'right' },
                utmCols.users    && { key: 'users',    label: 'Usuários',  flex: '70px',   align: 'right' },
              ].filter(Boolean)

              const gridCols = activeCols.map(c => c.flex).join(' ')

              return (
                <>
                  <div style={{ display: 'grid', gridTemplateColumns: gridCols, gap: 8, padding: '6px 16px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                    {activeCols.map((col, i) => (
                      <div key={col.key} style={{ fontSize: 10, color: '#6B7280', fontWeight: 700, textAlign: col.align }}>{col.label}</div>
                    ))}
                  </div>
                  {utmTableData.length === 0 ? (
                    <div style={{ padding: '24px 16px', textAlign: 'center', color: '#6B7280', fontSize: 12 }}>
                      {(utmSourceFilter || utmMediumFilter || utmCampaignFilter) ? 'Sem resultados para este filtro' : 'Sem dados UTM nos últimos 30 min'}
                    </div>
                  ) : utmTableData.map((r, i) => {
                    const color   = evColor(r.event)
                    const isConv  = CONV_EVENTS.includes(r.event)
                    return (
                      <div key={i} style={{
                        display: 'grid', gridTemplateColumns: gridCols, gap: 8,
                        padding: '7px 16px', borderBottom: '1px solid rgba(255,255,255,0.03)',
                        background: isConv ? `${color}08` : 'transparent',
                        borderLeft: isConv ? `2px solid ${color}` : '2px solid transparent',
                        alignItems: 'center',
                      }}>
                        {/* Evento */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                          <span style={{ width: 6, height: 6, borderRadius: '50%', background: color, flexShrink: 0, display: 'inline-block' }} />
                          <span style={{ fontSize: 11, color: isConv ? color : '#C4D0DC', fontFamily: 'monospace', fontWeight: isConv ? 700 : 400, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.event}</span>
                        </div>
                        {utmCols.page     && <div style={{ fontSize: 11, color: '#8A9BAA', fontFamily: 'monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={r.page}>{r.page || '—'}</div>}
                        {utmCols.source   && (
                          <div>
                            {r.source
                              ? <span style={{ fontSize: 10, color: '#F5F4F3', background: 'rgba(255,255,255,0.06)', borderRadius: 3, padding: '1px 6px', fontWeight: 600 }}>{r.source}</span>
                              : <span style={{ fontSize: 10, color: '#374151' }}>(direct)</span>
                            }
                          </div>
                        )}
                        {utmCols.medium   && (
                          <div>
                            {r.medium
                              ? <span style={{ fontSize: 10, color: r.medium === 'cpc' ? '#F59E0B' : r.medium === 'organic' ? '#22C55E' : '#A5B4FC', background: 'rgba(255,255,255,0.05)', borderRadius: 3, padding: '1px 6px' }}>{r.medium}</span>
                              : <span style={{ fontSize: 10, color: '#374151' }}>—</span>
                            }
                          </div>
                        )}
                        {utmCols.campaign && <div style={{ fontSize: 11, color: r.campaign ? '#C4D0DC' : '#374151', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={r.campaign}>{r.campaign || '—'}</div>}
                        <div style={{ textAlign: 'right', fontSize: 12, color: '#F5F4F3', fontWeight: 700 }}>{fmtNum(r.count)}</div>
                        {utmCols.users    && <div style={{ textAlign: 'right', fontSize: 11, color: '#8A9BAA' }}>{fmtNum(r.users)}</div>}
                      </div>
                    )
                  })}
                </>
              )
            })()}
          </CardBody>
        </Card>

      </div>
    </div>
  )
}
