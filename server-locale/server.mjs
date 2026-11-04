/**
 * Server locale (06/10/2026): GymBuilder sul PC di casa mentre il piano gratuito
 * di Vercel e' in pausa. Fa quello che fa Vercel con vercel.json:
 *  - /api/<nome> -> api/<nome>.js, con request/response stile Vercel
 *    (request.body gia' letto, response.status().json()/send());
 *  - il resto e' dist/, con /index.html di riserva (app a pagina singola);
 *  - il cron keep-alive (una volta al giorno) tiene sveglio Supabase.
 * Avvio: installa.ps1. Da internet: Tailscale Funnel :10000.
 */
import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const QUI = path.dirname(fileURLToPath(import.meta.url))
const RADICE = path.resolve(QUI, '..')
const DIST = path.join(RADICE, 'dist')
const API = path.join(RADICE, 'api')
const PORTA = Number(process.env.PORTA || 3001)

const TIPI = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.map': 'application/json',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif',
  '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.webp': 'image/webp',
  '.woff': 'font/woff', '.woff2': 'font/woff2', '.ttf': 'font/ttf',
  '.webmanifest': 'application/manifest+json', '.txt': 'text/plain; charset=utf-8',
}

function leggiCorpo(req) {
  return new Promise((ok, ko) => {
    const pezzi = []
    req.on('data', (p) => pezzi.push(p))
    req.on('end', () => ok(Buffer.concat(pezzi)))
    req.on('error', ko)
  })
}

function rispostaVercel(res) {
  res.status = (codice) => { res.statusCode = codice; return res }
  res.json = (dati) => {
    if (!res.getHeader('Content-Type')) res.setHeader('Content-Type', 'application/json; charset=utf-8')
    res.end(JSON.stringify(dati))
    return res
  }
  res.send = (dati) => {
    if (typeof dati === 'object' && !Buffer.isBuffer(dati)) return res.json(dati)
    res.end(dati)
    return res
  }
  return res
}

async function funzione(req, res, nome) {
  const file = path.join(API, `${nome}.js`)
  if (!/^[a-z0-9-]+$/.test(nome) || !fs.existsSync(file)) {
    res.writeHead(404, { 'Content-Type': 'application/json' })
    return res.end(JSON.stringify({ error: 'Funzione sconosciuta' }))
  }
  const grezzo = await leggiCorpo(req)
  let body = grezzo.length ? grezzo.toString('utf8') : undefined
  if (body && String(req.headers['content-type'] || '').includes('application/json')) {
    try { body = JSON.parse(body) } catch { /* resta testo */ }
  }
  req.body = body
  req.query = Object.fromEntries(new URL(req.url, 'http://x').searchParams)
  const { default: gestore } = await import(pathToFileURL(file).href)
  await gestore(req, rispostaVercel(res))
}

function statico(req, res, percorso) {
  let file = path.join(DIST, decodeURIComponent(percorso))
  if (!file.startsWith(DIST) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    file = path.join(DIST, 'index.html')
  }
  const tipo = TIPI[path.extname(file).toLowerCase()] || 'application/octet-stream'
  const cache = file.includes(`${path.sep}assets${path.sep}`) ? 'public, max-age=31536000, immutable' : 'no-cache'
  res.writeHead(200, { 'Content-Type': tipo, 'Cache-Control': cache })
  if (req.method === 'HEAD') return res.end()
  fs.createReadStream(file).pipe(res)
}

// APK servita da qui (04/11/2026): dal telefono il download via GitHub (redirect a
// release-assets.githubusercontent.com) restava fermo su "download in corso". Si tiene sul PC
// una copia dell'ultima release (controllo ogni 10 minuti) e la si manda con Content-Length e Range.
const APK_CACHE = path.join(QUI, 'apk-cache')
const APK_RELEASE = 'https://api.github.com/repos/nuovorossi1-blip/gymbuilder/releases/latest'
let apkControllo = 0
let apkInCorso = null

