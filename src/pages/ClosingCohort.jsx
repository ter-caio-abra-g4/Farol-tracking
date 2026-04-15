import { useState, useEffect } from 'react'
import Header from '../components/layout/Header'
import Card, { CardHeader, CardBody } from '../components/ui/Card'
import Spinner from '../components/ui/Spinner'
import PeriodSelect from '../components/ui/PeriodSelect'
import { api } from '../services/api'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { TT } from '../components/ui/DarkTooltip'
import { Zap } from 'lucide-react'
import { fmtPct } from '../utils/format'

const PERIOD_OPTIONS = [
  { label: '90d',  days: 90  },
  { label: '180d', days: 180 },
]

export default function ClosingCohortPage() {
  const [days, setDays]       = useState(180)
  const [data, setData]       = useState(null)
  const [loading, setLoading] = useState(true)
  const [lastUpdated, setLastUpdated] = useState(null)

  async function loadData() {
    setLoading(true)
    const res = await api.databricksClosingCohort(days)
    setData(res)
    setLoading(false)
    setLastUpdated(Date.now())
  }

  useEffect(() => { loadData() }, [days])

  const cohort = data?.cohort || []
  const isMock = data?.mock ?? true

  // Tenta extrair semanas/buckets independente do shape do mock
  const chartData = cohort.map((row, i) => ({
    label: row.semana || row.week || row.periodo || row.bucket || `Semana ${i + 1}`,
    taxa:  row.taxa_fechamento ?? row.closing_rate ?? row.rate ?? 0,
    ganhos: row.ganhos ?? row.won ?? 0,
    mqls:  row.mqls ?? row.leads ?? 0,
  }))

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      <Header
        title="Cohort de Fechamento"
        subtitle="Taxa de conversão SAL → Ganho por coorte semanal"
        onRefresh={loadData}
        lastUpdated={lastUpdated}
        action={
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <PeriodSelect value={days} onChange={setDays} options={PERIOD_OPTIONS} />
            {isMock
              ? <span style={{ fontSize: 10, color: '#F59E0B', background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.25)', padding: '2px 10px', borderRadius: 10, fontWeight: 700 }}>MOCK</span>
              : <span style={{ fontSize: 10, color: '#22C55E', background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.25)', padding: '2px 10px', borderRadius: 10, fontWeight: 700 }}>LIVE</span>
            }
          </div>
        }
      />

      <div style={{ flex: 1, overflow: 'auto', padding: 'clamp(12px, 2vw, 24px)', minWidth: 0 }}>
        {/* Banner "Em desenvolvimento" */}
        <div style={{
          marginBottom: 20,
          padding: '14px 18px',
          background: 'rgba(99,102,241,0.07)',
          border: '1px solid rgba(99,102,241,0.25)',
          borderRadius: 10,
          display: 'flex', alignItems: 'flex-start', gap: 12,
        }}>
          <Zap size={18} color="#6366F1" style={{ flexShrink: 0, marginTop: 1 }} />
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#A5B4FC', marginBottom: 4 }}>
              Em desenvolvimento — dados simulados
            </div>
            <div style={{ fontSize: 12, color: '#8A9BAA', lineHeight: 1.6 }}>
              Esta tela analisa a taxa de fechamento por coorte semanal: quantos SALs de cada semana se converteram em negócios ganhos ao longo do tempo.
              Para ativar com dados reais, conecte o Databricks em <strong style={{ color: '#B9915B' }}>Configurações</strong> com acesso à tabela <code style={{ color: '#B9915B', fontSize: 11 }}>production.diamond.funil_marketing</code>.
            </div>
          </div>
        </div>

        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}><Spinner /></div>
        ) : (
          <>
            {/* KPIs */}
            {chartData.length > 0 && (() => {
              const avgRate = chartData.reduce((s, r) => s + r.taxa, 0) / chartData.length
              const bestWeek = [...chartData].sort((a, b) => b.taxa - a.taxa)[0]
              const totalGanhos = chartData.reduce((s, r) => s + r.ganhos, 0)
              return (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 20 }}>
                  {[
                    { label: 'Taxa média de fechamento', value: `${avgRate.toFixed(1)}%`, color: '#B9915B' },
                    { label: 'Melhor semana', value: bestWeek ? `${bestWeek.label} (${bestWeek.taxa.toFixed(1)}%)` : '—', color: '#22C55E' },
                    { label: `Total ganhos (${days}d)`, value: totalGanhos.toLocaleString('pt-BR'), color: '#6366F1' },
                  ].map((k, i) => (
                    <Card key={i}>
                      <CardBody style={{ padding: '14px 16px' }}>
                        <div style={{ fontSize: 20, fontWeight: 800, color: '#F5F4F3', lineHeight: 1 }}>{k.value}</div>
                        <div style={{ fontSize: 11, color: k.color, marginTop: 4, fontWeight: 600 }}>{k.label}</div>
                      </CardBody>
                    </Card>
                  ))}
                </div>
              )
            })()}

            {/* Gráfico */}
            <Card>
              <CardHeader
                title="Taxa de fechamento por semana de entrada"
                subtitle={`Coortes dos últimos ${days} dias — SAL → Ganho`}
              />
              <CardBody>
                {chartData.length === 0 ? (
                  <div style={{ padding: '40px 24px', textAlign: 'center', color: '#6B7280', fontSize: 13 }}>
                    Sem dados de cohort disponíveis. Conecte o Databricks para análise real.
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height={280}>
                    <BarChart data={chartData} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                      <XAxis dataKey="label" tick={{ fill: '#8A9BAA', fontSize: 10 }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
                      <YAxis tick={{ fill: '#8A9BAA', fontSize: 10 }} axisLine={false} tickLine={false} unit="%" />
                      <Tooltip
                        cursor={TT.cursorBar}
                        content={({ active, payload, label }) => {
                          if (!active || !payload?.length) return null
                          const d = payload[0]?.payload
                          return (
                            <div style={TT.contentStyle}>
                              <div style={{ fontWeight: 700, marginBottom: 4 }}>{label}</div>
                              <div style={{ color: '#22C55E' }}>Taxa: {d.taxa?.toFixed(1)}%</div>
                              {d.ganhos > 0 && <div style={{ color: '#B9915B' }}>Ganhos: {d.ganhos}</div>}
                              {d.mqls > 0 && <div style={{ color: '#8A9BAA' }}>MQLs: {d.mqls}</div>}
                            </div>
                          )
                        }}
                      />
                      <Bar dataKey="taxa" name="Taxa de fechamento" fill="#22C55E" radius={[3, 3, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </CardBody>
            </Card>
          </>
        )}
      </div>
    </div>
  )
}
