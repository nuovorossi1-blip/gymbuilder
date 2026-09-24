import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'

/**
 * "Il tuo LLM" (Fase 3, aggiornata il 25/09): una chiave per fornitore (DeepSeek e OpenRouter) e
 * la scelta di quale usare. Per OpenRouter l'elenco dei modelli GRATUITI arriva dal vivo
 * (api/llm-models.js). Le chiavi restano solo nel tuo account e il browser non le rilegge mai.
 */
type Provider = 'deepseek' | 'openrouter'
interface ModelloLibero { id: string; name: string; context: number | null }

const DEEPSEEK_MODELLI = [
  { id: 'deepseek-v4-flash', name: 'DeepSeek V4 Flash (veloce, economico)' },
  { id: 'deepseek-v4-pro', name: 'DeepSeek V4 Pro (ragiona meglio)' },
]

export function LlmSettings({ userId }: { userId: string | undefined }) {
  const [provider, setProvider] = useState<Provider>('deepseek')
  const [model, setModel] = useState('deepseek-v4-flash')
  const [chiavi, setChiavi] = useState<{ deepseek: string; openrouter: string }>({ deepseek: '', openrouter: '' })
  const [salvate, setSalvate] = useState<{ deepseek: boolean; openrouter: boolean }>({ deepseek: false, openrouter: false })
  const [riga, setRiga] = useState(false)
  const [liberi, setLiberi] = useState<ModelloLibero[] | null>(null)
  const [stato, setStato] = useState<'idle' | 'salvo' | 'ok' | 'errore'>('idle')

  useEffect(() => {
    if (!userId) return
    // Funzione del database che dice solo SE le chiavi ci sono: il loro valore non torna mai al browser.
    supabase.rpc('llm_keys_stato')
      .then(({ data }) => {
        const r = (Array.isArray(data) ? data[0] : null) as { provider: Provider; model: string; ha_deepseek: boolean; ha_openrouter: boolean } | null
        if (!r) return
        setRiga(true)
        setProvider(r.provider); setModel(r.model)
        setSalvate({ deepseek: r.ha_deepseek, openrouter: r.ha_openrouter })
      })
  }, [userId])

  useEffect(() => {
    if (provider !== 'openrouter' || liberi) return
    fetch('/api/llm-models').then((r) => r.json()).then((d) => setLiberi(Array.isArray(d.models) ? d.models : [])).catch(() => setLiberi([]))
  }, [provider, liberi])

  async function salva() {
    if (!userId) return
    setStato('salvo')
    const patch: Record<string, unknown> = { user_id: userId, provider, model: model.trim(), updated_at: new Date().toISOString() }
    if (chiavi.deepseek.trim()) patch.deepseek_key = chiavi.deepseek.trim()
    if (chiavi.openrouter.trim()) patch.openrouter_key = chiavi.openrouter.trim()
    const { error } = riga
      ? await supabase.from('user_llm_keys').update(patch).eq('user_id', userId)
      : await supabase.from('user_llm_keys').insert(patch)
    if (error) { setStato('errore'); return }
    setRiga(true)
    setSalvate((s) => ({ deepseek: s.deepseek || !!chiavi.deepseek.trim(), openrouter: s.openrouter || !!chiavi.openrouter.trim() }))
    setChiavi({ deepseek: '', openrouter: '' })
    setStato('ok')
  }

  const chiaveMancante = provider === 'deepseek' ? !salvate.deepseek && !chiavi.deepseek.trim() : !salvate.openrouter && !chiavi.openrouter.trim()
  const modelloLibero = liberi?.find((m) => m.id === model)

  return (
    <section className="mt-8 rounded-2xl border border-cyan-500/25 bg-cyan-500/5 p-4">
      <h2 className="font-display text-lg font-bold uppercase text-white">Il tuo LLM</h2>
      <p className="mt-2 text-sm leading-relaxed text-slate2">
        Il Coach e le funzioni AI usano il fornitore e il modello scelti qui, con la tua chiave.
        Su OpenRouter i modelli gratuiti non costano nulla ma hanno un limite di richieste al minuto e al giorno.
      </p>
      <div className="mt-4 space-y-4">
        <label className="block">
          <span className="field-label">Fornitore attivo</span>
          <select className="input" value={provider} onChange={(e) => {
            const p = e.target.value as Provider
            setProvider(p)
            setModel(p === 'deepseek' ? 'deepseek-v4-flash' : (liberi?.[0]?.id ?? 'z-ai/glm-5.2:free'))
          }}>
            <option value="deepseek">DeepSeek</option>
            <option value="openrouter">OpenRouter</option>
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
                {liberi === null && <option>Carico i modelli gratuiti…</option>}
                {(liberi ?? []).map((m) => (
                  <option key={m.id} value={m.id}>{m.name}{m.context ? ` · ${Math.round(m.context / 1000)}K` : ''}</option>
                ))}
                <option value="__altro">Altro modello (scrivi l'id)…</option>
              </select>
              {!modelloLibero && (
                <input className="input mt-2" placeholder="es. z-ai/glm-5.2:free" value={model} onChange={(e) => setModel(e.target.value)} />
              )}
              <span className="mt-1 block text-[11px] text-slate2">
                Elenco aggiornato dei modelli gratuiti di OpenRouter. Per il Coach scegline uno con contesto ampio (almeno 64K).
                {model && !model.endsWith(':free') ? ' Attenzione: questo modello non è gratuito, userà il credito OpenRouter.' : ''}
              </span>
            </>
          )}
        </label>

        {(['deepseek', 'openrouter'] as Provider[]).map((p) => (
          <label key={p} className="block">
            <span className="field-label">Chiave {p === 'deepseek' ? 'DeepSeek' : 'OpenRouter'}</span>
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
        <p className="text-xs text-slate2" role="status">
          {stato === 'ok' ? 'Salvato.' : stato === 'errore' ? 'Non salvato: riprova.' : chiaveMancante ? `Manca la chiave ${provider === 'deepseek' ? 'DeepSeek' : 'OpenRouter'}.` : `In uso: ${provider === 'deepseek' ? 'DeepSeek' : 'OpenRouter'} · ${model}.`}
          {' '}Chiavi salvate: DeepSeek {salvate.deepseek ? '✓' : '—'} · OpenRouter {salvate.openrouter ? '✓' : '—'}
        </p>
      </div>
    </section>
  )
}
