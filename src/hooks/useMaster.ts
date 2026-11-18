/**
 * Dados do Painel Master e do Financeiro Master (plataforma multi-empresa).
 * Tudo aqui exige o usuário master: as RPCs `master_*` e as tabelas `plataforma_*` recusam qualquer outro.
 * As RPCs/tabelas novas ainda não estão em `src/integrations/supabase/types.ts`, por isso o acesso passa
 * pelos helpers `rpc`/`tabela`, que tipam o retorno explicitamente.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

// ── helpers sem tipos gerados ────────────────────────────────────────────────────────────────────
type RpcResult<T> = { data: T | null; error: { message: string } | null }
async function rpc<T>(fn: string, args?: Record<string, unknown>): Promise<T> {
  const call = supabase.rpc as unknown as (f: string, a?: Record<string, unknown>) => Promise<RpcResult<T>>
  const { data, error } = await call.call(supabase, fn, args)
  if (error) throw new Error(error.message)
  return data as T
}
function tabela(nome: string) {
  // Tabela fora dos tipos gerados: o cast é localizado aqui e os retornos são tipados nos hooks.
  return (supabase.from as unknown as (t: string) => ReturnType<typeof supabase.from>)(nome)
}

// ── tipos ────────────────────────────────────────────────────────────────────────────────────────
export type StatusEmpresa = 'ativa' | 'bloqueada' | 'inativa'
export type SituacaoMensalidade = 'em_dia' | 'vencida' | 'bloqueada' | 'sem_assinatura'

export interface MasterEmpresaResumo {
  empresa_id: string
  nome: string
  slug: string
  status: StatusEmpresa
  ativo: boolean
  cnpj: string | null
  criado_em: string
  admins: { id: string; nome: string | null; email: string }[]
  total_usuarios: number
  faturamento: number
  plano: string | null
  valor_mensal: number | null
  situacao_mensalidade: SituacaoMensalidade
  cobrancas_vencidas: number
  valor_vencido: number
}

export interface MasterEmpresaLista {
  id: string
  nome: string
  slug: string
  status: StatusEmpresa
  logo_url: string | null
}

export interface FaturamentoMensal {
  empresa_id: string
  empresa_nome: string
  mes: string
  faturamento: number
}

export interface MasterUsuarioEmpresa {
  user_id: string
  nome: string | null
  email: string | null
  perfil: string | null
  ativo: boolean
  crm_roles: string[]
  ultimo_acesso: string | null
}

export interface Plano {
  id: string
  nome: string
  valor_mensal: number
  descricao: string | null
  ativo: boolean
  /** Páginas que o plano NÃO inclui (ids de `src/lib/paginas-catalogo.ts`). */
  paginas_bloqueadas: string[]
}

export interface PaginasEmpresa {
  plano_id: string | null
  plano_nome: string | null
  plano_bloqueadas: string[]
  /** Ajustes da empresa sobre o plano: true = liberada, false = bloqueada. */
  ajustes: Record<string, boolean>
  bloqueadas: string[]
}

export interface AcessoMaster {
  id: string
  empresa_id: string
  empresa_nome: string
  usuario_email: string | null
  somente_leitura: boolean
  inicio: string
  fim: string | null
}

export interface FormaPagamentoPlataforma {
  id: string
  nome: string
  ordem: number
  ativo: boolean
}

export interface Assinatura {
  id: string
  empresa_id: string
  plano_id: string | null
  valor: number
  dia_vencimento: number
  dias_tolerancia: number
  inicio: string
  status: 'ativa' | 'suspensa' | 'cancelada'
  liberado_ate: string | null
  observacao: string | null
}

export interface Cobranca {
  id: string
  empresa_id: string
  competencia: string
  valor: number
  vencimento: string
  status: 'pendente' | 'paga' | 'vencida' | 'cancelada'
  pago_em: string | null
  valor_pago: number | null
  forma_pagamento_id: string | null
  observacao: string | null
}

const num = (v: unknown) => (v === null || v === undefined ? 0 : Number(v))

