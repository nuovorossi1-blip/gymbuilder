const SUPABASE_URL = process.env.SUPABASE_URL || 'https://geqhxhgrameaugawmaej.supabase.co'
const SUPABASE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY || 'sb_publishable_dYZx352-EazyIIMAqS2IDA_ZFsqv3nU'

export default async function handler(request, response) {
  const authorization = request.headers.authorization
  if (!process.env.CRON_SECRET || authorization !== `Bearer ${process.env.CRON_SECRET}`) {
    return response.status(401).json({ ok: false })
  }

  try {
    const upstream = await fetch(`${SUPABASE_URL}/rest/v1/exercises?select=id&limit=1`, {
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` },
      signal: AbortSignal.timeout(10_000),
    })
    if (!upstream.ok) throw new Error(`Supabase ${upstream.status}`)
    return response.status(200).json({ ok: true, checked_at: new Date().toISOString() })
  } catch (error) {
    return response.status(502).json({ ok: false, error: error instanceof Error ? error.message : 'Keep-alive failed' })
  }
}
