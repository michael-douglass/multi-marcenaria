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

/**
 * Uploads do orçamento: copia o arquivo no Storage.
 * Fotos da biblioteca / anexos do lead: reutiliza a mesma URL (mesma biblioteca).
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
 * pastas + fotos (mesma URL da biblioteca), markups, orçamentos e lousa.
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
  const markupIdMap = new Map<string, string>()
  const whiteboardImageMap = new Map<string, string>()

  // ── 1) Pastas da biblioteca do lead ──────────────────────────────────────
  try {
    const { data: pastas, error } = await db
      .from(mediasConfig.foldersTable)
      .select('id, nome, descricao')
      .eq('lead_id', origemLeadId)
      .order('nome', { ascending: true })
    if (error) throw error

    for (const pasta of pastas ?? []) {
      const { data: criada, error: createErr } = await db
        .from(mediasConfig.foldersTable)
        .insert({
          nome: pasta.nome,
          descricao: pasta.descricao ?? null,
          lead_id: novoLeadId,
        })
        .select('id')
        .single()
      if (createErr) throw createErr
      if (criada?.id) {
        folderMap.set(pasta.id as string, criada.id as string)
        result.pastas += 1
      }
    }
  } catch (err) {
    console.error('Duplicar lead — pastas:', err)
    avisos.push('Pastas da biblioteca não foram copiadas.')
  }

  // ── 2) Mídias: mesma file_url (não reenvia arquivo) ──────────────────────
  try {
    const { data: midias, error } = await db
      .from(mediasConfig.mediasTable)
      .select('id, titulo, tipo, file_url, file_name, file_size, mime_type, folder_id')
      .eq('lead_id', origemLeadId)
      .order('criado_em', { ascending: true })
    if (error) throw error

    for (const midia of midias ?? []) {
      const folderAntigo = (midia.folder_id as string | null) ?? null
      const folderNovo =
        folderAntigo && folderMap.has(folderAntigo)
          ? folderMap.get(folderAntigo)!
          : null

      const { data: criada, error: createErr } = await db
        .from(mediasConfig.mediasTable)
        .insert({
          titulo: midia.titulo,
          tipo: midia.tipo,
          file_url: midia.file_url,
          file_name: midia.file_name,
          file_size: midia.file_size ?? null,
          mime_type: midia.mime_type ?? null,
          folder_id: folderNovo,
          lead_id: novoLeadId,
        })
        .select('id')
        .single()
      if (createErr) throw createErr
      if (criada?.id) {
        mediaMap.set(midia.id as string, criada.id as string)
        result.midias += 1
      }
    }
  } catch (err) {
    console.error('Duplicar lead — mídias:', err)
    avisos.push('Fotos/anexos da biblioteca não foram vinculados à cópia.')
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

  // ── 4) Lousa (mesmas URLs de imagem) — antes dos orçamentos p/ remapar source_id
  try {
    const wb = resolveWhiteboardTables(schemaEmpresa)
    const { data: imagens, error: imgErr } = await db
      .from(wb.images)
      .select('id, file_url, file_name, position_x, position_y, width, height, z_index')
      .eq('lead_id', origemLeadId)
      .order('z_index', { ascending: true })
    if (imgErr) throw imgErr

    for (const img of imagens ?? []) {
      const { data: criada, error: createErr } = await db
        .from(wb.images)
        .insert({
          lead_id: novoLeadId,
          file_url: img.file_url,
          file_name: img.file_name,
          position_x: img.position_x,
          position_y: img.position_y,
          width: img.width,
          height: img.height,
          z_index: img.z_index,
        })
        .select('id')
        .single()
      if (createErr) throw createErr
      if (criada?.id) {
        whiteboardImageMap.set(img.id as string, criada.id as string)
        result.lousaImagens += 1
      }
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
        const linhas = await montarMidiasDuplicadas(midias, novo.id, (m) =>
          resolverUrlMidiaNoLeadDuplicado(m, novo.id, schema),
        )

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
  return `Também copiados: ${partes.join(', ')}. Fotos usam a mesma biblioteca (sem reenviar arquivo).`
}