// ── empresas ─────────────────────────────────────────────────────────────────────────────────────
export function useMasterEmpresas(enabled = true) {
  return useQuery({
    queryKey: ['master', 'empresas'],
    queryFn: () => rpc<MasterEmpresaLista[]>('master_listar_empresas'),
    enabled,
    staleTime: 60_000,
  })
}

export function useMasterResumo(inicio: string, fim: string) {
  return useQuery({
    queryKey: ['master', 'resumo', inicio, fim],
    queryFn: async () => {
      const rows = await rpc<MasterEmpresaResumo[]>('master_resumo_empresas', { p_inicio: inicio, p_fim: fim })
      return (rows ?? []).map((r) => ({
        ...r,
        admins: Array.isArray(r.admins) ? r.admins : [],
        faturamento: num(r.faturamento),
        valor_mensal: r.valor_mensal === null ? null : num(r.valor_mensal),
        valor_vencido: num(r.valor_vencido),
      }))
    },
  })
}

export function useMasterFaturamentoMensal(meses = 12) {
  return useQuery({
    queryKey: ['master', 'faturamento-mensal', meses],
    queryFn: async () => {
      const rows = await rpc<FaturamentoMensal[]>('master_faturamento_mensal', { p_meses: meses })
      return (rows ?? []).map((r) => ({ ...r, faturamento: num(r.faturamento) }))
    },
  })
}

export function useMasterUsuariosEmpresa(empresaId: string | undefined) {
  return useQuery({
    queryKey: ['master', 'usuarios', empresaId],
    queryFn: () => rpc<MasterUsuarioEmpresa[]>('master_usuarios_empresa', { p_empresa_id: empresaId }),
    enabled: !!empresaId,
  })
}

function useInvalidarMaster() {
  const qc = useQueryClient()
  return () => qc.invalidateQueries({ queryKey: ['master'] })
}

export interface NovaEmpresaInput {
  nome: string
  slug: string
  cnpj?: string
  razaoSocial?: string
  corPrimaria?: string
  adminNome: string
  adminEmail: string
  adminSenha: string
  planoId?: string | null
  valorMensal?: number | null
  diaVencimento?: number
}

export function useCriarEmpresa() {
  const invalidar = useInvalidarMaster()
  return useMutation({
    mutationFn: (i: NovaEmpresaInput) =>
      rpc<string>('master_criar_empresa', {
        p_nome: i.nome,
        p_slug: i.slug,
        p_admin_email: i.adminEmail,
        p_admin_nome: i.adminNome,
        p_admin_senha: i.adminSenha,
        p_cnpj: i.cnpj || null,
        p_razao_social: i.razaoSocial || null,
        p_cor_primaria: i.corPrimaria || null,
        p_plano_id: i.planoId || null,
        p_valor_mensal: i.valorMensal ?? null,
        p_dia_vencimento: i.diaVencimento ?? 10,
      }),
    onSuccess: invalidar,
  })
}

export function useAtualizarEmpresa() {
  const invalidar = useInvalidarMaster()
  return useMutation({
    mutationFn: (i: { id: string; nome: string; cnpj?: string; razaoSocial?: string; corPrimaria?: string }) =>
      rpc<void>('master_atualizar_empresa', {
        p_empresa_id: i.id,
        p_nome: i.nome,
        p_cnpj: i.cnpj || null,
        p_razao_social: i.razaoSocial || null,
        p_cor_primaria: i.corPrimaria || null,
      }),
    onSuccess: invalidar,
  })
}

export function useDefinirStatusEmpresa() {
  const invalidar = useInvalidarMaster()
  return useMutation({
    mutationFn: (i: { id: string; status: StatusEmpresa; liberadoAte?: string | null }) =>
      rpc<void>('master_definir_status_empresa', {
        p_empresa_id: i.id,
        p_status: i.status,
        p_liberado_ate: i.liberadoAte ?? null,
      }),
    onSuccess: invalidar,
  })
}

export function useDefinirAdminEmpresa() {
  const invalidar = useInvalidarMaster()
  return useMutation({
    mutationFn: (i: { empresaId: string; email: string; nome: string; senha?: string }) =>
      rpc<string>('master_definir_admin_empresa', {
        p_empresa_id: i.empresaId,
        p_admin_email: i.email,
        p_admin_nome: i.nome,
        p_admin_senha: i.senha || null,
      }),
    onSuccess: invalidar,
  })
}

