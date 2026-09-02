import { useEffect } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { supabase } from '@/integrations/supabase/client'
import { useAuth } from '@/contexts/AuthContext'
import { useEmpresa } from '@/contexts/EmpresaContext'
import { useEmpresaSupabase } from '@/hooks/useEmpresaSupabase'
import { useBuscaLeads } from '@/hooks/useBuscaLeads'
import { uploadLeadProjetoChatImage } from '@/lib/lead-projeto-chat'
import {
  getFeitoProducaoStageId,
  getIniciadoProducaoStageId,
  getPendenteProducaoStageId,
  type ProducaoChatCanal,
} from '@/lib/projetos-producao'
import type { AppUserRole } from '@/lib/app-roles'

export interface ProducaoStage {
  id: string
  nome: string
  cor: string | null
  ordem: number
  ativo: boolean
  is_default: boolean
}

export interface ObraProducao {
  id: string
  obra_id: string | null
  lead_id: number
  stage_id: string
  responsavel_id: string | null
  iniciado_em: string | null
  concluido_em: string | null
  criado_em: string
  lead_nome: string
  lead_empresa: string | null
  titular_nome: string | null
  obra_cliente_nome: string | null
  responsavel_nome: string | null
}

export type ProducaoNotaTipo = 'envio' | 'reenvio' | 'conversa'

export interface ObraProducaoNota {
  id: string
  obra_producao_id: string
  lead_id: number
  autor_id: string
  canal: ProducaoChatCanal
  mensagem: string
  tipo: ProducaoNotaTipo
  criado_em: string
  imagem_url: string | null
  file_name: string | null
  mime_type: string | null
  autor_nome: string | null
  autor_roles: AppUserRole[]
}

