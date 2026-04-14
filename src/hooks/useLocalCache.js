/**
 * src/hooks/useLocalCache.js
 * Hook para cache de dados no localStorage com TTL configurable.
 *
 * Uso:
 *   const { data, loading, refresh, fromCache } = useLocalCache(
 *     'funil-30',          // chave única (inclua parâmetros relevantes como `days`)
 *     10,                  // TTL em minutos
 *     () => fetchMyData()  // fetcher assíncrono — chamado só se cache expirado/inexistente
 *   )
 *
 * - `fromCache`: true quando os dados vieram do cache (útil para mostrar badge)
 * - `refresh()`: força re-fetch ignorando o cache (ex: botão "Atualizar")
 * - O cache é isolado por chave — chaves diferentes nunca se sobrepõem.
 * - Dados cujo JSON.parse falha são tratados como expirados.
 */

import { useState, useEffect, useCallback, useRef } from 'react'

const PREFIX = 'farol_cache_'

function readCache(key) {
  try {
    const raw = localStorage.getItem(PREFIX + key)
    if (!raw) return null
    const { data, ts, ttl } = JSON.parse(raw)
    const ageMin = (Date.now() - ts) / 60_000
    if (ageMin > ttl) return null   // expirado
    return data
  } catch {
    return null
  }
}

function writeCache(key, data, ttl) {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify({ data, ts: Date.now(), ttl }))
  } catch {
    /* localStorage cheio — ignora silenciosamente */
  }
}

export function useLocalCache(key, ttlMin, fetcher) {
  const [data, setData]           = useState(null)
  const [loading, setLoading]     = useState(true)
  const [fromCache, setFromCache] = useState(false)
  const fetcherRef                = useRef(fetcher)
  fetcherRef.current              = fetcher   // sempre aponta para versão atual

  const load = useCallback(async (force = false) => {
    if (!force) {
      const cached = readCache(key)
      if (cached !== null) {
        setData(cached)
        setFromCache(true)
        setLoading(false)
        return
      }
    }
    setLoading(true)
    setFromCache(false)
    try {
      const result = await fetcherRef.current()
      writeCache(key, result, ttlMin)
      setData(result)
    } catch (err) {
      console.warn('[useLocalCache] fetch error:', err)
    } finally {
      setLoading(false)
    }
  }, [key, ttlMin])

  useEffect(() => { load(false) }, [load])

  const refresh = useCallback(() => {
    try { localStorage.removeItem(PREFIX + key) } catch { /* ok */ }
    load(true)
  }, [key, load])

  return { data, loading, fromCache, refresh }
}

/**
 * Limpa todos os caches do Farol do localStorage.
 * Útil para debug ou quando o usuário força refresh global.
 */
export function clearAllFarolCache() {
  try {
    Object.keys(localStorage)
      .filter(k => k.startsWith(PREFIX))
      .forEach(k => localStorage.removeItem(k))
  } catch { /* ok */ }
}
