export type UserRole = 'Administrador' | 'Financeiro' | 'Marceneiro' | 'Montador' | 'MontadorAdmin'

export interface UserProfile {
  id: string
  email: string
  nome?: string
  perfil: 'administrador' | 'financeiro' | 'marceneiro' | 'montador' | 'montador_admin'
  ativo: boolean
  criado_em: string
}

export type ActiveSection =
  | 'dashboard'
  | 'clientes'
  | 'cobranças'
  | 'fornecedores'
  | 'produtos'
  | 'pedidos'
  | 'aprovacao'
  | 'contasPagar'
  | 'caixaFornecedor'
  | 'biblioteca'
  | 'caixa'
  | 'agendaObras'
  | 'calendarioObras'
  | 'metricasObras'
  | 'configuracoes'

// ── Fornecedor ──────────────────────────────────────────────
export interface Fornecedor {
  id: string
  nome: string
  cnpj_cpf?: string
  telefone?: string
  email?: string
  nome_vendedor?: string
  telefone_vendedor?: string
  /** Teto de compras; contas a pagar pendentes abatem deste valor */
  limite_com_fornecedor?: number
  criado_em?: string
  atualizado_em?: string
}

export type FornecedorInput = Omit<Fornecedor, 'id' | 'criado_em' | 'atualizado_em'>

// ── Produto ─────────────────────────────────────────────────
export interface Produto {
  id: string
  fornecedor_id?: string
  descricao: string
  unidade_medida: string
  especificacoes?: string
  preco_unitario: number
  criado_em?: string
  atualizado_em?: string
  // join
  movelaria_fornecedores?: Pick<Fornecedor, 'id' | 'nome'>
}

export type ProdutoInput = Omit<Produto, 'id' | 'criado_em' | 'atualizado_em' | 'movelaria_fornecedores'>

// ── Pedido ──────────────────────────────────────────────────
export type PedidoStatus = 'aguardando_aprovacao' | 'aprovado' | 'recusado'

export interface PedidoItem {
  id: string
  pedido_id: string
  produto_id?: string
  quantidade: number
  valor_unitario: number
  valor_total: number
  criado_em?: string
  // join
  movelaria_produtos?: Pick<Produto, 'id' | 'descricao' | 'unidade_medida'>
}

export interface Pedido {
  id: string
  fornecedor_id?: string
  status: PedidoStatus
  total: number
  data_pedido: string
  criado_em?: string
  atualizado_em?: string
  // joins
  movelaria_fornecedores?: Pick<Fornecedor, 'id' | 'nome'>
  movelaria_pedidos_itens?: PedidoItem[]
}

// ── Conta a Pagar ───────────────────────────────────────────
export type ContaPagarStatus = 'pendente' | 'pago'

export interface FormaPagamentoPagar {
  id: string
  nome: string
  ordem: number
  ativo: boolean
  criado_em?: string
}

export interface ContaPagar {
  id: string
  pedido_id?: string
  fornecedor_id?: string
  fornecedor_nome?: string
  descricao?: string
  observacao?: string | null
  forma_pagamento_id?: string | null
  valor_total?: number
  numero_parcela: number
  total_parcelas: number
  valor_parcela: number
  data_vencimento: string
  status: ContaPagarStatus
  data_pagamento?: string
  grupo_lancamento_id?: string | null
  recorrente?: boolean
  recorrencia_id?: string | null
  recorrencia_valor_base?: number | null
  recorrencia_encerramento?: string | null
  criado_em?: string
  atualizado_em?: string
  movelaria_formas_pagamento_pagar?: Pick<FormaPagamentoPagar, 'id' | 'nome'> | null
}

export interface ContaPagarAnexo {
  id: string
  grupo_lancamento_id: string
  nome_arquivo: string
  tipo_mime: string
  storage_path: string
  preview_path?: string | null
  criado_em?: string
}

/** Anexo ainda não salvo (formulário de lançamento manual) */
export interface PendingContaPagarAnexo {
  localId: string
  file: File
  nome: string
  tipoMime: string
  kind: 'image' | 'pdf'
  previewUrl: string
  previewBlob?: Blob
}