async function aggiornaApk() {
  fs.mkdirSync(APK_CACHE, { recursive: true })
  const r = await fetch(APK_RELEASE, { headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'gymbuilder-server-locale' }, signal: AbortSignal.timeout(15_000) })
  if (!r.ok) throw new Error(`GitHub release ${r.status}`)
  const rel = await r.json()
  const asset = (rel.assets || []).find((a) => a.name === 'GymBuilder.apk')
  if (!asset) throw new Error('APK assente nella release')
  const tag = String(rel.tag_name || 'sconosciuto').replace(/[^a-zA-Z0-9.-]/g, '')
  const file = path.join(APK_CACHE, `GymBuilder-${tag}.apk`)
  if (fs.existsSync(file) && fs.statSync(file).size === asset.size) return file
  const d = await fetch(asset.browser_download_url, { headers: { 'User-Agent': 'gymbuilder-server-locale' }, signal: AbortSignal.timeout(120_000) })
  if (!d.ok) throw new Error(`download APK ${d.status}`)
  const dati = Buffer.from(await d.arrayBuffer())
  if (dati.length !== asset.size) throw new Error('APK scaricata incompleta')
  fs.writeFileSync(file + '.tmp', dati)
  fs.renameSync(file + '.tmp', file)
  for (const vecchio of fs.readdirSync(APK_CACHE)) if (vecchio !== path.basename(file)) fs.rmSync(path.join(APK_CACHE, vecchio), { force: true })
  console.log(new Date().toISOString(), 'APK in cache', tag, dati.length)
  return file
}

function apkInCache() {
  if (!fs.existsSync(APK_CACHE)) return null
  const f = fs.readdirSync(APK_CACHE).find((n) => n.endsWith('.apk'))
  return f ? path.join(APK_CACHE, f) : null
}

async function apk(req, res) {
  let file = apkInCache()
  if (!file || Date.now() - apkControllo > 10 * 60 * 1000) {
    apkInCorso ??= aggiornaApk().finally(() => { apkInCorso = null })
    try { file = await apkInCorso; apkControllo = Date.now() } catch (e) {
      console.error(new Date().toISOString(), 'APK: aggiornamento fallito', e?.message)
      if (!file) { res.writeHead(302, { Location: 'https://github.com/nuovorossi1-blip/gymbuilder/releases/latest/download/GymBuilder.apk' }); return res.end() }
    }
  }
  const totale = fs.statSync(file).size
  const intestazioni = {
    'Content-Type': 'application/vnd.android.package-archive',
    'Content-Disposition': 'attachment; filename="GymBuilder.apk"',
    'Accept-Ranges': 'bytes', 'Cache-Control': 'no-cache',
  }
  const m = /^bytes=(d*)-(d*)$/.exec(String(req.headers.range || ''))
  if (m && (m[1] || m[2])) {
    let inizio = m[1] ? Number(m[1]) : totale - Number(m[2])
    let fine = m[1] && m[2] ? Number(m[2]) : totale - 1
    if (inizio < 0) inizio = 0
    if (fine >= totale) fine = totale - 1
    if (inizio > fine) { res.writeHead(416, { 'Content-Range': `bytes */${totale}` }); return res.end() }
    res.writeHead(206, { ...intestazioni, 'Content-Range': `bytes ${inizio}-${fine}/${totale}`, 'Content-Length': fine - inizio + 1 })
    if (req.method === 'HEAD') return res.end()
    return fs.createReadStream(file, { start: inizio, end: fine }).pipe(res)
  }
  res.writeHead(200, { ...intestazioni, 'Content-Length': totale })
  if (req.method === 'HEAD') return res.end()
  fs.createReadStream(file).pipe(res)
}

http.createServer(async (req, res) => {
  const percorso = new URL(req.url || '/', 'http://x').pathname
  try {
    if (percorso.toLowerCase() === '/gymbuilder.apk') await apk(req, res)
    else if (percorso.startsWith('/api/')) await funzione(req, res, percorso.slice(5).replace(/\/$/, ''))
    else statico(req, res, percorso)
  } catch (e) {
    console.error(new Date().toISOString(), req.method, percorso, e)
    if (!res.headersSent) res.writeHead(500, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ error: e?.message || 'Errore del server locale' }))
  }
}).listen(PORTA, '127.0.0.1', () => {
  console.log(new Date().toISOString(), `GymBuilder locale su http://127.0.0.1:${PORTA}`)
})

// Keep-alive (al posto del cron di Vercel): una lettura al giorno su Supabase.
async function keepAlive() {
  const url = process.env.VITE_SUPABASE_URL
  const key = process.env.VITE_SUPABASE_ANON_KEY
  try {
    const r = await fetch(`${url}/rest/v1/exercises?select=id&limit=1`, {
      headers: { apikey: key, Authorization: `Bearer ${key}` }, signal: AbortSignal.timeout(10_000),
    })
    console.log(new Date().toISOString(), 'keep-alive Supabase', r.status)
  } catch (e) {
    console.error(new Date().toISOString(), 'keep-alive fallito', e?.message)
  }
}
keepAlive()
setInterval(keepAlive, 24 * 60 * 60 * 1000)
