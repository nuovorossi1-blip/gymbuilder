import { Component, type ErrorInfo, type ReactNode } from 'react'
import { logJsError } from '../lib/jsErrorLog'

interface Props {
  children: ReactNode
}

interface State {
  error: Error | null
  copied: boolean
}

/**
 * Rete di sicurezza per errori di render React (window.onerror in jsErrorLog.ts non li vede:
 * React li intercetta prima e altrimenti smonterebbe l'intero albero lasciando una schermata
 * bianca). Logga l'errore per Profilo > Diagnostica e offre un modo per uscirne senza dover
 * forzare la chiusura dell'app.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null, copied: false }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    logJsError('react', error.message, `${error.stack ?? ''}\n${info.componentStack ?? ''}`.trim())
  }

  render() {
    const { error } = this.state
    if (!error) return this.props.children
    const details = `${error.message}\n${error.stack ?? ''}`
    return (
      <div className="min-h-dvh grid place-items-center px-6 text-center">
        <div className="max-w-sm space-y-4">
          <div className="text-4xl">⚠️</div>
          <h1 className="font-display text-xl font-bold uppercase text-white">Qualcosa si è rotto</h1>
          <p className="text-sm text-slate2 leading-relaxed">
            L’app ha incontrato un errore imprevisto. È stato registrato in Profilo → Diagnostica:
            copialo e incollalo in chat per farlo correggere.
          </p>
          <div className="flex gap-2.5">
            <button
              className="flex-1 rounded-xl border border-cyan-500/40 bg-cyan-500/15 py-2.5 font-data text-xs uppercase tracking-wider text-cyan-200"
              onClick={async () => {
                await navigator.clipboard.writeText(details)
                this.setState({ copied: true })
                setTimeout(() => this.setState({ copied: false }), 2000)
              }}
            >
              {this.state.copied ? 'Copiato!' : 'Copia errore'}
            </button>
            <button
              className="flex-1 rounded-xl border border-edge py-2.5 font-data text-xs uppercase tracking-wider text-slate2"
              onClick={() => { this.setState({ error: null }); window.location.href = '/' }}
            >
              Torna alla Home
            </button>
          </div>
        </div>
      </div>
    )
  }
}
