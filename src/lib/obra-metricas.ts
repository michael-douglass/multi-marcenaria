/** Formata horas decimais em texto legível (ex.: 2h 35min ou 0h 45min). */
export function fmtDuracaoHoras(h: number | null | undefined, emAndamento = false): string {
  if (h == null || Number.isNaN(h)) return '—'

  const totalSeg = Math.round(Math.abs(h) * 3600)
  const horas = Math.floor(totalSeg / 3600)
  const mins = Math.floor((totalSeg % 3600) / 60)
  const dec = Number(h).toFixed(2).replace('.', ',')

  const legivel = horas > 0
    ? (mins > 0 ? `${horas}h ${mins}min` : `${horas}h`)
    : `${mins}min`

  return emAndamento ? `${legivel} (${dec} h · em andamento)` : `${legivel} (${dec} h)`
}

export function labelMesAno(mes: number, ano: number, meses: string[]): string {
  const nome = meses[mes - 1] ?? String(mes)
  return `${nome}/${ano}`
}
