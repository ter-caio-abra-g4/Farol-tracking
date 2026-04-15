import { useState, useEffect } from 'react'
import Header from '../components/layout/Header'
import Card, { CardHeader, CardBody } from '../components/ui/Card'
import Spinner from '../components/ui/Spinner'
import PeriodSelect from '../components/ui/PeriodSelect'
import { useTracking } from '../context/TrackingContext'
import { fmtNum, fmtMoney, fmtPct } from '../utils/format'
import { TT } from '../components/ui/DarkTooltip'
import { api } from '../services/api'
import { downloadCsv } from '../utils/export'
import {
  BarChart, Bar, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell, Legend,
} from 'recharts'
import { TrendingUp, TrendingDown, Minus, DollarSign, Users, MousePointerClick, Megaphone, Download, Activity } from 'lucide-react'

const PERIOD_OPTIONS = [
  { label: 'Hoje', days: 1  },
  { label: '7d',   days: 7  },
  { label: '15d',  days: 15 },
  { label: '30d',  days: 30 },
  { label: '90d',  days: 90 },
]

const PLATFORM_COLOR = {
  instagram: '#E1306C',
  facebook:  '#1877F2',
  messenger: '#0084FF',
  threads:   '#8B8B8B',
  audience_network: '#9CA3AF',
}

const GENDER_COLOR = { male: '#6366F1', female: '#EC4899' }

// ── CPL badge ─────────────────────────────────────────────────────────────────
function CplBadge({ cpl }) {
  if (cpl === null || cpl === undefined) return <span style={{ color: '#6B7280', fontSize: 12 }}>—</span>
  const color = cpl < 150 ? '#22C55E' : cpl < 300 ? '#F59E0B' : '#EF4444'
  return <span style={{ color, fontWeight: 700, fontSize: 13 }}>{fmtMoney(cpl)}</span>
}

// ── KPI card ──────────────────────────────────────────────────────────────────
function KpiCard({ label, value, sub, color = '#B9915B', icon: Icon }) {
  return (
    <div style={{
      background: '#0D1B26',
      border: `1px solid ${color}33`,
      borderRadius: 10,
      padding: '16px 18px',
      position: 'relative',
      overflow: 'hidden',
    }}>
      <div style={{
        position: 'absolute', left: 0, top: 0, bottom: 0,
        width: 3, background: color, borderRadius: '10px 0 0 10px',
      }} />
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div style={{ fontSize: 22, fontWeight: 800, color: '#F5F4F3', lineHeight: 1.1 }}>{value}</div>
          <div style={{ fontSize: 11, color, marginTop: 4, fontWeight: 700 }}>{label}</div>
          {sub && <div style={{ fontSize: 10, color: '#6B7280', marginTop: 2 }}>{sub}</div>}
        </div>
        {Icon && <Icon size={18} strokeWidth={1.5} color={color} style={{ opacity: 0.6 }} />}
      </div>
    </div>
  )
}

// ── Linha de criativo ──────────────────────────────────────────────────────────
function CreativeRow({ ad, rank }) {
  const nameParts = ad.name?.split('_') || []
  const shortName = nameParts.length > 3 ? nameParts.slice(0, 4).join('_') + '…' : ad.name
  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: '28px 1fr 90px 70px 70px 70px 70px',
      gap: 8, alignItems: 'center',
      padding: '10px 12px',
      borderRadius: 8,
      background: rank % 2 === 0 ? 'rgba(255,255,255,0.02)' : 'transparent',
      borderBottom: '1px solid rgba(255,255,255,0.04)',
    }}>
      <div style={{ fontSize: 11, color: '#6B7280', fontWeight: 700, textAlign: 'center' }}>#{rank}</div>
      <div>
        <div style={{ fontSize: 12, color: '#F5F4F3', fontWeight: 600 }} title={ad.name}>{shortName}</div>
        <div style={{ fontSize: 10, color: '#8A9BAA', marginTop: 2 }}>{ad.campaign} · {ad.adset}</div>
      </div>
      <div style={{ textAlign: 'right', fontSize: 12, color: '#B9915B', fontWeight: 700 }}>{fmtMoney(ad.spend)}</div>
      <div style={{ textAlign: 'right', fontSize: 12, color: '#F5F4F3' }}>{fmtNum(ad.leads)}</div>
      <div style={{ textAlign: 'right' }}><CplBadge cpl={ad.cpl} /></div>
      <div style={{ textAlign: 'right', fontSize: 12, color: '#8A9BAA' }}>{ad.ctr?.toFixed(2)}%</div>
      <div style={{ textAlign: 'right', fontSize: 12, color: '#8A9BAA' }}>{fmtNum(ad.impressions)}</div>
    </div>
  )
}

