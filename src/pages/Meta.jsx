import { useState } from 'react'
import Header from '../components/layout/Header'
import Card, { CardHeader, CardBody } from '../components/ui/Card'
import StatusBadge from '../components/ui/StatusBadge'
import Metric from '../components/ui/Metric'
import {
  RadialBarChart, RadialBar, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
} from 'recharts'
import { TrendingUp, AlertTriangle, CheckCircle, Info, ChevronRight } from 'lucide-react'

const MOCK_META = {
  pixel_id: '702432142505333',
  score: 87,
  scoreStatus: 'ok',
  matchRate: 87,
  deduplication: 94,
  events: [
    { name: 'Purchase', received: 342, matched: 298, matchRate: 87, status: 'ok', quality: 'Alto' },
    { name: 'Lead', received: 1820, matched: 1548, matchRate: 85, status: 'ok', quality: 'Alto' },
    { name: 'PageView', received: 48200, matched: 44890, matchRate: 93, status: 'ok', quality: 'Excelente' },
    { name: 'InitiateCheckout', received: 510, matched: 420, matchRate: 82, status: 'warn', quality: 'Médio' },
    { name: 'AddToCart', received: 890, matched: 712, matchRate: 80, status: 'warn', quality: 'Médio' },
    { name: 'ViewContent', received: 12400, matched: 11408, matchRate: 92, status: 'ok', quality: 'Alto' },
  ],
  recommendations: [
    {
      priority: 'alta',
      title: 'Adicionar parâmetros avançados ao InitiateCheckout',
      description: 'Inclua email, phone e customer_id para aumentar o match rate de 82% → 90%+.',
    },
    {
      priority: 'media',
      title: 'Melhorar cobertura do AddToCart',
      description: 'O evento está sem external_id. Adicionar via dataLayer melhora a deduplicação.',
    },
    {
      priority: 'baixa',
      title: 'Ativar LDP (Limited Data Processing) verificação',
      description: 'Confirme as configurações de privacidade para compliance LGPD.',
    },
  ],
  eventsVolume: [
    { hora: '00h', capi: 120, pixel: 118 },
    { hora: '04h', capi: 80, pixel: 78 },
    { hora: '08h', capi: 340, pixel: 330 },
    { hora: '12h', capi: 520, pixel: 505 },
    { hora: '16h', capi: 480, pixel: 472 },
    { hora: '20h', capi: 310, pixel: 298 },
    { hora: '23h', capi: 190, pixel: 185 },
  ],
}

const QUALITY_COLOR = {
  Excelente: '#22C55E',
  Alto: '#22C55E',
  Médio: '#F59E0B',
  Baixo: '#EF4444',
}

const PRIORITY_CONFIG = {
  alta: { color: '#EF4444', bg: 'rgba(239,68,68,0.08)', label: 'Alta' },
  media: { color: '#F59E0B', bg: 'rgba(245,158,11,0.08)', label: 'Média' },
  baixa: { color: '#22C55E', bg: 'rgba(34,197,94,0.08)', label: 'Baixa' },
}

