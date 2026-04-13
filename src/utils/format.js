/**
 * src/utils/format.js
 * Helpers de formatação compartilhados por todas as páginas.
 * Nunca definir fmtNum / fmtMoney / fmtPct localmente nas pages — importar daqui.
 */

export function fmtNum(v) {
  if (v === null || v === undefined) return '—'
  if (Math.abs(v) >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`
  if (Math.abs(v) >= 1_000)     return `${(v / 1_000).toFixed(1)}k`
  return String(v)
}

export function fmtMoney(v) {
  if (!v && v !== 0) return '—'
  if (v >= 1_000_000) return `R$ ${(v / 1_000_000).toFixed(1)}M`
  if (v >= 1_000)     return `R$ ${(v / 1_000).toFixed(0)}K`
  return `R$ ${Number(v).toFixed(0)}`
}

export function fmtPct(v) {
  if (v === null || v === undefined) return '—'
  return `${Number(v).toFixed(1)}%`
}

export function fmtDays(v) {
  if (!v && v !== 0) return '—'
  return `${Number(v).toFixed(1)}d`
}
