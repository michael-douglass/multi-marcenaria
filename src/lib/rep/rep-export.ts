import { supabase } from '@/lib/supabase'
import { FUNCIONARIO_DOCS_BUCKET } from '@/lib/funcionario-documentos'
import { generateAfdContent } from '@/lib/rep/afd-generator'
import { generateAejContent } from '@/lib/rep/aej-generator'
import { validarExportacaoRep } from '@/lib/rep/rep-validation'
import type {
  FuncionarioJornada,
  PontoMarcacao,
  PontoOcorrencia,
  RepConfig,
} from '@/types'

export interface ExportRepInput {
  tipo: 'afd' | 'aej'
  funcionarioId: string
  funcionarioNome: string
  funcionarioCpf: string
  jornada: FuncionarioJornada
  marcacoes: PontoMarcacao[]
  ocorrencias: PontoOcorrencia[]
  repConfig: RepConfig | null
  periodoInicio: string
  periodoFim: string
}

function filterPeriodo<T extends { registrado_em?: string; data?: string }>(
  items: T[],
  inicio: string,
  fim: string,
  dateKey: 'registrado_em' | 'data',
): T[] {
  const i = new Date(inicio + 'T00:00:00')
  const f = new Date(fim + 'T23:59:59')
  return items.filter(item => {
    const raw = item[dateKey]
    if (!raw) return false
    const d = dateKey === 'data' ? new Date(raw + 'T12:00:00') : new Date(raw)
    return d >= i && d <= f
  })
}

export async function exportarRepArquivos(input: ExportRepInput): Promise<void> {
  const checklist = validarExportacaoRep({
    tipo: input.tipo,
    repConfig: input.repConfig,
    funcionarioCpf: input.funcionarioCpf,
    jornada: input.jornada,
    marcacoes: input.marcacoes,
    periodoInicio: input.periodoInicio,
    periodoFim: input.periodoFim,
  })
  if (!checklist.ok) {
    throw new Error(checklist.erros.join(' '))
  }

  const config = input.repConfig!

  const marcacoes = filterPeriodo(input.marcacoes, input.periodoInicio, input.periodoFim, 'registrado_em')
  const ocorrencias = filterPeriodo(input.ocorrencias, input.periodoInicio, input.periodoFim, 'data')

  let content: string
  let fileName: string
  let hashSha256: string

  if (input.tipo === 'afd') {
    const cpfMap: Record<string, string> = { [input.funcionarioId]: input.funcionarioCpf }
    const result = await generateAfdContent(config, marcacoes, cpfMap)
    content = result.content
    fileName = result.fileName
    hashSha256 = result.hashSha256
  } else {
    const result = await generateAejContent({
      config,
      funcionarioId: input.funcionarioId,
      cpf: input.funcionarioCpf,
      nome: input.funcionarioNome,
      jornada: input.jornada,
      marcacoes,
      ocorrencias,
      periodoInicio: input.periodoInicio,
      periodoFim: input.periodoFim,
    })
    content = result.content
    fileName = result.fileName
    hashSha256 = result.hashSha256
  }

  const storagePath = `${input.funcionarioId}/rep/${input.tipo}/${input.periodoInicio}_${input.periodoFim}/${fileName}`
  const blob = new Blob([content], { type: 'text/plain;charset=iso-8859-1' })

  const { error: upErr } = await supabase.storage
    .from(FUNCIONARIO_DOCS_BUCKET)
    .upload(storagePath, blob, { contentType: 'text/plain', upsert: true })
  if (upErr) throw new Error(upErr.message)

  let assinaturaPath: string | null = null
  try {
    const { data, error } = await supabase.functions.invoke('rep-assinar-arquivo', {
      body: { storagePath, fileName, hashSha256 },
    })
    if (!error && data?.assinaturaPath) assinaturaPath = data.assinaturaPath as string
  } catch (e) {
    console.warn('[rep-export] Assinatura CAdES:', e)
  }

  const { error: dbErr } = await supabase.from('movelaria_rep_arquivos').insert({
    tipo: input.tipo,
    periodo_inicio: input.periodoInicio,
    periodo_fim: input.periodoFim,
    arquivo_path: storagePath,
    assinatura_path: assinaturaPath,
    hash_sha256: hashSha256,
    funcionario_id: input.funcionarioId,
  })
  if (dbErr) throw new Error(dbErr.message)

  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = fileName
  a.click()
  URL.revokeObjectURL(url)
}