export default function MetaPage() {
  const [d] = useState(MOCK_META)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      <Header
        title="Meta Ads"
        subtitle={`Pixel ${d.pixel_id} — Conversions API`}
        onRefresh={() => {}}
      />

      <div style={{ flex: 1, overflow: 'auto', padding: 24 }}>
        {/* Score + métricas principais */}
        <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: 16, marginBottom: 20 }}>
          {/* Score card */}
          <Card>
            <CardBody style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: 24 }}>
              <div
                style={{
                  fontFamily: "'PPMuseum','Georgia',serif",
                  fontSize: 13,
                  color: '#8A9BAA',
                  marginBottom: 16,
                  letterSpacing: '0.04em',
                  textTransform: 'uppercase',
                }}
              >
                Event Match Quality
              </div>

              {/* Score radial */}
              <div style={{ position: 'relative', width: 140, height: 140 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <RadialBarChart
                    innerRadius="70%"
                    outerRadius="100%"
                    data={[{ value: d.score }]}
                    startAngle={220}
                    endAngle={-40}
                  >
                    <RadialBar
                      dataKey="value"
                      cornerRadius={6}
                      fill="#22C55E"
                      background={{ fill: 'rgba(34,197,94,0.08)' }}
                    />
                  </RadialBarChart>
                </ResponsiveContainer>
                <div
                  style={{
                    position: 'absolute',
                    top: '50%',
                    left: '50%',
                    transform: 'translate(-50%, -50%)',
                    textAlign: 'center',
                  }}
                >
                  <div style={{ fontSize: 32, fontWeight: 800, color: '#22C55E', lineHeight: 1 }}>
                    {d.score}
                  </div>
                  <div style={{ fontSize: 11, color: '#8A9BAA', marginTop: 2 }}>/ 100</div>
                </div>
              </div>

              <StatusBadge status={d.scoreStatus} label="Qualidade boa" style={{ marginTop: 12 }} />
            </CardBody>
          </Card>

          {/* Métricas rápidas */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
            {[
              { label: 'Match Rate médio', value: `${d.matchRate}%`, status: 'ok' },
              { label: 'Deduplicação', value: `${d.deduplication}%`, status: 'ok' },
              { label: 'Eventos ativos', value: d.events.length, status: 'ok' },
            ].map((m, i) => (
              <Card key={i}>
                <CardBody>
                  <Metric {...m} />
                </CardBody>
              </Card>
            ))}

            {/* Gráfico CAPI vs Pixel */}
            <Card style={{ gridColumn: '1 / -1' }}>
              <CardHeader title="CAPI vs Pixel — volume últimas 24h" />
              <CardBody style={{ paddingTop: 8 }}>
                <ResponsiveContainer width="100%" height={100}>
                  <BarChart data={d.eventsVolume} margin={{ top: 0, right: 4, left: -24, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#B9915B11" />
                    <XAxis dataKey="hora" tick={{ fontSize: 10, fill: '#8A9BAA' }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 10, fill: '#8A9BAA' }} axisLine={false} tickLine={false} />
                    <Tooltip
                      contentStyle={{
                        background: '#001F35',
                        border: '1px solid #B9915B55',
                        borderRadius: 6,
                        fontSize: 12,
                        color: '#F5F4F3',
                      }}
                    />
                    <Bar dataKey="capi" name="CAPI" fill="#B9915B" radius={[3, 3, 0, 0]} />
                    <Bar dataKey="pixel" name="Pixel" fill="#B9915B44" radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardBody>
            </Card>
          </div>
        </div>

        {/* Tabela de eventos */}
        <Card style={{ marginBottom: 20 }}>
          <CardHeader title="Qualidade por evento" />
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid rgba(185,145,91,0.2)' }}>
                {['Evento', 'Recebidos', 'Matched', 'Match Rate', 'Qualidade', 'Status'].map((h) => (
                  <th
                    key={h}
                    style={{
                      padding: '10px 16px',
                      textAlign: 'left',
                      fontSize: 11,
                      color: '#8A9BAA',
                      fontWeight: 600,
                      letterSpacing: '0.06em',
                      textTransform: 'uppercase',
                    }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {d.events.map((ev) => (
                <tr
                  key={ev.name}
                  style={{ borderBottom: '1px solid rgba(185,145,91,0.08)' }}
                >
                  <td style={{ padding: '11px 16px', fontSize: 13, fontWeight: 600, color: '#F5F4F3' }}>
                    {ev.name}
                  </td>
                  <td style={{ padding: '11px 16px', fontSize: 13, color: '#F5F4F3' }}>
                    {ev.received.toLocaleString('pt-BR')}
                  </td>
                  <td style={{ padding: '11px 16px', fontSize: 13, color: '#F5F4F3' }}>
                    {ev.matched.toLocaleString('pt-BR')}
                  </td>
                  <td style={{ padding: '11px 16px' }}>
                    {/* Barra de match rate */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div
                        style={{
                          width: 80,
                          height: 6,
                          background: 'rgba(255,255,255,0.08)',
                          borderRadius: 3,
                          overflow: 'hidden',
                        }}
                      >
                        <div
                          style={{
                            width: `${ev.matchRate}%`,
                            height: '100%',
                            background: ev.matchRate >= 85 ? '#22C55E' : ev.matchRate >= 75 ? '#F59E0B' : '#EF4444',
                            borderRadius: 3,
                          }}
                        />
                      </div>
                      <span style={{ fontSize: 12, color: '#F5F4F3', fontWeight: 600 }}>
                        {ev.matchRate}%
                      </span>
                    </div>
                  </td>
                  <td style={{ padding: '11px 16px' }}>
                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 700,
                        color: QUALITY_COLOR[ev.quality] ?? '#F5F4F3',
                      }}
                    >
                      {ev.quality}
                    </span>
                  </td>
                  <td style={{ padding: '11px 16px' }}>
                    <StatusBadge status={ev.status} size="sm" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>

        {/* Recomendações */}
        <Card>
          <CardHeader title="Recomendações da Meta" />
          <CardBody>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {d.recommendations.map((rec, i) => {
                const cfg = PRIORITY_CONFIG[rec.priority]
                return (
                  <div
                    key={i}
                    style={{
                      display: 'flex',
                      gap: 14,
                      padding: '14px 16px',
                      background: cfg.bg,
                      border: `1px solid ${cfg.color}33`,
                      borderRadius: 8,
                    }}
                  >
                    <div
                      style={{
                        width: 6,
                        height: 6,
                        borderRadius: '50%',
                        background: cfg.color,
                        marginTop: 6,
                        flexShrink: 0,
                        boxShadow: `0 0 6px ${cfg.color}88`,
                      }}
                    />
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                        <span style={{ fontSize: 13, fontWeight: 700, color: '#F5F4F3' }}>
                          {rec.title}
                        </span>
                        <span
                          style={{
                            fontSize: 10,
                            fontWeight: 700,
                            color: cfg.color,
                            background: `${cfg.color}22`,
                            padding: '2px 7px',
                            borderRadius: 4,
                            letterSpacing: '0.06em',
                          }}
                        >
                          {cfg.label.toUpperCase()}
                        </span>
                      </div>
                      <p style={{ fontSize: 12, color: '#8A9BAA', lineHeight: 1.5 }}>{rec.description}</p>
                    </div>
                    <ChevronRight size={14} color="#8A9BAA" style={{ marginTop: 4, flexShrink: 0 }} />
                  </div>
                )
              })}
            </div>
          </CardBody>
        </Card>
      </div>
    </div>
  )
}
