import { useState, useEffect } from 'react'
import Header from '../components/layout/Header'
import Card, { CardHeader, CardBody } from '../components/ui/Card'
import StatusBadge from '../components/ui/StatusBadge'
import Spinner from '../components/ui/Spinner'
import { api } from '../services/api'
import { Settings, X, Eye, EyeOff, Save, Database, ChevronRight } from 'lucide-react'

export default function DatabricksPage() {
  const [status, setStatus]         = useState(null)
  const [tables, setTables]         = useState([])
  const [loading, setLoading]       = useState(true)
  const [lastUpdated, setLastUpdated] = useState(null)
  const [showModal, setShowModal]   = useState(false)
  const [config, setConfig]         = useState(null)
  const [selectedTable, setSelectedTable] = useState(null)
  const [preview, setPreview]       = useState(null)
  const [previewLoading, setPreviewLoading] = useState(false)

  async function loadData() {
    setLoading(true)
    const [s, t, cfg] = await Promise.all([
      api.databricksStatus(),
      api.databricksTables(),
      api.getConfig(),
    ])
    setStatus(s)
    setTables(t?.tables ?? [])
    setConfig(cfg)
    setLoading(false)
    setLastUpdated(Date.now())
  }

  async function loadPreview(tableName) {
    setSelectedTable(tableName)
    setPreview(null)
    setPreviewLoading(true)
    const r = await api.databricksPreview(tableName)
    setPreview(r)
    setPreviewLoading(false)
  }

  useEffect(() => { loadData() }, [])

  const isMock   = status?.mock ?? true
  const host     = config?.databricks?.host ?? '—'
  const catalog  = config?.databricks?.catalog ?? 'hive_metastore'
  const schema   = config?.databricks?.schema ?? '—'

  // Aviso de expiração do token
  const tokenAge = config?.databricks?.token_created_at
    ? Math.floor((Date.now() - new Date(config.databricks.token_created_at).getTime()) / 86400000)
    : null
  const tokenExpiring = tokenAge !== null && tokenAge >= 75

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      <Header
        title="Databricks"
        subtitle={`${host !== '—' ? host.replace('https://', '') : 'não configurado'} · ${catalog}.${schema}`}
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

      <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column', padding: 'clamp(12px, 2vw, 24px)', gap: 16, minWidth: 0 }}>

        {/* Alerta de expiração */}
        {tokenExpiring && !loading && (
          <div style={{
            padding: '10px 16px',
            background: 'rgba(245,158,11,0.08)',
            border: '1px solid rgba(245,158,11,0.35)',
            borderRadius: 8, fontSize: 12, color: '#F59E0B',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          }}>
            <span>
              Token configurado há <strong>{tokenAge} dias</strong> — expira em ~{90 - tokenAge} dias.
            </span>
            <button
              onClick={() => setShowModal(true)}
              style={{ fontSize: 11, color: '#F59E0B', fontWeight: 700, background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline', fontFamily: 'Manrope, sans-serif' }}
            >
              Renovar token
            </button>
          </div>
        )}

        {/* Mock warning */}
        {isMock && !loading && (
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '10px 16px',
            background: 'rgba(245,158,11,0.08)',
            border: '1px solid rgba(245,158,11,0.3)',
            borderRadius: 8,
          }}>
            <span style={{ fontSize: 12, color: '#F59E0B' }}>
              Exibindo dados mock — configure o Databricks Token e Warehouse HTTP Path para dados reais
            </span>
            <button
              onClick={() => setShowModal(true)}
              style={{ fontSize: 11, color: '#F59E0B', fontWeight: 700, background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline', fontFamily: 'Manrope, sans-serif' }}
            >
              Configurar agora
            </button>
          </div>
        )}

        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}><Spinner /></div>
        ) : (
          <div style={{ flex: 1, overflow: 'hidden', display: 'grid', gridTemplateColumns: '280px 1fr', gap: 16 }}>

            {/* Lista de tabelas */}
            <Card style={{ overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
              <CardHeader title="Tabelas" action={
                <span style={{ fontSize: 11, color: '#8A9BAA' }}>{tables.length}</span>
              } />
              <div style={{ flex: 1, overflowY: 'auto' }}>
                {tables.length === 0 ? (
                  <div style={{ padding: 20, fontSize: 12, color: '#8A9BAA', textAlign: 'center' }}>
                    Nenhuma tabela encontrada.<br />Verifique as configurações.
                  </div>
                ) : (
                  tables.map((t, i) => (
                    <button
                      key={i}
                      onClick={() => loadPreview(t.fullName)}
                      style={{
                        width: '100%', textAlign: 'left',
                        padding: '10px 16px',
                        background: selectedTable === t.fullName ? 'rgba(185,145,91,0.08)' : 'transparent',
                        borderLeft: selectedTable === t.fullName ? '2px solid #B9915B' : '2px solid transparent',
                        border: 'none', borderBottom: '1px solid rgba(185,145,91,0.07)',
                        cursor: 'pointer', fontFamily: 'Manrope, sans-serif',
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
                      }}
                    >
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: 12, fontWeight: 600, color: '#F5F4F3', fontFamily: 'monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {t.name}
                        </div>
                        <div style={{ fontSize: 10, color: '#8A9BAA', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {t.schema ?? schema}
                        </div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                        {t.rowCount != null && (
                          <span style={{ fontSize: 10, color: '#8A9BAA' }}>
                            {t.rowCount.toLocaleString('pt-BR')}
                          </span>
                        )}
                        <ChevronRight size={12} color="#8A9BAA" />
                      </div>
                    </button>
                  ))
                )}
              </div>
            </Card>

            {/* Preview / detalhes da tabela */}
            <Card style={{ overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
              {!selectedTable ? (
                <CardBody style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 1 }}>
                  <div style={{ textAlign: 'center', color: '#8A9BAA' }}>
                    <Database size={32} strokeWidth={1} style={{ marginBottom: 12, opacity: 0.4 }} />
                    <div style={{ fontSize: 12 }}>Selecione uma tabela para ver o preview</div>
                  </div>
                </CardBody>
              ) : previewLoading ? (
                <CardBody style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 1 }}>
                  <Spinner />
                </CardBody>
              ) : preview ? (
                <>
                  <CardHeader
                    title={
                      <span style={{ fontFamily: 'monospace', fontSize: 13 }}>{selectedTable}</span>
                    }
                    action={
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        {preview.mock && <span style={{ fontSize: 10, color: '#F59E0B' }}>mock</span>}
                        <span style={{ fontSize: 11, color: '#8A9BAA' }}>
                          {preview.columns?.length ?? 0} colunas · {preview.rows?.length ?? 0} linhas (preview)
                        </span>
                      </div>
                    }
                  />
                  <div style={{ flex: 1, overflow: 'auto' }}>
                    {preview.columns?.length > 0 && (
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                        <thead>
                          <tr style={{ borderBottom: '1px solid rgba(185,145,91,0.2)', position: 'sticky', top: 0, background: '#001A2E' }}>
                            {preview.columns.map((col, ci) => (
                              <th key={ci} style={{
                                padding: '8px 12px', textAlign: 'left',
                                fontSize: 11, color: '#8A9BAA', fontWeight: 600,
                                letterSpacing: '0.04em', whiteSpace: 'nowrap',
                              }}>
                                <div style={{ fontFamily: 'monospace', color: '#F5F4F3' }}>{col.name}</div>
                                <div style={{ fontSize: 10, color: '#8A9BAA55', marginTop: 1 }}>{col.type}</div>
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {(preview.rows ?? []).map((row, ri) => (
                            <tr key={ri} style={{ borderBottom: '1px solid rgba(185,145,91,0.06)' }}>
                              {preview.columns.map((col, ci) => (
                                <td key={ci} style={{
                                  padding: '7px 12px', color: '#F5F4F3',
                                  fontFamily: 'monospace', fontSize: 11,
                                  maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                                }}>
                                  {row[col.name] == null ? (
                                    <span style={{ color: '#8A9BAA55' }}>null</span>
                                  ) : String(row[col.name])}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                </>
              ) : null}
            </Card>
          </div>
        )}
      </div>

      {showModal && (
        <DatabricksConfigModal
          currentConfig={config?.databricks ?? {}}
          onClose={() => setShowModal(false)}
          onSaved={() => { setShowModal(false); loadData() }}
        />
      )}
    </div>
  )
}

// ── Modal de configuração ────────────────────────────────────────────────────
function DatabricksConfigModal({ currentConfig, onClose, onSaved }) {
  const hasExistingToken = !!(currentConfig?.token)
  const [host, setHost]           = useState(currentConfig?.host ?? '')
  const [httpPath, setHttpPath]   = useState(currentConfig?.http_path ?? '')
  const [token, setToken]         = useState('')
  const [catalog, setCatalog]     = useState(currentConfig?.catalog ?? 'hive_metastore')
  const [schema, setSchema]       = useState(currentConfig?.schema ?? '')
  const [showToken, setShowToken] = useState(false)
  const [saving, setSaving]       = useState(false)
  const [error, setError]         = useState(null)
  const [testing, setTesting]     = useState(false)
  const [testResult, setTestResult] = useState(null)
  const [step, setStep]           = useState('form') // 'guide' | 'form'

  const tokenAge = currentConfig?.token_created_at
    ? Math.floor((Date.now() - new Date(currentConfig.token_created_at).getTime()) / 86400000)
    : null
  const tokenExpiring = tokenAge !== null && tokenAge >= 75

  async function handleSave() {
    if (!host.trim()) { setError('Preencha o Host do workspace.'); return }
    if (!httpPath.trim()) { setError('Preencha o HTTP Path do SQL Warehouse.'); return }
    if (!token.trim() && !hasExistingToken) { setError('Preencha o Personal Access Token.'); return }
    setSaving(true); setError(null)
    try {
      const update = {
        host: host.trim().replace(/\/$/, ''),
        http_path: httpPath.trim(),
        catalog: catalog.trim() || 'hive_metastore',
        schema: schema.trim(),
      }
      if (token.trim()) {
        update.token = token.trim()
        update.token_created_at = new Date().toISOString()
      }
      const result = await api.saveConfig({ databricks: update })
      if (result?.ok) { onSaved() } else { setError('Erro ao salvar configuração.') }
    } catch (e) {
      setError('Erro ao salvar: ' + e.message)
    } finally {
      setSaving(false)
    }
  }

  async function handleTest() {
    if (!host.trim() || !httpPath.trim()) { setError('Preencha Host e HTTP Path antes de testar.'); return }
    if (!token.trim() && !hasExistingToken) { setError('Preencha o token antes de testar.'); return }
    setTesting(true); setTestResult(null); setError(null)
    const update = { host: host.trim(), http_path: httpPath.trim(), catalog: catalog.trim() || 'hive_metastore', schema: schema.trim() }
    if (token.trim()) update.token = token.trim()
    await api.saveConfig({ databricks: update })
    const result = await api.databricksStatus()
    setTesting(false)
    if (!result?.mock) {
      setTestResult({ ok: true, detail: `Conectado — ${result.warehouseId ?? 'warehouse'} · ${result.tables ?? 0} tabela(s)` })
    } else {
      setTestResult({ ok: false, detail: result.error ?? 'Falha na conexão. Verifique as credenciais.' })
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
              Configurar Databricks
            </h2>
            <p style={{ fontSize: 12, color: '#8A9BAA', marginTop: 4 }}>
              Personal Access Token + SQL Warehouse para queries em tempo real
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
            <span>Token configurado há <strong>{tokenAge} dias</strong> — expira em ~{90 - tokenAge} dias.</span>
            <span style={{ fontSize: 11, fontWeight: 700, whiteSpace: 'nowrap' }}>Atualize abaixo</span>
          </div>
        )}

        {/* Mini-manual */}
        {step === 'guide' && (
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 12, color: '#8A9BAA', marginBottom: 14 }}>
              Siga os passos para obter as credenciais do Databricks.
            </div>
            {[
              {
                num: '1',
                title: 'Gere um Personal Access Token',
                desc: 'No Databricks, clique no seu avatar (canto superior direito) → Settings → Developer → Access Tokens → Generate new token. Coloque como "Comment": farol-tracking. Lifetime: 90 dias (máximo). Copie o token gerado (começa com dapi).',
                link: null,
              },
              {
                num: '2',
                title: 'Encontre o Host do workspace',
                desc: 'É a URL do seu workspace sem o caminho. Exemplo: https://dbc-8acefaf9-a170.cloud.databricks.com. Copie direto da barra de endereço do navegador.',
                link: null,
              },
              {
                num: '3',
                title: 'Obtenha o HTTP Path do SQL Warehouse',
                desc: 'Vá em SQL → SQL Warehouses → clique no seu warehouse → aba "Connection details". Copie o valor de "HTTP Path" (formato: /sql/1.0/warehouses/XXXXX).',
                link: null,
              },
              {
                num: '4',
                title: 'Configure catalog e schema (opcional)',
                desc: 'Defina o catalog (padrão: hive_metastore) e o schema/database onde estão suas tabelas de tracking. Isso filtra a lista de tabelas exibidas no Farol.',
                link: null,
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
            {/* Host */}
            <div style={{ marginBottom: 14 }}>
              <label style={LABEL_STYLE}>Host do workspace</label>
              <input
                value={host}
                onChange={e => setHost(e.target.value)}
                placeholder="https://dbc-XXXXXXXX.cloud.databricks.com"
                style={INPUT_STYLE}
              />
            </div>

            {/* HTTP Path */}
            <div style={{ marginBottom: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                <label style={{ ...LABEL_STYLE, marginBottom: 0 }}>HTTP Path (SQL Warehouse)</label>
                <span style={{ fontSize: 10, color: '#8A9BAA' }}>SQL → Warehouses → Connection details</span>
              </div>
              <input
                value={httpPath}
                onChange={e => setHttpPath(e.target.value)}
                placeholder="/sql/1.0/warehouses/XXXXXXXXXXXXXXXX"
                style={INPUT_STYLE}
              />
            </div>

            {/* Token */}
            <div style={{ marginBottom: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                <label style={{ ...LABEL_STYLE, marginBottom: 0 }}>Personal Access Token</label>
                <button
                  onClick={() => setStep('guide')}
                  style={{ fontSize: 11, color: '#B9915B', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline', fontFamily: 'Manrope, sans-serif' }}
                >
                  Como gerar?
                </button>
              </div>
              <div style={{ position: 'relative' }}>
                <input
                  type={showToken ? 'text' : 'password'}
                  value={token}
                  onChange={e => setToken(e.target.value)}
                  placeholder={hasExistingToken ? '••••••••  (token já configurado — deixe em branco para manter)' : 'dapi...'}
                  style={{ ...INPUT_STYLE, paddingRight: 40 }}
                />
                <button
                  onClick={() => setShowToken(v => !v)}
                  style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#8A9BAA' }}
                >
                  {showToken ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
              <p style={{ fontSize: 11, color: '#8A9BAA', marginTop: 5 }}>
                Validade máxima: 90 dias. Salve o token imediatamente — ele não pode ser visualizado depois.
              </p>
            </div>

            {/* Catalog + Schema */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 20 }}>
              <div>
                <label style={LABEL_STYLE}>Catalog</label>
                <input
                  value={catalog}
                  onChange={e => setCatalog(e.target.value)}
                  placeholder="hive_metastore"
                  style={INPUT_STYLE}
                />
              </div>
              <div>
                <label style={LABEL_STYLE}>Schema / Database</label>
                <input
                  value={schema}
                  onChange={e => setSchema(e.target.value)}
                  placeholder="tracking_events"
                  style={INPUT_STYLE}
                />
              </div>
            </div>

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
                  background: 'transparent', color: '#B9915B',
                  fontSize: 13, fontWeight: 600,
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

// ── Helpers ──────────────────────────────────────────────────────────────────
const LABEL_STYLE = {
  fontSize: 11, color: '#8A9BAA', fontWeight: 600,
  letterSpacing: '0.06em', textTransform: 'uppercase',
  display: 'block', marginBottom: 6,
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
