export type UserRole = 'Administrador' | 'Financeiro' | 'Marceneiro' | 'Montador' | 'MontadorAdmin' | 'AdministradorObras' | 'Visualizador'

export interface UserProfile {
  id: string
  email: string
  nome?: string
  perfil: 'administrador' | 'financeiro' | 'marceneiro' | 'montador' | 'montador_admin' | 'administrador_obras' | 'visualizador'
  perfis_extras: string[]
  ativo: boolean
  criado_em: string
}

export type ActiveSection =
  | 'dashboard'
  | 'clientes'
  | 'cobranças'
  | 'fornecedores'
  | 'funcionarios'
  | 'contasPagar'
  | 'caixaFornecedor'
  | 'biblioteca'
  | 'caixa'
  | 'agendaObras'
  | 'acompanhamentoObras'
  | 'calendarioObras'
  | 'calendarioChegadaMateriais'
  | 'metricasObras'
  | 'meuFinanceiro'
  | 'meuPerfil'
  | 'baterPonto'
  | 'resumoPonto'
  | 'configuracoes'
  | 'visualizacao'

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
export type ContaPagarStatus = 'pendente' | 'parcialmente_pago' | 'pago'

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
  prestador_id?: string
  obra_id?: string
  descricao?: string
  observacao?: string | null
  forma_pagamento_id?: string | null
  valor_total?: number
  valor_pago?: number
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
  preview_paths?: string[] | null
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
  previewUrls?: string[]
  previewBlobs?: Blob[]
  /** @deprecated use previewBlobs */
  previewBlob?: Blob
}

