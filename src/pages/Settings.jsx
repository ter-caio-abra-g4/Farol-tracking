import { useState } from 'react'
import Header from '../components/layout/Header'
import Card, { CardHeader, CardBody } from '../components/ui/Card'
import { Key, RefreshCw, CheckCircle, AlertTriangle } from 'lucide-react'

const SOURCES = [
  { id: 'ga4', name: 'Google Analytics 4', desc: 'Dados de eventos e propriedades GA4', connected: true },
  { id: 'gtm', name: 'Google Tag Manager', desc: 'Containers, tags e triggers via API', connected: true },
  { id: 'meta', name: 'Meta Ads — Conversions API', desc: 'Pixel e eventos via CAPI', connected: true },
]

export default function SettingsPage() {
  const [sources] = useState(SOURCES)
  const [refreshInterval, setRefreshInterval] = useState(5)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      <Header title="Configurações" subtitle="Conexões e preferências do RAIS" />

      <div style={{ flex: 1, overflow: 'auto', padding: 24 }}>
        {/* Fontes de dados */}
        <Card style={{ marginBottom: 20 }}>
          <CardHeader title="Fontes de dados" />
          <CardBody style={{ padding: '12px 20px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {sources.map((s) => (
                <div
                  key={s.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '14px 16px',
                    background: '#031A26',
                    borderRadius: 8,
                    border: '1px solid rgba(185,145,91,0.15)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div
                      style={{
                        width: 36,
                        height: 36,
                        background: 'rgba(185,145,91,0.1)',
                        borderRadius: 8,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Key size={16} color="#B9915B" />
                    </div>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: '#F5F4F3' }}>{s.name}</div>
                      <div style={{ fontSize: 11, color: '#8A9BAA', marginTop: 2 }}>{s.desc}</div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    {s.connected ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 5, color: '#22C55E', fontSize: 12 }}>
                        <CheckCircle size={13} />
                        Conectado
                      </div>
                    ) : (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 5, color: '#F59E0B', fontSize: 12 }}>
                        <AlertTriangle size={13} />
                        Configurar
                      </div>
                    )}
                    <button
                      style={{
                        background: 'rgba(185,145,91,0.1)',
                        border: '1px solid rgba(185,145,91,0.3)',
                        borderRadius: 6,
                        padding: '5px 12px',
                        color: '#B9915B',
                        cursor: 'pointer',
                        fontSize: 12,
                        fontWeight: 500,
                      }}
                    >
                      Editar
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </CardBody>
        </Card>

        {/* Preferências */}
        <Card>
          <CardHeader title="Preferências" />
          <CardBody>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid rgba(185,145,91,0.1)' }}>
              <div>
                <div style={{ fontSize: 13, color: '#F5F4F3', fontWeight: 500 }}>Auto-refresh</div>
                <div style={{ fontSize: 11, color: '#8A9BAA', marginTop: 2 }}>Intervalo de atualização automática</div>
              </div>
              <select
                value={refreshInterval}
                onChange={(e) => setRefreshInterval(Number(e.target.value))}
                style={{
                  background: '#031A26',
                  border: '1px solid rgba(185,145,91,0.3)',
                  borderRadius: 6,
                  color: '#F5F4F3',
                  padding: '6px 12px',
                  fontSize: 13,
                  cursor: 'pointer',
                  outline: 'none',
                }}
              >
                {[1, 2, 5, 10, 15, 30].map((v) => (
                  <option key={v} value={v}>{v} min</option>
                ))}
              </select>
            </div>

            <div style={{ paddingTop: 16 }}>
              <div style={{ fontSize: 12, color: '#8A9BAA', marginBottom: 10 }}>Sobre</div>
              <div style={{ fontSize: 12, color: '#8A9BAA', lineHeight: 1.8 }}>
                <div><span style={{ color: '#F5F4F3' }}>RAIS</span> — Tracking Intelligence</div>
                <div>Versão 1.0.0 · G4 Education MarTech</div>
                <div>Caio Matheus dos Santos Abra</div>
              </div>
            </div>
          </CardBody>
        </Card>
      </div>
    </div>
  )
}
