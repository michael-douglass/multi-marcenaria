import { useEffect } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { supabase } from '@/integrations/supabase/client'
import { useAuth } from '@/contexts/AuthContext'
import { useApp } from '@/context/AppContext'
import { useEmpresa } from '@/contexts/EmpresaContext'
import { useEmpresaSupabase } from '@/hooks/useEmpresaSupabase'
import { useBuscaLeads, type LeadBuscaItem } from '@/hooks/useBuscaLeads'
import { getPipelineInboxStageName } from '@/lib/pipeline-status-options'
import { getTodaySaoPaulo } from '@/lib/utils'
import { bumpLeadKnowledgeReindex } from '@/lib/lead-knowledge-reindex'
import {
  getFeitoProjetoStageId,
  getWaitingProjetoStageId,
  projetistaPuxaJaEmDesenho,
  stageNameLooksWaiting,
  classifyProjetoStage,
  canPegarProjeto,
  MIN_CARACTERES_BUSCA_PROJETOS,
  MIN_CARACTERES_ENVIO_SETOR,
} from '@/lib/projetos-atelie'
import { uploadLeadProjetoChatImage } from '@/lib/lead-projeto-chat'
import { DEFAULT_PIPELINE_STAGES } from '@/hooks/usePipelineCustomStages'
import type { AppUserRole } from '@/lib/app-roles'

export interface ProjetoStage {
  id: string
  nome: string
  cor: string | null
  ordem: number
  ativo: boolean
  is_default: boolean
}

export interface LeadProjeto {
  id: string
  lead_id: number
  stage_id: string
  titular_id: string | null
  arquiteto_id: string | null
  enviado_por: string | null
  enviado_em: string
  aguardando_resposta: boolean
  concluido_por: string | null
  concluido_em: string | null
  lead_nome: string
  lead_empresa: string | null
  titular_nome: string | null
  arquiteto_nome: string | null
  parceiro_nome: string | null
  concluido_por_nome: string | null
}

export type LeadProjetoNotaTipo = 'envio' | 'reenvio' | 'conversa'

export interface LeadProjetoNota {
  id: string
  lead_id: number
  autor_id: string
  mensagem: string
  tipo: LeadProjetoNotaTipo
  criado_em: string
  imagem_url: string | null
  file_name: string | null
  mime_type: string | null
  autor_nome: string | null
  autor_roles: AppUserRole[]
}

export interface LeadProjetoChatThread {
  lead_id: number
  lead_nome: string
  titular_nome: string | null
  last: LeadProjetoNota
}

interface UsuarioNome {
  id: string
  nome: string | null
}

interface UsuarioRoleRow {
  user_id: string
  role: string
}

const STAGE_COLORS = ['warning', 'primary', 'success', 'secondary', 'muted'] as const

function firstName(nome: string | null | undefined): string | null {
  const trimmed = (nome ?? '').trim()
  if (!trimmed) return null
  return trimmed.split(/\s+/)[0] ?? trimmed
}

function nomeAssinaturaDoUsuario(input: {
  crmNome?: string | null
  meta?: Record<string, unknown> | null
}): string {
  const meta = input.meta ?? {}
  const bruto =
    input.crmNome ||
    (typeof meta.name === 'string' ? meta.name : null) ||
    (typeof meta.nome === 'string' ? meta.nome : null) ||
    (typeof meta.full_name === 'string' ? meta.full_name : null)
  return firstName(bruto) ?? 'Equipe'
}

function asAppRole(role: string): AppUserRole | null {
  if (
    role === 'admin' ||
    role === 'vendedor' ||
    role === 'marketing' ||
    role === 'projetista' ||
    role === 'projetista_admin' ||
    role === 'nenhum'
  ) {
    return role
  }
  return null
}

async function fetchNomes(
  db: ReturnType<typeof useEmpresaSupabase>,
  ids: string[],
): Promise<Map<string, string>> {
  const map = new Map<string, string>()
  if (ids.length === 0) return map
  const { data, error } = await db.from('usuarios').select('id, nome').in('id', ids)
  if (error) throw error
  for (const user of (data ?? []) as UsuarioNome[]) {
    if (user.nome) map.set(user.id, user.nome)
  }
  return map
}

async function fetchRolesByUser(
  db: ReturnType<typeof useEmpresaSupabase>,
  ids: string[],
): Promise<Map<string, AppUserRole[]>> {
  const map = new Map<string, AppUserRole[]>()
  if (ids.length === 0) return map
  const { data } = await db.from('user_roles').select('user_id, role').in('user_id', ids)
  for (const row of (data ?? []) as UsuarioRoleRow[]) {
    const role = asAppRole(String(row.role))
    if (!role) continue
    const list = map.get(row.user_id) ?? []
    list.push(role)
    map.set(row.user_id, list)
  }
  return map
}

