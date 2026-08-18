const KEY = 'gymbuilder:js-error-log:v1'
const MAX_ENTRIES = 30

export interface JsErrorEntry {
  at: string
  source: 'window.onerror' | 'unhandledrejection' | 'react'
  message: string
  stack?: string
}

function read(): JsErrorEntry[] {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? (JSON.parse(raw) as JsErrorEntry[]) : []
  } catch {
    return []
  }
}

function append(entry: JsErrorEntry): void {
  try {
    const next = [entry, ...read()].slice(0, MAX_ENTRIES)
    localStorage.setItem(KEY, JSON.stringify(next))
  } catch {
    /* storage pieno o non disponibile: l'errore resta comunque in console */
  }
}

export function logJsError(source: JsErrorEntry['source'], message: string, stack?: string): void {
  append({ at: new Date().toISOString(), source, message, stack })
}

export function readJsErrorLog(): JsErrorEntry[] {
  return read()
}

export function clearJsErrorLog(): void {
  try { localStorage.removeItem(KEY) } catch { /* opzionale */ }
}

export function formatJsErrorLog(entries: JsErrorEntry[]): string {
  return entries
    .map((e) => `=== ${e.at} · ${e.source} ===\n${e.message}${e.stack ? `\n${e.stack}` : ''}`)
    .join('\n\n')
}

let installed = false

/**
 * Cattura ogni errore JS non gestito (eccezioni fuori da React e promise rifiutate senza
 * .catch) cosi' un bug in produzione lascia una traccia leggibile in Profilo invece di una
 * schermata bianca senza alcuna informazione utile all'utente o a chi deve correggerlo.
 * Gli errori sollevati durante il render di un componente React li cattura ErrorBoundary,
 * non window.onerror: da qui i due punti di ingresso separati (qui + ErrorBoundary.tsx).
 */
export function installGlobalErrorLogging(): void {
  if (installed || typeof window === 'undefined') return
  installed = true
  window.addEventListener('error', (event) => {
    logJsError('window.onerror', event.message || String(event.error), event.error instanceof Error ? event.error.stack : undefined)
  })
  window.addEventListener('unhandledrejection', (event) => {
    const reason = event.reason
    const message = reason instanceof Error ? reason.message : typeof reason === 'string' ? reason : JSON.stringify(reason)
    logJsError('unhandledrejection', message, reason instanceof Error ? reason.stack : undefined)
  })
}