/** Item exibido na Biblioteca (galeria global de uploads) */
export interface BibliotecaItem {
  id: string
  nome_arquivo: string
  tipo_mime: string
  kind: 'image' | 'pdf'
  previewUrl: string
  criado_em: string
  origem: 'contas_pagar'
  grupo_lancamento_id: string
  contexto?: string
  anexoId: string
}

// ── Caixa Fornecedor ────────────────────────────────────────
export type FormaPagamentoCaixa = 'cheque' | 'dinheiro' | 'cartao' | 'pix'

export interface CaixaFornecedor {
  id: string
  fornecedor_id: string
  saldo_atual: number
  criado_em?: string
  atualizado_em?: string
  movelaria_fornecedores?: Pick<Fornecedor, 'id' | 'nome'>
}

export interface TransacaoCaixaFornecedor {
  id: string
  fornecedor_id: string
  tipo: 'credito' | 'debito'
  valor: number
  forma_pagamento?: FormaPagamentoCaixa
  descricao?: string | null
  conta_pagar_id?: string | null
  saldo_anterior: number
  saldo_posterior: number
  criado_em?: string
}

// ── Cliente ─────────────────────────────────────────────────
export interface Cliente {
  id: string
  nome: string
  cpf?: string
  telefone?: string
  email?: string
  endereco?: string
  origem?: string
  data_cadastro?: string
  criado_em?: string
  atualizado_em?: string
}

export type ClienteInput = Omit<Cliente, 'id' | 'criado_em' | 'atualizado_em'>

// ── Lead Ganho (emp_garbo CRM) ───────────────────────────────
export interface LeadGanho {
  id: string
  nome: string
  telefone?: string
  email?: string
  origem?: string
  observacoes?: string
  status: string
  valor_orcamento?: number
  criado_em?: string
  ja_processado: boolean
}

// ── Orçamento Fechado ────────────────────────────────────────
export type TipoRecebimento = 'a_vista' | 'cartao_parcelado' | 'nosso_parcelamento'

export interface OrcamentoFechado {
  id: string
  lead_id?: string
  cliente_id?: string
  cliente_nome: string
  cliente_telefone?: string
  valor_total: number
  descricao?: string
  tipo_recebimento: TipoRecebimento
  forma_pagamento?: FormaPagamento
  total_parcelas: number
  desconto_cartao_percentual?: number | null
  valor_liquido?: number | null
  observacoes?: string
  criado_em?: string
  atualizado_em?: string
}

// ── Conta a Receber ─────────────────────────────────────────
export type ContaReceberStatus = 'pendente' | 'recebido'
export type FormaPagamento = 'pix' | 'dinheiro' | 'cheque' | 'boleto' | 'cartao'

export interface ContaReceber {
  id: string
  cliente_id?: string
  cliente_nome?: string
  cliente_telefone?: string
  valor_total?: number
  numero_parcela: number
  total_parcelas: number
  valor_parcela: number
  data_vencimento: string
  forma_pagamento: FormaPagamento
  status: ContaReceberStatus
  data_recebimento?: string
  origem_tipo?: 'manual' | 'orcamento_fechado'
  origem_lead_id?: string | null
  criado_em?: string
  atualizado_em?: string
}

// ── Caixa de Pagamentos Adiados (ProForco Model) ────────────
export type TipoDestinatarioCaixa = 'marceneiro' | 'fornecedor' | 'funcionario' | 'outros'
export type TipoMovimentacaoCaixa = 'reserva' | 'pagamento'

export interface CaixaDestinatario {
  id: string
  nome: string
  tipo: TipoDestinatarioCaixa
  dados_bancarios?: any
  observacoes?: string
  ativo: boolean
  criado_em?: string
  atualizado_em?: string
}

export interface CaixaMovimentacao {
  id: string
  destinatario_id: string
  tipo_movimentacao: TipoMovimentacaoCaixa
  valor: number
  data_movimentacao: string
  data_vencimento?: string | null
  mes_referencia: number
  ano_referencia: number
  descricao?: string | null
  comprovante_url?: string | null
  criado_por?: string
  criado_em?: string
  // join
  movelaria_caixa_destinatarios?: Pick<CaixaDestinatario, 'id' | 'nome' | 'tipo'>
}

