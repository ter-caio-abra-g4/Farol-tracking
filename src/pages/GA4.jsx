import { useState } from 'react'
import Header from '../components/layout/Header'
import Card, { CardHeader, CardBody } from '../components/ui/Card'
import StatusBadge from '../components/ui/StatusBadge'
import Metric from '../components/ui/Metric'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts'

const PROPERTIES = [
  { id: '123456789', name: 'G4 Business', status: 'ok', events: '142k', users: '18.4k', sessions: '24.2k' },
  { id: '987654321', name: 'G4 Educação', status: 'ok', events: '89k', users: '12.1k', sessions: '15.8k' },
  { id: '456789123', name: 'Landing Pages', status: 'warn', events: '31k', users: '6.2k', sessions: '8.4k' },
]

const MOCK_EVENTS_GA4 = [
  { name: 'page_view', count: 48200, change: '+5%', status: 'ok' },
  { name: 'session_start', count: 24200, change: '+3%', status: 'ok' },
  { name: 'purchase', count: 342, change: '+12%', status: 'ok' },
  { name: 'lead', count: 1820, change: '+8%', status: 'ok' },
  { name: 'add_to_cart', count: 890, change: '-2%', status: 'warn' },
  { name: 'begin_checkout', count: 510, change: '+1%', status: 'ok' },
  { name: 'view_item', count: 12400, change: '+18%', status: 'ok' },
  { name: 'form_submit', count: 1240, change: '+4%', status: 'ok' },
  { name: 'scroll', count: 31200, change: '+2%', status: 'ok' },
  { name: 'click_whatsapp', count: 2840, change: '+9%', status: 'ok' },
]

const TREND_DATA = [
  { dia: 'Sex', eventos: 128000, usuarios: 16200 },
  { dia: 'Sab', eventos: 89000, usuarios: 11800 },
  { dia: 'Dom', eventos: 72000, usuarios: 9400 },
  { dia: 'Seg', eventos: 142000, usuarios: 18200 },
  { dia: 'Ter', eventos: 138000, usuarios: 17900 },
  { dia: 'Qua', eventos: 151000, usuarios: 19100 },
  { dia: 'Hoj', eventos: 142000, usuarios: 18400 },
]

export default function GA4Page() {
  const [selectedProp, setSelectedProp] = useState(PROPERTIES[0])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      <Header
        title="GA4"
        subtitle="Eventos e métricas das propriedades"
        onRefresh={() => {}}
      />

      <div style={{ flex: 1, overflow: 'auto', padding: 24 }}>
        {/* Properties */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 20 }}>
          {PROPERTIES.map((p) => (
            <Card
              key={p.id}
              style={{
                cursor: 'pointer',
                borderColor: selectedProp.id === p.id ? '#B9915B' : 'rgba(185,145,91,0.35)',
              }}
              onClick={() => setSelectedProp(p)}
            >
              <CardBody>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
                  <div>
                    <div style={{ fontFamily: "'PPMuseum','Georgia',serif", fontSize: 14, color: selectedProp.id === p.id ? '#B9915B' : '#F5F4F3' }}>
                      {p.name}
                    </div>
                    <div style={{ fontSize: 11, color: '#8A9BAA', marginTop: 2 }}>ID {p.id}</div>
                  </div>
                  <StatusBadge status={p.status} size="sm" />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
                  {[
                    { label: 'Eventos', val: p.events },
                    { label: 'Usuários', val: p.users },
                    { label: 'Sessões', val: p.sessions },
                  ].map(({ label, val }) => (
                    <div key={label}>
                      <div style={{ fontSize: 16, fontWeight: 700, color: '#F5F4F3' }}>{val}</div>
                      <div style={{ fontSize: 10, color: '#8A9BAA' }}>{label}/dia</div>
                    </div>
                  ))}
                </div>
              </CardBody>
            </Card>
          ))}
        </div>

        {/* Trend chart */}
        <Card style={{ marginBottom: 20 }}>
          <CardHeader title="Tendência — 7 dias" />
          <CardBody style={{ paddingTop: 8 }}>
            <ResponsiveContainer width="100%" height={180}>
              <LineChart data={TREND_DATA} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#B9915B11" />
                <XAxis dataKey="dia" tick={{ fontSize: 11, fill: '#8A9BAA' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#8A9BAA' }} axisLine={false} tickLine={false} />
                <Tooltip
                  contentStyle={{
                    background: '#001F35',
                    border: '1px solid #B9915B55',
                    borderRadius: 6,
                    fontSize: 12,
                    color: '#F5F4F3',
                  }}
                />
                <Legend wrapperStyle={{ fontSize: 11, color: '#8A9BAA' }} />
                <Line type="monotone" dataKey="eventos" name="Eventos" stroke="#B9915B" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="usuarios" name="Usuários" stroke="#22C55E" strokeWidth={2} dot={false} strokeDasharray="4 2" />
              </LineChart>
            </ResponsiveContainer>
          </CardBody>
        </Card>

        {/* Eventos */}
        <Card>
          <CardHeader title={`Eventos — ${selectedProp.name}`} />
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid rgba(185,145,91,0.2)' }}>
                {['Evento', 'Contagem (7d)', 'Variação', 'Status'].map((h) => (
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
              {MOCK_EVENTS_GA4.map((ev) => {
                const changeColor = ev.change.startsWith('+') ? '#22C55E' : '#EF4444'
                return (
                  <tr key={ev.name} style={{ borderBottom: '1px solid rgba(185,145,91,0.08)' }}>
                    <td style={{ padding: '10px 16px', fontSize: 13, fontWeight: 600, color: '#F5F4F3' }}>
                      {ev.name}
                    </td>
                    <td style={{ padding: '10px 16px', fontSize: 13, color: '#F5F4F3' }}>
                      {ev.count.toLocaleString('pt-BR')}
                    </td>
                    <td style={{ padding: '10px 16px', fontSize: 12, fontWeight: 700, color: changeColor }}>
                      {ev.change}
                    </td>
                    <td style={{ padding: '10px 16px' }}>
                      <StatusBadge status={ev.status} size="sm" />
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </Card>
      </div>
    </div>
  )
}
