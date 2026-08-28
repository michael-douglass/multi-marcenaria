# Fidelidade CRM Selletos — como seguimos daqui

Este caderno é a regra da casa: **um épico por vez**, copiado do CRM original, testado na tela, depois o próximo.

- Código-fonte: [https://github.com/michael-douglass/CRM-Multiemrpesas.git](https://github.com/michael-douglass/CRM-Multiemrpesas.git)
- Clone local: `F:\crm multiemrpesas\CRM-Multiemrpesas`
- App unificado: `F:\Movelaria-Garbo\Movelaria`
- Dev: `pnpm` na porta **3001**
- Dados já estão no banco (`emp_garbo`, épicos 0–8). Aqui só **layout e clique**.

## Ritual de cada épico

1. Abrir os arquivos do clone listados no plano.
2. Copiar a estrutura da tela (botões, alças, abas). Não inventar módulo que o GitHub não tem.
3. Ligar no que já existe (RPCs, hooks). Não copiar tabelas.
4. Testar no browser o fluxo daquela tela.
5. Conferir que Caixa / Obras / Funcionários da fábrica continuam iguais.
6. Anotar neste arquivo o que mudou.
7. Só então o próximo épico.

Prestador CRM = **arquiteto/parceiro**. Montador fica na Movelaria fábrica.

---

## Épico 10 — Pipeline: markup no card

**Status:** feito e testado (27/08/2026).

**Dor:** no quadro unificado o markup não abria. Três motivos, todos visíveis no original `KanbanCard.tsx` (bloco Markup, por volta das linhas 517–551):

1. Sem preço salvo, a faixa verde **sumia**. No original sempre há um botão **Markup**.
2. O card inteiro era `draggable`. No original só a alça `GripVertical` arrasta.
3. Ficha do lead e calculadora usavam o mesmo overlay — uma tapava a outra.

### Arquivos de verdade (clone)

- `src/components/kanban/KanbanCard.tsx`
- `src/components/markup/MarkupCardPreview.tsx`
- `src/pages/Pipeline.tsx`

### Arquivos destino (Movelaria)

- `src/components/crm/PipelineLeadCard.tsx`
- `src/components/crm/MarkupCardPreview.tsx`
- `src/pages/crm/PipelinePage.tsx`

### Comportamento a copiar (não negociar)

| Clique | Resultado |
|--------|-----------|
| Nome / corpo do card | Abre a ficha do lead |
| Alça (ícone de pontinhos) | Arrasta o card para outra coluna |
| Botão **Markup** (lead sem preço) | Cria orçamento e abre a calculadora |
| Faixa verde (lead com preço) | Abre o orçamento já salvo |
| Vendedor | Vê o valor se existir; **não** abre a calculadora |

Permissão igual ao original: abre quem **não** é só vendedor — na Movelaria isso já é `canAccessCrmPath('/markup')` (admin ou projetista).

Ao abrir a calculadora: **fechar a ficha do lead** (`setSelected(null)`), senão os dois modais brigam no `z-index: 300`.

Arraste: **não** colocar `draggable` no `Card`. Só no botão da alça. Depois de arrastar, ignorar o `click` fantasma (o navegador dispara clique ao soltar).

Não instalar `@dnd-kit` neste épico: a alça em HTML5 resolve o clique no markup. O kit do original pode entrar depois, se o arraste entre colunas ficar estranho.

Não copiar neste épico (fica para o 11+): lembretes, chat não lido, “marcar venda”, região, troca de vendedor no card.

### Teste do Épico 10 (browser, porta 3001)

1. Entrar em `/pipeline` como admin.
2. Achar um card **sem** faixa verde → deve aparecer o botão **Markup**. Clicar → abre a calculadora, não a ficha.
3. Achar um card **com** preço → clicar na faixa verde → abre aquele orçamento.
4. Clicar no **nome** → abre a ficha. Na ficha, Markup também abre a calculadora e a ficha some.
5. Arrastar **pela alça** para outra coluna → o lead muda de etapa.
6. Abrir `/caixa` → totais da fábrica ainda aparecem.

Não enviar WhatsApp nem criar reunião neste teste.

### Script automático

`scripts/test-crm-pipeline-markup.mjs` deve garantir no código:

- `MarkupCardPreview` **não** some só por falta de `onOpen` quando há preço (vendedor vê valor).
- `PipelineLeadCard` tem botão **Markup** quando não há `preco_final`.
- `draggable` está na alça, não no `Card`.
- `PipelinePage` zera o lead selecionado ao abrir markup.

---

## Próximos (depois dos épicos 9–13)

- **14–25** — demais telas do `App.tsx` original

### O que foi aplicado (Épico 10)

- `MarkupCardPreview` igual ao Selletos: faixa verde com chevron; vendedor vê o valor sem clicar.
- `PipelineLeadCard`: botão **Markup** se ainda não há preço; alça `GripVertical` é o único `draggable`.
- `PipelinePage`: ao abrir a calculadora, a ficha fecha (`setSelected(null)`).
- Teste automático: `scripts/test-crm-pipeline-markup.mjs`.

---

## Épico 11 — Ficha do lead

**Status:** feito e testado (27/08/2026).

**Original:** `LeadModal.tsx` + `MarkupLeadSection.tsx`.

**Destino:** `src/components/crm/PipelineLeadModal.tsx`, `MarkupLeadSection.tsx`, `CrmLeadSection.tsx`.

### Comportamento

- Abas **Detalhes** e **Análise IA**.
- Na ficha: dados, observações, **Markup (custo interno)** com lista e “Novo markup”, WhatsApp, materiais (slides, contratos, agenda, lousa).
- Clique na faixa de markup da ficha fecha a ficha e abre a calculadora.
- Vendedor vê a lista; só gestão cria/abre.

Não copiado neste épico: auto-save, lembretes, anexos PDF, lousa embutida, campos personalizados.

### Teste (browser)

1. `/pipeline` → abrir um lead (ex.: Paulo Henrique).
2. Ver abas, seção Markup com contagem, WhatsApp, Materiais.
3. Aba Análise IA → painel da Íris (não precisa pedir análise).
4. Voltar a Detalhes → clicar a faixa Markup → calculadora; ficha some.
5. `/caixa` intacto.

Script: `scripts/test-crm-lead-modal.mjs`.

---

## Épico 12 — Lista de leads

**Status:** feito e testado (27/08/2026).

**Original:** `Leads.tsx` + `LeadsListView.tsx`.

**Destino:** `src/pages/crm/LeadsPage.tsx`, filtro extra em `src/lib/crm-pipeline.ts`.

### Comportamento

- Colunas: Nome, Telefone, Email, Origem, Vendedor, Status, Data, Valor.
- Filtros iguais ao Pipeline: busca, vendedor, origem, status, data (Hoje / mês atual / 7 dias / último mês).
- Badge **Atenção** quando `darAtencao`.
- Clique na linha abre a mesma ficha do Pipeline (com markup).
- **Ver quadro** volta para `/pipeline`.
- Sem Região, Empresa ou Sinalizar — o banco da Movelaria não tem esses campos.

### Teste (browser)

1. `/leads` → ver telefone e e-mail nas colunas.
2. Filtrar por vendedor / origem / status → a lista muda.
3. Clicar num lead → abre a ficha.
4. **Ver quadro** → `/pipeline`.
5. `/caixa` intacto.

Script: `scripts/test-crm-leads-list.mjs`.

---

## Épico 13 — Agenda comercial (calendário)

**Status:** feito e testado (27/08/2026).

**Original:** `AgendaCalendar.tsx` (só date-fns, grade manual). Abas Geral/Pessoal/Lembretes/Tarefas **não** existem na Movelaria — não inventar.

**Destino:** `src/components/crm/AgendaComercialCalendar.tsx`, `src/pages/crm/AgendaComercialPage.tsx`, helpers em `src/lib/crm-agenda.ts`.

### Comportamento

- Calendário do mês, clique no dia filtra a lista da direita.
- Cores: pendente (âmbar), concluída (verde), misto (os dois).
- Filtro de status + busca + CRUD + link público `/agendar/garbo/{slug}`.
- Sem `react-day-picker` e sem a AgendaPopup de obras.

### Teste (browser)

1. `/agenda-comercial` → ver o mês e os totais de hoje / pendentes.
2. Clicar noutro dia → a lista da direita muda.
3. Abrir uma reunião existente (não criar lixo).
4. Conferir o link público.
5. `/caixa` intacto.

Script: `scripts/test-crm-agenda-calendario.mjs`.

---

## Épico 9 — Moldura CRM (ícones flutuantes)

**Status:** feito e testado (27/08/2026).

**Original:** vários FABs. Só portamos o que tem dado na Movelaria: agenda comercial de **hoje** e saque Pontua do **admin**.

**Destino:** `src/components/crm/CrmChromeDock.tsx`, `MainLayout.tsx`, `NavigationHeader.tsx`.

### Comportamento

- Em rota CRM, some a agenda/métricas de **obras**.
- Canto inferior direito: Agenda (reuniões de hoje → `/agenda-comercial`) e Saque (admin, pedidos pendentes → `/financeiro-pontua`).
- No topo, o calendário em rota CRM abre a agenda comercial — não a de obras.
- Sino verde do CRM continua separado do sino dourado de Contas a Pagar.
- Não portado: WhatsApp inbox, sinalizações, presença, aprovação de user, IA em background.

### Teste (browser)

1. `/pipeline` → sem FAB de obras; ícones Agenda e Saque no canto.
2. Clique em Agenda → lista de hoje e **Ver agenda**.
3. Sinos do topo: verde CRM e dourado Contas a Pagar, separados.
4. `/caixa` → FABs de obras voltam; dock CRM some.

Script: `scripts/test-crm-chrome.mjs`.

---

---

## Épico 14 — Contratos

**Status:** feito e testado (27/08/2026).

**Original:** `ContratosPage`, `NovoContratoPage`, `ContratosConfigPage`.

**Destino:** `src/pages/crm/ContratosPage.tsx`, helpers em `src/lib/crm-contratos.ts`.

### Comportamento

- Lista em duas tabelas: **Em produção** (rascunho) e **Finalizados**.
- Botão **Configurações** abre `/contratos/configuracoes` (modelos + variáveis, só leitura).
- Editor em **1. Preencher** / **2. Preview**, com imprimir.
- Sem PDF, assinatura ou WhatsApp — o banco da Movelaria não tem essas RPCs.

### Teste (browser)

1. `/contratos` → ver as duas listas.
2. Abrir um contrato existente → Preencher e Preview.
3. `/contratos/configuracoes` → modelos e campos.
4. `/caixa` intacto.

Script: `scripts/test-crm-contratos.mjs`.

---

## Épico 15 — Markup (configurações + IA)

**Status:** feito e testado (27/08/2026).

**Destino:** `MarkupListPage` / `MarkupConfigPage` no mesmo arquivo.

### Comportamento

- O botão da lista chama **Configurações** (não Catálogo).
- Abas: Produtos, Parâmetros, Despesas, Serviços, **IA**.
- A aba IA é honesta: os prompts ficam no Marketing de conteúdo. Sem RPC nova.

Script: `scripts/test-crm-markup-config.mjs`.

---

## Épico 16 — Slides de orçamento (ações da lista)

**Status:** feito e testado (27/08/2026).

Não reescrevemos o player de ~2 mil linhas do original. Na lista: **Editar**, **Ver** (link público) e **Copiar**, com `stopPropagation` para não abrir o editor ao clicar no botão.

Script: `scripts/test-crm-slides.mjs`.

---

## Épico 17 — Automações

**Status:** feito e testado (27/08/2026).

- `/automacoes`: card de negativação.
- `/automacoes/marketing`: abas Mensagens | Disparos | Áudios | Imagens | PDFs. Áudio/imagem/PDF = empty state honesto (sem upload no banco).

Script: `scripts/test-crm-automacoes.mjs`.

---

## Épico 18 — Marketing de conteúdo

**Status:** feito e testado (27/08/2026).

- Abas na URL (`?tab=producao|agendamento|midias|planejamento`).
- Aba Agendamento: calendário do mês (grade date-fns, sem `react-day-picker`) + lista do dia via `tarefasDoDia`.

Script: `scripts/test-crm-marketing-conteudo.mjs`.

---

## Épico 19 — Pontua (cena de pontos)

**Status:** feito e testado (27/08/2026).

**Destino:** `src/components/crm/GarboPontuaPointsScene.tsx` — 48 pontos dourados em **Canvas 2D**. Não instalamos `three` (regra: sem pacote novo). Pausa se `prefers-reduced-motion`. Hero em `/marketing/pontua-garbo`.

Script: `scripts/test-crm-pontua-scene.mjs`.

---

## Épico 20 — Controle de gastos

**Status:** feito e testado (27/08/2026).

Fonte → sub-fonte → planilha **Data / Observação / Valor**. Não mistura com o Caixa.

Script: `scripts/test-crm-gastos.mjs`.

---

## Épico 21 — Financeiro Pontua

**Status:** feito e testado (27/08/2026).

4 KPIs + mural de **arquitetos** + saques + liberações. Sem montador, sem Caixa.

Script: `scripts/test-crm-financeiro-pontua.mjs`.

---

## Épico 22 — Portal do arquiteto

**Status:** feito e testado (27/08/2026).

Menu radial com as 4 seções do original: Portal, Perfil, Saldo, Clientes. Sem copiar o multiempresa.

Script: `scripts/test-crm-portal.mjs` (inclui o radial).

---

## Épico 23 — Agenda pública

**Status:** feito e testado (27/08/2026).

`/agendar/garbo/agendamento` em 4 passos: dados → dia → horário → sucesso. Não criar reunião de teste.

Script: `scripts/test-crm-agenda-publica.mjs`.

---

## Épico 24 — Biblioteca CRM

**Status:** feito e testado (27/08/2026).

Rota própria `/biblioteca-crm` (acervo de mídias do marketing). **Não** é `/biblioteca` da fábrica.

Script: `scripts/test-crm-biblioteca-crm.mjs`.

---

## Épico 25 — Marca (admin)

**Status:** feito e testado (27/08/2026).

`/admin/marca`: 3 cards (identidade, portal, timbrado). Prévia só no `localStorage` (`garbo-crm-marca-preview`). Sem RPC de marca, sem seletor de empresa.

Script: `scripts/test-crm-marca.mjs`.

---

## Unificação GitHub (épicos 0–20) — 27/08/2026

Copiamos o CRM Selletos do clone (`F:\crm multiemrpesas\CRM-Multiemrpesas`) para a Movelaria, com as exceções combinadas:

- DNA Bourbon 1:1 (HSL, glass, fontes, theme-color mogno)
- Empresa congelada em `emp_garbo` (sem seletor)
- Menu pai **CRM**
- Porta 3001
- Fábrica (Caixa/Obras) só pintada, regras iguais — conferido no browser: totais do Caixa intactos e FABs de obras só fora do CRM
- Casco: `CrmSelletosDock` (WhatsApp, agenda geral, saques, sinalizações, presença) só nas rotas comerciais
- Pipeline GitHub com kanban, Markup no card, 55 leads no quadro; lista `/leads` (141); agenda comercial com abas; markup; slides
- Edge Functions do CRM copiadas para `supabase/functions` (sem sobrescrever `rep-*` da fábrica)
- Pontua: Three.js + shader fresnel ouro no núcleo, respeita `prefers-reduced-motion`
- `/projetos` e o board de `/controle-eventos` **não existem no GitHub remoto** (busca 27/08/2026: 0 arquivos). Eventos segue em `EventosCrmPage`
- Script mestre: `scripts/test-crm-unificacao.mjs` (44 OK)
- Bateria `scripts/test-crm-*.mjs` verde
- **Não commitado** até você pedir


