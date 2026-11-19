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
  /** Limite mensal de tokens de IA (null = sem limite). */
  ia_tokens_limite_mensal: number | null
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
        ia_tokens_limite_mensal: p.ia_tokens_limite_mensal == null ? null : num(p.ia_tokens_limite_mensal),
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

// ── modelos padrão (docs/modelos-padrao) ─────────────────────────────────────────────────────────
export type TipoModelo = 'markup' | 'slides' | 'contrato' | 'apresentacao' | 'pontua'

export interface EmpresaModelo {
  id: string
  nome: string
  slug: string
  segmento: string | null
  status: StatusEmpresa
  criado_em: string
}

export interface ModeloCatalogo {
  id: string
  tipo: TipoModelo
  empresa_modelo_id: string
  empresa_modelo_nome: string
  segmento: string | null
  ref_id: string | null
  nome: string
  descricao: string | null
  publicado: boolean
  versao: number
  atualizado_em: string
  contagem: Record<string, number | boolean | string | null>
  entregas: number
  planos: string[]
}

export interface EntregaModelo {
  id: string
  modelo_id: string
  modelo_nome: string
  tipo: TipoModelo
  empresa_id: string
  empresa_nome: string
  versao: number
  entregue_em: string
  resumo: Record<string, unknown>
}

export interface ResultadoEnvio {
  empresa_id: string
  empresa: string | null
  ok: boolean
  resumo?: Record<string, unknown>
  erro?: string
}

export function useEmpresasModelo() {
  return useQuery({
    queryKey: ['master', 'modelos', 'empresas'],
    queryFn: () => rpc<EmpresaModelo[]>('master_listar_empresas_modelo'),
  })
}

/** Catálogo (a RPC sincroniza com o que as empresas-modelo têm antes de listar). */
export function useModelosCatalogo() {
  return useQuery({
    queryKey: ['master', 'modelos', 'catalogo'],
    queryFn: async () => {
      const rows = await rpc<ModeloCatalogo[]>('master_listar_modelos', { p_empresa_modelo: null })
      return (rows ?? []).map((r) => ({ ...r, contagem: r.contagem ?? {}, planos: r.planos ?? [] }))
    },
  })
}

export function useEntregasModelos(modeloId?: string) {
  return useQuery({
    queryKey: ['master', 'modelos', 'entregas', modeloId ?? 'todas'],
    queryFn: () => rpc<EntregaModelo[]>('master_listar_entregas', { p_modelo: modeloId ?? null, p_limite: 200 }),
  })
}

export function useCriarEmpresaModelo() {
  const invalidar = useInvalidarMaster()
  return useMutation({
    mutationFn: (i: { nome: string; slug: string; segmento?: string | null; importarDe?: string | null }) =>
      rpc<string>('master_criar_empresa_modelo', {
        p_nome: i.nome,
        p_slug: i.slug,
        p_segmento: i.segmento ?? null,
        p_importar_de: i.importarDe ?? null,
      }),
    onSuccess: invalidar,
  })
}

export function useAtualizarEmpresaModelo() {
  const invalidar = useInvalidarMaster()
  return useMutation({
    mutationFn: (i: { empresaId: string; nome: string; segmento: string | null }) =>
      rpc<void>('master_atualizar_empresa_modelo', { p_empresa: i.empresaId, p_nome: i.nome, p_segmento: i.segmento }),
    onSuccess: invalidar,
  })
}

export function usePublicarModelo() {
  const invalidar = useInvalidarMaster()
  return useMutation({
    mutationFn: (i: { modeloId: string; publicado: boolean; descricao?: string | null }) =>
      rpc<void>('master_publicar_modelo', { p_modelo: i.modeloId, p_publicado: i.publicado, p_descricao: i.descricao ?? null }),
    onSuccess: invalidar,
  })
}

