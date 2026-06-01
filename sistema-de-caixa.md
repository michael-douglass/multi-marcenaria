Implemente um módulo de CAIXA DE PAGAMENTOS ADIADOS, inspirado no sistema ProForco 
(aba Financeiro → Caixa). O objetivo é controlar dinheiro RESERVADO no banco 
para pagar destinatários depois, com visão de quanto falta pagar com base no 
trabalho/despesa real do mês.

================================================================================
1. CONCEITO DE NEGÓCIO (OBRIGATÓRIO ENTENDER)
================================================================================

Existem DOIS eixos de valores que NÃO devem ser confundidos:

A) VALOR TOTAL REAL (dívida operacional do mês)
   - Quanto o destinatário TEM DIREITO a receber na competência (mês/ano).
   - No ProForco:
     • Tipo "professor": soma de transações de aulas online + horas presenciais 
       no intervalo do mês (data_aula entre 1º e último dia do mês).
     • Outros tipos (fornecedor, funcionário): soma de despesas cadastradas 
       no financeiro, casadas pelo NOME da despesa = nome do destinatário.
   - ADAPTAÇÃO MARCENARIA:
     • Tipo "marceneiro" ou "producao": soma de comissões/horas/OS concluídas no mês.
     • Tipo "fornecedor": soma de despesas de material (MDF, ferragens, etc.).
     • Tipo "funcionario": salários/comissões fixas cadastradas em despesas.

B) MOVIMENTAÇÕES DE CAIXA (reserva e pagamento)
   - RESERVA: dinheiro que entrou/separou no banco para pagar alguém no futuro.
   - PAGAMENTO: dinheiro que saiu de fato para o destinatário.
   - Cada movimentação tem: destinatário, valor, data, mês_referencia, ano_referencia.

C) SALDO POR DESTINATÁRIO/MÊS (calculado automaticamente no banco)
   - total_reservado = SOMA de movimentações tipo 'reserva'
   - total_pago      = SOMA de movimentações tipo 'pagamento'
   - saldo           = total_reservado - total_pago
   - Este saldo = quanto ainda está GUARDADO na caixinha para aquele destinatário.

D) VALOR RESTANTE A PAGAR (calculado na UI, por linha)
   - valor_restante = valor_total_real - total_pago
   - Mostra quanto falta pagar ao destinatário com base no que ele MERECE, 
     não apenas no que foi reservado.

E) CARDS DE RESUMO DO MÊS (topo da tela)
   - Total Reservado   = SOMA(total_reservado) de todos destinatários no mês
   - Total Pago        = SOMA(total_pago) de todos destinatários no mês
   - Saldo Disponível  = SOMA(saldo) do mês = Reservado - Pago (mês atual)
   - (Opcional) Saldo meses anteriores = SOMA(saldo) de meses anteriores

================================================================================
2. MODELO DE DADOS (3 TABELAS + TRIGGER)
================================================================================

Tabela: caixa_destinatarios
- id UUID PK
- nome TEXT NOT NULL
- tipo TEXT NOT NULL  -- 'marceneiro'|'fornecedor'|'funcionario'|'outros'
- dados_bancarios JSONB DEFAULT '{}'
- observacoes TEXT
- ativo BOOLEAN DEFAULT true
- criado_em, atualizado_em

Tabela: caixa_movimentacoes
- id UUID PK
- destinatario_id UUID FK → caixa_destinatarios
- tipo_movimentacao TEXT NOT NULL  -- 'reserva' | 'pagamento'
- valor NUMERIC(12,2) NOT NULL
- data_movimentacao DATE NOT NULL
- data_vencimento DATE NULL  -- opcional, para exibir vencimento na tabela
- mes_referencia INTEGER (1-12)
- ano_referencia INTEGER (>= 2020)
- descricao TEXT
- comprovante_url TEXT
- criado_por UUID (usuário logado)
- criado_em TIMESTAMPTZ

Tabela: caixa_saldo_acumulado (materializada por trigger, NÃO editar manualmente)
- id UUID PK
- destinatario_id UUID FK
- mes_referencia, ano_referencia
- total_reservado NUMERIC DEFAULT 0
- total_pago NUMERIC DEFAULT 0
- saldo NUMERIC DEFAULT 0
- UNIQUE(destinatario_id, mes_referencia, ano_referencia)

TRIGGER recalcular_saldo_caixa() — AFTER INSERT/UPDATE/DELETE em caixa_movimentacoes:
  Para o par (destinatario_id, mes, ano) afetado:
    total_reservado = SUM(valor WHERE tipo = 'reserva')
    total_pago      = SUM(valor WHERE tipo = 'pagamento')
    saldo           = SUM(CASE tipo WHEN 'reserva' THEN valor ELSE -valor END)
  UPSERT em caixa_saldo_acumulado.

RLS: apenas admin e financeiro podem ler/inserir.

