import { supabase } from '@/lib/supabase'
import { FUNCIONARIO_DOCS_BUCKET, getFuncionarioDocSignedUrl } from '@/lib/funcionario-documentos'
import { createId } from '@/lib/utils'
import { PONTO_TIPO_LABEL } from '@/lib/funcionario-constants'
import type {
  FuncionarioJornada,
  PontoControleFuncionarioRow,
  PontoMarcacao,
  PontoMarcacaoComUrls,
  PontoMarcacaoTipo,
  PontoOcorrencia,
  PontoStatusDiaPayload,
  RepArquivo,
} from '@/types'

export const PONTO_TIPOS_ORDEM: PontoMarcacaoTipo[] = [
  'entrada',
  'saida_intervalo',
  'retorno_intervalo',
  'saida',
]

/** Mesmo fuso usado no banco (movelaria_ponto_data_local). */
export const PONTO_TIMEZONE = 'America/Sao_Paulo'

/** Data civil do ponto em São Paulo (YYYY-MM-DD), alinhada ao RPC do Supabase. */
export function pontoDataLocal(date: Date = new Date()): string {
  return date.toLocaleDateString('en-CA', { timeZone: PONTO_TIMEZONE })
}

export function formatDataPontoLocal(iso?: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('pt-BR', { timeZone: PONTO_TIMEZONE })
}

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

export async function fetchPontoStatusDia(
  funcionarioId?: string,
  data?: string,
): Promise<PontoStatusDiaPayload | null> {
  const { data: row, error } = await supabase.rpc('movelaria_ponto_status_dia', {
    p_funcionario_id: funcionarioId ?? null,
    p_data: data ?? pontoDataLocal(),
  })
  if (error) throw new Error(error.message)
  return row as PontoStatusDiaPayload | null
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

export { fetchRepConfig, salvarRepConfig } from '@/lib/rep-config'

export async function fetchRepArquivos(funcionarioId?: string): Promise<RepArquivo[]> {
  let q = supabase
    .from('movelaria_rep_arquivos')
    .select('*')
    .order('criado_em', { ascending: false })
    .limit(50)
  if (funcionarioId) q = q.eq('funcionario_id', funcionarioId)
  const { data, error } = await q
  if (error) throw new Error(error.message)
  return (data ?? []) as RepArquivo[]
}

export async function getRepArquivoSignedUrl(path: string): Promise<string> {
  return getFuncionarioDocSignedUrl(path)
}

export async function enrichMarcacaoUrls(
  marcacao: PontoMarcacao,
): Promise<PontoMarcacaoComUrls> {
  let fotoUrl: string | undefined
  let assinaturaUrl: string | undefined
  if (marcacao.foto_path) {
    try {
      fotoUrl = await getFuncionarioDocSignedUrl(marcacao.foto_path)
    } catch {
      /* signed URL indisponível */
    }
  }
  if (marcacao.assinatura_path) {
    try {
      assinaturaUrl = await getFuncionarioDocSignedUrl(marcacao.assinatura_path)
    } catch {
      /* signed URL indisponível */
    }
  }
  return { ...marcacao, fotoUrl, assinaturaUrl }
}

export async function fetchControlePontoDiario(data?: string): Promise<PontoControleFuncionarioRow[]> {
  const { data: rows, error } = await supabase.rpc('movelaria_ponto_controle_diario', {
    p_data: data ?? pontoDataLocal(),
  })
  if (error) throw new Error(error.message)

  const list = normalizeControleRows(rows)

  return Promise.all(
    list.map(async row => {
      const marcacoes = await Promise.all(
        (row.marcacoes ?? []).map(m => enrichMarcacaoUrls(m)),
      )
      const entrada = marcacoes.find(m => m.tipo === 'entrada') ?? row.entrada
      return {
        ...row,
        marcacoes,
        entrada,
        fotoUrl: entrada?.fotoUrl,
        assinaturaUrl: entrada?.assinaturaUrl,
      }
    }),
  )
}

function parseMarcacoes(raw: unknown): PontoMarcacao[] {
  if (!raw) return []
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw) as unknown
      return Array.isArray(parsed) ? (parsed as PontoMarcacao[]) : []
    } catch {
      return []
    }
  }
  return Array.isArray(raw) ? (raw as PontoMarcacao[]) : []
}

