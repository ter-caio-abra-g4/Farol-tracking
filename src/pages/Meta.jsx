import { useState, useEffect } from 'react'
import Header from '../components/layout/Header'
import Card, { CardHeader, CardBody } from '../components/ui/Card'
import Spinner from '../components/ui/Spinner'
import { api } from '../services/api'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  AreaChart, Area, Cell,
} from 'recharts'
import { Settings, X, Eye, EyeOff, Save, TrendingUp, TrendingDown, Minus, Users, Monitor, Layers, ShieldCheck, PlugZap } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import PeriodSelect from '../components/ui/PeriodSelect'
import { fmtNum, fmtMoney } from '../utils/format'
import { TT } from '../components/ui/DarkTooltip'
const FUNNEL_COLORS = ['#B9915B', '#A07848', '#885F36', '#6F4724', '#572F13']

const TABS = [
  { id: 'pixel',    label: 'Pixel',      icon: Layers },
  { id: 'audience', label: 'Audiência',  icon: Users  },
  { id: 'creative', label: 'Criativos',  icon: Monitor },
]

const PERIOD_OPTIONS = [
  { label: 'Hoje', days: 1  },
  { label: '7d',   days: 7  },
  { label: '15d',  days: 15 },
  { label: '30d',  days: 30 },
  { label: '90d',  days: 90 },
]

// ── Paleta de gênero / plataforma ─────────────────────────────────────────────
const GENDER_COLOR = { male: '#6366F1', female: '#EC4899', unknown: '#6B7280' }
const PLATFORM_COLOR = {
  instagram: '#E1306C',
  facebook:  '#1877F2',
  messenger: '#0084FF',
  threads:   '#1C1C1C',
  'audience_network': '#9CA3AF',
}
const AGE_COLORS = ['#B9915B','#A07848','#6366F1','#8B5CF6','#06B6D4','#22C55E']

// ── CPL badge ─────────────────────────────────────────────────────────────────
function CplBadge({ cpl }) {
  if (cpl === null || cpl === undefined) return <span style={{ color: '#6B7280', fontSize: 12 }}>—</span>
  const color = cpl < 150 ? '#22C55E' : cpl < 300 ? '#F59E0B' : '#EF4444'
  return <span style={{ color, fontWeight: 700, fontSize: 13 }}>{fmtMoney(cpl)}</span>
}

