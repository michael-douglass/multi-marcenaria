import { supabase } from '@/integrations/supabase/client'
import {
  isSchemaApiExposed,
  PUBLIC_WHITEBOARD,
  resolveMarketingMediasConfig,
} from '@/lib/empresa-tables'
import {
  markupSchemaExtra,
  resolveMarkupTable,
} from '@/lib/markup-tables'
import {
  montarMidiasDuplicadas,
  montarPayloadOrcamentoDuplicado,
  pathDestinoCopiaMidia,
  pathStorageOrcamentoSlide,
} from '@/lib/orcamento-slide-duplicar'
import type {
  OrcamentoDados,
  OrcamentoSlide,
  OrcamentoSlideMidia,
} from '@/lib/orcamento-slide-types'

/** Cliente PostgREST da empresa (schema emp_* ou public). */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type EmpresaDb = { from: (table: string) => any }

const ORCAMENTO_STORAGE_BUCKET = 'orcamento-slides'
const MARKETING_STORAGE_BUCKET = 'marketing-medias'

export interface DuplicarLeadRelacionadosInput {
  db: EmpresaDb
  schemaEmpresa: string | null | undefined
  origemLeadId: number
  novoLeadId: number
  criadoPor: string
  /** Nome do cliente no orçamento-cópia (opcional). */
  clienteNome?: string | null
}

export interface DuplicarLeadRelacionadosResult {
  pastas: number
  midias: number
  markups: number
  orcamentos: number
  lousaImagens: number
  lousaDesenhos: number
  avisos: string[]
}

function resolveOrcamentoTable(schema: string | null | undefined) {
  return isSchemaApiExposed(schema) ? 'orcamento_slides' : 'CRM-multi-empresas>orcamento_slides<'
}

function resolveOrcamentoMidiasTable(schema: string | null | undefined) {
  return isSchemaApiExposed(schema)
    ? 'orcamento_slide_midias'
    : 'CRM-multi-empresas>orcamento_slide_midias<'
}

function resolveWhiteboardTables(schema: string | null | undefined) {
  if (isSchemaApiExposed(schema)) {
    return {
      images: 'lead_whiteboard_images',
      drawings: 'lead_whiteboard_drawings',
    }
  }
  return {
    images: PUBLIC_WHITEBOARD.images,
    drawings: PUBLIC_WHITEBOARD.drawings,
  }
}

function remapMarkupIdNosDados(
  dados: OrcamentoDados,
  markupIdMap: Map<string, string>,
): OrcamentoDados {
  const clone = structuredClone(dados) as OrcamentoDados
  const antigo = clone.precificacao?.markup_orcamento_id
  if (antigo && markupIdMap.has(antigo)) {
    clone.precificacao = {
      ...clone.precificacao,
      markup_orcamento_id: markupIdMap.get(antigo) ?? null,
    }
  }
  return clone
}

/** Extrai o path interno do bucket marketing-medias a partir da URL pública. */
function pathStorageMarketingMidia(fileUrl: string): string | null {
  try {
    const url = new URL(fileUrl)
    const marker = `/${MARKETING_STORAGE_BUCKET}/`
    const idx = url.pathname.indexOf(marker)
    if (idx < 0) return null
    return decodeURIComponent(url.pathname.slice(idx + marker.length))
  } catch {
    return null
  }
}

function extensaoArquivo(fileName: string | null | undefined, fallback = 'bin'): string {
  const raw = (fileName || '').split('.').pop()?.replace(/[^a-zA-Z0-9]/g, '')
  return raw && raw.length > 0 ? raw.toLowerCase() : fallback
}

function pathDestinoAnexoLead(params: {
  schema: string | null | undefined
  fileName: string | null | undefined
}): string {
  const prefix = params.schema ?? 'master'
  const ext = extensaoArquivo(params.fileName, 'bin')
  const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
  return `${prefix}/${stamp}.${ext}`
}

function pathDestinoLousaLead(params: {
  leadId: number
  fileName: string | null | undefined
}): string {
  const ext = extensaoArquivo(params.fileName, 'jpg')
  const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
  return `leads/${params.leadId}/${stamp}.${ext}`
}

