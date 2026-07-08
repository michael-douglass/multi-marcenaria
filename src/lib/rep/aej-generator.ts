import { afdLine, padField, padNum, sha256HexBytes, toLatin1 } from '@/lib/rep/crc16'
import type { FuncionarioJornada, PontoMarcacao, PontoOcorrencia, RepConfig } from '@/types'

function fmtDataIso(d: string | Date): string {
  const dt = typeof d === 'string' ? new Date(d + 'T12:00:00') : d
  return `${padNum(dt.getDate(), 2)}${padNum(dt.getMonth() + 1, 2)}${padNum(dt.getFullYear(), 4)}`
}

function fmtTime(t: string): string {
  const [h, m] = t.split(':')
  return `${padNum(h ?? '0', 2)}${padNum(m ?? '0', 2)}`
}

export interface AejInput {
  config: RepConfig
  funcionarioId: string
  cpf: string
  nome: string
  jornada: FuncionarioJornada
  marcacoes: PontoMarcacao[]
  ocorrencias: PontoOcorrencia[]
  periodoInicio: string
  periodoFim: string
}

export async function generateAejContent(input: AejInput): Promise<{
  content: string
  hashSha256: string
  fileName: string
}> {
  const lines: string[] = []

  lines.push(afdLine([
    padNum(1, 9),
    '1',
    padField(input.config.cnpj.replace(/\D/g, ''), 14),
    padField(input.config.razao_social, 150),
    fmtDataIso(input.periodoInicio),
    fmtDataIso(input.periodoFim),
    padField(input.config.versao_software, 30),
  ]))

  lines.push(afdLine([
    padNum(2, 9),
    '2',
    padField(input.cpf.replace(/\D/g, ''), 12),
    padField(input.nome, 150),
  ]))

  lines.push(afdLine([
    padNum(3, 9),
    '3',
    fmtTime(input.jornada.hora_entrada),
    fmtTime(input.jornada.hora_saida_intervalo),
    fmtTime(input.jornada.hora_retorno_intervalo),
    fmtTime(input.jornada.hora_saida),
  ]))

  let seq = 4
  for (const m of input.marcacoes.sort((a, b) => a.nsr - b.nsr)) {
    const dt = new Date(m.registrado_em)
    lines.push(afdLine([
      padNum(seq++, 9),
      '4',
      padNum(m.nsr, 9),
      fmtDataIso(dt),
      `${padNum(dt.getHours(), 2)}${padNum(dt.getMinutes(), 2)}`,
      padField(m.tipo, 20),
      padField(m.status, 10),
      padNum(m.atraso_minutos, 4),
    ]))
  }

  for (const o of input.ocorrencias) {
    lines.push(afdLine([
      padNum(seq++, 9),
      '5',
      fmtDataIso(o.data),
      padField(o.tipo, 10),
      padField(o.observacao ?? '', 100),
    ]))
  }

  lines.push(afdLine([
    padNum(seq, 9),
    '9',
    padField('ASSINATURA_DIGITAL_EM_ARQUIVO_P7S', 100),
  ]))

  const content = toLatin1(lines.join(''))
  const hashSha256 = await sha256HexBytes(content)
  const fileName = `AEJ_${input.cpf.replace(/\D/g, '')}_${input.periodoInicio}_${input.periodoFim}.txt`
  return { content, hashSha256, fileName }
}
