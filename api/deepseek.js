const ALLOWED_MODELS = new Set(['deepseek-v4-flash', 'deepseek-v4-pro'])

export const config = { maxDuration: 120 }

/**
 * Proxy verso DeepSeek. Dal 23/09 la chiave sta SOLO qui, nella variabile d'ambiente Vercel
 * DEEPSEEK_API_KEY: il browser non la conosce e non la invia piu'. Proprio per questo l'endpoint
 * accetta solo utenti autenticati dell'app (token di sessione Supabase verificato sotto),
 * altrimenti chiunque trovasse l'URL potrebbe consumare il credito DeepSeek.
 */
async function utenteAutenticato(request) {
  const header = request.headers.authorization || ''
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : ''
  const url = (process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '').trim()
  const anon = (process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || '').trim()
  if (!token || !url || !anon) return false
  try {
    const res = await fetch(`${url}/auth/v1/user`, {
      headers: { Authorization: `Bearer ${token}`, apikey: anon },
      signal: AbortSignal.timeout(10_000),
    })
    return res.ok
  } catch {
    return false
  }
}

export default async function handler(request, response) {
  response.setHeader('Cache-Control', 'no-store')
  if (request.method !== 'POST') return response.status(405).json({ error: 'Metodo non consentito.' })

  const key = (process.env.DEEPSEEK_API_KEY || '').trim()
  if (!key) return response.status(500).json({ error: 'Chiave DeepSeek non configurata sul server.' })
  if (!(await utenteAutenticato(request))) return response.status(401).json({ error: 'Sessione scaduta: accedi di nuovo per usare DeepSeek.' })

  const { payload } = request.body || {}
  if (!payload || !ALLOWED_MODELS.has(payload.model) || !Array.isArray(payload.messages)) {
    return response.status(400).json({ error: 'Richiesta DeepSeek non valida.' })
  }

  try {
    const upstream = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(110_000),
    })
    const body = await upstream.text()
    response.status(upstream.status)
    response.setHeader('Content-Type', upstream.headers.get('content-type') || 'application/json; charset=utf-8')
    return response.send(body)
  } catch (error) {
    const timeout = error instanceof Error && (error.name === 'TimeoutError' || error.name === 'AbortError')
    return response.status(timeout ? 504 : 502).json({
      error: timeout ? 'DeepSeek non ha risposto entro il tempo massimo.' : 'Connessione a DeepSeek non riuscita.',
    })
  }
}
