Implemente uma página "Dashboard Financeiro" para um sistema de MARCENARIA,
replicando a estrutura do ProForco (DashboardFinanceiro.tsx), com estas regras:

- INCLUIR tudo abaixo
- NÃO incluir card "Rematrículas Mês" nem tabela fin_rematriculas
- Stack: React + TypeScript + Supabase + TanStack Query + Recharts + Shadcn UI
- Layout responsivo: grid de cards (md:2 cols, lg:4 cols) + grid de gráficos (md:2 cols)

================================================================================
SEÇÃO 1 — CARDS DE MÉTRICAS (8 cards fixos)
================================================================================

Hook principal: useFinanceiroStats() — uma query que retorna todos os KPIs.

Adaptação de nomes ProForco → Marcenaria:

| Card ProForco              | Marcenaria sugerido              | Como calcular |
|----------------------------|----------------------------------|---------------|
| Alunos Ativos              | Clientes Ativos                  | COUNT clientes status='ativo' |
| (subtitle) pendentes plano | pendentes de contrato/plano      | status='pendente_plano' |
| A Receber Este Mês         | A Receber Este Mês               | SUM(parcelas pendentes/atrasadas com vencimento no mês atual) valor - desconto |
| Recebido Este Mês          | Recebido Este Mês                | SUM(parcelas status='pago' com data_pagamento no mês atual) |
| Atrasado                   | Atrasado                         | SUM(parcelas pendentes com data_vencimento < hoje) |
| Previsão Próx. Mês         | Previsão Próx. Mês               | SUM(parcelas pendentes/atrasadas com vencimento no próximo mês |
| Previsão Ano               | Previsão Ano                     | média mensal (meses passados pagos + projeção mês atual) × 12 |
| Despesas Próx. Mês         | Despesas Próx. Mês               | despesas gerais pendentes do próx mês + projeção produção/marceneiros |

Cada card:
- title, value, subtitle, icon (lucide-react), iconColor, format: "number" | "currency"
- formatCurrency com Intl pt-BR BRL
- Skeleton enquanto statsLoading

Interface TypeScript (FinanceiroStats):
{
  clientesAtivos: number;
  clientesPendentesContrato: number;
  totalAReceber: number;
  totalRecebidoMes: number;
  totalAtrasado: number;
  previsaoProximoMes: number;
  previsaoAno: number;
  despesasProximoMes: number;
  ticketMedio: number;           // novos clientes do mês
  ticketMedioGeral: number;      // média das parcelas do mês
  receitaLiquidaAno: number;
  novosClientesMes: number;
}

Regras de cálculo importantes (copiar lógica do ProForco):
- "A Receber" usa data_vencimento no mês, NÃO mes_referencia
- "Recebido" usa data_pagamento no mês, NÃO mes_referencia
- Valor líquido da parcela = valor - desconto
- Previsão ano = (soma pagamentos jan..mês-1 + projeção mês atual) / mesesConsiderados * 12
- Receita líquida ano = total faturado pago no ano - despesas pagas no ano

Tabelas sugeridas marcenaria:
- fin_clientes (equivalente fin_alunos)
- fin_parcelas ou fin_faturas (cobranças)
- fin_despesas + fin_pagamentos_despesas
- fin_planos (valor do contrato/pacote)

================================================================================
SEÇÃO 2 — CARD "NOVOS CLIENTES MÊS" (clicável)
================================================================================

Componente: NovosClientesCard

Card compacto no grid:
- Título: "Novos Clientes Mês"
- Valor: quantidade de fin_clientes criados no mês atual (ajustável por exclusões)
- Subtitle: "Ticket médio: R$ X"
- Ícone UserPlus, cor cyan
- onClick abre Dialog grande

Dialog ao clicar:
- Navegação por mês (Jan-Dez) com setas e botões rápidos
- Contagem por mês no ano (12 botões com número entre parênteses)
- Campo busca por nome cliente ou responsável
- Lista: nome, responsável, telefone, valor do plano, data cadastro
- Rodapé: total de clientes + soma valores
- Botões: "Copiar Todos" (clipboard) e "Baixar PDF" (opcional)
- Admin pode "excluir da contagem" (tabela fin_novos_clientes_excluidos) sem apagar o cliente

Queries:
- novos clientes: fin_clientes WHERE criado_em BETWEEN inicioMes AND fimMes
- ticket médio novos: soma valor dos planos / quantidade novos
- opcional: tabela exclusões para não contar duplicados/erros

NÃO implementar RematriculasCard.

================================================================================
SEÇÃO 3 — GRÁFICOS (grid 2x2)
================================================================================

3.1) Gráfico "Receitas Mensais"
- BarChart (Recharts) com 12 meses (Jan..Dez)
- Select de ano (últimos 5 anos)
- Dados: useGraficoReceitasMensal(ano)
  - Para cada mês: SUM(parcelas status='pago' WHERE data_pagamento entre 1º e último dia do mês)
- Eixo Y: R$Xk
- Tooltip formatado em BRL
- Altura ~300px, ChartContainer do shadcn