export function useRedefinirSenhaUsuario() {
  return useMutation({
    mutationFn: (i: { userId: string; senha: string }) =>
      rpc<void>('movelaria_redefinir_senha', { p_id: i.userId, p_senha: i.senha }),
  })
}

// ── financeiro master ────────────────────────────────────────────────────────────────────────────
export function usePlanos() {
  return useQuery({
    queryKey: ['master', 'planos'],
    queryFn: async () => {
      const { data, error } = await tabela('plataforma_planos').select('*').order('valor_mensal')
      if (error) throw new Error(error.message)
      return ((data ?? []) as unknown as Plano[]).map((p) => ({
        ...p,
        valor_mensal: num(p.valor_mensal),
        paginas_bloqueadas: Array.isArray(p.paginas_bloqueadas) ? p.paginas_bloqueadas : [],
      }))
    },
  })
}

export function useSalvarPlano() {
  const invalidar = useInvalidarMaster()
  return useMutation({
    mutationFn: async (p: Partial<Plano> & { nome: string; valor_mensal: number }) => {
      const payload = { nome: p.nome, valor_mensal: p.valor_mensal, descricao: p.descricao ?? null, ativo: p.ativo ?? true }
      const q = p.id ? tabela('plataforma_planos').update(payload as never).eq('id', p.id) : tabela('plataforma_planos').insert(payload as never)
      const { error } = await q
      if (error) throw new Error(error.message)
    },
    onSuccess: invalidar,
  })
}

export function useFormasPagamentoPlataforma() {
  return useQuery({
    queryKey: ['master', 'formas-pagamento'],
    queryFn: async () => {
      const { data, error } = await tabela('plataforma_formas_pagamento').select('*').order('ordem')
      if (error) throw new Error(error.message)
      return (data ?? []) as unknown as FormaPagamentoPlataforma[]
    },
  })
}

export function useSalvarFormaPagamento() {
  const invalidar = useInvalidarMaster()
  return useMutation({
    mutationFn: async (f: Partial<FormaPagamentoPlataforma> & { nome: string }) => {
      const payload = { nome: f.nome, ordem: f.ordem ?? 0, ativo: f.ativo ?? true }
      const q = f.id
        ? tabela('plataforma_formas_pagamento').update(payload as never).eq('id', f.id)
        : tabela('plataforma_formas_pagamento').insert(payload as never)
      const { error } = await q
      if (error) throw new Error(error.message)
    },
    onSuccess: invalidar,
  })
}

export function useAssinaturas() {
  return useQuery({
    queryKey: ['master', 'assinaturas'],
    queryFn: async () => {
      const { data, error } = await tabela('plataforma_assinaturas').select('*')
      if (error) throw new Error(error.message)
      return ((data ?? []) as unknown as Assinatura[]).map((a) => ({ ...a, valor: num(a.valor) }))
    },
  })
}

export function useSalvarAssinatura() {
  const invalidar = useInvalidarMaster()
  return useMutation({
    mutationFn: async (a: Partial<Assinatura> & { empresa_id: string; valor: number }) => {
      const payload = {
        empresa_id: a.empresa_id,
        plano_id: a.plano_id ?? null,
        valor: a.valor,
        dia_vencimento: a.dia_vencimento ?? 10,
        dias_tolerancia: a.dias_tolerancia ?? 10,
        status: a.status ?? 'ativa',
        liberado_ate: a.liberado_ate ?? null,
        observacao: a.observacao ?? null,
        atualizado_em: new Date().toISOString(),
      }
      const { error } = await tabela('plataforma_assinaturas').upsert(payload as never, { onConflict: 'empresa_id' })
      if (error) throw new Error(error.message)
    },
    onSuccess: invalidar,
  })
}

