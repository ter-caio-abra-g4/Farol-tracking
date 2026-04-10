import { useState, useEffect } from 'react'
import Header from '../components/layout/Header'
import Card, { CardHeader, CardBody } from '../components/ui/Card'
import Spinner from '../components/ui/Spinner'
import { api } from '../services/api'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  Cell, Legend, RadarChart, Radar, PolarGrid, PolarAngleAxis,
} from 'recharts'
import { DollarSign, Target, Users, TrendingUp, Zap, FileText } from 'lucide-react'

// ─── Paleta ──────────────────────────────────────────────────────────────────
const CANAL_COLORS = {
  Paid:      '#6366F1',
  Social:    '#EC4899',
  CRM:       '#F59E0B',
  'Orgânico':'#22C55E',
  Outros:    '#6B7280',
}
const META_COLOR   = '#3B82F6'
const GOOGLE_COLOR = '#F59E0B'
const PLATFORM_COLORS = { Meta: META_COLOR, Google: GOOGLE_COLOR }

function fmtMoney(v) {
  if (!v) return 'R$ 0'
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
function pct(a, b) {
  if (!b) return '—'
  return `${((a / b) * 100).toFixed(1)}%`
}

// Abreviação para badge — máx 4 chars, priorizando siglas conhecidas
const PERFIL_BADGE = {
  'Compra Direta': 'CD',
  'Inside Sales':  'IS',
  'Field Sales':   'FS',
  'CS / Base':     'CS',
  'G4 Skills':     'SKL',
  'Renovação':     'REN',
  'Comercial':     'COM',
  'Outros':        '?',
}
function perfilBadge(label) {
  if (!label) return '?'
  if (PERFIL_BADGE[label]) return PERFIL_BADGE[label]
  // Perfil ICP letra única (A, B, C...)
  if (/^[A-Z]$/.test(label.trim())) return label.trim()
  // Fallback: iniciais das palavras
  return label.trim().split(/[\s/]+/).map(w => w[0]).join('').slice(0, 4).toUpperCase()
}

const PERIOD_OPTIONS = [
  { label: '7d',  days: 7  },
  { label: '15d', days: 15 },
  { label: '30d', days: 30 },
  { label: '90d', days: 90 },
]

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div style={{
      background: '#1E1F2A', border: '1px solid rgba(255,255,255,0.1)',
      borderRadius: 8, padding: '10px 14px', fontSize: 12,
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

// ─── KPI Card ─────────────────────────────────────────────────────────────────
function KpiCard({ icon: Icon, label, value, sub, color = '#6366F1' }) {
  return (
    <div style={{
      background: '#1A1B23', border: '1px solid rgba(255,255,255,0.06)',
      borderRadius: 12, padding: '18px 22px', display: 'flex', alignItems: 'flex-start', gap: 14,
    }}>
      <div style={{ background: color + '22', borderRadius: 10, padding: 10, flexShrink: 0 }}>
        <Icon size={18} color={color} />
      </div>
      <div>
        <div style={{ color: '#9CA3AF', fontSize: 11, marginBottom: 3 }}>{label}</div>
        <div style={{ color: '#F9FAFB', fontSize: 20, fontWeight: 700 }}>{value}</div>
        {sub && <div style={{ color: '#6B7280', fontSize: 11, marginTop: 2 }}>{sub}</div>}
      </div>
    </div>
  )
}

// ─── Tabela de campanhas ──────────────────────────────────────────────────────
function CampaignTable({ data }) {
  if (!data?.length) return <div style={{ color: '#6B7280', textAlign: 'center', padding: 40 }}>Sem dados</div>
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
        <thead>
          <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
            {['Campanha','Plataforma','MQLs','Ganhos','Conv%'].map(h => (
              <th key={h} style={{ color: '#6B7280', fontWeight: 600, padding: '6px 10px', textAlign: h === 'Campanha' ? 'left' : 'right' }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row, i) => {
            const isGood = row.conv_pct >= 5
            return (
              <tr key={i} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                <td style={{ padding: '7px 10px', color: '#D1D5DB', maxWidth: 260, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {row.campanha.length > 55 ? row.campanha.slice(0, 55) + '…' : row.campanha}
                </td>
                <td style={{ padding: '7px 10px', textAlign: 'right' }}>
                  <span style={{
                    background: row.plataforma === 'facebook' || row.plataforma === 'instagram' ? 'rgba(59,130,246,0.15)' : 'rgba(245,158,11,0.15)',
                    color: row.plataforma === 'facebook' || row.plataforma === 'instagram' ? '#3B82F6' : '#F59E0B',
                    borderRadius: 4, padding: '2px 7px', fontSize: 11,
                  }}>
                    {row.plataforma === 'facebook' || row.plataforma === 'instagram' ? 'Meta' : 'Google'}
                  </span>
                </td>
                <td style={{ padding: '7px 10px', textAlign: 'right', color: '#D1D5DB' }}>{fmtNum(row.mqls)}</td>
                <td style={{ padding: '7px 10px', textAlign: 'right', color: '#22C55E' }}>{fmtNum(row.ganhos)}</td>
                <td style={{ padding: '7px 10px', textAlign: 'right' }}>
                  <span style={{ color: isGood ? '#22C55E' : row.conv_pct >= 2 ? '#F59E0B' : '#EF4444', fontWeight: 600 }}>
                    {row.conv_pct ? `${row.conv_pct}%` : '—'}
                  </span>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

// ─── Tabela de atribuição de formulários ─────────────────────────────────────
function FormAttributionTable({ rows }) {
  if (!rows?.length) return <div style={{ color: '#6B7280', textAlign: 'center', padding: 40 }}>Sem dados</div>
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
        <thead>
          <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
            {['Produto / Form','Fonte','Iniciados','Completados','% Conclusão','MQLs','% MQL','Vendas','Receita'].map(h => (
              <th key={h} style={{
                color: '#6B7280', fontWeight: 600, padding: '6px 10px',
                textAlign: h === 'Produto / Form' || h === 'Fonte' ? 'left' : 'right',
                whiteSpace: 'nowrap',
              }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => {
            const conclusaoColor = row.taxa_conclusao >= 60 ? '#22C55E' : row.taxa_conclusao >= 35 ? '#F59E0B' : '#EF4444'
            const mqlColor       = row.taxa_mql       >= 50 ? '#22C55E' : row.taxa_mql       >= 25 ? '#F59E0B' : '#EF4444'
            const vendaColor     = row.taxa_venda      >= 5  ? '#22C55E' : row.taxa_venda      >= 1  ? '#F59E0B' : '#9CA3AF'
            return (
              <tr key={i} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                <td style={{ padding: '7px 10px', color: '#D1D5DB', maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  <span style={{
                    background: 'rgba(99,102,241,0.12)', color: '#A5B4FC',
                    borderRadius: 4, padding: '1px 6px', fontSize: 11, marginRight: 6,
                  }}>
                    {row.produto.replace('g4-', '').replace('im-', '').toUpperCase()}
                  </span>
                </td>
                <td style={{ padding: '7px 10px', color: '#9CA3AF' }}>
                  {row.utm_source}
                  {row.utm_medium ? <span style={{ color: '#6B7280', marginLeft: 4 }}>/ {row.utm_medium}</span> : null}
                </td>
                <td style={{ padding: '7px 10px', textAlign: 'right', color: '#9CA3AF' }}>{fmtNum(row.form_iniciados)}</td>
                <td style={{ padding: '7px 10px', textAlign: 'right', color: '#D1D5DB', fontWeight: 600 }}>{fmtNum(row.form_completados)}</td>
                <td style={{ padding: '7px 10px', textAlign: 'right' }}>
                  <span style={{ color: conclusaoColor, fontWeight: 600 }}>{row.taxa_conclusao}%</span>
                </td>
                <td style={{ padding: '7px 10px', textAlign: 'right', color: '#6366F1', fontWeight: 600 }}>{fmtNum(row.mqls)}</td>
                <td style={{ padding: '7px 10px', textAlign: 'right' }}>
                  <span style={{ color: mqlColor }}>{row.taxa_mql}%</span>
                </td>
                <td style={{ padding: '7px 10px', textAlign: 'right', color: '#22C55E', fontWeight: row.vendas > 0 ? 700 : 400 }}>{row.vendas || '—'}</td>
                <td style={{ padding: '7px 10px', textAlign: 'right', color: row.receita > 0 ? '#F59E0B' : '#6B7280' }}>
                  {row.receita > 0 ? fmtMoney(row.receita) : '—'}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

// ─── Componente principal ────────────────────────────────────────────────────
export default function ComparacaoPage() {
  const [days, setDays]           = useState(30)
  const [channels, setChannels]         = useState(null)
  const [mediaROI, setMediaROI]         = useState(null)
  const [revenue, setRevenue]           = useState(null)
  const [profiles, setProfiles]         = useState(null)
  const [campaigns, setCampaigns]       = useState(null)
  const [formAttrib, setFormAttrib]     = useState(null)
  const [cohort, setCohort]             = useState(null)
  const [loading, setLoading]           = useState(true)
  const [lastUpdated, setLastUpdated]   = useState(null)
  const [isMock, setIsMock]             = useState(false)

  async function loadAll(d, forceRefresh = false) {
    if (forceRefresh) await api.databricksCacheClear()
    setLoading(true)
    const [ch, mr, rv, pr, ca, fa, co] = await Promise.all([
      api.databricksCompareChannels(d),
      api.databricksCompareMediaROI(d),
      api.databricksCompareRevenue(d),
      api.databricksCompareProfiles(d),
      api.databricksCompareCampaigns(d),
      api.databricksFormAttribution(d),
      api.databricksClosingCohort(Math.max(d, 90)),
    ])
    setChannels(ch)
    setMediaROI(mr)
    setRevenue(rv)
    setProfiles(pr)
    setCampaigns(ca)
    setFormAttrib(fa)
    setCohort(co)
    setIsMock(!!(ch?.mock || mr?.mock))
    setLastUpdated(new Date())
    setLoading(false)
  }

  useEffect(() => { loadAll(days) }, [days])

  // ── KPIs agregados ─────────────────────────────────────────────────────────
  const totalMQLs    = (channels?.channels || []).reduce((a, c) => a + c.mqls, 0)
  const totalGanhos  = (channels?.channels || []).reduce((a, c) => a + c.ganhos, 0)
  const totalGasto   = (mediaROI?.media || []).reduce((a, m) => a + m.gasto, 0)
  const totalReceita = (revenue?.channels || []).reduce((a, c) => a + c.receita, 0)
  const convGeral    = totalMQLs > 0 ? ((totalGanhos / totalMQLs) * 100).toFixed(1) : '—'
  const roi          = totalGasto > 0 ? ((totalReceita / totalGasto) * 100).toFixed(0) : '—'

  // ── Dados para gráfico radar de canais ────────────────────────────────────
  const radarData = (channels?.channels || []).map(c => ({
    canal: c.canal,
    'MQL→SAL': c.mqls > 0 ? Math.round((c.sals / c.mqls) * 100) : 0,
    'SAL→Opp': c.sals > 0 ? Math.round((c.opps / c.sals) * 100) : 0,
    'Opp→Won': c.opps > 0 ? Math.round((c.ganhos / c.opps) * 100) : 0,
  }))

  // ── Dados funil empilhado por canal ───────────────────────────────────────
  const channelFunnelData = (channels?.channels || []).map(c => ({
    canal: c.canal,
    MQLs: c.mqls,
    SALs: c.sals,
    Opps: c.opps,
    Ganhos: c.ganhos,
    color: CANAL_COLORS[c.canal] || '#6B7280',
  }))

  // ── Perfis: top 8 ─────────────────────────────────────────────────────────
  const profileData = (profiles?.profiles || []).slice(0, 8).map(p => ({
    perfil: p.perfil,
    Conv: p.conv_pct,
    MQLs: p.mqls,
    color: p.conv_pct >= 10 ? '#22C55E' : p.conv_pct >= 5 ? '#F59E0B' : '#EF4444',
  }))

  // ── Receita por canal (bar) ────────────────────────────────────────────────
  const revenueData = (revenue?.channels || []).slice(0, 8).map(c => ({
    fonte: c.utm_source || c.canal,
    receita: c.receita,
    deals: c.deals,
    color: CANAL_COLORS[c.canal] || '#6366F1',
  }))

  // ── Media ROI cards ────────────────────────────────────────────────────────
  const mediaData = mediaROI?.media || []

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <Header
        title="Comparação de Fontes"
        subtitle="GA4 · Meta Ads · CRM — dados reais Databricks"
        onRefresh={() => loadAll(days, true)}
        lastUpdated={lastUpdated}
        action={
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            {isMock && (
              <span style={{
                background: 'rgba(245,158,11,0.15)', color: '#F59E0B',
                borderRadius: 6, padding: '3px 10px', fontSize: 12,
              }}>MOCK</span>
            )}
            <div style={{ display: 'flex', gap: 2, background: '#1A1B23', borderRadius: 8, padding: 3 }}>
              {PERIOD_OPTIONS.map(o => (
                <button key={o.days} onClick={() => setDays(o.days)} style={{
                  background: days === o.days ? '#6366F1' : 'transparent',
                  color: days === o.days ? '#fff' : '#9CA3AF',
                  border: 'none', borderRadius: 6, padding: '4px 10px',
                  cursor: 'pointer', fontSize: 12, fontWeight: 600,
                  whiteSpace: 'nowrap',
                }}>{o.label}</button>
              ))}
            </div>
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
            {/* ── KPIs ──────────────────────────────────────────────────── */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 16 }}>
              <KpiCard icon={Users}      label={`MQLs totais (${days}d)`}    value={fmtNum(totalMQLs)}    sub="Todas as fontes"           color="#6366F1" />
              <KpiCard icon={TrendingUp} label={`Ganhos totais (${days}d)`}  value={fmtNum(totalGanhos)}  sub={`Conv. geral: ${convGeral}%`} color="#22C55E" />
              <KpiCard icon={Zap}        label={`Gasto mídia paga (${days}d)`} value={fmtMoney(totalGasto)} sub="Meta + Google"             color="#3B82F6" />
              <KpiCard icon={DollarSign} label={`Receita real (${days}d)`}   value={fmtMoney(totalReceita)} sub={`ROI ${roi}%`}            color="#F59E0B" />
            </div>

            {/* ── Mídia paga: Meta vs Google ─────────────────────────── */}
            {mediaData.length > 0 && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16 }}>
                {mediaData.map((m, i) => (
                  <Card key={i}>
                    <CardHeader
                      title={m.plataforma}
                      subtitle={`Investimento × resultado — ${days}d`}
                    />
                    <CardBody>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 16 }}>
                        {[
                          { label: 'Gasto', value: fmtMoney(m.gasto), color: '#EF4444' },
                          { label: 'MQLs gerados', value: fmtNum(m.mqls), color: '#6366F1' },
                          { label: 'Ganhos', value: fmtNum(m.ganhos), color: '#22C55E' },
                          { label: 'Impressões', value: fmtNum(m.impressoes), color: '#9CA3AF' },
                          { label: 'Cliques', value: fmtNum(m.cliques), color: '#9CA3AF' },
                          { label: 'CPL', value: m.cpl > 0 ? fmtMoney(m.cpl) : '—', color: '#F59E0B' },
                        ].map((item, j) => (
                          <div key={j} style={{
                            background: '#0F1018', borderRadius: 8, padding: '10px 14px',
                            border: '1px solid rgba(255,255,255,0.05)',
                          }}>
                            <div style={{ color: '#6B7280', fontSize: 11, marginBottom: 4 }}>{item.label}</div>
                            <div style={{ color: item.color, fontSize: 16, fontWeight: 700 }}>{item.value}</div>
                          </div>
                        ))}
                      </div>
                      {/* Barra visual MQL → Ganho */}
                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, fontSize: 11, color: '#6B7280' }}>
                          <span>{fmtNum(m.mqls)} MQLs</span>
                          <span>{pct(m.ganhos, m.mqls)} conv.</span>
                          <span>{fmtNum(m.ganhos)} Ganhos</span>
                        </div>
                        <div style={{ background: 'rgba(255,255,255,0.06)', borderRadius: 6, height: 8, overflow: 'hidden' }}>
                          <div style={{
                            background: PLATFORM_COLORS[m.plataforma] || '#6366F1',
                            height: 8,
                            width: m.mqls > 0 ? `${Math.min((m.ganhos / m.mqls) * 100 * 5, 100)}%` : '0%',
                            borderRadius: 6,
                            transition: 'width 0.5s',
                          }} />
                        </div>
                      </div>
                    </CardBody>
                  </Card>
                ))}
              </div>
            )}

            {/* ── Funil por canal + Receita por canal ─────────────────── */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
              {/* Funil por canal */}
              <Card>
                <CardHeader title="Funil por Canal" subtitle="MQL → SAL → Opp → Ganho" />
                <CardBody>
                  <ResponsiveContainer width="100%" height={260}>
                    <BarChart data={channelFunnelData} margin={{ top: 4, right: 12, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                      <XAxis dataKey="canal" tick={{ fill: '#9CA3AF', fontSize: 11 }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fill: '#9CA3AF', fontSize: 11 }} axisLine={false} tickLine={false} />
                      <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
                      <Legend wrapperStyle={{ fontSize: 11 }} />
                      <Bar dataKey="MQLs"   stackId="a" fill="#6366F1" radius={[0,0,0,0]} />
                      <Bar dataKey="SALs"   stackId="b" fill="#8B5CF6" />
                      <Bar dataKey="Opps"   stackId="c" fill="#06B6D4" />
                      <Bar dataKey="Ganhos" stackId="d" fill="#22C55E" radius={[4,4,0,0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </CardBody>
              </Card>

              {/* Receita por canal */}
              <Card>
                <CardHeader title="Receita por Canal" subtitle={`Vendas reais — ${days}d`} />
                <CardBody>
                  <ResponsiveContainer width="100%" height={260}>
                    <BarChart
                      data={revenueData}
                      layout="vertical"
                      margin={{ top: 0, right: 16, left: 10, bottom: 0 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" horizontal={false} />
                      <XAxis type="number" tick={{ fill: '#9CA3AF', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={v => fmtMoney(v)} />
                      <YAxis type="category" dataKey="fonte" tick={{ fill: '#D1D5DB', fontSize: 11 }} width={90} axisLine={false} tickLine={false} />
                      <Tooltip
                        cursor={{ fill: 'rgba(255,255,255,0.04)' }}
                        content={({ active, payload, label }) => {
                          if (!active || !payload?.length) return null
                          const d = payload[0]?.payload
                          return (
                            <div style={{ background: '#1E1F2A', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, padding: '10px 14px', fontSize: 12 }}>
                              <div style={{ color: '#F9FAFB', fontWeight: 600 }}>{d?.fonte}</div>
                              <div style={{ color: '#F59E0B' }}>Receita: {fmtMoney(d?.receita)}</div>
                              <div style={{ color: '#22C55E' }}>Deals: {d?.deals}</div>
                            </div>
                          )
                        }}
                      />
                      <Bar dataKey="receita" radius={[0, 4, 4, 0]} name="Receita">
                        {revenueData.map((entry, i) => (
                          <Cell key={i} fill={entry.color} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </CardBody>
              </Card>
            </div>

            {/* ── Conversão por perfil ICP ─────────────────────────────── */}
            <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 20 }}>
              <Card>
                <CardHeader title="Conversão por Perfil ICP" subtitle={`Taxa MQL→Ganho por segmento — ${days}d`} />
                <CardBody>
                  <ResponsiveContainer width="100%" height={260}>
                    <BarChart data={profileData} margin={{ top: 4, right: 12, left: 0, bottom: 40 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                      <XAxis
                        dataKey="perfil"
                        tick={{ fill: '#9CA3AF', fontSize: 11 }}
                        axisLine={false}
                        tickLine={false}
                        angle={-35}
                        textAnchor="end"
                        interval={0}
                        tickFormatter={(v) => perfilBadge(v)}
                      />
                      <YAxis tick={{ fill: '#9CA3AF', fontSize: 11 }} axisLine={false} tickLine={false} unit="%" />
                      <Tooltip
                        cursor={{ fill: 'rgba(255,255,255,0.04)' }}
                        content={({ active, payload, label }) => {
                          if (!active || !payload?.length) return null
                          const d = payload[0]?.payload
                          return (
                            <div style={{ background: '#1E1F2A', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, padding: '10px 14px', fontSize: 12 }}>
                              <div style={{ color: '#F9FAFB', fontWeight: 600 }}>{d?.perfil}</div>
                              <div style={{ color: '#6366F1' }}>MQLs: {fmtNum(d?.MQLs)}</div>
                              <div style={{ color: d?.color }}>Conv: {d?.Conv}%</div>
                            </div>
                          )
                        }}
                      />
                      <Bar dataKey="Conv" radius={[4, 4, 0, 0]} name="Conv %">
                        {profileData.map((entry, i) => (
                          <Cell key={i} fill={entry.color} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                  {/* legenda de cor */}
                  <div style={{ display: 'flex', gap: 16, marginTop: 8, fontSize: 11, color: '#6B7280' }}>
                    <span><span style={{ color: '#22C55E' }}>●</span> ≥10% conv</span>
                    <span><span style={{ color: '#F59E0B' }}>●</span> 5-10%</span>
                    <span><span style={{ color: '#EF4444' }}>●</span> &lt;5%</span>
                  </div>
                </CardBody>
              </Card>

              {/* Mini KPIs de perfil */}
              <Card>
                <CardHeader title="Perfis de Destaque" subtitle="Melhores e piores conversores" />
                <CardBody>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {(profiles?.profiles || []).slice(0, 6).map((p, i) => {
                      const isTop = p.conv_pct >= 10
                      const isMid = p.conv_pct >= 5
                      const color = isTop ? '#22C55E' : isMid ? '#F59E0B' : '#EF4444'
                      const maxMQL = (profiles?.profiles?.[0]?.mqls) || 1
                      return (
                        <div key={i}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                            <div style={{ display: 'flex', gap: 8, alignItems: 'center', minWidth: 0 }}>
                              <span style={{
                                background: color + '33', color, borderRadius: 4,
                                padding: '2px 8px', fontWeight: 700, fontSize: 12,
                                flexShrink: 0, minWidth: 28, textAlign: 'center',
                              }}>
                                {perfilBadge(p.perfil)}
                              </span>
                              <span style={{ color: '#E5E7EB', fontSize: 12, fontWeight: 500, flexShrink: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {p.perfil}
                              </span>
                              <span style={{ color: '#6B7280', fontSize: 11, flexShrink: 0 }}>{fmtNum(p.mqls)} MQLs</span>
                            </div>
                            <span style={{ color, fontWeight: 700, fontSize: 13 }}>{p.conv_pct}%</span>
                          </div>
                          <div style={{ background: 'rgba(255,255,255,0.06)', borderRadius: 4, height: 4 }}>
                            <div style={{
                              background: color, borderRadius: 4, height: 4,
                              width: `${(p.mqls / maxMQL) * 100}%`,
                              transition: 'width 0.4s',
                            }} />
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </CardBody>
              </Card>
            </div>

            {/* ── Top campanhas pagas ──────────────────────────────────── */}
            <Card>
              <CardHeader
                title="Top Campanhas Meta & Google"
                subtitle={`Resultado MQL → Ganho por campanha — ${days}d`}
              />
              <CardBody>
                <CampaignTable data={campaigns?.campaigns || []} />
              </CardBody>
            </Card>

            {/* ── Atribuição: Form → Lead → MQL → Venda ──────────────── */}
            <Card>
              <CardHeader
                title="Atribuição: Formulário → Venda"
                subtitle={`De onde veio cada lead que virou venda — ${days}d`}
              />
              <CardBody>
                {/* KPIs do funil de forms */}
                {formAttrib?.summary && (() => {
                  const s = formAttrib.summary
                  const txConc = s.total_form_iniciados  > 0 ? ((s.total_form_completados / s.total_form_iniciados)  * 100).toFixed(1) : '—'
                  const txMQL  = s.total_form_completados > 0 ? ((s.total_mqls              / s.total_form_completados) * 100).toFixed(1) : '—'
                  const txVnd  = s.total_mqls             > 0 ? ((s.total_vendas             / s.total_mqls)             * 100).toFixed(1) : '—'
                  return (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 12, marginBottom: 20 }}>
                      {[
                        { label: 'Forms iniciados',   value: fmtNum(s.total_form_iniciados),   color: '#9CA3AF' },
                        { label: 'Forms completados', value: fmtNum(s.total_form_completados), sub: `${txConc}% conclusão`, color: '#6366F1' },
                        { label: 'MQLs gerados',      value: fmtNum(s.total_mqls),             sub: `${txMQL}% dos completados`, color: '#A78BFA' },
                        { label: 'Vendas',            value: fmtNum(s.total_vendas),           sub: `${txVnd}% dos MQLs`, color: '#22C55E' },
                        { label: 'Receita',           value: fmtMoney(s.total_receita),        color: '#F59E0B' },
                      ].map((item, i) => (
                        <div key={i} style={{
                          background: '#0F1018', borderRadius: 8, padding: '12px 16px',
                          border: '1px solid rgba(255,255,255,0.05)',
                        }}>
                          <div style={{ color: '#6B7280', fontSize: 11, marginBottom: 4 }}>{item.label}</div>
                          <div style={{ color: item.color, fontSize: 18, fontWeight: 700 }}>{item.value}</div>
                          {item.sub && <div style={{ color: '#6B7280', fontSize: 11, marginTop: 2 }}>{item.sub}</div>}
                        </div>
                      ))}
                    </div>
                  )
                })()}

                <FormAttributionTable rows={formAttrib?.rows || []} />

                {/* internal_ref mais usados */}
                {formAttrib?.internalRefs?.length > 0 && (
                  <div style={{ marginTop: 20 }}>
                    <div style={{ color: '#9CA3AF', fontSize: 12, fontWeight: 600, marginBottom: 10 }}>
                      Internal Refs mais usados no período (GA4 form_submit)
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                      {formAttrib.internalRefs.slice(0, 10).map((ref, i) => (
                        <div key={i} style={{
                          background: '#1A1B23', border: '1px solid rgba(255,255,255,0.08)',
                          borderRadius: 8, padding: '6px 14px', fontSize: 12,
                        }}>
                          <span style={{ color: '#A5B4FC', fontWeight: 600 }}>{ref.internal_ref}</span>
                          <span style={{ color: '#6B7280', marginLeft: 8 }}>{ref.utm_source} / {ref.utm_medium}</span>
                          <span style={{
                            background: 'rgba(99,102,241,0.12)', color: '#818CF8',
                            borderRadius: 4, padding: '1px 6px', fontSize: 11, marginLeft: 8,
                          }}>{fmtNum(ref.form_submits_ga4)} submits</span>
                        </div>
                      ))}
                    </div>
                    <div style={{ color: '#4B5563', fontSize: 11, marginTop: 8 }}>
                      Fonte: GA4 form_submit · page_location → REGEXP_EXTRACT internal_ref · Período: {days}d
                    </div>
                  </div>
                )}
              </CardBody>
            </Card>

            {/* ── Cohort: Tempo até fechamento ────────────────────────── */}
            {cohort && (cohort.cohort || []).length > 0 && (() => {
              const rows = cohort.cohort || []
              const meses = [...new Set(rows.map(r => r.mes))].sort()
              const canais = ['Organico', 'Pago']
              const CANAL_COLOR = { Organico: '#22C55E', Pago: '#6366F1' }
              const CANAL_LABEL = { Organico: 'Orgânico', Pago: 'Pago' }

              // Pior vs melhor tempo por canal
              const summary = canais.map(canal => {
                const cRows = rows.filter(r => r.canal === canal && r.dias_medio > 0)
                if (!cRows.length) return null
                const avg = cRows.reduce((s, r) => s + r.dias_medio, 0) / cRows.length
                const min = Math.min(...cRows.map(r => r.dias_medio))
                const max = Math.max(...cRows.map(r => r.dias_medio))
                return { canal, avg, min, max }
              }).filter(Boolean)

              const chartData = meses.map(mes => {
                const row = { mes }
                canais.forEach(c => {
                  const r = rows.find(x => x.mes === mes && x.canal === c)
                  row[c + '_dias']  = r?.dias_medio  || null
                  row[c + '_conv']  = r?.conv_pct    || null
                  row[c + '_mql']   = r?.total_mql   || 0
                })
                return row
              })

              return (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#8A9BAA', textTransform: 'uppercase', letterSpacing: '0.08em', paddingBottom: 6, borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                    Cohort de Fechamento — Tempo Médio MQL → WON por Mês de Entrada
                    {cohort.mock && <span style={{ marginLeft: 8, color: '#F59E0B', fontSize: 10 }}>MOCK</span>}
                  </div>

                  {/* Cards de resumo */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
                    {summary.map(s => (
                      <div key={s.canal} style={{
                        background: '#1A1B23', border: `1px solid ${CANAL_COLOR[s.canal]}33`,
                        borderRadius: 10, padding: '14px 18px',
                      }}>
                        <div style={{ fontSize: 11, color: CANAL_COLOR[s.canal], fontWeight: 700, marginBottom: 8 }}>{CANAL_LABEL[s.canal]}</div>
                        <div style={{ fontSize: 22, fontWeight: 800, color: '#F9FAFB' }}>{s.avg.toFixed(0)}d</div>
                        <div style={{ fontSize: 10, color: '#6B7280', marginTop: 2 }}>tempo médio MQL→WON</div>
                        <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                          <span style={{ fontSize: 10, color: '#22C55E' }}>mín {s.min.toFixed(0)}d</span>
                          <span style={{ color: '#374151' }}>·</span>
                          <span style={{ fontSize: 10, color: '#EF4444' }}>máx {s.max.toFixed(0)}d</span>
                        </div>
                      </div>
                    ))}
                    {summary.length >= 2 && (
                      <div style={{ background: '#1A1B23', border: '1px solid rgba(245,158,11,0.2)', borderRadius: 10, padding: '14px 18px' }}>
                        <div style={{ fontSize: 11, color: '#F59E0B', fontWeight: 700, marginBottom: 8 }}>Diferença</div>
                        <div style={{ fontSize: 22, fontWeight: 800, color: '#F9FAFB' }}>
                          {Math.abs(summary[0].avg - summary[1].avg).toFixed(0)}d
                        </div>
                        <div style={{ fontSize: 10, color: '#6B7280', marginTop: 2 }}>
                          {summary[0].avg > summary[1].avg ? `${CANAL_LABEL[summary[0].canal]} fecha mais lento` : `${CANAL_LABEL[summary[1].canal]} fecha mais lento`}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Tabela por mês */}
                  <Card>
                    <CardHeader title="Detalhamento mensal" subtitle="Dias médios MQL→WON e taxa de conversão por cohort de entrada" />
                    <CardBody style={{ padding: 0 }}>
                      <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                          <thead>
                            <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                              <th style={{ padding: '10px 14px', textAlign: 'left', color: '#9CA3AF', fontWeight: 600, fontSize: 11 }}>Mês de entrada</th>
                              {canais.map(c => (
                                <>
                                  <th key={c + '_d'} style={{ padding: '10px 14px', textAlign: 'right', color: CANAL_COLOR[c], fontWeight: 600, fontSize: 11 }}>{CANAL_LABEL[c]} — Dias</th>
                                  <th key={c + '_c'} style={{ padding: '10px 14px', textAlign: 'right', color: CANAL_COLOR[c] + 'AA', fontWeight: 600, fontSize: 11 }}>Conv%</th>
                                </>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {chartData.map((row, i) => (
                              <tr key={row.mes} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.01)' }}>
                                <td style={{ padding: '9px 14px', color: '#F9FAFB', fontWeight: 600 }}>{row.mes}</td>
                                {canais.map(c => {
                                  const dias = row[c + '_dias']
                                  const conv = row[c + '_conv']
                                  const avgDias = summary.find(s => s.canal === c)?.avg || 1
                                  const color = dias === null ? '#6B7280' : dias < avgDias ? '#22C55E' : dias > avgDias * 1.2 ? '#EF4444' : '#F59E0B'
                                  return (
                                    <>
                                      <td key={c + '_d'} style={{ padding: '9px 14px', textAlign: 'right', color, fontWeight: 700 }}>
                                        {dias !== null ? `${dias.toFixed(0)}d` : '—'}
                                      </td>
                                      <td key={c + '_c'} style={{ padding: '9px 14px', textAlign: 'right', color: conv >= 30 ? '#22C55E' : conv >= 20 ? '#F59E0B' : '#9CA3AF' }}>
                                        {conv !== null ? `${conv}%` : '—'}
                                      </td>
                                    </>
                                  )
                                })}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      <div style={{ padding: '8px 14px 10px', borderTop: '1px solid rgba(255,255,255,0.04)', fontSize: 10, color: '#6B7280' }}>
                        Verde = abaixo da média (mais rápido) · Amarelo = até 20% acima · Vermelho = mais de 20% acima da média
                      </div>
                    </CardBody>
                  </Card>
                </div>
              )
            })()}

            {/* ── Nota de fontes ────────────────────────────────────────── */}
            <div style={{
              background: '#1A1B23', border: '1px solid rgba(255,255,255,0.06)',
              borderRadius: 10, padding: '12px 20px', fontSize: 12, color: '#6B7280',
              display: 'flex', gap: 20, flexWrap: 'wrap',
            }}>
              <span style={{ color: '#9CA3AF' }}>Fontes cruzadas:</span>
              <span><strong style={{ color: '#6366F1' }}>diamond.funil_marketing</strong> — jornada lead + UTMs</span>
              <span><strong style={{ color: '#22C55E' }}>diamond.customer_360_sales_table</strong> — vendas reais</span>
              <span><strong style={{ color: '#F59E0B' }}>diamond.funil_marketing (paid_media)</strong> — gasto Meta/Google</span>
              <span><strong style={{ color: '#A78BFA' }}>gold.forms_g4_events</strong> — form → lead → deal</span>
              <span><strong style={{ color: '#06B6D4' }}>silver.google_analytics_events</strong> — internal_ref GA4</span>
              {isMock && <span style={{ color: '#F59E0B' }}>· Dados simulados</span>}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
