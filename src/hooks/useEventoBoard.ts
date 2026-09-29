import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { SupabaseClient } from '@supabase/supabase-js'
import { toast } from 'sonner'
import { useAuth } from '@/contexts/AuthContext'
import { useEmpresa } from '@/contexts/EmpresaContext'
import { supabase } from '@/integrations/supabase/client'
import { resolveLeadsQueryConfig } from '@/lib/empresa-tables'
import {
  EVENTO_STORAGE_BUCKET,
  eventoStoragePath,
  getEventosDb,
  resolveEventosTables,
} from '@/lib/evento-db'
import { arredondarEvento, normalizarNomeCatalogo } from '@/lib/evento-helpers'
import {
  parseEventoCaderno,
  parseEventoCatalogo,
  parseEventoItem,
  parseEventoMidia,
  parseEventoPagina,
  parseEventoParticipante,
  parseEventoPasta,
  parseEventoTarefa,
} from '@/lib/evento-parse'
import type {
  EventoBoard,
  EventoCatalogoItem,
  EventoDesenho,
  EventoUnidade,
} from '@/lib/evento-types'
import { formatInternationalPhone, getTodaySaoPaulo } from '@/lib/utils'
import { WHITEBOARD_MAX_IMAGE_BYTES } from '@/lib/whiteboard-image-upload'

export interface EventoParticipanteInput {
  nome: string
  lead_id?: number | null
  telefone?: string | null
  email?: string | null
}

interface LeadContato {
  nome: string
  telefone: string | null
  email: string | null
}

function leadsClient(schema: string | null) {
  const config = resolveLeadsQueryConfig(schema)
  const db = (config.schema ? supabase.schema(config.schema) : supabase) as unknown as SupabaseClient
  return { db, table: config.leadsTable }
}

async function fetchLeadContatos(schema: string | null, leadIds: number[]): Promise<Map<number, LeadContato>> {
  const map = new Map<number, LeadContato>()
  const unique = [...new Set(leadIds.filter((id) => Number.isFinite(id) && id > 0))]
  if (unique.length === 0) return map
  const { db, table } = leadsClient(schema)
  const { data, error } = await db.from(table).select('id, nome, email, telefone').in('id', unique)
  if (error) throw error
  for (const row of data ?? []) {
    const id = Number((row as { id?: number }).id)
    if (!Number.isFinite(id)) continue
    const email = typeof (row as { email?: string | null }).email === 'string' ? (row as { email: string }).email.trim() : ''
    const telefone = typeof (row as { telefone?: string | null }).telefone === 'string' ? (row as { telefone: string }).telefone.trim() : ''
    map.set(id, {
      nome: String((row as { nome?: string }).nome ?? ''),
      email: email || null,
      telefone: telefone ? formatInternationalPhone(telefone) : null,
    })
  }
  return map
}

function emailValido(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
}

export interface EventoItemInput {
  nome: string
  quantidade: number
  unidade: EventoUnidade
  preco_unitario: number
  fornecedor?: string | null
  telefone_fornecedor?: string | null
}