export interface ProducaoChatThread {
  obra_producao_id: string
  lead_id: number
  lead_nome: string
  canal: ProducaoChatCanal
  last: ObraProducaoNota
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
): ObraProducaoNota {
  const autorId = String(row.autor_id)
  const tipoRaw = String(row.tipo ?? 'conversa')
  const tipo: ProducaoNotaTipo =
    tipoRaw === 'envio' || tipoRaw === 'reenvio' ? tipoRaw : 'conversa'
  const canalRaw = String(row.canal ?? 'obras')
  const canal: ProducaoChatCanal = canalRaw === 'vendas' ? 'vendas' : 'obras'
  return {
    id: String(row.id),
    obra_producao_id: String(row.obra_producao_id),
    lead_id: row.lead_id as number,
    autor_id: autorId,
    canal,
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

export function useProducaoStages() {
  const db = useEmpresaSupabase()
  const { schemaEmpresa, queriesReady } = useEmpresa()

  return useQuery({
    queryKey: ['producao-stages', schemaEmpresa],
    enabled: queriesReady,
    queryFn: async (): Promise<ProducaoStage[]> => {
      const { data, error } = await db
        .from('producao_stages')
        .select('id, nome, cor, ordem, ativo, is_default')
        .eq('ativo', true)
        .order('ordem', { ascending: true })
      if (error) throw error
      return (data ?? []) as ProducaoStage[]
    },
  })
}

export function useProducaoStagesAdmin() {
  const db = useEmpresaSupabase()
  const queryClient = useQueryClient()
  const { schemaEmpresa } = useEmpresa()
  const { data: stages = [] } = useProducaoStages()

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ['producao-stages', schemaEmpresa] })
  }

  const createStage = useMutation({
    mutationFn: async (input: { nome: string; cor: string | null }) => {
      const ordem = stages.length > 0 ? Math.max(...stages.map((s) => s.ordem)) + 1 : 0
      const { error } = await db.from('producao_stages').insert({
        nome: input.nome.trim(),
        cor: input.cor ?? STAGE_COLORS[ordem % STAGE_COLORS.length],
        ordem,
        ativo: true,
        is_default: false,
      })
      if (error) throw error
    },
    onSuccess: () => {
      invalidate()
      toast.success('Coluna criada')
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const updateStage = useMutation({
    mutationFn: async (input: { id: string; nome?: string; cor?: string | null }) => {
      const payload: Record<string, unknown> = { atualizado_em: new Date().toISOString() }
      if (input.nome != null) payload.nome = input.nome.trim()
      if (input.cor !== undefined) payload.cor = input.cor
      const { error } = await db.from('producao_stages').update(payload).eq('id', input.id)
      if (error) throw error
    },
    onSuccess: () => {
      invalidate()
      toast.success('Coluna atualizada')
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const deleteStage = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await db.from('producao_stages').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      invalidate()
      toast.success('Coluna removida')
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const moveStage = useMutation({
    mutationFn: async (input: { id: string; direction: 'up' | 'down' }) => {
      const ordered = [...stages].sort((a, b) => a.ordem - b.ordem)
      const index = ordered.findIndex((s) => s.id === input.id)
      if (index < 0) return
      const swapWith = input.direction === 'up' ? index - 1 : index + 1
      if (swapWith < 0 || swapWith >= ordered.length) return
      const a = ordered[index]
      const b = ordered[swapWith]
      const { error: e1 } = await db.from('producao_stages').update({ ordem: b.ordem }).eq('id', a.id)
      if (e1) throw e1
      const { error: e2 } = await db.from('producao_stages').update({ ordem: a.ordem }).eq('id', b.id)
      if (e2) throw e2
    },
    onSuccess: invalidate,
    onError: (err: Error) => toast.error(err.message),
  })

  return { stages, createStage, updateStage, deleteStage, moveStage }
}

export function useObraProducaoCards(options?: { realtime?: boolean }) {
  const db = useEmpresaSupabase()
  const queryClient = useQueryClient()
  const { schemaEmpresa, queriesReady } = useEmpresa()
  const realtime = options?.realtime ?? true

  const query = useQuery({
    queryKey: ['obra-producao', schemaEmpresa],
    enabled: queriesReady,
    queryFn: async (): Promise<ObraProducao[]> => {
      const { data, error } = await db
        .from('obra_producao')
        .select(
          'id, obra_id, lead_id, stage_id, responsavel_id, iniciado_em, concluido_em, criado_em',
        )
        .order('criado_em', { ascending: false })
      if (error) throw error
      const rows = (data ?? []) as Array<Record<string, unknown>>
      if (rows.length === 0) return []

      const leadIds = [...new Set(rows.map((r) => Number(r.lead_id)))]
      const obraIds = [
        ...new Set(
          rows
            .map((r) => (r.obra_id ? String(r.obra_id) : null))
            .filter((id): id is string => Boolean(id)),
        ),
      ]
      const userIds = [
        ...new Set(
          rows
            .map((r) => (r.responsavel_id ? String(r.responsavel_id) : null))
            .filter((id): id is string => Boolean(id)),
        ),
      ]

      const { data: leads } = await db
        .from('leads')
        .select('id, nome, empresa, vendedor_responsavel_id')
        .in('id', leadIds)

      const titularIds = [
        ...new Set(
          (leads ?? [])
            .map((l) => (l.vendedor_responsavel_id ? String(l.vendedor_responsavel_id) : null))
            .filter((id): id is string => Boolean(id)),
        ),
      ]

      const names = await fetchNomes(db, [...userIds, ...titularIds])

      const obraNome = new Map<string, string>()
      if (obraIds.length > 0) {
        const { data: obras } = await supabase
          .from('movelaria_obras')
          .select('id, cliente_nome')
          .in('id', obraIds)
        for (const obra of obras ?? []) {
          obraNome.set(String(obra.id), String(obra.cliente_nome ?? ''))
        }
      }

      const leadMeta = new Map<number, { nome: string; empresa: string | null; titular: string | null }>()
      for (const lead of leads ?? []) {
        leadMeta.set(lead.id as number, {
          nome: String(lead.nome ?? `Lead #${lead.id}`),
          empresa: lead.empresa ? String(lead.empresa) : null,
          titular: firstName(
            lead.vendedor_responsavel_id ? names.get(String(lead.vendedor_responsavel_id)) : null,
          ),
        })
      }

      return rows.map((row) => {
        const leadId = Number(row.lead_id)
        const meta = leadMeta.get(leadId)
        const respId = row.responsavel_id ? String(row.responsavel_id) : null
        const obraId = row.obra_id ? String(row.obra_id) : null
        return {
          id: String(row.id),
          obra_id: obraId,
          lead_id: leadId,
          stage_id: String(row.stage_id),
          responsavel_id: respId,
          iniciado_em: row.iniciado_em ? String(row.iniciado_em) : null,
          concluido_em: row.concluido_em ? String(row.concluido_em) : null,
          criado_em: String(row.criado_em),
          lead_nome: meta?.nome ?? `Lead #${leadId}`,
          lead_empresa: meta?.empresa ?? null,
          titular_nome: meta?.titular ?? null,
          obra_cliente_nome: obraId ? obraNome.get(obraId) || null : null,
          responsavel_nome: respId ? firstName(names.get(respId)) : null,
        }
      })
    },
  })

  useEffect(() => {
    if (!realtime || !schemaEmpresa) return
    const channel = supabase
      .channel(`obra-producao-${schemaEmpresa}`)
      .on(
        'postgres_changes',
        { event: '*', schema: schemaEmpresa, table: 'obra_producao' },
        () => {
          void queryClient.invalidateQueries({ queryKey: ['obra-producao', schemaEmpresa] })
        },
      )
      .subscribe()
    return () => {
      void supabase.removeChannel(channel)
    }
  }, [queryClient, realtime, schemaEmpresa])

  return query
}

export function useObraProducaoMutations() {
  const db = useEmpresaSupabase()
  const queryClient = useQueryClient()
  const { user } = useAuth()
  const { schemaEmpresa } = useEmpresa()
  const { data: stages = [], isPending: stagesPending } = useProducaoStages()

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ['obra-producao', schemaEmpresa] })
    void queryClient.invalidateQueries({ queryKey: ['obra-producao-chat-board', schemaEmpresa] })
  }

  const mover = useMutation({
    mutationFn: async (input: { id: string; stageId: string }) => {
      const { error } = await db
        .from('obra_producao')
        .update({ stage_id: input.stageId, atualizado_em: new Date().toISOString() })
        .eq('id', input.id)
      if (error) throw error
    },
    onSuccess: () => {
      invalidate()
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const iniciar = useMutation({
    mutationFn: async (id: string) => {
      const stageId = getIniciadoProducaoStageId(stages)
      if (!stageId) {
        throw new Error(
          stagesPending
            ? 'Ainda carregando as colunas. Tente de novo.'
            : 'Não há coluna “Projeto iniciado”.',
        )
      }
      const { error } = await db
        .from('obra_producao')
        .update({
          stage_id: stageId,
          iniciado_em: new Date().toISOString(),
          responsavel_id: user?.id ?? null,
          atualizado_em: new Date().toISOString(),
        })
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      invalidate()
      toast.success('Projeto iniciado')
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const concluir = useMutation({
    mutationFn: async (id: string) => {
      const stageId = getFeitoProducaoStageId(stages)
      if (!stageId) throw new Error('Não há coluna de concluídos.')
      const { error } = await db
        .from('obra_producao')
        .update({
          stage_id: stageId,
          concluido_em: new Date().toISOString(),
          atualizado_em: new Date().toISOString(),
        })
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      invalidate()
      toast.success('Projeto concluído')
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const reabrirPendente = useMutation({
    mutationFn: async (id: string) => {
      const stageId = getPendenteProducaoStageId(stages)
      if (!stageId) throw new Error('Não há coluna pendente.')
      const { error } = await db
        .from('obra_producao')
        .update({
          stage_id: stageId,
          concluido_em: null,
          atualizado_em: new Date().toISOString(),
        })
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      invalidate()
      toast.success('Voltou para pendentes')
    },
    onError: (err: Error) => toast.error(err.message),
  })

  /** Busca lead no sistema e coloca na coluna Pendentes. */
  const puxarLead = useMutation({
    mutationFn: async (leadId: number) => {
      const { data: existing } = await db
        .from('obra_producao')
        .select('id')
        .eq('lead_id', leadId)
        .maybeSingle()
      if (existing?.id) {
        return { already: true as const, leadId, id: String(existing.id) }
      }

      const { data, error } = await supabase.rpc('movelaria_puxar_lead_producao', {
        p_lead_id: leadId,
      })
      if (error) throw error
      return { already: false as const, leadId, id: data ? String(data) : null }
    },
    onSuccess: (result) => {
      invalidate()
      if (result.already) {
        toast.info('Este lead já está no quadro de produção')
      } else {
        toast.success('Lead puxado para Pendentes')
      }
    },
    onError: (err: Error) => toast.error(err.message || 'Não foi possível puxar o lead'),
  })

  return { mover, iniciar, concluir, reabrirPendente, puxarLead }
}

export function useProducaoBuscaLeads(search: string) {
  return useBuscaLeads(search)
}

/** Notas do canal obras neste quadro. */
export function useObraProducaoNotas(obraProducaoId: string | null, options?: { realtime?: boolean }) {
  const db = useEmpresaSupabase()
  const queryClient = useQueryClient()
  const { schemaEmpresa, queriesReady } = useEmpresa()
  const realtime = options?.realtime ?? true

  const query = useQuery({
    queryKey: ['obra-producao-notas', schemaEmpresa, obraProducaoId],
    enabled: queriesReady && Boolean(obraProducaoId),
    queryFn: async (): Promise<ObraProducaoNota[]> => {
      if (!obraProducaoId) return []
      const { data, error } = await db
        .from('obra_producao_notas')
        .select(
          'id, obra_producao_id, lead_id, autor_id, canal, mensagem, tipo, criado_em, imagem_url, file_name, mime_type',
        )
        .eq('obra_producao_id', obraProducaoId)
        .eq('canal', 'obras')
        .order('criado_em', { ascending: true })
      if (error) throw error
      const rows = (data ?? []) as Array<Record<string, unknown>>
      const autorIds = [...new Set(rows.map((r) => String(r.autor_id)))]
      const names = await fetchNomes(db, autorIds)
      const roles = await fetchRolesByUser(db, autorIds)
      return rows.map((row) => mapNota(row, names, roles))
    },
  })

  useEffect(() => {
    if (!realtime || !schemaEmpresa || !obraProducaoId) return
    const channel = supabase
      .channel(`obra-producao-notas-${obraProducaoId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: schemaEmpresa,
          table: 'obra_producao_notas',
          filter: `obra_producao_id=eq.${obraProducaoId}`,
        },
        () => {
          void queryClient.invalidateQueries({
            queryKey: ['obra-producao-notas', schemaEmpresa, obraProducaoId],
          })
          void queryClient.invalidateQueries({ queryKey: ['obra-producao-chat-board', schemaEmpresa] })
        },
      )
      .subscribe()
    return () => {
      void supabase.removeChannel(channel)
    }
  }, [obraProducaoId, queryClient, realtime, schemaEmpresa])

  return query
}

/** Reusa o fio do ateliê (lead_projeto_notas) para o canal vendas. */
export function useProducaoVendasNotas(leadId: number | null, options?: { realtime?: boolean }) {
  const db = useEmpresaSupabase()
  const queryClient = useQueryClient()
  const { schemaEmpresa, queriesReady } = useEmpresa()
  const realtime = options?.realtime ?? true

  const query = useQuery({
    queryKey: ['producao-vendas-notas', schemaEmpresa, leadId],
    enabled: queriesReady && leadId != null,
    queryFn: async (): Promise<ObraProducaoNota[]> => {
      if (leadId == null) return []
      const { data, error } = await db
        .from('lead_projeto_notas')
        .select('id, lead_id, autor_id, mensagem, tipo, criado_em, imagem_url, file_name, mime_type')
        .eq('lead_id', leadId)
        .order('criado_em', { ascending: true })
      if (error) throw error
      const rows = (data ?? []) as Array<Record<string, unknown>>
      const autorIds = [...new Set(rows.map((r) => String(r.autor_id)))]
      const names = await fetchNomes(db, autorIds)
      const roles = await fetchRolesByUser(db, autorIds)
      return rows.map((row) =>
        mapNota(
          {
            ...row,
            obra_producao_id: '',
            canal: 'vendas',
          },
          names,
          roles,
        ),
      )
    },
  })

  useEffect(() => {
    if (!realtime || !schemaEmpresa || leadId == null) return
    const channel = supabase
      .channel(`producao-vendas-notas-${leadId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: schemaEmpresa,
          table: 'lead_projeto_notas',
          filter: `lead_id=eq.${leadId}`,
        },
        () => {
          void queryClient.invalidateQueries({
            queryKey: ['producao-vendas-notas', schemaEmpresa, leadId],
          })
        },
      )
      .subscribe()
    return () => {
      void supabase.removeChannel(channel)
    }
  }, [leadId, queryClient, realtime, schemaEmpresa])

  return query
}

export function useObraProducaoChatBoard(options?: { realtime?: boolean }) {
  const db = useEmpresaSupabase()
  const queryClient = useQueryClient()
  const { schemaEmpresa, queriesReady } = useEmpresa()
  const realtime = options?.realtime ?? false

  const query = useQuery({
    queryKey: ['obra-producao-chat-board', schemaEmpresa],
    enabled: queriesReady,
    queryFn: async (): Promise<ProducaoChatThread[]> => {
      const { data, error } = await db
        .from('obra_producao_notas')
        .select(
          'id, obra_producao_id, lead_id, autor_id, canal, mensagem, tipo, criado_em, imagem_url, file_name, mime_type',
        )
        .eq('canal', 'obras')
        .order('criado_em', { ascending: false })
        .limit(200)
      if (error) throw error
      const rows = (data ?? []) as Array<Record<string, unknown>>
      const lastByCard = new Map<string, Record<string, unknown>>()
      for (const row of rows) {
        const key = String(row.obra_producao_id)
        if (!lastByCard.has(key)) lastByCard.set(key, row)
      }
      const autorIds = [...new Set([...lastByCard.values()].map((r) => String(r.autor_id)))]
      const leadIds = [...new Set([...lastByCard.values()].map((r) => Number(r.lead_id)))]
      const names = await fetchNomes(db, autorIds)
      const roles = await fetchRolesByUser(db, autorIds)
      const leadNames = new Map<number, string>()
      if (leadIds.length > 0) {
        const { data: leads } = await db.from('leads').select('id, nome').in('id', leadIds)
        for (const lead of leads ?? []) {
          leadNames.set(lead.id as number, String(lead.nome ?? `Lead #${lead.id}`))
        }
      }
      return [...lastByCard.entries()].map(([cardId, row]) => {
        const leadId = Number(row.lead_id)
        return {
          obra_producao_id: cardId,
          lead_id: leadId,
          lead_nome: leadNames.get(leadId) ?? `Lead #${leadId}`,
          canal: 'obras' as const,
          last: mapNota(row, names, roles),
        }
      })
    },
  })

  useEffect(() => {
    if (!realtime || !schemaEmpresa) return
    const channel = supabase
      .channel(`obra-producao-chat-board-${schemaEmpresa}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: schemaEmpresa, table: 'obra_producao_notas' },
        () => {
          void queryClient.invalidateQueries({ queryKey: ['obra-producao-chat-board', schemaEmpresa] })
        },
      )
      .subscribe()
    return () => {
      void supabase.removeChannel(channel)
    }
  }, [queryClient, realtime, schemaEmpresa])

  return query
}

export function useObraProducaoChatMutations() {
  const db = useEmpresaSupabase()
  const queryClient = useQueryClient()
  const { user } = useAuth()
  const { schemaEmpresa } = useEmpresa()

  const enviarObras = useMutation({
    mutationFn: async (input: {
      obraProducaoId: string
      leadId: number
      mensagem: string
      file?: File | null
    }) => {
      if (!user?.id) throw new Error('Faça login para escrever no canal.')
      let imagem: { url: string; fileName: string; mimeType: string } | null = null
      if (input.file) {
        imagem = await uploadLeadProjetoChatImage(input.leadId, input.file)
      }
      const mensagem = input.mensagem.trim() || (imagem ? '📷 Imagem' : '')
      const { error } = await db.from('obra_producao_notas').insert({
        obra_producao_id: input.obraProducaoId,
        lead_id: input.leadId,
        autor_id: user.id,
        canal: 'obras',
        mensagem,
        tipo: 'conversa',
        imagem_url: imagem?.url ?? null,
        file_name: imagem?.fileName ?? null,
        mime_type: imagem?.mimeType ?? null,
      })
      if (error) throw error
    },
    onSuccess: (_data, vars) => {
      void queryClient.invalidateQueries({
        queryKey: ['obra-producao-notas', schemaEmpresa, vars.obraProducaoId],
      })
      void queryClient.invalidateQueries({ queryKey: ['obra-producao-chat-board', schemaEmpresa] })
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const enviarVendas = useMutation({
    mutationFn: async (input: { leadId: number; mensagem: string; file?: File | null }) => {
      if (!user?.id) throw new Error('Faça login para escrever no canal.')
      let imagem: { url: string; fileName: string; mimeType: string } | null = null
      if (input.file) {
        imagem = await uploadLeadProjetoChatImage(input.leadId, input.file)
      }
      const mensagem = input.mensagem.trim() || (imagem ? '📷 Imagem' : '')
      const { error } = await db.from('lead_projeto_notas').insert({
        lead_id: input.leadId,
        autor_id: user.id,
        mensagem,
        tipo: 'conversa',
        imagem_url: imagem?.url ?? null,
        file_name: imagem?.fileName ?? null,
        mime_type: imagem?.mimeType ?? null,
      })
      if (error) throw error
    },
    onSuccess: (_data, vars) => {
      void queryClient.invalidateQueries({
        queryKey: ['producao-vendas-notas', schemaEmpresa, vars.leadId],
      })
      void queryClient.invalidateQueries({ queryKey: ['lead-projeto-notas'] })
      void queryClient.invalidateQueries({ queryKey: ['lead-projeto-chat-board'] })
    },
    onError: (err: Error) => toast.error(err.message),
  })

  return { enviarObras, enviarVendas }
}
