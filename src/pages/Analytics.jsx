import { useState, useEffect } from 'react'
import Header from '../components/layout/Header'
import Card, { CardHeader, CardBody } from '../components/ui/Card'
import Spinner from '../components/ui/Spinner'
import PeriodSelect from '../components/ui/PeriodSelect'
import { useTracking } from '../context/TrackingContext'
import { api } from '../services/api'
import { downloadCsv } from '../utils/export'
import { fmtNum, fmtMoney, fmtPct } from '../utils/format'
import {
  AreaChart, Area, LineChart, Line, BarChart, Bar, ComposedChart,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, ReferenceLine,
} from 'recharts'
import { TrendingUp, ArrowRightLeft, BarChart2, LineChart as LineChartIcon, Download } from 'lucide-react'
import DarkTooltip, { TT } from '../components/ui/DarkTooltip'

// ─── Paleta ──────────────────────────────────────────────────────────────────
const C = {
  mql:     '#6366F1',
  ganho:   '#22C55E',
  perdido: '#EF4444',
  proj:    '#F59E0B',
  pago:    '#3B82F6',
  org:     '#22C55E',
  direto:  '#8A9BAA',
  meta:    '#1877F2',
  google:  '#EA4335',
}

function shortDate(str) {
  if (!str) return ''
  const [, m, d] = str.split('-')
  return `${d}/${m}`
}

function MockBadge() {
  return (
    <div style={{
      display: 'inline-block', fontSize: 10, fontWeight: 600,
      background: 'rgba(245,158,11,0.12)', color: '#F59E0B',
      border: '1px solid rgba(245,158,11,0.3)',
      borderRadius: 5, padding: '2px 8px', marginBottom: 12,
    }}>
      dados simulados — conecte o Databricks nas configurações
    </div>
  )
}

// ─── Sistema de abas ──────────────────────────────────────────────────────────
const TABS = [
  { id: 'trend',   label: 'Tendência',  icon: LineChartIcon },
  { id: 'journey', label: 'Jornada',    icon: ArrowRightLeft },
  { id: 'media',   label: 'Mídia Paga', icon: BarChart2 },
]

function TabBar({ active, onChange }) {
  return (
    <div style={{ display: 'flex', gap: 4, padding: '0 clamp(12px, 2vw, 24px)', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
      {TABS.map(({ id, label, icon: Icon }) => {
        const isActive = active === id
        return (
          <button
            key={id}
            onClick={() => onChange(id)}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '10px 16px', background: 'none', border: 'none',
              borderBottom: isActive ? '2px solid #B9915B' : '2px solid transparent',
              color: isActive ? '#B9915B' : '#6B7280',
              fontSize: 13, fontWeight: isActive ? 600 : 500,
              cursor: 'pointer',
              transition: 'color 0.15s, border-color 0.15s',
              marginBottom: -1,
            }}
          >
            <Icon size={14} />
            {label}
          </button>
        )
      })}
    </div>
  )
}

