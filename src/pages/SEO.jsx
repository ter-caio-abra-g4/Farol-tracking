import { useState, useEffect } from 'react'
import Header from '../components/layout/Header'
import Card, { CardHeader, CardBody } from '../components/ui/Card'
import Spinner from '../components/ui/Spinner'
import { api } from '../services/api'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, Legend, AreaChart, Area, Cell,
} from 'recharts'
import { TrendingUp, TrendingDown, Minus, Zap } from 'lucide-react'

// ─── Helpers ──────────────────────────────────────────────────────────────────
const TT = {
  contentStyle: {
    background: '#001A2E', border: '1px solid rgba(185,145,91,0.3)',
    borderRadius: 8, fontSize: 12, color: '#F5F4F3',
  },
}

function fmtMoney(v) {
  if (!v && v !== 0) return '—'
  if (v >= 1_000_000) return `R$ ${(v / 1_000_000).toFixed(1)}M`
  if (v >= 1_000)     return `R$ ${(v / 1_000).toFixed(0)}K`
  return `R$ ${v.toFixed(0)}`
}
function fmtNum(v) {
  if (v === null || v === undefined) return '—'
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`
  if (v >= 1_000)     return `${(v / 1_000).toFixed(1)}k`
  return String(v)
}
function fmtDays(v) {
  if (!v && v !== 0) return '—'
  return `${v.toFixed(1)}d`
}
function pct(v) {
  if (v === null || v === undefined) return '—'
  return `${v.toFixed(1)}%`
}

const CANAL_COLOR = {
  'Orgânico': '#22C55E',
  'Pago':     '#6366F1',
  'Direto':   '#B9915B',
}

const PERIOD_OPTIONS = [
  { label: '30d', days: 30 },
  { label: '90d', days: 90 },
  { label: '180d', days: 180 },
]

// ─── KPI Card ─────────────────────────────────────────────────────────────────
function KpiCard({ label, value, sub, color, delta, deltaLabel, icon: Icon }) {
  const deltaColor = delta === null || delta === undefined ? '#8A9BAA'
    : delta > 0 ? '#22C55E' : delta < 0 ? '#EF4444' : '#8A9BAA'
  const DeltaIcon = delta === null || delta === undefined ? Minus
    : delta > 0 ? TrendingUp : TrendingDown

  return (
    <Card>
      <CardBody style={{ padding: '16px 18px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
          <div style={{ fontSize: 11, color: '#8A9BAA', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', lineHeight: 1.3 }}>{label}</div>
          {Icon && <Icon size={15} color={color || '#8A9BAA'} strokeWidth={1.8} />}
        </div>
        <div style={{ fontSize: 24, fontWeight: 800, color: '#F5F4F3', lineHeight: 1, marginBottom: 6 }}>{value}</div>
        {sub && <div style={{ fontSize: 11, color: color || '#8A9BAA', fontWeight: 600 }}>{sub}</div>}
        {(delta !== null && delta !== undefined) && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 6 }}>
            <DeltaIcon size={11} color={deltaColor} />
            <span style={{ fontSize: 11, color: deltaColor, fontWeight: 700 }}>{deltaLabel || `${delta > 0 ? '+' : ''}${delta}%`}</span>
          </div>
        )}
      </CardBody>
    </Card>
  )
}

// ─── Barra comparativa H vs V ──────────────────────────────────────────────────
function CompareBar({ labelA, valA, labelB, valB, colorA, colorB, format = 'money' }) {
  const fmt = format === 'money' ? fmtMoney : format === 'days' ? fmtDays : fmtNum
  const total = (valA || 0) + (valB || 0)
  const pctA = total > 0 ? (valA / total) * 100 : 50
  const pctB = 100 - pctA
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontSize: 13 }}>
        <span style={{ color: colorA, fontWeight: 700 }}>{labelA}: {fmt(valA)}</span>
        <span style={{ color: colorB, fontWeight: 700 }}>{labelB}: {fmt(valB)}</span>
      </div>
      <div style={{ display: 'flex', height: 10, borderRadius: 5, overflow: 'hidden' }}>
        <div style={{ width: `${pctA}%`, background: colorA }} />
        <div style={{ width: `${pctB}%`, background: colorB }} />
      </div>
    </div>
  )
}

// ─── Página principal ─────────────────────────────────────────────────────────
export default function SEOPage() {
  const [days, setDays] = useState(90)
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [lastUpdated, setLastUpdated] = useState(null)

  async function loadData() {
    setLoading(true)
    const result = await api.analyticsGetOrganic(days)
    setData(result)
    setLoading(false)
    setLastUpdated(Date.now())
  }

  useEffect(() => { loadData() }, [days])

  const kpis    = data?.kpis    || {}
  const sources = data?.sources || []
  const trend   = data?.trend   || []
  const speed   = data?.speed   || []

  const organico = kpis.organico || { mqls: 0, ganhos: 0, receita: 0, conv_pct: 0 }
  const pago     = kpis.pago     || { mqls: 0, ganhos: 0, receita: 0, conv_pct: 0 }

  // Prepara série temporal para gráfico de linha
  // Agrupa por semana, pivotar canal
  const trendMap = {}
  trend.forEach(r => {
    if (!trendMap[r.semana]) trendMap[r.semana] = { semana: r.semana }
    trendMap[r.semana][r.canal + '_mqls']    = r.mqls
    trendMap[r.semana][r.canal + '_receita'] = r.receita
  })
  const trendSeries = Object.values(trendMap).sort((a, b) => a.semana > b.semana ? 1 : -1)

  // Speed — dados para gráfico de barras
  const speedData = speed.map(r => ({
    canal: r.canal,
    'Dias médio': r.dias_medio,
    'Mediana':    r.dias_mediana,
  }))

  // Fontes orgânicas para tabela
  const totalMqls    = sources.reduce((s, r) => s + r.mqls, 0)
  const totalReceita = sources.reduce((s, r) => s + r.receita, 0)

  // Calcular deflexão de verba paga:
  // Se o orgânico gera X leads, e o CAC pago é Y, quanto eles "economizaram" em verba paga
  const deflexaoVerba = kpis.cacPago && organico.mqls
    ? kpis.cacPago * organico.mqls : null

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      <Header
        title="Orgânico como Negócio"
        subtitle="Retorno financeiro, contribuição no pipeline e velocidade de fechamento"
        onRefresh={loadData}
        lastUpdated={lastUpdated}
        action={
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ display: 'flex', gap: 2, background: 'rgba(185,145,91,0.06)', borderRadius: 6, padding: 2 }}>
              {PERIOD_OPTIONS.map(o => (
                <button key={o.days} onClick={() => setDays(o.days)} style={{
                  background: days === o.days ? 'rgba(185,145,91,0.2)' : 'transparent',
                  color: days === o.days ? '#B9915B' : '#8A9BAA',
                  border: 'none', borderRadius: 4, padding: '3px 10px', cursor: 'pointer',
                  fontSize: 11, fontWeight: 600, fontFamily: 'Manrope, sans-serif',
                }}>
                  {o.label}
                </button>
              ))}
            </div>
            {data?.mock && <span style={{ fontSize: 10, color: '#F59E0B', background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.25)', padding: '2px 10px', borderRadius: 10, fontWeight: 700 }}>MOCK</span>}
            {!data?.mock && <span style={{ fontSize: 10, color: '#22C55E', background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.25)', padding: '2px 10px', borderRadius: 10, fontWeight: 700 }}>LIVE</span>}
          </div>
        }
      />

      <div style={{ flex: 1, overflow: 'auto', padding: 'clamp(12px, 2vw, 24px)', minWidth: 0 }}>
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}><Spinner /></div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

            {/* ── Seção 1: Receita assistida e contribuição ── */}
            <div>
              <SectionLabel>Receita e Contribuição no Pipeline</SectionLabel>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
                <KpiCard
                  label="Receita Orgânica"
                  value={fmtMoney(organico.receita)}
                  sub={`${days}d · ${organico.ganhos} vendas`}
                  color="#22C55E"
                  icon={TrendingUp}
                />
                <KpiCard
                  label="Receita Paga"
                  value={fmtMoney(pago.receita)}
                  sub={`${days}d · ${pago.ganhos} vendas`}
                  color="#6366F1"
                />
                <KpiCard
                  label="Contribuição Orgânico"
                  value={pct(kpis.contribOrg)}
                  sub={`${organico.ganhos} de ${kpis.totalGanhos} vendas totais`}
                  color="#22C55E"
                />
                <KpiCard
                  label="Receita Assistida"
                  value={fmtMoney(kpis.receitaAssistida)}
                  sub="orgânico + direto"
                  color="#B9915B"
                />
              </div>
            </div>

            {/* ── Seção 2: CAC e Deflexão de Verba ── */}
            <div>
              <SectionLabel>CAC e Deflexão de Verba Paga</SectionLabel>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
                <KpiCard
                  label="CAC Pago (por Lead)"
                  value={fmtMoney(kpis.cacPago)}
                  sub="gasto total ÷ leads pagos"
                  color="#6366F1"
                />
                <KpiCard
                  label="Receita / Lead Orgânico"
                  value={fmtMoney(kpis.receitaPorLeadOrg)}
                  sub="retorno por lead gerado"
                  color="#22C55E"
                />
                <KpiCard
                  label="Receita / Lead Pago"
                  value={fmtMoney(kpis.receitaPorLeadPago)}
                  sub="retorno por lead pago"
                  color="#6366F1"
                />
                <KpiCard
                  label="Deflexão de Verba"
                  value={fmtMoney(deflexaoVerba)}
                  sub={`${fmtNum(organico.mqls)} leads orgânicos × CAC pago`}
                  color="#F59E0B"
                  icon={Zap}
                />
              </div>
            </div>

            {/* ── Seção 3: Gráficos — tendência + velocidade ── */}
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 16 }}>

              {/* Tendência semanal: Leads por canal */}
              <Card>
                <CardHeader
                  title="MQLs por semana — Orgânico vs Pago vs Direto"
                  subtitle={`${days}d · tendência de geração de leads por canal`}
                />
                <CardBody style={{ paddingTop: 4 }}>
                  <ResponsiveContainer width="100%" height={220}>
                    <LineChart data={trendSeries} margin={{ top: 4, right: 12, left: -16, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                      <XAxis dataKey="semana" tick={{ fill: '#8A9BAA', fontSize: 10 }} axisLine={false} tickLine={false}
                        tickFormatter={v => v?.slice(5)} interval="preserveStartEnd" />
                      <YAxis tick={{ fill: '#8A9BAA', fontSize: 10 }} axisLine={false} tickLine={false} />
                      <Tooltip
                        content={({ active, payload, label }) => {
                          if (!active || !payload?.length) return null
                          return (
                            <div style={TT.contentStyle}>
                              <div style={{ fontWeight: 700, marginBottom: 4 }}>Semana {label}</div>
                              {payload.map(p => (
                                <div key={p.dataKey} style={{ color: p.color }}>
                                  {p.name}: {fmtNum(p.value)}
                                </div>
                              ))}
                            </div>
                          )
                        }}
                      />
                      <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
                      <Line dataKey="Orgânico_mqls" name="Orgânico" stroke={CANAL_COLOR['Orgânico']} strokeWidth={2} dot={false} />
                      <Line dataKey="Pago_mqls"     name="Pago"     stroke={CANAL_COLOR['Pago']}     strokeWidth={2} dot={false} />
                      <Line dataKey="Direto_mqls"   name="Direto"   stroke={CANAL_COLOR['Direto']}   strokeWidth={1.5} dot={false} strokeDasharray="4 2" />
                    </LineChart>
                  </ResponsiveContainer>
                </CardBody>
              </Card>

              {/* Velocidade de fechamento */}
              <Card>
                <CardHeader title="Aceleração de Funil" subtitle="Dias médios do MQL ao Ganho" />
                <CardBody style={{ paddingTop: 4 }}>
                  <ResponsiveContainer width="100%" height={160}>
                    <BarChart data={speedData} margin={{ top: 4, right: 12, left: -16, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                      <XAxis dataKey="canal" tick={{ fill: '#8A9BAA', fontSize: 11 }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fill: '#8A9BAA', fontSize: 10 }} axisLine={false} tickLine={false} />
                      <Tooltip
                        content={({ active, payload, label }) => {
                          if (!active || !payload?.length) return null
                          return (
                            <div style={TT.contentStyle}>
                              <div style={{ fontWeight: 700, marginBottom: 4 }}>{label}</div>
                              {payload.map(p => (
                                <div key={p.dataKey} style={{ color: p.color }}>
                                  {p.name}: {p.value?.toFixed(1)} dias
                                </div>
                              ))}
                            </div>
                          )
                        }}
                      />
                      <Bar dataKey="Dias médio" fill="#6366F1" radius={[4,4,0,0]} />
                      <Bar dataKey="Mediana" fill="#22C55E" radius={[4,4,0,0]} />
                    </BarChart>
                  </ResponsiveContainer>
                  <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {speed.map(s => {
                      const pagoSpeed = speed.find(x => x.canal === 'Pago')
                      const diff = pagoSpeed ? pagoSpeed.dias_medio - s.dias_medio : null
                      return (
                        <div key={s.canal} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                          <span style={{ color: CANAL_COLOR[s.canal] || '#8A9BAA', fontWeight: 700 }}>{s.canal}</span>
                          <span style={{ color: '#F5F4F3' }}>{fmtDays(s.dias_medio)} médio</span>
                          {s.canal !== 'Pago' && diff !== null && (
                            <span style={{ color: diff > 0 ? '#22C55E' : '#EF4444', fontSize: 11 }}>
                              {diff > 0 ? `${diff.toFixed(1)}d mais rápido` : `${Math.abs(diff).toFixed(1)}d mais lento`}
                            </span>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </CardBody>
              </Card>
            </div>

            {/* ── Seção 4: Receita orgânica semanal (área) ── */}
            <Card>
              <CardHeader
                title="Receita semanal — Orgânico vs Pago"
                subtitle="Comparação de receita gerada por canal ao longo do tempo"
              />
              <CardBody style={{ paddingTop: 4 }}>
                <ResponsiveContainer width="100%" height={200}>
                  <AreaChart data={trendSeries} margin={{ top: 4, right: 12, left: 8, bottom: 0 }}>
                    <defs>
                      <linearGradient id="gOrg" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#22C55E" stopOpacity={0.25} />
                        <stop offset="95%" stopColor="#22C55E" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="gPago" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#6366F1" stopOpacity={0.2} />
                        <stop offset="95%" stopColor="#6366F1" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                    <XAxis dataKey="semana" tick={{ fill: '#8A9BAA', fontSize: 10 }} axisLine={false} tickLine={false}
                      tickFormatter={v => v?.slice(5)} interval="preserveStartEnd" />
                    <YAxis tick={{ fill: '#8A9BAA', fontSize: 10 }} axisLine={false} tickLine={false}
                      tickFormatter={v => fmtMoney(v)} />
                    <Tooltip
                      content={({ active, payload, label }) => {
                        if (!active || !payload?.length) return null
                        return (
                          <div style={TT.contentStyle}>
                            <div style={{ fontWeight: 700, marginBottom: 4 }}>Semana {label}</div>
                            {payload.map(p => (
                              <div key={p.dataKey} style={{ color: p.color }}>
                                {p.name}: {fmtMoney(p.value)}
                              </div>
                            ))}
                          </div>
                        )
                      }}
                    />
                    <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
                    <Area type="monotone" dataKey="Orgânico_receita" name="Orgânico" stroke="#22C55E" fill="url(#gOrg)" strokeWidth={2} dot={false} />
                    <Area type="monotone" dataKey="Pago_receita"     name="Pago"     stroke="#6366F1" fill="url(#gPago)" strokeWidth={2} dot={false} />
                  </AreaChart>
                </ResponsiveContainer>
              </CardBody>
            </Card>

            {/* ── Seção 5: Funil por canal (comparação rápida) ── */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <Card>
                <CardHeader title="Comparação: Leads e Conversão" subtitle="Orgânico vs Pago" />
                <CardBody style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  <CompareBar
                    labelA={`Orgânico ${fmtNum(organico.mqls)} MQLs`}
                    valA={organico.mqls}
                    labelB={`Pago ${fmtNum(pago.mqls)} MQLs`}
                    valB={pago.mqls}
                    colorA={CANAL_COLOR['Orgânico']}
                    colorB={CANAL_COLOR['Pago']}
                    format="num"
                  />
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    {[
                      { label: 'Conv. Orgânico', val: pct(organico.conv_pct), color: '#22C55E' },
                      { label: 'Conv. Pago',     val: pct(pago.conv_pct),     color: '#6366F1' },
                      { label: 'Vendas Org.',    val: fmtNum(organico.ganhos), color: '#22C55E' },
                      { label: 'Vendas Pagas',   val: fmtNum(pago.ganhos),    color: '#6366F1' },
                    ].map(m => (
                      <div key={m.label} style={{ background: 'rgba(255,255,255,0.02)', borderRadius: 8, padding: '10px 14px' }}>
                        <div style={{ fontSize: 10, color: '#6B7280' }}>{m.label}</div>
                        <div style={{ fontSize: 16, fontWeight: 800, color: m.color, marginTop: 2 }}>{m.val}</div>
                      </div>
                    ))}
                  </div>
                </CardBody>
              </Card>

              <Card>
                <CardHeader title="Retorno por Lead" subtitle="Receita gerada / lead captado" />
                <CardBody>
                  <ResponsiveContainer width="100%" height={160}>
                    <BarChart
                      data={[
                        { canal: 'Orgânico', receita_lead: kpis.receitaPorLeadOrg || 0 },
                        { canal: 'Pago',     receita_lead: kpis.receitaPorLeadPago || 0 },
                        { canal: 'Direto',   receita_lead: kpis.direto?.mqls > 0 ? Math.round((kpis.direto?.receita || 0) / kpis.direto.mqls) : 0 },
                      ]}
                      margin={{ top: 4, right: 12, left: 8, bottom: 0 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                      <XAxis dataKey="canal" tick={{ fill: '#8A9BAA', fontSize: 11 }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fill: '#8A9BAA', fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={v => fmtMoney(v)} />
                      <Tooltip
                        content={({ active, payload }) => {
                          if (!active || !payload?.length) return null
                          const d = payload[0]?.payload
                          return (
                            <div style={TT.contentStyle}>
                              <div style={{ fontWeight: 700 }}>{d.canal}</div>
                              <div>Receita / Lead: {fmtMoney(d.receita_lead)}</div>
                            </div>
                          )
                        }}
                      />
                      <Bar dataKey="receita_lead" name="Receita/Lead" radius={[4,4,0,0]}>
                        {[CANAL_COLOR['Orgânico'], CANAL_COLOR['Pago'], CANAL_COLOR['Direto']].map((c, i) => (
                          <Cell key={i} fill={c} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                  <div style={{ marginTop: 10, padding: '8px 12px', background: 'rgba(34,197,94,0.06)', border: '1px solid rgba(34,197,94,0.15)', borderRadius: 6, fontSize: 11, color: '#22C55E' }}>
                    Orgânico gera <strong>{kpis.receitaPorLeadOrg && kpis.receitaPorLeadPago ? `${((kpis.receitaPorLeadOrg / kpis.receitaPorLeadPago) * 100 - 100).toFixed(0)}%` : '—'}</strong> mais receita por lead que o canal pago
                  </div>
                </CardBody>
              </Card>
            </div>

            {/* ── Seção 6: Fontes orgânicas detalhadas ── */}
            <Card>
              <CardHeader
                title="Fontes orgânicas — detalhamento"
                subtitle={`${sources.length} fontes · ${days}d · ordenado por receita`}
              />
              <CardBody style={{ padding: 0 }}>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid rgba(185,145,91,0.15)' }}>
                        {['Fonte','Medium','MQLs','% MQLs','Ganhos','Conv.','Receita','% Receita','Rec./Lead'].map(h => (
                          <th key={h} style={{
                            padding: '10px 14px',
                            textAlign: h === 'Fonte' || h === 'Medium' ? 'left' : 'right',
                            fontSize: 11, color: '#8A9BAA', fontWeight: 600, whiteSpace: 'nowrap',
                          }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {sources.map((s, i) => {
                        const pctMqls = totalMqls > 0 ? ((s.mqls / totalMqls) * 100).toFixed(1) : 0
                        const pctRec  = totalReceita > 0 ? ((s.receita / totalReceita) * 100).toFixed(1) : 0
                        const recLead = s.mqls > 0 ? Math.round(s.receita / s.mqls) : 0
                        return (
                          <tr key={i} style={{
                            borderBottom: '1px solid rgba(185,145,91,0.06)',
                            background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.01)',
                          }}>
                            <td style={{ padding: '9px 14px', fontWeight: 700, color: '#F5F4F3' }}>{s.fonte}</td>
                            <td style={{ padding: '9px 14px', color: '#9CA3AF', fontSize: 11 }}>{s.medium || '—'}</td>
                            <td style={{ padding: '9px 14px', textAlign: 'right', color: '#6366F1', fontWeight: 700 }}>{fmtNum(s.mqls)}</td>
                            <td style={{ padding: '9px 14px', textAlign: 'right', color: '#9CA3AF' }}>{pctMqls}%</td>
                            <td style={{ padding: '9px 14px', textAlign: 'right', color: '#F5F4F3', fontWeight: 700 }}>{fmtNum(s.ganhos)}</td>
                            <td style={{ padding: '9px 14px', textAlign: 'right' }}>
                              <span style={{
                                color: s.conv_pct >= 10 ? '#22C55E' : s.conv_pct >= 6 ? '#F59E0B' : '#EF4444',
                                fontWeight: 700,
                              }}>{pct(s.conv_pct)}</span>
                            </td>
                            <td style={{ padding: '9px 14px', textAlign: 'right', color: '#F5F4F3', fontWeight: 700 }}>{fmtMoney(s.receita)}</td>
                            <td style={{ padding: '9px 14px', textAlign: 'right' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'flex-end' }}>
                                <span style={{ color: '#B9915B' }}>{pctRec}%</span>
                                <div style={{ width: 36, height: 4, background: 'rgba(255,255,255,0.06)', borderRadius: 2 }}>
                                  <div style={{ width: `${pctRec}%`, height: '100%', background: '#B9915B', borderRadius: 2 }} />
                                </div>
                              </div>
                            </td>
                            <td style={{ padding: '9px 14px', textAlign: 'right', color: '#22C55E', fontWeight: 700 }}>{fmtMoney(recLead)}</td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </CardBody>
            </Card>

            {/* ── Seção 7: Nota metodológica ── */}
            <div style={{ fontSize: 11, color: '#6B7280', lineHeight: 1.6, padding: '12px 16px', background: 'rgba(255,255,255,0.02)', borderRadius: 8, border: '1px solid rgba(255,255,255,0.05)' }}>
              <strong style={{ color: '#8A9BAA' }}>Metodologia:</strong> Leads classificados como "Orgânico" quando <code>utm_medium ≠ 'cpc'</code> e <code>utm_source</code> não é nulo/direto.
              Deflexão de Verba = leads orgânicos × CAC pago (quanto custaria gerar esses leads via mídia paga).
              Aceleração de Funil = dias entre evento <code>mql</code> e evento <code>won</code> por canal de entrada.
              Receita Assistida inclui leads orgânicos + direto (sem UTM de mídia paga).
            </div>

          </div>
        )}
      </div>
    </div>
  )
}

// ─── Label de seção ───────────────────────────────────────────────────────────
function SectionLabel({ children }) {
  return (
    <div style={{
      fontSize: 11, fontWeight: 700, color: '#8A9BAA',
      textTransform: 'uppercase', letterSpacing: '0.08em',
      marginBottom: 10, paddingBottom: 6,
      borderBottom: '1px solid rgba(185,145,91,0.1)',
    }}>
      {children}
    </div>
  )
}