/** Interface da página Pontua do pacote de uma empresa-modelo (sem_marca | classica). */
export function useDefinirPontuaInterface() {
  const invalidar = useInvalidarMaster()
  return useMutation({
    mutationFn: (i: { empresaModeloId: string; interface: string }) =>
      rpc<{ interface: string }>('master_definir_pontua_interface', {
        p_empresa_modelo: i.empresaModeloId,
        p_interface: i.interface,
      }),
    onSuccess: invalidar,
  })
}

export function useSalvarModelosPlano() {
  const invalidar = useInvalidarMaster()
  return useMutation({
    mutationFn: (i: { planoId: string; modelos: string[] }) =>
      rpc<void>('master_salvar_modelos_plano', { p_plano: i.planoId, p_modelos: i.modelos }),
    onSuccess: invalidar,
  })
}

export function useEnviarModelo() {
  const invalidar = useInvalidarMaster()
  return useMutation({
    mutationFn: (i: { modeloId: string; empresas: string[] }) =>
      rpc<ResultadoEnvio[]>('master_enviar_modelo', { p_modelo: i.modeloId, p_empresas: i.empresas }),
    onSuccess: invalidar,
  })
}

// ── motor de IA do card do lead (docs/ia-lead, ADR 0007) ─────────────────────────────────────────
export interface MotorIa {
  ativo: boolean
  render_ativo: boolean
  render_ambiente_ativo: boolean
  vision_model: string
  image_model: string
  render_analysis_prompt: string | null
  render_prompt: string | null
  render_ambiente_analysis_prompt: string | null
  render_ambiente_prompt: string | null
  tokens_por_imagem_fixa: number
  /** A chave nunca chega ao navegador: só se existe e o final dela. */
  chave_configurada: boolean
  chave_final4: string | null
  chave_atualizada_em: string | null
}

export type MotorIaEdicao = Omit<MotorIa, 'chave_configurada' | 'chave_final4' | 'chave_atualizada_em'>

export interface ConsumoIaEmpresa {
  empresa_id: string
  nome: string
  plano_nome: string | null
  funcao_liberada: boolean
  modo: 'plano' | 'personalizado' | 'sem_limite'
  limite: number | null
  usado: number
  custo_usd: number
  usos: number
}

export interface ConsumoIaDetalhe {
  meses: Array<{ mes: string; tokens: number; custo_usd: number }>
  por_funcao: Array<{ funcao: string; tokens: number; custo_usd: number }>
  por_modelo: Array<{ modelo: string; tokens: number; custo_usd: number }>
}

export interface UsoIa {
  id: number
  funcao: string
  etapa: 'visao' | 'imagem'
  modelo: string
  lead_id: number | null
  tokens_total: number
  estimado: boolean
  custo_usd: number
  criado_em: string
}

export interface PrecoIa {
  modelo: string
  usd_por_milhao_entrada: number
  usd_por_milhao_saida: number
  usd_por_imagem: number
}

export function useMotorIa() {
  return useQuery({
    queryKey: ['master', 'ia', 'motor'],
    queryFn: () => rpc<MotorIa>('master_ia_motor_obter'),
  })
}

export function useSalvarMotorIa() {
  const invalidar = useInvalidarMaster()
  return useMutation({
    mutationFn: (m: MotorIaEdicao) => rpc<void>('master_ia_motor_salvar', { p: m as unknown as Record<string, unknown> }),
    onSuccess: invalidar,
  })
}

export function useSalvarChaveMotorIa() {
  const invalidar = useInvalidarMaster()
  return useMutation({
    mutationFn: (chave: string) => rpc<void>('master_ia_motor_salvar_chave', { p_chave: chave }),
    onSuccess: invalidar,
  })
}

export function useLimparChaveMotorIa() {
  const invalidar = useInvalidarMaster()
  return useMutation({
    mutationFn: () => rpc<void>('master_ia_motor_limpar_chave'),
    onSuccess: invalidar,
  })
}

