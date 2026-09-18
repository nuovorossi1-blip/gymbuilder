const ALLOWED_MODELS = new Set(['deepseek-v4-flash', 'deepseek-v4-pro'])

export const config = { maxDuration: 120 }

export default async function handler(request, response) {
  response.setHeader('Cache-Control', 'no-store')
  if (request.method !== 'POST') return response.status(405).json({ error: 'Metodo non consentito.' })

  // La chiave viaggia dal browser a ogni richiesta (campo `apiKey`). Meglio tenerla
  // sul server: se DEEPSEEK_API_KEY e' fra le variabili d'ambiente Vercel, si usa
  // quella e il campo del body viene ignorato. Il fallback sul body resta finche'
  // la variabile non e' configurata, altrimenti l'app smetterebbe di funzionare.
  // Passo successivo, quando la variabile c'e': togliere del tutto `apiKey` dal
  // body in src/lib/deepseek.ts e lasciare nel Profilo solo la scelta del modello.
  const { apiKey, payload } = request.body || {}
  const serverKey = (process.env.DEEPSEEK_API_KEY || '').trim()
  const key = serverKey || (typeof apiKey === 'string' ? apiKey.trim() : '')
  if (!key) return response.status(400).json({ error: 'Chiave API DeepSeek mancante.' })
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
