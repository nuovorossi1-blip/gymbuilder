import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'

/**
 * "Il tuo LLM" (Fase 3, aggiornata il 25/09 e il 03/11): una chiave per fornitore (DeepSeek,
 * OpenRouter, OpenCode Zen) e la scelta di quale usare. Per OpenRouter e OpenCode Zen l'elenco
 * dei modelli GRATUITI arriva dal vivo (api/llm-models.js). Le chiavi restano solo nel tuo
 * account e il browser non le rilegge mai.
 */
type Provider = 'deepseek' | 'openrouter' | 'opencode'
interface ModelloLibero { id: string; name: string; context: number | null }

const PROVIDERS: Provider[] = ['deepseek', 'openrouter', 'opencode']
const NOME: Record<Provider, string> = { deepseek: 'DeepSeek', openrouter: 'OpenRouter', opencode: 'OpenCode Zen' }
const PREDEFINITO: Record<Provider, string> = { deepseek: 'deepseek-v4-flash', openrouter: 'google/gemma-4-31b-it:free', opencode: 'glm-5.3-flash-free' }
const VUOTE: Record<Provider, string> = { deepseek: '', openrouter: '', opencode: '' }

const DEEPSEEK_MODELLI = [
  { id: 'deepseek-v4-flash', name: 'DeepSeek V4 Flash (veloce, economico)' },
  { id: 'deepseek-v4-pro', name: 'DeepSeek V4 Pro (ragiona meglio)' },
]

/** Un modello è gratuito se l'id lo dice (OpenRouter ":free", OpenCode "-free") o è nell'elenco gratuito. */
const gratuito = (p: Provider, id: string, elenco: ModelloLibero[] | undefined) =>
  p === 'openrouter' ? id.endsWith(':free') : p === 'opencode' ? /-free$/.test(id) || !!elenco?.some((m) => m.id === id) : false

