const fs = require('fs')
const p = 'C:/Users/terc.caio.abra_g4edu/Documents/Projects/Farol_tracking/src/pages/Settings.jsx'
let content = fs.readFileSync(p, 'utf8')

// 1. Adicionar states para tabelas configuráveis após dbSaved state
content = content.replace(
  '  const [dbSaved, setDbSaved] = useState(false)\n',
  `  const [dbSaved, setDbSaved] = useState(false)

  // Databricks — tabelas configuráveis
  const [dbTableFunilComercial, setDbTableFunilComercial] = useState('')
  const [dbTableFunilMarketing, setDbTableFunilMarketing] = useState('')
  const [dbTableCustomerSales, setDbTableCustomerSales] = useState('')
  const [savingDbTables, setSavingDbTables] = useState(false)
  const [dbTablesSaved, setDbTablesSaved] = useState(false)\n`
)

// 2. Carregar valores do config no useEffect
content = content.replace(
  '      if (cfg?.databricks?.schema) setDbSchema(cfg.databricks.schema)\n',
  `      if (cfg?.databricks?.schema) setDbSchema(cfg.databricks.schema)
      if (cfg?.databricks?.tables?.funil_comercial) setDbTableFunilComercial(cfg.databricks.tables.funil_comercial)
      if (cfg?.databricks?.tables?.funil_marketing) setDbTableFunilMarketing(cfg.databricks.tables.funil_marketing)
      if (cfg?.databricks?.tables?.customer_sales) setDbTableCustomerSales(cfg.databricks.tables.customer_sales)\n`
)

// 3. Adicionar handler de save antes de handleSaveDatabricks
content = content.replace(
  '  async function handleSaveDatabricks() {\n',
  `  async function handleSaveDbTables() {
    setSavingDbTables(true)
    setDbTablesSaved(false)
    const tables = {}
    if (dbTableFunilComercial.trim()) tables.funil_comercial = dbTableFunilComercial.trim()
    if (dbTableFunilMarketing.trim()) tables.funil_marketing = dbTableFunilMarketing.trim()
    if (dbTableCustomerSales.trim())  tables.customer_sales  = dbTableCustomerSales.trim()
    await api.saveConfig({ databricks: { tables } })
    setSavingDbTables(false)
    setDbTablesSaved(true)
    setTimeout(() => setDbTablesSaved(false), 3000)
  }

  async function handleSaveDatabricks() {\n`
)

// 4. Inserir card antes de Preferências
const preferenciasMarker = `        {/* Preferências */}`
const dbTablesCard = `        {/* Databricks — tabelas configuráveis */}
        <Card style={{ marginBottom: 20 }}>
          <CardHeader title="Databricks — Tabelas" />
          <CardBody>
            <div style={{ fontSize: 12, color: '#8A9BAA', marginBottom: 14 }}>
              Nomes completos das tabelas usadas nas análises. Deixe em branco para usar os padrões baseados em Catalog.Schema configurados acima.
            </div>
            {[
              { label: 'Funil Comercial', placeholder: 'production.diamond.funil_comercial', value: dbTableFunilComercial, set: setDbTableFunilComercial },
              { label: 'Funil Marketing', placeholder: 'production.diamond.funil_marketing', value: dbTableFunilMarketing, set: setDbTableFunilMarketing },
              { label: 'Customer Sales', placeholder: 'production.diamond.customer_360_sales_table', value: dbTableCustomerSales, set: setDbTableCustomerSales },
            ].map(({ label, placeholder, value, set }) => (
              <div key={label} style={{ marginBottom: 10 }}>
                <label style={{ display: 'block', fontSize: 11, color: '#8A9BAA', marginBottom: 4 }}>{label}</label>
                <input
                  type="text"
                  placeholder={placeholder}
                  value={value}
                  onChange={e => set(e.target.value)}
                  style={{
                    width: '100%', padding: '8px 12px',
                    background: '#031A26', border: '1px solid rgba(185,145,91,0.35)',
                    borderRadius: 6, color: '#F5F4F3', fontSize: 12,
                    outline: 'none', fontFamily: 'monospace', boxSizing: 'border-box',
                  }}
                />
              </div>
            ))}
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 4 }}>
              <button
                onClick={handleSaveDbTables}
                disabled={savingDbTables}
                style={{
                  padding: '8px 18px',
                  background: dbTablesSaved ? 'rgba(34,197,94,0.15)' : 'rgba(185,145,91,0.12)',
                  border: \`1px solid \${dbTablesSaved ? 'rgba(34,197,94,0.4)' : 'rgba(185,145,91,0.35)'}\`,
                  borderRadius: 6,
                  color: dbTablesSaved ? '#22C55E' : '#B9915B',
                  cursor: savingDbTables ? 'not-allowed' : 'pointer',
                  fontSize: 12, fontWeight: 600,
                  display: 'flex', alignItems: 'center', gap: 5,
                  fontFamily: 'Manrope, sans-serif', transition: 'all 0.2s',
                }}
              >
                {savingDbTables
                  ? <><Loader size={12} style={{ animation: 'spin 1s linear infinite' }} /> Salvando</>
                  : dbTablesSaved
                    ? <><CheckCircle size={12} /> Salvo</>
                    : <><Save size={12} /> Salvar Tabelas</>
                }
              </button>
            </div>
          </CardBody>
        </Card>

        {/* Preferências */}`

content = content.replace(preferenciasMarker, dbTablesCard)

fs.writeFileSync(p, content, 'utf8')
console.log('Settings.jsx updated with Databricks tables card.')
console.log('File size:', fs.statSync(p).size, 'bytes')
