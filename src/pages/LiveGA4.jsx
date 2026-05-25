import { useState, useEffect, useRef, useCallback, memo } from 'react'
import Header from '../components/layout/Header'
import Card, { CardHeader, CardBody } from '../components/ui/Card'
import { api } from '../services/api'
import { fmtNum } from '../utils/format'
import { TT } from '../components/ui/DarkTooltip'
import {
  AreaChart, Area, BarChart, Bar, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'
import {
  Radio, RefreshCw, Activity, Clock, CheckCircle2, AlertTriangle,
  Filter, X, MapPin, ChevronUp, ChevronDown,
  Monitor, Table2, Columns2, ExternalLink, Zap, Download,
} from 'lucide-react'
import { useTracking } from '../context/TrackingContext'
import SelectUI from '../components/ui/Select'

const POLL_MS = 30_000

const EVENT_SHORTCUTS = ['generate_lead', 'page_view', 'begin_checkout', 'purchase', 'form_start', 'form_submit', 'qualify_lead']

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

const DEVICE_COLORS = {
  'desktop': '#6366F1',
  'mobile':  '#00BFD3',
  'tablet':  '#F59E0B',
  'smart tv':'#34D399',
}
function chColor(name) { return DEVICE_COLORS[name?.toLowerCase()] ?? '#4B6272' }

function fmtTime(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}
function fmtDelta(curr, prev) {
  if (prev == null || prev === 0) return null
  const pct = ((curr - prev) / prev) * 100
  return { pct: Math.abs(pct).toFixed(1), up: pct >= 0 }
}

// ── Export CSV/XLSX ───────────────────────────────────────────────────────────
function exportCSV(data, filename) {
  if (!data?.length) return
  const keys = Object.keys(data[0])
  const header = keys.join(',')
  const rows = data.map(r => keys.map(k => {
    const v = r[k] ?? ''
    return typeof v === 'string' && (v.includes(',') || v.includes('"') || v.includes('\n'))
      ? `"${v.replace(/"/g, '""')}"` : v
  }).join(','))
  const csv = [header, ...rows].join('\n')
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a'); a.href = url; a.download = filename; a.click()
  URL.revokeObjectURL(url)
}

function buildExportData(data, windowMin) {
  const win = windowMin || 30
  const ts = new Date().toLocaleString('pt-BR')
  const sections = []

  if (data?.topEvents?.length) {
    sections.push({ sheet: 'Top Eventos', rows: data.topEvents.map(e => ({ capturado_em: ts, janela_min: win, evento: e.event, disparos: e.count, usuarios: e.users })) })
  }
  if (data?.utmRows?.length) {
    sections.push({ sheet: 'UTM', rows: data.utmRows.map(r => ({ capturado_em: ts, janela_min: win, evento: r.event, pagina: r.page, source: r.source, medium: r.medium, campaign: r.campaign, disparos: r.count, usuarios: r.users })) })
  }
  if (data?.channels?.length) {
    sections.push({ sheet: 'Dispositivos', rows: data.channels.map(c => ({ capturado_em: ts, janela_min: win, dispositivo: c.channel, page_view: c.events?.page_view || 0, generate_lead: c.events?.generate_lead || 0, qualify_lead: c.events?.qualify_lead || 0, begin_checkout: c.events?.begin_checkout || 0, purchase: c.events?.purchase || 0 })) })
  }
  if (data?.timeline?.length) {
    sections.push({ sheet: 'Timeline', rows: [...data.timeline].reverse().map(p => ({ minuto: p.minute, min_atras: p.minAgo, usuarios_ativos: p.activeUsers, total: p.total })) })
  }
  return sections
}

function exportAllCSV(data, windowMin, prefix = 'farol') {
  const sections = buildExportData(data, windowMin)
  if (!sections.length) return
  // Exporta uma aba de cada vez como CSVs concatenados num único arquivo
  const win = windowMin || 30
  const slug = new Date().toISOString().slice(0, 16).replace(/[T:]/g, '-')
  const allRows = []
  for (const s of sections) {
    allRows.push([`# ${s.sheet}`])
    if (s.rows.length) {
      allRows.push(Object.keys(s.rows[0]))
      for (const r of s.rows) allRows.push(Object.values(r))
    }
    allRows.push([])
  }
  const csv = allRows.map(r => r.map(v => {
    const sv = String(v ?? '')
    return sv.includes(',') || sv.includes('"') ? `"${sv.replace(/"/g, '""')}"` : sv
  }).join(',')).join('\n')
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a'); a.href = url; a.download = `${prefix}-${win}min-${slug}.csv`; a.click()
  URL.revokeObjectURL(url)
}

// SELECT_STYLE mantido só para compatibilidade com código legado não migrado
const SELECT_STYLE = {
  background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)',
  borderRadius: 6, color: '#E8EDF2', padding: '5px 28px 5px 10px',
  fontSize: 12, cursor: 'pointer', outline: 'none', appearance: 'none',
  backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='11' height='11' viewBox='0 0 24 24' fill='none' stroke='%23C9A962' stroke-width='2'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E")`,
  backgroundRepeat: 'no-repeat', backgroundPosition: 'right 8px center',
  fontFamily: 'Manrope, sans-serif',
}

// ── Tab Nav ───────────────────────────────────────────────────────────────────
const TABS = [
  { id: 'monitor',    label: 'Monitor',     icon: Monitor  },
  { id: 'tabela',     label: 'Tabela',      icon: Table2   },
  { id: 'comparar',   label: 'Comparativo', icon: Columns2 },
  { id: 'evento',     label: 'Evento',      icon: Zap      },
]

function TabNav({ active, onChange }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 0,
      borderBottom: '1px solid rgba(255,255,255,0.08)',
      padding: '0 20px',
      background: 'rgba(8,20,32,0.6)',
      flexShrink: 0,
    }}>
      {TABS.map(t => {
        const isActive = active === t.id
        const Icon = t.icon
        return (
          <button
            key={t.id}
            onClick={() => onChange(t.id)}
            style={{
              display: 'flex', alignItems: 'center', gap: 7,
              padding: '11px 18px', fontSize: 12.5, fontWeight: isActive ? 700 : 500,
              cursor: 'pointer', border: 'none', background: 'none',
              fontFamily: 'Manrope, sans-serif',
              color: isActive ? '#C9A962' : '#6E8898',
              borderBottom: `2px solid ${isActive ? '#C9A962' : 'transparent'}`,
              marginBottom: -1, transition: 'color 0.15s, border-color 0.15s',
            }}
          >
            <Icon size={13} strokeWidth={isActive ? 2.2 : 1.8} />
            {t.label}
          </button>
        )
      })}
    </div>
  )
}

// ── Status badge ──────────────────────────────────────────────────────────────
function StatusBadge({ loading, mock, error }) {
  const isFatal = !mock && error
  const color = isFatal ? '#EF4444' : mock ? '#F59E0B' : '#22C55E'
  const icon  = isFatal ? <AlertTriangle size={12} /> : mock ? <Clock size={12} /> : <CheckCircle2 size={12} />
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: `${color}12`, border: `1px solid ${color}40`, borderRadius: 6, padding: '4px 10px' }}>
      <span style={{ color }}>{icon}</span>
      <span style={{ fontSize: 11, fontWeight: 700, color }}>GA4 Realtime</span>
      <span style={{ fontSize: 10, color: '#6B7280' }}>~1 min</span>
      {loading && <RefreshCw size={10} color="#6B7280" style={{ animation: 'spin 1s linear infinite' }} />}
    </div>
  )
}

// ── Hook: counter animado (odômetro) ─────────────────────────────────────────
function useCountUp(target, duration = 600) {
  const to      = (typeof target === 'number' && isFinite(target)) ? Math.round(target) : 0
  const [display, setDisplay] = useState(to)
  const rafRef  = useRef(null)
  const stateRef = useRef({ from: to, to })

  useEffect(() => {
    const from = stateRef.current.to  // parte do último valor exibido
    stateRef.current = { from, to }
    const start = performance.now()
    if (rafRef.current) cancelAnimationFrame(rafRef.current)

    function step(now) {
      const t    = Math.min((now - start) / duration, 1)
      const ease = 1 - Math.pow(1 - t, 3)
      setDisplay(Math.round(from + (to - from) * ease))
      if (t < 1) rafRef.current = requestAnimationFrame(step)
    }
    rafRef.current = requestAnimationFrame(step)
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current) }
  }, [to, duration])

  return display
}

// ── KPI card ──────────────────────────────────────────────────────────────────
function KpiCard({ label, value, sub, color = '#6366F1', sparkData, pulse, delta }) {
  const rawNum  = typeof value === 'string' ? parseInt(value.replace(/\D/g, ''), 10) : (value ?? 0)
  const counted = useCountUp(rawNum)
  const display = fmtNum(counted)

  const prevRef  = useRef(rawNum)
  const [flash,  setFlash]  = useState(false)
  const [glowing, setGlowing] = useState(false)

  useEffect(() => {
    if (prevRef.current !== rawNum) {
      prevRef.current = rawNum
      setFlash(true);  setTimeout(() => setFlash(false),  350)
      setGlowing(true); setTimeout(() => setGlowing(false), 800)
    }
  }, [rawNum])

  return (
    <div style={{
      background: '#152840',
      border: `1px solid ${glowing ? color + '88' : color + '33'}`,
      borderRadius: 10, padding: '14px 16px',
      position: 'relative', overflow: 'hidden',
      display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
      boxShadow: glowing ? `0 0 18px ${color}30` : 'none',
      transition: 'border-color 0.4s, box-shadow 0.4s',
    }}>
      <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 3, background: color, borderRadius: '10px 0 0 10px' }} />
      {pulse && <div style={{ position: 'absolute', top: 10, right: 10, width: 8, height: 8, borderRadius: '50%', background: '#22C55E', animation: 'liveKpiPulse 1.5s ease-out infinite' }} />}
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8 }}>
        <div style={{
          fontSize: 20, fontWeight: 800, lineHeight: 1.1,
          color: flash ? color : '#F5F4F3',
          transition: 'color 0.35s',
        }}>{display}</div>
        {delta && <div style={{ fontSize: 11, fontWeight: 700, color: delta.up ? '#22C55E' : '#EF4444', marginBottom: 2 }}>{delta.up ? '▲' : '▼'} {delta.pct}%</div>}
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
              <Area type="monotone" dataKey="v" stroke={color} strokeWidth={1.5} fill={`url(#sg4-${color.replace('#', '')})`} dot={false} isAnimationActive={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  )
}

