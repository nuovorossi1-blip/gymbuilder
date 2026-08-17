const TIMEOUT_MS = 10_000

export async function GET(request) {
  const cronSecret = process.env.CRON_SECRET
  const authorization = request.headers.get('authorization')

  if (!cronSecret || authorization !== `Bearer ${cronSecret}`) {
    return Response.json({ ok: false, error: 'unauthorized' }, { status: 401 })
  }

  const supabaseUrl = process.env.VITE_SUPABASE_URL
  const publishableKey = process.env.VITE_SUPABASE_ANON_KEY

  if (!supabaseUrl || !publishableKey) {
    return Response.json({ ok: false, error: 'missing_supabase_environment' }, { status: 500 })
  }

  try {
    const response = await fetch(
      `${supabaseUrl}/rest/v1/exercises?select=id&active=eq.true&limit=1`,
      {
        headers: {
          apikey: publishableKey,
          accept: 'application/json',
        },
        signal: AbortSignal.timeout(TIMEOUT_MS),
        cache: 'no-store',
      },
    )

    if (!response.ok) {
      const body = await response.text()
      console.error('[keep-alive] Supabase request failed', {
        status: response.status,
        body: body.slice(0, 300),
      })
      return Response.json(
        {
          ok: false,
          error: response.status === 540 ? 'supabase_project_paused' : 'supabase_request_failed',
          status: response.status,
        },
        { status: 502 },
      )
    }

    const rows = await response.json()
    console.log('[keep-alive] Supabase reachable', {
      checkedAt: new Date().toISOString(),
      rows: Array.isArray(rows) ? rows.length : 0,
    })

    return Response.json({ ok: true, checkedAt: new Date().toISOString() })
  } catch (error) {
    const timedOut = error instanceof Error && error.name === 'TimeoutError'
    console.error('[keep-alive] Supabase unavailable', {
      error: error instanceof Error ? error.message : String(error),
    })
    return Response.json(
      { ok: false, error: timedOut ? 'supabase_timeout' : 'supabase_unavailable' },
      { status: 504 },
    )
  }
}
