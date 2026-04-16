import { useState, useEffect } from 'react'
import Header from '../components/layout/Header'
import Card, { CardHeader, CardBody } from '../components/ui/Card'
import Spinner from '../components/ui/Spinner'
import { api } from '../services/api'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, Legend, AreaChart, Area, Cell,
} from 'recharts'
import { TrendingUp, TrendingDown, Minus, Zap, Search, MousePointerClick, Eye, Target, PlugZap } from 'lucide-react'
import PeriodSelect from '../components/ui/PeriodSelect'
import { useNavigate } from 'react-router-dom'
import { fmtNum, fmtMoney, fmtPct, fmtDays } from '../utils/format'
import { TT } from '../components/ui/DarkTooltip'
import DataBadge from '../components/ui/DataBadge'

const CANAL_COLOR = {
  'Orgânico': '#22C55E',
  'Pago':     '#6366F1',
  'Direto':   '#B9915B',
}

const PERIOD_OPTIONS = [
  { label: '7d',   days: 7   },
  { label: '15d',  days: 15  },
  { label: '30d',  days: 30  },
  { label: '90d',  days: 90  },
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

// ─── Banner de fonte não conectada ────────────────────────────────────────────
function NotConnectedBanner({ source, description, settingsHash }) {
  const navigate = useNavigate()
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      gap: 12, padding: '32px 24px',
      background: 'rgba(185,145,91,0.03)',
      border: '1px dashed rgba(185,145,91,0.2)',
      borderRadius: 10,
    }}>
      <PlugZap size={28} color="rgba(185,145,91,0.4)" strokeWidth={1.5} />
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: '#8A9BAA', marginBottom: 4 }}>{source} não conectado</div>
        <div style={{ fontSize: 11, color: '#6B7280', maxWidth: 320 }}>{description}</div>
      </div>
      <button
        onClick={() => navigate('/settings')}
        style={{
          padding: '6px 16px',
          background: 'rgba(185,145,91,0.1)',
          border: '1px solid rgba(185,145,91,0.35)',
          borderRadius: 6,
          color: '#B9915B',
          fontSize: 11, fontWeight: 600,
          cursor: 'pointer',
          fontFamily: 'Manrope, sans-serif',
        }}
      >
        Configurar em Conexões →
      </button>
    </div>
  )
}

