export const config = { maxDuration: 30 }

/**
 * Ricerca web del Coach (03/11/2026, richiesta di Rossi: "che vada a farsi una ricerca web per
 * trovare alternative valide"). Il coach scrive "ricerca_web" nella risposta, il browser chiama
 * qui e rimanda i risultati al coach.
 *  - prima SearXNG (SEARXNG_URL, predefinito 127.0.0.1:8888): gira sul PC, quindi funziona finché
 *    GymBuilder è servito dal server locale;
 *  - poi Tavily, se c'è TAVILY_API_KEY (serve quando l'app torna su Vercel).
 * Solo utenti autenticati: senza, sarebbe un motore di ricerca aperto a chiunque.
 */
function supabaseEnv() {
  return {
    url: (process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '').trim(),
    anon: (process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || '').trim(),
  }
}

async function autenticato(token) {
  const { url, anon } = supabaseEnv()
  if (!token || !url || !anon) return false
  try {
    const res = await fetch(`${url}/auth/v1/user`, { headers: { Authorization: `Bearer ${token}`, apikey: anon }, signal: AbortSignal.timeout(10_000) })
    return res.ok
  } catch {
    return false
  }
}

const pulisci = (t, max) => String(t || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max)

async function searx(q) {
  const base = (process.env.SEARXNG_URL || 'http://127.0.0.1:8888').replace(/\/$/, '')
  const res = await fetch(`${base}/search?q=${encodeURIComponent(q)}&format=json`, { signal: AbortSignal.timeout(15_000) })
  if (!res.ok) throw new Error(`SearXNG ${res.status}`)
  const j = await res.json()
  return (j?.results || []).map((r) => ({ titolo: pulisci(r.title, 160), url: String(r.url || ''), testo: pulisci(r.content, 400) }))
}

async function tavily(q) {
  const key = (process.env.TAVILY_API_KEY || '').trim()
  if (!key) throw new Error('Tavily non configurato')
  const res = await fetch('https://api.tavily.com/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
    body: JSON.stringify({ query: q, max_results: 6, search_depth: 'basic' }),
    signal: AbortSignal.timeout(20_000),
  })
  if (!res.ok) throw new Error(`Tavily ${res.status}`)
  const j = await res.json()
  return (j?.results || []).map((r) => ({ titolo: pulisci(r.title, 160), url: String(r.url || ''), testo: pulisci(r.content, 400) }))
}

export default async function handler(request, response) {
  response.setHeader('Cache-Control', 'no-store')
  if (request.method !== 'POST') return response.status(405).json({ error: 'Metodo non consentito.' })
  const header = request.headers.authorization || ''
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : ''
  if (!(await autenticato(token))) return response.status(401).json({ error: 'Sessione scaduta.' })
  const q = pulisci(request.body?.q, 200)
  if (q.length < 3) return response.status(400).json({ error: 'Ricerca vuota.' })
  for (const [nome, cerca] of [['SearXNG', searx], ['Tavily', tavily]]) {
    try {
      const risultati = (await cerca(q)).filter((r) => r.url.startsWith('http') && (r.titolo || r.testo))
      // Niente doppioni dello stesso sito: più fonti diverse valgono più di 6 pagine dello stesso.
      const visti = new Set()
      const unici = risultati.filter((r) => { const h = new URL(r.url).hostname.replace(/^www\./, ''); if (visti.has(h)) return false; visti.add(h); return true })
      if (unici.length) return response.status(200).json({ motore: nome, risultati: unici.slice(0, 6) })
    } catch { /* si prova il motore successivo */ }
  }
  return response.status(503).json({ error: 'Ricerca web non disponibile in questo momento.' })
}
