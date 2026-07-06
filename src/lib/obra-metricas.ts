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

/** Data de referência da obra (mesma ordem do banco: fim → início → criação). */
export function obraDataReferencia(
  dataPrevistaFim?: string | null,
  dataPrevistaInicio?: string | null,
  criadoEm?: string | null,
): string | null {
  return dataPrevistaFim?.slice(0, 10)
    ?? dataPrevistaInicio?.slice(0, 10)
    ?? criadoEm?.slice(0, 10)
    ?? null
}

export function mesAnoDeData(iso?: string | null): { mes: number; ano: number } | null {
  if (!iso || iso.length < 7) return null
  const mes = Number(iso.slice(5, 7))
  const ano = Number(iso.slice(0, 4))
  if (!mes || !ano) return null
  return { mes, ano }
}

export function dataNoPeriodo(
  iso: string | null | undefined,
  mes: number,
  ano: number,
): boolean {
  const ref = mesAnoDeData(iso)
  return ref?.mes === mes && ref?.ano === ano
}

export function mesReferenciaNoPeriodo(
  mesReferencia: string | null | undefined,
  mes: number,
  ano: number,
): boolean {
  return dataNoPeriodo(mesReferencia, mes, ano)
}
