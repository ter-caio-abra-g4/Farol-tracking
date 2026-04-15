import { useState, useEffect } from 'react'
import Header from '../components/layout/Header'
import Card, { CardHeader, CardBody } from '../components/ui/Card'
import Spinner from '../components/ui/Spinner'
import { useTracking } from '../context/TrackingContext'
import { api } from '../services/api'
import { useLocalCache } from '../hooks/useLocalCache'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, FunnelChart, Funnel, LabelList, Legend, Cell,
  AreaChart, Area,
} from 'recharts'
import { TrendingUp, TrendingDown, ShoppingBag, Users, Target, DollarSign, Download, AlertTriangle, CheckCircle, Clock } from 'lucide-react'
import PeriodSelect from '../components/ui/PeriodSelect'
import { fmtNum, fmtMoney } from '../utils/format'
import { downloadCsv } from '../utils/export'

// ─── Paleta ─────────────────────────────────────────────────────────────────
const STAGE_COLORS = {
  MQL:          '#6366F1',
  SAL:          '#8B5CF6',
  Oportunidade: '#A78BFA',
  Conectado:    '#3B82F6',
  Agendado:     '#06B6D4',
  Negociação:   '#F59E0B',
  Ganho:        '#22C55E',
  Perdido:      '#EF4444',
}

const BU_COLORS = ['#6366F1','#22C55E','#F59E0B','#3B82F6','#EC4899','#14B8A6','#F97316','#8B5CF6']

function KpiCard({ icon: Icon, label, value, sub, color = '#6366F1' }) {
  return (
    <div style={{
      background: '#0D1B26', border: `1px solid ${color}33`,
      borderRadius: 10, padding: '14px 18px', display: 'flex', alignItems: 'flex-start', gap: 16,
      position: 'relative', overflow: 'hidden',
    }}>
      <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 3, background: color, borderRadius: '10px 0 0 10px' }} />
      <div style={{
        background: color + '22', borderRadius: 10, padding: 10, flexShrink: 0,
      }}>
        <Icon size={20} color={color} />
      </div>
      <div>
        <div style={{ color: '#8A9BAA', fontSize: 11, fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase', marginBottom: 4 }}>{label}</div>
        <div style={{ color: '#F5F4F3', fontSize: 22, fontWeight: 700 }}>{value}</div>
        {sub && <div style={{ color: '#6B7280', fontSize: 12, marginTop: 2 }}>{sub}</div>}
      </div>
    </div>
  )
}

const PERIOD_OPTIONS = [
  { label: 'Hoje', days: 1  },
  { label: '7d',   days: 7  },
  { label: '15d',  days: 15 },
  { label: '30d',  days: 30 },
  { label: '90d',  days: 90 },
]

// ─── Tooltip customizado ──────────────────────────────────────────────────────
function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div style={{
      background: '#0D2236', border: '1px solid rgba(185,145,91,0.3)',
      borderRadius: 8, padding: '10px 14px', fontSize: 12, color: '#F5F4F3',
      boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
    }}>
      <div style={{ color: '#8A9BAA', marginBottom: 6, fontWeight: 600 }}>{label}</div>
      {payload.map((p, i) => (
        <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 2 }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: p.color, flexShrink: 0 }} />
          <span style={{ color: '#8A9BAA' }}>{p.name}:</span>
          <span style={{ fontWeight: 600 }}>{typeof p.value === 'number' ? fmtNum(p.value) : p.value}</span>
        </div>
      ))}
    </div>
  )
}

// ─── Componente principal ────────────────────────────────────────────────────
// Cores fixas por fonte
const SOURCE_COLORS = {
  facebook: '#1877F2', google: '#EA4335', instagram: '#E1306C',
  hubspot: '#FF7A59', produto: '#14B8A6', prospeccao: '#8B5CF6',
  whatsapp: '#25D366', youtube: '#FF0000', tiktok: '#010101',
  linkedin: '#0A66C2', 'tiktok-ads': '#69C9D0', 'youtube-ads': '#FF0000',
  'linkedin-ads': '#0A66C2',
}
function sourceColor(fonte) {
  return SOURCE_COLORS[fonte?.toLowerCase()] || '#6366F1'
}

