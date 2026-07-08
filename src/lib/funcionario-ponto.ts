import { supabase } from '@/lib/supabase'
import { FUNCIONARIO_DOCS_BUCKET, getFuncionarioDocSignedUrl } from '@/lib/funcionario-documentos'
import { createId } from '@/lib/utils'
import { PONTO_TIPO_LABEL } from '@/lib/funcionario-constants'
import type {
  FuncionarioJornada,
  PontoControleFuncionarioRow,
  PontoMarcacao,
  PontoMarcacaoTipo,
  PontoOcorrencia,
  PontoStatusDiaPayload,
  RepArquivo,
  RepConfig,
} from '@/types'

export const PONTO_TIPOS_ORDEM: PontoMarcacaoTipo[] = [
  'entrada',
  'saida_intervalo',
  'retorno_intervalo',
  'saida',
]

export function labelPontoTipo(tipo: PontoMarcacaoTipo | string | null | undefined): string {
  if (!tipo) return '—'
  return PONTO_TIPO_LABEL[tipo] ?? tipo
}

export function formatJornadaResumo(jornada?: FuncionarioJornada | null): string | null {
  if (!jornada) return null
  const ini = jornada.hora_entrada?.slice(0, 5)
  const fim = jornada.hora_saida?.slice(0, 5)
  if (!ini || !fim) return null
  return `${ini}–${fim}`
}

export async function sha256Hex(payload: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(payload))
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('')
}

export interface GeoPosition {
  latitude: number
  longitude: number
  accuracy: number
}

export function requestGeolocation(timeoutMs = 15000): Promise<GeoPosition> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Seu dispositivo não suporta geolocalização.'))
      return
    }
    const timer = window.setTimeout(() => {
      reject(new Error('Tempo esgotado ao obter localização. Verifique se o GPS está ativo.'))
    }, timeoutMs)
    navigator.geolocation.getCurrentPosition(
      pos => {
        clearTimeout(timer)
        resolve({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
        })
      },
      err => {
        clearTimeout(timer)
        reject(new Error(err.message || 'Permissão de localização negada.'))
      },
      { enableHighAccuracy: true, timeout: timeoutMs, maximumAge: 0 },
    )
  })
}

export async function uploadPontoArquivo(
  funcionarioId: string,
  marcacaoId: string,
  kind: 'foto' | 'assinatura',
  blob: Blob,
): Promise<string> {
  const ext = kind === 'foto' ? 'jpg' : 'png'
  const mime = kind === 'foto' ? 'image/jpeg' : 'image/png'
  const path = `${funcionarioId}/ponto/${marcacaoId}/${kind}.${ext}`
  const { error } = await supabase.storage
    .from(FUNCIONARIO_DOCS_BUCKET)
    .upload(path, blob, { contentType: mime, upsert: true })
  if (error) throw new Error(error.message)
  return path
}

export async function fetchPontoStatusDia(funcionarioId?: string): Promise<PontoStatusDiaPayload | null> {
  const { data, error } = await supabase.rpc('movelaria_ponto_status_dia', {
    p_funcionario_id: funcionarioId ?? null,
  })
  if (error) throw new Error(error.message)
  return data as PontoStatusDiaPayload | null
}

export async function baterPonto(input: {
  fotoPath: string
  assinaturaPath: string
  geo: GeoPosition
  hashSha256: string
  marcacaoId?: string
}): Promise<{
  marcacao: PontoMarcacao
  documento_id: string
  funcionario_id: string
  funcionario_nome: string
  comprovante_path: string
}> {
  const marcacaoId = input.marcacaoId ?? createId()
  const { data, error } = await supabase.rpc('movelaria_ponto_bater', {
    p_marcacao_id: marcacaoId,
    p_foto_path: input.fotoPath,
    p_assinatura_path: input.assinaturaPath,
    p_latitude: input.geo.latitude,
    p_longitude: input.geo.longitude,
    p_precisao_metros: input.geo.accuracy,
    p_hash_sha256: input.hashSha256,
  })
  if (error) throw new Error(error.message)

  const result = data as {
    marcacao: PontoMarcacao
    documento_id: string
    funcionario_id: string
    funcionario_nome: string
    comprovante_path: string
  }

  try {
    await gerarComprovantePonto({
      marcacaoId: result.marcacao.id,
      funcionarioId: result.funcionario_id,
      funcionarioNome: result.funcionario_nome,
      comprovantePath: result.comprovante_path,
      marcacao: result.marcacao,
      fotoPath: input.fotoPath,
      assinaturaPath: input.assinaturaPath,
      geo: input.geo,
    })
  } catch (e) {
    console.warn('[ponto] Comprovante edge function:', e)
  }

  return result
}

async function gerarComprovantePonto(payload: {
  marcacaoId: string
  funcionarioId: string
  funcionarioNome: string
  comprovantePath: string
  marcacao: PontoMarcacao
  fotoPath: string
  assinaturaPath: string
  geo: GeoPosition
}) {
  const { error } = await supabase.functions.invoke('rep-gerar-comprovante', {
    body: payload,
  })
  if (error) throw error
}

