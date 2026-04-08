import { useState, useEffect } from 'react'
import Header from '../components/layout/Header'
import Card, { CardHeader, CardBody } from '../components/ui/Card'
import StatusBadge from '../components/ui/StatusBadge'
import Spinner from '../components/ui/Spinner'
import { api } from '../services/api'
import {
  RadialBarChart, RadialBar, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
} from 'recharts'
import { Settings, X, Eye, EyeOff, ChevronRight, Save } from 'lucide-react'

const QUALITY_COLOR = {
  Excelente: '#22C55E',
  Alto: '#22C55E',
  Medio: '#F59E0B',
  Médio: '#F59E0B',
  Baixo: '#EF4444',
}

const PRIORITY_CONFIG = {
  alta: { color: '#EF4444', bg: 'rgba(239,68,68,0.08)', label: 'Alta' },
  media: { color: '#F59E0B', bg: 'rgba(245,158,11,0.08)', label: 'Média' },
  baixa: { color: '#22C55E', bg: 'rgba(34,197,94,0.08)', label: 'Baixa' },
}

const MOCK_RECOMMENDATIONS = [
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
    title: 'Verificar LDP (Limited Data Processing)',
    description: 'Confirme as configurações de privacidade para compliance LGPD.',
  },
]

const MOCK_VOLUME = [
  { hora: '00h', capi: 120, pixel: 118 },
  { hora: '04h', capi: 80, pixel: 78 },
  { hora: '08h', capi: 340, pixel: 330 },
  { hora: '12h', capi: 520, pixel: 505 },
  { hora: '16h', capi: 480, pixel: 472 },
  { hora: '20h', capi: 310, pixel: 298 },
  { hora: '23h', capi: 190, pixel: 185 },
]