export function useEventoBoard(eventoId: string | undefined) {
  const { empresa } = useEmpresa()
  const { user } = useAuth()
  const qc = useQueryClient()
  const schema = empresa?.schema_nome ?? null
  const tables = resolveEventosTables(schema)
  const db = getEventosDb(schema)
  const queryKey = ['evento-board', 'v2-cadernos', schema, eventoId] as const

  const query = useQuery({
    queryKey,
    enabled: Boolean(schema && eventoId),
    queryFn: async (): Promise<EventoBoard> => {
      const { data: eventoRaw, error: eventoError } = await db
        .from(tables.eventos)
        .select('*')
        .eq('id', eventoId)
        .maybeSingle()
      if (eventoError) throw eventoError
      const evento = parseEventoPasta(eventoRaw)
      if (!evento) throw new Error('Pasta não encontrada')

      const [partRes, itemRes, cadRes, pagRes, tarRes] = await Promise.all([
        db.from(tables.participantes).select('*').eq('evento_id', eventoId).order('ordem').order('criado_em'),
        db.from(tables.itens).select('*').eq('evento_id', eventoId).order('ordem').order('criado_em'),
        db.from(tables.cadernos).select('*').eq('evento_id', eventoId).order('ordem').order('criado_em'),
        db.from(tables.paginas).select('*').eq('evento_id', eventoId).order('ordem').order('criado_em'),
        db.from(tables.tarefas).select('*').eq('evento_id', eventoId).order('ordem').order('criado_em'),
      ])
      if (partRes.error) throw partRes.error
      if (itemRes.error) throw itemRes.error
      if (pagRes.error) throw pagRes.error
      if (tarRes.error) throw tarRes.error
      // Cadernos é tabela nova: se a API ainda não enxergar, segue vazio (não derruba o board).
      const cadernosRows = cadRes.error ? [] : (cadRes.data ?? [])

      const participantes = (partRes.data ?? [])
        .map(parseEventoParticipante)
        .filter((p): p is NonNullable<typeof p> => p != null)

      const leadIds = participantes.map((p) => p.lead_id).filter((id): id is number => id != null)
      let contatos = new Map<number, LeadContato>()
      try {
        contatos = await fetchLeadContatos(schema, leadIds)
      } catch {
        contatos = new Map()
      }

      const itens = (itemRes.data ?? []).map(parseEventoItem).filter((p): p is NonNullable<typeof p> => p != null)

      const partIds = participantes.map((p) => p.id)
      const itemIds = itens.map((p) => p.id)
      const [partMidias, itemMidias, galeriaMidias] = await Promise.all([
        partIds.length
          ? db.from(tables.participanteMidias).select('*').in('participante_id', partIds).order('ordem')
          : Promise.resolve({ data: [], error: null }),
        itemIds.length
          ? db.from(tables.itemMidias).select('*').in('item_id', itemIds).order('ordem')
          : Promise.resolve({ data: [], error: null }),
        db.from(tables.eventoMidias).select('*').eq('evento_id', eventoId).order('ordem').order('criado_em'),
      ])
      if (partMidias.error) throw partMidias.error
      if (itemMidias.error) throw itemMidias.error
      // Galeria é nova: se a tabela ainda não existir neste schema, segue com lista vazia.
      const galeriaRows = galeriaMidias.error ? [] : (galeriaMidias.data ?? [])

      const midiasPart = new Map<string, NonNullable<ReturnType<typeof parseEventoMidia>>[]>()
      for (const raw of partMidias.data ?? []) {
        const midia = parseEventoMidia(raw)
        const ownerId = String((raw as { participante_id?: string }).participante_id ?? '')
        if (!midia || !ownerId) continue
        const list = midiasPart.get(ownerId) ?? []
        list.push(midia)
        midiasPart.set(ownerId, list)
      }
      const midiasItem = new Map<string, NonNullable<ReturnType<typeof parseEventoMidia>>[]>()
      for (const raw of itemMidias.data ?? []) {
        const midia = parseEventoMidia(raw)
        const ownerId = String((raw as { item_id?: string }).item_id ?? '')
        if (!midia || !ownerId) continue
        const list = midiasItem.get(ownerId) ?? []
        list.push(midia)
        midiasItem.set(ownerId, list)
      }

      return {
        evento,
        participantes: participantes.map((p) => {
          const contato = p.lead_id != null ? contatos.get(p.lead_id) : undefined
          return {
            ...p,
            telefone: contato?.telefone ?? p.telefone,
            email: contato?.email ?? p.email,
            midias: (midiasPart.get(p.id) ?? []).filter((m): m is NonNullable<typeof m> => m != null),
          }
        }),
        itens: itens.map((p) => ({
          ...p,
          midias: (midiasItem.get(p.id) ?? []).filter((m): m is NonNullable<typeof m> => m != null),
        })),
        cadernos: cadernosRows.map(parseEventoCaderno).filter((p): p is NonNullable<typeof p> => p != null),
        paginas: (pagRes.data ?? []).map(parseEventoPagina).filter((p): p is NonNullable<typeof p> => p != null),
        tarefas: (tarRes.data ?? []).map(parseEventoTarefa).filter((p): p is NonNullable<typeof p> => p != null),
        galeria: galeriaRows
          .map(parseEventoMidia)
          .filter((m): m is NonNullable<typeof m> => m != null),
      }
    },
  })

  const catalogoQuery = useQuery({
    queryKey: ['evento-catalogo', schema],
    enabled: Boolean(schema),
    queryFn: async (): Promise<EventoCatalogoItem[]> => {
      const { data, error } = await db.from(tables.catalogo).select('*').order('nome')
      if (error) throw error
      return (data ?? []).map(parseEventoCatalogo).filter((p): p is EventoCatalogoItem => p != null)
    },
  })

  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: ['evento-board'] })
    void qc.invalidateQueries({ queryKey: ['controle-eventos'] })
    void qc.invalidateQueries({ queryKey: ['evento-catalogo'] })
    void qc.invalidateQueries({ queryKey: ['evento-tarefas'] })
    void qc.invalidateQueries({ queryKey: ['leads'] })
  }

  const upsertCatalogo = async (input: EventoItemInput) => {
    const nome_normalizado = normalizarNomeCatalogo(input.nome)
    if (!nome_normalizado) return null
    const { data, error } = await db
      .from(tables.catalogo)
      .upsert(
        {
          nome: input.nome.trim(),
          nome_normalizado,
          preco_unitario: arredondarEvento(input.preco_unitario),
          unidade_padrao: input.unidade,
          fornecedor: input.fornecedor?.trim() || null,
          telefone_fornecedor: input.telefone_fornecedor?.trim() || null,
          atualizado_em: new Date().toISOString(),
        },
        { onConflict: 'nome_normalizado' },
      )
      .select('id')
      .single()
    if (error) throw error
    return typeof data?.id === 'string' ? data.id : null
  }

  const salvarParticipante = useMutation({
    mutationFn: async ({ id, ...input }: EventoParticipanteInput & { id?: string }) => {
      if (!eventoId) throw new Error('Pasta não encontrada')
      const nome = input.nome.trim()
      if (!nome) throw new Error('Digite o nome da pessoa')
      const telefone = formatInternationalPhone(input.telefone ?? '') || null
      const email = input.email?.trim() || null
      if (email && !emailValido(email)) throw new Error('Confira o e-mail')

      let leadId = input.lead_id ?? null
      const { db: leadsDb, table: leadsTable } = leadsClient(schema)
      if (leadId) {
        const { error: leadError } = await leadsDb
          .from(leadsTable)
          .update({ nome, telefone, email, atualizado_em: new Date().toISOString() })
          .eq('id', leadId)
        if (leadError) throw leadError
      } else {
        const { data: created, error: createError } = await leadsDb
          .from(leadsTable)
          .insert({
            nome,
            email,
            telefone,
            origem: 'Controle de Eventos',
            status: 'Novo Lead',
            valor_negocio: 0,
            valor_orcamento: 0,
            data_chegada: getTodaySaoPaulo(),
            vendedor_responsavel_id: user?.id ?? null,
          })
          .select('id')
          .single()
        if (createError) throw createError
        const createdId = Number((created as { id?: number } | null)?.id)
        if (!Number.isFinite(createdId)) throw new Error('Não deu para criar o lead')
        leadId = createdId
      }

      if (id) {
        const { error } = await db
          .from(tables.participantes)
          .update({ nome, lead_id: leadId })
          .eq('id', id)
        if (error) throw error
        return id
      }
      const ordem = (query.data?.participantes ?? []).length
      const { data, error } = await db
        .from(tables.participantes)
        .insert({ evento_id: eventoId, nome, lead_id: leadId, ordem })
        .select('id')
        .single()
      if (error) throw error
      return String(data.id)
    },
    onSuccess: invalidate,
    onError: (error: Error) => toast.error('Não deu para salvar a pessoa', { description: error.message }),
  })

  const excluirParticipante = useMutation({
    mutationFn: async (id: string) => {
      const { data: midias } = await db.from(tables.participanteMidias).select('storage_path').eq('participante_id', id)
      const { error } = await db.from(tables.participantes).delete().eq('id', id)
      if (error) throw error
      const paths = (midias ?? [])
        .map((row) => (row as { storage_path?: string | null }).storage_path)
        .filter((path): path is string => Boolean(path))
      if (paths.length) await supabase.storage.from(EVENTO_STORAGE_BUCKET).remove(paths)
    },
    onSuccess: invalidate,
    onError: (error: Error) => toast.error('Não deu para excluir a pessoa', { description: error.message }),
  })

  const salvarItem = useMutation({
    mutationFn: async ({ id, ...input }: EventoItemInput & { id?: string }) => {
      if (!eventoId) throw new Error('Pasta não encontrada')
      const nome = input.nome.trim()
      if (!nome) throw new Error('Dê um nome ao item')
      const catalogo_item_id = await upsertCatalogo(input)
      const payload = {
        nome,
        quantidade: Number(input.quantidade) || 1,
        unidade: input.unidade,
        preco_unitario: arredondarEvento(input.preco_unitario),
        fornecedor: input.fornecedor?.trim() || null,
        telefone_fornecedor: input.telefone_fornecedor?.trim() || null,
        catalogo_item_id,
        atualizado_em: new Date().toISOString(),
      }
      if (id) {
        const { error } = await db.from(tables.itens).update(payload).eq('id', id)
        if (error) throw error
        return id
      }
      const ordem = (query.data?.itens ?? []).length
      const { data, error } = await db
        .from(tables.itens)
        .insert({ ...payload, evento_id: eventoId, ordem })
        .select('id')
        .single()
      if (error) throw error
      return String(data.id)
    },
    onSuccess: () => {
      invalidate()
      toast.success('Item salvo — o preço fica na memória da casa')
    },
    onError: (error: Error) => toast.error('Não deu para salvar o item', { description: error.message }),
  })

  const excluirItem = useMutation({
    mutationFn: async (id: string) => {
      const { data: midias } = await db.from(tables.itemMidias).select('storage_path').eq('item_id', id)
      const { error } = await db.from(tables.itens).delete().eq('id', id)
      if (error) throw error
      const paths = (midias ?? [])
        .map((row) => (row as { storage_path?: string | null }).storage_path)
        .filter((path): path is string => Boolean(path))
      if (paths.length) await supabase.storage.from(EVENTO_STORAGE_BUCKET).remove(paths)
    },
    onSuccess: invalidate,
    onError: (error: Error) => toast.error('Não deu para excluir o item', { description: error.message }),
  })

  const salvarPagina = useMutation({
    mutationFn: async ({ id, titulo, corpo }: { id: string; titulo: string; corpo: string }) => {
      const { error } = await db
        .from(tables.paginas)
        .update({ titulo, corpo, atualizado_em: new Date().toISOString() })
        .eq('id', id)
      if (error) throw error
    },
  })

  const criarFolha = useMutation({
    mutationFn: async (cadernoId: string) => {
      if (!eventoId) throw new Error('Pasta não encontrada')
      const folhas = (query.data?.paginas ?? []).filter((p) => p.caderno_id === cadernoId)
      const ordem = folhas.reduce((acc, p) => Math.max(acc, p.ordem), -1) + 1
      const { error } = await db.from(tables.paginas).insert({
        evento_id: eventoId,
        caderno_id: cadernoId,
        secao: 'livre',
        titulo: '',
        corpo: '',
        ordem,
      })
      if (error) throw error
    },
    onSuccess: invalidate,
    onError: (error: Error) => toast.error('Não deu para criar a folha', { description: error.message }),
  })

  const excluirFolha = useMutation({
    mutationFn: async ({ id, cadernoId }: { id: string; cadernoId: string }) => {
      const folhas = (query.data?.paginas ?? []).filter((p) => p.caderno_id === cadernoId)
      if (folhas.length <= 1) throw new Error('Deixe pelo menos uma folha neste caderno')
      const { error } = await db.from(tables.paginas).delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: invalidate,
    onError: (error: Error) => toast.error('Não deu para apagar a folha', { description: error.message }),
  })

  const criarCaderno = useMutation({
    mutationFn: async (input: { titulo: string; dica?: string | null }) => {
      if (!eventoId) throw new Error('Pasta não encontrada')
      const titulo = input.titulo.trim()
      if (!titulo) throw new Error('Dê um nome ao caderno')
      const ordem = (query.data?.cadernos ?? []).reduce((acc, c) => Math.max(acc, c.ordem), -1) + 1
      const { data, error } = await db
        .from(tables.cadernos)
        .insert({
          evento_id: eventoId,
          titulo,
          dica: input.dica?.trim() || null,
          ordem,
        })
        .select('*')
        .single()
      if (error) throw error
      const caderno = parseEventoCaderno(data)
      if (!caderno) throw new Error('Não foi possível criar o caderno')
      const { error: paginaError } = await db.from(tables.paginas).insert({
        evento_id: eventoId,
        caderno_id: caderno.id,
        secao: 'livre',
        titulo: '',
        corpo: '',
        ordem: 0,
      })
      if (paginaError) throw paginaError
      return caderno
    },
    // Espera o board recarregar antes de resolver, senão a UI seleciona um caderno que ainda não está na lista.
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['evento-board'] })
      invalidate()
      toast.success('Caderno criado')
    },
    onError: (error: Error) => toast.error('Não deu para criar o caderno', { description: error.message }),
  })

  const salvarCaderno = useMutation({
    mutationFn: async ({ id, titulo, dica }: { id: string; titulo: string; dica?: string | null }) => {
      const nome = titulo.trim()
      if (!nome) throw new Error('Dê um nome ao caderno')
      const { error } = await db
        .from(tables.cadernos)
        .update({
          titulo: nome,
          dica: dica?.trim() || null,
          atualizado_em: new Date().toISOString(),
        })
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: invalidate,
    onError: (error: Error) => toast.error('Não deu para renomear o caderno', { description: error.message }),
  })

  const excluirCaderno = useMutation({
    mutationFn: async (id: string) => {
      const lista = query.data?.cadernos ?? []
      if (lista.length <= 1) throw new Error('Deixe pelo menos um caderno nesta pasta')
      const { error } = await db.from(tables.cadernos).delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      invalidate()
      toast.success('Caderno apagado')
    },
    onError: (error: Error) => toast.error('Não deu para apagar o caderno', { description: error.message }),
  })

  const uploadFoto = useMutation({
    mutationFn: async ({
      kind,
      ownerId,
      file,
    }: {
      kind: 'participantes' | 'itens' | 'galeria'
      ownerId?: string
      file: File
    }) => {
      if (!eventoId) throw new Error('Pasta não encontrada')
      if (file.size > WHITEBOARD_MAX_IMAGE_BYTES) throw new Error('Imagem muito grande (máx. 15 MB)')
      if (kind !== 'galeria' && !ownerId) throw new Error('Dono da foto não informado')
      const path = eventoStoragePath(eventoId, kind, ownerId ?? eventoId, file.name)
      const { error: uploadError } = await supabase.storage.from(EVENTO_STORAGE_BUCKET).upload(path, file, {
        contentType: file.type || 'image/jpeg',
        upsert: false,
      })
      if (uploadError) throw uploadError
      const { data: urlData } = supabase.storage.from(EVENTO_STORAGE_BUCKET).getPublicUrl(path)

      if (kind === 'galeria') {
        const { error } = await db.from(tables.eventoMidias).insert({
          evento_id: eventoId,
          file_url: urlData.publicUrl,
          storage_path: path,
          file_name: file.name,
          anotacoes: [],
          ordem: 0,
        })
        if (error) throw error
        return
      }

      const table = kind === 'participantes' ? tables.participanteMidias : tables.itemMidias
      const fk = kind === 'participantes' ? 'participante_id' : 'item_id'
      const { error } = await db.from(table).insert({
        [fk]: ownerId,
        file_url: urlData.publicUrl,
        storage_path: path,
        file_name: file.name,
        anotacoes: [],
        ordem: 0,
      })
      if (error) throw error
    },
    onSuccess: invalidate,
    onError: (error: Error) => toast.error('Não deu para subir a foto', { description: error.message }),
  })

  const salvarAnotacoes = useMutation({
    mutationFn: async ({
      kind,
      midiaId,
      anotacoes,
    }: {
      kind: 'participantes' | 'itens' | 'galeria'
      midiaId: string
      anotacoes: EventoDesenho[]
    }) => {
      const table =
        kind === 'galeria'
          ? tables.eventoMidias
          : kind === 'participantes'
            ? tables.participanteMidias
            : tables.itemMidias
      const { error } = await db.from(table).update({ anotacoes }).eq('id', midiaId)
      if (error) throw error
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['evento-board'] }),
    onError: (error: Error) => toast.error('Não deu para gravar o traço', { description: error.message }),
  })

  const excluirFoto = useMutation({
    mutationFn: async ({
      kind,
      midiaId,
      storagePath,
    }: {
      kind: 'participantes' | 'itens' | 'galeria'
      midiaId: string
      storagePath: string | null
    }) => {
      const table =
        kind === 'galeria'
          ? tables.eventoMidias
          : kind === 'participantes'
            ? tables.participanteMidias
            : tables.itemMidias
      const { error } = await db.from(table).delete().eq('id', midiaId)
      if (error) throw error
      if (storagePath) await supabase.storage.from(EVENTO_STORAGE_BUCKET).remove([storagePath])
    },
    onSuccess: invalidate,
  })

  return {
    board: query.data
      ? {
          ...query.data,
          cadernos: Array.isArray(query.data.cadernos) ? query.data.cadernos : [],
          paginas: Array.isArray(query.data.paginas) ? query.data.paginas : [],
          galeria: Array.isArray(query.data.galeria) ? query.data.galeria : [],
        }
      : null,
    loading: query.isLoading,
    error: query.error instanceof Error ? query.error.message : null,
    catalogo: catalogoQuery.data ?? [],
    salvarParticipante,
    excluirParticipante,
    salvarItem,
    excluirItem,
    salvarPagina,
    criarFolha,
    excluirFolha,
    criarCaderno,
    salvarCaderno,
    excluirCaderno,
    uploadFoto,
    salvarAnotacoes,
    excluirFoto,
    userId: user?.id ?? 'anon',
  }
}