/** Item exibido na Biblioteca (galeria global de uploads) */
export interface BibliotecaItem {
  id: string
  nome_arquivo: string
  tipo_mime: string
  kind: 'image' | 'pdf'
  previewUrl: string
  previewUrls: string[]
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
  grupo_id?: string | null
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
  conta_pagar_id?: string | null
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

/** Onde o saldo disponível está guardado (banco, conta, caixa físico, etc.) */
export interface CaixaSaldoAlocacao {
  id: string
  mes_referencia: number
  ano_referencia: number
  descricao: string
  valor: number
  criado_por?: string | null
  criado_em?: string
  atualizado_em?: string
}

export interface ReservaConsolidada {
  destinatario_id: string
  destinatario_nome: string
  tipo_destinatario: TipoDestinatarioCaixa
  data_vencimento?: string
  valor_total_real: number      // quanto deve receber (operacional)
  valor_em_reserva: number      // total reservado no caixa
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

export type BriefingPerguntaTipo =
  | 'texto'
  | 'numero'
  | 'multipla_escolha'
  | 'desenho'
  | 'fotos'
  | 'videos'
  | 'pdf'

export type BriefingStatus = 'rascunho' | 'concluido'

export interface BriefingOpcao {
  id: string
  label: string
}

export interface BriefingModelo {
  id: string
  nome: string
  descricao?: string | null
  ordem: number
  ativo: boolean
  criado_por?: string | null
  criado_em?: string
  atualizado_em?: string
  perguntas?: BriefingPergunta[]
}

export type BriefingModeloInput = Omit<BriefingModelo, 'id' | 'criado_em' | 'atualizado_em' | 'perguntas'>

export interface BriefingPergunta {
  id: string
  modelo_id: string
  enunciado: string
  tipo: BriefingPerguntaTipo
  opcoes?: BriefingOpcao[] | null
  obrigatoria: boolean
  texto_ajuda?: string | null
  unidade_padrao?: string | null
  ordem: number
  ativo: boolean
  criado_em?: string
  atualizado_em?: string
}

export type BriefingPerguntaInput = Omit<BriefingPergunta, 'id' | 'criado_em' | 'atualizado_em'>

export interface ObraBriefing {
  id: string
  obra_id: string
  modelo_id: string
  modelo_nome?: string
  status: BriefingStatus
  preenchido_por?: string | null
  criado_em?: string
  atualizado_em?: string
  perguntas?: BriefingPergunta[]
  respostas?: ObraBriefingResposta[]
}

export interface ObraBriefingResposta {
  id: string
  obra_briefing_id: string
  pergunta_id: string
  valor_texto?: string | null
  valor_numero?: number | null
  unidade?: string | null
  valor_opcoes?: string[] | null
  criado_em?: string
  atualizado_em?: string
  anexos?: ObraBriefingAnexo[]
}

export interface ObraBriefingAnexo {
  id: string
  resposta_id: string
  nome_arquivo: string
  tipo_mime: string
  kind: 'image' | 'pdf' | 'video' | 'drawing'
  storage_path: string
  preview_path?: string | null
  preview_paths?: string[] | null
  ordem: number
  criado_por?: string | null
  criado_em?: string
  signedUrl?: string | null
  previewSignedUrl?: string | null
  previewSignedUrls?: string[] | null
}

export interface UsuarioMontador {
  id: string
  email: string
  nome?: string | null
  perfil: string
  ativo: boolean
}

export interface ObraComissaoItem {
  prestador_id: string
  prestador_nome?: string
  valor: number
  oculto_prestador?: boolean
}

export interface ObraMontadorExecucao {
  montador_id: string
  iniciado_em?: string | null
  finalizado_em?: string | null
}

export interface ObraFull {
  id: string
  origem_orcamento_id?: string | null
  origem_lead_id?: string | null
  cliente_id?: string | null
  cliente_nome: string
  lousa?: string | null
  descricao?: string | null
  endereco_obra?: string | null
  tipo_obra_id?: string | null
  tipo_obra_nome?: string | null
  grupo_obra_id?: string | null
  grupo_obra_nome?: string | null
  montador_admin_id?: string | null
  montador_admin_nome?: string | null
  montador_id?: string | null
  montador_nome?: string | null
  montador_ids?: string[]
  montador_nomes?: string[]
  montadores_execucao?: ObraMontadorExecucao[]
  data_prevista_inicio?: string | null
  data_prevista_fim?: string | null
  tempo_maximo_horas?: number | null
  status_kanban: StatusKanbanObra
  iniciado_em?: string | null
  finalizado_em?: string | null
  concluido_em_atraso?: boolean | null
  pedido_material_feito?: boolean
  data_entrega_pedido?: string | null
  numero_pedido_cort_claud?: string | null
  dias_trabalho?: number[] | null
  horario_inicio?: string | null
  horario_fim?: string | null
  comissao_habilitada?: boolean
  comissao_total?: number
  comissao_gerada?: boolean
  comissao_prestador_ids?: string[]
  comissao_prestador_nomes?: string[]
  comissao_valores?: number[]
  comissao_ocultos?: boolean[]
  criado_em?: string
  atualizado_em?: string
}

export interface ObraInput {
  cliente_nome: string
  cliente_id?: string | null
  lousa?: string | null
  descricao?: string | null
  endereco_obra?: string | null
  tipo_obra_id?: string | null
  grupo_obra_id?: string | null
  montador_admin_id?: string | null
  montador_id?: string | null
  montador_ids?: string[]
  data_prevista_inicio?: string | null
  data_prevista_fim?: string | null
  tempo_maximo_horas?: number | null
  status_kanban?: StatusKanbanObra
  pedido_material_feito?: boolean
  data_entrega_pedido?: string | null
  numero_pedido_cort_claud?: string | null
  dias_trabalho?: number[] | null
  horario_inicio?: string | null
  horario_fim?: string | null
  comissao_habilitada?: boolean
  comissao_itens?: ObraComissaoItem[]
}

export interface MetricaObra {
  tipo_obra_id: string
  tipo_obra_nome: string
  total_obras: number
  obras_concluidas: number
  tempo_medio_real_horas: number | null
  tempo_total_real_horas: number | null
  tempo_maximo_horas_default: number | null
  obras_em_atraso: number
  total_comissoes: number
}

export interface MetricasObrasResumo {
  comissao_a_pagar_mes: number
  comissao_em_aberto: number
  comissoes_geradas_mes: number
  obras_concluidas_mes: number
  obras_abertas_comissao: number
  mes_referencia: number
  ano_referencia: number
}

export interface MetricaObraDetalhe {
  obra_id: string
  montador_id: string
  montador_nome: string
  cliente_nome: string
  tipo_obra_nome: string | null
  status_kanban: string
  iniciado_em: string | null
  finalizado_em: string | null
  duracao_horas: number | null
  duracao_em_andamento: boolean
  mes_referencia: string | null
  comissao_habilitada: boolean
  comissao_valor: number
}

export interface MetricaObraMontador {
  montador_id: string
  montador_nome: string
  comissao_concluida: number
  comissao_em_aberto: number
  comissao_gerada: number
  obras_concluidas: number
  obras_em_aberto: number
}

export type PrestadorFinanceiroCategoria = 'comissao' | 'fixo'

export type PrestadorFinanceiroTipo = 'previsto' | 'pagamento'

export interface PrestadorFinanceiroItem {
  tipo: PrestadorFinanceiroTipo
  obra_id?: string | null
  conta_pagar_id?: string | null
  cliente_nome: string
  descricao?: string | null
  valor: number
  status: string
  data_referencia?: string | null
  categoria?: PrestadorFinanceiroCategoria
}

export type MontadorFixoStatusMes = 'pendente' | 'pago' | 'sem_fixo'

export interface MontadorFixoMensal {
  montador_id: string
  montador_nome: string
  valor_fixo_mensal: number
  primeiro_vencimento?: string | null
  status_mes: MontadorFixoStatusMes
  conta_pagar_id?: string | null
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

// ── Funcionários RH ─────────────────────────────────────────
export type FuncionarioTipo =
  | 'montador'
  | 'montador_admin'
  | 'administrador_obras'
  | 'financeiro'

export type FuncionarioAdmissaoStatus = 'pendente' | 'preenchido_funcionario' | 'completo'

export type FuncionarioReciboStatus = 'gerado' | 'aguardando_assinatura' | 'assinado'

export interface FuncionarioAdmissaoDados {
  pis?: string
  endereco?: string
  tem_filhos?: boolean
  filhos_info?: string
  escolaridade?: '1o_grau' | '2o_grau' | 'superior'
  email_pessoal?: string
  data_admissao?: string
  salario?: string
  funcao?: string
  telefone_empresa?: string
  horario_seg_sex?: string
  horario_seg_sab?: string
  trabalha_seg_sex?: boolean
  trabalha_seg_sab?: boolean
  usa_vale_transporte?: boolean
  onibus_1?: string
  valor_onibus_1?: string
  onibus_2?: string
  valor_onibus_2?: string
  documentos_enviados?: Record<string, boolean>
  [key: string]: unknown
}

export interface Funcionario {
  id: string
  nome: string
  cpf?: string | null
  telefone?: string | null
  email?: string | null
  tipo: FuncionarioTipo
  usuario_id?: string | null
  ativo: boolean
  dispensado_em?: string | null
  dispensado_por?: string | null
  admissao_token: string
  admissao_status: FuncionarioAdmissaoStatus
  admissao_dados: FuncionarioAdmissaoDados
  foto_perfil_path?: string | null
  criado_em?: string
  atualizado_em?: string
  recibos_pendentes?: number
  ponto_resumo?: PontoResumoFuncionario
}

export type FuncionarioInput = Pick<Funcionario, 'nome' | 'tipo'> &
  Partial<Pick<Funcionario, 'cpf' | 'telefone' | 'email' | 'usuario_id' | 'ativo' | 'admissao_dados' | 'admissao_status'>>

export interface FuncionarioDocumento {
  id: string
  funcionario_id: string
  categoria: 'admissao' | 'rh' | 'outros' | 'ponto'
  tipo_documento: string
  nome_arquivo: string
  tipo_mime: string
  storage_path: string
  preview_path?: string | null
  preview_paths?: string[] | null
  kind: 'image' | 'pdf'
  origem: 'admin' | 'funcionario_publico' | 'funcionario_sistema'
  criado_em?: string
  signedUrl?: string
  previewSignedUrl?: string
}

export interface PendingFuncionarioDocumento {
  localId: string
  file: File
  nome: string
  tipoMime: string
  kind: 'image' | 'pdf'
  tipoDocumento: string
  categoria: FuncionarioDocumento['categoria']
  previewUrl?: string
  previewUrls?: string[]
  previewBlobs?: Blob[]
}

export interface FuncionarioRecibo {
  id: string
  funcionario_id: string
  conta_pagar_id?: string | null
  conta_pagar_status?: ContaPagarStatus | null
  status: FuncionarioReciboStatus
  texto_recibo: string
  arquivo_original_path?: string | null
  arquivo_assinado_path?: string | null
  valor?: number | null
  data_pagamento?: string | null
  enviado_em?: string | null
  assinado_em?: string | null
  criado_em?: string
  atualizado_em?: string
}

// ── Ponto Eletrônico REP-P ──────────────────────────────────
export type PontoMarcacaoTipo = 'entrada' | 'saida_intervalo' | 'retorno_intervalo' | 'saida'

export type PontoMarcacaoStatus = 'normal' | 'atraso' | 'irregular'

export type PontoOcorrenciaTipo = 'folga' | 'falta' | 'abono'

export type PontoStatusDia = 'pendente' | 'em_dia' | 'atraso' | 'completo' | 'folga' | 'falta'

export interface FuncionarioJornada {
  id: string
  funcionario_id: string
  hora_entrada: string
  hora_saida_intervalo: string
  hora_retorno_intervalo: string
  hora_saida: string
  tolerancia_minutos: number
  dias_uteis: number[]
  ativo: boolean
  criado_em?: string
  atualizado_em?: string
}

export interface PontoMarcacao {
  id: string
  nsr: number
  funcionario_id: string
  usuario_id: string
  tipo: PontoMarcacaoTipo
  registrado_em: string
  latitude?: number | null
  longitude?: number | null
  precisao_metros?: number | null
  foto_path?: string | null
  assinatura_path?: string | null
  comprovante_pdf_path?: string | null
  documento_id?: string | null
  hash_sha256: string
  status: PontoMarcacaoStatus
  atraso_minutos: number
  offline: boolean
  criado_em?: string
}

export interface PontoOcorrencia {
  id: string
  funcionario_id: string
  data: string
  tipo: PontoOcorrenciaTipo
  observacao?: string | null
  automatica: boolean
  registrado_por?: string | null
  criado_em?: string
}

export interface PontoStatusDiaPayload {
  funcionario_id: string
  data: string
  jornada: FuncionarioJornada | null
  proximo_tipo: PontoMarcacaoTipo | null
  ocorrencia: PontoOcorrenciaTipo | null
  status_dia: PontoStatusDia
  marcacoes: PontoMarcacao[]
}

export interface PontoResumoFuncionario {
  hora_entrada?: string | null
  hora_saida?: string | null
  jornada_ativa?: boolean | null
  status_hoje?: PontoStatusDia | null
  batidas_mes?: number | null
}

export interface RepConfig {
  id: string
  razao_social: string
  cnpj: string
  inpi_registro?: string | null
  versao_software: string
  certificado_valido_ate?: string | null
  certificado_path?: string | null
  certificado_configurado?: boolean
  certificado_senha_configurada?: boolean
  certificado_nome?: string | null
  nsr_atual: number
  ativo: boolean
}

export interface RepArquivo {
  id: string
  tipo: 'afd' | 'aej' | 'espelho'
  periodo_inicio: string
  periodo_fim: string
  arquivo_path: string
  assinatura_path?: string | null
  hash_sha256?: string | null
  funcionario_id?: string | null
  criado_em?: string
}

export interface RepConfigInput {
  razao_social: string
  cnpj: string
  inpi_registro?: string | null
  versao_software: string
  certificado_valido_ate?: string | null
  certificado_path?: string | null
  certificado_senha?: string | null
}

export interface PontoMarcacaoComUrls extends PontoMarcacao {
  fotoUrl?: string
  assinaturaUrl?: string
}

export interface PontoControleJornadaResumo {
  hora_entrada?: string | null
  hora_saida_intervalo?: string | null
  hora_retorno_intervalo?: string | null
  hora_saida?: string | null
}

export interface PontoControleFuncionarioRow {
  funcionario_id: string
  nome: string
  tipo: FuncionarioTipo
  hora_prevista?: string | null
  jornada?: PontoControleJornadaResumo | null
  status_dia: PontoStatusDia
  ocorrencia?: string | null
  entrada: PontoMarcacao | null
  marcacoes: PontoMarcacaoComUrls[]
  /** @deprecated Use marcacoes[entrada].fotoUrl */
  fotoUrl?: string
  /** @deprecated Use marcacoes[entrada].assinaturaUrl */
  assinaturaUrl?: string
}

export type PontoResumoPeriodo = 'semana' | 'mes' | 'ano'

export interface PontoResumoChegada {
  data: string
  hora: string
  atraso_minutos: number
}

export interface PontoResumoFuncionarioPeriodo {
  funcionario_id: string
  nome: string
  tipo: FuncionarioTipo
  hora_extra_minutos: number
  faltas: number
  faltas_datas: string[]
  chegadas: PontoResumoChegada[]
}

export interface PontoResumoEmpresa {
  hora_extra_minutos: number
  faltas_total: number
}

export interface PontoResumoPeriodoPayload {
  periodo: PontoResumoPeriodo
  inicio: string
  fim: string
  empresa: PontoResumoEmpresa
  funcionarios: PontoResumoFuncionarioPeriodo[]
}

export interface MeuFuncionarioPayload {
  id: string
  nome: string
  tipo: FuncionarioTipo
  cpf?: string | null
  telefone?: string | null
  email?: string | null
  admissao_status: FuncionarioAdmissaoStatus
  admissao_dados: FuncionarioAdmissaoDados
  foto_perfil_path?: string | null
  documentos: Array<{
    id: string
    tipo_documento: string
    nome_arquivo: string
    kind: 'image' | 'pdf'
    storage_path: string
    preview_path?: string | null
    criado_em?: string
  }>
}
