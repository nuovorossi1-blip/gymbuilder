export const config = { maxDuration: 20 }

/**
 * Elenco dei modelli GRATUITI di OpenRouter (25/09, richiesta di Rossi): letto dal vivo da
 * https://openrouter.ai/api/v1/models, così la lista resta aggiornata senza toccare il codice.
 * Solo modelli di testo (niente embedding, rerank, moderazione), prezzo 0 in ingresso e uscita.
 */
export default async function handler(request, response) {
  response.setHeader('Cache-Control', 'public, max-age=3600')
  try {
    const res = await fetch('https://openrouter.ai/api/v1/models', { signal: AbortSignal.timeout(15_000) })
    if (!res.ok) return response.status(502).json({ error: 'Elenco modelli non disponibile.' })
    const { data } = await res.json()
    const gratis = (Array.isArray(data) ? data : [])
      .filter((m) => m && typeof m.id === 'string' && m.id.endsWith(':free'))
      .filter((m) => Number(m.pricing?.prompt ?? 1) === 0 && Number(m.pricing?.completion ?? 1) === 0)
      .filter((m) => {
        const out = m.architecture?.output_modalities
        return !Array.isArray(out) || out.includes('text')
      })
      .filter((m) => !/embed|rerank|safety|guard/i.test(`${m.id} ${m.name}`))
      .map((m) => ({ id: m.id, name: m.name, context: m.context_length ?? null }))
      .sort((a, b) => (b.context ?? 0) - (a.context ?? 0))
    return response.status(200).json({ models: gratis })
  } catch {
    return response.status(502).json({ error: 'Elenco modelli non disponibile.' })
  }
}