export async function salvarJornada(
  funcionarioId: string,
  jornada: Omit<FuncionarioJornada, 'id' | 'funcionario_id' | 'criado_em' | 'atualizado_em'>,
): Promise<FuncionarioJornada> {
  const { data, error } = await supabase.rpc('movelaria_ponto_salvar_jornada', {
    p_funcionario_id: funcionarioId,
    p_hora_entrada: jornada.hora_entrada,
    p_hora_saida_intervalo: jornada.hora_saida_intervalo,
    p_hora_retorno_intervalo: jornada.hora_retorno_intervalo,
    p_hora_saida: jornada.hora_saida,
    p_tolerancia_minutos: jornada.tolerancia_minutos,
    p_dias_uteis: jornada.dias_uteis,
    p_ativo: jornada.ativo,
  })
  if (error) throw new Error(error.message)
  return data as FuncionarioJornada
}

export async function fetchJornada(funcionarioId: string): Promise<FuncionarioJornada | null> {
  const { data, error } = await supabase
    .from('movelaria_funcionario_jornada')
    .select('*')
    .eq('funcionario_id', funcionarioId)
    .maybeSingle()
  if (error) throw new Error(error.message)
  return data as FuncionarioJornada | null
}

export async function fetchMarcacoes(
  funcionarioId: string,
  de?: string,
  ate?: string,
): Promise<PontoMarcacao[]> {
  let q = supabase
    .from('movelaria_funcionario_ponto_marcacoes')
    .select('*')
    .eq('funcionario_id', funcionarioId)
    .order('registrado_em', { ascending: false })
  if (de) q = q.gte('registrado_em', de)
  if (ate) q = q.lte('registrado_em', ate)
  const { data, error } = await q
  if (error) throw new Error(error.message)
  return (data ?? []) as PontoMarcacao[]
}

export async function fetchOcorrencias(funcionarioId: string): Promise<PontoOcorrencia[]> {
  const { data, error } = await supabase
    .from('movelaria_funcionario_ponto_ocorrencias')
    .select('*')
    .eq('funcionario_id', funcionarioId)
    .order('data', { ascending: false })
  if (error) throw new Error(error.message)
  return (data ?? []) as PontoOcorrencia[]
}

export async function salvarOcorrencia(
  funcionarioId: string,
  data: string,
  tipo: PontoOcorrencia['tipo'],
  observacao?: string,
): Promise<PontoOcorrencia> {
  const { data: row, error } = await supabase.rpc('movelaria_ponto_salvar_ocorrencia', {
    p_funcionario_id: funcionarioId,
    p_data: data,
    p_tipo: tipo,
    p_observacao: observacao ?? null,
  })
  if (error) throw new Error(error.message)
  return row as PontoOcorrencia
}

export async function removerOcorrencia(id: string): Promise<void> {
  const { error } = await supabase.rpc('movelaria_ponto_remover_ocorrencia', { p_id: id })
  if (error) throw new Error(error.message)
}

export async function fetchRepConfig(): Promise<RepConfig | null> {
  const { data, error } = await supabase
    .from('movelaria_rep_config')
    .select('*')
    .eq('ativo', true)
    .maybeSingle()
  if (error) throw new Error(error.message)
  return data as RepConfig | null
}

export async function fetchRepArquivos(): Promise<RepArquivo[]> {
  const { data, error } = await supabase
    .from('movelaria_rep_arquivos')
    .select('*')
    .order('criado_em', { ascending: false })
    .limit(50)
  if (error) throw new Error(error.message)
  return (data ?? []) as RepArquivo[]
}

export async function fetchControlePontoDiario(data?: string): Promise<PontoControleFuncionarioRow[]> {
  const { data: rows, error } = await supabase.rpc('movelaria_ponto_controle_diario', {
    p_data: data ?? new Date().toISOString().slice(0, 10),
  })
  if (error) throw new Error(error.message)

  const list = (rows ?? []) as Omit<PontoControleFuncionarioRow, 'fotoUrl' | 'assinaturaUrl'>[]

  return Promise.all(
    list.map(async row => {
      const entrada = row.entrada
      let fotoUrl: string | undefined
      let assinaturaUrl: string | undefined
      if (entrada?.foto_path) {
        try { fotoUrl = await getFuncionarioDocSignedUrl(entrada.foto_path) } catch { /* */ }
      }
      if (entrada?.assinatura_path) {
        try { assinaturaUrl = await getFuncionarioDocSignedUrl(entrada.assinatura_path) } catch { /* */ }
      }
      return { ...row, fotoUrl, assinaturaUrl }
    }),
  )
}

export function googleMapsUrl(lat: number, lng: number): string {
  return `https://www.google.com/maps?q=${lat},${lng}`
}

export function formatHoraPonto(isoOrTime?: string | null): string {
  if (!isoOrTime) return '—'
  if (isoOrTime.includes('T')) {
    return new Date(isoOrTime).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  }
  return isoOrTime.slice(0, 5)
}
