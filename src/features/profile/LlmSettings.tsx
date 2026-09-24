import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'

/**
 * "Il tuo LLM" (Fase 3, 25/09): ogni utente sceglie fornitore, modello e chiave. La chiave è
 * salvata solo per il suo account (tabella user_llm_keys con RLS) e il server la usa per le sue
 * richieste; il browser non la rilegge mai (si mostra solo "chiave salvata").
 */
const MODELLI: Record<'deepseek' | 'openrouter', string[]> = {
  deepseek: ['deepseek-v4-flash', 'deepseek-v4-pro'],
  openrouter: ['deepseek/deepseek-chat', 'openai/gpt-4o-mini', 'anthropic/claude-sonnet-4', 'google/gemini-2.5-flash'],
}

export function LlmSettings({ userId }: { userId: string | undefined }) {
  const [provider, setProvider] = useState<'deepseek' | 'openrouter'>('deepseek')
  const [model, setModel] = useState('deepseek-v4-flash')
  const [key, setKey] = useState('')
  const [salvata, setSalvata] = useState<string | null>(null)
  const [stato, setStato] = useState<'idle' | 'salvo' | 'ok' | 'errore'>('idle')

  useEffect(() => {
    if (!userId) return
    supabase.from('user_llm_keys').select('provider, model, updated_at').eq('user_id', userId).maybeSingle()
      .then(({ data }) => {
        if (!data) return
        setProvider(data.provider as 'deepseek' | 'openrouter'); setModel(data.model as string); setSalvata(data.updated_at as string)
      })
  }, [userId])

  async function salva() {
    if (!userId) return
    setStato('salvo')
    const riga: Record<string, unknown> = { user_id: userId, provider, model: model.trim(), updated_at: new Date().toISOString() }
    if (key.trim()) riga.api_key = key.trim()
    const { error } = salvata && !key.trim()
      ? await supabase.from('user_llm_keys').update({ provider, model: model.trim(), updated_at: riga.updated_at }).eq('user_id', userId)
      : await supabase.from('user_llm_keys').upsert(riga)
    if (error) { setStato('errore'); return }
    setSalvata(riga.updated_at as string); setKey(''); setStato('ok')
  }

  async function elimina() {
    if (!userId) return
    await supabase.from('user_llm_keys').delete().eq('user_id', userId)
    setSalvata(null); setStato('idle')
  }

  return (
    <section className="mt-8 rounded-2xl border border-cyan-500/25 bg-cyan-500/5 p-4">
      <h2 className="font-display text-lg font-bold uppercase text-white">Il tuo LLM</h2>
      <p className="mt-2 text-sm leading-relaxed text-slate2">
        Il Coach e le funzioni AI usano il fornitore e la chiave che scegli qui, e il costo è sul tuo account.
        Con OpenRouter una sola chiave dà accesso a quasi tutti i modelli (GPT, Claude, Gemini, DeepSeek…).
      </p>
      <div className="mt-4 space-y-4">
        <label className="block">
          <span className="field-label">Fornitore</span>
          <select className="input" value={provider} onChange={(e) => { const p = e.target.value as 'deepseek' | 'openrouter'; setProvider(p); setModel(MODELLI[p][0]) }}>
            <option value="deepseek">DeepSeek (platform.deepseek.com)</option>
            <option value="openrouter">OpenRouter (openrouter.ai)</option>
          </select>
        </label>
        <label className="block">
          <span className="field-label">Modello</span>
          <input className="input" list="modelli-llm" value={model} onChange={(e) => setModel(e.target.value)} />
          <datalist id="modelli-llm">{MODELLI[provider].map((m) => <option key={m} value={m} />)}</datalist>
          <span className="mt-1 block text-[11px] text-slate2">
            {provider === 'openrouter' ? 'Esempi: l’elenco completo e aggiornato è su openrouter.ai/models.' : 'Flash è veloce ed economico, Pro ragiona meglio.'}
          </span>
        </label>
        <label className="block">
          <span className="field-label">Chiave API</span>
          <input className="input" type="password" autoComplete="off" placeholder={salvata ? 'Chiave salvata: scrivine una nuova per sostituirla' : 'Incolla qui la chiave'} value={key} onChange={(e) => setKey(e.target.value)} />
        </label>
        <div className="flex gap-2">
          <button className="btn flex-1" disabled={stato === 'salvo' || (!salvata && key.trim().length < 10) || !model.trim()} onClick={() => { void salva() }}>
            {stato === 'salvo' ? 'Salvataggio…' : 'Salva LLM'}
          </button>
          {salvata && <button className="rounded-xl border border-edge px-4 text-sm text-slate2" onClick={() => { void elimina() }}>Rimuovi</button>}
        </div>
        <p className="text-xs text-slate2" role="status">
          {stato === 'ok' ? 'Salvato.' : stato === 'errore' ? 'Non salvato: controlla la chiave e riprova.' : salvata ? `Chiave salvata il ${new Date(salvata).toLocaleDateString('it-IT')}.` : 'Nessuna chiave salvata.'}
        </p>
      </div>
    </section>
  )
}
