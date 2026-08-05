/**
 * Schermate delle fasi non ancora costruite.
 * Dicono chiaramente cosa manca e quando arriva: meglio una schermata onesta
 * di pulsanti che non fanno niente (regola del protocollo AI-OS).
 */
export default function Placeholder({
  titolo,
  fase,
  cosa,
}: {
  titolo: string
  fase: string
  cosa: string
}) {
  return (
    <div className="px-5 pt-12">
      <h1 className="font-display font-extrabold uppercase text-[2.4rem] leading-none tracking-tight">
        {titolo}
      </h1>
      <div className="slab mt-8">
        <p className="eyebrow mb-2.5">In arrivo · {fase}</p>
        <p className="text-[15px] leading-relaxed text-slate2">{cosa}</p>
      </div>
    </div>
  )
}