function mapNota(
  row: Record<string, unknown>,
  names: Map<string, string>,
  roles: Map<string, AppUserRole[]>,
): LeadProjetoNota {
  const autorId = String(row.autor_id)
  const tipoRaw = String(row.tipo ?? 'conversa')
  const tipo: LeadProjetoNotaTipo =
    tipoRaw === 'envio' || tipoRaw === 'reenvio' ? tipoRaw : 'conversa'
  return {
    id: String(row.id),
    lead_id: row.lead_id as number,
    autor_id: autorId,
    mensagem: String(row.mensagem ?? ''),
    tipo,
    criado_em: String(row.criado_em),
    imagem_url: row.imagem_url ? String(row.imagem_url) : null,
    file_name: row.file_name ? String(row.file_name) : null,
    mime_type: row.mime_type ? String(row.mime_type) : null,
    autor_nome: firstName(names.get(autorId)) ?? 'Equipe',
    autor_roles: roles.get(autorId) ?? [],
  }
}

export function useProjetoStages() {
  const db = useEmpresaSupabase()
  const { schemaEmpresa, queriesReady } = useEmpresa()

  return useQuery({
    queryKey: ['projeto-stages', schemaEmpresa],
    enabled: queriesReady,
    queryFn: async (): Promise<ProjetoStage[]> => {
      const { data, error } = await db
        .from('projeto_stages')
        .select('id, nome, cor, ordem, ativo, is_default')
        .eq('ativo', true)
        .order('ordem')
      if (error) throw error
      return (data ?? []) as ProjetoStage[]
    },
  })
}

export function useProjetoStagesAdmin() {
  const db = useEmpresaSupabase()
  const queryClient = useQueryClient()
  const { schemaEmpresa, queriesReady } = useEmpresa()

  const query = useQuery({
    queryKey: ['projeto-stages-admin', schemaEmpresa],
    enabled: queriesReady,
    queryFn: async (): Promise<ProjetoStage[]> => {
      const { data, error } = await db
        .from('projeto_stages')
        .select('id, nome, cor, ordem, ativo, is_default')
        .order('ordem')
      if (error) throw error
      return (data ?? []) as ProjetoStage[]
    },
  })

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ['projeto-stages'] })
    void queryClient.invalidateQueries({ queryKey: ['projeto-stages-admin'] })
    void queryClient.invalidateQueries({ queryKey: ['lead-projetos'] })
  }

  const createStage = useMutation({
    mutationFn: async ({ nome, cor }: { nome: string; cor: string | null }) => {
      const maxOrdem = Math.max(0, ...(query.data ?? []).map((s) => s.ordem))
      const { error } = await db.from('projeto_stages').insert({
        nome: nome.trim(),
        cor,
        ordem: maxOrdem + 1,
        ativo: true,
        is_default: false,
      })
      if (error) throw error
    },
    onSuccess: () => {
      invalidate()
      toast.success('Coluna criada')
    },
    onError: (error: Error) => toast.error(error.message || 'Não foi possível criar a coluna'),
  })

  const updateStage = useMutation({
    mutationFn: async ({ id, nome, cor }: { id: string; nome?: string; cor?: string | null }) => {
      const payload: Record<string, unknown> = {}
      if (nome != null) payload.nome = nome.trim()
      if (cor !== undefined) payload.cor = cor
      const { error } = await db.from('projeto_stages').update(payload).eq('id', id)
      if (error) throw error
    },
    onSuccess: invalidate,
    onError: (error: Error) => toast.error(error.message || 'Não foi possível salvar a coluna'),
  })

  const deleteStage = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await db.from('projeto_stages').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      invalidate()
      toast.success('Coluna excluída')
    },
    onError: (error: Error) => toast.error(error.message || 'Não foi possível excluir'),
  })

  const moveStage = useMutation({
    mutationFn: async ({ id, direction }: { id: string; direction: 'up' | 'down' }) => {
      const stages = [...(query.data ?? [])]
      const index = stages.findIndex((s) => s.id === id)
      const swapWith = direction === 'up' ? index - 1 : index + 1
      if (index < 0 || swapWith < 0 || swapWith >= stages.length) return
      const a = stages[index]
      const b = stages[swapWith]
      const { error: e1 } = await db.from('projeto_stages').update({ ordem: b.ordem }).eq('id', a.id)
      if (e1) throw e1
      const { error: e2 } = await db.from('projeto_stages').update({ ordem: a.ordem }).eq('id', b.id)
      if (e2) throw e2
    },
    onSuccess: invalidate,
  })

  return { ...query, stages: query.data ?? [], createStage, updateStage, deleteStage, moveStage, colorPresets: STAGE_COLORS }
}