/** `mes` = qualquer dia do mês (YYYY-MM-DD); omitido = mês atual. */
export function useConsumoIaEmpresas(mes?: string) {
  return useQuery({
    queryKey: ['master', 'ia', 'consumo', mes ?? 'atual'],
    queryFn: async () => {
      const rows = await rpc<ConsumoIaEmpresa[]>('master_ia_consumo_empresas', { p_mes: mes ?? null })
      return (rows ?? []).map((r) => ({
        ...r,
        limite: r.limite == null ? null : num(r.limite),
        usado: num(r.usado),
        custo_usd: num(r.custo_usd),
        usos: num(r.usos),
      }))
    },
  })
}

export function useConsumoIaEmpresa(empresaId: string | undefined, meses = 6) {
  return useQuery({
    queryKey: ['master', 'ia', 'consumo-empresa', empresaId, meses],
    queryFn: () => rpc<ConsumoIaDetalhe>('master_ia_consumo_empresa', { p_empresa: empresaId, p_meses: meses }),
    enabled: !!empresaId,
  })
}

export function useUsoIaRecente(empresaId: string | undefined) {
  return useQuery({
    queryKey: ['master', 'ia', 'uso-recente', empresaId],
    queryFn: () => rpc<UsoIa[]>('master_ia_uso_recente', { p_empresa: empresaId, p_limite: 50 }),
    enabled: !!empresaId,
  })
}

export function usePrecosIa() {
  return useQuery({
    queryKey: ['master', 'ia', 'precos'],
    queryFn: async () => {
      const { data, error } = await tabela('plataforma_ia_precos').select('*').order('modelo')
      if (error) throw new Error(error.message)
      return ((data ?? []) as unknown as PrecoIa[]).map((p) => ({
        modelo: p.modelo,
        usd_por_milhao_entrada: num(p.usd_por_milhao_entrada),
        usd_por_milhao_saida: num(p.usd_por_milhao_saida),
        usd_por_imagem: num(p.usd_por_imagem),
      }))
    },
  })
}

export function useSalvarPrecosIa() {
  const invalidar = useInvalidarMaster()
  return useMutation({
    mutationFn: (p: PrecoIa[]) => rpc<void>('master_ia_precos_salvar', { p: p as unknown as Record<string, unknown> }),
    onSuccess: invalidar,
  })
}

export function useSalvarLimiteIaPlano() {
  const invalidar = useInvalidarMaster()
  return useMutation({
    mutationFn: (i: { planoId: string; limite: number | null }) =>
      rpc<void>('master_ia_salvar_limite_plano', { p_plano: i.planoId, p_limite: i.limite ?? 0 }),
    onSuccess: invalidar,
  })
}

export function useSalvarLimiteIaEmpresa() {
  const invalidar = useInvalidarMaster()
  return useMutation({
    mutationFn: (i: { empresaId: string; modo: 'plano' | 'personalizado' | 'sem_limite'; limite?: number | null }) =>
      rpc<void>('master_ia_salvar_limite_empresa', { p_empresa: i.empresaId, p_modo: i.modo, p_limite: i.limite ?? null }),
    onSuccess: invalidar,
  })
}

/** Limite e modo da empresa (para o seletor na aba "IA e tokens"). */
export function useLimiteIaEmpresa(empresaId: string | undefined) {
  return useQuery({
    queryKey: ['master', 'ia', 'limite-empresa', empresaId],
    queryFn: async () => {
      const { data, error } = await tabela('plataforma_empresa_ia').select('*').eq('empresa_id', empresaId as string).maybeSingle()
      if (error) throw new Error(error.message)
      const r = data as unknown as { modo: 'plano' | 'personalizado' | 'sem_limite'; tokens_limite_mensal: number | null } | null
      return { modo: r?.modo ?? 'plano', limite: r?.tokens_limite_mensal == null ? null : num(r.tokens_limite_mensal) }
    },
    enabled: !!empresaId,
  })
}