3.2) Gráfico "Faturado x Gastos" (comparativo)
- BarChart com 2 barras por mês: receitas (verde) e despesas (vermelho)
- Select de ano independente
- useGraficoReceitasMensal + useGraficoDespesasMensal
- Alert destrutivo se algum mês teve resultado negativo (receitas - despesas < 0)
- Se ano selecionado = ano atual: bloco extra "Previsão próximo mês"
  mostrando Faturado, Gastos e Resultado (verde/vermelho)

3.3) Gráfico "Despesas Mensais"
- BarChart vermelho, 12 meses
- useGraficoDespesasMensal(ano):
  - Por mês: pagamentos despesas gerais (tipo != producao/marceneiro) 
    + despesas tipo producao/marceneiro status='pago' na competência
- Select de ano

3.4) Card "Resumo Financeiro"
- Ticket Médio: stats.ticketMedioGeral (soma parcelas mês / qtd parcelas)
- Receita Líquida (Ano): clicável, expande lista mensal
  - Cada mês: Rec X | Desp Y | Resultado (verde/vermelho)
  - Select ano + scroll max-h 200px
  - Total do ano no rodapé
- Receita Bruta (Ano): clicável, expande só receitas por mês (sem subtrair despesas)
  - Total ano em azul

Componentes internos reutilizáveis:
- ReceitaLiquidaMensal({ ano, formatCurrency })
- ReceitaBrutaMensal({ ano, formatCurrency })

================================================================================
SEÇÃO 4 — HOOKS E QUERIES
================================================================================

useFinanceiroStats()
  queryKey: ["financeiro-stats"]
  Retorna FinanceiroStats (ver interface acima)

useGraficoReceitasMensal(ano?: number)
  queryKey: ["grafico-receitas-mensal", ano]
  Retorna: { mes: 'Jan'|'Fev'|..., valor: number }[12]

useGraficoDespesasMensal(ano?: number)
  queryKey: ["grafico-despesas-mensal", ano]
  Retorna: { mes, valor }[12]

Estados locais no Dashboard:
- anoSelecionado, anoDespesas, anoComparativo (gráficos)
- showReceitaLiquidaDetalhes, anoReceitaLiquida
- showReceitaBruta, anoReceitaBruta

Loading:
- Se statsLoading: skeleton grid 8 cards
- Cada gráfico: skeleton h-[300px] enquanto carrega

================================================================================
SEÇÃO 5 — PERMISSÕES (opcional)
================================================================================

ProForco: auxiliar_financeiro vê dashboard reduzido (só Novos Clientes + Rematrículas).
Para marcenaria SEM rematrícula:
- auxiliar_financeiro: só NovosClientesCard OU dashboard completo (definir)
- admin: dashboard completo

================================================================================
SEÇÃO 6 — ADAPTAÇÃO MARCENARIA (mapeamento de domínio)
================================================================================

| ProForco                    | Marcenaria                          |
|-----------------------------|-------------------------------------|
| fin_alunos                  | fin_clientes ou pedidos com cliente |
| fin_faturas                 | fin_parcelas (parcelas do projeto)  |
| fin_planos                  | pacotes/contratos de móveis         |
| transacoes_professores      | comissões marceneiros / horas OS    |
| fin_despesas tipo professor | despesas tipo producao              |
| Alunos Ativos               | Clientes com projeto ativo          |
| Novos Clientes              | Novos contratos fechados no mês     |

Despesas próximo mês na marcenaria:
- Despesas gerais pendentes (material, aluguel, energia)
- Projeção marceneiros: horas semanais × semanas × valor/hora - já pago

================================================================================
SEÇÃO 7 — UI/UX
================================================================================

- Espaçamento: space-y-6 no container
- Cards shadcn com CardHeader (título + ícone) e CardContent (valor grande + subtitle pequeno)
- Cores semânticas: verde=receita, vermelho=despesa/atraso, amarelo=a receber, roxo=previsão
- formatCurrency em todo lugar
- anosDisponiveis = últimos 5 anos até ano atual + 1
- Não usar Stripe, webhook, cartão de crédito nesta tela

================================================================================
SEÇÃO 8 — ARQUIVOS DE REFERÊNCIA NO PROFORCO
================================================================================

- src/components/financeiro/tabs/DashboardFinanceiro.tsx (layout completo)
- src/hooks/useFinanceiro.tsx (useFinanceiroStats, useGraficoReceitasMensal, useGraficoDespesasMensal)
- src/components/financeiro/NovosClientesCard.tsx
- src/types/financeiro.ts (interface FinanceiroStats, DadoGraficoMensal)

Implementar na ordem:
1) Tipos + hooks de stats e gráficos
2) Grid dos 8 cards + NovosClientesCard
3) Os 4 blocos de gráficos/resumo
4) Testar com dados reais no Supabase

Critério de aceite:
- Dashboard carrega sem erro com parcelas e despesas no banco
- Números batem com consultas manuais no SQL para o mês atual
- Gráficos mudam ao trocar o ano no select
- Card Novos Clientes abre dialog com lista do mês
- NÃO existe card ou query de rematrícula