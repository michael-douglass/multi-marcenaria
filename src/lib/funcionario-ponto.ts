import { supabase } from '@/lib/supabase'
import { FUNCIONARIO_DOCS_BUCKET, getFuncionarioDocSignedUrl } from '@/lib/funcionario-documentos'
import { createId } from '@/lib/utils'
import { PONTO_TIPO_LABEL } from '@/lib/funcionario-constants'
import type {
  FuncionarioJornada,
  FuncionarioTipo,
  PontoControleFuncionarioRow,
  PontoMarcacao,
  PontoMarcacaoComUrls,
  PontoMarcacaoTipo,
  PontoOcorrencia,
  PontoResumoBatida,
  PontoResumoPeriodo,
  PontoResumoPeriodoPayload,
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

function readPositionOnce(
  options: PositionOptions,
  timeoutMs: number,
): Promise<GeoPosition> {
  return new Promise((resolve, reject) => {
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
      options,
    )
  })
}

/**
 * Pede a localização com tentativa rápida (GPS) e fallback mais leve.
 * Assim o fluxo de ponto não trava minutos em aparelhos lentos.
 */
export async function requestGeolocation(timeoutMs = 12000): Promise<GeoPosition> {
  if (!navigator.geolocation) {
    throw new Error('Seu dispositivo não suporta geolocalização.')
  }

  const quickTimeout = Math.min(8000, timeoutMs)
  try {
    return await readPositionOnce(
      { enableHighAccuracy: true, timeout: quickTimeout, maximumAge: 30_000 },
      quickTimeout + 500,
    )
  } catch {
    return readPositionOnce(
      { enableHighAccuracy: false, timeout: timeoutMs, maximumAge: 60_000 },
      timeoutMs + 500,
    )
  }
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
  if (de) q = q.gte('registrado_em', `${de}T00:00:00-03:00`)
  if (ate) q = q.lte('registrado_em', `${ate}T23:59:59.999-03:00`)
  const { data, error } = await q
  if (error) throw new Error(error.message)
  return (data ?? []) as PontoMarcacao[]
}

/** Horário usado na tela: ajustado pelo RH, ou o original. */
export function marcacaoHoraEfetiva(m: Pick<PontoMarcacao, 'registrado_em' | 'registrado_em_ajustado'>): string {
  return m.registrado_em_ajustado || m.registrado_em
}

