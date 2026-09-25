import type { ReactNode } from 'react'

/**
 * Markdown minimo per i messaggi del Coach (25/09): paragrafi, elenchi puntati e numerati,
 * titoletti, **grassetto**, *corsivo*, `codice`. Niente HTML grezzo: solo elementi React.
 */
function inline(testo: string): ReactNode[] {
  const out: ReactNode[] = []
  const re = /(\*\*[^*]+\*\*|\*[^*\s][^*]*\*|`[^`]+`)/g
  let ultimo = 0
  let m: RegExpExecArray | null
  let k = 0
  while ((m = re.exec(testo))) {
    if (m.index > ultimo) out.push(testo.slice(ultimo, m.index))
    const t = m[0]
    if (t.startsWith('**')) out.push(<strong key={k++} className="font-semibold text-white">{t.slice(2, -2)}</strong>)
    else if (t.startsWith('`')) out.push(<code key={k++} className="rounded bg-steel px-1 text-[0.92em]">{t.slice(1, -1)}</code>)
    else out.push(<em key={k++}>{t.slice(1, -1)}</em>)
    ultimo = m.index + t.length
  }
  if (ultimo < testo.length) out.push(testo.slice(ultimo))
  return out
}

export function Markdown({ testo }: { testo: string }) {
  const righe = testo.replace(/\r/g, '').split('\n')
  const blocchi: ReactNode[] = []
  let i = 0
  let k = 0
  while (i < righe.length) {
    const r = righe[i]
    if (!r.trim()) { i++; continue }
    if (/^\s*[-*•]\s+/.test(r)) {
      const voci: string[] = []
      while (i < righe.length && /^\s*[-*•]\s+/.test(righe[i])) voci.push(righe[i++].replace(/^\s*[-*•]\s+/, ''))
      blocchi.push(<ul key={k++} className="list-disc space-y-1 pl-5">{voci.map((v, j) => <li key={j}>{inline(v)}</li>)}</ul>)
      continue
    }
    if (/^\s*\d+[.)]\s+/.test(r)) {
      const voci: string[] = []
      while (i < righe.length && /^\s*\d+[.)]\s+/.test(righe[i])) voci.push(righe[i++].replace(/^\s*\d+[.)]\s+/, ''))
      blocchi.push(<ol key={k++} className="list-decimal space-y-1 pl-5">{voci.map((v, j) => <li key={j}>{inline(v)}</li>)}</ol>)
      continue
    }
    if (/^#{1,4}\s+/.test(r)) {
      blocchi.push(<p key={k++} className="font-semibold text-white">{inline(r.replace(/^#{1,4}\s+/, ''))}</p>)
      i++
      continue
    }
    const par: string[] = []
    while (i < righe.length && righe[i].trim() && !/^\s*([-*•]|\d+[.)]|#{1,4})\s+/.test(righe[i])) par.push(righe[i++])
    blocchi.push(<p key={k++}>{par.map((p, j) => <span key={j}>{j > 0 && <br />}{inline(p)}</span>)}</p>)
  }
  return <div className="space-y-2.5">{blocchi}</div>
}
