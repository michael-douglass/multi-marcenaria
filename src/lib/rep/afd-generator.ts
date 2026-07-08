import { afdLine, padField, padNum, sha256HexBytes, toLatin1 } from '@/lib/rep/crc16'
import type { PontoMarcacao, RepConfig } from '@/types'

export interface AfdEmpregadorHeader {
  cnpj: string
  razaoSocial: string
  cei?: string
}

export interface AfdMarcacaoRow {
  nsr: number
  tipoRegistro: '3' | '5'
  dataHora: Date
  cpf?: string
  tipoMarcacao?: string
}

function fmtData(d: Date): string {
  const dd = padNum(d.getDate(), 2)
  const mm = padNum(d.getMonth() + 1, 2)
  const yyyy = padNum(d.getFullYear(), 4)
  return `${dd}${mm}${yyyy}`
}

function fmtHora(d: Date): string {
  return `${padNum(d.getHours(), 2)}${padNum(d.getMinutes(), 2)}`
}

export function buildAfdHeader(emp: AfdEmpregadorHeader): string {
  const now = new Date()
  return afdLine([
    '000000000',
    '1',
    padField('1', 1),
    padField(emp.cnpj.replace(/\D/g, ''), 14),
    padField(emp.cei ?? '', 12),
    padField(emp.razaoSocial, 150),
    fmtData(now),
    fmtHora(now),
  ])
}

export function buildAfdMarcacao(m: PontoMarcacao, cpf?: string): string {
  const dt = new Date(m.registrado_em)
  return afdLine([
    padNum(m.nsr, 9),
    '3',
    fmtData(dt),
    fmtHora(dt),
    padField((cpf ?? '').replace(/\D/g, ''), 12),
  ])
}

export function buildAfdTrailer(totalLines: number): string {
  return afdLine([
    padNum(totalLines, 9),
    '9',
    padNum(totalLines, 9),
    padField('ASSINATURA_DIGITAL_EM_ARQUIVO_P7S', 100),
  ])
}

export async function generateAfdContent(
  config: RepConfig,
  marcacoes: PontoMarcacao[],
  cpfMap: Record<string, string>,
): Promise<{ content: string; hashSha256: string; fileName: string }> {
  const sorted = [...marcacoes].sort((a, b) => a.nsr - b.nsr)
  const lines: string[] = []
  lines.push(buildAfdHeader({
    cnpj: config.cnpj,
    razaoSocial: config.razao_social,
  }))
  for (const m of sorted) {
    lines.push(buildAfdMarcacao(m, cpfMap[m.funcionario_id]))
  }
  const totalRecords = lines.length + 1
  lines.push(buildAfdTrailer(totalRecords))
  const content = toLatin1(lines.join(''))
  const hashSha256 = await sha256HexBytes(content)
  const fileName = `${padNum(config.cnpj.replace(/\D/g, ''), 14)}REP_P.txt`
  return { content, hashSha256, fileName }
}