// ── Hook de dados de painel ───────────────────────────────────────────────────
function usePanelData(propertyId, eventFilter, channelFilter, pageFilter, isRunning) {
  const [data, setData]           = useState(null)
  const [loading, setLoading]     = useState(false)
  const historyRef                = useRef([])
  const [history, setHistory]     = useState([])
  const prevCountRef              = useRef(null)
  const [countdown, setCountdown] = useState(POLL_MS / 1000)

  const fetchData = useCallback(async () => {
    if (!propertyId) return
    setLoading(true)
    const timeLabel = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    const result = await api.liveGa4(propertyId, eventFilter, channelFilter, pageFilter)
    setData(result)
    setLoading(false)
    const evRow  = (result?.topEvents || []).find(e => e.event === eventFilter)
    const count  = evRow?.count ?? 0
    const prev   = prevCountRef.current
    const delta  = prev != null ? Math.max(0, count - prev) : 0
    prevCountRef.current = count
    const point   = { time: timeLabel, delta, activeUsers: result?.activeUsers ?? 0 }
    const updated = [...historyRef.current, point].slice(-40)
    historyRef.current = updated
    setHistory(updated)
    setCountdown(POLL_MS / 1000)
  }, [propertyId, eventFilter, channelFilter, pageFilter])

  useEffect(() => {
    prevCountRef.current = null
    historyRef.current   = []
    setHistory([])
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

  const activeUsers = data?.activeUsers ?? 0
  const evCount     = (data?.topEvents || []).find(e => e.event === eventFilter)?.count ?? 0
  const prevActive  = history.length >= 2 ? history[history.length - 2]?.activeUsers : null
  const prevDelta   = history.length >= 2 ? history[history.length - 2]?.delta : null

  return {
    data, loading, history, countdown, fetchData,
    activeUsers, evCount,
    deltaActive: fmtDelta(activeUsers, prevActive),
    deltaEv:     fmtDelta(history[history.length - 1]?.delta ?? 0, prevDelta),
  }
}

// ── UTM Table (monitor) ───────────────────────────────────────────────────────
const UtmTable = memo(function UtmTable({ utmRows, utmSources, utmMediums, utmCampaigns, windowMin }) {
  const [utmSrcF, setUtmSrcF] = useState('')
  const [utmMedF, setUtmMedF] = useState('')
  const [utmCmpF, setUtmCmpF] = useState('')
  const utmTotal = utmRows.reduce((s, r) => s + r.count, 0)
  const filtered = utmRows.filter(r =>
    (!utmSrcF || r.source === utmSrcF) &&
    (!utmMedF || r.medium === utmMedF) &&
    (!utmCmpF || r.campaign === utmCmpF)
  )
  const win = windowMin || 30
  return (
    <Card>
      <CardHeader title="UTM · Origem × Evento" subtitle={`${filtered.length} linhas · últimos ${win} min${utmSrcF || utmMedF || utmCmpF ? ' · filtros ativos' : ''}`} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', padding: '7px 14px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <Filter size={10} color="#6B7280" />
        {[
          { label: 'Source',   value: utmSrcF, setter: setUtmSrcF, list: utmSources   },
          { label: 'Medium',   value: utmMedF, setter: setUtmMedF, list: utmMediums   },
          { label: 'Campaign', value: utmCmpF, setter: setUtmCmpF, list: utmCampaigns },
        ].map(f => (
          <div key={f.label} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ fontSize: 10, color: '#6B7280', fontWeight: 700 }}>{f.label}:</span>
            <SelectUI
              value={f.value}
              onChange={f.setter}
              options={f.list.map(v => ({ value: v, label: v || '(direct)' }))}
              placeholder="Todos"
              minWidth={100}
              small
            />
          </div>
        ))}
        {(utmSrcF || utmMedF || utmCmpF) && (
          <button onClick={() => { setUtmSrcF(''); setUtmMedF(''); setUtmCmpF('') }}
            style={{ padding: '2px 7px', borderRadius: 3, fontSize: 9, cursor: 'pointer', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#EF4444', fontWeight: 700 }}>
            Limpar
          </button>
        )}
      </div>
      <CardBody style={{ padding: 0 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr 70px 60px 55px 45px', gap: 6, padding: '5px 14px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          {['Evento', 'Campaign', 'Source', 'Medium', 'Disparos', '%'].map((h, i) => (
            <div key={i} style={{ fontSize: 9, color: '#6B7280', fontWeight: 700, textAlign: i >= 4 ? 'right' : 'left' }}>{h}</div>
          ))}
        </div>
        {filtered.length === 0 ? (
          <div style={{ padding: '20px', textAlign: 'center', color: '#6B7280', fontSize: 11 }}>
            {(utmSrcF || utmMedF || utmCmpF) ? 'Sem resultados para este filtro' : `Sem dados UTM nos últimos ${win} min`}
          </div>
        ) : filtered.map((r, i) => {
          const color  = evColor(r.event)
          const isConv = CONV_EVENTS.includes(r.event)
          const pct    = utmTotal > 0 ? ((r.count / utmTotal) * 100).toFixed(1) : '0.0'
          return (
            <div key={i}
              style={{
                display: 'grid', gridTemplateColumns: '120px 1fr 70px 60px 55px 45px',
                gap: 6, padding: '6px 14px', borderBottom: '1px solid rgba(255,255,255,0.03)',
                background: isConv ? `${color}08` : 'transparent',
                borderLeft: isConv ? `2px solid ${color}` : '2px solid transparent',
              }}
              onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.04)'}
              onMouseLeave={e => e.currentTarget.style.background = isConv ? `${color}08` : 'transparent'}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ width: 5, height: 5, borderRadius: '50%', background: color, flexShrink: 0, display: 'inline-block' }} />
                <span style={{ fontSize: 10, color: isConv ? color : '#C4D0DC', fontFamily: 'monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: isConv ? 700 : 400 }}>{r.event}</span>
              </div>
              <div style={{ fontSize: 10, color: r.campaign ? '#8A9BAA' : '#374151', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.campaign || '—'}</div>
              <div>{r.source ? <span style={{ fontSize: 9, color: '#F5F4F3', background: 'rgba(255,255,255,0.06)', borderRadius: 3, padding: '1px 5px', fontWeight: 600 }}>{r.source}</span> : <span style={{ fontSize: 9, color: '#374151' }}>(direct)</span>}</div>
              <div>{r.medium ? <span style={{ fontSize: 9, color: r.medium === 'cpc' ? '#F59E0B' : r.medium === 'organic' ? '#22C55E' : '#A5B4FC', background: 'rgba(255,255,255,0.05)', borderRadius: 3, padding: '1px 5px' }}>{r.medium}</span> : <span style={{ fontSize: 9, color: '#374151' }}>—</span>}</div>
              <div style={{ textAlign: 'right', fontSize: 11, color: '#F5F4F3', fontWeight: 700 }}>{fmtNum(r.count)}</div>
              <div style={{ textAlign: 'right', fontSize: 10, color: '#6B7280' }}>{pct}%</div>
            </div>
          )
        })}
      </CardBody>
    </Card>
  )
})

// ── Timeline card ─────────────────────────────────────────────────────────────
const TimelineCard = memo(function TimelineCard({ timelineData, eventFilter, channelFilter, pageFilter, capturedAt, gradId, windowMin, siteWide }) {
  const [hidden, setHidden] = useState({})
  const toggle = (k) => setHidden(prev => ({ ...prev, [k]: !prev[k] }))
  const evC = evColor(eventFilter)
  const subtitle = [
    `"${eventFilter}"`,
    channelFilter && `dispositivo: ${channelFilter}`,
    pageFilter && !siteWide && `página contém "${pageFilter}"`,
    pageFilter && siteWide  && `site inteiro (API Realtime não filtra timeline por página)`,
  ].filter(Boolean).join(' · ')

  return (
    <Card>
      <CardHeader title={`Timeline · últimos ${windowMin || 30} min`} subtitle={subtitle} action={<div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, color: '#6B7280' }}><Activity size={10} />{fmtTime(capturedAt)}</div>} />
      <CardBody>
        {timelineData.length < 2 ? (
          <div style={{ height: 130, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#6B7280', fontSize: 12 }}>Aguardando dados…</div>
        ) : (
          <>
            <div style={{ display: 'flex', gap: 10, marginBottom: 8 }}>
              {[{ key: eventFilter, color: evC }, { key: 'page_view', color: '#4B6272' }].map(s => (
                <button key={s.key} onClick={() => toggle(s.key)} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '2px 8px', borderRadius: 4, cursor: 'pointer', border: 'none', fontFamily: 'Manrope, sans-serif', background: hidden[s.key] ? 'rgba(255,255,255,0.04)' : `${s.color}18`, opacity: hidden[s.key] ? 0.4 : 1 }}>
                  <span style={{ width: 8, height: 3, background: s.color, borderRadius: 2, display: 'inline-block' }} />
                  <span style={{ fontSize: 10, color: s.color, fontFamily: 'monospace' }}>{s.key}</span>
                </button>
              ))}
            </div>
            <ResponsiveContainer width="100%" height={130}>
              <AreaChart data={timelineData} margin={{ top: 4, right: 12, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id={`evGrad-${gradId}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={evC} stopOpacity={0.35} />
                    <stop offset="100%" stopColor={evC} stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id={`pvGrad-${gradId}`} x1="0" y1="0" x2="0" y2="1">
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
                {!hidden[eventFilter] && <Area type="monotone" dataKey={eventFilter} name={eventFilter} stroke={evC} strokeWidth={2} fill={`url(#evGrad-${gradId})`} dot={false} activeDot={{ r: 4 }} isAnimationActive={false} />}
                {!hidden['page_view'] && <Area type="monotone" dataKey="page_view" name="page_view" stroke="#4B6272" strokeWidth={1} fill={`url(#pvGrad-${gradId})`} dot={false} activeDot={{ r: 3 }} strokeDasharray="4 2" isAnimationActive={false} />}
              </AreaChart>
            </ResponsiveContainer>
          </>
        )}
      </CardBody>
    </Card>
  )
})

// ── Monitor Panel ─────────────────────────────────────────────────────────────
const MonitorPanel = memo(function MonitorPanel({
  panelId, propertyId, eventFilter, channelFilter, pageFilter,
  isRunning, compareMode, channelList, topPages,
  onChannelFilter, onEventFilter, externalData, excludeTerm,
}) {
  const internal = usePanelData(externalData ? null : propertyId, eventFilter, channelFilter, pageFilter, isRunning)
  const data       = externalData?.data       ?? internal.data
  const loading    = externalData?.loading    ?? internal.loading
  const history    = externalData?.history    ?? internal.history
  const activeUsers= externalData?.activeUsers?? internal.activeUsers
  const evCount    = externalData?.evCount    ?? internal.evCount
  const deltaActive= externalData?.deltaActive?? internal.deltaActive
  const deltaEv    = externalData?.deltaEv    ?? internal.deltaEv

  // Aplica exclusão local nos dados já recebidos da API
  const excl = excludeTerm?.toLowerCase().trim() || ''
  const filteredTopEvents = excl
    ? (data?.topEvents || []).filter(e => !e.event?.toLowerCase().includes(excl))
    : (data?.topEvents || [])
  const filteredTopPages = excl
    ? (data?.topPages || []).filter(p => !p.page?.toLowerCase().includes(excl))
    : (data?.topPages || [])
  const filteredChannels = excl
    ? (data?.channels || []).filter(c => !c.channel?.toLowerCase().includes(excl))
    : (data?.channels || [])

  const filteredData = data ? {
    ...data,
    topEvents: filteredTopEvents,
    topPages:  filteredTopPages,
    channels:  filteredChannels,
  } : data

  const allUtmRows   = data?.utmRows || []
  const utmSources   = data?.utmSources?.length   ? data.utmSources   : [...new Set(allUtmRows.map(r => r.source).filter(Boolean))].sort()
  const utmMediums   = data?.utmMediums?.length   ? data.utmMediums   : [...new Set(allUtmRows.map(r => r.medium).filter(Boolean))].sort()
  const utmCampaigns = data?.utmCampaigns?.length ? data.utmCampaigns : [...new Set(allUtmRows.map(r => r.campaign).filter(Boolean))].sort()
  const timelineData = [...(data?.timeline || [])].reverse()
  const maxEventCount = Math.max(...(filteredData?.topEvents || []).map(e => e.count), 1)
  const win = data?.timelineWindowMin || 30
  const isMock = data?.mock
  const isLocal = data?.timelineSource === 'local'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {compareMode && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(99,102,241,0.08)', borderRadius: 8, padding: '8px 14px', border: '1px solid rgba(99,102,241,0.2)' }}>
          <div>
            <div style={{ fontSize: 12, fontWeight: 800, color: '#A5B4FC' }}>Painel {panelId}</div>
            {pageFilter && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 2 }}>
                <MapPin size={9} color="#6366F1" />
                <span style={{ fontSize: 10, color: '#6366F1', fontFamily: 'monospace' }}>contém "{pageFilter}"</span>
              </div>
            )}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <StatusBadge loading={loading} mock={isMock} error={data?.error} />
          </div>
        </div>
      )}

      {/* Barra de contexto — janela real + fonte da timeline */}
      {!compareMode && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, padding: '6px 2px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 10, color: '#4E6070', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em' }}>Janela:</span>
            <span style={{ fontSize: 11, color: win > 30 ? '#C9A962' : '#8A9BAA', fontWeight: 700, background: win > 30 ? 'rgba(201,169,98,0.1)' : 'rgba(255,255,255,0.05)', borderRadius: 5, padding: '2px 8px', border: `1px solid ${win > 30 ? 'rgba(201,169,98,0.3)' : 'rgba(255,255,255,0.08)'}` }}>
              {win} min
            </span>
            {isLocal && (
              <span style={{ fontSize: 9, color: '#22C55E', background: 'rgba(34,197,94,0.08)', borderRadius: 4, padding: '2px 7px', border: '1px solid rgba(34,197,94,0.2)', fontWeight: 700 }}>
                histórico local
              </span>
            )}
            {isMock && (
              <span style={{ fontSize: 9, color: '#F59E0B', background: 'rgba(245,158,11,0.08)', borderRadius: 4, padding: '2px 7px', border: '1px solid rgba(245,158,11,0.2)', fontWeight: 700 }}>
                dados simulados
              </span>
            )}
            {pageFilter && (
              <span style={{ fontSize: 9, color: '#6366F1', background: 'rgba(99,102,241,0.08)', borderRadius: 4, padding: '2px 7px', border: '1px solid rgba(99,102,241,0.2)', fontWeight: 700 }}>
                📍 {pageFilter}
              </span>
            )}
            {excl && (
              <span style={{ fontSize: 9, color: '#EF4444', background: 'rgba(239,68,68,0.08)', borderRadius: 4, padding: '2px 7px', border: '1px solid rgba(239,68,68,0.2)', fontWeight: 700 }}>
                ✕ excluindo "{excludeTerm}"
              </span>
            )}
          </div>
          <button
            onClick={() => exportAllCSV(filteredData, win, `monitor-${eventFilter}`)}
            disabled={!data || loading}
            title="Exportar todos os dados como CSV"
            style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 12px', borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: data && !loading ? 'pointer' : 'default', fontFamily: 'Manrope, sans-serif', background: 'rgba(34,197,94,0.07)', border: '1px solid rgba(34,197,94,0.25)', color: data && !loading ? '#22C55E' : '#374151', opacity: data && !loading ? 1 : 0.4, transition: 'opacity 0.2s' }}
          >
            <Download size={11} /> Exportar CSV
          </button>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${compareMode ? 3 : 4}, 1fr)`, gap: 10, alignItems: 'stretch' }}>
        <KpiCard label="Usuários ativos agora" value={activeUsers} sub={`atualizado às ${fmtTime(data?.capturedAt)}`} color="#6366F1" sparkData={history.slice(-12).map(p => ({ v: p.activeUsers }))} pulse={!isMock} delta={deltaActive} />
        <KpiCard label={`${eventFilter} · últimos ${win} min`} value={evCount} sub={`+${fmtNum(history[history.length - 1]?.delta ?? 0)} novos no último polling`} color={evColor(eventFilter)} sparkData={history.slice(-12).map(p => ({ v: p.delta }))} pulse={!isMock} delta={deltaEv} />
        <KpiCard label={`Total de eventos · ${win} min`} value={filteredData?.totalEvents ?? 0} sub={`${(filteredData?.topEvents || []).length} tipos distintos · ${(filteredData?.channels || []).length} dispositivos`} color="#A855F7" />
        {!compareMode && (
          <KpiCard
            label={channelFilter ? `Dispositivo: ${channelFilter}` : 'Dispositivo c/ + leads'}
            value={(() => { const ch = channelFilter ? (filteredData?.channels||[]).find(c=>c.channel===channelFilter) : (filteredData?.channels||[]).sort((a,b)=>(b.events?.generate_lead||0)-(a.events?.generate_lead||0))[0]; return ch?.events?.generate_lead || 0 })()}
            sub={(() => { const ch = channelFilter ? (filteredData?.channels||[]).find(c=>c.channel===channelFilter) : (filteredData?.channels||[]).sort((a,b)=>(b.events?.generate_lead||0)-(a.events?.generate_lead||0))[0]; return ch ? `leads · ${ch.channel}` : '—' })()}
            color="#F59E0B"
          />
        )}
      </div>

      <TimelineCard timelineData={timelineData} eventFilter={eventFilter} channelFilter={channelFilter} pageFilter={pageFilter} capturedAt={data?.capturedAt} gradId={panelId} windowMin={win} siteWide={!!pageFilter} />
      <UtmTable utmRows={allUtmRows} utmSources={utmSources} utmMediums={utmMediums} utmCampaigns={utmCampaigns} windowMin={win} />

      {!compareMode && (filteredData?.channels||[]).length > 0 && (
        <ChannelTable channels={filteredData.channels} channelFilter={channelFilter} onChannelFilter={onChannelFilter} windowMin={win} />
      )}
      {!compareMode && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <TopEventsCard data={filteredData} eventFilter={eventFilter} maxEventCount={maxEventCount} onEventFilter={onEventFilter} windowMin={win} />
          <TopPagesCard data={filteredData} channelFilter={channelFilter} windowMin={win} />
        </div>
      )}
    </div>
  )
})

// ── Dispositivo × Conversões ──────────────────────────────────────────────────
const DEVICE_LABEL = { desktop: 'Desktop', mobile: 'Mobile', tablet: 'Tablet', 'smart tv': 'Smart TV' }
function ChannelTable({ channels, channelFilter, onChannelFilter, windowMin }) {
  const rows = (channels||[]).map(ch => ({ channel: ch.channel, leads: ch.events?.generate_lead||0, qual: ch.events?.qualify_lead||0, mql: ch.events?.MQL||0, checkout: ch.events?.begin_checkout||0, purchase: ch.events?.purchase||0, pv: ch.events?.page_view||0 }))
  const win = windowMin || 30
  const label = (d) => DEVICE_LABEL[d?.toLowerCase()] || d
  return (
    <Card>
      <CardHeader title={`Dispositivos × Conversões · últimos ${win} min`} subtitle="Eventos de conversão por tipo de dispositivo (Realtime API)" />
      <CardBody style={{ padding: 0 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '120px 70px 70px 60px 50px 70px 60px', gap: 6, padding: '6px 16px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          {[{ l:'Dispositivo',c:'#6B7280' },{l:'Page Views',c:'#4B6272'},{l:'Lead',c:'#00BFD3'},{l:'Qualif.',c:'#34D399'},{l:'MQL',c:'#C9A962'},{l:'Checkout',c:'#F59E0B'},{l:'Purchase',c:'#22C55E'}].map((h,i)=>(
            <div key={i} style={{ fontSize: 10, color: h.c, fontWeight: 700, textAlign: i>0?'right':'left' }}>{h.l}</div>
          ))}
        </div>
        {rows.map((ch,i)=>{
          const color=chColor(ch.channel); const isActive=channelFilter===ch.channel
          return (
            <div key={i} onClick={()=>onChannelFilter(isActive?'':ch.channel)} style={{ display:'grid', gridTemplateColumns:'120px 70px 70px 60px 50px 70px 60px', gap:6, padding:'9px 16px', borderBottom:'1px solid rgba(255,255,255,0.04)', background:isActive?`${color}0D`:'transparent', borderLeft:isActive?`2px solid ${color}`:'2px solid transparent', cursor:'pointer' }}
              onMouseEnter={e=>e.currentTarget.style.background=`${color}0D`}
              onMouseLeave={e=>e.currentTarget.style.background=isActive?`${color}0D`:'transparent'}>
              <div style={{ display:'flex',alignItems:'center',gap:6 }}>
                <span style={{ width:7,height:7,borderRadius:'50%',background:color,flexShrink:0,display:'inline-block' }} />
                <span style={{ fontSize:11,color:isActive?color:'#C4D0DC',fontWeight:isActive?700:400,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap' }}>{label(ch.channel)}</span>
              </div>
              <div style={{ textAlign:'right',fontSize:11,color:'#4B6272',fontWeight:400 }}>{fmtNum(ch.pv)}</div>
              <div style={{ textAlign:'right',fontSize:11,color:ch.leads>0?'#00BFD3':'#374151',fontWeight:ch.leads>0?700:400 }}>{fmtNum(ch.leads)}</div>
              <div style={{ textAlign:'right',fontSize:11,color:ch.qual>0?'#34D399':'#374151' }}>{fmtNum(ch.qual)}</div>
              <div style={{ textAlign:'right',fontSize:11,color:ch.mql>0?'#C9A962':'#374151' }}>{fmtNum(ch.mql)}</div>
              <div style={{ textAlign:'right',fontSize:11,color:ch.checkout>0?'#F59E0B':'#374151' }}>{fmtNum(ch.checkout)}</div>
              <div style={{ textAlign:'right',fontSize:11,color:ch.purchase>0?'#22C55E':'#374151',fontWeight:ch.purchase>0?700:400 }}>{fmtNum(ch.purchase)}</div>
            </div>
          )
        })}
      </CardBody>
    </Card>
  )
}

// ── Top Eventos ───────────────────────────────────────────────────────────────
function TopEventsCard({ data, eventFilter, maxEventCount, onEventFilter, windowMin }) {
  const win = windowMin || data?.timelineWindowMin || 30
  const siteWide = data?.pageFilter && !data?.pageFilteredFields?.includes('topEvents')
  return (
    <Card>
      <CardHeader
        title={`Top eventos · últimos ${win} min`}
        subtitle={siteWide ? `site inteiro · ${fmtNum(data?.totalEvents??0)} disparos` : `${fmtNum(data?.totalEvents??0)} disparos · ${fmtNum(data?.activeUsers??0)} usuários ativos`}
      />
      <CardBody style={{ padding: 0 }}>
        {(data?.topEvents||[]).length>0 && (
          <div style={{ padding:'8px 12px 0' }}>
            <ResponsiveContainer width="100%" height={90}>
              <BarChart data={(data.topEvents||[]).slice(0,8)} margin={{ top:0,right:0,left:0,bottom:0 }}>
                <XAxis dataKey="event" tick={{ fill:'#8A9BAA',fontSize:8,fontFamily:'monospace' }} axisLine={false} tickLine={false} interval={0} angle={-15} textAnchor="end" height={28} />
                <YAxis tick={{ fill:'#8A9BAA',fontSize:8 }} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip content={({ active, payload, label })=>{
                  if(!active||!payload?.length) return null
                  return <div style={TT.contentStyle}><div style={{ fontWeight:700,fontSize:10 }}>{label}</div><div style={{ color:payload[0]?.fill,fontSize:10 }}>Disparos: {fmtNum(payload[0]?.value)}</div></div>
                }} />
                <Bar dataKey="count" radius={[3,3,0,0]} isAnimationActive={false}>
                  {(data.topEvents||[]).slice(0,8).map((ev,i)=><Cell key={i} fill={evColor(ev.event)} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
        <div style={{ display:'grid',gridTemplateColumns:'1fr 60px 60px',gap:8,padding:'6px 12px',borderBottom:'1px solid rgba(255,255,255,0.06)',marginTop:8 }}>
          {['Evento','Disparos','Usuários'].map((h,i)=>(
            <div key={i} style={{ fontSize:10,color:'#6B7280',fontWeight:700,textAlign:i>0?'right':'left' }}>{h}</div>
          ))}
        </div>
        {(data?.topEvents||[]).length===0 ? (
          <div style={{ padding:'24px 12px',textAlign:'center',color:'#6B7280',fontSize:12 }}>Sem dados</div>
        ):(data.topEvents||[]).map((ev,i)=>{
          const color=evColor(ev.event); const pct=(ev.count/maxEventCount)*100
          const isFocus=ev.event===eventFilter; const isConv=CONV_EVENTS.includes(ev.event)
          return (
            <div key={i} onClick={()=>onEventFilter(ev.event)} style={{ padding:'7px 12px',borderBottom:'1px solid rgba(255,255,255,0.04)',background:isFocus?`${color}10`:'transparent',borderLeft:isFocus?`2px solid ${color}`:'2px solid transparent',cursor:'pointer' }}>
              <div style={{ display:'grid',gridTemplateColumns:'1fr 60px 60px',gap:8,alignItems:'center',marginBottom:4 }}>
                <div style={{ display:'flex',alignItems:'center',gap:6 }}>
                  <span style={{ width:7,height:7,borderRadius:'50%',background:color,display:'inline-block',flexShrink:0 }} />
                  <span style={{ fontSize:11,color:isFocus?color:'#F5F4F3',fontFamily:'monospace',fontWeight:isFocus?700:400 }}>{ev.event}</span>
                  {isConv&&<span style={{ fontSize:9,color,background:`${color}18`,borderRadius:3,padding:'1px 4px' }}>conv</span>}
                </div>
                <div style={{ textAlign:'right',fontSize:12,color:'#F5F4F3',fontWeight:700 }}>{fmtNum(ev.count)}</div>
                <div style={{ textAlign:'right',fontSize:11,color:'#8A9BAA' }}>{fmtNum(ev.users)}</div>
              </div>
              <div style={{ height:3,background:'rgba(255,255,255,0.05)',borderRadius:2 }}>
                <div style={{ width:`${pct}%`,height:'100%',background:color,borderRadius:2,opacity:0.8 }} />
              </div>
            </div>
          )
        })}
      </CardBody>
    </Card>
  )
}

// ── Top Páginas ───────────────────────────────────────────────────────────────
function TopPagesCard({ data, channelFilter, windowMin }) {
  const MEDALS = ['#F59E0B','#9CA3AF','#B45309','#6B7280','#6B7280','#6B7280','#6B7280','#6B7280']
  const win = windowMin || data?.timelineWindowMin || 30
  return (
    <Card>
      <CardHeader title="Páginas mais acessadas agora" subtitle={`${channelFilter?`dispositivo: ${channelFilter} · `:''}últimos ${win} min`} />
      <CardBody>
        {!(data?.topPages?.length>0) ? (
          <div style={{ padding:'40px 0',textAlign:'center',color:'#6B7280',fontSize:12 }}>Sem dados de páginas</div>
        ):(
          <div style={{ display:'flex',flexDirection:'column',gap:10 }}>
            {data.topPages.map((p,i)=>{
              const pct=(p.views/(data.topPages[0]?.views||1))*100; const isFirst=i===0
              return (
                <div key={i} style={{ display:'flex',alignItems:'center',gap:10 }}>
                  <div style={{ minWidth:24,textAlign:'center',fontSize:isFirst?15:12,fontWeight:800,color:MEDALS[i] }}>{i+1}°</div>
                  <div style={{ flex:1 }}>
                    <div style={{ display:'flex',justifyContent:'space-between',marginBottom:3 }}>
                      <span style={{ fontSize:isFirst?12:11,fontWeight:isFirst?700:400,color:isFirst?'#F5F4F3':'#C4D0DC',fontFamily:'monospace',maxWidth:'55%',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap' }} title={p.page}>{p.page}</span>
                      <div style={{ display:'flex',gap:8,fontSize:11 }}>
                        <span style={{ color:isFirst?MEDALS[0]:'#8A9BAA' }}>{fmtNum(p.views)} views</span>
                        <span style={{ color:'#6366F1' }}>{fmtNum(p.users)} u</span>
                      </div>
                    </div>
                    <div style={{ height:isFirst?5:3,background:'rgba(255,255,255,0.06)',borderRadius:3 }}>
                      <div style={{ width:`${pct}%`,height:'100%',background:MEDALS[i],borderRadius:3,opacity:isFirst?1:0.7 }} />
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </CardBody>
    </Card>
  )
}

// ── Sort Icon (tabela) ────────────────────────────────────────────────────────
function SortIcon({ col, sortBy, sortDir }) {
  if (sortBy !== col) return <ChevronDown size={10} color="#374151" />
  return sortDir === 'asc' ? <ChevronUp size={10} color="#A5B4FC" /> : <ChevronDown size={10} color="#A5B4FC" />
}

// ── Aba Tabela ────────────────────────────────────────────────────────────────
const GRID = '150px minmax(160px,2fr) 80px 72px minmax(100px,1fr) 58px 64px 44px'

function TabelaView({ propertyId, isRunning, sharedData, excludeTerm }) {
  const [pageFilter,  setPageFilter]  = useState('')
  const [inputPage,   setInputPage]   = useState('')
  const [showPageSug, setShowPageSug] = useState(false)
  const [eventFilter, setEventFilter] = useState('')
  const [srcFilter,   setSrcFilter]   = useState('')
  const [medFilter,   setMedFilter]   = useState('')
  const [cmpFilter,   setCmpFilter]   = useState('')
  const [sortBy,  setSortBy]  = useState('count')
  const [sortDir, setSortDir] = useState('desc')
  const [showFullUrl, setShowFullUrl] = useState(false)

  const [data,      setData]      = useState(null)
  const [loading,   setLoading]   = useState(false)
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

  useEffect(() => { fetchData() }, [fetchData])
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

  const allRows      = data?.utmRows  || []
  const topPages     = data?.topPages || sharedData?.topPages || []
  const utmSources   = data?.utmSources?.length   ? data.utmSources   : [...new Set(allRows.map(r => r.source).filter(Boolean))].sort()
  const utmMediums   = data?.utmMediums?.length   ? data.utmMediums   : [...new Set(allRows.map(r => r.medium).filter(Boolean))].sort()
  const utmCampaigns = data?.utmCampaigns?.length ? data.utmCampaigns : [...new Set(allRows.map(r => r.campaign).filter(Boolean))].sort()
  const eventNames   = [...new Set(allRows.map(r => r.event).filter(Boolean))].sort()

  const exclTab = excludeTerm?.toLowerCase().trim() || ''
  const filtered   = allRows.filter(r => {
    if (srcFilter  && r.source   !== srcFilter)  return false
    if (medFilter  && r.medium   !== medFilter)  return false
    if (cmpFilter  && r.campaign !== cmpFilter)  return false
    if (exclTab) {
      const haystack = `${r.event||''} ${r.page||''} ${r.source||''} ${r.medium||''} ${r.campaign||''}`.toLowerCase()
      if (haystack.includes(exclTab)) return false
    }
    return true
  })
  const grandTotal = filtered.reduce((s, r) => s + r.count, 0)
  const sorted     = [...filtered].sort((a, b) => {
    const v = k => k === 'users' ? (a.users - b.users) : k === 'count' ? (a.count - b.count) : (a[k]||'').localeCompare(b[k]||'')
    const res = v(sortBy)
    return sortDir === 'asc' ? res : -res
  })

  const handleSort = col => {
    if (sortBy === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortBy(col); setSortDir('desc') }
  }

  const applyPage = () => { setPageFilter(inputPage.trim()); setShowPageSug(false) }
  const clearAll  = () => { setPageFilter(''); setInputPage(''); setEventFilter(''); setSrcFilter(''); setMedFilter(''); setCmpFilter('') }
  const hasFilters = pageFilter || eventFilter || srcFilter || medFilter || cmpFilter

  const siteHost = data?.siteUrl || data?.defaultUri || ''
  const buildUrl = path => {
    if (!path) return null
    if (path.startsWith('http')) return path
    if (siteHost) return siteHost.replace(/\/$/, '') + (path.startsWith('/') ? path : '/' + path)
    return null
  }

  const COLS = [
    { key: 'event',    label: 'Evento',   align: 'left'  },
    { key: 'page',     label: 'Página',   align: 'left'  },
    { key: 'source',   label: 'Source',   align: 'left'  },
    { key: 'medium',   label: 'Medium',   align: 'left'  },
    { key: 'campaign', label: 'Campaign', align: 'left'  },
    { key: 'users',    label: 'Usuários', align: 'right' },
    { key: 'count',    label: 'Eventos',  align: 'right' },
    { key: 'pct',      label: '%',        align: 'right', noSort: true },
  ]

  const thStyle = (col) => ({
    display: 'flex', alignItems: 'center', gap: 3,
    justifyContent: col.align === 'right' ? 'flex-end' : 'flex-start',
    fontSize: 10, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase',
    color: sortBy === col.key ? '#C9A962' : '#4E6070',
    cursor: col.noSort ? 'default' : 'pointer', userSelect: 'none',
  })

  const medColor = m => m === 'cpc' ? '#F59E0B' : m === 'organic' ? '#22C55E' : m === 'email' ? '#6366F1' : '#8AA0B4'

  return (
    <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

      {/* Barra de filtros */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', padding: '10px 20px', borderBottom: '1px solid rgba(255,255,255,0.07)', background: 'rgba(8,20,32,0.6)', flexShrink: 0 }}>

        {/* Busca de página */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, position: 'relative' }}>
          <input
            value={inputPage}
            onChange={e => { setInputPage(e.target.value); setShowPageSug(true) }}
            onKeyDown={e => { if (e.key === 'Enter') applyPage(); if (e.key === 'Escape') { setInputPage(''); setPageFilter(''); setShowPageSug(false) } }}
            onBlur={() => setTimeout(() => setShowPageSug(false), 150)}
            placeholder="Filtrar por página…"
            style={{ background: pageFilter ? 'rgba(201,169,98,0.07)' : 'rgba(255,255,255,0.05)', border: `1px solid ${pageFilter ? 'rgba(201,169,98,0.4)' : 'rgba(255,255,255,0.1)'}`, borderRadius: 7, padding: '5px 10px 5px 28px', fontSize: 11.5, color: pageFilter ? '#C9A962' : '#E8EDF2', fontFamily: 'monospace', width: 200, outline: 'none', transition: 'border-color 0.15s' }}
          />
          <Filter size={11} color={pageFilter ? '#C9A962' : '#4E6070'} style={{ position: 'absolute', left: 9, pointerEvents: 'none' }} />
          {inputPage && (
            <button onClick={() => { setInputPage(''); setPageFilter(''); setShowPageSug(false) }}
              style={{ position: 'absolute', right: 8, background: 'none', border: 'none', color: '#6B7280', cursor: 'pointer', padding: 0, display: 'flex' }}>
              <X size={10} />
            </button>
          )}
          {showPageSug && inputPage.length > 0 && topPages.filter(p => p.page?.toLowerCase().includes(inputPage.toLowerCase())).length > 0 && (
            <div style={{ position: 'absolute', top: 'calc(100% + 4px)', left: 0, zIndex: 99999, background: '#152840', border: '1px solid rgba(201,169,98,0.25)', borderRadius: 8, minWidth: 260, maxHeight: 200, overflowY: 'auto', boxShadow: '0 12px 32px rgba(0,0,0,0.6)' }}>
              {topPages.filter(p => p.page?.toLowerCase().includes(inputPage.toLowerCase())).slice(0, 8).map((p, i) => (
                <div key={i} onMouseDown={() => { setInputPage(p.page); setPageFilter(p.page); setShowPageSug(false) }}
                  style={{ padding: '7px 12px', cursor: 'pointer', borderBottom: '1px solid rgba(255,255,255,0.05)' }}
                  onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                  <div style={{ fontSize: 11, color: '#E8EDF2', fontFamily: 'monospace' }}>{p.page}</div>
                  <div style={{ fontSize: 9, color: '#4E6070', marginTop: 1 }}>{fmtNum(p.views)} views agora</div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div style={{ width: 1, height: 16, background: 'rgba(255,255,255,0.08)', flexShrink: 0 }} />

        {/* Evento */}
        <SelectUI value={eventFilter} onChange={setEventFilter}
          options={eventNames.map(e => ({ value: e, label: e }))}
          placeholder="Evento" minWidth={150} small />

        {/* Source / Medium / Campaign */}
        <SelectUI value={srcFilter} onChange={setSrcFilter}
          options={utmSources.map(v => ({ value: v, label: v || '(direct)' }))}
          placeholder="Source" minWidth={100} small />
        <SelectUI value={medFilter} onChange={setMedFilter}
          options={utmMediums.map(v => ({ value: v, label: v || '(direct)' }))}
          placeholder="Medium" minWidth={90} small />
        <SelectUI value={cmpFilter} onChange={setCmpFilter}
          options={utmCampaigns.map(v => ({ value: v, label: v }))}
          placeholder="Campaign" minWidth={110} small />

        {exclTab && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 5, padding: '3px 8px' }}>
            <X size={9} color="#EF4444" />
            <span style={{ fontSize: 10, color: '#FCA5A5', fontFamily: 'monospace' }}>excluindo "{excludeTerm}"</span>
          </div>
        )}
        {hasFilters && (
          <button onClick={clearAll} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 10px', borderRadius: 6, fontSize: 11, cursor: 'pointer', fontFamily: 'Manrope, sans-serif', background: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.25)', color: '#EF4444' }}>
            <X size={10} /> Limpar filtros
          </button>
        )}

        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 10 }}>
          <button onClick={() => setShowFullUrl(u => !u)} title={showFullUrl ? 'Mostrar path' : 'Mostrar URL completa'}
            style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 9px', borderRadius: 6, fontSize: 10, cursor: 'pointer', fontFamily: 'Manrope', fontWeight: 600, background: showFullUrl ? 'rgba(201,169,98,0.1)' : 'rgba(255,255,255,0.04)', border: `1px solid ${showFullUrl ? 'rgba(201,169,98,0.4)' : 'rgba(255,255,255,0.09)'}`, color: showFullUrl ? '#C9A962' : '#4E6070' }}>
            <ExternalLink size={10} />
            {showFullUrl ? 'URL' : 'Path'}
          </button>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: isRunning ? '#22C55E' : '#4E6070' }}>
            {loading
              ? <RefreshCw size={10} style={{ animation: 'spin 1s linear infinite' }} />
              : <Radio size={10} />}
            <span style={{ fontVariantNumeric: 'tabular-nums' }}>{isRunning ? `${countdown}s` : 'pausado'}</span>
          </div>
        </div>
      </div>

      {/* Tabela */}
      <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden', padding: '0 20px 16px' }}>
        <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', background: '#0E2030', border: '1px solid rgba(255,255,255,0.09)', borderRadius: 10, overflow: 'hidden', marginTop: 14 }}>

          {/* Header */}
          <div style={{ display: 'grid', gridTemplateColumns: GRID, gap: 0, padding: '0 16px', borderBottom: '1px solid rgba(255,255,255,0.09)', background: '#0A1825', flexShrink: 0 }}>
            {COLS.map(col => (
              <div key={col.key} onClick={() => !col.noSort && handleSort(col.key)} style={{ ...thStyle(col), padding: '9px 6px' }}>
                {col.align === 'right' && !col.noSort && <SortIcon col={col.key} sortBy={sortBy} sortDir={sortDir} />}
                {col.label}
                {col.align !== 'right' && !col.noSort && <SortIcon col={col.key} sortBy={sortBy} sortDir={sortDir} />}
              </div>
            ))}
          </div>

          {/* Rows */}
          <div style={{ flex: 1, overflowY: 'auto' }}>
            {sorted.length === 0 ? (
              <div style={{ padding: '48px 0', textAlign: 'center', color: '#4E6070', fontSize: 12 }}>
                {loading ? 'Carregando…' : hasFilters ? 'Nenhuma linha para estes filtros' : 'Sem dados nos últimos 30 min'}
              </div>
            ) : sorted.map((r, i) => {
              const color  = evColor(r.event)
              const isConv = CONV_EVENTS.includes(r.event)
              const pct    = grandTotal > 0 ? ((r.count / grandTotal) * 100).toFixed(1) : '0.0'
              const url    = buildUrl(r.page)
              return (
                <div key={i}
                  style={{ display: 'grid', gridTemplateColumns: GRID, gap: 0, padding: '0 16px', borderBottom: '1px solid rgba(255,255,255,0.04)', borderLeft: `2px solid ${isConv ? color : 'transparent'}`, alignItems: 'center', minHeight: 36 }}
                  onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.025)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>

                  {/* Evento */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, overflow: 'hidden', padding: '7px 6px 7px 0' }}>
                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: color, flexShrink: 0 }} />
                    <span style={{ fontSize: 11, color: isConv ? color : '#E8EDF2', fontFamily: 'monospace', fontWeight: isConv ? 700 : 400, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.event}</span>
                  </div>

                  {/* Página / URL */}
                  <div style={{ overflow: 'hidden', padding: '0 6px' }}>
                    {showFullUrl && url ? (
                      <a href={url} target="_blank" rel="noreferrer"
                        style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#8AA0B4', textDecoration: 'none', fontSize: 11, fontFamily: 'monospace' }}
                        title={url}>
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{url}</span>
                        <ExternalLink size={9} style={{ flexShrink: 0, opacity: 0.5 }} />
                      </a>
                    ) : (
                      <span style={{ fontSize: 11, color: '#8AA0B4', fontFamily: 'monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block' }} title={r.page}>
                        {r.page || '—'}
                      </span>
                    )}
                  </div>

                  {/* Source */}
                  <div style={{ padding: '0 6px' }}>
                    {r.source
                      ? <span style={{ fontSize: 10, color: '#C4D0DC', fontWeight: 600 }}>{r.source}</span>
                      : <span style={{ fontSize: 10, color: '#2E4050' }}>direct</span>}
                  </div>

                  {/* Medium */}
                  <div style={{ padding: '0 6px' }}>
                    {r.medium
                      ? <span style={{ fontSize: 10, color: medColor(r.medium), fontWeight: 600 }}>{r.medium}</span>
                      : <span style={{ fontSize: 10, color: '#2E4050' }}>—</span>}
                  </div>

                  {/* Campaign */}
                  <div style={{ overflow: 'hidden', padding: '0 6px' }}>
                    <span style={{ fontSize: 10, color: r.campaign ? '#8AA0B4' : '#2E4050', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block' }} title={r.campaign}>
                      {r.campaign || '—'}
                    </span>
                  </div>

                  {/* Usuários */}
                  <div style={{ textAlign: 'right', fontSize: 11, color: '#6E8898', padding: '0 6px' }}>{fmtNum(r.users)}</div>

                  {/* Eventos */}
                  <div style={{ textAlign: 'right', fontSize: 12, color: '#E8EDF2', fontWeight: 700, padding: '0 6px' }}>{fmtNum(r.count)}</div>

                  {/* % */}
                  <div style={{ textAlign: 'right', fontSize: 10, color: '#4E6070', padding: '0 0 0 6px' }}>{pct}%</div>
                </div>
              )
            })}
          </div>

          {/* Footer totais */}
          {sorted.length > 0 && (
            <div style={{ display: 'grid', gridTemplateColumns: GRID, gap: 0, padding: '7px 16px', borderTop: '1px solid rgba(255,255,255,0.09)', background: '#0A1825', flexShrink: 0 }}>
              <div style={{ fontSize: 10, color: '#4E6070', padding: '0 0 0 12px' }}>{sorted.length} linhas</div>
              <div /><div /><div /><div />
              <div style={{ textAlign: 'right', fontSize: 11, color: '#6E8898', fontWeight: 700, padding: '0 6px' }}>{fmtNum(sorted.reduce((s, r) => s + r.users, 0))}</div>
              <div style={{ textAlign: 'right', fontSize: 12, color: '#C9A962', fontWeight: 800, padding: '0 6px' }}>{fmtNum(grandTotal)}</div>
              <div style={{ textAlign: 'right', fontSize: 10, color: '#4E6070', padding: '0 0 0 6px' }}>100%</div>
            </div>
          )}
        </div>

        <div style={{ fontSize: 10, color: '#2E4050', textAlign: 'right', marginTop: 6 }}>
          Atualizado às {fmtTime(lastFetch)} · polling {POLL_MS / 1000}s
        </div>
      </div>
    </div>
  )
}

// Extrai fragmento de path de uma URL ou string livre
function extractPageFilter(raw) {
  if (!raw) return ''
  try {
    const url = new URL(raw)
    const parts = url.pathname.split('/').filter(Boolean)
    return parts[parts.length - 1] || parts[0] || url.hostname.split('.')[0]
  } catch {
    // não é URL — usa o valor direto (fragmento manual)
    return raw.trim()
  }
}

// ── Filtro compacto (modo comparativo) ────────────────────────────────────────
function FilterBarCompact({ label, eventFilter, onEventChange, eventOptions, inputPage, setInputPage, pageFilter, onApplyPage, onClearPage, topPages, showSug, setShowSug }) {
  const color = label === 'A' ? '#C9A962' : '#6366F1'
  const colorBg = label === 'A' ? 'rgba(201,169,98,0.06)' : 'rgba(99,102,241,0.06)'
  const colorBorder = label === 'A' ? 'rgba(201,169,98,0.25)' : 'rgba(99,102,241,0.25)'

  // Se o usuário colou uma URL completa, mostra preview do fragment extraído
  const previewFilter = extractPageFilter(inputPage)
  const isUrl = inputPage.startsWith('http')

  function handleApply() {
    const fragment = extractPageFilter(inputPage)
    if (fragment) {
      setInputPage(fragment)  // normaliza o campo para mostrar só o fragment
    }
    onApplyPage()
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, background: colorBg, border: `1px solid ${colorBorder}`, borderRadius: 8, padding: '10px 14px' }}>
      {/* Linha principal de filtros */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 10, fontWeight: 800, color, background: `${color}22`, borderRadius: 4, padding: '2px 8px', flexShrink: 0, letterSpacing: '0.05em' }}>{label}</span>

        <SelectUI
          value={eventFilter}
          onChange={onEventChange}
          options={eventOptions.map(e => ({ value: e, label: e }))}
          placeholder="Evento"
          minWidth={160}
          small
        />

        <div style={{ display: 'flex', alignItems: 'center', gap: 4, position: 'relative', flex: 1 }}>
          <div style={{ position: 'relative', flex: 1 }}>
            <input
              value={inputPage}
              onChange={e => { setInputPage(e.target.value); setShowSug(true) }}
              onKeyDown={e => { if (e.key === 'Enter') handleApply() }}
              onBlur={() => setTimeout(() => setShowSug(false), 150)}
              placeholder="URL ou fragmento de página…"
              style={{
                background: pageFilter ? `${color}10` : 'rgba(255,255,255,0.05)',
                border: `1px solid ${pageFilter ? `${color}55` : 'rgba(255,255,255,0.1)'}`,
                borderRadius: 6, padding: '5px 28px 5px 28px',
                fontSize: 11, color: pageFilter ? color : '#E8EDF2',
                fontFamily: 'monospace', width: '100%', outline: 'none',
                boxSizing: 'border-box',
              }}
            />
            <MapPin size={10} color={pageFilter ? color : '#4E6070'} style={{ position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
            {inputPage && (
              <button onClick={() => { setInputPage(''); onClearPage() }}
                style={{ position: 'absolute', right: 7, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#6B7280', cursor: 'pointer', padding: 0, display: 'flex' }}>
                <X size={10} />
              </button>
            )}
            {showSug && inputPage.length > 0 && topPages.filter(p => p.page?.toLowerCase().includes(inputPage.toLowerCase())).length > 0 && (
              <div style={{ position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0, zIndex: 99999, background: '#152840', border: `1px solid ${colorBorder}`, borderRadius: 8, maxHeight: 160, overflowY: 'auto', boxShadow: '0 12px 32px rgba(0,0,0,0.6)' }}>
                {topPages.filter(p => p.page?.toLowerCase().includes(inputPage.toLowerCase())).slice(0, 7).map((p, i) => (
                  <div key={i} onMouseDown={() => { setInputPage(p.page); onApplyPage() }}
                    style={{ padding: '7px 12px', cursor: 'pointer', borderBottom: '1px solid rgba(255,255,255,0.05)' }}
                    onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                    <div style={{ fontSize: 11, color: '#E8EDF2', fontFamily: 'monospace' }}>{p.page}</div>
                    <div style={{ fontSize: 9, color: '#4E6070', marginTop: 1 }}>{fmtNum(p.views)} views</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Linha de status — filtro ativo ou preview de URL */}
      {(pageFilter || (inputPage && isUrl && previewFilter !== inputPage)) && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, paddingLeft: 2 }}>
          {pageFilter ? (
            <>
              <span style={{ fontSize: 9, color: color, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em' }}>Filtro ativo:</span>
              <span style={{ fontSize: 10, color, fontFamily: 'monospace', background: `${color}12`, borderRadius: 4, padding: '1px 7px', border: `1px solid ${color}30` }}>{pageFilter}</span>
              <button onClick={onClearPage} style={{ fontSize: 9, color: '#EF4444', background: 'none', border: 'none', cursor: 'pointer', padding: '0 2px', fontFamily: 'Manrope, sans-serif' }}>✕ limpar</button>
            </>
          ) : (
            <>
              <span style={{ fontSize: 9, color: '#4E6070', fontWeight: 700 }}>Filtro extraído:</span>
              <span style={{ fontSize: 10, color: '#8A9BAA', fontFamily: 'monospace', background: 'rgba(255,255,255,0.04)', borderRadius: 4, padding: '1px 7px' }}>{previewFilter}</span>
              <span style={{ fontSize: 9, color: '#374151' }}>— pressione Enter para aplicar</span>
            </>
          )}
        </div>
      )}
    </div>
  )
}

// ── Funil animado ─────────────────────────────────────────────────────────────
function FunnelBar({ pct, color }) {
  const [width, setWidth] = useState(0)
  useEffect(() => {
    const t = setTimeout(() => setWidth(pct), 60)
    return () => clearTimeout(t)
  }, [pct])
  return (
    <div style={{ height: 8, background: 'rgba(255,255,255,0.05)', borderRadius: 6, overflow: 'hidden' }}>
      <div style={{
        width: `${width}%`,
        height: '100%',
        background: `linear-gradient(90deg, ${color}aa, ${color})`,
        borderRadius: 6,
        boxShadow: `0 0 8px ${color}50`,
        transition: 'width 0.7s cubic-bezier(0.22,1,0.36,1)',
      }} />
    </div>
  )
}

function FunnelSteps({ steps }) {
  const max = Math.max(...steps.map(s => s.value), 1)
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {steps.map((step, i) => {
        const pct = (step.value / max) * 100
        return (
          <div key={i} style={{ opacity: 0, animation: `fadeSlideIn 0.3s ease ${i * 80}ms forwards` }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 10, color: '#4E6070', fontWeight: 700, minWidth: 18 }}>{i + 1}</span>
                <span style={{ fontSize: 12, color: '#C4D0DC', fontWeight: 600 }}>{step.label}</span>
                {step.pct && (
                  <span style={{ fontSize: 10, color: step.color, background: `${step.color}15`, borderRadius: 4, padding: '1px 7px', fontWeight: 700 }}>
                    {step.pct}%
                  </span>
                )}
              </div>
              <span style={{ fontSize: 14, fontWeight: 800, color: step.color, fontVariantNumeric: 'tabular-nums' }}>
                {fmtNum(step.value)}
              </span>
            </div>
            <FunnelBar pct={pct} color={step.color} />
          </div>
        )
      })}
    </div>
  )
}

// ── Campo inline editável ─────────────────────────────────────────────────────
function InlineEdit({ value, onChange, style = {}, inputStyle = {}, placeholder = '' }) {
  const [editing, setEditing] = useState(false)
  const [draft,   setDraft]   = useState(value)
  const commit = () => { onChange(draft.trim() || value); setEditing(false) }
  useEffect(() => { setDraft(value) }, [value])
  if (editing) {
    return (
      <input
        value={draft}
        placeholder={placeholder}
        onChange={e => setDraft(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') { setDraft(value); setEditing(false) } }}
        onBlur={commit}
        autoFocus
        style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(201,169,98,0.45)', borderRadius: 5, outline: 'none', fontFamily: 'monospace', color: '#E8EDF2', padding: '2px 7px', ...inputStyle }}
      />
    )
  }
  return (
    <span onClick={() => setEditing(true)} title="Clique para editar" style={{ cursor: 'pointer', borderBottom: '1px dashed rgba(255,255,255,0.2)', ...style }}>
      {value || <span style={{ opacity: 0.35 }}>{placeholder}</span>}
    </span>
  )
}

// ── Aba Evento ────────────────────────────────────────────────────────────────
function EventoView({ propertyId, isRunning }) {
  // Configuração do evento — tudo editável inline
  const [nome,      setNome]      = useState('G4 Pass · Aniversário 2026')
  const [urlLP,     setUrlLP]     = useState('https://g4pass.com/')
  const [urlCK,     setUrlCK]     = useState('https://self-checkout.g4educacao.com/g4-pass-vitalicio-aniversario-2026')
  const [configOpen, setConfigOpen] = useState(false)

  // Extrai o fragmento de path relevante para o filtro da API (CONTAINS)
  const filterLP = urlLP  ? (() => { try { return new URL(urlLP).pathname.split('/').filter(Boolean)[0] || new URL(urlLP).hostname.split('.')[0] } catch { return urlLP } })() : ''
  const filterCK = urlCK ? (() => { try { const p = new URL(urlCK).pathname; return p.split('/').filter(Boolean).slice(-1)[0] || p } catch { return urlCK } })() : ''

  const panelLP = usePanelData(propertyId, 'generate_lead', '', filterLP, isRunning)
  const panelCK = usePanelData(propertyId, 'purchase',      '', filterCK, isRunning)

  const lpData = panelLP.data
  const ckData = panelCK.data

  const lpUsers    = panelLP.activeUsers
  const lpViews    = (lpData?.topEvents || []).find(e => e.event === 'page_view')?.count      ?? 0
  const lpLeads    = (lpData?.topEvents || []).find(e => e.event === 'generate_lead')?.count  ?? 0
  const ckCheckout = (ckData?.topEvents || []).find(e => e.event === 'begin_checkout')?.count ?? 0
  const ckPurchase = (ckData?.topEvents || []).find(e => e.event === 'purchase')?.count       ?? 0

  const convLP = lpViews    > 0 ? ((lpLeads    / lpViews)    * 100).toFixed(1) : '—'
  const convCK = ckCheckout > 0 ? ((ckPurchase / ckCheckout) * 100).toFixed(1) : '—'

  const lpTimeline = [...(lpData?.timeline || [])].reverse()
  const ckTimeline = [...(ckData?.timeline || [])].reverse()
  const loading    = panelLP.loading || panelCK.loading
  const winLP = lpData?.timelineWindowMin || 30
  const winCK = ckData?.timelineWindowMin || 30
  const win   = Math.max(winLP, winCK)

  function handleExport() {
    const ts = new Date().toLocaleString('pt-BR')
    const slug = new Date().toISOString().slice(0, 16).replace(/[T:]/g, '-')
    const rows = [
      { secao: 'FUNIL', ts, janela_min: win, metrica: 'Visitantes LP',    valor: lpViews,    conversao_pct: null },
      { secao: 'FUNIL', ts, janela_min: win, metrica: 'Leads',            valor: lpLeads,    conversao_pct: convLP !== '—' ? convLP : null },
      { secao: 'FUNIL', ts, janela_min: win, metrica: 'Checkout',         valor: ckCheckout, conversao_pct: lpLeads > 0 ? ((ckCheckout / lpLeads) * 100).toFixed(1) : null },
      { secao: 'FUNIL', ts, janela_min: win, metrica: 'Compras',          valor: ckPurchase, conversao_pct: convCK !== '—' ? convCK : null },
    ]
    const utmRows = (ckData?.utmRows || []).map(r => ({ secao: 'UTM_CHECKOUT', ts, janela_min: winCK, evento: r.event, pagina: r.page, source: r.source, medium: r.medium, campaign: r.campaign, disparos: r.count, usuarios: r.users }))
    const lpUtmRows = (lpData?.utmRows || []).map(r => ({ secao: 'UTM_LP', ts, janela_min: winLP, evento: r.event, pagina: r.page, source: r.source, medium: r.medium, campaign: r.campaign, disparos: r.count, usuarios: r.users }))

    const allRows = [...rows, ...lpUtmRows, ...utmRows]
    exportCSV(allRows, `${nome.replace(/\s+/g, '-').toLowerCase()}-${slug}.csv`)
  }

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: '14px 20px', display: 'flex', flexDirection: 'column', gap: 14 }}>

      {/* Header configurável */}
      <div style={{ background: 'linear-gradient(135deg, rgba(201,169,98,0.08) 0%, rgba(99,102,241,0.06) 100%)', border: '1px solid rgba(201,169,98,0.2)', borderRadius: 10, padding: '12px 18px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Zap size={16} color="#C9A962" />
            <InlineEdit value={nome} onChange={setNome} style={{ fontSize: 14, fontWeight: 800, color: '#C9A962' }} inputStyle={{ fontSize: 14, fontWeight: 700, width: 300 }} placeholder="Nome do evento" />
            <span style={{ fontSize: 10, color: '#4E6070', fontWeight: 600 }}>· ao vivo</span>
            {loading && <RefreshCw size={10} color="#6B7280" style={{ animation: 'spin 1s linear infinite' }} />}
            {/* Badge de janela real */}
            <span style={{ fontSize: 10, color: win > 30 ? '#C9A962' : '#4E6070', background: win > 30 ? 'rgba(201,169,98,0.1)' : 'rgba(255,255,255,0.05)', borderRadius: 5, padding: '2px 8px', border: `1px solid ${win > 30 ? 'rgba(201,169,98,0.25)' : 'rgba(255,255,255,0.08)'}`, fontWeight: 700 }}>
              {win} min
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button
              onClick={handleExport}
              disabled={loading || (!lpData && !ckData)}
              style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '4px 10px', borderRadius: 6, fontSize: 10, fontWeight: 700, cursor: 'pointer', fontFamily: 'Manrope, sans-serif', background: 'rgba(34,197,94,0.07)', border: '1px solid rgba(34,197,94,0.25)', color: '#22C55E', opacity: loading ? 0.4 : 1 }}
            >
              <Download size={10} /> Exportar CSV
            </button>
            <button
              onClick={() => setConfigOpen(o => !o)}
              style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '4px 10px', borderRadius: 6, fontSize: 10, fontWeight: 700, cursor: 'pointer', fontFamily: 'Manrope, sans-serif', background: configOpen ? 'rgba(201,169,98,0.12)' : 'rgba(255,255,255,0.04)', border: `1px solid ${configOpen ? 'rgba(201,169,98,0.4)' : 'rgba(255,255,255,0.1)'}`, color: configOpen ? '#C9A962' : '#6E8898' }}
            >
              <Filter size={10} /> Configurar URLs
            </button>
          </div>
        </div>

        {/* Painel de configuração */}
        {configOpen && (
          <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid rgba(255,255,255,0.07)', display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ fontSize: 10, color: '#4E6070', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 2 }}>Configuração do evento</div>
            {[
              { label: 'Nome',           value: nome,  onChange: setNome,  mono: false, width: 320, placeholder: 'Ex: G4 Summit 2026' },
              { label: 'URL da LP',      value: urlLP, onChange: setUrlLP, mono: true,  width: 480, placeholder: 'https://...' },
              { label: 'URL do Checkout',value: urlCK, onChange: setUrlCK, mono: true,  width: 480, placeholder: 'https://...' },
            ].map(f => (
              <div key={f.label} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 11, color: '#6E8898', fontWeight: 700, minWidth: 110 }}>{f.label}</span>
                <input
                  value={f.value}
                  onChange={e => f.onChange(e.target.value)}
                  placeholder={f.placeholder}
                  style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 6, padding: '5px 10px', fontSize: 11, color: '#E8EDF2', fontFamily: f.mono ? 'monospace' : 'Manrope, sans-serif', width: f.width, outline: 'none' }}
                />
              </div>
            ))}
            <div style={{ fontSize: 10, color: '#374151', marginTop: 2 }}>
              Filtro LP: <code style={{ color: '#6E8898' }}>{filterLP || '—'}</code>
              &nbsp;·&nbsp;
              Filtro Checkout: <code style={{ color: '#6E8898' }}>{filterCK || '—'}</code>
            </div>
          </div>
        )}
      </div>

      {/* KPIs funil */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 10, alignItems: 'stretch' }}>
        <KpiCard label="Ativos na LP agora"   value={lpUsers}    sub={`atualizado às ${fmtTime(lpData?.capturedAt)}`}     color="#6366F1" pulse={!lpData?.mock} />
        <KpiCard label="Visualizações · LP"    value={lpViews}    sub={`page_view · últimos ${winLP} min`}                  color="#4B6272" />
        <KpiCard label="Leads gerados · LP"    value={lpLeads}    sub={`conv ${convLP}% vis→lead · ${winLP} min`}           color="#00BFD3" sparkData={panelLP.history.slice(-12).map(p => ({ v: p.delta }))} pulse={!lpData?.mock} />
        <KpiCard label="Checkouts iniciados"   value={ckCheckout} sub={`begin_checkout · últimos ${winCK} min`}             color="#F59E0B" />
        <KpiCard label="Compras concluídas"    value={ckPurchase} sub={`conv ${convCK}% ck→purchase · ${winCK} min`}       color="#22C55E" sparkData={panelCK.history.slice(-12).map(p => ({ v: p.delta }))} pulse={!ckData?.mock} />
      </div>

      {/* Funil visual com barras animadas */}
      <Card>
        <CardHeader title="Funil ao vivo · LP → Checkout → Compra" subtitle={`últimos ${win} min · atualiza a cada ${POLL_MS / 1000}s`} />
        <CardBody>
          <FunnelSteps steps={[
            { label: 'Visitantes LP', value: lpViews,    color: '#6366F1', pct: null },
            { label: 'Leads',         value: lpLeads,    color: '#00BFD3', pct: lpViews    > 0 ? ((lpLeads    / lpViews)    * 100).toFixed(1) : null },
            { label: 'Checkout',      value: ckCheckout, color: '#F59E0B', pct: lpLeads    > 0 ? ((ckCheckout / lpLeads)    * 100).toFixed(1) : null },
            { label: 'Compras',       value: ckPurchase, color: '#22C55E', pct: ckCheckout > 0 ? ((ckPurchase / ckCheckout) * 100).toFixed(1) : null },
          ]} />
        </CardBody>
      </Card>

      {/* Timelines LP e Checkout */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
        <TimelineCard timelineData={lpTimeline} eventFilter="generate_lead" pageFilter={filterLP} capturedAt={lpData?.capturedAt} gradId="ev-lp" windowMin={winLP} />
        <TimelineCard timelineData={ckTimeline} eventFilter="purchase"      pageFilter={filterCK} capturedAt={ckData?.capturedAt} gradId="ev-ck" windowMin={winCK} />
      </div>

      {/* UTM LP */}
      {lpData?.utmRows?.length > 0 && (
        <UtmTable utmRows={lpData.utmRows} utmSources={lpData.utmSources || []} utmMediums={lpData.utmMediums || []} utmCampaigns={lpData.utmCampaigns || []} windowMin={winLP} />
      )}

      {/* UTM Checkout */}
      {ckData?.utmRows?.length > 0 && (
        <UtmTable utmRows={ckData.utmRows} utmSources={ckData.utmSources || []} utmMediums={ckData.utmMediums || []} utmCampaigns={ckData.utmCampaigns || []} windowMin={winCK} />
      )}
    </div>
  )
}

// ── Componente principal ──────────────────────────────────────────────────────
export default function LiveGA4() {
  const { selectedGA4 } = useTracking()
  const propertyId = selectedGA4 || '381992026'

  const [activeTab, setActiveTab] = useState('monitor')

  // Estado painel A (monitor)
  const [eventFilterA,   setEventFilterA]   = useState('generate_lead')
  const [inputEventA,    setInputEventA]    = useState('generate_lead')
  const [channelFilterA, setChannelFilterA] = useState('')
  const [pageFilterA,    setPageFilterA]    = useState('')
  const [inputPageA,     setInputPageA]     = useState('')
  const [showSugA,       setShowSugA]       = useState(false)

  // Estado painel B (comparativo)
  const [eventFilterB,   setEventFilterB]   = useState('purchase')
  const [inputEventB,    setInputEventB]    = useState('purchase')
  const [channelFilterB, setChannelFilterB] = useState('')
  const [pageFilterB,    setPageFilterB]    = useState('')
  const [inputPageB,     setInputPageB]     = useState('')
  const [showSugB,       setShowSugB]       = useState(false)

  const [isRunning, setIsRunning] = useState(true)

  // Filtro de exclusão — aplica em todas as abas localmente
  const [excludeTerm,  setExcludeTerm]  = useState('')
  const [excludeInput, setExcludeInput] = useState('')

  const panelA = usePanelData(propertyId, eventFilterA, channelFilterA, pageFilterA, isRunning)
  const { data: rawDataA, loading: loadingA, countdown } = panelA

  const [dataA, setDataA] = useState(null)
  useEffect(() => { if (rawDataA) setDataA(rawDataA) }, [rawDataA])

  const topPagesA    = dataA?.topPages    || []
  const channelListA = dataA?.channelList || []
  const liveEventOptions = dataA?.topEvents?.length
    ? dataA.topEvents.map(e => e.event)
    : EVENT_SHORTCUTS

  const applyPageA = () => { setPageFilterA(inputPageA.trim()); setShowSugA(false) }
  const applyPageB = () => { setPageFilterB(inputPageB.trim()); setShowSugB(false) }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      <style>{`
        @keyframes liveKpiPulse { 0% { box-shadow: 0 0 0 0 rgba(34,197,94,0.5); } 70% { box-shadow: 0 0 0 8px rgba(34,197,94,0); } 100% { box-shadow: 0 0 0 0 rgba(34,197,94,0); } }
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes fadeSlideIn { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>

      <Header
        title="GA4 · Ao Vivo"
        subtitle={`Property ${propertyId} · Realtime API · últimos 30 min`}
        showGA4
        action={
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <StatusBadge loading={loadingA} mock={dataA?.mock} error={dataA?.error} />
            <div style={{ fontSize: 11, color: isRunning ? '#22C55E' : '#6B7280', display: 'flex', alignItems: 'center', gap: 5 }}>
              <Radio size={11} />
              {isRunning ? `${countdown}s` : 'Pausado'}
            </div>
            <button onClick={() => setIsRunning(r => !r)} style={{ padding: '5px 12px', borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: 'Manrope, sans-serif', background: isRunning ? 'rgba(239,68,68,0.12)' : 'rgba(34,197,94,0.12)', border: `1px solid ${isRunning ? 'rgba(239,68,68,0.4)' : 'rgba(34,197,94,0.4)'}`, color: isRunning ? '#EF4444' : '#22C55E' }}>
              {isRunning ? 'Pausar' : 'Retomar'}
            </button>
          </div>
        }
      />

      {/* Tab Nav */}
      <TabNav active={activeTab} onChange={setActiveTab} />

      {/* ── Aba Monitor ── */}
      {activeTab === 'monitor' && (
        <div style={{ flex: 1, overflowY: 'auto', padding: '14px 20px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Filtros modo simples */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', background: 'rgba(99,102,241,0.05)', border: '1px solid rgba(99,102,241,0.15)', borderRadius: 8, padding: '10px 16px' }}>
            <Filter size={13} color="#A5B4FC" />

            {/* Evento */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 11, color: '#8A9BAA', fontWeight: 700 }}>Evento:</span>
              <SelectUI
                value={eventFilterA}
                onChange={ev => { setEventFilterA(ev || 'generate_lead'); setInputEventA(ev || 'generate_lead') }}
                options={EVENT_SHORTCUTS.map(e => ({ value: e, label: e }))}
                placeholder="Evento"
                minWidth={180}
              />
            </div>

            <div style={{ width: 1, height: 20, background: 'rgba(255,255,255,0.08)' }} />

            {/* Localização */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, position: 'relative' }}>
              <MapPin size={12} color="#8A9BAA" />
              <span style={{ fontSize: 11, color: '#8A9BAA', fontWeight: 700 }}>Localização:</span>
              <input value={inputPageA} onChange={e => { setInputPageA(e.target.value); setShowSugA(true) }} onKeyDown={e => { if (e.key === 'Enter') applyPageA() }} onBlur={() => setTimeout(() => setShowSugA(false), 150)} placeholder="ex: /inscricao, summit"
                style={{ background: '#152840', border: `1px solid ${pageFilterA ? 'rgba(99,102,241,0.6)' : 'rgba(99,102,241,0.3)'}`, borderRadius: 6, padding: '5px 10px', fontSize: 11, color: '#F5F4F3', fontFamily: 'monospace', width: 190, outline: 'none' }} />
              <button onClick={applyPageA} style={{ padding: '5px 10px', borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: 'Manrope, sans-serif', background: pageFilterA ? 'rgba(99,102,241,0.2)' : 'rgba(99,102,241,0.08)', border: `1px solid ${pageFilterA ? 'rgba(99,102,241,0.6)' : 'rgba(99,102,241,0.25)'}`, color: pageFilterA ? '#A5B4FC' : '#6B7280' }}>Filtrar</button>
              {pageFilterA && <button onClick={() => { setPageFilterA(''); setInputPageA('') }} style={{ padding: '4px 8px', borderRadius: 5, fontSize: 10, cursor: 'pointer', background: 'none', border: '1px solid rgba(239,68,68,0.3)', color: '#EF4444' }}>✕</button>}
              {showSugA && inputPageA.length > 0 && topPagesA.filter(p => p.page?.toLowerCase().includes(inputPageA.toLowerCase())).length > 0 && (
                <div style={{ position: 'absolute', top: '100%', left: 90, zIndex: 100, background: '#152840', border: '1px solid rgba(99,102,241,0.4)', borderRadius: 6, marginTop: 2, minWidth: 260, maxHeight: 160, overflowY: 'auto', boxShadow: '0 8px 24px rgba(0,0,0,0.5)' }}>
                  {topPagesA.filter(p => p.page?.toLowerCase().includes(inputPageA.toLowerCase())).slice(0, 8).map((p, i) => (
                    <div key={i} onMouseDown={() => { setInputPageA(p.page); setPageFilterA(p.page); setShowSugA(false) }}
                      style={{ padding: '7px 12px', cursor: 'pointer', fontSize: 11, color: '#C4D0DC', fontFamily: 'monospace', borderBottom: '1px solid rgba(255,255,255,0.04)' }}
                      onMouseEnter={e => e.currentTarget.style.background = 'rgba(99,102,241,0.12)'}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                      <div>{p.page}</div>
                      <div style={{ fontSize: 9, color: '#6B7280' }}>{fmtNum(p.views)} views agora</div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {pageFilterA && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 5, background: 'rgba(99,102,241,0.12)', border: '1px solid rgba(99,102,241,0.4)', borderRadius: 5, padding: '3px 8px' }}>
                <MapPin size={9} color="#6366F1" />
                <span style={{ fontSize: 10, color: '#A5B4FC' }}>Filtrando páginas que contêm "{pageFilterA}"</span>
              </div>
            )}

            <div style={{ width: 1, height: 20, background: 'rgba(255,255,255,0.08)' }} />

            {/* Dispositivo */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 11, color: '#8A9BAA', fontWeight: 700 }}>Dispositivo:</span>
              <SelectUI
                value={channelFilterA}
                onChange={setChannelFilterA}
                options={channelListA.map(c => ({ value: c, label: DEVICE_LABEL[c?.toLowerCase()] || c }))}
                placeholder="Todos"
                minWidth={130}
              />
              {channelFilterA && <button onClick={() => setChannelFilterA('')} style={{ padding: '4px 8px', borderRadius: 5, fontSize: 10, cursor: 'pointer', background: 'none', border: '1px solid rgba(239,68,68,0.3)', color: '#EF4444' }}>✕</button>}
            </div>

            {/* Atalhos de evento */}
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
              {EVENT_SHORTCUTS.map(ev => (
                <button key={ev} onClick={() => { setEventFilterA(ev); setInputEventA(ev) }} style={{ padding: '3px 8px', borderRadius: 4, fontSize: 10, cursor: 'pointer', fontFamily: 'monospace', background: eventFilterA === ev ? `${evColor(ev)}22` : 'rgba(255,255,255,0.04)', border: `1px solid ${eventFilterA === ev ? `${evColor(ev)}60` : 'rgba(255,255,255,0.08)'}`, color: eventFilterA === ev ? evColor(ev) : '#6B7280', fontWeight: eventFilterA === ev ? 700 : 400 }}>{ev}</button>
              ))}
            </div>

            <div style={{ width: 1, height: 20, background: 'rgba(255,255,255,0.08)' }} />

            {/* Excluir quando contiver */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <X size={11} color={excludeTerm ? '#EF4444' : '#4E6070'} />
              <span style={{ fontSize: 11, color: excludeTerm ? '#EF4444' : '#8A9BAA', fontWeight: 700 }}>Excluir:</span>
              <input
                value={excludeInput}
                onChange={e => setExcludeInput(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') setExcludeTerm(excludeInput.trim())
                  if (e.key === 'Escape') { setExcludeInput(''); setExcludeTerm('') }
                }}
                placeholder="ex: scroll, /admin"
                style={{ background: excludeTerm ? 'rgba(239,68,68,0.07)' : 'rgba(255,255,255,0.05)', border: `1px solid ${excludeTerm ? 'rgba(239,68,68,0.4)' : 'rgba(239,68,68,0.2)'}`, borderRadius: 6, padding: '5px 10px', fontSize: 11, color: excludeTerm ? '#FCA5A5' : '#E8EDF2', fontFamily: 'monospace', width: 160, outline: 'none' }}
              />
              {excludeInput !== excludeTerm && (
                <button onClick={() => setExcludeTerm(excludeInput.trim())} style={{ padding: '5px 9px', borderRadius: 6, fontSize: 10, fontWeight: 700, cursor: 'pointer', fontFamily: 'Manrope, sans-serif', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.35)', color: '#EF4444' }}>Aplicar</button>
              )}
              {excludeTerm && (
                <button onClick={() => { setExcludeInput(''); setExcludeTerm('') }} style={{ padding: '4px 8px', borderRadius: 5, fontSize: 10, cursor: 'pointer', background: 'none', border: '1px solid rgba(239,68,68,0.3)', color: '#EF4444' }}>✕</button>
              )}
            </div>
          </div>

          <MonitorPanel panelId="A" propertyId={propertyId} eventFilter={eventFilterA} channelFilter={channelFilterA} pageFilter={pageFilterA} isRunning={isRunning} compareMode={false} channelList={channelListA} topPages={topPagesA} onChannelFilter={setChannelFilterA} onEventFilter={(ev) => { setEventFilterA(ev); setInputEventA(ev) }} externalData={panelA} excludeTerm={excludeTerm} />
        </div>
      )}

      {/* ── Aba Tabela ── */}
      {activeTab === 'tabela' && (
        <TabelaView propertyId={propertyId} isRunning={isRunning} sharedData={dataA} excludeTerm={excludeTerm} />
      )}

      {/* ── Aba Evento ── */}
      {activeTab === 'evento' && (
        <EventoView propertyId={propertyId} isRunning={isRunning} />
      )}

      {/* ── Aba Comparativo ── */}
      {activeTab === 'comparar' && (
        <div style={{ flex: 1, overflowY: 'auto', padding: '14px 20px', display: 'flex', flexDirection: 'column', gap: 14 }}>

          {/* Filtros lado a lado com botão Comparar no centro */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: 10, alignItems: 'start' }}>
            <FilterBarCompact
              label="A"
              eventFilter={eventFilterA} onEventChange={ev => { setEventFilterA(ev); setInputEventA(ev) }}
              eventOptions={liveEventOptions}
              inputPage={inputPageA} setInputPage={setInputPageA}
              pageFilter={pageFilterA}
              onApplyPage={() => { const f = extractPageFilter(inputPageA); setInputPageA(f || inputPageA); setPageFilterA(f || inputPageA.trim()); setShowSugA(false) }}
              onClearPage={() => { setPageFilterA(''); setInputPageA('') }}
              topPages={topPagesA} showSug={showSugA} setShowSug={setShowSugA}
            />

            {/* Botão Comparar */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', paddingTop: 10, gap: 6 }}>
              <button
                onClick={() => {
                  const fA = extractPageFilter(inputPageA); if (fA) { setInputPageA(fA); setPageFilterA(fA) }
                  const fB = extractPageFilter(inputPageB); if (fB) { setInputPageB(fB); setPageFilterB(fB) }
                }}
                style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, padding: '8px 14px', borderRadius: 8, fontSize: 11, fontWeight: 800, cursor: 'pointer', fontFamily: 'Manrope, sans-serif', background: 'rgba(99,102,241,0.12)', border: '1px solid rgba(99,102,241,0.4)', color: '#A5B4FC', whiteSpace: 'nowrap', transition: 'background 0.15s' }}
                onMouseEnter={e => e.currentTarget.style.background = 'rgba(99,102,241,0.22)'}
                onMouseLeave={e => e.currentTarget.style.background = 'rgba(99,102,241,0.12)'}
              >
                <Columns2 size={13} />
                Comparar
              </button>
              <span style={{ fontSize: 9, color: '#374151', textAlign: 'center' }}>A vs B</span>
            </div>

            <FilterBarCompact
              label="B"
              eventFilter={eventFilterB} onEventChange={ev => { setEventFilterB(ev); setInputEventB(ev) }}
              eventOptions={liveEventOptions}
              inputPage={inputPageB} setInputPage={setInputPageB}
              pageFilter={pageFilterB}
              onApplyPage={() => { const f = extractPageFilter(inputPageB); setInputPageB(f || inputPageB); setPageFilterB(f || inputPageB.trim()); setShowSugB(false) }}
              onClearPage={() => { setPageFilterB(''); setInputPageB('') }}
              topPages={topPagesA} showSug={showSugB} setShowSug={setShowSugB}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <MonitorPanel panelId="A" propertyId={propertyId} eventFilter={eventFilterA} channelFilter={channelFilterA} pageFilter={pageFilterA} isRunning={isRunning} compareMode={true} channelList={channelListA} topPages={topPagesA} onChannelFilter={setChannelFilterA} onEventFilter={(ev) => { setEventFilterA(ev); setInputEventA(ev) }} externalData={panelA} />
            <MonitorPanel panelId="B" propertyId={propertyId} eventFilter={eventFilterB} channelFilter={channelFilterB} pageFilter={pageFilterB} isRunning={isRunning} compareMode={true} channelList={channelListA} topPages={topPagesA} onChannelFilter={setChannelFilterB} onEventFilter={(ev) => { setEventFilterB(ev); setInputEventB(ev) }} />
          </div>
        </div>
      )}
    </div>
  )
}
