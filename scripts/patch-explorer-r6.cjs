const fs = require('fs')
const p = 'C:/Users/terc.caio.abra_g4edu/Documents/Projects/Farol_tracking/src/pages/Explorer.jsx'
let content = fs.readFileSync(p, 'utf8')

// 1. Adicionar import Database icon
content = content.replace(
  "import { Search, BarChart2, Tag, ChevronDown, ChevronRight, X } from 'lucide-react'",
  "import { Search, BarChart2, Tag, ChevronDown, ChevronRight, X, Database } from 'lucide-react'"
)

// 2. Adicionar estados para aba DB
const statesInsertAfter = "  const [tagsMock, setTagsMock]     = useState(true)"
content = content.replace(
  statesInsertAfter,
  `  const [tagsMock, setTagsMock]     = useState(true)

  // Dados Tabelas DB
  const [dbTables, setDbTables]         = useState([])
  const [dbTablesLoading, setDbTablesLoading] = useState(false)
  const [dbTablesMock, setDbTablesMock] = useState(true)
  const [dbSelected, setDbSelected]     = useState(null)
  const [dbPreview, setDbPreview]       = useState(null)
  const [dbPreviewLoading, setDbPreviewLoading] = useState(false)`
)

// 3. Adicionar carregamento de tabelas DB no useEffect (após loadGtmTags)
const effectInsertAfter = `  useEffect(() => {
    loadGtmTags()
  }, [selectedGTM, gtmContainers])`
content = content.replace(
  effectInsertAfter,
  `  useEffect(() => {
    loadGtmTags()
  }, [selectedGTM, gtmContainers])

  async function loadDbTables() {
    setDbTablesLoading(true)
    const r = await api.databricksTables()
    setDbTables(r?.tables ?? [])
    setDbTablesMock(r?.mock ?? true)
    setDbTablesLoading(false)
    setLastUpdated(Date.now())
  }

  async function loadDbPreview(tableName) {
    setDbSelected(tableName)
    setDbPreview(null)
    setDbPreviewLoading(true)
    const r = await api.databricksPreview(tableName)
    setDbPreview(r)
    setDbPreviewLoading(false)
  }

  // Carrega tabelas DB quando a aba é selecionada
  useEffect(() => {
    if (tab === 'db' && dbTables.length === 0) loadDbTables()
  }, [tab])`
)

// 4. Atualizar handleRefresh para incluir aba db
content = content.replace(
  `  function handleRefresh() {
    if (tab === 'events') {
      setEventsLoading(true)
      api.ga4Events(selectedGA4).then(r => {
        setEvents(r?.events ?? [])
        setEventsMock(r?.mock ?? true)
        setEventsLoading(false)
        setLastUpdated(Date.now())
      })
    } else {
      loadGtmTags()
    }
    setSelected(null)
  }`,
  `  function handleRefresh() {
    if (tab === 'events') {
      setEventsLoading(true)
      api.ga4Events(selectedGA4).then(r => {
        setEvents(r?.events ?? [])
        setEventsMock(r?.mock ?? true)
        setEventsLoading(false)
        setLastUpdated(Date.now())
      })
    } else if (tab === 'db') {
      loadDbTables()
      setDbSelected(null)
      setDbPreview(null)
    } else {
      loadGtmTags()
    }
    setSelected(null)
  }`
)

// 5. Atualizar loading e isMock para incluir aba db
content = content.replace(
  "  const loading = tab === 'events' ? eventsLoading : tagsLoading\n  const isMock  = tab === 'events' ? eventsMock    : tagsMock",
  "  const loading = tab === 'events' ? eventsLoading : tab === 'db' ? dbTablesLoading : tagsLoading\n  const isMock  = tab === 'events' ? eventsMock    : tab === 'db' ? dbTablesMock    : tagsMock"
)

// 6. Adicionar aba DB na lista de tabs
content = content.replace(
  `              { id: 'events', label: 'Eventos GA4', icon: BarChart2 },
              { id: 'tags',   label: 'Tags GTM',    icon: Tag },`,
  `              { id: 'events', label: 'Eventos GA4', icon: BarChart2 },
              { id: 'tags',   label: 'Tags GTM',    icon: Tag },
              { id: 'db',     label: 'Tabelas DB',  icon: Database },`
)

// 7. Adicionar contagem para aba db
content = content.replace(
  "                    {id === 'events' ? filteredEvents.length : filteredTags.length}",
  "                    {id === 'events' ? filteredEvents.length : id === 'db' ? dbTables.length : filteredTags.length}"
)

// 8. Ocultar busca/filtros na aba db (search/filter só fazem sentido para events/tags)
// Adicionar condição no container de busca
content = content.replace(
  `          {/* Barra de busca + filtros */}
          <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>`,
  `          {/* Barra de busca + filtros — oculto na aba Tabelas DB */}
          {tab !== 'db' && <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>`
)
// Fechar o div condicional antes do Badge mock
content = content.replace(
  `          {/* Badge mock */}
          {isMock && !loading && (`,
  `          {tab !== 'db' && null}
          {/* Badge mock */}
          {isMock && !loading && (`
)

// Forma mais simples: substituir a div de busca inteira por uma condicionada
// Desfaz a abordagem acima e faz correto:
content = content.replace(
  `          {/* Barra de busca + filtros — oculto na aba Tabelas DB */}
          {tab !== 'db' && <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>`,
  `          {/* Barra de busca + filtros */}
          <div style={{ display: tab === 'db' ? 'none' : 'flex', gap: 10, marginBottom: 16 }}>`
)
content = content.replace(
  `          {tab !== 'db' && null}\n          {/* Badge mock */}`,
  `          {/* Badge mock */}`
)

