export type UserRole = 'Administrador' | 'Financeiro' | 'Marceneiro'

export interface UserProfile {
  id: string
  email: string
  nome?: string
  perfil: 'administrador' | 'financeiro' | 'marceneiro'
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
