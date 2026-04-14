/**
 * src/utils/export.js
 * Helper para exportar dados como CSV com download automático.
 * Uso: downloadCsv('relatorio.csv', [{ campo: valor, ... }])
 */

/**
 * Converte array de objetos em CSV e dispara download no browser.
 * @param {string} filename  - nome do arquivo (ex: 'funil-30d.csv')
 * @param {Array}  rows      - array de objetos com as mesmas chaves
 * @param {Array}  [columns] - opcional: [{key, label}] para controlar colunas/ordem/label
 */
export function downloadCsv(filename, rows, columns = null) {
  if (!rows?.length) return

  const cols = columns
    ? columns
    : Object.keys(rows[0]).map(k => ({ key: k, label: k }))

  const escape = v => {
    if (v === null || v === undefined) return ''
    const s = String(v)
    // Envolve em aspas se contiver vírgula, quebra de linha ou aspas
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }

  const header = cols.map(c => escape(c.label)).join(',')
  const body   = rows.map(row => cols.map(c => escape(row[c.key])).join(',')).join('\n')
  const csv    = `${header}\n${body}`

  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' }) // BOM para Excel PT-BR
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href     = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
