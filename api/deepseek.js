const DEEPSEEK_MODELS = new Set(['deepseek-v4-flash', 'deepseek-v4-pro'])
const PROVIDER_URL = {
  deepseek: 'https://api.deepseek.com/chat/completions',
  openrouter: 'https://openrouter.ai/api/v1/chat/completions',
}

export const config = { maxDuration: 120 }

/**
 * Proxy LLM dell'app (nome del file storico: ora serve anche OpenRouter).
 * Fase 3 (25/09): ogni utente sceglie il suo LLM e la sua chiave (tabella user_llm_keys, letta
 * qui con il token dell'utente, quindi la RLS garantisce che ognuno legga solo la sua).
 * La chiave DeepSeek del server (DEEPSEEK_API_KEY) resta come riserva SOLO per l'utente
 * LLM_FALLBACK_USER_ID (Rossi): gli altri senza chiave ricevono un messaggio chiaro.
 * Accetta solo utenti autenticati: senza, l'endpoint sarebbe un proxy aperto.
 */
function supabaseEnv() {
  return {
    url: (process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '').trim(),
    anon: (process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || '').trim(),
  }
}

async function utenteAutenticato(token) {
  const { url, anon } = supabaseEnv()
  if (!token || !url || !anon) return null
  try {
    const res = await fetch(`${url}/auth/v1/user`, { headers: { Authorization: `Bearer ${token}`, apikey: anon }, signal: AbortSignal.timeout(10_000) })
    if (!res.ok) return null
    const user = await res.json()
    return user && user.id ? user : null
  } catch {
    return null
  }
}

async function chiaveUtente(token, userId) {
  const { url, anon } = supabaseEnv()
  try {
    const res = await fetch(`${url}/rest/v1/user_llm_keys?select=provider,model,api_key,deepseek_key,openrouter_key&user_id=eq.${encodeURIComponent(userId)}`, {
      headers: { Authorization: `Bearer ${token}`, apikey: anon },
      signal: AbortSignal.timeout(10_000),
    })
    if (!res.ok) return null
    const rows = await res.json()
    return Array.isArray(rows) && rows[0] ? rows[0] : null
  } catch {
    return null
  }
}

export default async function handler(request, response) {
  response.setHeader('Cache-Control', 'no-store')
  if (request.method !== 'POST') return response.status(405).json({ error: 'Metodo non consentito.' })

  const header = request.headers.authorization || ''
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : ''
  const user = await utenteAutenticato(token)
  if (!user) return response.status(401).json({ error: 'Sessione scaduta: accedi di nuovo per usare il Coach.' })

  const { payload } = request.body || {}
  if (!payload || !Array.isArray(payload.messages)) return response.status(400).json({ error: 'Richiesta non valida.' })

  let provider = 'deepseek'
  let key = ''
  let model = payload.model
  const propria = await chiaveUtente(token, user.id)
  // Una chiave per fornitore (25/09): si usa quella del fornitore scelto come attivo.
  const chiavePropria = propria && (propria.provider === 'openrouter' ? propria.openrouter_key : propria.deepseek_key) || propria?.api_key
  if (propria && PROVIDER_URL[propria.provider] && chiavePropria) {
    provider = propria.provider
    key = chiavePropria
    model = propria.model
  } else if (user.id === (process.env.LLM_FALLBACK_USER_ID || '').trim()) {
    key = (process.env.DEEPSEEK_API_KEY || '').trim()
    if (!DEEPSEEK_MODELS.has(model)) model = 'deepseek-v4-flash'
  }
  if (!key) return response.status(400).json({ error: 'Nessuna chiave LLM: inseriscila nel Profilo, alla voce "Il tuo LLM".' })

  const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` }
  if (provider === 'openrouter') {
    headers['HTTP-Referer'] = 'https://gymbuilder-lemon.vercel.app'
    headers['X-Title'] = 'GymBuilder'
  }
  try {
    const upstream = await fetch(PROVIDER_URL[provider], {
      method: 'POST',
      headers,
      body: JSON.stringify(provider === 'openrouter' ? { ...payload, model, thinking: undefined } : { ...payload, model }),
      signal: AbortSignal.timeout(110_000),
    })
    const body = await upstream.text()
    if (upstream.status === 401 || upstream.status === 403) {
      // Il motivo esatto del fornitore aiuta a capire (chiave disattivata, limite, moderazione...).
      let motivo = ''
      try { const j = JSON.parse(body); motivo = (j && j.error && (j.error.message || j.error)) || '' } catch { motivo = '' }
      const nome = provider === 'openrouter' ? 'OpenRouter' : 'DeepSeek'
      return response.status(400).json({
        error: upstream.status === 401
          ? `${nome} rifiuta la chiave (errore 401${motivo ? `: ${String(motivo).slice(0, 160)}` : ''}). Di solito è disattivata o sbagliata: creane una nuova sul sito di ${nome} e incollala nel Profilo.`
          : `${nome} ha bloccato la richiesta (errore 403${motivo ? `: ${String(motivo).slice(0, 160)}` : ''}).`,
      })
    }
    if (upstream.status === 404 && provider === 'openrouter') {
      let motivo = ''
      try { const j = JSON.parse(body); motivo = (j && j.error && j.error.message) || '' } catch { motivo = '' }
      return response.status(400).json({ error: `OpenRouter non trova il modello "${model}"${motivo ? ` (${String(motivo).slice(0, 160)})` : ''}. Per i modelli gratuiti controlla anche su openrouter.ai, Settings -> Privacy, di aver consentito i fornitori gratuiti.` })
    }
    if (upstream.status === 402) return response.status(400).json({ error: 'Credito del tuo LLM esaurito (o modello a pagamento senza credito): ricaricalo o scegli un modello gratuito nel Profilo.' })
    if (upstream.status === 429 && provider === 'openrouter') return response.status(429).json({ error: 'Limite dei modelli gratuiti di OpenRouter raggiunto: riprova tra un minuto o scegli un altro modello nel Profilo.' })
    response.status(upstream.status)
    response.setHeader('Content-Type', upstream.headers.get('content-type') || 'application/json; charset=utf-8')
    return response.send(body)
  } catch (error) {
    const timeout = error instanceof Error && (error.name === 'TimeoutError' || error.name === 'AbortError')
    return response.status(timeout ? 504 : 502).json({ error: timeout ? 'L’LLM non ha risposto entro il tempo massimo.' : 'Connessione all’LLM non riuscita.' })
  }
}
