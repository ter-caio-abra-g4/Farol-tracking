/**
 * R9 — Badge universal ⚠️ Dados simulados via prop isMock no Header
 *
 * Para cada página que tem isMock definido, injeta isMock={isMock} no <Header>.
 * Também remove badges mock manuais duplicados onde existirem.
 */

const fs = require('fs')
const path = require('path')

const PAGES_DIR = 'C:/Users/terc.caio.abra_g4edu/Documents/Projects/Farol_tracking/src/pages'

// Mapeamento: arquivo → isMock expression (como aparece no componente principal)
const PAGE_MOCK_MAP = {
  'GTM.jsx':        { headerLine: "title=\"GTM\"",           mockExpr: 'isMock' },
  'GA4.jsx':        { headerLine: "title=\"GA4\"",           mockExpr: 'isMock' },
  'Meta.jsx':       { headerLine: "title=\"Meta Ads\"",      mockExpr: 'isMock' },
  'Funil.jsx':      { headerLine: "title=\"Funil Comercial\"", mockExpr: 'isMock' },
  'Paid.jsx':       { headerLine: "title=\"Paid Media\"",    mockExpr: 'isMock' },
  'SEO.jsx':        { headerLine: "title=\"Orgânico como Negócio\"", mockExpr: 'isMock' },
  'Analytics.jsx':  { headerLine: "title=\"Analytics\"",    mockExpr: 'isMock' },
  'Comparacao.jsx': { headerLine: "title=\"Comparação de Fontes\"", mockExpr: 'isMock' },
  'Databricks.jsx': { headerLine: "title=\"Databricks\"",   mockExpr: 'isMock' },
  'Explorer.jsx':   { headerLine: "title=\"Explorador\"",   mockExpr: 'isMock' },
}

// Verifica quais pages têm isMock no escopo do return principal
function hasMockInScope(content, filename) {
  // Verifica se há 'const isMock' ou '[isMock,' no corpo da função principal
  return content.includes('const isMock') || content.includes('[isMock, setIsMock]')
}

let updated = 0
let skipped = 0

for (const [filename, { headerLine, mockExpr }] of Object.entries(PAGE_MOCK_MAP)) {
  const p = path.join(PAGES_DIR, filename)
  if (!fs.existsSync(p)) { console.log(`SKIP (not found): ${filename}`); skipped++; continue }

  let content = fs.readFileSync(p, 'utf8')

  // Verifica se isMock está disponível
  if (!hasMockInScope(content, filename)) {
    console.log(`SKIP (no isMock): ${filename}`)
    skipped++
    continue
  }

  // Verifica se já tem isMock= no Header
  if (content.includes('isMock={') && content.includes(headerLine)) {
    console.log(`SKIP (already has isMock): ${filename}`)
    skipped++
    continue
  }

  // Injeta isMock prop na linha seguinte ao título no Header
  const before = `        ${headerLine}`
  const after  = `        ${headerLine}\n        isMock={${mockExpr}}`

  if (!content.includes(before)) {
    // Tenta sem indentação de 8 espaços
    const before2 = `      ${headerLine}`
    const after2  = `      ${headerLine}\n      isMock={${mockExpr}}`
    if (content.includes(before2)) {
      content = content.replace(before2, after2)
      console.log(`UPDATED (6-space): ${filename}`)
    } else {
      console.log(`SKIP (header line not found): ${filename} — looking for: "${headerLine}"`)
      skipped++
      continue
    }
  } else {
    content = content.replace(before, after)
    console.log(`UPDATED: ${filename}`)
  }

  fs.writeFileSync(p, content, 'utf8')
  updated++
}

console.log(`\nDone. Updated: ${updated}, Skipped: ${skipped}`)
