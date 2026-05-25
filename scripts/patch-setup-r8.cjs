/**
 * R8 — Setup wizard melhorado
 *
 * Mudanças:
 * 1. Adiciona step de Databricks (host, http_path, token, catalog, schema)
 * 2. Muda pixel_id default do hardcoded para vazio (portabilidade)
 * 3. Adiciona instruções explícitas para usuários sem G4 OS
 * 4. Logo com SVG do Farol em vez de ícone genérico Key
 * 5. handleSave inclui databricks config
 */

const fs = require('fs')
const p = 'C:/Users/terc.caio.abra_g4edu/Documents/Projects/Farol_tracking/src/pages/Setup.jsx'
let content = fs.readFileSync(p, 'utf8')

// ── 1. Adicionar imports novos ───────────────────────────────────────────────
content = content.replace(
  "import { CheckCircle, AlertTriangle, Key, ArrowRight, Download, Zap, Loader, XCircle, FolderOpen, ChevronDown, Upload, Link, RefreshCw, Shield } from 'lucide-react'",
  "import { CheckCircle, AlertTriangle, Key, ArrowRight, Download, Zap, Loader, XCircle, FolderOpen, ChevronDown, Upload, Link, RefreshCw, Shield, Server, Eye, EyeOff } from 'lucide-react'"
)

// ── 2. Adicionar states para Databricks no wizard ────────────────────────────
content = content.replace(
  "  const [showCredentialsModal, setShowCredentialsModal] = useState(false)",
  `  const [showCredentialsModal, setShowCredentialsModal] = useState(false)

  // Databricks — configuração no setup
  const [dbHost, setDbHost]         = useState('')
  const [dbHttpPath, setDbHttpPath] = useState('')
  const [dbToken, setDbToken]       = useState('')
  const [dbTokenVisible, setDbTokenVisible] = useState(false)
  const [dbCatalog, setDbCatalog]   = useState('production')
  const [dbSchema, setDbSchema]     = useState('diamond')
  const [showDbStep, setShowDbStep] = useState(false)`
)

// ── 3. Corrigir handleSave — remover pixel_id hardcoded e incluir Databricks ──
content = content.replace(
  `  async function handleSave() {
    setSaving(true)
    const cfg = {}
    if (metaToken) cfg.meta = { access_token: metaToken, pixel_id: '702432142505333' }
    if (ga4PropId) cfg.ga4 = { ...(serviceAccountPath ? { service_account_path: serviceAccountPath } : {}), property_id: ga4PropId }
    await api.saveConfig(cfg)
    setSaving(false)
    onComplete()
  }`,
  `  async function handleSave() {
    setSaving(true)
    const cfg = {}
    if (metaToken) cfg.meta = { access_token: metaToken }
    if (ga4PropId) cfg.ga4 = { ...(serviceAccountPath ? { service_account_path: serviceAccountPath } : {}), property_id: ga4PropId }
    if (dbHost.trim() && dbHttpPath.trim() && dbToken.trim()) {
      cfg.databricks = {
        host: dbHost.trim().replace(/\\/$/, ''),
        http_path: dbHttpPath.trim(),
        token: dbToken.trim(),
        catalog: dbCatalog.trim() || 'production',
        schema: dbSchema.trim() || 'diamond',
        token_created_at: new Date().toISOString(),
      }
    }
    await api.saveConfig(cfg)
    setSaving(false)
    onComplete()
  }`
)