/**
 * Copia o arquivo no Storage para o lead duplicado.
 * Se a cópia falhar, tenta baixar + reenviar; se ainda falhar, mantém a URL original.
 */
async function copiarArquivoMarketingMidia(params: {
  fileUrl: string
  pathDestino: string
}): Promise<string> {
  const pathOrigem = pathStorageMarketingMidia(params.fileUrl)
  if (!pathOrigem) return params.fileUrl
  if (pathOrigem === params.pathDestino) return params.fileUrl

  const { error: copyErr } = await supabase.storage
    .from(MARKETING_STORAGE_BUCKET)
    .copy(pathOrigem, params.pathDestino)

  if (!copyErr) {
    const { data } = supabase.storage.from(MARKETING_STORAGE_BUCKET).getPublicUrl(params.pathDestino)
    return data.publicUrl
  }

  const { data: blob, error: downErr } = await supabase.storage
    .from(MARKETING_STORAGE_BUCKET)
    .download(pathOrigem)
  if (downErr || !blob) {
    console.warn('Duplicar lead — não foi possível baixar mídia:', pathOrigem, downErr)
    return params.fileUrl
  }

  const { error: upErr } = await supabase.storage
    .from(MARKETING_STORAGE_BUCKET)
    .upload(params.pathDestino, blob, { upsert: true })
  if (upErr) {
    console.warn('Duplicar lead — não foi possível reenviar mídia:', params.pathDestino, upErr)
    return params.fileUrl
  }

  const { data } = supabase.storage.from(MARKETING_STORAGE_BUCKET).getPublicUrl(params.pathDestino)
  return data.publicUrl
}

/**
 * Uploads do orçamento: copia o arquivo no Storage.
 * Fotos da biblioteca / anexos do lead: já foram duplicadas em marketing-medias;
 * aqui só reutiliza a URL remapeada via source_id.
 */
async function resolverUrlMidiaNoLeadDuplicado(
  midia: OrcamentoSlideMidia,
  novoOrcamentoId: string,
  schema: string,
): Promise<string> {
  if (midia.origem !== 'upload') return midia.file_url

  const pathOrigem = pathStorageOrcamentoSlide(midia.file_url)
  if (!pathOrigem) return midia.file_url

  const pathDestino = pathDestinoCopiaMidia({
    schema,
    orcamentoId: novoOrcamentoId,
    tipo: midia.tipo,
    fileName: midia.file_name || pathOrigem.split('/').pop() || 'arquivo.bin',
  })

  const { error: copyErr } = await supabase.storage
    .from(ORCAMENTO_STORAGE_BUCKET)
    .copy(pathOrigem, pathDestino)

  if (!copyErr) {
    const { data } = supabase.storage.from(ORCAMENTO_STORAGE_BUCKET).getPublicUrl(pathDestino)
    return data.publicUrl
  }

  const { data: blob, error: downErr } = await supabase.storage
    .from(ORCAMENTO_STORAGE_BUCKET)
    .download(pathOrigem)
  if (downErr || !blob) return midia.file_url

  const { error: upErr } = await supabase.storage
    .from(ORCAMENTO_STORAGE_BUCKET)
    .upload(pathDestino, blob, { upsert: true })
  if (upErr) return midia.file_url

  const { data } = supabase.storage.from(ORCAMENTO_STORAGE_BUCKET).getPublicUrl(pathDestino)
  return data.publicUrl
}

function remapSourceId(
  sourceId: string | null,
  mediaMap: Map<string, string>,
  whiteboardMap: Map<string, string>,
): string | null {
  if (!sourceId) return null
  return mediaMap.get(sourceId) ?? whiteboardMap.get(sourceId) ?? sourceId
}

/**
 * Copia o que fica “dentro” do lead após o card base já ter sido criado:
 * pastas + fotos (arquivo duplicado no Storage), markups, orçamentos e lousa.
 */
