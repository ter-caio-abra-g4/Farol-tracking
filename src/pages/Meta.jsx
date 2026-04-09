import { useState, useEffect } from 'react'
import Header from '../components/layout/Header'
import Card, { CardHeader, CardBody } from '../components/ui/Card'
import StatusBadge from '../components/ui/StatusBadge'
import Spinner from '../components/ui/Spinner'
import { api } from '../services/api'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  RadialBarChart, RadialBar,
} from 'recharts'
import { Settings, X, Eye, EyeOff, Save, ChevronRight } from 'lucide-react'
import PeriodSelect from '../components/ui/PeriodSelect'

const QUALITY_COLOR = {
  Excelente: '#22C55E',
  Alto: '#22C55E',
  Médio: '#F59E0B',
  Medio: '#F59E0B',
  Baixo: '#EF4444',
}

const PRIORITY_CONFIG = {
  alta:  { color: '#EF4444', bg: 'rgba(239,68,68,0.08)',  label: 'Alta'  },
  media: { color: '#F59E0B', bg: 'rgba(245,158,11,0.08)', label: 'Média' },
  baixa: { color: '#22C55E', bg: 'rgba(34,197,94,0.08)',  label: 'Baixa' },
}

export default function MetaPage() {
  const [stats, setStats]           = useState(null)
  const [volume, setVolume]         = useState(null)
  const [pixels, setPixels]         = useState([])
  const [pixelsLoading, setPixelsLoading] = useState(true)
  const [loading, setLoading]       = useState(true)
  const [lastUpdated, setLastUpdated] = useState(null)
  const [showModal, setShowModal]   = useState(false)
  const [config, setConfig]         = useState(null)
  const [volumeDays, setVolumeDays] = useState(7)

  async function loadPixels() {
    setPixelsLoading(true)
    const r = await api.metaPixels()
    setPixels(r?.pixels ?? [])
    setPixelsLoading(false)
  }

  async function loadData() {
    setLoading(true)
    const [s, vol, cfg] = await Promise.all([
      api.metaStats(),
      api.metaVolume(volumeDays),
      api.getConfig(),
    ])
    setStats(s)
    setVolume(vol)
    setConfig(cfg)
    setLoading(false)
    setLastUpdated(Date.now())
  }

  useEffect(() => {
    loadPixels()
    loadData()
  }, [])

  useEffect(() => {
    api.metaVolume(volumeDays).then(r => setVolume(r))
  }, [volumeDays])

  const isMock    = stats?.mock ?? true
  const data      = stats ?? {}
  const events    = data.events ?? []
  const score     = data.score ?? 0
  const matchRate = data.matchRate ?? 0
  const dedup     = data.deduplication ?? null
  const pixelId   = data.pixelId ?? config?.meta?.pixel_id ?? '—'
  const volRows   = volume?.rows ?? []
  const volMock   = volume?.mock ?? true

  const avgMatchRate = events.filter(e => e.matchRate > 0).length > 0
    ? Math.round(
        events.filter(e => e.matchRate > 0).reduce((s, e) => s + (e.matchRate || 0), 0) /
        events.filter(e => e.matchRate > 0).length
      )
    : matchRate

  const scoreColor  = score >= 85 ? '#22C55E' : score >= 70 ? '#F59E0B' : '#EF4444'
  const scoreStatus = score >= 85 ? 'ok' : score >= 70 ? 'warn' : 'error'

  // Recomendações dinâmicas baseadas nos dados reais
  const recommendations = buildRecommendations(events, dedup)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      <Header
        title="Meta Ads"
        subtitle={`Pixel ${pixelId} — Conversions API`}
        onRefresh={() => { loadPixels(); loadData() }}
        lastUpdated={lastUpdated}
        action={
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <PeriodSelect value={volumeDays} onChange={setVolumeDays} />
            <div style={{ width: 1, height: 18, background: 'rgba(185,145,91,0.2)' }} />
            <button
              onClick={() => setShowModal(true)}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '4px 12px', borderRadius: 6,
                border: '1px solid rgba(185,145,91,0.4)',
                background: 'rgba(185,145,91,0.08)',
                color: '#B9915B', fontSize: 12, fontWeight: 600,
                cursor: 'pointer', fontFamily: 'Manrope, sans-serif',
              }}
            >
              <Settings size={13} />
              Configurar
            </button>
          </div>
        }
      />

      <div style={{ flex: 1, overflow: 'auto', padding: 'clamp(12px, 2vw, 24px)', minWidth: 0 }}>

        {/* Mock warning */}
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

        {/* Pixels disponíveis */}
        {!pixelsLoading && pixels.length > 1 && (
          <Card style={{ marginBottom: 16 }}>
            <CardHeader title="Pixels disponíveis" action={
              <span style={{ fontSize: 11, color: '#8A9BAA' }}>{pixels.length} pixels</span>
            } />
            <div style={{ display: 'flex', gap: 8, padding: '8px 16px 14px', flexWrap: 'wrap' }}>
              {pixels.map(px => {
                const isActive = px.id === pixelId
                return (
                  <button
                    key={px.id}
                    onClick={async () => {
                      await api.saveConfig({ meta: { pixel_id: px.id } })
                      loadData()
                    }}
                    style={{
                      padding: '6px 14px', borderRadius: 6,
                      border: `1px solid ${isActive ? '#B9915B' : 'rgba(185,145,91,0.25)'}`,
                      background: isActive ? 'rgba(185,145,91,0.12)' : 'transparent',
                      color: isActive ? '#B9915B' : '#8A9BAA',
                      cursor: 'pointer', fontFamily: 'Manrope, sans-serif',
                      fontSize: 12, fontWeight: isActive ? 700 : 400,
                      textAlign: 'left',
                    }}
                  >
                    <div style={{ fontWeight: 600 }}>{px.name}</div>
                    <div style={{ fontSize: 10, fontFamily: 'monospace', opacity: 0.7 }}>{px.id}</div>
                  </button>
                )
              })}
            </div>
          </Card>
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
                        {score || '—'}
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
                  { label: 'Match Rate médio',  value: `${avgMatchRate}%`,                       sub: 'últimas 24h' },
                  { label: 'Deduplicação',       value: dedup ? `${dedup}%` : '—',                sub: 'CAPI + Pixel' },
                  { label: 'Eventos ativos',     value: events.length > 0 ? events.length : '—', sub: 'rastreados' },
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
                  <CardHeader
                    title={`CAPI vs Pixel — ${volumeDays === 1 ? 'hoje' : `últimos ${volumeDays} dias`}`}
                    action={
                      <div style={{ display: 'flex', gap: 6 }}>
                        {[1, 7, 14, 28].map(d => (
                          <button
                            key={d}
                            onClick={() => setVolumeDays(d)}
                            style={{
                              padding: '3px 9px', borderRadius: 4,
                              border: `1px solid ${volumeDays === d ? '#B9915B' : 'rgba(185,145,91,0.25)'}`,
                              background: volumeDays === d ? 'rgba(185,145,91,0.12)' : 'transparent',
                              color: volumeDays === d ? '#B9915B' : '#8A9BAA',
                              cursor: 'pointer', fontSize: 11, fontWeight: 600,
                              fontFamily: 'Manrope, sans-serif',
                            }}
                          >
                            {d === 1 ? '1d' : `${d}d`}
                          </button>
                        ))}
                        {volMock && (
                          <span style={{ fontSize: 10, color: '#F59E0B', alignSelf: 'center', marginLeft: 4 }}>mock</span>
                        )}
                      </div>
                    }
                  />
                  <CardBody style={{ paddingTop: 8 }}>
                    <ResponsiveContainer width="100%" height={90}>
                      <BarChart data={volRows} margin={{ top: 0, right: 4, left: -24, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#B9915B11" />
                        <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#8A9BAA' }} axisLine={false} tickLine={false} />
                        <YAxis tick={{ fontSize: 10, fill: '#8A9BAA' }} axisLine={false} tickLine={false} />
                        <Tooltip contentStyle={TOOLTIP_STYLE} />
                        <Bar dataKey="capi"  name="CAPI"  fill="#B9915B"   radius={[3, 3, 0, 0]} />
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
                <span style={{ fontSize: 11, color: '#8A9BAA' }}>{events.length} eventos</span>
              } />
              {events.length === 0 ? (
                <CardBody>
                  <div style={{ fontSize: 12, color: '#8A9BAA', textAlign: 'center', padding: 24 }}>
                    Nenhum evento encontrado. Verifique se o Pixel está disparando.
                  </div>
                </CardBody>
              ) : (
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
              )}
            </Card>

            {/* Recomendações */}
            {recommendations.length > 0 && (
              <Card>
                <CardHeader title="Recomendações" />
                <CardBody>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {recommendations.map((rec, i) => {
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
            )}
          </>
        )}
      </div>

      {/* Modal de configuração */}
      {showModal && (
        <MetaConfigModal
          currentConfig={config?.meta ?? {}}
          onClose={() => setShowModal(false)}
          onSaved={() => { setShowModal(false); loadPixels(); loadData() }}
        />
      )}
    </div>
  )
}

// ── Recomendações dinâmicas ──────────────────────────────────────────────────
function buildRecommendations(events, dedup) {
  const recs = []

  // Eventos com match rate < 80%
  const lowMatch = events.filter(e => e.matchRate > 0 && e.matchRate < 80)
  for (const ev of lowMatch.slice(0, 2)) {
    recs.push({
      priority: ev.matchRate < 70 ? 'alta' : 'media',
      title: `Melhorar match rate do evento ${ev.name}`,
      description: `Match rate atual: ${ev.matchRate}%. Adicione parâmetros como email, phone e external_id para aumentar para 85%+.`,
    })
  }

  // Deduplicação baixa
  if (dedup !== null && dedup < 90) {
    recs.push({
      priority: dedup < 80 ? 'alta' : 'media',
      title: 'Aumentar cobertura de deduplicação CAPI + Pixel',
      description: `Deduplicação em ${dedup}%. Certifique que o event_id está sendo enviado tanto pelo Pixel quanto pelo CAPI.`,
    })
  }

  // Eventos com 0 match rate (sem enriquecimento)
  const zeroMatch = events.filter(e => e.matchRate === 0)
  if (zeroMatch.length > 0) {
    recs.push({
      priority: 'media',
      title: `${zeroMatch.length} evento(s) sem match rate informado`,
      description: `${zeroMatch.map(e => e.name).join(', ')} não retornaram match_rate_approx. Verifique a configuração do CAPI ou se o evento tem volume suficiente.`,
    })
  }

  // Se não há problemas, mostra recomendação positiva + LDP
  if (recs.length === 0) {
    recs.push({
      priority: 'baixa',
      title: 'Verificar LDP (Limited Data Processing)',
      description: 'Confirme as configurações de privacidade para compliance LGPD e demais regulamentos aplicáveis.',
    })
  }

  return recs
}

// ── Modal de configuração ────────────────────────────────────────────────────
function MetaConfigModal({ currentConfig, onClose, onSaved }) {
  const hasExistingToken = !!(currentConfig?.access_token)
  const [token, setToken]         = useState('')
  const [pixelId, setPixelId]     = useState(currentConfig?.pixel_id ?? '')
  const [showToken, setShowToken] = useState(false)
  const [saving, setSaving]       = useState(false)
  const [error, setError]         = useState(null)
  const [testing, setTesting]     = useState(false)
  const [testResult, setTestResult] = useState(null)
  const [step, setStep]           = useState('form') // 'guide' | 'form'

  // Aviso de expiração: token_created_at salvo no config (dias desde criação)
  const tokenAge = currentConfig?.token_created_at
    ? Math.floor((Date.now() - new Date(currentConfig.token_created_at).getTime()) / 86400000)
    : null
  const tokenExpiring = tokenAge !== null && tokenAge >= 75 // avisa nos últimos 15 dias dos 90

  async function handleSave() {
    if (!pixelId.trim()) { setError('Preencha o Pixel ID.'); return }
    if (!token.trim() && !hasExistingToken) { setError('Preencha o Access Token.'); return }
    setSaving(true); setError(null)
    try {
      const metaUpdate = { pixel_id: pixelId.trim() }
      if (token.trim()) {
        metaUpdate.access_token = token.trim()
        metaUpdate.token_created_at = new Date().toISOString()
      }
      const result = await api.saveConfig({ meta: metaUpdate })
      if (result?.ok) { onSaved() } else { setError('Erro ao salvar configuração.') }
    } catch (e) {
      setError('Erro ao salvar: ' + e.message)
    } finally {
      setSaving(false)
    }
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
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1000,
      background: 'rgba(0,15,26,0.85)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      backdropFilter: 'blur(4px)',
    }}>
      <div style={{
        width: 500, background: '#001A2E',
        border: '1px solid rgba(185,145,91,0.3)',
        borderRadius: 12, padding: 28,
        boxShadow: '0 24px 60px rgba(0,0,0,0.6)',
        maxHeight: '90vh', overflowY: 'auto',
      }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <div>
            <h2 style={{ fontFamily: "'PPMuseum','Georgia',serif", fontSize: 16, color: '#B9915B', fontWeight: 600 }}>
              Configurar Meta Ads
            </h2>
            <p style={{ fontSize: 12, color: '#8A9BAA', marginTop: 4 }}>
              Token de longa duração + Pixel ID para dados reais
            </p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button
              onClick={() => setStep(s => s === 'guide' ? 'form' : 'guide')}
              style={{
                fontSize: 11, color: '#8A9BAA', background: 'rgba(138,155,170,0.1)',
                border: '1px solid rgba(138,155,170,0.2)', borderRadius: 5,
                padding: '4px 10px', cursor: 'pointer', fontFamily: 'Manrope, sans-serif',
              }}
            >
              {step === 'guide' ? '← Voltar' : 'Como configurar?'}
            </button>
            <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#8A9BAA', padding: 4 }}>
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Alerta de expiração */}
        {tokenExpiring && step === 'form' && (
          <div style={{
            padding: '10px 14px', marginBottom: 16,
            background: 'rgba(245,158,11,0.08)',
            border: '1px solid rgba(245,158,11,0.35)',
            borderRadius: 7, fontSize: 12, color: '#F59E0B',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10,
          }}>
            <span>
              Token configurado há <strong>{tokenAge} dias</strong> — expira em ~{90 - tokenAge} dias. Renove antes de expirar.
            </span>
            <a
              href="https://business.facebook.com/settings/system-users"
              target="_blank" rel="noreferrer"
              style={{ fontSize: 11, color: '#F59E0B', fontWeight: 700, textDecoration: 'underline', whiteSpace: 'nowrap' }}
            >
              Renovar agora
            </a>
          </div>
        )}

        {/* Mini-manual */}
        {step === 'guide' && (
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 12, color: '#8A9BAA', marginBottom: 14 }}>
              Siga os passos abaixo para obter as credenciais necessárias.
            </div>
            {[
              {
                num: '1',
                title: 'Encontre o Pixel ID',
                desc: 'Acesse o Gerenciador de Eventos. Clique na fonte de dados (pixel) na coluna da esquerda. O número abaixo do nome é o Pixel ID.',
                link: 'https://business.facebook.com/events_manager',
                linkLabel: 'Abrir Gerenciador de Eventos',
              },
              {
                num: '2',
                title: 'Gere um System User Token',
                desc: 'Em Business Settings → System Users, crie um System User com função "Employee". Clique em "Gerar token", selecione seu app, marque as permissões ads_read e business_management. Validade máxima: 90 dias.',
                link: 'https://business.facebook.com/settings/system-users',
                linkLabel: 'Abrir System Users',
              },
              {
                num: '3',
                title: 'Alternativa: token pessoal (curta duração)',
                desc: 'Se não tiver Business Manager, use o Graph API Explorer para gerar um token com ads_read. Atenção: expira em 60 dias e precisa de renovação manual.',
                link: 'https://developers.facebook.com/tools/explorer/',
                linkLabel: 'Abrir Graph API Explorer',
              },
              {
                num: '4',
                title: 'Cole as credenciais e teste',
                desc: 'Volte ao formulário, preencha o Pixel ID e o Access Token, clique em "Testar conexão" para validar antes de salvar.',
              },
            ].map((s) => (
              <div key={s.num} style={{
                display: 'flex', gap: 14, padding: '12px 14px', marginBottom: 8,
                background: 'rgba(185,145,91,0.04)',
                border: '1px solid rgba(185,145,91,0.12)',
                borderRadius: 8,
              }}>
                <div style={{
                  width: 22, height: 22, borderRadius: '50%',
                  background: 'rgba(185,145,91,0.15)',
                  border: '1px solid rgba(185,145,91,0.3)',
                  color: '#B9915B', fontSize: 11, fontWeight: 800,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  flexShrink: 0, marginTop: 1,
                }}>
                  {s.num}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#F5F4F3', marginBottom: 4 }}>{s.title}</div>
                  <p style={{ fontSize: 12, color: '#8A9BAA', lineHeight: 1.55, margin: 0 }}>{s.desc}</p>
                  {s.link && (
                    <a
                      href={s.link} target="_blank" rel="noreferrer"
                      style={{
                        display: 'inline-flex', alignItems: 'center', gap: 4,
                        fontSize: 11, color: '#B9915B', textDecoration: 'none',
                        marginTop: 6, fontWeight: 600,
                      }}
                    >
                      {s.linkLabel}
                      <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M1.5 8.5L8.5 1.5M8.5 1.5H3.5M8.5 1.5V6.5" stroke="#B9915B" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/></svg>
                    </a>
                  )}
                </div>
              </div>
            ))}
            <button
              onClick={() => setStep('form')}
              style={{
                width: '100%', marginTop: 4, padding: '9px', borderRadius: 6,
                border: '1px solid rgba(185,145,91,0.4)',
                background: 'transparent', color: '#B9915B',
                fontSize: 13, fontWeight: 600, cursor: 'pointer',
                fontFamily: 'Manrope, sans-serif',
              }}
            >
              Ir para o formulário →
            </button>
          </div>
        )}

        {/* Formulário */}
        {step === 'form' && (
          <>
            {/* Pixel ID */}
            <div style={{ marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                <label style={{ fontSize: 11, color: '#8A9BAA', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                  Pixel ID
                </label>
                <a
                  href="https://business.facebook.com/events_manager"
                  target="_blank" rel="noreferrer"
                  style={{ fontSize: 11, color: '#B9915B', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 4 }}
                >
                  Onde encontrar?
                  <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M1.5 8.5L8.5 1.5M8.5 1.5H3.5M8.5 1.5V6.5" stroke="#B9915B" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/></svg>
                </a>
              </div>
              <input
                value={pixelId}
                onChange={e => setPixelId(e.target.value)}
                placeholder="ex: 702432142505333"
                style={INPUT_STYLE}
              />
              <p style={{ fontSize: 11, color: '#8A9BAA', marginTop: 5, lineHeight: 1.5 }}>
                No Gerenciador de Eventos, clique na fonte de dados — o ID numérico aparece abaixo do nome.
              </p>
            </div>

            {/* Access Token */}
            <div style={{ marginBottom: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                <label style={{ fontSize: 11, color: '#8A9BAA', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                  Access Token
                </label>
                <a
                  href="https://business.facebook.com/settings/system-users"
                  target="_blank" rel="noreferrer"
                  style={{ fontSize: 11, color: '#B9915B', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 4 }}
                >
                  Gerar token
                  <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M1.5 8.5L8.5 1.5M8.5 1.5H3.5M8.5 1.5V6.5" stroke="#B9915B" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/></svg>
                </a>
              </div>
              <div style={{ position: 'relative' }}>
                <input
                  type={showToken ? 'text' : 'password'}
                  value={token}
                  onChange={e => setToken(e.target.value)}
                  placeholder={hasExistingToken ? '••••••••  (token já configurado — deixe em branco para manter)' : 'dapi... ou EAAxxxxx (token de longa duração)'}
                  style={{ ...INPUT_STYLE, paddingRight: 40 }}
                />
                <button
                  onClick={() => setShowToken(v => !v)}
                  style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#8A9BAA' }}
                >
                  {showToken ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>

            {/* Hint */}
            <p style={{ fontSize: 11, color: '#8A9BAA', marginBottom: 20, lineHeight: 1.5 }}>
              Use um <strong style={{ color: '#F5F4F3' }}>System User Token</strong> com permissão{' '}
              <code style={{ color: '#B9915B' }}>ads_read</code> e{' '}
              <code style={{ color: '#B9915B' }}>business_management</code>. Validade máxima: 90 dias.{' '}
              <button
                onClick={() => setStep('guide')}
                style={{ background: 'none', border: 'none', color: '#B9915B', cursor: 'pointer', fontSize: 11, padding: 0, textDecoration: 'underline', fontFamily: 'Manrope, sans-serif' }}
              >
                Ver passo a passo
              </button>
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
          </>
        )}
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
