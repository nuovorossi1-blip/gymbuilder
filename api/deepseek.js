const ALLOWED_MODELS = new Set(['deepseek-v4-flash', 'deepseek-v4-pro'])

export const config = { maxDuration: 120 }

export default async function handler(request, response) {
  response.setHeader('Cache-Control', 'no-store')
  if (request.method !== 'POST') return response.status(405).json({ error: 'Metodo non consentito.' })

  const { apiKey, payload } = request.body || {}
  if (typeof apiKey !== 'string' || !apiKey.trim()) return response.status(400).json({ error: 'Chiave API DeepSeek mancante.' })
  if (!payload || !ALLOWED_MODELS.has(payload.model) || !Array.isArray(payload.messages)) {
    return response.status(400).json({ error: 'Richiesta DeepSeek non valida.' })
  }

  try {
    const upstream = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey.trim()}`,
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