// ─── Componente principal ─────────────────────────────────────────────────────
export default function Analytics() {
  const { selectedDays, setSelectedDays } = useTracking()
  const [tab, setTab]             = useState('trend')
  const [days, setDays]           = useState(selectedDays >= 30 ? selectedDays : 30)
  function changeDays(d) { setDays(d); setSelectedDays(d) }
  const [trendData, setTrendData] = useState(null)
  const [journeyData, setJourneyData] = useState(null)
  const [mediaData, setMediaData] = useState(null)
  const [loading, setLoading]     = useState(true)
  const [fromCache, setFromCache] = useState(false)

  const CACHE_TTL = 10
  function readLocalCache(key) {
    try {
      const raw = localStorage.getItem('farol_cache_' + key)
      if (!raw) return null
      const { data, ts, ttl } = JSON.parse(raw)
      if ((Date.now() - ts) / 60_000 > ttl) return null
      return data
    } catch { return null }
  }
  function writeLocalCache(key, data) {
    try { localStorage.setItem('farol_cache_' + key, JSON.stringify({ data, ts: Date.now(), ttl: CACHE_TTL })) } catch { /* ok */ }
  }

  const trendOptions = [
    { label: '30d', days: 30 },
    { label: '60d', days: 60 },
    { label: '90d', days: 90 },
  ]

  function handleExport() {
    const date = new Date().toLocaleDateString('pt-BR').replace(/\//g, '-')
    const trendRows = (trendData?.trend || []).map(r => ({ dia: r.dia, mqls: r.mqls, ganhos: r.ganhos, perdidos: r.perdidos, receita: r.receita }))
    const mediaRows = (mediaData?.media || []).map(m => ({ plataforma: m.plataforma, mqls: m.mqls, ganhos: m.ganhos, gasto: m.gasto, cpl: m.cpl, roi: m.roi }))
    const journeyRows = (journeyData?.journeys || journeyData?.rows || []).map(j => ({ canal_entrada: j.canal_entrada, canal_fechamento: j.canal_fechamento, fonte: j.fonte_entrada || j.fonte, total: j.total || j.count, conv_pct: j.conv_pct }))
    if (trendRows.length)   downloadCsv(`analytics-tendencia-${days}d-${date}.csv`, trendRows)
    if (mediaRows.length)   downloadCsv(`analytics-midia-${days}d-${date}.csv`, mediaRows)
    if (journeyRows.length) downloadCsv(`analytics-jornada-${days}d-${date}.csv`, journeyRows)
  }

  useEffect(() => {
    const cacheKey = `analytics-${days}`
    const cached = readLocalCache(cacheKey)
    if (cached) {
      setTrendData(cached.trend); setJourneyData(cached.journey); setMediaData(cached.media)
      setFromCache(true); setLoading(false)
      return
    }
    setFromCache(false)
    setLoading(true)
    Promise.all([
      api.analyticsGetTrend(days),
      api.analyticsGetJourney(days),
      api.analyticsGetMedia(days),
    ]).then(([trend, journey, media]) => {
      setTrendData(trend); setJourneyData(journey); setMediaData(media)
      setLoading(false)
      writeLocalCache(cacheKey, { trend, journey, media })
    })
  }, [days])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      <Header
        title="Analytics"
        subtitle="Padrões, tendências e performance de mídia"
        icon={<TrendingUp size={18} />}
        action={
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <PeriodSelect value={days} onChange={changeDays} options={trendOptions} />
            {!loading && fromCache && (
              <span title="Dados em cache — troque o período ou aguarde 10min para refresh" style={{
                fontSize: 10, color: '#B9915B', background: 'rgba(185,145,91,0.1)',
                border: '1px solid rgba(185,145,91,0.25)', borderRadius: 5, padding: '2px 8px', fontWeight: 700,
              }}>CACHE</span>
            )}
            {!loading && (
              <button
                onClick={handleExport}
                title="Exportar CSVs (tendência, mídia, jornada)"
                style={{
                  display: 'flex', alignItems: 'center', gap: 5,
                  padding: '4px 10px', borderRadius: 6, cursor: 'pointer',
                  border: '1px solid rgba(34,197,94,0.3)',
                  background: 'rgba(34,197,94,0.07)', color: '#22C55E',
                  fontSize: 11, fontWeight: 700, fontFamily: 'Manrope, sans-serif',
                }}
              >
                <Download size={11} /> CSV
              </button>
            )}
          </div>
        }
      />

      <TabBar active={tab} onChange={setTab} />

      <div style={{ flex: 1, overflowY: 'auto', padding: 'clamp(12px, 2vw, 24px)' }}>
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 80 }}>
            <Spinner />
          </div>
        ) : (
          <>
            {tab === 'trend'   && <TabTrend   data={trendData} />}
            {tab === 'journey' && <TabJourney data={journeyData} />}
            {tab === 'media'   && <TabMedia   data={mediaData} />}
          </>
        )}
      </div>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