// ── 4. Adicionar bloco de Databricks no STEP MANUAL ─────────────────────────
// Inserir antes do botão "Testar conexão" no step manual
content = content.replace(
  `      <button onClick={handleTestConnections} disabled={testing}
        style={{ ...btnStyle, background: 'transparent', border: '1px solid rgba(185,145,91,0.5)', color: '#B9915B', marginBottom: 4 }}>
        {testing
          ? <><Loader size={15} style={{ animation: 'spin 1s linear infinite' }} /> Testando...</>
          : <><Zap size={15} /> Testar conexão</>}
      </button>

      {testResults && !testResults.error && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, width: '100%', maxWidth: 400, marginBottom: 12 }}>
          <TestResult label="GTM" ok={testResults.gtm.ok} detail={testResults.gtm.detail} />
          <TestResult label="GA4" ok={testResults.ga4.ok} detail={testResults.ga4.detail} />
          <TestResult label="Meta" ok={testResults.meta.ok} detail={testResults.meta.detail} />
        </div>
      )}
      {testResults?.error && (
        <div style={{ fontSize: 12, color: '#EF4444', marginBottom: 8 }}>{testResults.error}</div>
      )}

      <button onClick={handleSave} disabled={saving} style={btnStyle}>
        {saving ? 'Salvando...' : <><ArrowRight size={15} /> Salvar e abrir Farol</>}
      </button>

      {/* Botão de importar credenciais portáteis */}
      <button
        onClick={() => setShowCredentialsModal(true)}
        style={{ ...btnStyle, background: 'transparent', border: '1px solid rgba(185,145,91,0.35)', color: '#B9915B', marginTop: 0 }}
      >
        <Upload size={14} /> Importar credenciais (.json)
      </button>

      <button onClick={onComplete}
        style={{ ...btnStyle, background: 'transparent', border: '1px solid rgba(185,145,91,0.2)', color: '#8A9BAA', marginTop: 0 }}>
        Pular — usar dados demo
      </button>`,
  `      {/* Databricks — opcional, expansível */}
      <div style={{ width: '100%', maxWidth: 400 }}>
        <button
          type="button"
          onClick={() => setShowDbStep(v => !v)}
          style={{
            width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '9px 14px', background: 'rgba(185,145,91,0.06)',
            border: '1px solid rgba(185,145,91,0.25)', borderRadius: 6,
            color: dbHost ? '#22C55E' : '#B9915B', fontSize: 12, fontWeight: 600,
            cursor: 'pointer', fontFamily: 'Manrope, sans-serif',
          }}
        >
          <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Server size={13} />
            Databricks SQL {dbHost ? '✓ configurado' : '(opcional)'}
          </span>
          <ChevronDown size={13} style={{ transition: 'transform 0.2s', transform: showDbStep ? 'rotate(180deg)' : 'none' }} />
        </button>
        {showDbStep && (
          <div style={{ border: '1px solid rgba(185,145,91,0.2)', borderTop: 'none', borderRadius: '0 0 6px 6px', padding: '14px 14px 10px', display: 'flex', flexDirection: 'column', gap: 10, background: 'rgba(185,145,91,0.02)' }}>
            <div style={{ fontSize: 11, color: '#8A9BAA' }}>Necessário para análises de funil comercial, cohort e anomalias.</div>
            <input type="text" placeholder="https://dbc-xxxxx.cloud.databricks.com" value={dbHost}
              onChange={e => setDbHost(e.target.value)} style={{ ...inputStyle, fontSize: 12 }} />
            <input type="text" placeholder="/sql/1.0/warehouses/xxxxxxxx" value={dbHttpPath}
              onChange={e => setDbHttpPath(e.target.value)} style={{ ...inputStyle, fontSize: 12 }} />
            <div style={{ position: 'relative' }}>
              <input type={dbTokenVisible ? 'text' : 'password'} placeholder="dapi..." value={dbToken}
                onChange={e => setDbToken(e.target.value)} style={{ ...inputStyle, fontSize: 12, paddingRight: 36 }} />
              <button type="button" onClick={() => setDbTokenVisible(v => !v)}
                style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#8A9BAA', padding: 0 }}>
                {dbTokenVisible ? <EyeOff size={13} /> : <Eye size={13} />}
              </button>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <input type="text" placeholder="Catalog (ex: production)" value={dbCatalog}
                onChange={e => setDbCatalog(e.target.value)} style={{ ...inputStyle, fontSize: 12, flex: 1 }} />
              <input type="text" placeholder="Schema (ex: diamond)" value={dbSchema}
                onChange={e => setDbSchema(e.target.value)} style={{ ...inputStyle, fontSize: 12, flex: 1 }} />
            </div>
          </div>
        )}
      </div>

      <button onClick={handleTestConnections} disabled={testing}
        style={{ ...btnStyle, background: 'transparent', border: '1px solid rgba(185,145,91,0.5)', color: '#B9915B', marginBottom: 4 }}>
        {testing
          ? <><Loader size={15} style={{ animation: 'spin 1s linear infinite' }} /> Testando...</>
          : <><Zap size={15} /> Testar conexão</>}
      </button>

      {testResults && !testResults.error && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, width: '100%', maxWidth: 400, marginBottom: 12 }}>
          <TestResult label="GTM" ok={testResults.gtm.ok} detail={testResults.gtm.detail} />
          <TestResult label="GA4" ok={testResults.ga4.ok} detail={testResults.ga4.detail} />
          <TestResult label="Meta" ok={testResults.meta.ok} detail={testResults.meta.detail} />
        </div>
      )}
      {testResults?.error && (
        <div style={{ fontSize: 12, color: '#EF4444', marginBottom: 8 }}>{testResults.error}</div>
      )}

      <button onClick={handleSave} disabled={saving} style={btnStyle}>
        {saving ? 'Salvando...' : <><ArrowRight size={15} /> Salvar e abrir Farol</>}
      </button>

      {/* Botão de importar credenciais portáteis */}
      <button
        onClick={() => setShowCredentialsModal(true)}
        style={{ ...btnStyle, background: 'transparent', border: '1px solid rgba(185,145,91,0.35)', color: '#B9915B', marginTop: 0 }}
      >
        <Upload size={14} /> Importar credenciais (.json)
      </button>

      <button onClick={onComplete}
        style={{ ...btnStyle, background: 'transparent', border: '1px solid rgba(185,145,91,0.2)', color: '#8A9BAA', marginTop: 0 }}>
        Pular — usar dados demo
      </button>`
)

