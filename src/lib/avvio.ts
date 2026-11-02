// Toglie la schermata d'avvio di index.html quando la prima schermata e' pronta (almeno 0,8 s visibile).
export function chiudiAvvio() {
  const el = document.getElementById('avvio')
  if (!el) return
  const start = (window as unknown as { __avvioT?: number }).__avvioT ?? 0
  setTimeout(() => {
    el.classList.add('via')
    setTimeout(() => el.remove(), 350)
  }, Math.max(0, 800 - (performance.now() - start)))
}