export default function FunilPage() {
  const { selectedDays, setSelectedDays } = useTracking()
  const [days, setDays]               = useState(selectedDays)
  function changeDays(d) { setDays(d); setSelectedDays(d) }
  const [stages, setStages]           = useState(null)
  const [lostReasons, setLostReasons] = useState(null)
  const [products, setProducts]       = useState(null)
  const [trend, setTrend]             = useState(null)
  const [ovp, setOvp]                 = useState(null)   // organic vs paid
  const [salWon, setSalWon]           = useState(null)   // SAL→WON trend
  const [qualCamp, setQualCamp]       = useState(null)   // qualificação por campanha
  const [anomalyAlerts, setAnomalyAlerts] = useState(null) // G: anomaly detection
  const [closingCohort, setClosingCohort] = useState(null) // H: cohort fechamento
  const [loading, setLoading]         = useState(true)
  const [lastUpdated, setLastUpdated] = useState(null)
  const [isMock, setIsMock]           = useState(false)
  const [fromCache, setFromCache]     = useState(false)

  const CACHE_TTL = 10 // minutos
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

  function handleExport() {
    const stagesRows = (stages?.stages || []).map(s => ({ etapa: s.name, total: s.total }))
    const productsRows = (products?.products || []).map(p => ({ produto: p.produto, bu: p.bu, deals: p.deals, receita: p.receita }))
    const trendRows = (trend?.trend || []).map(r => ({ dia: r.dia, mqls: r.mqls, ganhos: r.ganhos, perdidos: r.perdidos }))
    const lostRows = (lostReasons?.reasons || []).map(r => ({ motivo: r.reason, total: r.total }))

    const date = new Date().toLocaleDateString('pt-BR').replace(/\//g, '-')
    if (stagesRows.length) downloadCsv(`funil-etapas-${days}d-${date}.csv`, stagesRows)
    if (productsRows.length) downloadCsv(`funil-produtos-${days}d-${date}.csv`, productsRows)
    if (trendRows.length) downloadCsv(`funil-tendencia-${days}d-${date}.csv`, trendRows)
    if (lostRows.length) downloadCsv(`funil-motivos-perda-${days}d-${date}.csv`, lostRows)
  }

  async function loadAll(d, forceRefresh = false) {
    const cacheKey = `funil-${d}`
    if (forceRefresh) {
      try { localStorage.removeItem('farol_cache_' + cacheKey) } catch { /* ok */ }
      await api.databricksCacheClear()
    } else {
      const cached = readLocalCache(cacheKey)
      if (cached) {
        setStages(cached.s); setLostReasons(cached.l); setProducts(cached.p)
        setTrend(cached.t); setOvp(cached.o); setSalWon(cached.sw); setQualCamp(cached.qc || null)
        setAnomalyAlerts(cached.aa || null); setClosingCohort(cached.cc || null)
        setIsMock(!!(cached.s?.mock || cached.p?.mock))
        setLastUpdated(new Date(cached.savedAt))
        setFromCache(true)
        setLoading(false)
        return
      }
    }
    setFromCache(false)
    setLoading(true)
    const [s, l, p, t, o, sw, qc, aa, cc] = await Promise.all([
      api.databricksFunnelStages(d),
      api.databricksFunnelLostReasons(d),
      api.databricksFunnelProducts(d),
      api.databricksFunnelTrend(d),
      api.databricksFunnelOrganicVsPaid(d),
      api.databricksSalWonTrend(d),
      api.funnelQualByCampaign(d),
      api.databricksAnomalyAlerts(),
      api.databricksClosingCohort(d),
    ])
    setStages(s); setLostReasons(l); setProducts(p); setTrend(t); setOvp(o); setSalWon(sw); setQualCamp(qc)
    setAnomalyAlerts(aa); setClosingCohort(cc)
    setIsMock(!!(s?.mock || p?.mock))
    const now = new Date()
    setLastUpdated(now)
    setLoading(false)
    writeLocalCache(cacheKey, { s, l, p, t, o, sw, qc, aa, cc, savedAt: now.toISOString() })
  }

  useEffect(() => { loadAll(days) }, [days])

  // ── KPIs calculados ────────────────────────────────────────────────────────
  const stagesMap = {}
  ;(stages?.stages || []).forEach(s => { stagesMap[s.name] = s.total })

  const mqls     = stagesMap['MQL']        || 0
  const ganhos   = stagesMap['Ganho']      || 0
  const perdidos = stagesMap['Perdido']    || 0
  const negoc    = stagesMap['Negociação'] || 0

  const convRate = mqls > 0 ? ((ganhos / mqls) * 100).toFixed(1) : '—'
  const totalReceita = (products?.products || []).reduce((a, p) => a + (p.receita || 0), 0)
  const topBu = products?.products?.[0]?.bu || '—'

  // ── Dados para gráficos ────────────────────────────────────────────────────
  const funnelData = (stages?.stages || [])
    .filter(s => s.name !== 'Perdido')
    .map(s => ({ name: s.name, value: s.total, fill: STAGE_COLORS[s.name] || '#6366F1' }))

  const lostData = (lostReasons?.reasons || []).slice(0, 8).map(r => ({
    name: r.reason.length > 45 ? r.reason.slice(0, 45) + '…' : r.reason,
    total: r.total,
  }))

  const productsData = (products?.products || []).slice(0, 10).map((p, i) => ({
    name: p.produto.length > 30 ? p.produto.slice(0, 30) + '…' : p.produto,
    deals: p.deals,
    receita: p.receita,
    bu: p.bu,
    color: BU_COLORS[i % BU_COLORS.length],
  }))

  const trendData = (trend?.trend || []).map(r => ({
    dia: r.dia?.slice(5),  // MM-DD
    Ganhos: r.ganhos,
    Perdidos: r.perdidos,
    MQLs: r.mqls,
  }))

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <Header
        title="Funil Comercial"
        isMock={isMock}
        subtitle="Funil comercial — MQL → Ganho"
        onRefresh={() => loadAll(days, true)}
        lastUpdated={lastUpdated}
        action={
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <PeriodSelect value={days} onChange={changeDays} options={PERIOD_OPTIONS} />
            {!loading && fromCache && (
              <span title="Dados em cache — clique em Atualizar para buscar novos dados" style={{
                fontSize: 10, color: '#B9915B', background: 'rgba(185,145,91,0.1)',
                border: '1px solid rgba(185,145,91,0.25)', borderRadius: 5, padding: '2px 8px', fontWeight: 700,
              }}>CACHE</span>
            )}
            {!loading && !isMock && (
              <button
                onClick={handleExport}
                title="Exportar CSVs (etapas, produtos, tendência, motivos de perda)"
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
            {isMock && (
              <span style={{
                background: 'rgba(245,158,11,0.15)', color: '#F59E0B',
                borderRadius: 6, padding: '3px 10px', fontSize: 11, fontWeight: 700,
              }}>MOCK</span>
            )}
          </div>
        }
      />

      <div style={{ flex: 1, overflowY: 'auto', padding: 'clamp(12px, 2vw, 24px) clamp(14px, 2.5vw, 28px)', display: 'flex', flexDirection: 'column', gap: 24, minWidth: 0 }}>

        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 80 }}>
            <Spinner />
          </div>
        ) : (
          <>
            {/* ── KPIs ─────────────────────────────────────────────────── */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 16 }}>
              <KpiCard
                icon={Users}
                label={`MQLs (${days}d)`}
                value={fmtNum(mqls)}
                sub="Leads qualificados"
                color="#6366F1"
              />
              <KpiCard
                icon={TrendingUp}
                label={`Ganhos (${days}d)`}
                value={fmtNum(ganhos)}
                sub={`Taxa conv. ${convRate}%`}
                color="#22C55E"
              />
              <KpiCard
                icon={TrendingDown}
                label={`Perdidos (${days}d)`}
                value={fmtNum(perdidos)}
                sub={`${negoc} em negociação`}
                color="#EF4444"
              />
              <KpiCard
                icon={DollarSign}
                label={`Receita (${days}d)`}
                value={fmtMoney(totalReceita)}
                sub={`Top BU: ${topBu}`}
                color="#F59E0B"
              />
            </div>

            {/* ── Funil (barras horizontais) + Tendência diária ──────── */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.4fr', gap: 20 }}>
              {/* Funil de etapas */}
              <Card>
                <CardHeader title="Funil de Etapas" subtitle={`Leads por estágio — ${days}d`} />
                <CardBody>
                  <ResponsiveContainer width="100%" height={280}>
                    <BarChart
                      data={funnelData}
                      layout="vertical"
                      margin={{ top: 0, right: 16, left: 10, bottom: 0 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" horizontal={false} />
                      <XAxis type="number" tick={{ fill: '#9CA3AF', fontSize: 11 }} axisLine={false} tickLine={false} />
                      <YAxis type="category" dataKey="name" tick={{ fill: '#D1D5DB', fontSize: 12 }} width={90} axisLine={false} tickLine={false} />
                      <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
                      <Bar dataKey="value" radius={[0, 4, 4, 0]} name="Leads">
                        {funnelData.map((entry, i) => (
                          <Cell key={i} fill={entry.fill} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </CardBody>
              </Card>

              {/* Tendência MQL / Ganhos / Perdidos */}
              <Card>
                <CardHeader title="Tendência Diária" subtitle="MQLs · Ganhos · Perdidos" />
                <CardBody>
                  <ResponsiveContainer width="100%" height={280}>
                    <AreaChart data={trendData} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
                      <defs>
                        <linearGradient id="gMQL"     x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%"  stopColor="#6366F1" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="#6366F1" stopOpacity={0}   />
                        </linearGradient>
                        <linearGradient id="gGanhos"  x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%"  stopColor="#22C55E" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="#22C55E" stopOpacity={0}   />
                        </linearGradient>
                        <linearGradient id="gPerdidos" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%"  stopColor="#EF4444" stopOpacity={0.2} />
                          <stop offset="95%" stopColor="#EF4444" stopOpacity={0}   />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                      <XAxis dataKey="dia" tick={{ fill: '#9CA3AF', fontSize: 11 }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fill: '#9CA3AF', fontSize: 11 }} axisLine={false} tickLine={false} />
                      <Tooltip content={<CustomTooltip />} cursor={{ stroke: 'rgba(185,145,91,0.25)', strokeWidth: 1 }} />
                      <Legend wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />
                      <Area type="monotone" dataKey="MQLs"     stroke="#6366F1" fill="url(#gMQL)"     strokeWidth={2} dot={false} />
                      <Area type="monotone" dataKey="Ganhos"   stroke="#22C55E" fill="url(#gGanhos)"  strokeWidth={2} dot={false} />
                      <Area type="monotone" dataKey="Perdidos" stroke="#EF4444" fill="url(#gPerdidos)" strokeWidth={2} dot={false} />
                    </AreaChart>
                  </ResponsiveContainer>
                </CardBody>
              </Card>
            </div>

            {/* ── Produtos vendidos + Motivos de perda ──────────────── */}
            <div style={{ display: 'grid', gridTemplateColumns: '1.3fr 1fr', gap: 20 }}>
              {/* Top produtos */}
              <Card>
                <CardHeader title="Produtos Mais Vendidos" subtitle={`Deals ganhos — ${days}d`} />
                <CardBody>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart
                      data={productsData}
                      layout="vertical"
                      margin={{ top: 0, right: 60, left: 10, bottom: 0 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" horizontal={false} />
                      <XAxis type="number" tick={{ fill: '#9CA3AF', fontSize: 11 }} axisLine={false} tickLine={false} />
                      <YAxis type="category" dataKey="name" tick={{ fill: '#D1D5DB', fontSize: 11 }} width={160} axisLine={false} tickLine={false} />
                      <Tooltip
                        cursor={{ fill: 'rgba(255,255,255,0.04)' }}
                        content={({ active, payload, label }) => {
                          if (!active || !payload?.length) return null
                          const d = payload[0]?.payload
                          return (
                            <div style={{
                              background: '#1E1F2A', border: '1px solid rgba(255,255,255,0.1)',
                              borderRadius: 8, padding: '10px 14px', fontSize: 12,
                            }}>
                              <div style={{ color: '#F9FAFB', fontWeight: 600, marginBottom: 4 }}>{d?.name}</div>
                              <div style={{ color: '#9CA3AF' }}>BU: {d?.bu}</div>
                              <div style={{ color: '#22C55E' }}>Deals: {d?.deals}</div>
                              <div style={{ color: '#F59E0B' }}>Receita: {fmtMoney(d?.receita)}</div>
                            </div>
                          )
                        }}
                      />
                      <Bar dataKey="deals" radius={[0, 4, 4, 0]} name="Deals">
                        {productsData.map((entry, i) => (
                          <Cell key={i} fill={entry.color} />
                        ))}
                      </Bar>
                      <Bar dataKey="receita" radius={[0, 4, 4, 0]} name="Receita" fill="#F59E0B" opacity={0.5} />
                    </BarChart>
                  </ResponsiveContainer>
                </CardBody>
              </Card>

              {/* Motivos de perda */}
              <Card>
                <CardHeader title="Motivos de Perda" subtitle={`Top 8 — ${days}d`} />
                <CardBody>
                  {lostData.length === 0 ? (
                    <div style={{ color: '#6B7280', textAlign: 'center', paddingTop: 60 }}>Sem dados</div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, paddingTop: 4 }}>
                      {lostData.map((item, i) => {
                        const max = lostData[0]?.total || 1
                        const pct = Math.round((item.total / max) * 100)
                        return (
                          <div key={i}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                              <span style={{ color: '#D1D5DB', fontSize: 11, flex: 1, paddingRight: 8 }}>{item.name}</span>
                              <span style={{ color: '#9CA3AF', fontSize: 11, flexShrink: 0 }}>{fmtNum(item.total)}</span>
                            </div>
                            <div style={{ background: 'rgba(255,255,255,0.06)', borderRadius: 4, height: 4 }}>
                              <div style={{
                                background: '#EF4444', borderRadius: 4, height: 4,
                                width: `${pct}%`, transition: 'width 0.4s',
                              }} />
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </CardBody>
              </Card>
            </div>

            {/* ── Orgânico vs Pago ──────────────────────────────────── */}
            {(() => {
              const totais = ovp?.totals || {}
              const pago   = totais['Pago']           || { mqls: 0, ganhos: 0, receita: 0, conv_pct: 0 }
              const org    = totais['Orgânico']        || { mqls: 0, ganhos: 0, receita: 0, conv_pct: 0 }
              const direto = totais['Direto/Sem UTM']  || { mqls: 0, ganhos: 0, receita: 0, conv_pct: 0 }

              const fontesPagas = (ovp?.sources || []).filter(s => s.canal === 'Pago').slice(0, 8)
              const fontesOrg   = (ovp?.sources || []).filter(s => s.canal === 'Orgânico').slice(0, 8)

              const chartPago = fontesPagas.map(s => ({ name: s.fonte, Pago: s.mqls, conv: s.conv_pct }))
              const chartOrg  = fontesOrg.map(s => ({ name: s.fonte, Orgânico: s.mqls, conv: s.conv_pct }))

              return (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  {/* Cabeçalho da seção */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ width: 3, height: 20, background: '#6366F1', borderRadius: 2 }} />
                    <span style={{ color: '#F9FAFB', fontWeight: 700, fontSize: 15 }}>Atribuição por Canal</span>
                    <span style={{ color: '#6B7280', fontSize: 13 }}>last-touch UTM do MQL — {days}d</span>
                  </div>

                  {/* Aviso de limitação */}
                  <div style={{
                    display: 'flex', alignItems: 'flex-start', gap: 10,
                    background: 'rgba(245,158,11,0.07)', border: '1px solid rgba(245,158,11,0.2)',
                    borderRadius: 8, padding: '10px 14px', fontSize: 12,
                  }}>
                    <span style={{ color: '#F59E0B', flexShrink: 0, marginTop: 1 }}>⚠</span>
                    <span style={{ color: '#D1D5DB' }}>
                      <strong style={{ color: '#FCD34D' }}>Atribuição last-touch:</strong> canal capturado no momento do preenchimento do formulário (último UTM antes do form submit).
                      Leads sem UTM são classificados como <strong>Direto/Sem UTM</strong> — podem incluir tráfego orgânico não rastreado, digitação direta, dark social ou ligação/contato direto.
                      Para jornada completa, é necessário capturar <code style={{ color: '#A5B4FC' }}>ga_client_id</code> no form.
                    </span>
                  </div>

                  {/* KPIs — 3 cards */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
                    {/* Pago */}
                    <div style={{
                      background: 'linear-gradient(135deg, rgba(99,102,241,0.08) 0%, rgba(99,102,241,0.03) 100%)',
                      border: '1px solid rgba(99,102,241,0.25)', borderRadius: 12, padding: '18px 20px',
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                        <span style={{ background: '#6366F1', color: '#fff', borderRadius: 6, padding: '2px 10px', fontSize: 12, fontWeight: 700 }}>PAGO</span>
                        <span style={{ color: '#6B7280', fontSize: 11 }}>utm_medium = cpc</span>
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 }}>
                        {[
                          { label: 'MQLs',    value: fmtNum(pago.mqls),         color: '#6366F1' },
                          { label: 'Ganhos',  value: fmtNum(pago.ganhos),        color: '#22C55E' },
                          { label: 'Conv%',   value: `${pago.conv_pct ?? 0}%`,   color: '#F59E0B' },
                          { label: 'Receita', value: fmtMoney(pago.receita),     color: '#14B8A6' },
                        ].map(k => (
                          <div key={k.label} style={{ textAlign: 'center', background: 'rgba(0,0,0,0.15)', borderRadius: 8, padding: '8px 4px' }}>
                            <div style={{ color: k.color, fontSize: 18, fontWeight: 700 }}>{k.value}</div>
                            <div style={{ color: '#6B7280', fontSize: 10, marginTop: 2 }}>{k.label}</div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Orgânico */}
                    <div style={{
                      background: 'linear-gradient(135deg, rgba(34,197,94,0.08) 0%, rgba(34,197,94,0.03) 100%)',
                      border: '1px solid rgba(34,197,94,0.25)', borderRadius: 12, padding: '18px 20px',
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                        <span style={{ background: '#22C55E', color: '#fff', borderRadius: 6, padding: '2px 10px', fontSize: 12, fontWeight: 700 }}>ORGÂNICO</span>
                        <span style={{ color: '#6B7280', fontSize: 11 }}>com UTM, sem cpc</span>
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 }}>
                        {[
                          { label: 'MQLs',    value: fmtNum(org.mqls),          color: '#6366F1' },
                          { label: 'Ganhos',  value: fmtNum(org.ganhos),         color: '#22C55E' },
                          { label: 'Conv%',   value: `${org.conv_pct ?? 0}%`,    color: '#F59E0B' },
                          { label: 'Receita', value: fmtMoney(org.receita),      color: '#14B8A6' },
                        ].map(k => (
                          <div key={k.label} style={{ textAlign: 'center', background: 'rgba(0,0,0,0.15)', borderRadius: 8, padding: '8px 4px' }}>
                            <div style={{ color: k.color, fontSize: 18, fontWeight: 700 }}>{k.value}</div>
                            <div style={{ color: '#6B7280', fontSize: 10, marginTop: 2 }}>{k.label}</div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Direto / Sem UTM */}
                    <div style={{
                      background: 'linear-gradient(135deg, rgba(107,114,128,0.08) 0%, rgba(107,114,128,0.03) 100%)',
                      border: '1px solid rgba(107,114,128,0.25)', borderRadius: 12, padding: '18px 20px',
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                        <span style={{ background: '#6B7280', color: '#fff', borderRadius: 6, padding: '2px 10px', fontSize: 12, fontWeight: 700 }}>DIRETO</span>
                        <span style={{ color: '#6B7280', fontSize: 11 }}>sem UTM / não rastreado</span>
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 }}>
                        {[
                          { label: 'MQLs',    value: fmtNum(direto.mqls),        color: '#6366F1' },
                          { label: 'Ganhos',  value: fmtNum(direto.ganhos),       color: '#22C55E' },
                          { label: 'Conv%',   value: `${direto.conv_pct ?? 0}%`,  color: '#F59E0B' },
                          { label: 'Receita', value: fmtMoney(direto.receita),    color: '#14B8A6' },
                        ].map(k => (
                          <div key={k.label} style={{ textAlign: 'center', background: 'rgba(0,0,0,0.15)', borderRadius: 8, padding: '8px 4px' }}>
                            <div style={{ color: k.color, fontSize: 18, fontWeight: 700 }}>{k.value}</div>
                            <div style={{ color: '#6B7280', fontSize: 10, marginTop: 2 }}>{k.label}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Gráficos de barras por fonte */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                    {/* Fontes pagas */}
                    <Card>
                      <CardHeader title="Fontes Pagas" subtitle="MQLs por fonte (utm_medium = cpc)" />
                      <CardBody>
                        <ResponsiveContainer width="100%" height={220}>
                          <BarChart data={chartPago} layout="vertical" margin={{ top: 0, right: 50, left: 10, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" horizontal={false} />
                            <XAxis type="number" tick={{ fill: '#9CA3AF', fontSize: 11 }} axisLine={false} tickLine={false} />
                            <YAxis type="category" dataKey="name" tick={{ fill: '#D1D5DB', fontSize: 12 }} width={80} axisLine={false} tickLine={false} />
                            <Tooltip cursor={{ fill: 'rgba(255,255,255,0.04)' }} content={({ active, payload, label }) => {
                              if (!active || !payload?.length) return null
                              const d = payload[0]?.payload
                              return (
                                <div style={{ background: '#1E1F2A', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, padding: '8px 12px', fontSize: 12 }}>
                                  <div style={{ color: '#F9FAFB', fontWeight: 600, marginBottom: 4 }}>{label}</div>
                                  <div style={{ color: '#6366F1' }}>MQLs: {fmtNum(d?.Pago)}</div>
                                  <div style={{ color: '#F59E0B' }}>Conv%: {d?.conv}%</div>
                                </div>
                              )
                            }} />
                            <Bar dataKey="Pago" name="MQLs" radius={[0, 4, 4, 0]}>
                              {chartPago.map((entry, i) => (
                                <Cell key={i} fill={sourceColor(entry.name)} />
                              ))}
                            </Bar>
                          </BarChart>
                        </ResponsiveContainer>
                      </CardBody>
                    </Card>

                    {/* Fontes orgânicas */}
                    <Card>
                      <CardHeader title="Fontes Orgânicas" subtitle="MQLs por fonte (social, email, whatsapp…)" />
                      <CardBody>
                        <ResponsiveContainer width="100%" height={220}>
                          <BarChart data={chartOrg} layout="vertical" margin={{ top: 0, right: 50, left: 10, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" horizontal={false} />
                            <XAxis type="number" tick={{ fill: '#9CA3AF', fontSize: 11 }} axisLine={false} tickLine={false} />
                            <YAxis type="category" dataKey="name" tick={{ fill: '#D1D5DB', fontSize: 12 }} width={80} axisLine={false} tickLine={false} />
                            <Tooltip cursor={{ fill: 'rgba(255,255,255,0.04)' }} content={({ active, payload, label }) => {
                              if (!active || !payload?.length) return null
                              const d = payload[0]?.payload
                              return (
                                <div style={{ background: '#1E1F2A', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, padding: '8px 12px', fontSize: 12 }}>
                                  <div style={{ color: '#F9FAFB', fontWeight: 600, marginBottom: 4 }}>{label}</div>
                                  <div style={{ color: '#22C55E' }}>MQLs: {fmtNum(d?.Orgânico)}</div>
                                  <div style={{ color: '#F59E0B' }}>Conv%: {d?.conv}%</div>
                                </div>
                              )
                            }} />
                            <Bar dataKey="Orgânico" name="MQLs" radius={[0, 4, 4, 0]}>
                              {chartOrg.map((entry, i) => (
                                <Cell key={i} fill={sourceColor(entry.name)} />
                              ))}
                            </Bar>
                          </BarChart>
                        </ResponsiveContainer>
                      </CardBody>
                    </Card>
                  </div>

                  {/* Tabela detalhada de fontes */}
                  <Card>
                    <CardHeader title="Detalhamento por Fonte" subtitle="MQL · Ganhos · Conv% · Receita" />
                    <CardBody>
                      <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                          <thead>
                            <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                              {['Canal','Fonte','MQLs','Ganhos','Conv%','Receita'].map(h => (
                                <th key={h} style={{ padding: '8px 12px', textAlign: h === 'Canal' || h === 'Fonte' ? 'left' : 'right', color: '#9CA3AF', fontWeight: 600, whiteSpace: 'nowrap' }}>{h}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {(ovp?.sources || []).slice(0, 15).map((s, i) => (
                              <tr key={i} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                                <td style={{ padding: '8px 12px' }}>
                                  <span style={{
                                    background: s.canal === 'Pago'
                                      ? 'rgba(99,102,241,0.15)'
                                      : s.canal === 'Orgânico'
                                        ? 'rgba(34,197,94,0.12)'
                                        : 'rgba(107,114,128,0.18)',
                                    color: s.canal === 'Pago'
                                      ? '#818CF8'
                                      : s.canal === 'Orgânico'
                                        ? '#4ADE80'
                                        : '#9CA3AF',
                                    borderRadius: 5, padding: '2px 8px', fontSize: 11, fontWeight: 700,
                                  }}>{s.canal === 'Direto/Sem UTM' ? 'Direto' : s.canal}</span>
                                </td>
                                <td style={{ padding: '8px 12px' }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: sourceColor(s.fonte), flexShrink: 0 }} />
                                    <span style={{ color: '#D1D5DB' }}>{s.fonte}</span>
                                  </div>
                                </td>
                                <td style={{ padding: '8px 12px', textAlign: 'right', color: '#A5B4FC', fontWeight: 600 }}>{fmtNum(s.mqls)}</td>
                                <td style={{ padding: '8px 12px', textAlign: 'right', color: '#4ADE80' }}>{fmtNum(s.ganhos)}</td>
                                <td style={{ padding: '8px 12px', textAlign: 'right', color: s.conv_pct >= 10 ? '#4ADE80' : s.conv_pct >= 5 ? '#FCD34D' : '#F87171' }}>
                                  {s.conv_pct ? `${s.conv_pct}%` : '—'}
                                </td>
                                <td style={{ padding: '8px 12px', textAlign: 'right', color: '#9CA3AF' }}>{fmtMoney(s.receita)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </CardBody>
                  </Card>
                </div>
              )
            })()}

            {/* ── Tendência SAL→WON por canal ───────────────────────── */}
            {salWon && (salWon.semanas || []).length > 0 && (() => {
              const semanas = salWon.semanas || []
              const avgOrg = semanas.reduce((s, w) => s + (w.Organico_pct || 0), 0) / semanas.length
              const avgPago = semanas.reduce((s, w) => s + (w.Pago_pct || 0), 0) / semanas.length
              const lastOrg  = semanas[semanas.length - 1]?.Organico_pct || 0
              const lastPago = semanas[semanas.length - 1]?.Pago_pct || 0
              const orgTrend = semanas.length > 4
                ? semanas.slice(-4).reduce((s, w) => s + (w.Organico_pct || 0), 0) / 4 - semanas.slice(0, 4).reduce((s, w) => s + (w.Organico_pct || 0), 0) / 4
                : 0

              return (
                <div>
                  {/* Alerta de tendência de queda */}
                  {orgTrend < -3 && (
                    <div style={{ marginBottom: 12, padding: '10px 16px', background: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 8, fontSize: 12, color: '#FCA5A5' }}>
                      ⚠ <strong>Tendência de queda no SAL→WON Orgânico:</strong> taxa caiu {Math.abs(orgTrend).toFixed(1)}pp nas últimas semanas. Investigar priorização comercial.
                    </div>
                  )}

                  <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 16 }}>
                    {/* Gráfico de linha */}
                    <Card>
                      <CardHeader
                        title="SAL → WON ao longo do tempo"
                        subtitle="Taxa semanal por canal — Orgânico vs Pago"
                      />
                      <CardBody style={{ paddingTop: 4 }}>
                        <ResponsiveContainer width="100%" height={200}>
                          <LineChart data={semanas} margin={{ top: 4, right: 12, left: -16, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                            <XAxis dataKey="semana" tick={{ fill: '#9CA3AF', fontSize: 10 }} axisLine={false} tickLine={false}
                              tickFormatter={v => v?.slice(5)} interval="preserveStartEnd" />
                            <YAxis tick={{ fill: '#9CA3AF', fontSize: 10 }} axisLine={false} tickLine={false}
                              tickFormatter={v => `${v}%`} />
                            <Tooltip
                              cursor={{ stroke: 'rgba(185,145,91,0.25)', strokeWidth: 1 }}
                              content={({ active, payload, label }) => {
                                if (!active || !payload?.length) return null
                                return (
                                  <div style={{ background: '#1E1F2A', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, padding: '8px 12px', fontSize: 12 }}>
                                    <div style={{ color: '#F9FAFB', fontWeight: 600, marginBottom: 4 }}>Semana {label}</div>
                                    {payload.map(p => (
                                      <div key={p.dataKey} style={{ color: p.color }}>{p.name}: {p.value?.toFixed(1)}%</div>
                                    ))}
                                  </div>
                                )
                              }}
                            />
                            <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
                            <Line dataKey="Organico_pct" name="Orgânico" stroke="#22C55E" strokeWidth={2} dot={false} connectNulls />
                            <Line dataKey="Pago_pct"     name="Pago"     stroke="#6366F1" strokeWidth={2} dot={false} connectNulls />
                          </LineChart>
                        </ResponsiveContainer>
                      </CardBody>
                    </Card>

                    {/* Cards de média */}
                    <Card>
                      <CardHeader title="Média do período" subtitle="SAL→WON por canal" />
                      <CardBody style={{ display: 'flex', flexDirection: 'column', gap: 14, justifyContent: 'center' }}>
                        {[
                          { label: 'Orgânico', avg: avgOrg, curr: lastOrg, color: '#22C55E' },
                          { label: 'Pago',     avg: avgPago, curr: lastPago, color: '#6366F1' },
                        ].map(c => {
                          const delta = c.curr - c.avg
                          return (
                            <div key={c.label} style={{ background: 'rgba(255,255,255,0.02)', borderRadius: 8, padding: '12px 16px' }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                                <span style={{ fontSize: 12, fontWeight: 700, color: c.color }}>{c.label}</span>
                                <span style={{ fontSize: 10, color: delta >= 0 ? '#22C55E' : '#EF4444', fontWeight: 700 }}>
                                  {delta >= 0 ? '+' : ''}{delta.toFixed(1)}pp vs média
                                </span>
                              </div>
                              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                                <div>
                                  <div style={{ fontSize: 18, fontWeight: 800, color: c.color }}>{c.curr.toFixed(1)}%</div>
                                  <div style={{ fontSize: 9, color: '#6B7280' }}>última semana</div>
                                </div>
                                <div>
                                  <div style={{ fontSize: 15, fontWeight: 600, color: '#9CA3AF' }}>{c.avg.toFixed(1)}%</div>
                                  <div style={{ fontSize: 9, color: '#6B7280' }}>média do período</div>
                                </div>
                              </div>
                              <div style={{ marginTop: 8, height: 4, background: 'rgba(255,255,255,0.06)', borderRadius: 2 }}>
                                <div style={{ width: `${Math.min(c.curr, 100)}%`, height: '100%', background: c.color, borderRadius: 2 }} />
                              </div>
                            </div>
                          )
                        })}
                      </CardBody>
                    </Card>
                  </div>
                </div>
              )
            })()}

            {/* ── Qualificação histórica por campanha ─────────────── */}
            {qualCamp && (qualCamp.campaigns || []).length > 0 && (() => {
              const camps = qualCamp.campaigns || []
              const maxLeads = Math.max(...camps.map(c => c.leads), 1)
              return (
                <Card>
                  <CardHeader
                    title="Qualificação por Campanha"
                    subtitle={`Top campanhas · taxa de qualificação (MQL/Lead) e conversão (Ganho/MQL) · últimos ${days}d`}
                  />
                  <CardBody style={{ padding: 0 }}>
                    {/* Header */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 70px 70px 70px 70px 70px', gap: 8, padding: '6px 16px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                      {[
                        { label: 'Campanha',     color: '#6B7280' },
                        { label: 'Leads',        color: '#6B7280' },
                        { label: 'MQLs',         color: '#6366F1' },
                        { label: 'Ganhos',       color: '#22C55E' },
                        { label: 'Taxa MQL%',    color: '#8B5CF6' },
                        { label: 'Taxa Ganho%',  color: '#F59E0B' },
                      ].map((h, i) => (
                        <div key={i} style={{ fontSize: 10, color: h.color, fontWeight: 700, textAlign: i > 0 ? 'right' : 'left' }}>{h.label}</div>
                      ))}
                    </div>
                    {camps.map((c, i) => {
                      const barPct = (c.leads / maxLeads) * 100
                      const qualColor = c.qual_pct >= 40 ? '#22C55E' : c.qual_pct >= 20 ? '#F59E0B' : '#EF4444'
                      const convColor = c.conv_pct >= 10 ? '#22C55E' : c.conv_pct >= 5  ? '#F59E0B' : '#EF4444'
                      return (
                        <div key={i} style={{ padding: '8px 16px', borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 70px 70px 70px 70px 70px', gap: 8, alignItems: 'center', marginBottom: 4 }}>
                            <div style={{ fontSize: 11, color: '#F5F4F3', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={c.campanha}>
                              {c.campanha}
                            </div>
                            <div style={{ textAlign: 'right', fontSize: 11, color: '#9CA3AF' }}>{fmtNum(c.leads)}</div>
                            <div style={{ textAlign: 'right', fontSize: 11, color: '#6366F1', fontWeight: 600 }}>{fmtNum(c.mqls)}</div>
                            <div style={{ textAlign: 'right', fontSize: 11, color: '#22C55E', fontWeight: 600 }}>{fmtNum(c.ganhos)}</div>
                            <div style={{ textAlign: 'right' }}>
                              <span style={{ fontSize: 11, fontWeight: 700, color: qualColor, background: qualColor + '20', borderRadius: 4, padding: '1px 6px' }}>
                                {c.qual_pct}%
                              </span>
                            </div>
                            <div style={{ textAlign: 'right' }}>
                              <span style={{ fontSize: 11, fontWeight: 700, color: convColor, background: convColor + '20', borderRadius: 4, padding: '1px 6px' }}>
                                {c.conv_pct}%
                              </span>
                            </div>
                          </div>
                          {/* Barra proporcional de leads */}
                          <div style={{ height: 3, background: 'rgba(255,255,255,0.05)', borderRadius: 2 }}>
                            <div style={{ width: `${barPct}%`, height: '100%', background: '#6366F1', borderRadius: 2, opacity: 0.5, transition: 'width 0.4s ease' }} />
                          </div>
                        </div>
                      )
                    })}
                    {/* Legenda de cores */}
                    <div style={{ padding: '8px 16px', display: 'flex', gap: 16, fontSize: 10, color: '#6B7280' }}>
                      <span>Taxa MQL%: <span style={{ color: '#22C55E' }}>≥40 boa</span> · <span style={{ color: '#F59E0B' }}>≥20 ok</span> · <span style={{ color: '#EF4444' }}>&lt;20 atenção</span></span>
                      <span>Taxa Ganho%: <span style={{ color: '#22C55E' }}>≥10 boa</span> · <span style={{ color: '#F59E0B' }}>≥5 ok</span> · <span style={{ color: '#EF4444' }}>&lt;5 atenção</span></span>
                    </div>
                  </CardBody>
                </Card>
              )
            })()}

            {/* ── G: Anomaly Detection ──────────────────────────── */}
            {anomalyAlerts && (() => {
              const alerts = anomalyAlerts.alerts || []
              const semCurr = anomalyAlerts.semana_curr?.slice(0, 10)
              const semPrev = anomalyAlerts.semana_prev?.slice(0, 10)
              return (
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                    <div style={{ width: 3, height: 20, background: alerts.length > 0 ? '#EF4444' : '#22C55E', borderRadius: 2 }} />
                    <span style={{ color: '#F9FAFB', fontWeight: 700, fontSize: 15 }}>Anomaly Detection</span>
                    <span style={{ color: '#6B7280', fontSize: 13 }}>variação semana a semana — alertas automáticos ≥ 20%</span>
                    {semCurr && (
                      <span style={{ marginLeft: 'auto', fontSize: 11, color: '#6B7280' }}>
                        Semana atual: {semCurr} · anterior: {semPrev}
                      </span>
                    )}
                  </div>

                  {alerts.length === 0 ? (
                    <div style={{
                      display: 'flex', alignItems: 'center', gap: 10,
                      background: 'rgba(34,197,94,0.07)', border: '1px solid rgba(34,197,94,0.2)',
                      borderRadius: 10, padding: '14px 20px',
                    }}>
                      <CheckCircle size={18} color="#22C55E" />
                      <span style={{ color: '#4ADE80', fontWeight: 600 }}>Todas as métricas dentro do padrão histórico — nenhuma anomalia detectada esta semana.</span>
                    </div>
                  ) : (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 12 }}>
                      {alerts.map((a, i) => {
                        const isUp   = a.delta > 0
                        const color  = isUp ? '#22C55E' : '#EF4444'
                        const bgColor = isUp ? 'rgba(34,197,94,0.07)' : 'rgba(239,68,68,0.07)'
                        const borderColor = isUp ? 'rgba(34,197,94,0.25)' : 'rgba(239,68,68,0.25)'
                        return (
                          <div key={i} style={{
                            background: bgColor, border: `1px solid ${borderColor}`,
                            borderRadius: 10, padding: '14px 16px',
                          }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                              <AlertTriangle size={14} color={color} />
                              <span style={{ fontSize: 11, color: '#9CA3AF', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{a.label}</span>
                            </div>
                            <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end' }}>
                              <div>
                                <div style={{ fontSize: 22, fontWeight: 800, color }}>
                                  {a.delta > 0 ? '+' : ''}{a.delta}%
                                </div>
                                <div style={{ fontSize: 10, color: '#6B7280', marginTop: 2 }}>vs semana anterior</div>
                              </div>
                              <div style={{ marginLeft: 'auto', textAlign: 'right' }}>
                                <div style={{ fontSize: 13, color: '#F5F4F3', fontWeight: 700 }}>
                                  {a.unit === 'R$' ? fmtMoney(a.curr) : fmtNum(a.curr)}
                                </div>
                                <div style={{ fontSize: 11, color: '#6B7280' }}>
                                  antes: {a.unit === 'R$' ? fmtMoney(a.prev) : fmtNum(a.prev)}
                                </div>
                              </div>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              )
            })()}

            {/* ── H: Cohort de fechamento ────────────────────────── */}
            {closingCohort && (closingCohort.cohort || []).length > 0 && (() => {
              const cohort = closingCohort.cohort || []
              const mesMap = {}
              cohort.forEach(r => {
                if (!mesMap[r.mes]) mesMap[r.mes] = { mes: r.mes }
                mesMap[r.mes][r.canal + '_mql']  = r.total_mql
                mesMap[r.mes][r.canal + '_won']  = r.total_won
                mesMap[r.mes][r.canal + '_dias'] = r.dias_medio
                mesMap[r.mes][r.canal + '_conv'] = r.conv_pct
              })
              const meses = Object.values(mesMap).sort((a, b) => a.mes > b.mes ? 1 : -1)
              const canais = [...new Set(cohort.map(r => r.canal))]
              const CANAL_COLOR = { Pago: '#6366F1', Organico: '#22C55E', Direto: '#F59E0B' }

              return (
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                    <div style={{ width: 3, height: 20, background: '#14B8A6', borderRadius: 2 }} />
                    <span style={{ color: '#F9FAFB', fontWeight: 700, fontSize: 15 }}>Cohort de Fechamento</span>
                    <span style={{ color: '#6B7280', fontSize: 13 }}>tempo médio MQL→WON por canal e mês de entrada</span>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 16 }}>
                    <Card>
                      <CardHeader title="Dias médios MQL→WON" subtitle="Por canal e mês de entrada do lead" />
                      <CardBody>
                        <ResponsiveContainer width="100%" height={220}>
                          <LineChart data={meses} margin={{ top: 4, right: 12, left: -16, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                            <XAxis dataKey="mes" tick={{ fill: '#9CA3AF', fontSize: 10 }} axisLine={false} tickLine={false} />
                            <YAxis tick={{ fill: '#9CA3AF', fontSize: 10 }} axisLine={false} tickLine={false}
                              tickFormatter={v => `${v}d`} />
                            <Tooltip
                              cursor={{ stroke: 'rgba(185,145,91,0.25)', strokeWidth: 1 }}
                              content={({ active, payload, label }) => {
                                if (!active || !payload?.length) return null
                                return (
                                  <div style={{ background: '#1E1F2A', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, padding: '8px 12px', fontSize: 12 }}>
                                    <div style={{ color: '#F9FAFB', fontWeight: 600, marginBottom: 4 }}>{label}</div>
                                    {payload.map(p => (
                                      <div key={p.dataKey} style={{ color: p.color }}>{p.name}: {p.value?.toFixed(1)} dias</div>
                                    ))}
                                  </div>
                                )
                              }}
                            />
                            <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
                            {canais.map(canal => (
                              <Line key={canal} dataKey={canal + '_dias'} name={canal}
                                stroke={CANAL_COLOR[canal] || '#8B5CF6'} strokeWidth={2} dot={{ r: 3 }} connectNulls />
                            ))}
                          </LineChart>
                        </ResponsiveContainer>
                      </CardBody>
                    </Card>

                    <Card>
                      <CardHeader title="Resumo por canal" subtitle="Último mês disponível" />
                      <CardBody style={{ padding: 0 }}>
                        <div style={{ padding: '4px 0' }}>
                          {canais.map(canal => {
                            const lastMes = meses[meses.length - 1]
                            if (!lastMes) return null
                            const dias  = lastMes[canal + '_dias'] || 0
                            const conv  = lastMes[canal + '_conv'] || 0
                            const mql   = lastMes[canal + '_mql']  || 0
                            const won   = lastMes[canal + '_won']  || 0
                            const color = CANAL_COLOR[canal] || '#8B5CF6'
                            return (
                              <div key={canal} style={{ padding: '12px 16px', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                                  <span style={{ fontSize: 12, fontWeight: 700, color }}>{canal}</span>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                    <Clock size={11} color="#6B7280" />
                                    <span style={{ fontSize: 13, fontWeight: 800, color }}>{dias.toFixed(1)}d</span>
                                  </div>
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6, fontSize: 11 }}>
                                  {[
                                    { label: 'MQLs', value: fmtNum(mql), color: '#9CA3AF' },
                                    { label: 'WONs', value: fmtNum(won), color },
                                    { label: 'Conv%', value: conv.toFixed(1) + '%', color: conv >= 30 ? '#22C55E' : conv >= 20 ? '#F59E0B' : '#EF4444' },
                                  ].map(k => (
                                    <div key={k.label} style={{ textAlign: 'center', background: 'rgba(255,255,255,0.03)', borderRadius: 6, padding: '5px 0' }}>
                                      <div style={{ color: '#6B7280', marginBottom: 2 }}>{k.label}</div>
                                      <div style={{ color: k.color, fontWeight: 700 }}>{k.value}</div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )
                          })}
                        </div>
                        <div style={{ overflowX: 'auto', padding: '8px 16px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
                            <thead>
                              <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                                <th style={{ padding: '6px 8px', textAlign: 'left', color: '#6B7280', fontWeight: 600 }}>Mês</th>
                                {canais.map(c => (
                                  <th key={c + '_d'} style={{ padding: '6px 8px', textAlign: 'right', color: CANAL_COLOR[c] || '#8B5CF6', fontWeight: 600 }}>{c} dias</th>
                                ))}
                                {canais.map(c => (
                                  <th key={c + '_c'} style={{ padding: '6px 8px', textAlign: 'right', color: CANAL_COLOR[c] || '#8B5CF6', fontWeight: 600 }}>{c} conv%</th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {meses.slice(-6).map((m, i) => (
                                <tr key={i} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                                  <td style={{ padding: '6px 8px', color: '#9CA3AF' }}>{m.mes}</td>
                                  {canais.map(c => (
                                    <td key={c + '_d'} style={{ padding: '6px 8px', textAlign: 'right', color: '#D1D5DB' }}>
                                      {m[c + '_dias'] ? m[c + '_dias'].toFixed(1) + 'd' : '—'}
                                    </td>
                                  ))}
                                  {canais.map(c => (
                                    <td key={c + '_c'} style={{ padding: '6px 8px', textAlign: 'right' }}>
                                      {m[c + '_conv'] != null
                                        ? <span style={{ color: m[c + '_conv'] >= 30 ? '#22C55E' : m[c + '_conv'] >= 20 ? '#F59E0B' : '#EF4444' }}>{m[c + '_conv'].toFixed(1)}%</span>
                                        : <span style={{ color: '#374151' }}>—</span>
                                      }
                                    </td>
                                  ))}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </CardBody>
                    </Card>
                  </div>
                </div>
              )
            })()}

            {/* ── Nota de fonte ─────────────────────────────────────── */}
            <div style={{
              display: 'flex', gap: 16, alignItems: 'center',
              background: '#1A1B23', border: '1px solid rgba(255,255,255,0.06)',
              borderRadius: 10, padding: '12px 20px', fontSize: 12, color: '#6B7280',
            }}>
              <span>Fontes:</span>
              <span style={{ color: '#9CA3AF' }}>
                <strong style={{ color: '#6366F1' }}>Databricks</strong> production.diamond.funil_comercial · customer_360_sales_table
                &nbsp;·&nbsp; Período: últimos {days} dias
                {isMock && <span style={{ color: '#F59E0B', marginLeft: 8 }}> · Dados simulados (mock)</span>}
              </span>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