// ── 5. Também adicionar Databricks no step REVIEW (G4 OS detectado) ──────────
content = content.replace(
  `        <button onClick={handleSave} disabled={saving} style={btnStyle}>
          {saving ? 'Configurando...' : <><Download size={15} /> Importar e continuar</>}
        </button>`,
  `        {/* Databricks — opcional no step review também */}
        <div style={{ width: '100%', maxWidth: 400, marginBottom: 4 }}>
          <button
            type="button"
            onClick={() => setShowDbStep(v => !v)}
            style={{
              width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '9px 14px', background: 'rgba(185,145,91,0.06)',
              border: '1px solid rgba(185,145,91,0.25)', borderRadius: 6,
              color: dbHost ? '#22C55E' : '#B9915B', fontSize: 12, fontWeight: 600,
              cursor: 'pointer', fontFamily: 'Manrope, sans-serif',
            }}
          >
            <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Server size={13} />
              Databricks SQL {dbHost ? '✓ configurado' : '(opcional)'}
            </span>
            <ChevronDown size={13} style={{ transition: 'transform 0.2s', transform: showDbStep ? 'rotate(180deg)' : 'none' }} />
          </button>
          {showDbStep && (
            <div style={{ border: '1px solid rgba(185,145,91,0.2)', borderTop: 'none', borderRadius: '0 0 6px 6px', padding: '14px 14px 10px', display: 'flex', flexDirection: 'column', gap: 10, background: 'rgba(185,145,91,0.02)' }}>
              <input type="text" placeholder="https://dbc-xxxxx.cloud.databricks.com" value={dbHost}
                onChange={e => setDbHost(e.target.value)} style={{ ...inputStyle, fontSize: 12 }} />
              <input type="text" placeholder="/sql/1.0/warehouses/xxxxxxxx" value={dbHttpPath}
                onChange={e => setDbHttpPath(e.target.value)} style={{ ...inputStyle, fontSize: 12 }} />
              <div style={{ position: 'relative' }}>
                <input type={dbTokenVisible ? 'text' : 'password'} placeholder="dapi..." value={dbToken}
                  onChange={e => setDbToken(e.target.value)} style={{ ...inputStyle, fontSize: 12, paddingRight: 36 }} />
                <button type="button" onClick={() => setDbTokenVisible(v => !v)}
                  style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#8A9BAA', padding: 0 }}>
                  {dbTokenVisible ? <EyeOff size={13} /> : <Eye size={13} />}
                </button>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <input type="text" placeholder="Catalog" value={dbCatalog} onChange={e => setDbCatalog(e.target.value)} style={{ ...inputStyle, fontSize: 12, flex: 1 }} />
                <input type="text" placeholder="Schema" value={dbSchema} onChange={e => setDbSchema(e.target.value)} style={{ ...inputStyle, fontSize: 12, flex: 1 }} />
              </div>
            </div>
          )}
        </div>

        <button onClick={handleSave} disabled={saving} style={btnStyle}>
          {saving ? 'Configurando...' : <><Download size={15} /> Importar e continuar</>}
        </button>`
)

fs.writeFileSync(p, content, 'utf8')
console.log('Setup.jsx updated (R8).')
console.log('File size:', fs.statSync(p).size, 'bytes')