// ─── Página principal ─────────────────────────────────────────────────────────
export default function SEOPage() {
  const [days, setDays] = useState(30)
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [lastUpdated, setLastUpdated] = useState(null)
  const [firstClick, setFirstClick] = useState(null)

  // Search Console
  const [scData, setScData] = useState(null)
  const [scLoading, setScLoading] = useState(true)

  async function loadData() {
    setLoading(true)
    setScLoading(true)

    const [result, sc, fc] = await Promise.all([
      api.analyticsGetOrganic(days),
      api.scPerformance(Math.min(days, 90)),
      api.databricksFunnelFirstClick(days),
    ])

    setData(result)
    setLoading(false)
    setFirstClick(fc)
    setScData(sc)
    setScLoading(false)
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
            <PeriodSelect value={days} onChange={setDays} options={PERIOD_OPTIONS} />
            <DataBadge data={data} />
            {scData && <DataBadge data={scData} />}
          </div>
        }
      />

      <div style={{ flex: 1, overflow: 'auto', padding: 'clamp(12px, 2vw, 24px)', minWidth: 0 }}>
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}><Spinner /></div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

            {/* ── Seções CRM (Databricks) — só quando conectado ── */}
            {data?.mock ? (
              <NotConnectedBanner
                source="Databricks"
                description="Conecte o Databricks para ver receita orgânica, CAC, deflexão de verba e análise de funil por canal."
              />
            ) : <>

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
                  value={fmtPct(kpis.contribOrg)}
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

            {/* ── Seção First Click: MQL→SAL→WON por canal ── */}
            {firstClick && !firstClick.mock && (firstClick.canais || []).length > 0 && (() => {
              const canais = firstClick.canais
              const CANAL_COLOR_MAP = { Organico: '#22C55E', Pago: '#6366F1', Direto: '#B9915B' }
              const CANAL_LABEL = { Organico: 'Orgânico', Pago: 'Pago', Direto: 'Direto' }

              // Destaca alerta quando SAL→WON do orgânico é < 50% do SAL→WON do pago
              const org  = canais.find(c => c.canal === 'Organico')
              const pago = canais.find(c => c.canal === 'Pago')
              const hasAlert = org && pago && org.sal_won_pct < pago.sal_won_pct * 0.7

              return (
                <div>
                  <SectionLabel>Atribuição por Primeiro Clique — Funil MQL → SAL → WON</SectionLabel>

                  {hasAlert && (
                    <div style={{ marginBottom: 12, padding: '10px 16px', background: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 8, display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{ fontSize: 18 }}>⚠</span>
                      <div style={{ fontSize: 12, color: '#FCA5A5', lineHeight: 1.5 }}>
                        <strong>Possível baixa priorização comercial do orgânico:</strong> leads orgânicos têm SAL→WON de <strong>{org.sal_won_pct}%</strong> vs <strong>{pago.sal_won_pct}%</strong> do pago — {Math.round(pago.sal_won_pct / org.sal_won_pct * 10) / 10}× menor. O volume orgânico chega ao SAL mas não converte para WON.
                      </div>
                    </div>
                  )}

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
                    {canais.map(c => {
                      const color = CANAL_COLOR_MAP[c.canal] || '#8A9BAA'
                      const label = CANAL_LABEL[c.canal] || c.canal
                      const salWonAlert = pago && c.canal !== 'Pago' && c.sal_won_pct < pago.sal_won_pct * 0.7

                      return (
                        <Card key={c.canal}>
                          <CardBody style={{ padding: '16px 18px' }}>
                            {/* Header do canal */}
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                              <span style={{ fontSize: 13, fontWeight: 800, color }}>{label}</span>
                              <span style={{ fontSize: 11, color: '#6B7280' }}>{days}d · first click</span>
                            </div>

                            {/* Funil visual MQL → SAL → WON */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 14 }}>
                              {[
                                { label: 'MQL', value: c.total_mql, pct: 100, color: color + 'CC' },
                                { label: 'SAL', value: c.total_sal, pct: c.mql_sal_pct, color: color + '99' },
                                { label: 'WON', value: c.total_won, pct: c.mql_won_pct, color: color + '66' },
                              ].map((step, i) => (
                                <div key={step.label}>
                                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                                    <span style={{ fontSize: 11, color: '#8A9BAA', fontWeight: 600 }}>{step.label}</span>
                                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                                      <span style={{ fontSize: 12, fontWeight: 700, color: '#F5F4F3' }}>{step.value.toLocaleString('pt-BR')}</span>
                                      {i > 0 && <span style={{ fontSize: 10, color: '#6B7280' }}>{step.pct}%</span>}
                                    </div>
                                  </div>
                                  <div style={{ height: 6, background: 'rgba(255,255,255,0.06)', borderRadius: 3, overflow: 'hidden' }}>
                                    <div style={{ width: `${step.pct}%`, height: '100%', background: step.color, borderRadius: 3, transition: 'width 0.6s ease' }} />
                                  </div>
                                </div>
                              ))}
                            </div>

                            {/* Taxas de conversão */}
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: 12 }}>
                              <div style={{ textAlign: 'center' }}>
                                <div style={{ fontSize: 16, fontWeight: 800, color }}>{c.mql_sal_pct}%</div>
                                <div style={{ fontSize: 9, color: '#6B7280', marginTop: 2 }}>MQL → SAL</div>
                              </div>
                              <div style={{ textAlign: 'center', position: 'relative' }}>
                                <div style={{ fontSize: 16, fontWeight: 800, color: salWonAlert ? '#EF4444' : color }}>
                                  {c.sal_won_pct}%
                                </div>
                                <div style={{ fontSize: 9, color: '#6B7280', marginTop: 2 }}>SAL → WON</div>
                                {salWonAlert && (
                                  <div style={{ fontSize: 9, color: '#EF4444', marginTop: 1, fontWeight: 700 }}>⚠ baixo</div>
                                )}
                              </div>
                            </div>
                          </CardBody>
                        </Card>
                      )
                    })}
                  </div>
                </div>
              )
            })()}

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
                        cursor={TT.cursorLine}
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
                        cursor={TT.cursorBar}
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
                  <AreaChart data={trendSeries} margin={{ top: 4, right: 12, left: 8, bottom: 0 }} style={{ cursor: 'crosshair' }}>
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
                      cursor={TT.cursorLine}
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
                      { label: 'Conv. Orgânico', val: fmtPct(organico.conv_pct), color: '#22C55E' },
                      { label: 'Conv. Pago',     val: fmtPct(pago.conv_pct),     color: '#6366F1' },
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
                        cursor={TT.cursorBar}
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

            </> /* fim bloco CRM */}

            {/* ── Seções GSC — só quando conectado ── */}
            {(!scLoading && scData?.mock) && (
              <NotConnectedBanner
                source="Search Console"
                description="Conecte o Google Search Console para ver cliques orgânicos, impressões, CTR, posição média e top queries."
              />
            )}

            {/* ── Seção GSC 1: KPIs Search Console ── */}
            {!scData?.mock && <div>
              <SectionLabel>Search Console — Visibilidade Orgânica</SectionLabel>
              {scLoading ? (
                <div style={{ display: 'flex', justifyContent: 'center', padding: 24 }}><Spinner /></div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
                  <KpiCard
                    label="Cliques orgânicos"
                    value={fmtNum(scData?.totals?.clicks)}
                    sub={`${days}d · Google Search`}
                    color="#4285F4"
                    icon={MousePointerClick}
                  />
                  <KpiCard
                    label="Impressões"
                    value={fmtNum(scData?.totals?.impressions)}
                    sub="aparições nos resultados"
                    color="#8A9BAA"
                    icon={Eye}
                  />
                  <KpiCard
                    label="CTR médio"
                    value={scData?.totals?.ctr != null ? `${scData.totals.ctr}%` : '—'}
                    sub="cliques ÷ impressões"
                    color={scData?.totals?.ctr >= 5 ? '#22C55E' : scData?.totals?.ctr >= 2 ? '#F59E0B' : '#EF4444'}
                    icon={Target}
                  />
                  <KpiCard
                    label="Posição média"
                    value={scData?.totals?.position != null ? `#${scData.totals.position}` : '—'}
                    sub="ranking médio no Google"
                    color={scData?.totals?.position <= 5 ? '#22C55E' : scData?.totals?.position <= 15 ? '#F59E0B' : '#EF4444'}
                    icon={Search}
                  />
                </div>
              )}
            </div>}

            {/* ── Seção GSC 2: Tendência cliques + Top Queries ── */}
            {!scLoading && !scData?.mock && (
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 16, alignItems: 'stretch' }}>

                {/* Tendência diária de cliques */}
                <Card style={{ display: 'flex', flexDirection: 'column' }}>
                  <CardHeader
                    title="Cliques e Impressões — Tendência diária"
                    subtitle={`${days}d · Google Search Console`}
                  />
                  <CardBody style={{ paddingTop: 4, flex: 1, display: 'flex', flexDirection: 'column' }}>
                    <ResponsiveContainer width="100%" height={300}>
                      <AreaChart data={scData?.trend ?? []} margin={{ top: 4, right: 12, left: -8, bottom: 0 }}>
                        <defs>
                          <linearGradient id="gClicks" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%"  stopColor="#4285F4" stopOpacity={0.3} />
                            <stop offset="95%" stopColor="#4285F4" stopOpacity={0} />
                          </linearGradient>
                          <linearGradient id="gImpr" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%"  stopColor="#8A9BAA" stopOpacity={0.15} />
                            <stop offset="95%" stopColor="#8A9BAA" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                        <XAxis
                          dataKey="date"
                          tick={{ fill: '#8A9BAA', fontSize: 10 }}
                          axisLine={false} tickLine={false}
                          tickFormatter={v => v?.slice(5)}
                          interval="preserveStartEnd"
                        />
                        <YAxis yAxisId="left"  tick={{ fill: '#8A9BAA', fontSize: 10 }} axisLine={false} tickLine={false} />
                        <YAxis yAxisId="right" orientation="right" tick={{ fill: '#8A9BAA', fontSize: 10 }} axisLine={false} tickLine={false}
                          tickFormatter={v => fmtNum(v)} />
                        <Tooltip
                          cursor={TT.cursorLine}
                          content={({ active, payload, label }) => {
                            if (!active || !payload?.length) return null
                            return (
                              <div style={TT.contentStyle}>
                                <div style={{ fontWeight: 700, marginBottom: 4 }}>{label}</div>
                                {payload.map(p => (
                                  <div key={p.dataKey} style={{ color: p.color }}>
                                    {p.name}: {p.name === 'CTR' ? `${p.value}%` : fmtNum(p.value)}
                                  </div>
                                ))}
                              </div>
                            )
                          }}
                        />
                        <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
                        <Area yAxisId="left"  type="monotone" dataKey="clicks"      name="Cliques"    stroke="#4285F4" fill="url(#gClicks)" strokeWidth={2} dot={false} />
                        <Area yAxisId="right" type="monotone" dataKey="impressions" name="Impressões" stroke="#8A9BAA" fill="url(#gImpr)"   strokeWidth={1.5} dot={false} strokeDasharray="4 2" />
                      </AreaChart>
                    </ResponsiveContainer>
                  </CardBody>
                </Card>

                {/* Top Queries */}
                <Card style={{ display: 'flex', flexDirection: 'column' }}>
                  <CardHeader title="Top Queries" subtitle="por cliques · últimos 90d" />
                  <CardBody style={{ padding: 0, flex: 1, overflow: 'auto' }}>
                    <div style={{ overflowX: 'auto' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
                        <thead>
                          <tr style={{ borderBottom: '1px solid rgba(185,145,91,0.12)' }}>
                            {['Query', 'Cliques', 'CTR', 'Pos.'].map(h => (
                              <th key={h} style={{
                                padding: '8px 12px',
                                textAlign: h === 'Query' ? 'left' : 'right',
                                fontSize: 10, color: '#8A9BAA', fontWeight: 600,
                              }}>{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {(scData?.queries ?? []).map((q, i) => (
                            <tr key={i} style={{
                              borderBottom: '1px solid rgba(185,145,91,0.05)',
                              background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.01)',
                            }}>
                              <td style={{ padding: '7px 12px', color: '#F5F4F3', maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {q.query}
                              </td>
                              <td style={{ padding: '7px 12px', textAlign: 'right', color: '#4285F4', fontWeight: 700 }}>{fmtNum(q.clicks)}</td>
                              <td style={{ padding: '7px 12px', textAlign: 'right', color: q.ctr >= 5 ? '#22C55E' : q.ctr >= 2 ? '#F59E0B' : '#EF4444', fontWeight: 600 }}>{q.ctr}%</td>
                              <td style={{ padding: '7px 12px', textAlign: 'right', color: '#9CA3AF' }}>#{q.position}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </CardBody>
                </Card>
              </div>
            )}

            {/* ── Seção GSC 3: Top Páginas ── */}
            {!scLoading && !scData?.mock && (scData?.pages?.length ?? 0) > 0 && (
              <Card>
                <CardHeader
                  title="Top Páginas — Search Console"
                  subtitle="Páginas com mais cliques orgânicos · ordenado por cliques"
                />
                <CardBody style={{ padding: 0 }}>
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                      <thead>
                        <tr style={{ borderBottom: '1px solid rgba(185,145,91,0.15)' }}>
                          {['Página', 'Cliques', 'Impressões', 'CTR', 'Posição'].map(h => (
                            <th key={h} style={{
                              padding: '10px 14px',
                              textAlign: h === 'Página' ? 'left' : 'right',
                              fontSize: 11, color: '#8A9BAA', fontWeight: 600,
                            }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {(scData?.pages ?? []).map((p, i) => {
                          const pagePath = p.page.replace(/^https?:\/\/[^/]+/, '') || '/'
                          return (
                            <tr key={i} style={{
                              borderBottom: '1px solid rgba(185,145,91,0.06)',
                              background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.01)',
                            }}>
                              <td style={{ padding: '9px 14px', color: '#F5F4F3', maxWidth: 280, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                <span style={{ color: '#8A9BAA', fontSize: 10 }}>{pagePath}</span>
                              </td>
                              <td style={{ padding: '9px 14px', textAlign: 'right', color: '#4285F4', fontWeight: 700 }}>{fmtNum(p.clicks)}</td>
                              <td style={{ padding: '9px 14px', textAlign: 'right', color: '#9CA3AF' }}>{fmtNum(p.impressions)}</td>
                              <td style={{ padding: '9px 14px', textAlign: 'right', color: p.ctr >= 5 ? '#22C55E' : p.ctr >= 2 ? '#F59E0B' : '#EF4444', fontWeight: 600 }}>{p.ctr}%</td>
                              <td style={{ padding: '9px 14px', textAlign: 'right' }}>
                                <span style={{
                                  color: p.position <= 3 ? '#22C55E' : p.position <= 10 ? '#F59E0B' : '#9CA3AF',
                                  fontWeight: 700,
                                }}>#{p.position}</span>
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                </CardBody>
              </Card>
            )}

            {/* ── Seção GSC 4: Rankings de palavras-chave ── */}
            {!scLoading && !scData?.mock && (scData?.queries?.length ?? 0) > 0 && (() => {
              const queries = scData.queries || []

              // Melhores: posição ≤ 10, CTR alto, pelo menos 10 cliques
              const melhores = queries
                .filter(q => q.position <= 10 && q.clicks >= 10)
                .sort((a, b) => b.ctr - a.ctr)
                .slice(0, 10)

              // Oportunidades: posição 11-40, impressões altas, CTR baixo (< 5%)
              const oportunidades = queries
                .filter(q => q.position > 10 && q.position <= 40 && q.impressions >= 100 && q.ctr < 5)
                .sort((a, b) => b.impressions - a.impressions)
                .slice(0, 10)

              // Piores: score de pior desempenho = posição alta (ruim) + CTR baixíssimo + pelo menos 50 impressões
              // score = posição × (1 / (ctr + 0.1)) — quanto maior, pior
              const piores = queries
                .filter(q => q.impressions >= 50)
                .map(q => ({ ...q, score: q.position * (1 / (q.ctr + 0.1)) }))
                .sort((a, b) => b.score - a.score)
                .slice(0, 15)

              return (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>

                  {/* Ranking: Melhores */}
                  <Card>
                    <CardHeader
                      title="Melhores palavras-chave"
                      subtitle="Posição ≤ 10 · ordenado por CTR"
                      action={
                        <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 10, background: 'rgba(34,197,94,0.1)', color: '#22C55E', fontWeight: 700 }}>
                          {melhores.length} queries
                        </span>
                      }
                    />
                    <CardBody style={{ padding: 0 }}>
                      {melhores.length === 0 ? (
                        <div style={{ padding: '16px', fontSize: 12, color: '#6B7280', textAlign: 'center' }}>Sem dados suficientes</div>
                      ) : (
                        <div>
                          {melhores.map((q, i) => {
                            const barW = Math.round((q.ctr / Math.max(...melhores.map(x => x.ctr), 1)) * 100)
                            const posColor = q.position <= 3 ? '#22C55E' : q.position <= 5 ? '#84CC16' : '#F59E0B'
                            return (
                              <div key={i} style={{
                                display: 'grid', gridTemplateColumns: '20px 1fr 52px 44px',
                                gap: 10, alignItems: 'center',
                                padding: '9px 14px',
                                borderBottom: i < melhores.length - 1 ? '1px solid rgba(185,145,91,0.06)' : 'none',
                                background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.01)',
                              }}>
                                {/* Rank */}
                                <div style={{ fontSize: 10, color: '#6B7280', fontWeight: 700, textAlign: 'center' }}>{i + 1}</div>

                                {/* Query + barra */}
                                <div>
                                  <div style={{ fontSize: 12, color: '#F5F4F3', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: 3 }}>
                                    {q.query}
                                  </div>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                    <div style={{ flex: 1, height: 3, background: 'rgba(255,255,255,0.06)', borderRadius: 2 }}>
                                      <div style={{ width: `${barW}%`, height: '100%', background: '#22C55E', borderRadius: 2 }} />
                                    </div>
                                    <span style={{ fontSize: 10, color: '#6B7280', whiteSpace: 'nowrap' }}>{fmtNum(q.impressions)} imp</span>
                                  </div>
                                </div>

                                {/* CTR */}
                                <div style={{ textAlign: 'right' }}>
                                  <div style={{ fontSize: 13, fontWeight: 800, color: '#22C55E' }}>{q.ctr}%</div>
                                  <div style={{ fontSize: 9, color: '#6B7280' }}>CTR</div>
                                </div>

                                {/* Posição */}
                                <div style={{ textAlign: 'right' }}>
                                  <div style={{ fontSize: 12, fontWeight: 700, color: posColor }}>#{q.position}</div>
                                  <div style={{ fontSize: 9, color: '#6B7280' }}>{fmtNum(q.clicks)} cli</div>
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      )}
                    </CardBody>
                  </Card>

                  {/* Ranking: Oportunidades */}
                  <Card>
                    <CardHeader
                      title="Oportunidades de melhoria"
                      subtitle="Pos. 11–40 · alto volume · CTR baixo"
                      action={
                        <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 10, background: 'rgba(245,158,11,0.1)', color: '#F59E0B', fontWeight: 700 }}>
                          {oportunidades.length} queries
                        </span>
                      }
                    />
                    <CardBody style={{ padding: 0 }}>
                      {oportunidades.length === 0 ? (
                        <div style={{ padding: '16px', fontSize: 12, color: '#6B7280', textAlign: 'center' }}>Sem oportunidades identificadas</div>
                      ) : (
                        <div>
                          {oportunidades.map((q, i) => {
                            const barW = Math.round((q.impressions / Math.max(...oportunidades.map(x => x.impressions), 1)) * 100)
                            const posColor = q.position <= 20 ? '#F59E0B' : '#EF4444'
                            // Potencial: se subir p/ posição 3, CTR esperado ~15%
                            const potClicks = Math.round(q.impressions * 0.15)
                            const gapClicks = potClicks - q.clicks
                            return (
                              <div key={i} style={{
                                display: 'grid', gridTemplateColumns: '20px 1fr 52px 44px',
                                gap: 10, alignItems: 'center',
                                padding: '9px 14px',
                                borderBottom: i < oportunidades.length - 1 ? '1px solid rgba(185,145,91,0.06)' : 'none',
                                background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.01)',
                              }}>
                                {/* Rank */}
                                <div style={{ fontSize: 10, color: '#6B7280', fontWeight: 700, textAlign: 'center' }}>{i + 1}</div>

                                {/* Query + barra */}
                                <div>
                                  <div style={{ fontSize: 12, color: '#F5F4F3', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: 3 }}>
                                    {q.query}
                                  </div>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                    <div style={{ flex: 1, height: 3, background: 'rgba(255,255,255,0.06)', borderRadius: 2 }}>
                                      <div style={{ width: `${barW}%`, height: '100%', background: '#F59E0B', borderRadius: 2 }} />
                                    </div>
                                    <span style={{ fontSize: 10, color: '#6B7280', whiteSpace: 'nowrap' }}>+{fmtNum(gapClicks)} pot.</span>
                                  </div>
                                </div>

                                {/* CTR */}
                                <div style={{ textAlign: 'right' }}>
                                  <div style={{ fontSize: 13, fontWeight: 800, color: '#EF4444' }}>{q.ctr}%</div>
                                  <div style={{ fontSize: 9, color: '#6B7280' }}>CTR</div>
                                </div>

                                {/* Posição */}
                                <div style={{ textAlign: 'right' }}>
                                  <div style={{ fontSize: 12, fontWeight: 700, color: posColor }}>#{q.position}</div>
                                  <div style={{ fontSize: 9, color: '#6B7280' }}>{fmtNum(q.impressions)} imp</div>
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      )}
                    </CardBody>
                  </Card>

                </div>

                  {/* Ranking: Piores */}
                  <Card>
                    <CardHeader
                      title="Piores palavras-chave"
                      subtitle="Score de pior desempenho: posição ruim × CTR baixo · do pior ao menos pior"
                      action={
                        <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 10, background: 'rgba(239,68,68,0.1)', color: '#EF4444', fontWeight: 700 }}>
                          {piores.length} queries
                        </span>
                      }
                    />
                    <CardBody style={{ padding: 0 }}>
                      {piores.length === 0 ? (
                        <div style={{ padding: '16px', fontSize: 12, color: '#6B7280', textAlign: 'center' }}>Sem dados suficientes</div>
                      ) : (
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 0 }}>
                          {piores.map((q, i) => {
                            const isWorst = i === 0
                            const posColor = q.position > 50 ? '#EF4444' : q.position > 30 ? '#F97316' : '#F59E0B'
                            const ctrColor = q.ctr < 0.5 ? '#EF4444' : q.ctr < 2 ? '#F97316' : '#F59E0B'
                            const isLastRow = i >= piores.length - (piores.length % 2 === 0 ? 2 : 1)
                            const isRightCol = i % 2 === 1
                            return (
                              <div key={i} style={{
                                display: 'grid', gridTemplateColumns: '20px 1fr 48px 44px',
                                gap: 8, alignItems: 'center',
                                padding: '9px 14px',
                                borderBottom: !isLastRow || !isRightCol ? '1px solid rgba(185,145,91,0.06)' : 'none',
                                borderRight: !isRightCol ? '1px solid rgba(185,145,91,0.06)' : 'none',
                                background: isWorst ? 'rgba(239,68,68,0.04)' : 'transparent',
                              }}>
                                {/* Rank */}
                                <div style={{ fontSize: 10, color: isWorst ? '#EF4444' : '#6B7280', fontWeight: 700, textAlign: 'center' }}>
                                  {isWorst ? '⚠' : i + 1}
                                </div>

                                {/* Query */}
                                <div style={{ minWidth: 0 }}>
                                  <div style={{ fontSize: 11, color: '#F5F4F3', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: 2 }}>
                                    {q.query}
                                  </div>
                                  <div style={{ fontSize: 9, color: '#6B7280' }}>{fmtNum(q.impressions)} imp</div>
                                </div>

                                {/* CTR */}
                                <div style={{ textAlign: 'right' }}>
                                  <div style={{ fontSize: 12, fontWeight: 800, color: ctrColor }}>{q.ctr}%</div>
                                  <div style={{ fontSize: 9, color: '#6B7280' }}>CTR</div>
                                </div>

                                {/* Posição */}
                                <div style={{ textAlign: 'right' }}>
                                  <div style={{ fontSize: 11, fontWeight: 700, color: posColor }}>#{q.position}</div>
                                  <div style={{ fontSize: 9, color: '#6B7280' }}>{fmtNum(q.clicks)} cli</div>
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      )}
                      <div style={{ padding: '8px 14px 12px', borderTop: '1px solid rgba(185,145,91,0.06)', fontSize: 10, color: '#6B7280' }}>
                        Score = posição × (1 ÷ CTR) — quanto maior, pior. Priorize conteúdo ou meta tags para as primeiras da lista.
                      </div>
                    </CardBody>
                  </Card>

                </div>
              )
            })()}

            {/* ── Seção 6: Fontes orgânicas — por grupo ── */}
            {sources.length > 0 && (() => {
              // Classificação por grupo
              const GRUPO_CONFIG = {
                'Social':        { fontes: ['instagram','facebook','youtube','tiktok','linkedin','twitter','kwai'], color: '#A78BFA', icon: '📱' },
                'CRM/Outbound':  { fontes: ['hubspot','prospeccao','whatsapp','rdstation','rd_station','email','crm'], color: '#38BDF8', icon: '💬' },
                'Produto/Evento':{ fontes: ['produto','presencial','evento','qrcode','sprints','imersoes','imersão','imersao'], color: '#FB923C', icon: '🎯' },
                'Direto':        { fontes: ['(direto)','direct','direto','desconhecido'], color: '#8A9BAA', icon: '—' },
              }

              function getGrupo(fonte, medium) {
                const f = (fonte || '').toLowerCase()
                const m = (medium || '').toLowerCase()
                // Presencial tem medium como número ou 'presencial'
                if (f === 'presencial' || f === 'evento' || m === 'qrcode') return 'Produto/Evento'
                if (f === 'produto' || m === 'imersoes' || m === 'sprints' || m === 'imersões' || m === 'imersao') return 'Produto/Evento'
                for (const [grupo, cfg] of Object.entries(GRUPO_CONFIG)) {
                  if (cfg.fontes.some(kw => f.includes(kw) || m.includes(kw))) return grupo
                }
                return 'Outros'
              }

              // Agrupa fontes
              const grupos = {}
              sources.forEach(s => {
                const g = getGrupo(s.fonte, s.medium)
                if (!grupos[g]) grupos[g] = { mqls: 0, ganhos: 0, receita: 0, fontes: [] }
                grupos[g].mqls    += s.mqls
                grupos[g].ganhos  += s.ganhos
                grupos[g].receita += s.receita
                grupos[g].fontes.push(s)
              })
              Object.values(grupos).forEach(g => {
                g.conv_pct = g.mqls > 0 ? parseFloat(((g.ganhos / g.mqls) * 100).toFixed(1)) : 0
                g.fontes.sort((a, b) => b.receita - a.receita)
              })

              const gruposSorted = Object.entries(grupos).sort((a, b) => b[1].receita - a[1].receita)

              return (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <SectionLabel>Fontes Orgânicas — Visão por Grupo</SectionLabel>

                  {/* Cards resumo por grupo */}
                  <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.min(gruposSorted.length, 4)}, 1fr)`, gap: 12 }}>
                    {gruposSorted.map(([nome, g]) => {
                      const cfg = GRUPO_CONFIG[nome] || { color: '#8A9BAA', icon: '•' }
                      const pctRec = totalReceita > 0 ? ((g.receita / totalReceita) * 100).toFixed(1) : 0
                      return (
                        <Card key={nome}>
                          <CardBody style={{ padding: '14px 16px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                              <span style={{ fontSize: 16 }}>{cfg.icon}</span>
                              <span style={{ fontSize: 12, fontWeight: 800, color: cfg.color }}>{nome}</span>
                              <span style={{ marginLeft: 'auto', fontSize: 10, color: '#6B7280' }}>{g.fontes.length} fonte{g.fontes.length !== 1 ? 's' : ''}</span>
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                              <div>
                                <div style={{ fontSize: 15, fontWeight: 800, color: '#6366F1' }}>{fmtNum(g.mqls)}</div>
                                <div style={{ fontSize: 9, color: '#6B7280', marginTop: 1 }}>MQLs</div>
                              </div>
                              <div>
                                <div style={{ fontSize: 15, fontWeight: 800, color: '#F5F4F3' }}>{fmtMoney(g.receita)}</div>
                                <div style={{ fontSize: 9, color: '#6B7280', marginTop: 1 }}>{pctRec}% da receita</div>
                              </div>
                            </div>
                            <div style={{ marginTop: 8 }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                                <span style={{ fontSize: 9, color: '#6B7280' }}>participação na receita</span>
                                <span style={{ fontSize: 10, fontWeight: 700, color: g.conv_pct >= 10 ? '#22C55E' : g.conv_pct >= 6 ? '#F59E0B' : '#EF4444' }}>{g.conv_pct}% conv.</span>
                              </div>
                              <div style={{ height: 4, background: 'rgba(255,255,255,0.06)', borderRadius: 2 }}>
                                <div style={{ width: `${Math.min(parseFloat(pctRec), 100)}%`, height: '100%', background: cfg.color, borderRadius: 2, transition: 'width 0.5s' }} />
                              </div>
                            </div>
                          </CardBody>
                        </Card>
                      )
                    })}
                  </div>

                  {/* Tabela com separadores por grupo */}
                  <Card>
                    <CardHeader
                      title="Detalhamento por grupo"
                      subtitle={`${sources.length} fontes · ${days}d · ordenado por receita dentro de cada grupo`}
                    />
                    <CardBody style={{ padding: 0 }}>
                      <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                          <thead>
                            <tr style={{ borderBottom: '1px solid rgba(185,145,91,0.15)' }}>
                              {['Grupo','Fonte','Medium','MQLs','% MQLs','Ganhos','Conv.','Receita','% Receita','Rec./Lead'].map(h => (
                                <th key={h} style={{
                                  padding: '10px 14px',
                                  textAlign: ['Grupo','Fonte','Medium'].includes(h) ? 'left' : 'right',
                                  fontSize: 11, color: '#8A9BAA', fontWeight: 600, whiteSpace: 'nowrap',
                                }}>{h}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {gruposSorted.map(([nome, g]) => {
                              const cfg = GRUPO_CONFIG[nome] || { color: '#8A9BAA', icon: '•' }
                              return g.fontes.map((s, si) => {
                                const pctMqls = totalMqls > 0 ? ((s.mqls / totalMqls) * 100).toFixed(1) : 0
                                const pctRec  = totalReceita > 0 ? ((s.receita / totalReceita) * 100).toFixed(1) : 0
                                const recLead = s.mqls > 0 ? Math.round(s.receita / s.mqls) : 0
                                const isFirstInGroup = si === 0
                                return (
                                  <tr key={`${nome}-${si}`} style={{
                                    borderBottom: '1px solid rgba(185,145,91,0.06)',
                                    background: si % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.01)',
                                  }}>
                                    {/* Grupo — só mostra na primeira linha do grupo */}
                                    <td style={{ padding: '9px 14px', whiteSpace: 'nowrap' }}>
                                      {isFirstInGroup ? (
                                        <span style={{
                                          fontSize: 10, fontWeight: 700, color: cfg.color,
                                          background: `${cfg.color}18`,
                                          padding: '2px 8px', borderRadius: 10,
                                        }}>{cfg.icon} {nome}</span>
                                      ) : (
                                        <span style={{ display: 'inline-block', width: 4, height: 4, borderRadius: '50%', background: 'rgba(185,145,91,0.2)', marginLeft: 14 }} />
                                      )}
                                    </td>
                                    <td style={{ padding: '9px 14px', fontWeight: 700, color: '#F5F4F3' }}>{s.fonte}</td>
                                    <td style={{ padding: '9px 14px', color: '#9CA3AF', fontSize: 11 }}>{s.medium || '—'}</td>
                                    <td style={{ padding: '9px 14px', textAlign: 'right', color: '#6366F1', fontWeight: 700 }}>{fmtNum(s.mqls)}</td>
                                    <td style={{ padding: '9px 14px', textAlign: 'right', color: '#9CA3AF' }}>{pctMqls}%</td>
                                    <td style={{ padding: '9px 14px', textAlign: 'right', color: '#F5F4F3', fontWeight: 700 }}>{fmtNum(s.ganhos)}</td>
                                    <td style={{ padding: '9px 14px', textAlign: 'right' }}>
                                      <span style={{
                                        color: s.conv_pct >= 10 ? '#22C55E' : s.conv_pct >= 6 ? '#F59E0B' : '#EF4444',
                                        fontWeight: 700,
                                      }}>{fmtPct(s.conv_pct)}</span>
                                    </td>
                                    <td style={{ padding: '9px 14px', textAlign: 'right', color: '#F5F4F3', fontWeight: 700 }}>{fmtMoney(s.receita)}</td>
                                    <td style={{ padding: '9px 14px', textAlign: 'right' }}>
                                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'flex-end' }}>
                                        <span style={{ color: '#B9915B' }}>{pctRec}%</span>
                                        <div style={{ width: 36, height: 4, background: 'rgba(255,255,255,0.06)', borderRadius: 2 }}>
                                          <div style={{ width: `${Math.min(parseFloat(pctRec) * 5, 100)}%`, height: '100%', background: '#B9915B', borderRadius: 2 }} />
                                        </div>
                                      </div>
                                    </td>
                                    <td style={{ padding: '9px 14px', textAlign: 'right', color: '#22C55E', fontWeight: 700 }}>{fmtMoney(recLead)}</td>
                                  </tr>
                                )
                              })
                            })}
                          </tbody>
                        </table>
                      </div>
                    </CardBody>
                  </Card>
                </div>
              )
            })()}

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