export function useCobrancas(filtro: { inicio?: string; fim?: string; status?: string; empresaId?: string }) {
  return useQuery({
    queryKey: ['master', 'cobrancas', filtro],
    queryFn: async () => {
      let q = tabela('plataforma_cobrancas').select('*').order('vencimento', { ascending: false })
      if (filtro.inicio) q = q.gte('vencimento', filtro.inicio)
      if (filtro.fim) q = q.lte('vencimento', filtro.fim)
      if (filtro.status && filtro.status !== 'todas') q = q.eq('status', filtro.status)
      if (filtro.empresaId && filtro.empresaId !== 'todas') q = q.eq('empresa_id', filtro.empresaId)
      const { data, error } = await q
      if (error) throw new Error(error.message)
      return ((data ?? []) as unknown as Cobranca[]).map((c) => ({
        ...c,
        valor: num(c.valor),
        valor_pago: c.valor_pago === null ? null : num(c.valor_pago),
      }))
    },
  })
}

export function useDarBaixaCobranca() {
  const invalidar = useInvalidarMaster()
  return useMutation({
    mutationFn: (i: { cobrancaId: string; formaPagamentoId: string; pagoEm: string; valorPago?: number | null; observacao?: string }) =>
      rpc<void>('master_dar_baixa_cobranca', {
        p_cobranca_id: i.cobrancaId,
        p_forma_pagamento_id: i.formaPagamentoId,
        p_pago_em: i.pagoEm,
        p_valor_pago: i.valorPago ?? null,
        p_observacao: i.observacao || null,
      }),
    onSuccess: invalidar,
  })
}

export function useCancelarCobranca() {
  const invalidar = useInvalidarMaster()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await tabela('plataforma_cobrancas')
        .update({ status: 'cancelada', atualizado_em: new Date().toISOString() } as never)
        .eq('id', id)
      if (error) throw new Error(error.message)
    },
    onSuccess: invalidar,
  })
}

/** Gera as cobranças do mês e atualiza vencidas/bloqueios (o mesmo que o job diário faz). */
export function useProcessarCobrancas() {
  const invalidar = useInvalidarMaster()
  return useMutation({
    mutationFn: async () => {
      const geradas = await rpc<number>('plataforma_gerar_cobrancas')
      const r = await rpc<{ vencidas: number; bloqueadas: number; desbloqueadas: number }>('plataforma_atualizar_inadimplencia')
      return { geradas, ...r }
    },
    onSuccess: invalidar,
  })
}

// ── páginas por plano/empresa e acessos (Fase I) ─────────────────────────────────────────────────
export function usePaginasEmpresa(empresaId: string | undefined) {
  return useQuery({
    queryKey: ['master', 'paginas-empresa', empresaId],
    enabled: !!empresaId,
    queryFn: async (): Promise<PaginasEmpresa> => {
      const rows = await rpc<PaginasEmpresa[]>('master_paginas_empresa', { p_empresa: empresaId })
      const r = rows?.[0]
      return {
        plano_id: r?.plano_id ?? null,
        plano_nome: r?.plano_nome ?? null,
        plano_bloqueadas: r?.plano_bloqueadas ?? [],
        ajustes: (r?.ajustes as Record<string, boolean> | undefined) ?? {},
        bloqueadas: r?.bloqueadas ?? [],
      }
    },
  })
}

export function useSalvarPaginasEmpresa() {
  const invalidar = useInvalidarMaster()
  return useMutation({
    mutationFn: (i: { empresaId: string; ajustes: Record<string, boolean> }) =>
      rpc<void>('master_salvar_paginas_empresa', { p_empresa: i.empresaId, p_ajustes: i.ajustes }),
    onSuccess: invalidar,
  })
}

export function useSalvarPaginasPlano() {
  const invalidar = useInvalidarMaster()
  return useMutation({
    mutationFn: (i: { planoId: string; bloqueadas: string[] }) =>
      rpc<void>('master_salvar_paginas_plano', { p_plano: i.planoId, p_bloqueadas: i.bloqueadas }),
    onSuccess: invalidar,
  })
}

export function useAcessosMaster(empresaId?: string) {
  return useQuery({
    queryKey: ['master', 'acessos', empresaId ?? 'todas'],
    queryFn: () => rpc<AcessoMaster[]>('master_listar_acessos', { p_empresa: empresaId ?? null, p_limite: 300 }),
  })
}