export default function MetaPage() {
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)
  const [lastUpdated, setLastUpdated] = useState(null)
  const [showModal, setShowModal] = useState(false)
  const [config, setConfig] = useState(null)

  async function loadData() {
    setLoading(true)
    const [s, cfg] = await Promise.all([
      api.metaStats(),
      api.getConfig(),
    ])
    setStats(s)
    setConfig(cfg)
    setLoading(false)
    setLastUpdated(Date.now())
  }

  useEffect(() => { loadData() }, [])

  const isMock = stats?.mock ?? true
  const data = stats ?? {}
  const events = data.events ?? []
  const score = data.score ?? 0
  const matchRate = data.matchRate ?? 0
  const deduplication = data.deduplication ?? 0
  const pixelId = data.pixelId ?? config?.meta?.pixel_id ?? '—'
  const eventsVolume = data.eventsVolume ?? MOCK_VOLUME

  const avgMatchRate = events.length > 0
    ? Math.round(events.reduce((s, e) => s + (e.matchRate || 0), 0) / events.length)
    : matchRate

  const scoreColor = score >= 85 ? '#22C55E' : score >= 70 ? '#F59E0B' : '#EF4444'
  const scoreStatus = score >= 85 ? 'ok' : score >= 70 ? 'warn' : 'error'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      <Header
        title="Meta Ads"
        subtitle={`Pixel ${pixelId} — Conversions API`}
        onRefresh={loadData}
        lastUpdated={lastUpdated}
        action={
          <button
            onClick={() => setShowModal(true)}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '6px 14px', borderRadius: 6,
              border: '1px solid rgba(185,145,91,0.4)',
              background: 'rgba(185,145,91,0.08)',
              color: '#B9915B', fontSize: 12, fontWeight: 600,
              cursor: 'pointer', fontFamily: 'Manrope, sans-serif',
            }}
          >
            <Settings size={13} />
            Configurar
          </button>
        }
      />

      <div style={{ flex: 1, overflow: 'auto', padding: 24 }}>

        {/* Mock warning banner */}
        {isMock && !loading && (
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '10px 16px', marginBottom: 16,
            background: 'rgba(245,158,11,0.08)',
            border: '1px solid rgba(245,158,11,0.3)',
            borderRadius: 8,
          }}>
            <span style={{ fontSize: 12, color: '#F59E0B' }}>
              Exibindo dados mock — configure o Access Token e Pixel ID para dados reais
            </span>
            <button
              onClick={() => setShowModal(true)}
              style={{
                fontSize: 11, color: '#F59E0B', fontWeight: 700,
                background: 'none', border: 'none', cursor: 'pointer',
                textDecoration: 'underline', fontFamily: 'Manrope, sans-serif',
              }}
            >
              Configurar agora
            </button>
          </div>
        )}

        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}><Spinner /></div>
        ) : (
          <>
            {/* Score + métricas principais */}
            <div style={{ display: 'grid', gridTemplateColumns: '260px 1fr', gap: 16, marginBottom: 20 }}>
              {/* Score card */}
              <Card>
                <CardBody style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: 24 }}>
                  <div style={{
                    fontFamily: "'PPMuseum','Georgia',serif",
                    fontSize: 12, color: '#8A9BAA', marginBottom: 16,
                    letterSpacing: '0.04em', textTransform: 'uppercase',
                  }}>
                    Event Match Quality
                  </div>
                  <div style={{ position: 'relative', width: 130, height: 130 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <RadialBarChart
                        innerRadius="70%" outerRadius="100%"
                        data={[{ value: score }]}
                        startAngle={220} endAngle={-40}
                      >
                        <RadialBar
                          dataKey="value" cornerRadius={6}
                          fill={scoreColor}
                          background={{ fill: `${scoreColor}11` }}
                        />
                      </RadialBarChart>
                    </ResponsiveContainer>
                    <div style={{
                      position: 'absolute', top: '50%', left: '50%',
                      transform: 'translate(-50%, -50%)', textAlign: 'center',
                    }}>
                      <div style={{ fontSize: 30, fontWeight: 800, color: scoreColor, lineHeight: 1 }}>
                        {score}
                      </div>
                      <div style={{ fontSize: 10, color: '#8A9BAA', marginTop: 2 }}>/ 100</div>
                    </div>
                  </div>
                  <StatusBadge
                    status={scoreStatus}
                    label={score >= 85 ? 'Qualidade boa' : score >= 70 ? 'Precisa melhorar' : 'Crítico'}
                    style={{ marginTop: 12 }}
                  />
                  {isMock && (
                    <span style={{
                      fontSize: 10, color: '#8A9BAA',
                      background: 'rgba(138,155,170,0.1)',
                      border: '1px solid rgba(138,155,170,0.2)',
                      padding: '2px 7px', borderRadius: 10, marginTop: 8,
                    }}>
                      mock
                    </span>
                  )}
                </CardBody>
              </Card>

              {/* Métricas rápidas + gráfico */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
                {[
                  { label: 'Match Rate médio', value: `${avgMatchRate}%`, sub: 'últimas 24h' },
                  { label: 'Deduplicação', value: deduplication ? `${deduplication}%` : '—', sub: 'CAPI + Pixel' },
                  { label: 'Eventos ativos', value: events.length, sub: 'rastreados' },
                ].map((m, i) => (
                  <Card key={i}>
                    <CardBody>
                      <div style={{ fontSize: 24, fontWeight: 800, color: '#F5F4F3', lineHeight: 1 }}>{m.value}</div>
                      <div style={{ fontSize: 12, color: '#B9915B', marginTop: 4, fontWeight: 600 }}>{m.label}</div>
                      <div style={{ fontSize: 10, color: '#8A9BAA', marginTop: 2 }}>{m.sub}</div>
                    </CardBody>
                  </Card>
                ))}

                {/* Gráfico CAPI vs Pixel */}
                <Card style={{ gridColumn: '1 / -1' }}>
                  <CardHeader title="CAPI vs Pixel — volume últimas 24h" />
                  <CardBody style={{ paddingTop: 8 }}>
                    <ResponsiveContainer width="100%" height={90}>
                      <BarChart data={eventsVolume} margin={{ top: 0, right: 4, left: -24, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#B9915B11" />
                        <XAxis dataKey="hora" tick={{ fontSize: 10, fill: '#8A9BAA' }} axisLine={false} tickLine={false} />
                        <YAxis tick={{ fontSize: 10, fill: '#8A9BAA' }} axisLine={false} tickLine={false} />
                        <Tooltip contentStyle={TOOLTIP_STYLE} />
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
              <CardHeader title="Qualidade por evento" action={
                <span style={{ fontSize: 11, color: '#8A9BAA' }}>
                  {events.length} eventos
                </span>
              } />
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid rgba(185,145,91,0.2)' }}>
                    {['Evento', 'Recebidos', 'Matched', 'Match Rate', 'Qualidade', 'Status'].map((h) => (
                      <th key={h} style={{
                        padding: '10px 16px', textAlign: 'left',
                        fontSize: 11, color: '#8A9BAA', fontWeight: 600,
                        letterSpacing: '0.06em', textTransform: 'uppercase',
                      }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {events.map((ev, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid rgba(185,145,91,0.08)' }}>
                      <td style={{ padding: '11px 16px', fontSize: 13, fontWeight: 600, color: '#F5F4F3', fontFamily: 'monospace' }}>
                        {ev.name}
                      </td>
                      <td style={{ padding: '11px 16px', fontSize: 13, color: '#F5F4F3' }}>
                        {(ev.received || 0).toLocaleString('pt-BR')}
                      </td>
                      <td style={{ padding: '11px 16px', fontSize: 13, color: '#F5F4F3' }}>
                        {(ev.matched || 0).toLocaleString('pt-BR')}
                      </td>
                      <td style={{ padding: '11px 16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <div style={{ width: 80, height: 6, background: 'rgba(255,255,255,0.08)', borderRadius: 3, overflow: 'hidden' }}>
                            <div style={{
                              width: `${ev.matchRate || 0}%`, height: '100%', borderRadius: 3,
                              background: (ev.matchRate || 0) >= 85 ? '#22C55E' : (ev.matchRate || 0) >= 75 ? '#F59E0B' : '#EF4444',
                            }} />
                          </div>
                          <span style={{ fontSize: 12, color: '#F5F4F3', fontWeight: 600 }}>
                            {ev.matchRate || 0}%
                          </span>
                        </div>
                      </td>
                      <td style={{ padding: '11px 16px' }}>
                        <span style={{
                          fontSize: 11, fontWeight: 700,
                          color: QUALITY_COLOR[ev.quality] ?? '#F5F4F3',
                        }}>
                          {ev.quality || '—'}
                        </span>
                      </td>
                      <td style={{ padding: '11px 16px' }}>
                        <StatusBadge status={ev.status || 'ok'} size="sm" />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>

            {/* Recomendações */}
            <Card>
              <CardHeader title="Recomendações" />
              <CardBody>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {MOCK_RECOMMENDATIONS.map((rec, i) => {
                    const cfg = PRIORITY_CONFIG[rec.priority]
                    return (
                      <div key={i} style={{
                        display: 'flex', gap: 14, padding: '14px 16px',
                        background: cfg.bg, border: `1px solid ${cfg.color}33`, borderRadius: 8,
                      }}>
                        <div style={{
                          width: 6, height: 6, borderRadius: '50%',
                          background: cfg.color, marginTop: 6, flexShrink: 0,
                          boxShadow: `0 0 6px ${cfg.color}88`,
                        }} />
                        <div style={{ flex: 1 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                            <span style={{ fontSize: 13, fontWeight: 700, color: '#F5F4F3' }}>{rec.title}</span>
                            <span style={{
                              fontSize: 10, fontWeight: 700, color: cfg.color,
                              background: `${cfg.color}22`, padding: '2px 7px',
                              borderRadius: 4, letterSpacing: '0.06em',
                            }}>
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
          </>
        )}
      </div>

      {/* Modal de configuração */}
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

// ── Modal de configuração ────────────────────────────────────────────────────
function MetaConfigModal({ currentConfig, onClose, onSaved }) {
  // O token retornado pelo servidor é mascarado (ex: "EAAxxxxx...xxxx")
  // Deixamos em branco para forçar o usuário a redigitar ao atualizar
  const hasExistingToken = !!(currentConfig?.access_token)
  const [token, setToken] = useState('')
  const [pixelId, setPixelId] = useState(currentConfig?.pixel_id ?? '')
  const [showToken, setShowToken] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState(null)

  async function handleSave() {
    if (!pixelId.trim()) {
      setError('Preencha o Pixel ID.')
      return
    }
    if (!token.trim() && !hasExistingToken) {
      setError('Preencha o Access Token.')
      return
    }
    setSaving(true)
    setError(null)
    try {
      const metaUpdate = { pixel_id: pixelId.trim() }
      if (token.trim()) metaUpdate.access_token = token.trim()
      const result = await api.saveConfig({ meta: metaUpdate })
      if (result?.ok) {
        onSaved()
      } else {
        setError('Erro ao salvar configuração.')
      }
    } catch (e) {
      setError('Erro ao salvar: ' + e.message)
    } finally {
      setSaving(false)
    }
  }

  async function handleTest() {
    if (!pixelId.trim()) {
      setError('Preencha o Pixel ID antes de testar.')
      return
    }
    if (!token.trim() && !hasExistingToken) {
      setError('Preencha o Access Token antes de testar.')
      return
    }
    setTesting(true)
    setTestResult(null)
    setError(null)
    // Salva config atual e testa
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
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1000,
      background: 'rgba(0,15,26,0.85)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      backdropFilter: 'blur(4px)',
    }}>
      <div style={{
        width: 480, background: '#001A2E',
        border: '1px solid rgba(185,145,91,0.3)',
        borderRadius: 12, padding: 28,
        boxShadow: '0 24px 60px rgba(0,0,0,0.6)',
      }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
          <div>
            <h2 style={{
              fontFamily: "'PPMuseum','Georgia',serif",
              fontSize: 16, color: '#B9915B', fontWeight: 600,
            }}>
              Configurar Meta Ads
            </h2>
            <p style={{ fontSize: 12, color: '#8A9BAA', marginTop: 4 }}>
              Token de longa duração + Pixel ID para dados reais
            </p>
          </div>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#8A9BAA', padding: 4 }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Pixel ID */}
        <div style={{ marginBottom: 16 }}>
          <label style={{ fontSize: 11, color: '#8A9BAA', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', display: 'block', marginBottom: 6 }}>
            Pixel ID
          </label>
          <input
            value={pixelId}
            onChange={e => setPixelId(e.target.value)}
            placeholder="ex: 702432142505333"
            style={INPUT_STYLE}
          />
        </div>

        {/* Access Token */}
        <div style={{ marginBottom: 8 }}>
          <label style={{ fontSize: 11, color: '#8A9BAA', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', display: 'block', marginBottom: 6 }}>
            Access Token
          </label>
          <div style={{ position: 'relative' }}>
            <input
              type={showToken ? 'text' : 'password'}
              value={token}
              onChange={e => setToken(e.target.value)}
              placeholder={hasExistingToken ? '••••••••  (token já configurado — deixe em branco para manter)' : 'EAAxxxxx... (token de longa duração)'}
              style={{ ...INPUT_STYLE, paddingRight: 40 }}
            />
            <button
              onClick={() => setShowToken(v => !v)}
              style={{
                position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
                background: 'none', border: 'none', cursor: 'pointer', color: '#8A9BAA',
              }}
            >
              {showToken ? <EyeOff size={15} /> : <Eye size={15} />}
            </button>
          </div>
        </div>

        {/* Hint */}
        <p style={{ fontSize: 11, color: '#8A9BAA', marginBottom: 20, lineHeight: 1.5 }}>
          Use um <strong style={{ color: '#F5F4F3' }}>System User Token</strong> ou token de longa duração (60 dias) com permissão <code style={{ color: '#B9915B' }}>ads_read</code> e <code style={{ color: '#B9915B' }}>business_management</code>. Evite tokens de 24h.
        </p>

        {/* Error / Test result */}
        {error && (
          <div style={{ padding: '8px 12px', marginBottom: 12, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 6, fontSize: 12, color: '#EF4444' }}>
            {error}
          </div>
        )}
        {testResult && (
          <div style={{
            padding: '8px 12px', marginBottom: 12, borderRadius: 6, fontSize: 12,
            background: testResult.ok ? 'rgba(34,197,94,0.08)' : 'rgba(239,68,68,0.08)',
            border: `1px solid ${testResult.ok ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.3)'}`,
            color: testResult.ok ? '#22C55E' : '#EF4444',
          }}>
            {testResult.ok ? '✓ ' : '✗ '}{testResult.detail}
          </div>
        )}

        {/* Actions */}
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button
            onClick={handleTest}
            disabled={testing}
            style={{
              padding: '8px 18px', borderRadius: 6,
              border: '1px solid rgba(185,145,91,0.4)',
              background: 'transparent',
              color: '#B9915B', fontSize: 13, fontWeight: 600,
              cursor: testing ? 'not-allowed' : 'pointer',
              opacity: testing ? 0.6 : 1,
              fontFamily: 'Manrope, sans-serif',
              display: 'flex', alignItems: 'center', gap: 6,
            }}
          >
            {testing ? <Spinner size={13} /> : null}
            {testing ? 'Testando...' : 'Testar conexão'}
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            style={{
              padding: '8px 20px', borderRadius: 6,
              border: 'none',
              background: saving ? 'rgba(185,145,91,0.5)' : '#B9915B',
              color: '#001F35', fontSize: 13, fontWeight: 700,
              cursor: saving ? 'not-allowed' : 'pointer',
              fontFamily: 'Manrope, sans-serif',
              display: 'flex', alignItems: 'center', gap: 6,
            }}
          >
            {saving ? <Spinner size={13} /> : <Save size={13} />}
            {saving ? 'Salvando...' : 'Salvar'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Helpers ─────────────────────────────────────────────────────────────────
const TOOLTIP_STYLE = {
  background: '#001F35', border: '1px solid #B9915B55',
  borderRadius: 6, fontSize: 12, color: '#F5F4F3',
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