// 9. Adicionar renderização da aba db no conteúdo
content = content.replace(
  `          {/* Conteúdo */}
          {loading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: 48 }}><Spinner /></div>
          ) : tab === 'events' ? (
            <EventsTable
              events={filteredEvents}
              selected={selected}
              onSelect={setSelected}
            />
          ) : (
            <TagsTable
              tags={filteredTags}
              selected={selected}
              onSelect={setSelected}
            />
          )}`,
  `          {/* Conteúdo */}
          {loading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: 48 }}><Spinner /></div>
          ) : tab === 'events' ? (
            <EventsTable
              events={filteredEvents}
              selected={selected}
              onSelect={setSelected}
            />
          ) : tab === 'db' ? (
            <DbTablesPanel
              tables={dbTables}
              selected={dbSelected}
              preview={dbPreview}
              previewLoading={dbPreviewLoading}
              onSelect={loadDbPreview}
            />
          ) : (
            <TagsTable
              tags={filteredTags}
              selected={selected}
              onSelect={setSelected}
            />
          )}`
)

// 10. Ocultar painel de detalhe quando aba db estiver ativa (db tem seu próprio preview)
content = content.replace(
  "        {selected && (",
  "        {selected && tab !== 'db' && ("
)

// 11. Adicionar componente DbTablesPanel antes do export de EventsTable
const dbPanelComponent = `
// ── Painel de tabelas Databricks ──────────────────────────────────────────────
function DbTablesPanel({ tables, selected, preview, previewLoading, onSelect }) {
  return (
    <div style={{ display: 'flex', gap: 12, height: '100%', minHeight: 400 }}>
      {/* Lista */}
      <Card style={{ width: 260, flexShrink: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '10px 14px', borderBottom: '1px solid rgba(185,145,91,0.12)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 11, color: '#8A9BAA', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Tabelas</span>
          <span style={{ fontSize: 11, color: '#8A9BAA' }}>{tables.length}</span>
        </div>
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {tables.length === 0 ? (
            <div style={{ padding: 20, fontSize: 12, color: '#8A9BAA', textAlign: 'center' }}>
              Nenhuma tabela.<br />Configure o Databricks em Settings.
            </div>
          ) : tables.map((t, i) => (
            <button
              key={i}
              onClick={() => onSelect(t.fullName)}
              style={{
                width: '100%', textAlign: 'left', padding: '9px 14px',
                background: selected === t.fullName ? 'rgba(185,145,91,0.08)' : 'transparent',
                borderLeft: selected === t.fullName ? '2px solid #B9915B' : '2px solid transparent',
                border: 'none', borderBottom: '1px solid rgba(185,145,91,0.07)',
                cursor: 'pointer', fontFamily: 'Manrope, sans-serif',
              }}
            >
              <div style={{ fontSize: 12, fontWeight: 600, color: '#F5F4F3', fontFamily: 'monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {t.name}
              </div>
              <div style={{ fontSize: 10, color: '#8A9BAA', marginTop: 2 }}>{t.schema}</div>
            </button>
          ))}
        </div>
      </Card>

      {/* Preview */}
      <Card style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        {!selected ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 1, flexDirection: 'column', gap: 10, color: '#8A9BAA' }}>
            <Database size={28} strokeWidth={1} style={{ opacity: 0.4 }} />
            <span style={{ fontSize: 12 }}>Selecione uma tabela</span>
          </div>
        ) : previewLoading ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 1 }}><Spinner /></div>
        ) : preview ? (
          <>
            <div style={{ padding: '10px 16px', borderBottom: '1px solid rgba(185,145,91,0.12)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontFamily: 'monospace', fontSize: 12, color: '#B9915B' }}>{selected}</span>
              <span style={{ fontSize: 11, color: '#8A9BAA' }}>
                {preview.columns?.length ?? 0} colunas · {preview.rows?.length ?? 0} linhas (preview)
                {preview.mock && <span style={{ color: '#F59E0B', marginLeft: 8 }}>mock</span>}
              </span>
            </div>
            <div style={{ flex: 1, overflow: 'auto' }}>
              {preview.columns?.length > 0 && (
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid rgba(185,145,91,0.2)', position: 'sticky', top: 0, background: '#001A2E' }}>
                      {preview.columns.map((col, ci) => (
                        <th key={ci} style={{ padding: '8px 12px', textAlign: 'left', fontSize: 11, color: '#8A9BAA', fontWeight: 600, whiteSpace: 'nowrap' }}>
                          <div style={{ fontFamily: 'monospace', color: '#F5F4F3' }}>{col.name}</div>
                          <div style={{ fontSize: 9, color: '#8A9BAA55' }}>{col.type}</div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {(preview.rows ?? []).map((row, ri) => (
                      <tr key={ri} style={{ borderBottom: '1px solid rgba(185,145,91,0.06)' }}>
                        {preview.columns.map((col, ci) => (
                          <td key={ci} style={{ padding: '6px 12px', color: '#F5F4F3', fontFamily: 'monospace', fontSize: 11, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {row[col.name] == null ? <span style={{ color: '#8A9BAA55' }}>null</span> : String(row[col.name])}
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
  )
}

`

// Inserir antes de EventsTable
content = content.replace(
  '// ── Tabela de eventos ─────────────────────────────────────────────────────────',
  dbPanelComponent + '// ── Tabela de eventos ─────────────────────────────────────────────────────────'
)

fs.writeFileSync(p, content, 'utf8')
console.log('Explorer.jsx updated with DbTablesPanel (R6).')
console.log('File size:', fs.statSync(p).size, 'bytes')