================================================================================
3. SINCRONIZAÇÃO AUTOMÁTICA (OPCIONAL MAS RECOMENDADO)
================================================================================

Trigger sync_pagamento_para_caixa() — AFTER INSERT em pagamentos de despesas:
  Quando alguém registra um pagamento de despesa no financeiro:
  1. Busca a despesa (tipo, descrição, professor_id/marceneiro_id, mês/ano)
  2. Resolve ou cria destinatário pelo NOME (match exato trim)
  3. Insere movimentação tipo 'reserva' com o valor pago
  → Assim, quando dinheiro entra no fluxo financeiro, automaticamente vira reserva no caixa.

No ProForco isso liga fin_pagamentos_despesas → caixa_movimentacoes.

Adaptação marcenaria: pagamentos_despesas → caixa (fornecedor/material) 
ou pagamentos_comissao → caixa (marceneiro).

================================================================================
4. TELA PRINCIPAL — ESTRUTURA UI
================================================================================

Componente: CaixaPagamentos (equivalente)

Estado:
- filtro: { mes, ano, busca?, ordenacao? }

Queries paralelas:
1. useResumoCaixa(mes, ano) → cards do topo
2. useReservasConsolidadas(mes, ano) → tabela principal "Reservas"
3. useMovimentacoes(mes, ano) → aba "Pagamentos Efetuados"
4. useSaldoPorDestinatario(mes, ano) → enriquecer status por linha
5. useHistoricoSaldo() → aba "Histórico" agrupado por mês

Realtime: escutar postgres_changes em caixa_movimentacoes → invalidar queries.

Layout:
┌─────────────────────────────────────────────────────────┐
│ [Total Reservado] [Total Pago] [Saldo Disponível]     │
├─────────────────────────────────────────────────────────┤
│ Filtro: Mês | Ano | Busca | Ordenação                 │
├─────────────────────────────────────────────────────────┤
│ Tabs: Reservas | Pagamentos Efetuados | Histórico       │
└─────────────────────────────────────────────────────────┘

================================================================================
5. ABA "RESERVAS" — TABELA CONSOLIDADA
================================================================================

Colunas por destinatário no mês filtrado:

| Destinatário | Vencimento | Lanç. | Aulas/OS | Valor Total Real | Valor em Reserva | Valor Restante | Status | Ações |

Cálculos por linha:
- valor_total_real:
    SE tipo = marceneiro/producao:
      soma comissões/OS/horas do mês (equivalente transacoes_professores)
    SENÃO:
      soma despesas do mês com descricao = nome destinatário

- valor_em_reserva = total_reservado (de caixa_saldo_acumulado)

- valor_restante = MAX(0, valor_total_real - total_pago)

- Status:
    PAGA      → total_pago >= valor_total_real
    FALTANDO  → 0 < total_pago < valor_total_real
    (vazio)   → total_pago = 0

- Ação "Pagar": abre dialog com valor pré-preenchido = valor_restante
- Ação "Recibo": quando totalmente pago

Professores no ProForco mostram colunas Lanç. (quantidade de lançamentos) e 
Aulas (aulas dadas). Na marcenaria: Lanç. = qtd OS/comissões, Aulas/OS = 
itens concluídos no mês.

================================================================================
6. REGISTRAR PAGAMENTO (FLUXO)
================================================================================

Dialog RegistrarPagamentoReservaDialog:
- Mostra: destinatário, valor restante, competência (MM/AAAA)
- Campos: valor, data_pagamento, descricao
- Ao confirmar: INSERT caixa_movimentacoes com tipo_movimentacao = 'pagamento'
- Trigger recalcula saldo automaticamente
- Invalida: caixa-movimentacoes, caixa-resumo, reservas-consolidadas, caixa-saldo-destinatario

Dialog RegistrarMovimentacaoDialog (manual):
- Permite criar reserva OU pagamento manualmente
- Campos: destinatário, valor, data, mês/ano referência, descrição

================================================================================
7. HOOK useReservasConsolidadas — LÓGICA DETALHADA
================================================================================

Passo a passo:
1. Buscar todas movimentações tipo 'reserva' do mês/ano
2. Agrupar por destinatario_id (somar valores, pegar data_vencimento)
3. Buscar destinatários cadastrados
4. Buscar despesas do mês (fin_despesas ou equivalente marcenaria)
5. Buscar agregado operacional do mês (comissões/OS por nome)
6. Para professores/marceneiros com faturamento mas SEM reserva manual:
   criar linha virtual na tabela (aparecem mesmo sem reserva)
7. Para cada destinatário:
   - valor_total_real = faturado (marceneiro) OU despesas (outros)
   - valor_em_reserva = total_reservado da tabela saldo_acumulado
   - data_vencimento = da reserva OU da despesa
8. Ordenar por nome