export async function duplicarLeadRelacionados(
  input: DuplicarLeadRelacionadosInput,
): Promise<DuplicarLeadRelacionadosResult> {
  const { db, schemaEmpresa, origemLeadId, novoLeadId, criadoPor, clienteNome } = input
  const avisos: string[] = []
  const result: DuplicarLeadRelacionadosResult = {
    pastas: 0,
    midias: 0,
    markups: 0,
    orcamentos: 0,
    lousaImagens: 0,
    lousaDesenhos: 0,
    avisos,
  }

  const mediasConfig = resolveMarketingMediasConfig(schemaEmpresa)
  const folderMap = new Map<string, string>()
  const mediaMap = new Map<string, string>()
  /** URL nova do arquivo (após cópia no Storage), indexada pelo id antigo. */
  const mediaUrlMap = new Map<string, string>()
  const markupIdMap = new Map<string, string>()
  const whiteboardImageMap = new Map<string, string>()
  const whiteboardUrlMap = new Map<string, string>()

  // ── 1) Pastas da biblioteca do lead ──────────────────────────────────────
  try {
    const { data: pastas, error } = await db
      .from(mediasConfig.foldersTable)
      .select('id, nome, descricao, fixado, ordem_topo')
      .eq('lead_id', origemLeadId)
      .order('nome', { ascending: true })
    if (error) throw error

    let pastasFalharam = 0
    for (const pasta of pastas ?? []) {
      try {
        const { data: criada, error: createErr } = await db
          .from(mediasConfig.foldersTable)
          .insert({
            nome: pasta.nome,
            descricao: pasta.descricao ?? null,
            lead_id: novoLeadId,
            fixado: pasta.fixado ?? false,
            ordem_topo: pasta.ordem_topo ?? 0,
          })
          .select('id')
          .single()
        if (createErr) throw createErr
        if (criada?.id) {
          folderMap.set(pasta.id as string, criada.id as string)
          result.pastas += 1
        }
      } catch (pastaErr) {
        pastasFalharam += 1
        console.error('Duplicar lead — pasta individual:', pastaErr)
      }
    }
    if (pastasFalharam > 0) {
      avisos.push(`${pastasFalharam} pasta(s) não puderam ser copiadas.`)
    }
  } catch (err) {
    console.error('Duplicar lead — pastas:', err)
    avisos.push('Pastas da biblioteca não foram copiadas.')
  }

  // ── 2) Mídias: copia o arquivo no Storage + novo registro ─────────────────
  try {
    const { data: midias, error } = await db
      .from(mediasConfig.mediasTable)
      .select(
        'id, titulo, tipo, file_url, file_name, file_size, mime_type, folder_id, fixado, ordem_topo',
      )
      .eq('lead_id', origemLeadId)
      .order('criado_em', { ascending: true })
    if (error) throw error

    const totalOrigem = (midias ?? []).length
    let midiasFalharam = 0

    for (const midia of midias ?? []) {
      try {
        const folderAntigo = (midia.folder_id as string | null) ?? null
        const folderNovo =
          folderAntigo && folderMap.has(folderAntigo)
            ? folderMap.get(folderAntigo)!
            : null

        const fileUrlNova = await copiarArquivoMarketingMidia({
          fileUrl: midia.file_url as string,
          pathDestino: pathDestinoAnexoLead({
            schema: mediasConfig.schema ?? schemaEmpresa,
            fileName: midia.file_name as string,
          }),
        })

        const { data: criada, error: createErr } = await db
          .from(mediasConfig.mediasTable)
          .insert({
            titulo: midia.titulo || midia.file_name || 'Arquivo',
            tipo: midia.tipo,
            file_url: fileUrlNova,
            file_name: midia.file_name,
            file_size: midia.file_size ?? null,
            mime_type: midia.mime_type ?? null,
            folder_id: folderNovo,
            lead_id: novoLeadId,
            fixado: midia.fixado ?? false,
            ordem_topo: midia.ordem_topo ?? 0,
          })
          .select('id')
          .single()
        if (createErr) throw createErr
        if (criada?.id) {
          mediaMap.set(midia.id as string, criada.id as string)
          mediaUrlMap.set(midia.id as string, fileUrlNova)
          result.midias += 1
        }
      } catch (midiaErr) {
        midiasFalharam += 1
        console.error('Duplicar lead — mídia individual:', midiaErr)
      }
    }

    if (midiasFalharam > 0) {
      avisos.push(
        `${midiasFalharam} de ${totalOrigem} foto(s)/anexo(s) não puderam ser duplicados.`,
      )
    }
  } catch (err) {
    console.error('Duplicar lead — mídias:', err)
    avisos.push('Fotos/anexos da biblioteca não foram duplicados.')
  }

  // ── 3) Markups ───────────────────────────────────────────────────────────
  try {
    const markupTable = resolveMarkupTable(schemaEmpresa, 'orcamentos')
    const { data: markups, error } = await db
      .from(markupTable)
      .select('*')
      .eq('lead_id', origemLeadId)
      .order('atualizado_em', { ascending: false })
    if (error) throw error

    for (const origem of markups ?? []) {
      const { data: criado, error: createErr } = await db
        .from(markupTable)
        .insert({
          lead_id: novoLeadId,
          titulo: origem.titulo ?? 'Markup',
          status: origem.status ?? 'rascunho',
          modulos: origem.modulos,
          preco_final: origem.preco_final ?? 0,
          observacoes_rodape: origem.observacoes_rodape ?? '',
          criado_por: criadoPor || null,
          ...markupSchemaExtra(schemaEmpresa),
        })
        .select('id')
        .single()
      if (createErr) throw createErr
      if (criado?.id && origem.id) {
        markupIdMap.set(origem.id as string, criado.id as string)
        result.markups += 1
      }
    }
  } catch (err) {
    console.error('Duplicar lead — markup:', err)
    avisos.push('Markups não foram copiados.')
  }

  // ── 4) Lousa — arquivos duplicados no Storage ────────────────────────────
  try {
    const wb = resolveWhiteboardTables(schemaEmpresa)
    const { data: imagens, error: imgErr } = await db
      .from(wb.images)
      .select('id, file_url, file_name, position_x, position_y, width, height, z_index, observacao')
      .eq('lead_id', origemLeadId)
      .order('z_index', { ascending: true })
    if (imgErr) throw imgErr

    const totalLousa = (imagens ?? []).length
    let lousaFalharam = 0

    for (const img of imagens ?? []) {
      try {
        const fileUrlNova = await copiarArquivoMarketingMidia({
          fileUrl: img.file_url as string,
          pathDestino: pathDestinoLousaLead({
            leadId: novoLeadId,
            fileName: img.file_name as string,
          }),
        })

        const { data: criada, error: createErr } = await db
          .from(wb.images)
          .insert({
            lead_id: novoLeadId,
            file_url: fileUrlNova,
            file_name: img.file_name,
            position_x: img.position_x,
            position_y: img.position_y,
            width: img.width,
            height: img.height,
            z_index: img.z_index,
            observacao: img.observacao ?? null,
          })
          .select('id')
          .single()
        if (createErr) throw createErr
        if (criada?.id) {
          whiteboardImageMap.set(img.id as string, criada.id as string)
          whiteboardUrlMap.set(img.id as string, fileUrlNova)
          result.lousaImagens += 1
        }
      } catch (imgItemErr) {
        lousaFalharam += 1
        console.error('Duplicar lead — imagem da lousa:', imgItemErr)
      }
    }

    if (lousaFalharam > 0) {
      avisos.push(`${lousaFalharam} de ${totalLousa} foto(s) da lousa não puderam ser duplicadas.`)
    }

    const { data: desenhos, error: drawErr } = await db
      .from(wb.drawings)
      .select('path_data, cor, stroke_width')
      .eq('lead_id', origemLeadId)
      .order('criado_em', { ascending: true })
    if (drawErr) throw drawErr

    if ((desenhos ?? []).length > 0) {
      const { error: insertDrawErr } = await db.from(wb.drawings).insert(
        (desenhos ?? []).map((d: { path_data: string; cor: string; stroke_width: number }) => ({
          lead_id: novoLeadId,
          path_data: d.path_data,
          cor: d.cor,
          stroke_width: d.stroke_width,
        })),
      )
      if (insertDrawErr) throw insertDrawErr
      result.lousaDesenhos = (desenhos ?? []).length
    }
  } catch (err) {
    console.error('Duplicar lead — lousa:', err)
    avisos.push('Lousa não foi copiada.')
  }

  // ── 5) Orçamentos (slides) + mídias ──────────────────────────────────────
  try {
    const orcTable = resolveOrcamentoTable(schemaEmpresa)
    const midiasTable = resolveOrcamentoMidiasTable(schemaEmpresa)
    const schema = schemaEmpresa ?? 'public'

    const { data: orcamentos, error } = await db
      .from(orcTable)
      .select('*')
      .eq('lead_id', origemLeadId)
      .order('atualizado_em', { ascending: false })
    if (error) throw error

    for (const row of orcamentos ?? []) {
      const origem = row as OrcamentoSlide
      const payload = montarPayloadOrcamentoDuplicado(origem)
      payload.lead_id = novoLeadId
      if (clienteNome?.trim()) payload.cliente_nome = clienteNome.trim()
      payload.dados = remapMarkupIdNosDados(payload.dados, markupIdMap)

      const { data: criado, error: createErr } = await db
        .from(orcTable)
        .insert({
          ...payload,
          criado_por: criadoPor || null,
          ...(isSchemaApiExposed(schemaEmpresa) ? {} : { schema_nome: schemaEmpresa }),
        })
        .select()
        .single()
      if (createErr) throw createErr

      const novo = criado as OrcamentoSlide

      const { data: midiasOrigem, error: midiasErr } = await db
        .from(midiasTable)
        .select('*')
        .eq('orcamento_id', origem.id)
        .order('ordem', { ascending: true })
      if (midiasErr) throw midiasErr

      const midias = (midiasOrigem ?? []) as OrcamentoSlideMidia[]
      if (midias.length > 0) {
        const linhas = await montarMidiasDuplicadas(midias, novo.id, async (m) => {
          // Anexos/lousa já copiados: usa a URL nova do arquivo do lead duplicado.
          if (m.source_id && mediaUrlMap.has(m.source_id)) {
            return mediaUrlMap.get(m.source_id)!
          }
          if (m.source_id && whiteboardUrlMap.has(m.source_id)) {
            return whiteboardUrlMap.get(m.source_id)!
          }
          return resolverUrlMidiaNoLeadDuplicado(m, novo.id, schema)
        })

        const { error: insertMidiasErr } = await db.from(midiasTable).insert(
          linhas.map((linha) => ({
            ...linha,
            source_id: remapSourceId(linha.source_id, mediaMap, whiteboardImageMap),
            ...(isSchemaApiExposed(schemaEmpresa) ? {} : { schema_nome: schemaEmpresa }),
          })),
        )
        if (insertMidiasErr) {
          await db.from(orcTable).delete().eq('id', novo.id)
          throw insertMidiasErr
        }
      }

      result.orcamentos += 1
    }
  } catch (err) {
    console.error('Duplicar lead — orçamentos:', err)
    avisos.push('Orçamentos (slides) não foram copiados por completo.')
  }

  return result
}

/** Texto curto para o toast de sucesso. */
export function resumirDuplicacaoLead(r: DuplicarLeadRelacionadosResult): string {
  const partes: string[] = []
  if (r.midias > 0) partes.push(`${r.midias} foto(s)/anexo(s)`)
  if (r.markups > 0) partes.push(`${r.markups} markup(s)`)
  if (r.orcamentos > 0) partes.push(`${r.orcamentos} orçamento(s)`)
  if (r.lousaImagens > 0 || r.lousaDesenhos > 0) partes.push('lousa')
  if (partes.length === 0) return 'Dados básicos copiados.'
  return `Também copiados: ${partes.join(', ')}. As fotos foram duplicadas (arquivos próprios na cópia).`
}