export interface CaixaSaldoAcumulado {
  id: string
  destinatario_id: string
  mes_referencia: number
  ano_referencia: number
  total_reservado: number
  total_pago: number
  saldo: number
}

export interface ResumoCaixa {
  total_reservado: number
  total_pago: number
  saldo_disponivel: number
  saldo_meses_anteriores: number
}

export interface ReservaConsolidada {
  destinatario_id: string
  destinatario_nome: string
  tipo_destinatario: TipoDestinatarioCaixa
  data_vencimento?: string
  valor_total_real: number      // quanto deve receber (operacional)
  valor_em_reserva: number      // quanto foi reservado no banco
  total_pago: number            // quanto já foi pago
  totalLancamentosMes: number   // qtd lançamentos operacionais
  totalItensConcluidosMes: number // qtd OS/itens concluídos
  mes_referencia: number
  ano_referencia: number
}

// ── Agenda de Obras ──────────────────────────────────────────
export type StatusKanbanObra =
  | 'datas_em_aberto'
  | 'datas_em_atraso'
  | 'datas_definidas'
  | 'em_andamento'
  | 'concluida'
  | 'cancelada'

export interface GrupoObra {
  id: string
  nome: string
  descricao?: string | null
  montador_admin_id?: string | null
  ativo: boolean
  criado_em?: string
  atualizado_em?: string
}

export type GrupoObraInput = Omit<GrupoObra, 'id' | 'criado_em' | 'atualizado_em'>

export interface TipoObra {
  id: string
  nome: string
  descricao?: string | null
  tempo_medio_horas?: number | null
  tempo_maximo_horas_default?: number | null
  ativo: boolean
  criado_em?: string
  atualizado_em?: string
}

export type TipoObraInput = Omit<TipoObra, 'id' | 'criado_em' | 'atualizado_em'>

export interface UsuarioMontador {
  id: string
  email: string
  nome?: string | null
  perfil: string
  ativo: boolean
}

export interface ObraFull {
  id: string
  origem_orcamento_id?: string | null
  origem_lead_id?: string | null
  cliente_id?: string | null
  cliente_nome: string
  lousa?: string | null
  endereco_obra?: string | null
  tipo_obra_id?: string | null
  tipo_obra_nome?: string | null
  grupo_obra_id?: string | null
  grupo_obra_nome?: string | null
  montador_admin_id?: string | null
  montador_admin_nome?: string | null
  montador_id?: string | null
  montador_nome?: string | null
  data_prevista_inicio?: string | null
  data_prevista_fim?: string | null
  tempo_maximo_horas?: number | null
  status_kanban: StatusKanbanObra
  iniciado_em?: string | null
  finalizado_em?: string | null
  concluido_em_atraso?: boolean | null
  criado_em?: string
  atualizado_em?: string
}

export interface ObraInput {
  cliente_nome: string
  cliente_id?: string | null
  lousa?: string | null
  endereco_obra?: string | null
  tipo_obra_id?: string | null
  grupo_obra_id?: string | null
  montador_admin_id?: string | null
  montador_id?: string | null
  data_prevista_inicio?: string | null
  data_prevista_fim?: string | null
  tempo_maximo_horas?: number | null
  status_kanban?: StatusKanbanObra
}

// ── Financeiro Dashboard ────────────────────────────────────
export interface FinanceiroStats {
  clientesAtivos: number
  clientesPendentesContrato: number
  totalAReceber: number
  totalRecebidoMes: number
  totalAtrasado: number
  previsaoProximoMes: number
  previsaoAno: number
  despesasProximoMes: number
  ticketMedio: number // novos clientes do mês (valor plano / qtd)
  ticketMedioGeral: number // média das parcelas do mês
  receitaLiquidaAno: number
  novosClientesMes: number
}

export interface DadoGraficoMensal {
  mes: string
  valor: number
}

export interface DadoGraficoComparativo {
  mes: string
  receitas: number
  despesas: number
}