// ── Colunas de KPIs por plataforma ─────────────────────────────────────────────
function PlatformCard({ p }) {
  const color = PLATFORM_COLOR[p.platform] || '#9CA3AF'
  const label = p.platform.charAt(0).toUpperCase() + p.platform.slice(1)
  return (
    <div style={{
      background: '#031A26', border: `1px solid ${color}44`,
      borderRadius: 10, padding: '16px 18px',
    }}>
      <div style={{ fontSize: 13, fontWeight: 700, color, marginBottom: 12 }}>{label}</div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        {[
          { label: 'Investido',  value: fmtMoney(p.spend) },
          { label: 'Leads',      value: fmtNum(p.leads) },
          { label: 'CPL',        value: <CplBadge cpl={p.cpl} /> },
          { label: 'CPM',        value: fmtMoney(p.cpm) },
          { label: 'CTR',        value: `${p.ctr}%` },
          { label: 'Alcance',    value: fmtNum(p.reach) },
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

// ── Tab Audiência ──────────────────────────────────────────────────────────────
function TabAudience({ data, days }) {
  const [view, setView] = useState('heatmap') // 'heatmap' | 'chart'
  if (!data) return null

  const ageRows = data.ageRows || []
  const platforms = data.platforms || []

  // Monta estrutura: { age, male: {spend,leads,cpl}, female: {...} }
  const ageMap = {}
  for (const r of ageRows) {
    if (!ageMap[r.age]) ageMap[r.age] = { age: r.age, male: null, female: null }
    ageMap[r.age][r.gender] = r
  }
  const ageBands = Object.keys(ageMap).sort()

  // Melhor segmento = menor CPL com leads > 0
  const withLeads = ageRows.filter(r => r.leads > 0 && r.cpl !== null)
  const bestCpl = withLeads.length ? withLeads.reduce((b, r) => (r.cpl < b.cpl ? r : b)) : null
  const mostLeads = ageRows.length ? ageRows.reduce((b, r) => (r.leads > b.leads ? r : b)) : null
  const totalSpend = ageRows.reduce((s, r) => s + r.spend, 0)
  const totalLeads = ageRows.reduce((s, r) => s + r.leads, 0)
  const totalCpl   = totalLeads > 0 ? Math.round(totalSpend / totalLeads) : null

  // Dados para gráfico de barras agrupado por faixa de idade
  const barData = ageBands.map(age => {
    const m = ageMap[age].male   || {}
    const f = ageMap[age].female || {}
    return {
      age,
      Male:   m.leads || 0,
      Female: f.leads || 0,
      MaleCpl:   m.cpl,
      FemaleCpl: f.cpl,
      MaleSpend: m.spend || 0,
      FemaleSpend: f.spend || 0,
    }
  })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {data.mock && <div style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: 6, padding: '6px 14px', fontSize: 11, color: '#F59E0B' }}>MOCK — conecte o token Meta para dados reais</div>}

      {/* KPIs de topo */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
        {[
          { label: 'Total investido', value: fmtMoney(totalSpend), sub: `${days}d (3 contas)`, color: '#B9915B' },
          { label: 'Total leads',     value: fmtNum(totalLeads),    sub: `${days}d`,          color: '#6366F1' },
          { label: 'CPL médio',       value: <CplBadge cpl={totalCpl} />, sub: 'geral',        color: '#F59E0B' },
          { label: 'Melhor segmento', value: bestCpl ? `${bestCpl.age} · ${bestCpl.gender === 'male' ? 'H' : 'M'}` : '—', sub: bestCpl ? `CPL ${fmtMoney(bestCpl.cpl)}` : '', color: '#22C55E' },
        ].map((k, i) => (
          <Card key={i}>
            <CardBody style={{ padding: '14px 16px' }}>
              <div style={{ fontSize: 20, fontWeight: 800, color: '#F5F4F3', lineHeight: 1 }}>{k.value}</div>
              <div style={{ fontSize: 11, color: k.color, marginTop: 4, fontWeight: 600 }}>{k.label}</div>
              <div style={{ fontSize: 10, color: '#8A9BAA', marginTop: 2 }}>{k.sub}</div>
            </CardBody>
          </Card>
        ))}
      </div>

      {/* Heatmap + Chart toggle */}
      <Card>
        <CardHeader
          title="Leads por faixa etária e gênero"
          subtitle={`Período: ${days}d · ${ageRows.filter(r => r.gender !== 'unknown').length} segmentos`}
          action={
            <div style={{ display: 'flex', gap: 4 }}>
              {[{id:'heatmap', label:'Heatmap'}, {id:'chart', label:'Barras'}].map(v => (
                <button key={v.id} onClick={() => setView(v.id)} style={{
                  padding: '4px 10px', borderRadius: 5, fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'Manrope, sans-serif',
                  background: view === v.id ? 'rgba(185,145,91,0.15)' : 'transparent',
                  border: `1px solid ${view === v.id ? 'rgba(185,145,91,0.5)' : 'rgba(185,145,91,0.15)'}`,
                  color: view === v.id ? '#B9915B' : '#8A9BAA',
                }}>
                  {v.label}
                </button>
              ))}
            </div>
          }
        />
        <CardBody>
          {view === 'heatmap' ? (
            // Heatmap de CPL: linhas = faixas etárias, colunas = H/M
            <div>
              {/* Header colunas */}
              <div style={{ display: 'grid', gridTemplateColumns: '80px 1fr 1fr', gap: 8, marginBottom: 8 }}>
                <div />
                {['Homens', 'Mulheres'].map(g => (
                  <div key={g} style={{ textAlign: 'center', fontSize: 11, color: '#8A9BAA', fontWeight: 700 }}>{g}</div>
                ))}
              </div>
              {ageBands.map(age => {
                const m = ageMap[age].male
                const f = ageMap[age].female
                // Cor do CPL: verde=bom, amarelo=médio, vermelho=alto
                const cellBg = (cpl) => {
                  if (!cpl) return 'rgba(255,255,255,0.03)'
                  if (cpl < 150) return 'rgba(34,197,94,0.12)'
                  if (cpl < 300) return 'rgba(245,158,11,0.10)'
                  return 'rgba(239,68,68,0.10)'
                }
                const cellBorder = (cpl) => {
                  if (!cpl) return 'rgba(255,255,255,0.06)'
                  if (cpl < 150) return 'rgba(34,197,94,0.3)'
                  if (cpl < 300) return 'rgba(245,158,11,0.25)'
                  return 'rgba(239,68,68,0.25)'
                }
                return (
                  <div key={age} style={{ display: 'grid', gridTemplateColumns: '80px 1fr 1fr', gap: 8, marginBottom: 8 }}>
                    <div style={{ display: 'flex', alignItems: 'center', fontSize: 12, color: '#F5F4F3', fontWeight: 700 }}>{age}</div>
                    {[m, f].map((row, gi) => {
                      if (!row) return <div key={gi} style={{ borderRadius: 8, padding: '10px 14px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)', color: '#6B7280', fontSize: 11, textAlign: 'center' }}>—</div>
                      return (
                        <div key={gi} style={{ borderRadius: 8, padding: '10px 14px', background: cellBg(row.cpl), border: `1px solid ${cellBorder(row.cpl)}` }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                            <span style={{ fontSize: 12, fontWeight: 700, color: '#F5F4F3' }}>{fmtNum(row.leads)} leads</span>
                            <CplBadge cpl={row.cpl} />
                          </div>
                          <div style={{ display: 'flex', gap: 10, fontSize: 10, color: '#8A9BAA' }}>
                            <span>{fmtMoney(row.spend)}</span>
                            <span>CTR {row.ctr}%</span>
                            <span>CPM {fmtMoney(row.cpm)}</span>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )
              })}
              <div style={{ display: 'flex', gap: 16, marginTop: 12, fontSize: 11, color: '#6B7280' }}>
                <span><span style={{ color: '#22C55E' }}>●</span> CPL &lt; R$150</span>
                <span><span style={{ color: '#F59E0B' }}>●</span> R$150–300</span>
                <span><span style={{ color: '#EF4444' }}>●</span> &gt; R$300</span>
              </div>
            </div>
          ) : (
            // Gráfico de barras: leads por faixa, agrupado H/M
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={barData} margin={{ top: 4, right: 12, left: 0, bottom: 0 }}>
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
                        <div style={{ color: GENDER_COLOR.male }}>Homens: {fmtNum(d.Male)} leads · CPL {fmtMoney(d.MaleCpl)} · {fmtMoney(d.MaleSpend)}</div>
                        <div style={{ color: GENDER_COLOR.female }}>Mulheres: {fmtNum(d.Female)} leads · CPL {fmtMoney(d.FemaleCpl)} · {fmtMoney(d.FemaleSpend)}</div>
                      </div>
                    )
                  }}
                />
                <Bar dataKey="Male"   name="Homens"  fill={GENDER_COLOR.male}   radius={[3,3,0,0]} />
                <Bar dataKey="Female" name="Mulheres" fill={GENDER_COLOR.female} radius={[3,3,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardBody>
      </Card>

      {/* Plataformas */}
      <div>
        <div style={{ fontSize: 13, fontWeight: 700, color: '#F5F4F3', marginBottom: 12 }}>Performance por plataforma — {days}d</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 12 }}>
          {platforms.map(p => <PlatformCard key={p.platform} p={p} />)}
        </div>
      </div>

      {/* ── Comparação de perfis ── */}
      {(() => {
        const ranked = ageRows
          .filter(r => r.gender !== 'unknown' && r.leads > 0 && r.cpl)
          .slice()
          .sort((a, b) => a.cpl - b.cpl) // melhor CPL primeiro

        if (ranked.length === 0) return null

        const worstCpl  = Math.max(...ranked.map(r => r.cpl))
        const bestCplVal = ranked[0].cpl
        const totalSpendAll = ageRows.reduce((s, r) => s + r.spend, 0)
        const totalLeadsAll = ageRows.reduce((s, r) => s + r.leads, 0)

        // Detecta desalinhamentos: segmento com % gasto >> % leads
        const misaligned = ageRows
          .filter(r => r.gender !== 'unknown' && totalSpendAll > 0 && totalLeadsAll > 0)
          .map(r => ({
            ...r,
            spendShare: (r.spend / totalSpendAll) * 100,
            leadsShare: (r.leads / totalLeadsAll) * 100,
            gap: ((r.spend / totalSpendAll) - (r.leads / totalLeadsAll)) * 100,
          }))
          .filter(r => r.gap > 5) // gasto 5pp+ acima da contribuição em leads
          .sort((a, b) => b.gap - a.gap)
          .slice(0, 3)

        return (
          <Card>
            <CardHeader
              title="Comparação de perfis"
              subtitle="Ranking de eficiência e distribuição de orçamento por segmento"
            />
            <CardBody style={{ padding: '16px' }}>

              {/* Alerta de desalinhamento */}
              {misaligned.length > 0 && (
                <div style={{
                  marginBottom: 16, padding: '10px 14px',
                  background: 'rgba(245,158,11,0.07)', border: '1px solid rgba(245,158,11,0.2)',
                  borderRadius: 8, fontSize: 12, color: '#FCD34D', lineHeight: 1.5,
                }}>
                  ⚠ <strong>{misaligned.length} {misaligned.length === 1 ? 'segmento consome' : 'segmentos consomem'} orçamento desproporcional ao retorno:</strong>{' '}
                  {misaligned.map(r => {
                    const gLabel = r.gender === 'male' ? 'H' : 'M'
                    return `${r.age} ${gLabel} (${r.spendShare.toFixed(0)}% gasto → ${r.leadsShare.toFixed(0)}% leads)`
                  }).join(' · ')}
                </div>
              )}

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>

                {/* Ranking de eficiência (CPL) */}
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#8A9BAA', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>
                    Ranking por CPL — melhores primeiro
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {ranked.map((r, i) => {
                      const gColor = GENDER_COLOR[r.gender]
                      const gLabel = r.gender === 'male' ? 'H' : 'M'
                      // Barra: 100% = pior CPL, boa = estreita (CPL baixo)
                      const barW = Math.round((r.cpl / worstCpl) * 100)
                      const barColor = i === 0 ? '#22C55E' : i < 3 ? '#B9915B' : r.cpl > worstCpl * 0.75 ? '#EF4444' : '#6366F1'
                      return (
                        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <span style={{ fontSize: 11, color: '#6B7280', width: 16, textAlign: 'right', flexShrink: 0 }}>#{i + 1}</span>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, width: 72, flexShrink: 0 }}>
                            <span style={{ fontSize: 12, fontWeight: 700, color: '#F5F4F3' }}>{r.age}</span>
                            <span style={{ fontSize: 10, fontWeight: 700, color: gColor, background: gColor + '22', borderRadius: 4, padding: '1px 5px' }}>{gLabel}</span>
                          </div>
                          <div style={{ flex: 1, height: 6, background: 'rgba(255,255,255,0.05)', borderRadius: 3 }}>
                            <div style={{ height: 6, borderRadius: 3, background: barColor, width: `${barW}%`, transition: 'width 0.4s' }} />
                          </div>
                          <span style={{ fontSize: 12, fontWeight: 700, color: barColor, width: 56, textAlign: 'right', flexShrink: 0 }}>{fmtMoney(r.cpl)}</span>
                          <span style={{ fontSize: 10, color: '#6B7280', width: 48, textAlign: 'right', flexShrink: 0 }}>{fmtNum(r.leads)} leads</span>
                        </div>
                      )
                    })}
                  </div>
                </div>

                {/* Distribuição gasto vs. leads */}
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#8A9BAA', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>
                    Distribuição — gasto vs. leads gerados
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {ageRows
                      .filter(r => r.gender !== 'unknown')
                      .sort((a, b) => b.spend - a.spend)
                      .slice(0, 7)
                      .map((r, i) => {
                        const gColor = GENDER_COLOR[r.gender]
                        const gLabel = r.gender === 'male' ? 'H' : 'M'
                        const spendPct = totalSpendAll > 0 ? (r.spend / totalSpendAll) * 100 : 0
                        const leadsPct = totalLeadsAll > 0 ? (r.leads / totalLeadsAll) * 100 : 0
                        const gap = spendPct - leadsPct
                        const gapColor = gap > 5 ? '#F59E0B' : gap < -5 ? '#22C55E' : '#6B7280'
                        return (
                          <div key={i}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                <span style={{ fontSize: 11, fontWeight: 700, color: '#F5F4F3' }}>{r.age}</span>
                                <span style={{ fontSize: 10, color: gColor, background: gColor + '22', borderRadius: 4, padding: '1px 5px', fontWeight: 700 }}>{gLabel}</span>
                              </div>
                              <span style={{ fontSize: 10, color: gapColor, fontWeight: 700 }}>
                                {gap > 0 ? '+' : ''}{gap.toFixed(1)}pp
                              </span>
                            </div>
                            <div style={{ position: 'relative', height: 5, background: 'rgba(255,255,255,0.04)', borderRadius: 3, marginBottom: 1 }}>
                              <div style={{ position: 'absolute', height: '100%', borderRadius: 3, background: '#B9915B', width: `${spendPct}%`, opacity: 0.8 }} />
                            </div>
                            <div style={{ position: 'relative', height: 5, background: 'rgba(255,255,255,0.04)', borderRadius: 3 }}>
                              <div style={{ position: 'absolute', height: '100%', borderRadius: 3, background: '#6366F1', width: `${leadsPct}%`, opacity: 0.8 }} />
                            </div>
                          </div>
                        )
                      })
                    }
                    <div style={{ display: 'flex', gap: 14, marginTop: 4, fontSize: 10, color: '#6B7280' }}>
                      <span><span style={{ color: '#B9915B' }}>━</span> % do gasto</span>
                      <span><span style={{ color: '#6366F1' }}>━</span> % dos leads</span>
                      <span style={{ color: '#F59E0B' }}>+pp = gasto desproporcional</span>
                    </div>
                  </div>
                </div>

              </div>
            </CardBody>
          </Card>
        )
      })()}

      {/* Tabela detalhada de segmentos */}
      <Card>
        <CardHeader title="Todos os segmentos" subtitle="Ordenados por investimento" />
        <CardBody style={{ padding: 0 }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(185,145,91,0.15)' }}>
                  {['Faixa / Gênero','Investido','Leads','CPL','CPM','CTR','Alcance'].map(h => (
                    <th key={h} style={{ padding: '10px 14px', textAlign: h === 'Faixa / Gênero' ? 'left' : 'right', fontSize: 11, color: '#8A9BAA', fontWeight: 600, whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {ageRows.filter(r => r.gender !== 'unknown').map((r, i) => {
                  const gColor = GENDER_COLOR[r.gender] || '#9CA3AF'
                  return (
                    <tr key={i} style={{ borderBottom: '1px solid rgba(185,145,91,0.06)' }}>
                      <td style={{ padding: '9px 14px' }}>
                        <span style={{ fontSize: 12, fontWeight: 700, color: '#F5F4F3' }}>{r.age}</span>
                        <span style={{ marginLeft: 8, fontSize: 11, color: gColor, background: gColor + '22', borderRadius: 4, padding: '1px 6px' }}>
                          {r.gender === 'male' ? 'H' : 'M'}
                        </span>
                      </td>
                      <td style={{ padding: '9px 14px', textAlign: 'right', color: '#F5F4F3' }}>{fmtMoney(r.spend)}</td>
                      <td style={{ padding: '9px 14px', textAlign: 'right', color: '#6366F1', fontWeight: 700 }}>{fmtNum(r.leads)}</td>
                      <td style={{ padding: '9px 14px', textAlign: 'right' }}><CplBadge cpl={r.cpl} /></td>
                      <td style={{ padding: '9px 14px', textAlign: 'right', color: '#9CA3AF' }}>{fmtMoney(r.cpm)}</td>
                      <td style={{ padding: '9px 14px', textAlign: 'right', color: '#9CA3AF' }}>{r.ctr}%</td>
                      <td style={{ padding: '9px 14px', textAlign: 'right', color: '#9CA3AF' }}>{fmtNum(r.reach)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </CardBody>
      </Card>
    </div>
  )
}

// ── Tab Criativos ──────────────────────────────────────────────────────────────
function TabCreative({ data, days }) {
  const [sortBy, setSortBy] = useState('spend') // spend | leads | cpl | ctr
  if (!data) return null

  const ads = (data.ads || []).slice().sort((a, b) => {
    if (sortBy === 'cpl')  return (a.cpl ?? 99999) - (b.cpl ?? 99999)
    if (sortBy === 'leads') return b.leads - a.leads
    if (sortBy === 'ctr')   return b.ctr - a.ctr
    return b.spend - a.spend
  })

  const maxSpend = Math.max(...ads.map(a => a.spend), 1)

  // Extrai tipo do criativo a partir do nome (estático, vídeo, carrossel)
  function creativeType(name) {
    const n = (name || '').toLowerCase()
    if (n.includes('video') || n.includes('video'))  return { label: 'Vídeo', color: '#6366F1' }
    if (n.includes('carrossel') || n.includes('carousel')) return { label: 'Carrossel', color: '#8B5CF6' }
    if (n.includes('estatico') || n.includes('png') || n.includes('jpg')) return { label: 'Estático', color: '#B9915B' }
    if (n.includes('dinamico') || n.includes('dynamic')) return { label: 'Dinâmico', color: '#06B6D4' }
    return { label: 'Anúncio', color: '#9CA3AF' }
  }

  // KPIs de resumo
  const totalSpend = ads.reduce((s, a) => s + a.spend, 0)
  const totalLeads = ads.reduce((s, a) => s + a.leads, 0)
  const totalCpl   = totalLeads > 0 ? Math.round(totalSpend / totalLeads) : null
  const bestAd = ads.filter(a => a.cpl && a.leads >= 10).sort((a, b) => a.cpl - b.cpl)[0]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {data.mock && <div style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: 6, padding: '6px 14px', fontSize: 11, color: '#F59E0B' }}>MOCK</div>}

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
        {[
          { label: `Top ${ads.length} anúncios`, value: `${ads.length} ads`, sub: `${days}d por gasto`, color: '#B9915B' },
          { label: 'Total investido', value: fmtMoney(totalSpend), sub: 'nos top ads', color: '#F59E0B' },
          { label: 'Total leads', value: fmtNum(totalLeads), sub: 'atribuídos', color: '#6366F1' },
          { label: 'Melhor CPL', value: bestAd ? fmtMoney(bestAd.cpl) : '—', sub: bestAd ? bestAd.name?.slice(0, 30) + '…' : '', color: '#22C55E' },
        ].map((k, i) => (
          <Card key={i}>
            <CardBody style={{ padding: '14px 16px' }}>
              <div style={{ fontSize: 20, fontWeight: 800, color: '#F5F4F3', lineHeight: 1 }}>{k.value}</div>
              <div style={{ fontSize: 11, color: k.color, marginTop: 4, fontWeight: 600 }}>{k.label}</div>
              <div style={{ fontSize: 10, color: '#8A9BAA', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{k.sub}</div>
            </CardBody>
          </Card>
        ))}
      </div>

      {/* Gráfico de barras: investimento por ad (top 10) */}
      <Card>
        <CardHeader title="Investimento por anúncio — top 10" subtitle="Volume de gasto e leads por criativo" />
        <CardBody>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={ads.slice(0, 10).map(a => ({ ...a, shortName: a.name?.slice(0, 28) || a.id }))} layout="vertical" margin={{ top: 0, right: 14, left: 8, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" horizontal={false} />
              <XAxis type="number" tick={{ fill: '#8A9BAA', fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={v => fmtMoney(v)} />
              <YAxis type="category" dataKey="shortName" width={180} tick={{ fill: '#D1D5DB', fontSize: 10 }} axisLine={false} tickLine={false} />
              <Tooltip
                cursor={TT.cursorBar}
                content={({ active, payload }) => {
                  if (!active || !payload?.length) return null
                  const d = payload[0]?.payload
                  return (
                    <div style={{ ...TT.contentStyle, maxWidth: 320 }}>
                      <div style={{ fontWeight: 700, marginBottom: 4, fontSize: 11, color: '#F5F4F3' }}>{d.name}</div>
                      <div style={{ color: '#B9915B' }}>Gasto: {fmtMoney(d.spend)}</div>
                      <div style={{ color: '#6366F1' }}>Leads: {fmtNum(d.leads)}</div>
                      <div style={{ color: '#22C55E' }}>CPL: {fmtMoney(d.cpl)}</div>
                      <div style={{ color: '#9CA3AF' }}>CTR: {d.ctr}% · CPM: {fmtMoney(d.cpm)} · Freq: {d.frequency?.toFixed(1)}</div>
                      <div style={{ color: '#6B7280', fontSize: 10, marginTop: 2 }}>{d.campaign}</div>
                    </div>
                  )
                }}
              />
              <Bar dataKey="spend" name="Investimento" radius={[0,4,4,0]}>
                {ads.slice(0,10).map((a, i) => (
                  <Cell key={i} fill={creativeType(a.name).color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </CardBody>
      </Card>

      {/* ── Frequência vs. Cansaço Criativo ── */}
      {ads.filter(a => a.frequency > 0 && a.reach > 0).length > 0 && (() => {
        // Classifica anúncios: saturado (freq > 4 + CTR caindo), em alerta (freq > 3), saudável
        const adsWithFreq = ads.filter(a => a.frequency > 0 && a.reach > 0)
        const avgCtr = adsWithFreq.reduce((s, a) => s + (a.ctr || 0), 0) / adsWithFreq.length

        function fatigueLevel(ad) {
          if (ad.frequency >= 4 && ad.ctr < avgCtr * 0.7) return 'saturado'
          if (ad.frequency >= 3)                           return 'alerta'
          return 'saudavel'
        }

        const saturados = adsWithFreq.filter(a => fatigueLevel(a) === 'saturado').sort((a, b) => b.frequency - a.frequency)
        const alertas   = adsWithFreq.filter(a => fatigueLevel(a) === 'alerta').sort((a, b) => b.frequency - a.frequency)
        const saudaveis = adsWithFreq.filter(a => fatigueLevel(a) === 'saudavel').sort((a, b) => b.ctr - a.ctr)

        const hasFatigue = saturados.length > 0 || alertas.length > 0

        return (
          <Card>
            <CardHeader
              title="Frequência vs. Cansaço Criativo"
              subtitle="Anúncios com alta frequência e CTR em queda indicam saturação de audiência"
              action={hasFatigue
                ? <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 10, background: 'rgba(239,68,68,0.1)', color: '#EF4444', fontWeight: 700 }}>{saturados.length} saturado{saturados.length !== 1 ? 's' : ''}</span>
                : <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 10, background: 'rgba(34,197,94,0.1)', color: '#22C55E', fontWeight: 700 }}>Saudável</span>
              }
            />
            <CardBody style={{ padding: 0 }}>
              {hasFatigue && (
                <div style={{ margin: '12px 16px 0', padding: '10px 14px', background: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 8, fontSize: 12, color: '#FCA5A5', lineHeight: 1.5 }}>
                  ⚠ <strong>{saturados.length} anúncio{saturados.length !== 1 ? 's' : ''} saturado{saturados.length !== 1 ? 's' : ''}</strong> — frequência ≥ 4 com CTR abaixo de {(avgCtr * 0.7).toFixed(2)}% (70% da média). Considere pausar ou renovar o criativo.
                </div>
              )}
              <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 6 }}>
                {[
                  { list: saturados, label: 'Saturado', color: '#EF4444', bg: 'rgba(239,68,68,0.06)', border: 'rgba(239,68,68,0.2)' },
                  { list: alertas,   label: 'Em alerta', color: '#F59E0B', bg: 'rgba(245,158,11,0.06)', border: 'rgba(245,158,11,0.2)' },
                  { list: saudaveis.slice(0, 5), label: 'Saudável', color: '#22C55E', bg: 'rgba(34,197,94,0.04)', border: 'rgba(34,197,94,0.1)' },
                ].map(({ list, label, color, bg, border }) =>
                  list.map((ad, i) => {
                    const freqBarW = Math.min((ad.frequency / 8) * 100, 100)
                    const ctrRatio = avgCtr > 0 ? ad.ctr / avgCtr : 1
                    return (
                      <div key={ad.id || i} style={{
                        display: 'grid', gridTemplateColumns: '1fr 90px 90px 90px',
                        alignItems: 'center', gap: 12,
                        padding: '10px 14px',
                        background: bg, border: `1px solid ${border}`, borderRadius: 8,
                      }}>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                            <span style={{ fontSize: 10, fontWeight: 700, padding: '1px 7px', borderRadius: 8, background: color + '22', color }}>{label}</span>
                            <span style={{ fontSize: 11, fontWeight: 600, color: '#F5F4F3', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={ad.name}>
                              {ad.name?.slice(0, 45)}{ad.name?.length > 45 ? '…' : ''}
                            </span>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <div style={{ flex: 1, height: 4, background: 'rgba(255,255,255,0.06)', borderRadius: 2 }}>
                              <div style={{ width: `${freqBarW}%`, height: '100%', background: color, borderRadius: 2 }} />
                            </div>
                            <span style={{ fontSize: 9, color: '#6B7280', whiteSpace: 'nowrap' }}>{fmtNum(ad.reach)} alcance</span>
                          </div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontSize: 14, fontWeight: 800, color }}>{ad.frequency?.toFixed(1)}×</div>
                          <div style={{ fontSize: 9, color: '#6B7280' }}>frequência</div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontSize: 14, fontWeight: 800, color: ctrRatio < 0.7 ? '#EF4444' : ctrRatio < 1 ? '#F59E0B' : '#22C55E' }}>{ad.ctr?.toFixed(2)}%</div>
                          <div style={{ fontSize: 9, color: '#6B7280' }}>CTR</div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontSize: 13, fontWeight: 700, color: '#F5F4F3' }}>{fmtMoney(ad.spend)}</div>
                          <div style={{ fontSize: 9, color: '#6B7280' }}>gasto {days}d</div>
                        </div>
                      </div>
                    )
                  })
                )}
              </div>
              <div style={{ padding: '6px 16px 12px', borderTop: '1px solid rgba(185,145,91,0.06)', fontSize: 10, color: '#6B7280' }}>
                Saturado = frequência ≥ 4 + CTR &lt; 70% da média · Em alerta = frequência ≥ 3 · Saudável = abaixo de 3.
              </div>
            </CardBody>
          </Card>
        )
      })()}

      {/* Tabela completa */}
      <Card>
        <CardHeader
          title="Comparação de criativos"
          subtitle="Todos os anúncios com investimento > R$100"
          action={
            <div style={{ display: 'flex', gap: 4 }}>
              {[
                { id: 'spend', label: 'Gasto' },
                { id: 'leads', label: 'Leads' },
                { id: 'cpl',   label: 'CPL' },
                { id: 'ctr',   label: 'CTR' },
              ].map(s => (
                <button key={s.id} onClick={() => setSortBy(s.id)} style={{
                  padding: '4px 10px', borderRadius: 5, fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'Manrope, sans-serif',
                  background: sortBy === s.id ? 'rgba(185,145,91,0.15)' : 'transparent',
                  border: `1px solid ${sortBy === s.id ? 'rgba(185,145,91,0.5)' : 'rgba(185,145,91,0.15)'}`,
                  color: sortBy === s.id ? '#B9915B' : '#8A9BAA',
                }}>
                  {s.label}
                </button>
              ))}
            </div>
          }
        />
        <CardBody style={{ padding: 0 }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(185,145,91,0.15)' }}>
                  {['Anúncio','Tipo','Campanha','Gasto','Leads','CPL','CTR','CPM','Freq','Alcance','Gasto%'].map(h => (
                    <th key={h} style={{ padding: '10px 12px', textAlign: h === 'Anúncio' || h === 'Campanha' ? 'left' : 'right', fontSize: 11, color: '#8A9BAA', fontWeight: 600, whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {ads.map((ad, i) => {
                  const type = creativeType(ad.name)
                  const spendPct = totalSpend > 0 ? Math.round((ad.spend / totalSpend) * 100) : 0
                  return (
                    <tr key={i} style={{ borderBottom: '1px solid rgba(185,145,91,0.06)', background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.01)' }}>
                      <td style={{ padding: '9px 12px', maxWidth: 220 }}>
                        <div style={{ fontSize: 12, color: '#F5F4F3', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontFamily: 'monospace' }} title={ad.name}>
                          {ad.name?.slice(0, 40)}{ad.name?.length > 40 ? '…' : ''}
                        </div>
                        <div style={{ fontSize: 10, color: '#6B7280', marginTop: 1 }}>{ad.adset?.slice(0,40)}</div>
                      </td>
                      <td style={{ padding: '9px 12px', textAlign: 'right' }}>
                        <span style={{ fontSize: 10, fontWeight: 700, borderRadius: 4, padding: '2px 6px', background: type.color + '22', color: type.color }}>
                          {type.label}
                        </span>
                      </td>
                      <td style={{ padding: '9px 12px', color: '#9CA3AF', maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={ad.campaign}>
                        {ad.campaign?.slice(0, 25)}{ad.campaign?.length > 25 ? '…' : ''}
                      </td>
                      <td style={{ padding: '9px 12px', textAlign: 'right', color: '#F5F4F3', fontWeight: 700 }}>{fmtMoney(ad.spend)}</td>
                      <td style={{ padding: '9px 12px', textAlign: 'right', color: ad.leads > 0 ? '#6366F1' : '#6B7280', fontWeight: 700 }}>{fmtNum(ad.leads)}</td>
                      <td style={{ padding: '9px 12px', textAlign: 'right' }}><CplBadge cpl={ad.cpl} /></td>
                      <td style={{ padding: '9px 12px', textAlign: 'right', color: ad.ctr > 1 ? '#22C55E' : '#9CA3AF' }}>{ad.ctr?.toFixed(2)}%</td>
                      <td style={{ padding: '9px 12px', textAlign: 'right', color: '#9CA3AF' }}>{fmtMoney(ad.cpm)}</td>
                      <td style={{ padding: '9px 12px', textAlign: 'right', color: ad.frequency > 3 ? '#F59E0B' : '#9CA3AF' }}>{ad.frequency?.toFixed(1)}</td>
                      <td style={{ padding: '9px 12px', textAlign: 'right', color: '#9CA3AF' }}>{fmtNum(ad.reach)}</td>
                      <td style={{ padding: '9px 12px', textAlign: 'right' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'flex-end' }}>
                          <span style={{ fontSize: 11, color: '#B9915B' }}>{spendPct}%</span>
                          <div style={{ width: 40, height: 4, background: 'rgba(255,255,255,0.06)', borderRadius: 2, overflow: 'hidden' }}>
                            <div style={{ width: `${spendPct}%`, height: '100%', background: '#B9915B', borderRadius: 2 }} />
                          </div>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </CardBody>
      </Card>
    </div>
  )

  function creativeType(name) {
    const n = (name || '').toLowerCase()
    if (n.includes('video'))  return { label: 'Vídeo', color: '#6366F1' }
    if (n.includes('carrossel') || n.includes('carousel')) return { label: 'Carrossel', color: '#8B5CF6' }
    if (n.includes('estatico') || n.includes('png') || n.includes('jpg')) return { label: 'Estático', color: '#B9915B' }
    if (n.includes('dinamico') || n.includes('dynamic')) return { label: 'Dinâmico', color: '#06B6D4' }
    return { label: 'Anúncio', color: '#9CA3AF' }
  }
}

// ── Event Match Quality ────────────────────────────────────────────────────────
function EventMatchQuality({ emq }) {
  const navigate = useNavigate()

  // Token não configurado → banner de configuração
  if (!emq || emq.mock) {
    return (
      <div style={{ border: '1px dashed rgba(185,145,91,0.2)', borderRadius: 10, padding: '28px 24px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, textAlign: 'center' }}>
        <PlugZap size={26} color="rgba(185,145,91,0.4)" />
        <div style={{ fontSize: 13, fontWeight: 700, color: '#8A9BAA' }}>Qualidade de correspondência de eventos indisponível</div>
        <div style={{ fontSize: 12, color: '#6B7280', maxWidth: 380 }}>Configure o token Meta Ads para ver o Event Match Quality por evento (EMQ).</div>
        <button onClick={() => navigate('/settings')} style={{ marginTop: 4, padding: '6px 16px', borderRadius: 6, border: '1px solid rgba(185,145,91,0.35)', background: 'rgba(185,145,91,0.08)', color: '#B9915B', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'Manrope, sans-serif' }}>
          Configurar em Conexões →
        </button>
      </div>
    )
  }

  // API não suporta EMQ para esse pixel → oculta silenciosamente
  if (emq.unavailable) return null

  const events = emq.events || []
  if (events.length === 0) return null

  const qualityColor = (q) => {
    if (q === 'Excelente') return '#22C55E'
    if (q === 'Alto')      return '#84CC16'
    if (q === 'Médio')     return '#F59E0B'
    return '#EF4444'
  }
  const qualityBg = (q) => {
    if (q === 'Excelente') return 'rgba(34,197,94,0.10)'
    if (q === 'Alto')      return 'rgba(132,204,22,0.10)'
    if (q === 'Médio')     return 'rgba(245,158,11,0.10)'
    return 'rgba(239,68,68,0.10)'
  }

  // Média geral ponderada por volume
  const totalReceived = events.reduce((s, e) => s + e.received, 0)
  const avgRate = totalReceived > 0
    ? Math.round(events.reduce((s, e) => s + e.matchRate * e.received, 0) / totalReceived)
    : 0
  const avgQuality = avgRate >= 90 ? 'Excelente' : avgRate >= 80 ? 'Alto' : avgRate >= 70 ? 'Médio' : 'Baixo'

  return (
    <Card>
      <CardHeader
        title="Qualidade de correspondência de eventos (EMQ)"
        subtitle="Eficácia das informações do cliente nas instâncias de correspondência com contas Meta"
        action={
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <ShieldCheck size={14} color={qualityColor(avgQuality)} />
            <span style={{ fontSize: 12, fontWeight: 700, color: qualityColor(avgQuality) }}>{avgRate}% média</span>
            <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 10, fontWeight: 700, background: qualityBg(avgQuality), color: qualityColor(avgQuality) }}>{avgQuality}</span>
          </div>
        }
      />
      <CardBody style={{ padding: 0 }}>
        <div style={{ padding: '0 16px 4px' }}>
          {/* Legenda */}
          <div style={{ display: 'flex', gap: 16, padding: '10px 0 12px', fontSize: 11, color: '#6B7280', borderBottom: '1px solid rgba(185,145,91,0.08)', marginBottom: 4 }}>
            <span><span style={{ color: '#22C55E', fontWeight: 700 }}>● Excelente</span> ≥ 90%</span>
            <span><span style={{ color: '#84CC16', fontWeight: 700 }}>● Alto</span> ≥ 80%</span>
            <span><span style={{ color: '#F59E0B', fontWeight: 700 }}>● Médio</span> ≥ 70%</span>
            <span><span style={{ color: '#EF4444', fontWeight: 700 }}>● Baixo</span> &lt; 70%</span>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
          {events.map((ev, i) => {
            const color  = qualityColor(ev.quality)
            const bg     = qualityBg(ev.quality)
            return (
              <div key={i} style={{
                display: 'grid', gridTemplateColumns: '160px 1fr 120px 90px',
                alignItems: 'center', gap: 16,
                padding: '12px 16px',
                borderBottom: i < events.length - 1 ? '1px solid rgba(185,145,91,0.06)' : 'none',
                background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.01)',
              }}>
                {/* Nome do evento */}
                <div style={{ fontSize: 12, fontWeight: 700, color: '#F5F4F3', fontFamily: 'monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={ev.name}>
                  {ev.name}
                </div>

                {/* Barra de progresso */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span style={{ fontSize: 10, color: '#8A9BAA' }}>
                      {ev.received !== null
                        ? `${ev.matched.toLocaleString('pt-BR')} correspondidos de ${ev.received.toLocaleString('pt-BR')}`
                        : 'Taxa agregada do pixel'}
                    </span>
                  </div>
                  <div style={{ height: 8, background: 'rgba(255,255,255,0.06)', borderRadius: 4, overflow: 'hidden' }}>
                    <div style={{ width: `${ev.matchRate}%`, height: '100%', background: color, borderRadius: 4, transition: 'width 0.6s ease' }} />
                  </div>
                </div>

                {/* Score */}
                <div style={{ textAlign: 'right' }}>
                  <span style={{ fontSize: 18, fontWeight: 800, color }}>
                    {ev.matchRate}%
                  </span>
                </div>

                {/* Badge qualidade */}
                <div style={{ textAlign: 'right' }}>
                  <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 10, background: bg, color }}>
                    {ev.quality}
                  </span>
                </div>
              </div>
            )
          })}
        </div>

        <div style={{ padding: '10px 16px 14px', borderTop: '1px solid rgba(185,145,91,0.06)', marginTop: 4 }}>
          <div style={{ fontSize: 11, color: '#6B7280', lineHeight: 1.5 }}>
            {emq.overallOnly
              ? 'Taxa agregada do pixel — detalhamento por evento requer acesso avançado ao Business Manager. Valores acima de 80% são considerados bons.'
              : 'O EMQ mede o percentual de eventos do servidor que conseguem ser correspondidos a uma conta Meta. Valores acima de 80% são considerados bons. Envie e-mail, telefone e outros identificadores para melhorar a taxa.'}
          </div>
        </div>
      </CardBody>
    </Card>
  )
}

// ── Página principal ───────────────────────────────────────────────────────────
export default function MetaPage() {
  const [tab, setTab]         = useState('pixel')
  const [days, setDays]       = useState(1)
  const [stats, setStats]     = useState(null)
  const [audience, setAudience] = useState(null)
  const [creatives, setCreatives] = useState(null)
  const [emq, setEmq]         = useState(null)
  const [loading, setLoading] = useState(true)
  const [lastUpdated, setLastUpdated] = useState(null)
  const [showModal, setShowModal] = useState(false)
  const [config, setConfig]   = useState(null)
  const [activeHourEvent, setActiveHourEvent] = useState('total')

  async function loadData() {
    setLoading(true)
    const [s, cfg, aud, cre, eq] = await Promise.all([
      api.metaStats(),
      api.getConfig(),
      api.metaAudience(days),
      api.metaCreatives(days),
      api.metaEvents(),
    ])
    setStats(s)
    setConfig(cfg)
    setAudience(aud)
    setCreatives(cre)
    setEmq(eq)
    setLoading(false)
    setLastUpdated(Date.now())
  }

  useEffect(() => { loadData() }, [days])

  const isMock     = stats?.mock ?? true
  const pixelId    = stats?.pixelId ?? config?.meta?.pixel_id ?? '—'
  const events     = stats?.events ?? []
  const funnel     = stats?.funnel ?? []
  const hourSeries = stats?.hourSeries ?? []
  const totalEvents = stats?.totalEvents ?? 0

  const fPV = funnel.find(f => f.stage === 'PageView')?.count  ?? 0
  const fLD = funnel.find(f => f.stage === 'Lead')?.count      ?? 0
  const fCO = funnel.find(f => f.stage === 'Checkout')?.count  ?? 0
  const fPU = funnel.find(f => f.stage === 'Purchase')?.count  ?? 0
  const fKPIs = [
    { label: 'Total de eventos', value: totalEvents.toLocaleString('pt-BR'),  sub: 'últimas 24h' },
    { label: 'PageViews',         value: fPV.toLocaleString('pt-BR'),          sub: 'sessões' },
    { label: 'Leads captados',    value: fLD.toLocaleString('pt-BR'),          sub: `${fPV > 0 ? (fLD/fPV*100).toFixed(2) : 0}% do tráfego` },
    { label: 'Checkouts',         value: fCO.toLocaleString('pt-BR'),          sub: `${fLD > 0 ? (fCO/fLD*100).toFixed(1) : 0}% dos leads` },
    { label: 'Purchases',         value: fPU.toLocaleString('pt-BR'),          sub: `${fCO > 0 ? (fPU/fCO*100).toFixed(1) : 0}% dos checkouts` },
  ]
  const maxFunnel = funnel[0]?.count || 1

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      <Header
        title="Meta Ads"
        subtitle={`Pixel ${pixelId} · 3 contas G4`}
        onRefresh={loadData}
        lastUpdated={lastUpdated}
        action={
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <PeriodSelect value={days} onChange={setDays} options={PERIOD_OPTIONS} />
            {!isMock && <span style={{ fontSize: 10, color: '#22C55E', background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.25)', padding: '2px 10px', borderRadius: 10, fontWeight: 700 }}>LIVE</span>}
            {isMock   && <span style={{ fontSize: 10, color: '#F59E0B', background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.25)', padding: '2px 10px', borderRadius: 10, fontWeight: 700 }}>MOCK</span>}
            <button onClick={() => setShowModal(true)} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 12px', borderRadius: 6, border: '1px solid rgba(185,145,91,0.4)', background: 'rgba(185,145,91,0.08)', color: '#B9915B', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'Manrope, sans-serif' }}>
              <Settings size={13} /> Configurar
            </button>
          </div>
        }
      />

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 2, padding: '0 clamp(12px, 2vw, 24px)', borderBottom: '1px solid rgba(185,145,91,0.12)', background: '#001420' }}>
        {TABS.map(t => {
          const Icon = t.icon
          return (
            <button key={t.id} onClick={() => setTab(t.id)} style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '10px 16px', background: 'none', border: 'none',
              borderBottom: `2px solid ${tab === t.id ? '#B9915B' : 'transparent'}`,
              color: tab === t.id ? '#B9915B' : '#8A9BAA',
              fontSize: 13, fontWeight: tab === t.id ? 700 : 500,
              cursor: 'pointer', fontFamily: 'Manrope, sans-serif',
              transition: 'all 0.15s',
            }}>
              <Icon size={14} />
              {t.label}
            </button>
          )
        })}
      </div>

      <div style={{ flex: 1, overflow: 'auto', padding: 'clamp(12px, 2vw, 24px)', minWidth: 0 }}>
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}><Spinner /></div>
        ) : (
          <>
            {/* ── Tab Pixel ─────────────────────────────────────────── */}
            {tab === 'pixel' && (
              <>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12, marginBottom: 20 }}>
                  {fKPIs.map((k, i) => (
                    <Card key={i}>
                      <CardBody style={{ padding: '14px 16px' }}>
                        <div style={{ fontSize: 20, fontWeight: 800, color: '#F5F4F3', lineHeight: 1 }}>{k.value}</div>
                        <div style={{ fontSize: 11, color: '#B9915B', marginTop: 4, fontWeight: 600 }}>{k.label}</div>
                        <div style={{ fontSize: 10, color: '#8A9BAA', marginTop: 2 }}>{k.sub}</div>
                      </CardBody>
                    </Card>
                  ))}
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
                  <Card>
                    <CardHeader title="Funil de conversão — 24h" />
                    <CardBody style={{ paddingTop: 8 }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                        {funnel.map((step, i) => {
                          const barPct = (step.count / maxFunnel) * 100
                          const isLast = i === funnel.length - 1
                          return (
                            <div key={step.stage}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                                <span style={{ fontSize: 12, color: '#F5F4F3', fontWeight: 600 }}>{step.stage}</span>
                                <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                                  <span style={{ fontSize: 12, color: '#F5F4F3', fontWeight: 700 }}>{step.count.toLocaleString('pt-BR')}</span>
                                  <span style={{ fontSize: 11, color: '#B9915B', minWidth: 60, textAlign: 'right' }}>{i === 0 ? '100%' : `${step.rate}%`}</span>
                                </div>
                              </div>
                              <div style={{ height: 10, background: 'rgba(255,255,255,0.05)', borderRadius: 5, overflow: 'hidden' }}>
                                <div style={{ width: `${barPct}%`, height: '100%', background: FUNNEL_COLORS[i], borderRadius: 5, transition: 'width 0.6s ease' }} />
                              </div>
                              {!isLast && <div style={{ fontSize: 10, color: '#8A9BAA', marginTop: 3, textAlign: 'right' }}>↓ próximo passo: {funnel[i+1]?.rate}% convertem</div>}
                            </div>
                          )
                        })}
                      </div>
                    </CardBody>
                  </Card>

                  <Card>
                    <CardHeader title="Volume por hora — hoje" action={
                      <div style={{ display: 'flex', gap: 6 }}>
                        {['total', 'leads', 'checkouts', 'purchases'].map(k => (
                          <button key={k} onClick={() => setActiveHourEvent(k)} style={{
                            padding: '2px 8px', borderRadius: 4, fontSize: 10, fontWeight: 600, cursor: 'pointer', fontFamily: 'Manrope, sans-serif',
                            border: `1px solid ${activeHourEvent === k ? '#B9915B' : 'rgba(185,145,91,0.2)'}`,
                            background: activeHourEvent === k ? 'rgba(185,145,91,0.12)' : 'transparent',
                            color: activeHourEvent === k ? '#B9915B' : '#8A9BAA',
                          }}>{k}</button>
                        ))}
                      </div>
                    } />
                    <CardBody style={{ paddingTop: 4 }}>
                      <ResponsiveContainer width="100%" height={180}>
                        <AreaChart data={hourSeries} margin={{ top: 4, right: 4, left: -28, bottom: 0 }}>
                          <defs>
                            <linearGradient id="hg" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#B9915B" stopOpacity={0.3} />
                              <stop offset="95%" stopColor="#B9915B" stopOpacity={0} />
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" stroke="#B9915B11" />
                          <XAxis dataKey="hour" tick={{ fontSize: 9, fill: '#8A9BAA' }} axisLine={false} tickLine={false} interval={3} />
                          <YAxis tick={{ fontSize: 9, fill: '#8A9BAA' }} axisLine={false} tickLine={false} />
                          <Tooltip contentStyle={TT.contentStyle} cursor={TT.cursorLine} />
                          <Area type="monotone" dataKey={activeHourEvent} name={activeHourEvent} stroke="#B9915B" fill="url(#hg)" strokeWidth={2} dot={false} />
                        </AreaChart>
                      </ResponsiveContainer>
                    </CardBody>
                  </Card>
                </div>

                <Card>
                  <CardHeader title="Todos os eventos — 24h vs 24h anteriores" action={<span style={{ fontSize: 11, color: '#8A9BAA' }}>{events.length} eventos</span>} />
                  {events.length === 0 ? (
                    <CardBody><div style={{ fontSize: 12, color: '#8A9BAA', textAlign: 'center', padding: 24 }}>Nenhum evento encontrado.</div></CardBody>
                  ) : (
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <thead>
                        <tr style={{ borderBottom: '1px solid rgba(185,145,91,0.2)' }}>
                          {['Evento', 'Volume 24h', '% do total', 'vs ontem', 'Barra'].map(h => (
                            <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontSize: 11, color: '#8A9BAA', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase' }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {events.map((ev, i) => {
                          const maxCount = events[0]?.count || 1
                          const barW = Math.round((ev.count / maxCount) * 100)
                          const deltaColor = ev.delta === null ? '#8A9BAA' : ev.delta > 0 ? '#22C55E' : ev.delta < 0 ? '#EF4444' : '#8A9BAA'
                          const DeltaIcon = ev.delta === null ? Minus : ev.delta > 0 ? TrendingUp : TrendingDown
                          return (
                            <tr key={i} style={{ borderBottom: '1px solid rgba(185,145,91,0.06)' }}>
                              <td style={{ padding: '11px 16px', fontSize: 13, fontWeight: 700, color: '#F5F4F3', fontFamily: 'monospace' }}>{ev.name}</td>
                              <td style={{ padding: '11px 16px', fontSize: 14, fontWeight: 800, color: '#F5F4F3' }}>{(ev.count || 0).toLocaleString('pt-BR')}</td>
                              <td style={{ padding: '11px 16px', fontSize: 12, color: '#8A9BAA' }}>{ev.pct}%</td>
                              <td style={{ padding: '11px 16px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 5, color: deltaColor }}>
                                  <DeltaIcon size={12} />
                                  <span style={{ fontSize: 12, fontWeight: 700 }}>{ev.delta === null ? '—' : `${ev.delta > 0 ? '+' : ''}${ev.delta}%`}</span>
                                </div>
                              </td>
                              <td style={{ padding: '11px 16px', width: 160 }}>
                                <div style={{ height: 6, background: 'rgba(255,255,255,0.06)', borderRadius: 3, overflow: 'hidden' }}>
                                  <div style={{ width: `${barW}%`, height: '100%', background: '#B9915B', borderRadius: 3 }} />
                                </div>
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  )}
                </Card>

                {/* ── Event Match Quality ──────────────────────────── */}
                <div style={{ marginTop: 16 }}>
                  <EventMatchQuality emq={emq} />
                </div>
              </>
            )}

            {/* ── Tab Audiência ─────────────────────────────────────── */}
            {tab === 'audience' && <TabAudience data={audience} days={days} />}

            {/* ── Tab Criativos ─────────────────────────────────────── */}
            {tab === 'creative' && <TabCreative data={creatives} days={days} />}
          </>
        )}
      </div>

      {showModal && (
        <MetaConfigModal
          currentConfig={config?.meta ?? {}}
          onClose={() => setShowModal(false)}
          onSaved={() => { setShowModal(false); loadData() }}
        />
      )}
    </div>
  )
}

// ── Modal de configuração ─────────────────────────────────────────────────────
function MetaConfigModal({ currentConfig, onClose, onSaved }) {
  const hasExistingToken = !!(currentConfig?.access_token)
  const [token, setToken]         = useState('')
  const [pixelId, setPixelId]     = useState(currentConfig?.pixel_id ?? '')
  const [showToken, setShowToken] = useState(false)
  const [saving, setSaving]       = useState(false)
  const [error, setError]         = useState(null)
  const [testing, setTesting]     = useState(false)
  const [testResult, setTestResult] = useState(null)
  const [step, setStep]           = useState('form')

  const tokenAge = currentConfig?.token_created_at
    ? Math.floor((Date.now() - new Date(currentConfig.token_created_at).getTime()) / 86400000)
    : null
  const tokenExpiring = tokenAge !== null && tokenAge >= 75

  async function handleSave() {
    if (!pixelId.trim()) { setError('Preencha o Pixel ID.'); return }
    if (!token.trim() && !hasExistingToken) { setError('Preencha o Access Token.'); return }
    setSaving(true); setError(null)
    try {
      const metaUpdate = { pixel_id: pixelId.trim() }
      if (token.trim()) { metaUpdate.access_token = token.trim(); metaUpdate.token_created_at = new Date().toISOString() }
      const result = await api.saveConfig({ meta: metaUpdate })
      if (result?.ok) { onSaved() } else { setError('Erro ao salvar configuração.') }
    } catch (e) { setError('Erro ao salvar: ' + e.message) } finally { setSaving(false) }
  }

  async function handleTest() {
    if (!pixelId.trim()) { setError('Preencha o Pixel ID antes de testar.'); return }
    if (!token.trim() && !hasExistingToken) { setError('Preencha o Access Token antes de testar.'); return }
    setTesting(true); setTestResult(null); setError(null)
    const metaUpdate = { pixel_id: pixelId.trim() }
    if (token.trim()) metaUpdate.access_token = token.trim()
    await api.saveConfig({ meta: metaUpdate })
    const result = await api.metaStats()
    setTesting(false)
    if (!result?.mock) {
      setTestResult({ ok: true, detail: `Pixel ${result.pixelId} — ${result.events?.length ?? 0} eventos encontrados` })
    } else {
      setTestResult({ ok: false, detail: result.error ?? 'Credenciais inválidas ou sem permissão.' })
    }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,15,26,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(4px)' }}>
      <div style={{ width: 500, background: '#001A2E', border: '1px solid rgba(185,145,91,0.3)', borderRadius: 12, padding: 28, boxShadow: '0 24px 60px rgba(0,0,0,0.6)', maxHeight: '90vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <div>
            <h2 style={{ fontFamily: "'PPMuseum','Georgia',serif", fontSize: 16, color: '#B9915B', fontWeight: 600 }}>Configurar Meta Ads</h2>
            <p style={{ fontSize: 12, color: '#8A9BAA', marginTop: 4 }}>Token de longa duração + Pixel ID</p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button onClick={() => setStep(s => s === 'guide' ? 'form' : 'guide')} style={{ fontSize: 11, color: '#8A9BAA', background: 'rgba(138,155,170,0.1)', border: '1px solid rgba(138,155,170,0.2)', borderRadius: 5, padding: '4px 10px', cursor: 'pointer', fontFamily: 'Manrope, sans-serif' }}>
              {step === 'guide' ? '← Voltar' : 'Como configurar?'}
            </button>
            <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#8A9BAA', padding: 4 }}><X size={18} /></button>
          </div>
        </div>

        {tokenExpiring && step === 'form' && (
          <div style={{ padding: '10px 14px', marginBottom: 16, background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.35)', borderRadius: 7, fontSize: 12, color: '#F59E0B', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
            <span>Token configurado há <strong>{tokenAge} dias</strong> — expira em ~{90 - tokenAge} dias.</span>
            <a href="https://business.facebook.com/settings/system-users" target="_blank" rel="noreferrer" style={{ fontSize: 11, color: '#F59E0B', fontWeight: 700, textDecoration: 'underline', whiteSpace: 'nowrap' }}>Renovar agora</a>
          </div>
        )}

        {step === 'form' && (
          <>
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', fontSize: 11, color: '#8A9BAA', fontWeight: 600, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Pixel ID</label>
              <input value={pixelId} onChange={e => setPixelId(e.target.value)} placeholder="ex: 702432142505333" style={INPUT_STYLE} />
            </div>
            <div style={{ marginBottom: 8 }}>
              <label style={{ display: 'block', fontSize: 11, color: '#8A9BAA', fontWeight: 600, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Access Token</label>
              <div style={{ position: 'relative' }}>
                <input type={showToken ? 'text' : 'password'} value={token} onChange={e => setToken(e.target.value)} placeholder={hasExistingToken ? '•••• (token já configurado)' : 'EAAxxxxx...'} style={{ ...INPUT_STYLE, paddingRight: 40 }} />
                <button onClick={() => setShowToken(v => !v)} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#8A9BAA' }}>
                  {showToken ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>
            {error && <div style={{ padding: '8px 12px', marginBottom: 12, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 6, fontSize: 12, color: '#EF4444' }}>{error}</div>}
            {testResult && (
              <div style={{ padding: '8px 12px', marginBottom: 12, borderRadius: 6, fontSize: 12, background: testResult.ok ? 'rgba(34,197,94,0.08)' : 'rgba(239,68,68,0.08)', border: `1px solid ${testResult.ok ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.3)'}`, color: testResult.ok ? '#22C55E' : '#EF4444' }}>
                {testResult.ok ? '✓ ' : '✗ '}{testResult.detail}
              </div>
            )}
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 16 }}>
              <button onClick={handleTest} disabled={testing} style={{ padding: '8px 18px', borderRadius: 6, border: '1px solid rgba(185,145,91,0.4)', background: 'transparent', color: '#B9915B', fontSize: 13, fontWeight: 600, cursor: testing ? 'not-allowed' : 'pointer', fontFamily: 'Manrope, sans-serif' }}>
                {testing ? 'Testando...' : 'Testar conexão'}
              </button>
              <button onClick={handleSave} disabled={saving} style={{ padding: '8px 20px', borderRadius: 6, border: 'none', background: '#B9915B', color: '#001F35', fontSize: 13, fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer', fontFamily: 'Manrope, sans-serif', display: 'flex', alignItems: 'center', gap: 6 }}>
                <Save size={13} />{saving ? 'Salvando...' : 'Salvar'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

const INPUT_STYLE = {
  width: '100%', boxSizing: 'border-box',
  padding: '9px 12px', borderRadius: 6,
  border: '1px solid rgba(185,145,91,0.3)',
  background: 'rgba(0,31,53,0.6)',
  color: '#F5F4F3', fontSize: 13,
  fontFamily: 'Manrope, sans-serif',
  outline: 'none',
}
