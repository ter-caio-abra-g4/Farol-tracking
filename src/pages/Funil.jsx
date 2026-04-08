import { useState, useEffect } from 'react'
import Header from '../components/layout/Header'
import Card, { CardHeader, CardBody } from '../components/ui/Card'
import Spinner from '../components/ui/Spinner'
import { api } from '../services/api'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, FunnelChart, Funnel, LabelList, Legend, Cell,
  AreaChart, Area,
} from 'recharts'
import { TrendingUp, TrendingDown, ShoppingBag, Users, Target, DollarSign } from 'lucide-react'

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

// ─── Helpers ─────────────────────────────────────────────────────────────────
function fmtMoney(val) {
  if (!val) return 'R$ 0'
  if (val >= 1_000_000) return `R$ ${(val / 1_000_000).toFixed(1)}M`
  if (val >= 1_000)     return `R$ ${(val / 1_000).toFixed(0)}K`
  return `R$ ${val.toFixed(0)}`
}

function fmtNum(val) {
  if (val === null || val === undefined) return '—'
  if (val >= 1_000) return `${(val / 1000).toFixed(1)}k`
  return String(val)
}

function KpiCard({ icon: Icon, label, value, sub, color = '#6366F1' }) {
  return (
    <div style={{
      background: '#1A1B23', border: '1px solid rgba(255,255,255,0.06)',
      borderRadius: 12, padding: '20px 24px', display: 'flex', alignItems: 'flex-start', gap: 16,
    }}>
      <div style={{
        background: color + '22', borderRadius: 10, padding: 10, flexShrink: 0,
      }}>
        <Icon size={20} color={color} />
      </div>
      <div>
        <div style={{ color: '#9CA3AF', fontSize: 12, marginBottom: 4 }}>{label}</div>
        <div style={{ color: '#F9FAFB', fontSize: 22, fontWeight: 700 }}>{value}</div>
        {sub && <div style={{ color: '#6B7280', fontSize: 12, marginTop: 2 }}>{sub}</div>}
      </div>
    </div>
  )
}

const PERIOD_OPTIONS = [
  { label: '7d',  days: 7  },
  { label: '30d', days: 30 },
  { label: '90d', days: 90 },
]

// ─── Tooltip customizado ──────────────────────────────────────────────────────
function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div style={{
      background: '#1E1F2A', border: '1px solid rgba(255,255,255,0.1)',
      borderRadius: 8, padding: '10px 14px', fontSize: 13,
    }}>
      <div style={{ color: '#9CA3AF', marginBottom: 4 }}>{label}</div>
      {payload.map((p, i) => (
        <div key={i} style={{ color: p.color || '#F9FAFB', marginBottom: 2 }}>
          {p.name}: <strong>{typeof p.value === 'number' && p.value > 1000 ? fmtNum(p.value) : p.value}</strong>
        </div>
      ))}
    </div>
  )
}

// ─── Componente principal ────────────────────────────────────────────────────
export default function FunilPage() {
  const [days, setDays]               = useState(30)
  const [stages, setStages]           = useState(null)
  const [lostReasons, setLostReasons] = useState(null)
  const [products, setProducts]       = useState(null)
  const [trend, setTrend]             = useState(null)
  const [loading, setLoading]         = useState(true)
  const [lastUpdated, setLastUpdated] = useState(null)
  const [isMock, setIsMock]           = useState(false)

  async function loadAll(d) {
    setLoading(true)
    const [s, l, p, t] = await Promise.all([
      api.databricksFunnelStages(d),
      api.databricksFunnelLostReasons(d),
      api.databricksFunnelProducts(d),
      api.databricksFunnelTrend(d),
    ])
    setStages(s)
    setLostReasons(l)
    setProducts(p)
    setTrend(t)
    setIsMock(!!(s?.mock || p?.mock))
    setLastUpdated(new Date())
    setLoading(false)
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
        subtitle={lastUpdated
          ? `Atualizado ${lastUpdated.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`
          : 'Carregando…'}
        actions={
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            {isMock && (
              <span style={{
                background: 'rgba(245,158,11,0.15)', color: '#F59E0B',
                borderRadius: 6, padding: '3px 10px', fontSize: 12,
              }}>MOCK</span>
            )}
            <div style={{ display: 'flex', gap: 4, background: '#1A1B23', borderRadius: 8, padding: 4 }}>
              {PERIOD_OPTIONS.map(o => (
                <button key={o.days}
                  onClick={() => setDays(o.days)}
                  style={{
                    background: days === o.days ? '#6366F1' : 'transparent',
                    color: days === o.days ? '#fff' : '#9CA3AF',
                    border: 'none', borderRadius: 6, padding: '4px 12px',
                    cursor: 'pointer', fontSize: 13, fontWeight: 600,
                  }}
                >{o.label}</button>
              ))}
            </div>
            <button
              onClick={() => loadAll(days)}
              style={{
                background: '#1A1B23', border: '1px solid rgba(255,255,255,0.1)',
                color: '#9CA3AF', borderRadius: 8, padding: '6px 14px',
                cursor: 'pointer', fontSize: 13,
              }}
            >↻ Atualizar</button>
          </div>
        }
      />

      <div style={{ flex: 1, overflowY: 'auto', padding: '24px 28px', display: 'flex', flexDirection: 'column', gap: 24 }}>

        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 80 }}>
            <Spinner />
          </div>
        ) : (
          <>
            {/* ── KPIs ─────────────────────────────────────────────────── */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
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
                      <Tooltip content={<CustomTooltip />} />
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
                      <Tooltip content={<CustomTooltip />} />
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