export function LlmSettings({ userId }: { userId: string | undefined }) {
  const [provider, setProvider] = useState<Provider>('deepseek')
  const [model, setModel] = useState('deepseek-v4-flash')
  const [chiavi, setChiavi] = useState<Record<Provider, string>>(VUOTE)
  const [salvate, setSalvate] = useState<Record<Provider, boolean>>({ deepseek: false, openrouter: false, opencode: false })
  const [riga, setRiga] = useState(false)
  const [liberi, setLiberi] = useState<Partial<Record<Provider, ModelloLibero[]>>>({})
  const [stato, setStato] = useState<'idle' | 'salvo' | 'ok' | 'errore'>('idle')
  const [prova, setProva] = useState<string | null>(null)

  /** Prova la connessione con il fornitore e il modello SALVATI (una richiesta minima). */
  async function provaConnessione() {
    setProva('Provo…')
    try {
      const { chiediJsonAlLlm } = await import('../../lib/deepseek')
      const r = await chiediJsonAlLlm([{ role: 'user', content: 'Rispondi solo con il JSON {"ok": true}.' }])
      setProva(r.ok ? '✓ Funziona.' : '✓ Risponde (formato insolito, ma la connessione c’è).')
    } catch (e) {
      setProva(`✕ ${e instanceof Error ? e.message : 'Non funziona.'}`)
    }
  }

  useEffect(() => {
    if (!userId) return
    // Funzione del database che dice solo SE le chiavi ci sono: il loro valore non torna mai al browser.
    supabase.rpc('llm_keys_stato')
      .then(({ data }) => {
        const r = (Array.isArray(data) ? data[0] : null) as { provider: Provider; model: string; ha_deepseek: boolean; ha_openrouter: boolean; ha_opencode?: boolean } | null
        if (!r) return
        setRiga(true)
        setProvider(r.provider); setModel(r.model)
        setSalvate({ deepseek: r.ha_deepseek, openrouter: r.ha_openrouter, opencode: !!r.ha_opencode })
      })
  }, [userId])

  useEffect(() => {
    if (provider === 'deepseek' || liberi[provider]) return
    fetch(`/api/llm-models${provider === 'opencode' ? '?provider=opencode' : ''}`).then((r) => r.json())
      .then((d) => setLiberi((l) => ({ ...l, [provider]: Array.isArray(d.models) ? d.models : [] })))
      .catch(() => setLiberi((l) => ({ ...l, [provider]: [] })))
  }, [provider, liberi])

  async function salva() {
    if (!userId) return
    setStato('salvo')
    const patch: Record<string, unknown> = { user_id: userId, provider, model: model.trim(), updated_at: new Date().toISOString() }
    for (const p of PROVIDERS) if (chiavi[p].trim()) patch[`${p}_key`] = chiavi[p].trim()
    const { error } = riga
      ? await supabase.from('user_llm_keys').update(patch).eq('user_id', userId)
      : await supabase.from('user_llm_keys').insert(patch)
    if (error) { setStato('errore'); return }
    setRiga(true)
    setSalvate((s) => ({ deepseek: s.deepseek || !!chiavi.deepseek.trim(), openrouter: s.openrouter || !!chiavi.openrouter.trim(), opencode: s.opencode || !!chiavi.opencode.trim() }))
    setChiavi(VUOTE)
    setStato('ok')
  }

  const elenco = liberi[provider]
  const chiaveMancante = !salvate[provider] && !chiavi[provider].trim()
  const modelloLibero = elenco?.find((m) => m.id === model)

  return (
    <section className="mt-8 rounded-2xl border border-cyan-500/25 bg-cyan-500/5 p-4">
      <h2 className="font-display text-lg font-bold uppercase text-white">Il tuo LLM</h2>
      <p className="mt-2 text-sm leading-relaxed text-slate2">
        Il Coach e le funzioni AI usano il fornitore e il modello scelti qui, con la tua chiave.
        Su OpenRouter e OpenCode Zen i modelli gratuiti non costano nulla ma hanno un limite di richieste.
      </p>
      <div className="mt-4 space-y-4">
        <label className="block">
          <span className="field-label">Fornitore attivo</span>
          <select className="input" value={provider} onChange={(e) => {
            const p = e.target.value as Provider
            setProvider(p)
            setModel(p === 'deepseek' ? PREDEFINITO.deepseek : (liberi[p]?.[0]?.id ?? PREDEFINITO[p]))
          }}>
            {PROVIDERS.map((p) => <option key={p} value={p}>{NOME[p]}</option>)}
          </select>
        </label>

        <label className="block">
          <span className="field-label">Modello</span>
          {provider === 'deepseek' ? (
            <select className="input" value={model} onChange={(e) => setModel(e.target.value)}>
              {DEEPSEEK_MODELLI.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
          ) : (
            <>
              <select className="input" value={modelloLibero ? model : '__altro'} onChange={(e) => { if (e.target.value !== '__altro') setModel(e.target.value) }}>
                {!elenco && <option>Carico i modelli gratuiti…</option>}
                {(elenco ?? []).map((m) => (
                  <option key={m.id} value={m.id}>{m.name}{m.context ? ` · ${Math.round(m.context / 1000)}K` : ''}</option>
                ))}
                <option value="__altro">Altro modello (scrivi l'id)…</option>
              </select>
              {!modelloLibero && (
                <input className="input mt-2" placeholder={`es. ${PREDEFINITO[provider]}`} value={model} onChange={(e) => setModel(e.target.value)} />
              )}
              <span className="mt-1 block text-[11px] text-slate2">
                Elenco aggiornato dei modelli gratuiti di {NOME[provider]}. Per il Coach scegline uno con contesto ampio (almeno 64K).
                {provider === 'opencode' ? ' La chiave si crea su opencode.ai/auth (accesso con GitHub o Google).' : ''}
                {model && !gratuito(provider, model, elenco) ? ` Attenzione: questo modello non è gratuito, userà il credito ${NOME[provider]}.` : ''}
              </span>
            </>
          )}
        </label>

        {PROVIDERS.map((p) => (
          <label key={p} className="block">
            <span className="field-label">Chiave {NOME[p]}</span>
            <input
              className="input" type="password" autoComplete="off"
              placeholder={salvate[p] ? 'Chiave salvata: scrivine una nuova per sostituirla' : 'Incolla qui la chiave'}
              value={chiavi[p]} onChange={(e) => setChiavi((c) => ({ ...c, [p]: e.target.value }))}
            />
          </label>
        ))}

        <button className="btn" disabled={stato === 'salvo' || !model.trim() || chiaveMancante} onClick={() => { void salva() }}>
          {stato === 'salvo' ? 'Salvataggio…' : 'Salva LLM'}
        </button>
        <button className="w-full rounded-xl border border-edge py-2.5 text-sm" onClick={() => { void provaConnessione() }}>🔌 Prova la connessione</button>
        {prova && <p className={`text-xs ${prova.startsWith('✕') ? 'text-amber2' : 'text-emerald-300'}`} role="status">{prova}</p>}
        <p className="text-xs text-slate2" role="status">
          {stato === 'ok' ? 'Salvato.' : stato === 'errore' ? 'Non salvato: riprova.' : chiaveMancante ? `Manca la chiave ${NOME[provider]}.` : `In uso: ${NOME[provider]} · ${model}.`}
          {' '}Chiavi salvate: {PROVIDERS.map((p) => `${NOME[p]} ${salvate[p] ? '✓' : '—'}`).join(' · ')}
        </p>
      </div>
    </section>
  )
}