export async function ajustarMarcacao(
  marcacaoId: string,
  hora: string,
  motivo: string,
): Promise<PontoMarcacao> {
  const { data, error } = await supabase.rpc('movelaria_ponto_ajustar_marcacao', {
    p_marcacao_id: marcacaoId,
    p_hora: hora.length === 5 ? `${hora}:00` : hora,
    p_motivo: motivo,
  })
  if (error) throw new Error(error.message)
  return data as PontoMarcacao
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

export async function fetchResumoPontoPeriodo(
  periodo: PontoResumoPeriodo = 'semana',
  referencia?: string | null,
): Promise<PontoResumoPeriodoPayload> {
  const { data, error } = await supabase.rpc('movelaria_ponto_resumo_periodo', {
    p_periodo: periodo,
    p_referencia: periodo === 'mes' && referencia ? referencia : null,
  })
  if (error) throw new Error(error.message)
  return normalizeResumoPeriodo(data, periodo)
}

function normalizeResumoPeriodo(
  raw: unknown,
  fallbackPeriodo: PontoResumoPeriodo,
): PontoResumoPeriodoPayload {
  const empty: PontoResumoPeriodoPayload = {
    periodo: fallbackPeriodo,
    inicio: pontoDataLocal(),
    fim: pontoDataLocal(),
    referencia: null,
    empresa: { hora_extra_minutos: 0, faltas_total: 0 },
    funcionarios: [],
  }
  if (!raw || typeof raw !== 'object') return empty

  const obj = raw as Record<string, unknown>
  const empresaRaw = (obj.empresa ?? {}) as Record<string, unknown>
  const funcsRaw = Array.isArray(obj.funcionarios) ? obj.funcionarios : []

  const periodo =
    obj.periodo === 'semana' || obj.periodo === 'mes' || obj.periodo === 'ano'
      ? obj.periodo
      : fallbackPeriodo

  return {
    periodo,
    inicio: typeof obj.inicio === 'string' ? obj.inicio : empty.inicio,
    fim: typeof obj.fim === 'string' ? obj.fim : empty.fim,
    referencia: typeof obj.referencia === 'string' ? obj.referencia : null,
    empresa: {
      hora_extra_minutos: Number(empresaRaw.hora_extra_minutos) || 0,
      faltas_total: Number(empresaRaw.faltas_total) || 0,
    },
    funcionarios: funcsRaw.map(item => {
      const f = item as Record<string, unknown>
      const chegadasRaw = Array.isArray(f.chegadas) ? f.chegadas : []
      const saidasRaw = Array.isArray(f.saidas) ? f.saidas : []
      const faltasDatasRaw = Array.isArray(f.faltas_datas) ? f.faltas_datas : []
      return {
        funcionario_id: String(f.funcionario_id ?? ''),
        nome: String(f.nome ?? ''),
        tipo: f.tipo as FuncionarioTipo,
        hora_extra_minutos: Number(f.hora_extra_minutos) || 0,
        faltas: Number(f.faltas) || 0,
        faltas_datas: faltasDatasRaw.map(d => String(d)),
        chegadas: chegadasRaw.map(c => normalizeResumoBatida(c, 'entrada')),
        saidas: saidasRaw.map(s => normalizeResumoBatida(s, 'saida')),
      }
    }),
  }
}

function normalizeResumoBatida(
  raw: unknown,
  fallbackTipo: PontoMarcacaoTipo,
): PontoResumoBatida {
  const batida = (raw ?? {}) as Record<string, unknown>
  const tipoRaw = String(batida.tipo ?? fallbackTipo)
  const tipoValido: PontoMarcacaoTipo =
    tipoRaw === 'entrada' ||
    tipoRaw === 'saida_intervalo' ||
    tipoRaw === 'retorno_intervalo' ||
    tipoRaw === 'saida'
      ? tipoRaw
      : fallbackTipo
  return {
    data: String(batida.data ?? ''),
    hora: String(batida.hora ?? ''),
    atraso_minutos: Number(batida.atraso_minutos) || 0,
    hora_extra_minutos: Number(batida.hora_extra_minutos) || 0,
    tipo: tipoValido,
  }
}

/** Formata minutos em texto legível: 75 → "1h 15min". */
export function formatMinutosHoraExtra(minutos: number): string {
  const total = Math.max(0, Math.floor(minutos))
  if (total === 0) return '0min'
  const h = Math.floor(total / 60)
  const m = total % 60
  if (h === 0) return `${m}min`
  if (m === 0) return `${h}h`
  return `${h}h ${m}min`
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

/** Converte "HH:MM", "HH:MM:SS" ou ISO datetime em minutos desde meia-noite (fuso SP). */
export function horaParaMinutosDoDia(isoOrTime?: string | null): number | null {
  if (!isoOrTime) return null
  if (isoOrTime.includes('T')) {
    const parts = new Intl.DateTimeFormat('en-GB', {
      timeZone: PONTO_TIMEZONE,
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).formatToParts(new Date(isoOrTime))
    const hour = Number(parts.find(p => p.type === 'hour')?.value)
    const minute = Number(parts.find(p => p.type === 'minute')?.value)
    if (!Number.isFinite(hour) || !Number.isFinite(minute)) return null
    return hour * 60 + minute
  }
  const match = /^(\d{1,2}):(\d{2})/.exec(isoOrTime.trim())
  if (!match) return null
  const hour = Number(match[1])
  const minute = Number(match[2])
  if (hour > 23 || minute > 59) return null
  return hour * 60 + minute
}

export type PontoSaldoDiaStatus = 'credito' | 'devendo' | 'em_dia' | 'parcial'

export interface PontoSaldoDia {
  /** Positivo = crédito; negativo = devendo; 0 = em dia */
  saldo_minutos: number
  minutos_previstos: number
  minutos_trabalhados: number
  status: PontoSaldoDiaStatus
  completo: boolean
}

/**
 * Compara a jornada prevista com as batidas reais do dia.
 * Precisa de entrada + saída para fechar o total; sem isso retorna null.
 */
export function calcularSaldoJornadaDia(
  marcacoes: Array<Pick<PontoMarcacao, 'tipo' | 'registrado_em' | 'registrado_em_ajustado'>>,
  jornada?: Partial<PontoJornadaHorarios> | null,
): PontoSaldoDia | null {
  if (!jornada) return null

  const prevEntrada = horaParaMinutosDoDia(jornada.hora_entrada)
  const prevSaida = horaParaMinutosDoDia(jornada.hora_saida)
  const prevSaidaAlmoco = horaParaMinutosDoDia(jornada.hora_saida_intervalo)
  const prevRetornoAlmoco = horaParaMinutosDoDia(jornada.hora_retorno_intervalo)
  if (prevEntrada == null || prevSaida == null) return null

  let almocoPrevisto = 0
  if (prevSaidaAlmoco != null && prevRetornoAlmoco != null && prevRetornoAlmoco > prevSaidaAlmoco) {
    almocoPrevisto = prevRetornoAlmoco - prevSaidaAlmoco
  }
  const minutosPrevistos = Math.max(0, prevSaida - prevEntrada - almocoPrevisto)

  const porTipo = new Map(marcacoes.map(m => [m.tipo, m]))
  const realEntrada = horaParaMinutosDoDia(porTipo.get('entrada') ? marcacaoHoraEfetiva(porTipo.get('entrada')!) : null)
  const realSaida = horaParaMinutosDoDia(porTipo.get('saida') ? marcacaoHoraEfetiva(porTipo.get('saida')!) : null)
  if (realEntrada == null || realSaida == null) return null

  const realSaidaAlmoco = horaParaMinutosDoDia(porTipo.get('saida_intervalo') ? marcacaoHoraEfetiva(porTipo.get('saida_intervalo')!) : null)
  const realRetornoAlmoco = horaParaMinutosDoDia(porTipo.get('retorno_intervalo') ? marcacaoHoraEfetiva(porTipo.get('retorno_intervalo')!) : null)
  let almocoReal = 0
  if (realSaidaAlmoco != null && realRetornoAlmoco != null && realRetornoAlmoco > realSaidaAlmoco) {
    almocoReal = realRetornoAlmoco - realSaidaAlmoco
  }

  const minutosTrabalhados = Math.max(0, realSaida - realEntrada - almocoReal)
  const saldo = minutosTrabalhados - minutosPrevistos
  const completo =
    porTipo.has('entrada') &&
    porTipo.has('saida_intervalo') &&
    porTipo.has('retorno_intervalo') &&
    porTipo.has('saida')

  let status: PontoSaldoDiaStatus = 'em_dia'
  if (saldo > 0) status = 'credito'
  else if (saldo < 0) status = 'devendo'
  else if (!completo) status = 'em_dia'

  return {
    saldo_minutos: saldo,
    minutos_previstos: minutosPrevistos,
    minutos_trabalhados: minutosTrabalhados,
    status,
    completo,
  }
}

/** Formata saldo absoluto: 75 → "1h 15min". */
export function formatMinutosSaldo(minutos: number): string {
  const total = Math.abs(Math.floor(minutos))
  if (total === 0) return '0min'
  const h = Math.floor(total / 60)
  const m = total % 60
  if (h === 0) return `${m}min`
  if (m === 0) return `${h}h`
  return `${h}h ${m}min`
}

/** Formata com sinal: +1h 15min / −42min / 0min. */
export function formatMinutosComSinal(minutos: number): string {
  const total = Math.floor(minutos)
  if (total === 0) return '0min'
  const sinal = total > 0 ? '+' : '−'
  return `${sinal}${formatMinutosSaldo(total)}`
}