async function loadLeadProjetosBoard(
  db: ReturnType<typeof useEmpresaSupabase>,
): Promise<LeadProjeto[]> {
  const { data: rows, error } = await db
    .from('lead_projetos')
    .select(
      'id, lead_id, stage_id, titular_id, arquiteto_id, enviado_por, enviado_em, aguardando_resposta, concluido_por, concluido_em, concluido_por_nome',
    )
    .order('enviado_em', { ascending: false })
  if (error) throw error

  const projetos = rows ?? []
  const leadIds = [...new Set(projetos.map((p) => p.lead_id as number))]
  const userIds = [
    ...new Set(
      projetos
        .flatMap((p) => [p.titular_id, p.arquiteto_id, p.enviado_por, p.concluido_por])
        .filter((id): id is string => Boolean(id))
        .map(String),
    ),
  ]

  const leadsById = new Map<number, { nome: string; empresa: string | null; parceiroId: string | null }>()
  if (leadIds.length > 0) {
    const { data: leads, error: leadsError } = await db
      .from('leads')
      .select('id, nome, empresa, pontua_garbo_usuario_id')
      .in('id', leadIds)
    if (leadsError) throw leadsError
    for (const lead of leads ?? []) {
      leadsById.set(lead.id as number, {
        nome: String(lead.nome ?? 'Lead'),
        empresa: lead.empresa ? String(lead.empresa) : null,
        parceiroId: lead.pontua_garbo_usuario_id ? String(lead.pontua_garbo_usuario_id) : null,
      })
    }
  }

  const parceiroIds = [...new Set([...leadsById.values()].map((l) => l.parceiroId).filter((id): id is string => Boolean(id)))]
  const usersById = await fetchNomes(db, [...new Set([...userIds, ...parceiroIds])])

  return projetos.map((row) => {
    const lead = leadsById.get(row.lead_id as number)
    const titularId = row.titular_id ? String(row.titular_id) : null
    const arquitetoId = row.arquiteto_id ? String(row.arquiteto_id) : null
    const concluidoPorId = row.concluido_por ? String(row.concluido_por) : null
    const concluidoNomeSnapshot = firstName(
      row.concluido_por_nome ? String(row.concluido_por_nome) : null,
    )
    return {
      id: String(row.id),
      lead_id: row.lead_id as number,
      stage_id: String(row.stage_id),
      titular_id: titularId,
      arquiteto_id: arquitetoId,
      enviado_por: row.enviado_por ? String(row.enviado_por) : null,
      enviado_em: String(row.enviado_em),
      aguardando_resposta: row.aguardando_resposta === true,
      concluido_por: concluidoPorId,
      concluido_em: row.concluido_em ? String(row.concluido_em) : null,
      lead_nome: lead?.nome ?? `Lead #${row.lead_id}`,
      lead_empresa: lead?.empresa ?? null,
      titular_nome: firstName(titularId ? usersById.get(titularId) : null),
      arquiteto_nome: firstName(arquitetoId ? usersById.get(arquitetoId) : null),
      parceiro_nome: firstName(lead?.parceiroId ? usersById.get(lead.parceiroId) : null),
      concluido_por_nome:
        concluidoNomeSnapshot ??
        firstName(concluidoPorId ? usersById.get(concluidoPorId) : null) ??
        firstName(arquitetoId ? usersById.get(arquitetoId) : null),
    }
  })
}

export function useLeadProjetos(options?: { realtime?: boolean }) {
  const db = useEmpresaSupabase()
  const queryClient = useQueryClient()
  const { schemaEmpresa, queriesReady } = useEmpresa()
  const realtime = options?.realtime === true

  const query = useQuery({
    queryKey: ['lead-projetos', schemaEmpresa],
    enabled: queriesReady,
    staleTime: 15_000,
    queryFn: () => loadLeadProjetosBoard(db),
  })

  useEffect(() => {
    if (!realtime || !schemaEmpresa) return
    const channel = supabase
      .channel(`lead-projetos-${schemaEmpresa}`)
      .on(
        'postgres_changes',
        { event: '*', schema: schemaEmpresa, table: 'lead_projetos' },
        () => {
          void queryClient.invalidateQueries({ queryKey: ['lead-projetos', schemaEmpresa] })
        },
      )
      .subscribe()
    return () => {
      void supabase.removeChannel(channel)
    }
  }, [queryClient, realtime, schemaEmpresa])

  return query
}