Função auxiliar fetchAgregadoPorNomeNoMes(ano, mes):
- Intervalo: 1º dia até último dia do mês (competenciaMesAnoLocal)
- Paginar queries (1000 linhas por página — limite PostgREST)
- Retorna: { faturadoPorNome, lancamentosPorNome, itensConcluidosPorNome }

================================================================================
8. HOOK useResumoCaixa — FÓRMULAS
================================================================================

Para o mês/ano filtrado:
  total_reservado = SUM(caixa_saldo_acumulado.total_reservado WHERE mes AND ano)
  total_pago      = SUM(caixa_saldo_acumulado.total_pago WHERE mes AND ano)
  saldo_disponivel = SUM(caixa_saldo_acumulado.saldo WHERE mes AND ano)

  saldo_meses_anteriores = SUM(saldo) WHERE (ano < filtro.ano) 
    OR (ano = filtro.ano AND mes < filtro.mes)

================================================================================
9. ABA HISTÓRICO
================================================================================

Lista caixa_saldo_acumulado agrupado por mês/ano:
- Por destinatário: Reservado | Pago | Saldo
- Linha de total do período
- Para marceneiros: colunas extras Lanç. e OS/Aulas da competência

================================================================================
10. TIPOS TYPESCRIPT (REFERÊNCIA)
================================================================================

TipoDestinatario = 'marceneiro' | 'fornecedor' | 'funcionario' | 'outros'
TipoMovimentacao = 'reserva' | 'pagamento'

ResumoCaixa {
  total_reservado: number
  total_pago: number
  saldo_disponivel: number
  saldo_meses_anteriores: number
}

ReservaConsolidada {
  destinatario_id, destinatario_nome, data_vencimento
  valor_total_real      // quanto deve receber
  valor_em_reserva      // quanto foi reservado no banco
  tipo_destinatario
  totalLancamentosMes   // qtd lançamentos operacionais
  totalItensConcluidosMes // qtd OS/aulas concluídas
  mes_referencia, ano_referencia
}

CaixaSaldoAcumulado {
  destinatario_id, mes_referencia, ano_referencia
  total_reservado, total_pago, saldo
}

================================================================================
11. ADAPTAÇÃO ESPECÍFICA PARA MARCENARIA
================================================================================

Mapeamento ProForco → Marcenaria:

| ProForco              | Marcenaria                    |
|-----------------------|-------------------------------|
| professor             | marceneiro / produção         |
| transacoes_professores| comissões_por_os ou horas     |
| horas_presenciais     | horas_extras_producao         |
| aulas dadas           | OS concluídas / móveis entregues |
| fin_despesas          | despesas (material, aluguel)  |
| fin_pagamentos_despesas | pagamentos registrados    |
| destinatário professor| marceneiro cadastrado       |
| destinatário fornecedor| fornecedor MDF/ferragens     |

Fluxo típico marcenaria:
1. Cliente paga projeto → financeiro registra receita
2. Sistema reserva % para marceneiro e fornecedor (manual ou trigger)
3. Caixa mostra: "João marceneiro deve R$ 3.000 (OS concluídas), reservado R$ 2.500, falta pagar R$ 500"
4. Admin clica Pagar → registra pagamento de R$ 500
5. Cards atualizam: Total Pago sobe, Saldo Disponível cai

================================================================================
12. REGRAS IMPORTANTES
================================================================================

- Saldo do caixa (reserva - pago) ≠ valor restante operacional (deve - pago)
- Um destinatário pode ter reserva SEM valor real (guardou antes) ou valor real SEM reserva (aparece na tabela virtual)
- Match de nomes é case-insensitive trim (nomeLower)
- Competência sempre por mês/ano de referência, não pela data do pagamento
- Paginação obrigatória em queries grandes (PostgREST limita ~1000 linhas)
- Realtime invalida cache ao inserir movimentação
- Apenas admin acessa aba Caixa (no ProForco: isAdmin)

================================================================================
13. ARQUIVOS DE REFERÊNCIA NO PROFORCO
================================================================================

- src/components/financeiro/tabs/CaixaPagamentos.tsx — orquestrador da tela
- src/hooks/useCaixaPagamentos.tsx — toda lógica de queries e consolidação
- src/types/caixa-pagamentos.ts — interfaces
- src/components/caixa-pagamentos/CaixaResumoCards.tsx — 3 cards topo
- src/components/caixa-pagamentos/TabelaReservasConsolidada.tsx — tabela principal
- src/components/caixa-pagamentos/RegistrarPagamentoReservaDialog.tsx — fluxo pagar
- supabase/migrations/20251229184604_*.sql — schema + trigger recalcular_saldo_caixa
- supabase/migrations/20251229190436_*.sql — sync automático reserva via despesas

Implemente seguindo esta arquitetura. Priorize: schema + trigger, depois hooks, 
depois UI com os 3 cards e tabela de reservas consolidadas.