// ABA 1 — TENDÊNCIA
// ══════════════════════════════════════════════════════════════════════════════
function TabTrend({ data }) {
  if (!data) return null

  const trendChart = (() => {
    const hist = (data.trend || []).map(r => ({
      dia: shortDate(r.dia), mqls: r.mqls, ganhos: r.ganhos, perdidos: r.perdidos,
    }))
    const proj = (data.projection || []).map(r => ({
      dia: shortDate(r.dia), mqls_proj: r.mqls_proj,
    }))
    if (hist.length && proj.length) proj[0] = { ...proj[0], mqls: hist[hist.length - 1].mqls }
    return [...hist, ...proj]
  })()

  const projStart = data.projection?.[0]?.dia ? shortDate(data.projection[0].dia) : null
  const totalMqls   = data.trend?.reduce((s, r) => s + r.mqls,   0) || 0
  const totalGanhos = data.trend?.reduce((s, r) => s + r.ganhos, 0) || 0
  const mediaDaily  = data.trend?.length ? Math.round(totalMqls / data.trend.length) : 0
  const projTotal   = data.projection?.reduce((s, r) => s + r.mqls_proj, 0) || 0

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {data.mock && <MockBadge />}

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 12 }}>
        {[
          { label: 'MQLs no período',      value: fmtNum(totalMqls),   color: C.mql   },
          { label: 'Ganhos no período',     value: fmtNum(totalGanhos), color: C.ganho },
          { label: 'Média diária MQL',      value: fmtNum(mediaDaily),  color: '#8A9BAA' },
          { label: 'MQLs proj. (14d)',      value: fmtNum(projTotal),   color: C.proj  },
        ].map(k => (
          <div key={k.label} style={{
            background: 'rgba(255,255,255,0.03)', border: `1px solid ${k.color}22`, borderRadius: 8, padding: '14px 16px',
          }}>
            <div style={{ fontSize: 11, color: '#6B7280', marginBottom: 4 }}>{k.label}</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: k.color }}>{k.value}</div>
          </div>
        ))}
      </div>

      {/* Gráfico */}
      <Card>
        <CardHeader title="MQLs histórico + projeção" subtitle="Linha pontilhada = projeção linear para os próximos 14 dias" />
        <CardBody>
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={trendChart} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="gradMql"   x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor={C.mql}   stopOpacity={0.22} />
                  <stop offset="95%" stopColor={C.mql}   stopOpacity={0}    />
                </linearGradient>
                <linearGradient id="gradGanho" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor={C.ganho} stopOpacity={0.18} />
                  <stop offset="95%" stopColor={C.ganho} stopOpacity={0}    />
                </linearGradient>
                <linearGradient id="gradProj"  x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor={C.proj}  stopOpacity={0.15} />
                  <stop offset="95%" stopColor={C.proj}  stopOpacity={0}    />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
              <XAxis dataKey="dia" tick={{ fill: '#6B7280', fontSize: 10 }} axisLine={false} tickLine={false} interval={Math.floor(trendChart.length / 10)} />
              <YAxis tick={{ fill: '#6B7280', fontSize: 10 }} axisLine={false} tickLine={false} width={36} />
              <Tooltip content={<DarkTooltip />} cursor={{ stroke: 'rgba(185,145,91,0.25)', strokeWidth: 1 }} />
              <Legend wrapperStyle={{ fontSize: 11, color: '#8A9BAA', paddingTop: 8 }} iconType="circle" iconSize={8} />
              {projStart && (
                <ReferenceLine x={projStart} stroke="rgba(245,158,11,0.4)" strokeDasharray="4 4"
                  label={{ value: 'Hoje', fill: '#F59E0B', fontSize: 10, position: 'top' }} />
              )}
              <Area type="monotone" dataKey="mqls"      name="MQLs"    stroke={C.mql}   fill="url(#gradMql)"   strokeWidth={2}   dot={false} connectNulls />
              <Area type="monotone" dataKey="ganhos"    name="Ganhos"  stroke={C.ganho} fill="url(#gradGanho)" strokeWidth={1.5} dot={false} connectNulls />
              <Area type="monotone" dataKey="mqls_proj" name="Projeção" stroke={C.proj}  fill="url(#gradProj)"  strokeWidth={2} strokeDasharray="6 3" dot={false} connectNulls />
            </AreaChart>
          </ResponsiveContainer>
        </CardBody>
      </Card>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