export default function PaidPage() {
  const { selectedDays, setSelectedDays } = useTracking()
  const [days, setDays] = useState(selectedDays <= 30 ? selectedDays : 7)
  function changeDays(d) { setDays(d); setSelectedDays(d) }

  const [loading, setLoading] = useState(true)
  const [audience, setAudience] = useState(null)
  const [creatives, setCreatives] = useState(null)
  const [stats, setStats] = useState(null)
  const [volume, setVolume] = useState(null)

  useEffect(() => {
    setLoading(true)
    Promise.all([
      api.metaAudience(days),
      api.metaCreatives(days),
      api.metaStats(),
      api.metaVolume(days),
    ]).then(([aud, cre, st, vol]) => {
      setAudience(aud)
      setCreatives(cre)
      setStats(st)
      setVolume(vol)
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [days])

  function handleExport() {
    const date = new Date().toLocaleDateString('pt-BR').replace(/\//g, '-')
    const adsRows = (creatives?.ads || []).map(a => ({
      criativo: a.name, campanha: a.campaign, conjunto: a.adset,
      spend: a.spend, leads: a.leads, cpl: a.cpl, ctr: a.ctr, impressions: a.impressions,
    }))
    const ageRows = (audience?.ageRows || []).map(r => ({
      faixa: r.age, genero: r.gender, leads: r.leads, spend: r.spend, clicks: r.clicks,
    }))
    const volRows = (volume?.rows || []).map(r => ({ data: r.date, total: r.total, capi: r.capi, pixel: r.pixel }))
    if (adsRows.length) downloadCsv(`paid-criativos-${days}d-${date}.csv`, adsRows)
    if (ageRows.length) downloadCsv(`paid-audiencia-${days}d-${date}.csv`, ageRows)
    if (volRows.length) downloadCsv(`paid-volume-eventos-${days}d-${date}.csv`, volRows)
  }

  // Agrega totais da audiência
  const ageRows    = audience?.ageRows    || []
  const platforms  = audience?.platforms  || []
  const ads        = creatives?.ads       || []
  const isMock     = audience?.mock || creatives?.mock

  const totalSpend  = ageRows.reduce((s, r) => s + r.spend,  0)
  const totalLeads  = ageRows.reduce((s, r) => s + r.leads,  0)
  const totalClicks = ageRows.reduce((s, r) => s + r.clicks, 0)
  const totalImpr   = ageRows.reduce((s, r) => s + r.impressions, 0)
  const avgCpl      = totalLeads > 0 ? Math.round(totalSpend / totalLeads) : null
  const avgCtr      = totalImpr  > 0 ? parseFloat((totalClicks / totalImpr * 100).toFixed(2)) : null
  const avgCpm      = totalImpr  > 0 ? parseFloat((totalSpend / totalImpr * 1000).toFixed(2)) : null

  // Dados para gráfico de plataformas
  const platData = platforms.map(p => ({
    name: p.platform.charAt(0).toUpperCase() + p.platform.slice(1),
    Spend: p.spend,
    Leads: p.leads,
    color: PLATFORM_COLOR[p.platform] || '#9CA3AF',
  }))

  // Agrega audiência por faixa etária para gráfico
  const ageMap = {}
  for (const r of ageRows) {
    if (!ageMap[r.age]) ageMap[r.age] = { age: r.age, male: 0, female: 0, maleSpend: 0, femaleSpend: 0 }
    if (r.gender === 'male')   { ageMap[r.age].male += r.leads;   ageMap[r.age].maleSpend += r.spend }
    if (r.gender === 'female') { ageMap[r.age].female += r.leads; ageMap[r.age].femaleSpend += r.spend }
  }
  const ageData = Object.values(ageMap).sort((a, b) => a.age.localeCompare(b.age))

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      <Header
        title="Paid Media"
        isMock={isMock}
        subtitle="Visão consolidada de mídia paga · Meta Ads"
        action={
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <PeriodSelect options={PERIOD_OPTIONS} value={days} onChange={changeDays} />
            {!loading && !isMock && (
              <button
                onClick={handleExport}
                title="Exportar CSVs (criativos, audiência, volume de eventos)"
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

      <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 20 }}>

        {/* Mock warning */}
        {isMock && (
          <div style={{
            background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)',
            borderRadius: 6, padding: '6px 14px', fontSize: 11, color: '#F59E0B',
          }}>
            MOCK — configure o token Meta em Settings para dados reais
          </div>
        )}

        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 60 }}>
            <Spinner />
          </div>
        ) : (
          <>
            {/* ── KPIs de topo ── */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12 }}>
              <KpiCard label="Investido"   value={fmtMoney(totalSpend)}  sub={`${days}d · todas contas`}  color="#B9915B" icon={DollarSign}        />
              <KpiCard label="Leads"       value={fmtNum(totalLeads)}    sub={`${days}d`}                 color="#6366F1" icon={Users}             />
              <KpiCard label="CPL médio"   value={avgCpl ? fmtMoney(avgCpl) : '—'} sub="custo por lead" color={!avgCpl ? '#6B7280' : avgCpl < 150 ? '#22C55E' : avgCpl < 300 ? '#F59E0B' : '#EF4444'} icon={TrendingUp} />
              <KpiCard label="CTR médio"   value={avgCtr ? `${avgCtr}%` : '—'} sub="cliques / impressões" color="#06B6D4" icon={MousePointerClick} />
              <KpiCard label="CPM médio"   value={avgCpm ? fmtMoney(avgCpm) : '—'} sub="por 1.000 impressões" color="#8B5CF6" icon={Megaphone} />
            </div>

            {/* ── Gráficos lado a lado ── */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>

              {/* Por plataforma */}
              <Card>
                <CardHeader title="Spend por plataforma" subtitle={`${days}d`} />
                <CardBody>
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={platData} margin={{ top: 4, right: 12, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                      <XAxis dataKey="name" tick={{ fill: '#8A9BAA', fontSize: 11 }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fill: '#8A9BAA', fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={v => fmtMoney(v)} />
                      <Tooltip
                        cursor={TT.cursorBar}
                        content={({ active, payload, label }) => {
                          if (!active || !payload?.length) return null
                          const d = payload[0]?.payload
                          return (
                            <div style={TT.contentStyle}>
                              <div style={{ fontWeight: 700, marginBottom: 4 }}>{label}</div>
                              <div style={{ color: d.color }}>Spend: {fmtMoney(d.Spend)}</div>
                              <div style={{ color: '#8A9BAA' }}>Leads: {fmtNum(d.Leads)}</div>
                              {d.Leads > 0 && <div style={{ color: '#F59E0B' }}>CPL: {fmtMoney(Math.round(d.Spend / d.Leads))}</div>}
                            </div>
                          )
                        }}
                      />
                      <Bar dataKey="Spend" radius={[4, 4, 0, 0]}>
                        {platData.map((entry, i) => (
                          <Cell key={i} fill={entry.color} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </CardBody>
              </Card>

              {/* Leads por faixa etária */}
              <Card>
                <CardHeader title="Leads por faixa etária" subtitle={`${days}d · H vs M`} />
                <CardBody>
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={ageData} margin={{ top: 4, right: 12, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                      <XAxis dataKey="age" tick={{ fill: '#8A9BAA', fontSize: 11 }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fill: '#8A9BAA', fontSize: 11 }} axisLine={false} tickLine={false} />
                      <Tooltip
                        cursor={TT.cursorBar}
                        content={({ active, payload, label }) => {
                          if (!active || !payload?.length) return null
                          const d = payload[0]?.payload
                          return (
                            <div style={TT.contentStyle}>
                              <div style={{ fontWeight: 700, marginBottom: 4 }}>{label}</div>
                              <div style={{ color: GENDER_COLOR.male }}>Homens: {fmtNum(d.male)} leads · {fmtMoney(d.maleSpend)}</div>
                              <div style={{ color: GENDER_COLOR.female }}>Mulheres: {fmtNum(d.female)} leads · {fmtMoney(d.femaleSpend)}</div>
                            </div>
                          )
                        }}
                      />
                      <Bar dataKey="male"   name="Homens"   fill={GENDER_COLOR.male}   radius={[3, 3, 0, 0]} />
                      <Bar dataKey="female" name="Mulheres" fill={GENDER_COLOR.female} radius={[3, 3, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </CardBody>
              </Card>
            </div>

            {/* ── Volume diário de eventos (CAPI + Pixel) ── */}
            {(volume?.rows?.length > 0) && (
              <Card>
                <CardHeader
                  title="Volume diário de eventos (Pixel Meta)"
                  subtitle={`${days}d · CAPI vs Pixel Browser (heurística)`}
                  action={
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, color: volume?.mock ? '#F59E0B' : '#22C55E' }}>
                      <Activity size={10} />
                      {volume?.mock ? 'MOCK' : 'LIVE'}
                    </div>
                  }
                />
                <CardBody>
                  <ResponsiveContainer width="100%" height={180}>
                    <AreaChart data={volume.rows} margin={{ top: 4, right: 12, left: 0, bottom: 0 }}>
                      <defs>
                        <linearGradient id="gradCapi" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%"  stopColor="#6366F1" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="#6366F1" stopOpacity={0.02} />
                        </linearGradient>
                        <linearGradient id="gradPixel" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%"  stopColor="#E1306C" stopOpacity={0.25} />
                          <stop offset="95%" stopColor="#E1306C" stopOpacity={0.02} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                      <XAxis dataKey="date" tick={{ fill: '#8A9BAA', fontSize: 10 }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
                      <YAxis tick={{ fill: '#8A9BAA', fontSize: 10 }} axisLine={false} tickLine={false} />
                      <Tooltip
                        cursor={TT.cursorLine}
                        content={({ active, payload, label }) => {
                          if (!active || !payload?.length) return null
                          return (
                            <div style={TT.contentStyle}>
                              <div style={{ fontWeight: 700, marginBottom: 4, fontSize: 11 }}>{label}</div>
                              {payload.map((p, i) => (
                                <div key={i} style={{ color: p.color, fontSize: 11 }}>{p.name}: {fmtNum(p.value)}</div>
                              ))}
                            </div>
                          )
                        }}
                      />
                      <Legend wrapperStyle={{ fontSize: 11, color: '#8A9BAA' }} />
                      <Area type="monotone" dataKey="capi"  name="CAPI (servidor)" stroke="#6366F1" fill="url(#gradCapi)"  strokeWidth={2} dot={false} />
                      <Area type="monotone" dataKey="pixel" name="Pixel (browser)" stroke="#E1306C" fill="url(#gradPixel)" strokeWidth={2} dot={false} />
                    </AreaChart>
                  </ResponsiveContainer>
                </CardBody>
              </Card>
            )}

            {/* ── Funil de pixel ── */}
            {(stats?.funnel?.length > 0) && (
              <Card>
                <CardHeader
                  title="Funil de conversão do Pixel"
                  subtitle="PageView → Lead → Purchase · últimas 24h"
                  action={
                    <div style={{ fontSize: 10, color: stats?.mock ? '#F59E0B' : '#22C55E', fontWeight: 700 }}>
                      {stats?.mock ? 'MOCK' : 'LIVE'}
                    </div>
                  }
                />
                <CardBody>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {stats.funnel.map((step, i) => {
                      const maxCount = stats.funnel[0]?.count || 1
                      const pct = Math.round((step.count / maxCount) * 100)
                      const STEP_COLORS = ['#6366F1', '#8B5CF6', '#E1306C', '#F59E0B', '#22C55E']
                      const color = STEP_COLORS[i] || '#6B7280'
                      return (
                        <div key={i}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                            <span style={{ fontSize: 12, color: '#C4D0DC', fontWeight: 600 }}>{step.stage}</span>
                            <div style={{ display: 'flex', gap: 12, fontSize: 11 }}>
                              <span style={{ color: '#8A9BAA' }}>{step.rate}%</span>
                              <span style={{ color, fontWeight: 700 }}>{fmtNum(step.count)}</span>
                            </div>
                          </div>
                          <div style={{ height: 6, background: 'rgba(255,255,255,0.06)', borderRadius: 3 }}>
                            <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: 3, transition: 'width 0.4s ease' }} />
                          </div>
                        </div>
                      )
                    })}
                  </div>
                  {/* Eventos detalhados */}
                  {stats.events?.length > 0 && (
                    <div style={{ marginTop: 16, borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: 12 }}>
                      <div style={{ fontSize: 10, color: '#6B7280', fontWeight: 700, marginBottom: 8 }}>TODOS OS EVENTOS (24h)</div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 70px 60px 60px', gap: 6, padding: '5px 8px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                        {['Evento', 'Volume', '% total', 'Δ 24h ant'].map((h, i) => (
                          <div key={i} style={{ fontSize: 10, color: '#6B7280', fontWeight: 700, textAlign: i > 0 ? 'right' : 'left' }}>{h}</div>
                        ))}
                      </div>
                      <div style={{ maxHeight: 200, overflowY: 'auto' }}>
                        {stats.events.slice(0, 12).map((ev, i) => (
                          <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 70px 60px 60px', gap: 6, padding: '5px 8px', borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                            <div style={{ fontSize: 11, color: '#F5F4F3', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ev.name}</div>
                            <div style={{ textAlign: 'right', fontSize: 11, color: '#B9915B', fontWeight: 700 }}>{fmtNum(ev.count)}</div>
                            <div style={{ textAlign: 'right', fontSize: 11, color: '#8A9BAA' }}>{ev.pct}%</div>
                            <div style={{ textAlign: 'right', fontSize: 11, color: ev.delta === null ? '#6B7280' : ev.delta >= 0 ? '#22C55E' : '#EF4444', fontWeight: ev.delta !== null ? 700 : 400 }}>
                              {ev.delta === null ? '—' : `${ev.delta >= 0 ? '+' : ''}${ev.delta}%`}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </CardBody>
              </Card>
            )}

            {/* ── Top criativos ── */}
            <Card>
              <CardHeader
                title="Top criativos por investimento"
                subtitle={`${days}d · top ${ads.length} anúncios ativos`}
              />
              <CardBody style={{ padding: 0 }}>
                {/* Header tabela */}
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: '28px 1fr 90px 70px 70px 70px 70px',
                  gap: 8, padding: '8px 12px',
                  borderBottom: '1px solid rgba(255,255,255,0.06)',
                }}>
                  {['#', 'Criativo / Campanha', 'Spend', 'Leads', 'CPL', 'CTR', 'Impressões'].map((h, i) => (
                    <div key={i} style={{
                      fontSize: 10, color: '#6B7280', fontWeight: 700,
                      textAlign: i > 1 ? 'right' : i === 0 ? 'center' : 'left',
                    }}>{h}</div>
                  ))}
                </div>

                {ads.length === 0 ? (
                  <div style={{ padding: '32px 12px', textAlign: 'center', color: '#6B7280', fontSize: 12 }}>
                    Nenhum criativo com dados no período
                  </div>
                ) : (
                  ads.map((ad, i) => <CreativeRow key={ad.id || i} ad={ad} rank={i + 1} />)
                )}
              </CardBody>
            </Card>

          </>
        )}
      </div>
    </div>
  )
}