export function useLeadProjetosBoard(options?: { realtime?: boolean }) {
  return useLeadProjetos(options)
}

export function useProjetoPorLead(leadId: number | null | undefined) {
  const { data: projetos = [], isLoading, error } = useLeadProjetos()
  const projeto = leadId ? projetos.find((p) => p.lead_id === leadId) ?? null : null
  return { projeto, isLoading, error }
}

export function useLeadProjetoNotas(leadId: number | null | undefined, options?: { realtime?: boolean }) {
  const db = useEmpresaSupabase()
  const queryClient = useQueryClient()
  const { schemaEmpresa, queriesReady } = useEmpresa()
  const realtime = options?.realtime !== false

  const query = useQuery({
    queryKey: ['lead-projeto-notas', schemaEmpresa, leadId],
    enabled: queriesReady && Boolean(leadId),
    queryFn: async (): Promise<LeadProjetoNota[]> => {
      const { data: rows, error } = await db
        .from('lead_projeto_notas')
        .select('id, lead_id, autor_id, mensagem, tipo, criado_em, imagem_url, file_name, mime_type')
        .eq('lead_id', leadId)
        .order('criado_em', { ascending: true })
      if (error) throw error
      const autorIds = [...new Set((rows ?? []).map((r) => String(r.autor_id)))]
      const names = await fetchNomes(db, autorIds)
      const roles = await fetchRolesByUser(db, autorIds)
      return (rows ?? []).map((row) => mapNota(row as Record<string, unknown>, names, roles))
    },
  })

  useEffect(() => {
    if (!realtime || !schemaEmpresa || !leadId) return
    const channel = supabase
      .channel(`lead-projeto-notas-${schemaEmpresa}-${leadId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: schemaEmpresa,
          table: 'lead_projeto_notas',
          filter: `lead_id=eq.${leadId}`,
        },
        () => {
          void queryClient.invalidateQueries({ queryKey: ['lead-projeto-notas', schemaEmpresa, leadId] })
          void queryClient.invalidateQueries({ queryKey: ['lead-projeto-chat-board', schemaEmpresa] })
        },
      )
      .subscribe()
    return () => {
      void supabase.removeChannel(channel)
    }
  }, [leadId, queryClient, realtime, schemaEmpresa])

  return query
}

/** @deprecated use useLeadProjetoNotas */
export function useProjetoNotas(leadId: number | null | undefined) {
  return useLeadProjetoNotas(leadId)
}

export function useLeadProjetoChatBoard(options?: { realtime?: boolean }) {
  const db = useEmpresaSupabase()
  const queryClient = useQueryClient()
  const { schemaEmpresa, queriesReady } = useEmpresa()
  const realtime = options?.realtime !== false

  const query = useQuery({
    queryKey: ['lead-projeto-chat-board', schemaEmpresa],
    enabled: queriesReady,
    staleTime: 15_000,
    queryFn: async (): Promise<LeadProjetoChatThread[]> => {
      const { data: rows, error } = await db
        .from('lead_projeto_notas')
        .select('id, lead_id, autor_id, mensagem, tipo, criado_em, imagem_url, file_name, mime_type')
        .order('criado_em', { ascending: false })
        .limit(500)
      if (error) throw error

      const lastByLead = new Map<number, Record<string, unknown>>()
      for (const row of rows ?? []) {
        const leadId = row.lead_id as number
        if (!lastByLead.has(leadId)) lastByLead.set(leadId, row as Record<string, unknown>)
      }

      const leadIds = [...lastByLead.keys()]
      const autorIds = [...new Set([...lastByLead.values()].map((r) => String(r.autor_id)))]
      const names = await fetchNomes(db, autorIds)
      const roles = await fetchRolesByUser(db, autorIds)

      const leadNames = new Map<number, { nome: string; titular: string | null }>()
      if (leadIds.length > 0) {
        const { data: leads } = await db.from('leads').select('id, nome, vendedor_responsavel_id').in('id', leadIds)
        const titularIds = [
          ...new Set(
            (leads ?? [])
              .map((l) => (l.vendedor_responsavel_id ? String(l.vendedor_responsavel_id) : null))
              .filter((id): id is string => Boolean(id)),
          ),
        ]
        const titularNames = await fetchNomes(db, titularIds)
        for (const lead of leads ?? []) {
          leadNames.set(lead.id as number, {
            nome: String(lead.nome ?? `Lead #${lead.id}`),
            titular: firstName(
              lead.vendedor_responsavel_id ? titularNames.get(String(lead.vendedor_responsavel_id)) : null,
            ),
          })
        }
      }

      return [...lastByLead.entries()].map(([leadId, row]) => {
        const meta = leadNames.get(leadId)
        return {
          lead_id: leadId,
          lead_nome: meta?.nome ?? `Lead #${leadId}`,
          titular_nome: meta?.titular ?? null,
          last: mapNota(row, names, roles),
        }
      })
    },
  })

  useEffect(() => {
    if (!realtime || !schemaEmpresa) return
    const channel = supabase
      .channel(`lead-projeto-chat-board-${schemaEmpresa}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: schemaEmpresa, table: 'lead_projeto_notas' },
        () => {
          void queryClient.invalidateQueries({ queryKey: ['lead-projeto-chat-board', schemaEmpresa] })
        },
      )
      .subscribe()
    return () => {
      void supabase.removeChannel(channel)
    }
  }, [queryClient, realtime, schemaEmpresa])

  return query
}

export function useProjetosBuscaLeads(search: string) {
  return useBuscaLeads(search)
}

export function useLeadProjetoMutations() {
  const db = useEmpresaSupabase()
  const queryClient = useQueryClient()
  const { user, userRoles } = useAuth()
  const { crmProfile } = useApp()
  const { schemaEmpresa } = useEmpresa()
  const { data: stages = [], isPending: stagesPending } = useProjetoStages()

  const invalidate = (leadId?: number) => {
    void queryClient.invalidateQueries({ queryKey: ['lead-projetos'] })
    void queryClient.invalidateQueries({ queryKey: ['lead-projeto-notas'] })
    void queryClient.invalidateQueries({ queryKey: ['lead-projeto-chat-board'] })
    if (leadId) bumpLeadKnowledgeReindex(queryClient, schemaEmpresa, leadId)
  }

  const waitingId = () => {
    const id = getWaitingProjetoStageId(stages)
    if (!id) {
      throw new Error(
        stagesPending
          ? 'Ainda estou carregando as colunas do ateliê. Tente de novo em um instante.'
          : 'Não há coluna de fila no ateliê.',
      )
    }
    return id
  }

  const feitoId = () => getFeitoProjetoStageId(stages)

  const inserirNota = async (input: {
    leadId: number
    mensagem: string
    tipo: LeadProjetoNotaTipo
    imagem?: { url: string; fileName: string; mimeType: string } | null
  }) => {
    if (!user?.id) throw new Error('Faça login para escrever no canal.')
    const { error } = await db.from('lead_projeto_notas').insert({
      lead_id: input.leadId,
      autor_id: user.id,
      mensagem: input.mensagem,
      tipo: input.tipo,
      imagem_url: input.imagem?.url ?? null,
      file_name: input.imagem?.fileName ?? null,
      mime_type: input.imagem?.mimeType ?? null,
    })
    if (error) throw error
  }

  const pegar = useMutation({
    mutationFn: async (projetoId: string) => {
      if (!user?.id) throw new Error('Faça login para pegar o desenho.')
      const { error } = await db
        .from('lead_projetos')
        .update({
          arquiteto_id: user.id,
          aguardando_resposta: false,
          atualizado_em: new Date().toISOString(),
        })
        .eq('id', projetoId)
      if (error) throw error
    },
    onSuccess: () => {
      invalidate()
      toast.success('Você pegou este desenho')
    },
    onError: (error: Error) => toast.error(error.message || 'Não foi possível pegar'),
  })

  const assinaturaConclusao = () => {
    if (!user?.id) throw new Error('Faça login para concluir o projeto.')
    const nome = nomeAssinaturaDoUsuario({
      crmNome: crmProfile?.nome,
      meta: (user.user_metadata ?? null) as Record<string, unknown> | null,
    })
    return {
      concluido_por: user.id,
      concluido_em: new Date().toISOString(),
      concluido_por_nome: nome,
    }
  }

  const limparAssinaturaConclusao = () => ({
    concluido_por: null,
    concluido_em: null,
    concluido_por_nome: null,
  })

  const soltar = useMutation({
    mutationFn: async (projetoId: string) => {
      const fila = waitingId()
      const { error } = await db
        .from('lead_projetos')
        .update({
          arquiteto_id: null,
          aguardando_resposta: true,
          stage_id: fila,
          ...limparAssinaturaConclusao(),
          atualizado_em: new Date().toISOString(),
        })
        .eq('id', projetoId)
      if (error) throw error
    },
    onSuccess: () => {
      invalidate()
      toast.success('Projeto solto — o brilho para')
    },
    onError: (error: Error) => toast.error(error.message || 'Não foi possível soltar'),
  })

  const mover = useMutation({
    mutationFn: async ({ projetoId, stageId }: { projetoId: string; stageId: string }) => {
      const stage = stages.find((s) => s.id === stageId)
      const toWaiting = stage ? stageNameLooksWaiting(stage.nome) || stageId === getWaitingProjetoStageId(stages) : false
      const toFeito = stageId === feitoId()
      const payload: Record<string, unknown> = {
        stage_id: stageId,
        atualizado_em: new Date().toISOString(),
      }
      if (toWaiting) {
        payload.arquiteto_id = null
        payload.aguardando_resposta = true
        Object.assign(payload, limparAssinaturaConclusao())
      } else if (toFeito) {
        payload.aguardando_resposta = false
        Object.assign(payload, assinaturaConclusao())
      } else {
        Object.assign(payload, limparAssinaturaConclusao())
      }
      const { error } = await db.from('lead_projetos').update(payload).eq('id', projetoId)
      if (error) throw error
    },
    onSuccess: () => invalidate(),
    onError: () => toast.error('Não foi possível mover o projeto'),
  })

  const concluir = useMutation({
    mutationFn: async (projetoId: string) => {
      const last = feitoId()
      if (!last) throw new Error('Não há coluna de feitos.')
      const { error } = await db
        .from('lead_projetos')
        .update({
          stage_id: last,
          aguardando_resposta: false,
          ...assinaturaConclusao(),
          atualizado_em: new Date().toISOString(),
        })
        .eq('id', projetoId)
      if (error) throw error
    },
    onSuccess: () => {
      invalidate()
      toast.success('Projeto concluído')
    },
    onError: (error: Error) => toast.error(error.message || 'Não foi possível concluir'),
  })

  const reabrir = useMutation({
    mutationFn: async (projetoId: string) => {
      const fila = waitingId()
      const { error } = await db
        .from('lead_projetos')
        .update({
          stage_id: fila,
          aguardando_resposta: true,
          ...limparAssinaturaConclusao(),
          atualizado_em: new Date().toISOString(),
        })
        .eq('id', projetoId)
      if (error) throw error
    },
    onSuccess: () => {
      invalidate()
      toast.success('Projeto reaberto na fila')
    },
    onError: (error: Error) => toast.error(error.message || 'Não foi possível reabrir'),
  })

  const solicitarNovamente = useMutation({
    mutationFn: async ({ leadId, projetoId }: { leadId: number; projetoId: string }) => {
      const fila = waitingId()
      const { error } = await db
        .from('lead_projetos')
        .update({
          stage_id: fila,
          arquiteto_id: null,
          aguardando_resposta: true,
          enviado_por: user?.id ?? null,
          enviado_em: new Date().toISOString(),
          ...limparAssinaturaConclusao(),
          atualizado_em: new Date().toISOString(),
        })
        .eq('id', projetoId)
      if (error) throw error
      await inserirNota({
        leadId,
        mensagem: 'Solicitou o projeto novamente.',
        tipo: 'reenvio',
      })
    },
    onSuccess: (_data, vars) => {
      invalidate(vars.leadId)
      toast.success('Pedido enviado de novo à fila')
    },
    onError: (error: Error) => toast.error(error.message || 'Não foi possível solicitar de novo'),
  })

  const puxarParaProjeto = useMutation({
    mutationFn: async (input: number | { leadId: number; stageId?: string }) => {
      const leadId = typeof input === 'number' ? input : input.leadId
      const destinoStageId =
        typeof input === 'number' ? waitingId() : input.stageId?.trim() || waitingId()

      const destinoStage = stages.find((stage) => stage.id === destinoStageId)
      const kind = destinoStage ? classifyProjetoStage(destinoStage, stages) : 'waiting'
      const claimNow =
        projetistaPuxaJaEmDesenho(userRoles) ||
        (canPegarProjeto(userRoles) && kind !== 'waiting' && kind !== 'feito')

      const { data: existing } = await db
        .from('lead_projetos')
        .select('id, stage_id')
        .eq('lead_id', leadId)
        .maybeSingle()

      if (existing?.id) {
        if (existing.stage_id !== destinoStageId) {
          const toFeito = kind === 'feito'
          const assinatura = toFeito
            ? {
                aguardando_resposta: false,
                concluido_por: user?.id ?? null,
                concluido_em: new Date().toISOString(),
                concluido_por_nome: nomeAssinaturaDoUsuario({
                  crmNome: crmProfile?.nome,
                  meta: (user?.user_metadata ?? null) as Record<string, unknown> | null,
                }),
              }
            : {
                concluido_por: null,
                concluido_em: null,
                concluido_por_nome: null,
              }
          const { error } = await db
            .from('lead_projetos')
            .update({
              stage_id: destinoStageId,
              ...(claimNow
                ? {
                    arquiteto_id: user?.id ?? null,
                    aguardando_resposta: false,
                  }
                : {}),
              ...assinatura,
              atualizado_em: new Date().toISOString(),
            })
            .eq('id', existing.id)
          if (error) throw error
          return { already: true as const, moved: true as const, leadId }
        }
        return { already: true as const, moved: false as const, leadId }
      }

      const toFeito = kind === 'feito'
      const { error } = await db.from('lead_projetos').insert({
        lead_id: leadId,
        stage_id: destinoStageId,
        enviado_por: user?.id ?? null,
        titular_id: claimNow ? null : user?.id ?? null,
        arquiteto_id: claimNow ? user?.id ?? null : null,
        aguardando_resposta: toFeito ? false : !claimNow,
        concluido_por: toFeito ? user?.id ?? null : null,
        concluido_em: toFeito ? new Date().toISOString() : null,
        concluido_por_nome: toFeito
          ? nomeAssinaturaDoUsuario({
              crmNome: crmProfile?.nome,
              meta: (user?.user_metadata ?? null) as Record<string, unknown> | null,
            })
          : null,
      })
      if (error) {
        if (error.code === '23505') return { already: true as const, moved: false as const, leadId }
        throw error
      }

      const colunaNome = destinoStage?.nome ?? 'fila'
      await inserirNota({
        leadId,
        mensagem: claimNow
          ? `Puxou este lead para “${colunaNome}” e ficou com o desenho.`
          : `Puxou este lead para “${colunaNome}”.`,
        tipo: 'envio',
      })
      return { already: false as const, moved: false as const, leadId }
    },
    onSuccess: (result) => {
      invalidate(result.leadId)
      if (result.already && result.moved) {
        toast.success('Lead movido para a coluna escolhida')
      } else if (result.already) {
        toast.info('Este cliente já está no quadro')
      } else {
        toast.success('Lead no ateliê')
      }
    },
    onError: (error: Error) => toast.error(error.message || 'Não foi possível puxar o lead'),
  })

  const enviarAoSetor = useMutation({
    mutationFn: async ({
      leadId,
      recado,
      files,
    }: {
      leadId: number
      recado: string
      files: File[]
    }) => {
      if (!user?.id) throw new Error('Faça login para enviar ao setor de projetos.')
      const texto = recado.trim()
      if (texto.length < MIN_CARACTERES_ENVIO_SETOR && files.length === 0) {
        throw new Error(
          `Escreva pelo menos ${MIN_CARACTERES_ENVIO_SETOR} caracteres ou anexe uma foto.`,
        )
      }

      const fila = waitingId()
      const { data: existing, error: existingError } = await db
        .from('lead_projetos')
        .select('id')
        .eq('lead_id', leadId)
        .maybeSingle()
      if (existingError) throw existingError

      if (existing?.id) {
        const { data: updated, error } = await db
          .from('lead_projetos')
          .update({
            stage_id: fila,
            arquiteto_id: null,
            aguardando_resposta: true,
            enviado_por: user.id,
            enviado_em: new Date().toISOString(),
            concluido_por: null,
            concluido_em: null,
            concluido_por_nome: null,
            atualizado_em: new Date().toISOString(),
          })
          .eq('id', existing.id)
          .select('id')
          .maybeSingle()
        if (error) throw error
        if (!updated?.id) {
          throw new Error('O ateliê não aceitou este envio. Recarregue e tente de novo.')
        }
      } else {
        const { data: leadRow } = await db
          .from('leads')
          .select('vendedor_responsavel_id')
          .eq('id', leadId)
          .maybeSingle()
        const { data: inserted, error } = await db
          .from('lead_projetos')
          .insert({
            lead_id: leadId,
            stage_id: fila,
            titular_id: leadRow?.vendedor_responsavel_id
              ? String(leadRow.vendedor_responsavel_id)
              : user.id,
            enviado_por: user.id,
            aguardando_resposta: true,
          })
          .select('id')
          .maybeSingle()
        if (error && error.code !== '23505') throw error
        if (!inserted?.id && error?.code !== '23505') {
          throw new Error('O ateliê não aceitou este envio. Recarregue e tente de novo.')
        }
      }

      const tipo: LeadProjetoNotaTipo = existing?.id ? 'reenvio' : 'envio'
      await inserirNota({ leadId, mensagem: texto || 'Pedido de projeto.', tipo })

      for (const file of files) {
        const uploaded = await uploadLeadProjetoChatImage({
          file,
          leadId,
          schemaEmpresa,
          queryClient,
        })
        await inserirNota({
          leadId,
          mensagem: '📷 Imagem',
          tipo: 'conversa',
          imagem: uploaded,
        })
      }
      return leadId
    },
    onSuccess: (leadId) => {
      invalidate(leadId)
      toast.success('Enviado ao setor de projetos')
    },
    onError: (error: Error) => toast.error(error.message || 'Não foi possível enviar ao setor'),
  })

  const adicionarNota = useMutation({
    mutationFn: async ({
      leadId,
      mensagem,
      tipo = 'conversa',
      file,
    }: {
      leadId: number
      mensagem: string
      tipo?: LeadProjetoNotaTipo
      file?: File | null
    }) => {
      let imagem: { url: string; fileName: string; mimeType: string } | null = null
      if (file) {
        imagem = await uploadLeadProjetoChatImage({
          file,
          leadId,
          schemaEmpresa,
          queryClient,
        })
      }
      await inserirNota({
        leadId,
        mensagem: mensagem.trim() || (imagem ? '📷 Imagem' : ''),
        tipo,
        imagem,
      })
      return leadId
    },
    onSuccess: (leadId) => invalidate(leadId),
    onError: (error: Error) => toast.error(error.message || 'Não foi possível enviar'),
  })

  const enviar = useMutation({
    mutationFn: async (leadId: number) => puxarParaProjeto.mutateAsync(leadId),
    onError: (error: Error) => toast.error(error.message || 'Não foi possível enviar para Projetos'),
  })

  return {
    pegar,
    soltar,
    mover,
    concluir,
    reabrir,
    solicitarNovamente,
    puxarParaProjeto,
    enviarAoSetor,
    adicionarNota,
    enviar,
  }
}

export function useCriarLeadProjeto() {
  const db = useEmpresaSupabase()
  const queryClient = useQueryClient()
  const { user } = useAuth()
  const { schemaEmpresa } = useEmpresa()
  const { data: stages = [] } = useProjetoStages()

  return useMutation({
    mutationFn: async (input: { nome: string; telefone?: string; empresa?: string }) => {
      if (!user?.id) throw new Error('Faça login para criar o lead.')
      const nome = input.nome.trim()
      if (nome.length < 2) throw new Error('Informe o nome do cliente.')

      const { data: pipelineStages } = await db
        .from('pipeline_custom_stages')
        .select('nome, ordem, ativo')
        .eq('ativo', true)
        .order('ordem')
      const stageNames = (pipelineStages ?? []).map((s) => String(s.nome ?? '')).filter(Boolean)
      const inbox = getPipelineInboxStageName(
        stageNames.length ? stageNames : DEFAULT_PIPELINE_STAGES.map((s) => s.nome),
      )

      const { data: lead, error } = await db
        .from('leads')
        .insert({
          nome,
          telefone: input.telefone?.trim() || null,
          empresa: input.empresa?.trim() || null,
          status: inbox,
          valor_negocio: 0,
          data_chegada: getTodaySaoPaulo(),
          vendedor_responsavel_id: user.id,
        })
        .select('id')
        .single()
      if (error) throw error
      if (!lead?.id) throw new Error('Lead criado sem id.')

      const fila = getWaitingProjetoStageId(stages)
      if (!fila) throw new Error('Não há coluna de fila no ateliê.')
      const { error: projetoError } = await db.from('lead_projetos').insert({
        lead_id: lead.id,
        stage_id: fila,
        enviado_por: user.id,
        titular_id: user.id,
        aguardando_resposta: true,
      })
      if (projetoError && projetoError.code !== '23505') throw projetoError

      return lead.id as number
    },
    onSuccess: (leadId) => {
      void queryClient.invalidateQueries({ queryKey: ['leads'] })
      void queryClient.invalidateQueries({ queryKey: ['lead-projetos'] })
      bumpLeadKnowledgeReindex(queryClient, schemaEmpresa, leadId)
      toast.success('Lead criado e colocado na fila')
    },
    onError: (error: Error) => toast.error(error.message || 'Não foi possível criar o lead'),
  })
}

export { MIN_CARACTERES_BUSCA_PROJETOS }
export type { LeadBuscaItem }