// ABA 2 — JORNADA
// ══════════════════════════════════════════════════════════════════════════════
function TabJourney({ data }) {
  if (!data) return null

  const journeyBars = (() => {
    const map = {}
    ;(data.journeys || []).forEach(j => {
      const key = j.canal_entrada
      if (!map[key]) map[key] = { canal: key, leads: 0, convertidos: 0 }
      map[key].leads       += j.total_leads
      map[key].convertidos += j.convertidos
    })
    return Object.values(map).map(r => ({
      ...r,
      conv_pct: r.leads > 0 ? parseFloat(((r.convertidos / r.leads) * 100).toFixed(1)) : 0,
    })).sort((a, b) => b.leads - a.leads)
  })()

  const totals = data.totals || {}
  const totalConv = Object.values(totals).reduce((s, v) => s + v, 0) || 1

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {data.mock && <MockBadge />}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: 20 }}>
        {/* Barras por canal */}
        <Card>
          <CardHeader title="Volume por canal de entrada" subtitle="Leads captados e convertidos por origem" />
          <CardBody>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={journeyBars} layout="vertical" margin={{ left: 8, right: 16 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" horizontal={false} />
                <XAxis type="number" tick={{ fill: '#6B7280', fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis type="category" dataKey="canal" tick={{ fill: '#9CA3AF', fontSize: 11 }} axisLine={false} tickLine={false} width={70} />
                <Tooltip content={<DarkTooltip />} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
                <Bar dataKey="leads"       name="Leads"       fill={C.mql}   radius={[0, 4, 4, 0]} opacity={0.8} />
                <Bar dataKey="convertidos" name="Convertidos" fill={C.ganho} radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
            <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 6 }}>
              {journeyBars.map(row => (
                <div key={row.canal} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ width: 70, fontSize: 11, color: '#9CA3AF', flexShrink: 0 }}>{row.canal}</span>
                  <div style={{ flex: 1, height: 6, background: 'rgba(255,255,255,0.06)', borderRadius: 3, overflow: 'hidden' }}>
                    <div style={{
                      height: '100%', borderRadius: 3,
                      width: `${Math.min(row.conv_pct * 5, 100)}%`,
                      background: row.conv_pct > 10 ? C.ganho : row.conv_pct > 5 ? C.proj : C.perdido,
                      transition: 'width 0.6s ease',
                    }} />
                  </div>
                  <span style={{ fontSize: 11, fontWeight: 700, color: '#F5F4F3', minWidth: 36, textAlign: 'right' }}>{fmtPct(row.conv_pct)}</span>
                </div>
              ))}
            </div>
          </CardBody>
        </Card>

        {/* Fluxo entrada → fechamento */}
        <Card>
          <CardHeader title="Fluxo entrada → fechamento" subtitle="Como cada lead entrou e como finalizou a jornada" />
          <CardBody>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {Object.entries(totals).sort(([, a], [, b]) => b - a).map(([key, val]) => {
                const pct = Math.round((val / totalConv) * 100)
                const [entrada, fechamento] = key.split('→')
                const isSame = entrada === fechamento
                return (
                  <div key={key} style={{
                    background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)',
                    borderRadius: 8, padding: '10px 14px',
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <JourneyTag label={entrada} />
                        <span style={{ color: '#4B5563', fontSize: 12 }}>→</span>
                        <JourneyTag label={fechamento} />
                        {isSame && entrada !== 'Direto' && (
                          <span style={{ fontSize: 10, color: '#22C55E', background: 'rgba(34,197,94,0.1)', borderRadius: 4, padding: '1px 6px' }}>consistente</span>
                        )}
                      </div>
                      <span style={{ fontSize: 13, fontWeight: 700, color: '#F5F4F3' }}>{fmtNum(val)}</span>
                    </div>
                    <div style={{ height: 4, background: 'rgba(255,255,255,0.06)', borderRadius: 2 }}>
                      <div style={{
                        height: '100%', borderRadius: 2, width: `${pct}%`,
                        background: entrada === 'Pago' ? C.pago : entrada === 'Orgânico' ? C.org : C.direto,
                        transition: 'width 0.6s ease',
                      }} />
                    </div>
                    <div style={{ fontSize: 10, color: '#6B7280', marginTop: 4 }}>{pct}% das conversões</div>
                  </div>
                )
              })}
            </div>
            <InsightBox journeys={data.journeys || []} totals={totals} />
          </CardBody>
        </Card>
      </div>

      {/* Tabela detalhada */}
      <Card>
        <CardHeader title="Detalhamento por origem" subtitle="Todas as combinações de jornada com taxa de conversão" />
        <CardBody>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                  {['Canal entrada', 'Fechamento', 'Fonte', 'Leads', 'Convertidos', 'Conv %'].map(h => (
                    <th key={h} style={{ padding: '8px 12px', textAlign: 'left', color: '#6B7280', fontWeight: 600, fontSize: 11, letterSpacing: '0.04em' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(data.journeys || []).map((row, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)', background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.01)' }}>
                    <td style={{ padding: '8px 12px' }}><JourneyTag label={row.canal_entrada} /></td>
                    <td style={{ padding: '8px 12px' }}><JourneyTag label={row.canal_fechamento} /></td>
                    <td style={{ padding: '8px 12px', color: '#9CA3AF' }}>{row.fonte_entrada}</td>
                    <td style={{ padding: '8px 12px', color: '#F5F4F3', fontWeight: 600 }}>{fmtNum(row.total_leads)}</td>
                    <td style={{ padding: '8px 12px', color: C.ganho, fontWeight: 600 }}>{fmtNum(row.convertidos)}</td>
                    <td style={{ padding: '8px 12px' }}><ConvBadge value={row.conv_pct} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardBody>
      </Card>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
// ABA 3 — MÍDIA PAGA
// ══════════════════════════════════════════════════════════════════════════════
function TabMedia({ data }) {
  if (!data) return null

  // Série semanal: agrupa por semana somando plataformas para o gráfico principal
  const weeklyAgg = {}
  ;(data.weekly || []).forEach(r => {
    const k = r.semana
    if (!weeklyAgg[k]) weeklyAgg[k] = { semana: shortDate(k), gasto: 0, receita: 0 }
    weeklyAgg[k].gasto   += r.gasto
    weeklyAgg[k].receita += r.receita
  })
  const weekSeries = Object.values(weeklyAgg)

  // Projeção conectada ao histórico
  const projSeries = (data.projection || []).map(r => ({
    semana: shortDate(r.semana),
    receita_proj: r.receita_proj,
  }))
  if (weekSeries.length && projSeries.length) {
    projSeries[0] = { ...projSeries[0], receita: weekSeries[weekSeries.length - 1].receita }
  }
  const fullWeekly = [...weekSeries, ...projSeries]
  const projWeekStart = data.projection?.[0]?.semana ? shortDate(data.projection[0].semana) : null

  // Orgânico vs Pago — derivado dos totais
  const metaTotals   = (data.totals || []).find(t => t.plataforma === 'Meta')   || {}
  const googleTotals = (data.totals || []).find(t => t.plataforma === 'Google') || {}

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {data.mock && <MockBadge />}

      {/* ── KPIs plataforma ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12 }}>
        {(data.totals || []).map(t => (
          <PlatformCard key={t.plataforma} data={t} />
        ))}
      </div>

      {/* ── Gráfico receita semanal + projeção ── */}
      <Card>
        <CardHeader
          title="Receita atribuída — semanal + projeção"
          subtitle="Receita dos deals com origem em mídia paga. Linha pontilhada = projeção 4 semanas"
        />
        <CardBody>
          <ResponsiveContainer width="100%" height={240}>
            <ComposedChart data={fullWeekly} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="gradReceita" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor={C.ganho} stopOpacity={0.2} />
                  <stop offset="95%" stopColor={C.ganho} stopOpacity={0}   />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
              <XAxis dataKey="semana" tick={{ fill: '#6B7280', fontSize: 10 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: '#6B7280', fontSize: 10 }} axisLine={false} tickLine={false} width={52}
                tickFormatter={v => v >= 1_000_000 ? `${(v/1_000_000).toFixed(1)}M` : v >= 1000 ? `${(v/1000).toFixed(0)}K` : v} />
              <Tooltip content={<DarkTooltip money />} cursor={{ stroke: 'rgba(185,145,91,0.25)', strokeWidth: 1 }} />
              <Legend wrapperStyle={{ fontSize: 11, color: '#8A9BAA', paddingTop: 8 }} iconType="circle" iconSize={8} />
              {projWeekStart && (
                <ReferenceLine x={projWeekStart} stroke="rgba(245,158,11,0.4)" strokeDasharray="4 4"
                  label={{ value: 'Hoje', fill: '#F59E0B', fontSize: 10, position: 'top' }} />
              )}
              <Bar dataKey="gasto"    name="Investimento" fill={C.pago}  opacity={0.6} radius={[3, 3, 0, 0]} />
              <Area type="monotone" dataKey="receita"      name="Receita"    stroke={C.ganho} fill="url(#gradReceita)" strokeWidth={2} dot={false} connectNulls />
              <Line type="monotone" dataKey="receita_proj" name="Proj. Receita" stroke={C.proj} strokeWidth={2} strokeDasharray="6 3" dot={false} connectNulls />
            </ComposedChart>
          </ResponsiveContainer>
        </CardBody>
      </Card>

      {/* ── Orgânico vs Pago: comparação de receita ── */}
      <Card>
        <CardHeader title="Orgânico vs Pago — receita atribuída" subtitle="Comparação de receita gerada por canal. Orgânico sem custo de mídia = ROI superior." />
        <CardBody>
          <OrganicVsPaidComparison metaTotals={metaTotals} googleTotals={googleTotals} />
        </CardBody>
      </Card>

      {/* ── Top campanhas ── */}
      <Card>
        <CardHeader title="Top campanhas por receita" subtitle="Campanhas pagas com maior receita atribuída no período" />
        <CardBody>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                  {['Campanha', 'Plataforma', 'MQLs', 'Ganhos', 'Receita', 'Conv %'].map(h => (
                    <th key={h} style={{ padding: '8px 12px', textAlign: 'left', color: '#6B7280', fontWeight: 600, fontSize: 11, letterSpacing: '0.04em' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(data.campaigns || []).map((row, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)', background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.01)' }}>
                    <td style={{ padding: '8px 12px', color: '#F5F4F3', maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{row.campanha}</td>
                    <td style={{ padding: '8px 12px' }}>
                      <span style={{
                        fontSize: 11, fontWeight: 600, borderRadius: 5, padding: '2px 8px',
                        background: row.plataforma === 'facebook' || row.plataforma === 'instagram' ? 'rgba(24,119,242,0.15)' : 'rgba(234,67,53,0.15)',
                        color:      row.plataforma === 'facebook' || row.plataforma === 'instagram' ? C.meta : C.google,
                      }}>
                        {row.plataforma === 'facebook' || row.plataforma === 'instagram' ? 'Meta' : 'Google'}
                      </span>
                    </td>
                    <td style={{ padding: '8px 12px', color: '#9CA3AF' }}>{fmtNum(row.mqls)}</td>
                    <td style={{ padding: '8px 12px', color: C.ganho, fontWeight: 600 }}>{fmtNum(row.ganhos)}</td>
                    <td style={{ padding: '8px 12px', color: '#F5F4F3', fontWeight: 600 }}>{fmtMoney(row.receita)}</td>
                    <td style={{ padding: '8px 12px' }}><ConvBadge value={row.conv_pct} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardBody>
      </Card>
    </div>
  )
}

// ── Card por plataforma com ROAS e ROI ────────────────────────────────────────
function PlatformCard({ data }) {
  const roiPct   = data.roi_pct ?? null
  const roas     = data.roas     ?? null
  const hasRoi   = roiPct !== null && roiPct !== 0
  const isPositive = (roiPct ?? 0) >= 0
  const color = data.plataforma === 'Meta' ? C.meta : C.google
  return (
    <div style={{
      background: 'rgba(255,255,255,0.03)', border: `1px solid ${color}22`,
      borderRadius: 10, padding: '16px 18px',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <span style={{ fontSize: 13, fontWeight: 700, color }}>{data.plataforma}</span>
        {hasRoi && (
          <span style={{
            fontSize: 10, fontWeight: 700, borderRadius: 5, padding: '2px 7px',
            background: isPositive ? 'rgba(34,197,94,0.12)' : 'rgba(239,68,68,0.12)',
            color: isPositive ? '#22C55E' : '#EF4444',
          }}>
            ROI {isPositive && roiPct > 0 ? '+' : ''}{fmtPct(roiPct)}
          </span>
        )}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        {[
          { label: 'Investido',  value: fmtMoney(data.gasto)   },
          { label: 'Receita',    value: fmtMoney(data.receita) },
          { label: 'ROAS',       value: roas != null && roas > 0 ? `${roas}x` : '—' },
          { label: 'CPL',        value: fmtMoney(data.cpl)     },
          { label: 'MQLs',       value: fmtNum(data.mqls)      },
          { label: 'Ganhos',     value: fmtNum(data.ganhos)    },
        ].map(m => (
          <div key={m.label}>
            <div style={{ fontSize: 10, color: '#6B7280' }}>{m.label}</div>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#F5F4F3' }}>{m.value}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Orgânico vs Pago ──────────────────────────────────────────────────────────
function OrganicVsPaidComparison({ metaTotals, googleTotals }) {
  const totalPago   = (metaTotals.receita || 0) + (googleTotals.receita || 0)
  const totalGasto  = (metaTotals.gasto   || 0) + (googleTotals.gasto   || 0)
  // Orgânico = sem custo registrado de mídia — é receita pura
  // Nota: só temos receita da mídia paga aqui; orgânico vem de getOrganicVsPaid separado
  const bars = [
    { label: 'Meta',   receita: metaTotals.receita   || 0, gasto: metaTotals.gasto   || 0, color: C.meta   },
    { label: 'Google', receita: googleTotals.receita || 0, gasto: googleTotals.gasto || 0, color: C.google },
  ]
  const maxReceita = Math.max(...bars.map(b => b.receita), 1)

  return (
    <div>
      {bars.map(b => {
        const roas = b.gasto > 0 ? (b.receita / b.gasto).toFixed(2) : '—'
        const roiPct = b.gasto > 0 ? ((b.receita - b.gasto) / b.gasto * 100).toFixed(1) : null
        return (
          <div key={b.label} style={{ marginBottom: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: b.color }}>{b.label}</span>
              <div style={{ display: 'flex', gap: 12, fontSize: 11 }}>
                <span style={{ color: '#6B7280' }}>Investido: <strong style={{ color: '#F5F4F3' }}>{fmtMoney(b.gasto)}</strong></span>
                <span style={{ color: '#6B7280' }}>Receita: <strong style={{ color: '#F5F4F3' }}>{fmtMoney(b.receita)}</strong></span>
                <span style={{ color: '#6B7280' }}>ROAS: <strong style={{ color: b.receita > b.gasto ? '#22C55E' : '#EF4444' }}>{roas}x</strong></span>
              </div>
            </div>
            <div style={{ height: 8, background: 'rgba(255,255,255,0.06)', borderRadius: 4, overflow: 'hidden', position: 'relative' }}>
              <div style={{
                position: 'absolute', height: '100%', borderRadius: 4,
                width: `${(b.gasto / maxReceita) * 100}%`,
                background: `${b.color}44`,
              }} />
              <div style={{
                position: 'absolute', height: '100%', borderRadius: 4,
                width: `${(b.receita / maxReceita) * 100}%`,
                background: b.color,
                transition: 'width 0.6s ease',
              }} />
            </div>
            {roiPct !== null && (
              <div style={{ fontSize: 10, color: parseFloat(roiPct) >= 0 ? '#22C55E' : '#EF4444', marginTop: 3 }}>
                ROI: {parseFloat(roiPct) >= 0 ? '+' : ''}{roiPct}% sobre o investimento
              </div>
            )}
          </div>
        )
      })}
      <div style={{
        marginTop: 8, padding: '10px 14px',
        background: 'rgba(185,145,91,0.07)', border: '1px solid rgba(185,145,91,0.2)',
        borderRadius: 8, fontSize: 12, color: '#9CA3AF', lineHeight: 1.5,
      }}>
        <strong style={{ color: '#B9915B' }}>Nota:</strong> ROAS abaixo de 1x indica que a receita atribuída é menor que o investimento no período — pode refletir ciclo de venda longo ou atribuição incompleta. ROI considera apenas custo de mídia, sem custos operacionais.
      </div>
    </div>
  )
}

// ─── Sub-componentes compartilhados ──────────────────────────────────────────
function JourneyTag({ label }) {
  const colors = {
    'Pago':     { bg: 'rgba(59,130,246,0.15)',  color: '#60A5FA' },
    'Orgânico': { bg: 'rgba(34,197,94,0.15)',   color: '#4ADE80' },
    'Direto':   { bg: 'rgba(138,155,170,0.12)', color: '#9CA3AF' },
    '—':        { bg: 'rgba(255,255,255,0.05)', color: '#6B7280' },
    '*':        { bg: 'rgba(255,255,255,0.05)', color: '#6B7280' },
  }
  const style = colors[label] || { bg: 'rgba(255,255,255,0.05)', color: '#9CA3AF' }
  return (
    <span style={{ fontSize: 11, fontWeight: 600, background: style.bg, color: style.color, borderRadius: 5, padding: '2px 8px' }}>
      {label}
    </span>
  )
}

function ConvBadge({ value }) {
  const color = value > 12 ? '#4ADE80' : value > 6 ? '#FCD34D' : '#F87171'
  return (
    <span style={{ fontSize: 11, fontWeight: 700, color, background: color + '22', borderRadius: 5, padding: '2px 8px' }}>
      {fmtPct(value)}
    </span>
  )
}

function InsightBox({ journeys, totals }) {
  if (!journeys.length) return null
  const best = journeys.reduce((b, r) => r.conv_pct > (b?.conv_pct || 0) ? r : b, null)
  if (!best) return null
  const mainFlow = Object.entries(totals).sort(([, a], [, b]) => b - a)[0]
  return (
    <div style={{ marginTop: 12, background: 'rgba(185,145,91,0.07)', border: '1px solid rgba(185,145,91,0.2)', borderRadius: 8, padding: '10px 14px' }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: '#B9915B', marginBottom: 4 }}>Padrão identificado</div>
      <div style={{ fontSize: 12, color: '#9CA3AF', lineHeight: 1.5 }}>
        Melhor conversão: <strong style={{ color: '#F5F4F3' }}>{best.canal_entrada} → {best.canal_fechamento}</strong> via <strong style={{ color: '#F5F4F3' }}>{best.fonte_entrada}</strong> ({fmtPct(best.conv_pct)}).
        {mainFlow && <> Fluxo mais frequente: <strong style={{ color: '#F5F4F3' }}>{mainFlow[0]}</strong> com {fmtNum(mainFlow[1])} conversões.</>}
      </div>
    </div>
  )
}
