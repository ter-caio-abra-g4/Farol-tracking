import { useState, useEffect } from 'react'
import Header from '../components/layout/Header'
import Card, { CardHeader, CardBody } from '../components/ui/Card'
import Spinner from '../components/ui/Spinner'
import { api } from '../services/api'
import { AlertTriangle, TrendingDown, TrendingUp, Zap } from 'lucide-react'
import { fmtNum, fmtMoney } from '../utils/format'

const SEVERITY_COLOR = {
  critical: '#EF4444',
  high:     '#F59E0B',
  medium:   '#6366F1',
  low:      '#8A9BAA',
}
const SEVERITY_LABEL = {
  critical: 'Crítico',
  high:     'Alto',
  medium:   'Médio',
  low:      'Baixo',
}

export default function AnomalyDetectionPage() {
  const [data, setData]       = useState(null)
  const [loading, setLoading] = useState(true)
  const [lastUpdated, setLastUpdated] = useState(null)

  async function loadData() {
    setLoading(true)
    const res = await api.databricksAnomalyAlerts()
    setData(res)
    setLoading(false)
    setLastUpdated(Date.now())
  }

  useEffect(() => { loadData() }, [])

  const alerts = data?.alerts || []
  const criticals = alerts.filter(a => a.severity === 'critical')
  const isMock = data?.mock ?? true

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      <Header
        title="Anomaly Detection"
        subtitle="Detecção automática de desvios em KPIs de tracking e funil"
        onRefresh={loadData}
        lastUpdated={lastUpdated}
        action={
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {isMock
              ? <span style={{ fontSize: 10, color: '#F59E0B', background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.25)', padding: '2px 10px', borderRadius: 10, fontWeight: 700 }}>MOCK</span>
              : <span style={{ fontSize: 10, color: '#22C55E', background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.25)', padding: '2px 10px', borderRadius: 10, fontWeight: 700 }}>LIVE</span>
            }
          </div>
        }
      />

      <div style={{ flex: 1, overflow: 'auto', padding: 'clamp(12px, 2vw, 24px)', minWidth: 0 }}>
        {/* Banner "Em desenvolvimento" */}
        {isMock && (
          <div style={{
            marginBottom: 20,
            padding: '14px 18px',
            background: 'rgba(107,114,128,0.07)',
            border: '1px solid rgba(107,114,128,0.2)',
            borderRadius: 10,
            display: 'flex', alignItems: 'flex-start', gap: 12,
          }}>
            <Zap size={18} color="#6B7280" style={{ flexShrink: 0, marginTop: 1 }} />
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#9CA3AF', marginBottom: 4 }}>
                Funcionalidade em desenvolvimento — exibindo dados simulados
              </div>
              <div style={{ fontSize: 12, color: '#6B7280', lineHeight: 1.6 }}>
                Esta tela detectará automaticamente desvios estatísticos em taxas de conversão, volume de eventos e qualidade de dados de tracking.
                Para ativar com dados reais, conecte o Databricks em <strong style={{ color: '#B9915B' }}>Configurações</strong> com acesso ao schema <code style={{ color: '#B9915B', fontSize: 11 }}>production.diamond</code>.
              </div>
            </div>
          </div>
        )}

        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}><Spinner /></div>
        ) : (
          <>
            {/* KPIs */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 20 }}>
              {[
                { label: 'Alertas ativos',  value: alerts.length,    color: '#F59E0B' },
                { label: 'Críticos',        value: criticals.length, color: '#EF4444' },
                { label: 'Canais afetados', value: new Set(alerts.map(a => a.canal || a.channel)).size, color: '#6366F1' },
                { label: 'Desvio médio',    value: alerts.length > 0 ? `${Math.round(alerts.reduce((s, a) => s + Math.abs(a.desvio || a.deviation || 0), 0) / alerts.length)}%` : '—', color: '#B9915B' },
              ].map((k, i) => (
                <Card key={i}>
                  <CardBody style={{ padding: '14px 16px' }}>
                    <div style={{ fontSize: 22, fontWeight: 800, color: '#F5F4F3', lineHeight: 1 }}>{k.value}</div>
                    <div style={{ fontSize: 11, color: k.color, marginTop: 4, fontWeight: 600 }}>{k.label}</div>
                  </CardBody>
                </Card>
              ))}
            </div>

            {/* Lista de alertas */}
            <Card>
              <CardHeader
                title="Alertas detectados"
                subtitle={`${alerts.length} anomalia${alerts.length !== 1 ? 's' : ''} identificada${alerts.length !== 1 ? 's' : ''}`}
                action={
                  criticals.length > 0
                    ? <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 10, background: 'rgba(239,68,68,0.1)', color: '#EF4444', fontWeight: 700 }}>{criticals.length} crítico{criticals.length !== 1 ? 's' : ''}</span>
                    : <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 10, background: 'rgba(34,197,94,0.1)', color: '#22C55E', fontWeight: 700 }}>Sem críticos</span>
                }
              />
              <CardBody style={{ padding: 0 }}>
                {alerts.length === 0 ? (
                  <div style={{ padding: '40px 24px', textAlign: 'center', color: '#6B7280', fontSize: 13 }}>
                    Nenhum alerta no período. Conecte o Databricks para detecção em tempo real.
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    {alerts.map((alert, i) => {
                      const severity = alert.severity || 'medium'
                      const color = SEVERITY_COLOR[severity] || '#8A9BAA'
                      const isDown = (alert.desvio || alert.deviation || 0) < 0
                      return (
                        <div key={i} style={{
                          display: 'flex', alignItems: 'flex-start', gap: 14, padding: '14px 20px',
                          borderBottom: i < alerts.length - 1 ? '1px solid rgba(185,145,91,0.06)' : 'none',
                          background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.01)',
                        }}>
                          <div style={{ marginTop: 2, flexShrink: 0 }}>
                            {isDown
                              ? <TrendingDown size={16} color={color} />
                              : <TrendingUp   size={16} color={color} />
                            }
                          </div>
                          <div style={{ flex: 1 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
                              <span style={{ fontSize: 13, fontWeight: 700, color: '#F5F4F3' }}>
                                {alert.metrica || alert.metric || alert.kpi || `Alerta #${i + 1}`}
                              </span>
                              <span style={{ fontSize: 10, fontWeight: 700, padding: '1px 7px', borderRadius: 8, background: color + '22', color }}>
                                {SEVERITY_LABEL[severity] || severity}
                              </span>
                              {(alert.canal || alert.channel) && (
                                <span style={{ fontSize: 10, color: '#8A9BAA', background: 'rgba(255,255,255,0.05)', borderRadius: 4, padding: '1px 6px' }}>
                                  {alert.canal || alert.channel}
                                </span>
                              )}
                            </div>
                            <div style={{ fontSize: 12, color: '#8A9BAA', lineHeight: 1.5 }}>
                              {alert.descricao || alert.description || alert.message || 'Desvio detectado em relação à linha de base histórica.'}
                            </div>
                          </div>
                          <div style={{ textAlign: 'right', flexShrink: 0 }}>
                            <div style={{ fontSize: 16, fontWeight: 800, color }}>
                              {alert.desvio !== undefined
                                ? `${alert.desvio > 0 ? '+' : ''}${alert.desvio}%`
                                : alert.deviation !== undefined
                                  ? `${alert.deviation > 0 ? '+' : ''}${alert.deviation}%`
                                  : '—'}
                            </div>
                            <div style={{ fontSize: 10, color: '#6B7280', marginTop: 2 }}>desvio</div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </CardBody>
            </Card>
          </>
        )}
      </div>
    </div>
  )
}