function normalizeControleRows(
  rows: unknown,
): Array<Omit<PontoControleFuncionarioRow, 'fotoUrl' | 'assinaturaUrl'> & { marcacoes: PontoMarcacao[] }> {
  if (!rows) return []
  const arr = Array.isArray(rows) ? rows : [rows]
  return arr.map(raw => {
    const row = raw as PontoControleFuncionarioRow
    return {
      ...row,
      marcacoes: parseMarcacoes(row.marcacoes),
      entrada: row.entrada ?? null,
    }
  })
}

/** Data civil da batida em São Paulo (YYYY-MM-DD). */
export function marcacaoDataLocal(m: PontoMarcacao): string {
  return pontoDataLocal(new Date(m.registrado_em))
}

export function filterMarcacoesNoPeriodo(
  marcacoes: PontoMarcacao[],
  de: string,
  ate: string,
): PontoMarcacao[] {
  return marcacoes.filter(m => {
    const d = marcacaoDataLocal(m)
    return d >= de && d <= ate
  })
}

function isoWeekdaySaoPaulo(isoDate: string): number {
  const wd = new Intl.DateTimeFormat('en-US', {
    timeZone: PONTO_TIMEZONE,
    weekday: 'short',
  }).format(new Date(`${isoDate}T12:00:00`))
  const map: Record<string, number> = {
    Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7,
  }
  return map[wd] ?? 1
}

/** Segunda a hoje (semana corrente em São Paulo). */
export function periodoSemanaCorrente(): { de: string; ate: string } {
  const ate = pontoDataLocal()
  const dow = isoWeekdaySaoPaulo(ate)
  const de = addDaysPonto(ate, -(dow - 1))
  return { de, ate }
}

/** Primeiro dia do mês até hoje (São Paulo). */
export function periodoMesCorrente(): { de: string; ate: string } {
  const ate = pontoDataLocal()
  const [y, m] = ate.split('-')
  return { de: `${y}-${m}-01`, ate }
}

function addDaysPonto(iso: string, days: number): string {
  const [y, mo, d] = iso.split('-').map(Number)
  const dt = new Date(Date.UTC(y, mo - 1, d))
  dt.setUTCDate(dt.getUTCDate() + days)
  return dt.toISOString().slice(0, 10)
}

export function googleMapsUrl(lat: number, lng: number): string {
  return `https://www.google.com/maps?q=${lat},${lng}`
}

export function formatHoraPonto(isoOrTime?: string | null): string {
  if (!isoOrTime) return '—'
  if (isoOrTime.includes('T')) {
    return new Date(isoOrTime).toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit',
      timeZone: PONTO_TIMEZONE,
    })
  }
  return isoOrTime.slice(0, 5)
}

/** Ex.: 985 → "16h 25min", 45 → "45 min", 120 → "2h" */
export function formatAtrasoMinutos(minutos: number): string {
  if (minutos <= 0) return '0 min'
  const horas = Math.floor(minutos / 60)
  const mins = minutos % 60
  if (horas === 0) return `${mins} min`
  if (mins === 0) return `${horas}h`
  return `${horas}h ${mins}min`
}

export type PontoJornadaHorarios = Pick<
  FuncionarioJornada,
  'hora_entrada' | 'hora_saida_intervalo' | 'hora_retorno_intervalo' | 'hora_saida'
>

export function horaPrevistaPorTipo(
  tipo: PontoMarcacaoTipo,
  jornada?: PontoJornadaHorarios | null,
): string | null {
  if (!jornada) return null
  switch (tipo) {
    case 'entrada':
      return jornada.hora_entrada ?? null
    case 'saida_intervalo':
      return jornada.hora_saida_intervalo ?? null
    case 'retorno_intervalo':
      return jornada.hora_retorno_intervalo ?? null
    case 'saida':
      return jornada.hora_saida ?? null
    default:
      return null
  }
}
