# PRD — Markup: catálogo, itens e sincronia com sistema externo

**Produto:** CRM Selletos (Multi-empresas)  
**Módulo:** Markup (custo interno de marcenaria)  
**Versão:** 0.1  
**Data:** 26/08/2026  
**Status:** Rascunho para alinhamento  
**Ambiente de referência:** `http://localhost:8081/markup`  
**Público:** produto, operação e o time que vai ligar o CRM a outro sistema

---

## 1. Resumo executivo

O CRM já tem um módulo de **markup de custo interno**: catálogo de materiais, parâmetros (hora, margem, impostos), despesas, serviços e um orçamento por lead. Esse orçamento aparece em três lugares:

1. **Miniatura no card do Kanban** — faixa verde com o rótulo “Markup” e o preço final (ex.: `R$ 16.736,39`).
2. **Calculadora** — painel que abre ao clicar nessa faixa (ou no botão Markup do card / ficha do lead).
3. **Área `/markup`** — lista de todos os markups e a tela de configurações (`/markup/configuracoes`).

Este PRD descreve **o que já existe**, **onde achar cada peça na tela** e **o que precisa ficar igual** quando o markup e os itens forem usados em **outro sistema**. A regra de ouro: **um só “caderno de verdade”** (fonte da verdade). Os dois sistemas leem e gravam o mesmo caderno, ou um é o dono e o outro só acompanha.

---

## 2. Como achar o que foi marcado na tela (Kanban)

O seletor DOM informado aponta para a **miniatura verde no card do lead**, não para a página `/markup`.

### 2.1 O que a inspeção mostrou

| Inspeção | Valor |
|----------|--------|
| Componente React | `MarkupPreviewBody` |
| Texto visível | “Markup” |
| Valor visível | `R$ 16.736,39` |
| Classes do bloco | faixa verde (`border-emerald-500/30`, `bg-emerald-500/10`) |
| Contexto | coluna do Kanban, dentro do card do lead |

Isso é só um **resumo do preço**. Os **itens** (chapas, ferragens, horas, despesas) **não aparecem nessa faixa**. Eles ficam dentro da calculadora e no banco.

### 2.2 Onde está no código

| Peça | Arquivo | Função |
|------|---------|--------|
| Corpo da miniatura (o que foi inspecionado) | `src/components/markup/MarkupCardPreview.tsx` | `MarkupPreviewBody` |
| Caixa verde clicável | mesmo arquivo | `MarkupCardPreview` |
| Card do Kanban que encaixa a caixa | `src/components/kanban/KanbanCard.tsx` | prop `markupResumo` + `onOpenMarkup` |
| De onde vem o número | `src/hooks/useMarkupOrcamentos.ts` | `useLeadMarkupResumoMap()` |
| Pipeline / quadro | `src/pages/Pipeline.tsx` e `src/pages/PipelineKanbanPage.tsx` | passam o mapa lead → resumo |

Fluxo em linguagem simples:

1. O quadro pede ao banco o markup **mais recente** de cada lead.
2. Se o preço final for maior que zero, o card desenha a faixa verde.
3. Quem tem permissão de custo clica e abre a **calculadora** daquele orçamento.
4. Vendedor **vê o valor**, mas **não abre** a calculadora.

### 2.3 Dados que a miniatura realmente usa

Tipo `MarkupLeadResumo`:

| Campo | Significado |
|-------|-------------|
| `lead_id` | Lead dono do markup |
| `orcamento_id` | ID do orçamento de markup |
| `preco_final` | Preço de venda após custos, impostos, margem e desconto |
| `titulo` | Nome do markup (na miniatura compacta do Kanban o título **não** é exibido) |
| `atualizado_em` | Última gravação |

**Não entra na miniatura:** lista de produtos, quantidades, horas, despesas, configuração da empresa.

---

## 3. Mapa da área `/markup` (o que precisa ficar em sincronia)

Toda a área abaixo precisa ser tratada como **um único módulo** na integração. Não basta copiar o número do Kanban.

### 3.1 Rotas

| Rota | Página | O que o usuário faz |
|------|--------|---------------------|
| `/markup` | `MarkupListPage` | Vê todos os markups: título, lead, preço final, data, status (`rascunho` / `finalizado`) |
| `/markup/configuracoes` | `MarkupConfigPage` | Cadastro do **catálogo e das regras** da empresa |

Abas de `/markup/configuracoes`:

| Aba | Conteúdo |
|-----|----------|
| **Produtos** | Categorias + itens do catálogo (nome, variação, preço unitário, unidade, ordem) |
| **Parâmetros** | Valor/hora, sobras, margem, impostos, taxas, frete, horas padrão, rodapé, timbrado |
| **Despesas padrão** | Templates (ex.: gasolina, pedágio) com valor padrão |
| **IA** | Prompts, modelos, checklist de verificação da composição automática |

Há ainda **templates de serviços** (mão de obra por hora), usados na calculadora e na IA.

### 3.2 Onde o markup aparece fora de `/markup`

Essas superfícies **leem o mesmo dado**. Se o outro sistema mudar o markup, todas devem refletir a mudança.

| Superfície | Componente | O que mostra |
|------------|------------|--------------|
| Card do Kanban | `MarkupCardPreview` | Preço final |
| Ficha do lead | `MarkupLeadSection` | Lista de markups do lead + abrir calculadora |
| Composição de projeto | `LeadProjetoComposicaoSection` | Mesma seção de markup |
| Calculadora (painel lateral) | `MarkupCalculatorSheet` | Itens, serviços, despesas, totais, IA, PDF |
| Slides de orçamento | `orcamento-slide-precificacao.ts` | Pode **reusar** o markup do lead na proposta comercial |

Menu: grupo **Orçamentos** → **Markup (custo)**. Acesso: admin, projetista e super-admin. Vendedor **não** entra em `/markup` nem na calculadora; pode ver o valor no card.

---

## 4. Problema

| Situação | Impacto |
|----------|---------|
| O outro sistema precisa do **markup** (preço) **e dos itens** | Copiar só o `R$` do Kanban deixa o outro sistema cego: não sabe o que foi composto |
| Catálogo vive em `/markup/configuracoes` e orçamento vive no lead | Sem sincronia, preço e lista de materiais divergem entre os dois sistemas |
| Itens do orçamento estão no JSON `modulos`, não numa tabela de linhas usada pelo app | Integração que olhar só `markup_orcamento_linhas` pode achar a tabela **vazia** |
| Já existe um sync interno: preço do markup → campo **Orçamentos** do lead (só se o lead ainda não tiver valor) | O outro sistema precisa respeitar essa regra para não apagar valor digitado à mão |

---

## 5. Objetivos

### Objetivos de negócio
- Usar no outro sistema o **mesmo custo interno** que o CRM já calcula.
- Evitar retrabalho: não cadastrar produtos/preços duas vezes.
- Garantir que o valor visto no Kanban seja o mesmo valor usado fora do CRM.

### Objetivos de produto
- Definir **fonte da verdade** (CRM, sistema externo, ou banco compartilhado).
- Sincronizar **catálogo + parâmetros + orçamentos + itens**.
- Manter Kanban, ficha do lead, `/markup` e calculadora sempre iguais após cada gravação.
- Não quebrar o fluxo atual (IA, Cortecloud, PDF, slides de orçamento).

### Fora de escopo (neste rascunho)
- Replicar a interface da calculadora no outro sistema (só os **dados**).
- Sincronizar slides de orçamento, contratos ou chat.
- Trocar o motor de cálculo (`markup-calculo.ts`) sem alinhamento explícito.

---

## 6. Fonte da verdade (decisão a confirmar)

Três modelos possíveis. **Uma** precisa ser escolhida antes de implementar.

| Modelo | Como funciona | Quando usar |
|--------|---------------|-------------|
| **A — CRM é o dono** | O outro sistema só lê (e, se precisar, pede alteração via API do CRM) | O time comercial/projetos continua fechando markup no Selletos |
| **B — Sistema externo é o dono** | O CRM só exibe o que chegou; gravações no CRM são recusadas ou viram rascunho | O outro sistema já é o ERP / PCP / custo oficial |
| **C — Banco compartilhado** | Os dois escrevem nas mesmas tabelas da empresa | Mesmo Supabase; cuidado com corrida de gravação |

**Recomendação provisória:** modelo **A** para orçamentos de lead (quem fecha o markup é o CRM) e modelo **A ou C** para o **catálogo** (produtos e preços), conforme o outro sistema já tiver lista de materiais.

Até a decisão, o PRD trata o CRM como **referência do formato dos dados**.

---

## 7. Modelo de dados (o caderno de verdade)

Tudo é **por empresa** (schema `emp_*` ou tabelas públicas com `schema_nome`).

### 7.1 Catálogo e regras (tela de configurações)

| Entidade | Tabela | O que é |
|----------|--------|---------|
| Categoria | `markup_categorias` | Grupos (ex.: chapas, ferragens) |
| Produto / item de catálogo | `markup_produtos` | Nome, variação, preço unitário, unidade, ativo, ordem |
| Configuração | `markup_config` | Uma linha por empresa: hora, sobras, margem, impostos, IA, etc. |
| Despesa padrão | `markup_despesa_templates` | Nome + valor padrão |
| Serviço padrão | `markup_servico_templates` | Nome + valor/hora padrão |

### 7.2 Orçamento do lead (o “markup” do Kanban)

| Entidade | Tabela | O que é |
|----------|--------|---------|
| Orçamento | `markup_orcamentos` | Um registro por markup: `lead_id`, `titulo`, `status`, `preco_final`, `observacoes_rodape`, `modulos` (JSON) |
| Linhas relacionais | `markup_orcamento_linhas` | **Existe no banco**, mas o app **não grava nem lê** hoje. Os itens reais estão em `modulos`. |

### 7.3 O JSON `modulos` (os itens de verdade)

Estrutura `MarkupModulos`:

```
materiais.linhas[]     → itens de produto (quantidade × valor unitário)
servicos.linhas[]      → mão de obra (horas × valor/hora)
despesas[]             → despesas avulsas / templates
impostos               → % imposto e taxas
margem                 → % lucro, frete, sobras, desconto final
totais                 → custos parciais e preco_final
meta                   → ordem do catálogo no lead, resumo da IA, desfazer
```

Cada linha de material (`MarkupLinhaProduto`) traz, entre outros: `produto_id`, `descricao`, `variacao`, `unidade`, `categoria`, `quantidade`, `valor_unitario`, `valor_total`, `ativo`, `origem_ia`.

**Regra de sync:** o outro sistema deve tratar `modulos` como a lista oficial de itens. Se no futuro as linhas forem espelhadas em `markup_orcamento_linhas`, isso vira um trabalho extra — não é o estado atual.

### 7.4 Cálculo (não inventar fórmula diferente)

Arquivo: `src/lib/markup-calculo.ts`.

Ordem simplificada:

1. Soma materiais ativos → aplica fator de sobras.
2. Soma serviços (horas × valor/hora) + despesas ativas + frete.
3. Aplica impostos e taxas sobre o subtotal de custo.
4. Aplica margem de lucro → preço bruto.
5. Aplica desconto percentual → **preço final** (o número da faixa verde).

Se o outro sistema mostrar um total diferente, ou a fórmula está diferente, ou algum item `ativo: false` foi somado por engano.

### 7.5 Sync já existente no CRM (lead)

Hook `useSyncLeadMarkupValor`:

- Quando o markup tem `preco_final > 0`, tenta gravar em `leads.valor_orcamento`.
- **Não sobrescreve** se o lead já tem um valor de orçamento preenchido (`onlyIfEmpty`).
- A ficha do lead pode bloquear o sync se o usuário editou o valor à mão.

Integração externa **não deve** apagar `valor_orcamento` sem regra equivalente.

---

## 8. Requisitos funcionais

### RF-01 — Inventário do que sincronizar

O contrato de sync deve cobrir, no mínimo:

1. Catálogo: categorias, produtos, unidades, preços, ativo/inativo, ordem.
2. Templates: despesas e serviços.
3. Parâmetros globais (`markup_config`), **exceto** talvez prompts de IA (decidir).
4. Orçamentos: cabeçalho + `modulos` completo + `preco_final` + status + vínculo `lead_id`.
5. Identificadores estáveis: `id` UUID dos produtos/templates/orçamentos.

**Não obrigatório na v1:** prompts de IA, checklist de verificação, timbrado, PDF gerado, eventos da composição com IA.

### RF-02 — O número do Kanban é derivado

A miniatura **não é uma fonte**. Ela só mostra `preco_final` do orçamento mais recente do lead.

Critério de aceite:

- Alterar itens no sistema dono → `preco_final` recalculado → faixa verde, lista `/markup` e ficha do lead mostram o mesmo valor, em até X segundos (definir SLA).

### RF-03 — Itens do orçamento

O outro sistema deve receber **cada linha** de materiais, serviços e despesas, com quantidade, unitário, total e flag `ativo`.

Critério de aceite:

- Um markup com 12 linhas de material no CRM aparece com as mesmas 12 linhas no outro sistema (mesmos `produto_id` ou mesmo nome+variação se o catálogo for mapeado).

### RF-04 — Mapeamento de catálogo

Se o outro sistema tem SKUs próprios:

- Tabela de de-para: `markup_produtos.id` ↔ código externo.
- Produto inativo no CRM não some do orçamento já salvo (linha histórica permanece).

### RF-05 — Identidade do lead

Orçamento sem `lead_id` pode existir. Sync de “markup do card” exige `lead_id` válido no CRM. O outro sistema precisa do **mesmo ID de lead** ou de um de-para.

### RF-06 — Conflitos e horário

Todo registro relevante já tem `atualizado_em`. Política sugerida: **último gravação ganha**, com log de quem escreveu. Proibido dois donos escrevendo o mesmo `modulos` sem trava.

### RF-07 — Permissões

No CRM, só admin/projetista/super-admin editam markup. A API de sync deve usar chave de serviço ou usuário de integração, **nunca** a chave anônima no browser do outro sistema.

### RF-08 — Multi-empresa

Sync sempre com o **schema da empresa** (ou `schema_nome` nas tabelas públicas). Misturar catálogo da empresa A no lead da empresa B é defeito bloqueante.

### RF-09 — Superfícies que devem refletir o sync

Após gravar um orçamento sincronizado:

- [ ] Faixa verde do Kanban
- [ ] Tabela `/markup`
- [ ] `MarkupLeadSection` na ficha do lead
- [ ] Calculadora ao reabrir o mesmo `orcamento_id`
- [ ] Campo Orçamentos do lead, **somente** se a regra `onlyIfEmpty` permitir

### RF-10 — Direção da sincronia (a preencher)

| Entidade | CRM → externo | Externo → CRM | Observação |
|----------|---------------|---------------|------------|
| Produtos | ? | ? | |
| Parâmetros | ? | ? | |
| Orçamento + itens | ? | ? | |
| Status finalizado | ? | ? | |

---

## 9. Requisitos não funcionais

| ID | Requisito |
|----|-----------|
| RNF-01 | Não instalar pacotes novos só para o sync; preferir Edge Function ou tabela + webhook já no padrão Supabase do projeto |
| RNF-02 | Recálculo de totais **sempre** com `recalcularModulos` (ou equivalente server-side idêntico) |
| RNF-03 | Payload de `modulos` pode ser grande (IA + cômodos); sync incremental por `orcamento_id` |
| RNF-04 | RLS continua ativo; integração autenticada |
| RNF-05 | Observabilidade: log de última sync, erro e `orcamento_id` |

---

## 10. Como o outro sistema deve “enxergar” o módulo

### 10.1 Leitura mínima (preço do card)

```
GET orçamento mais recente por lead_id
→ preco_final, orcamento_id, titulo, atualizado_em
```

Equivale ao que o Kanban já faz em `useLeadMarkupResumoMap`.

### 10.2 Leitura completa (itens)

```
GET markup_orcamentos por id
→ modulos.materiais.linhas
→ modulos.servicos.linhas
→ modulos.despesas
→ modulos.totais
→ preco_final (conferir com totais.preco_final)
```

### 10.3 Escrita (se o externo for dono ou espelho)

Gravar o JSON `modulos` **já recalculado** ou gravar linhas e deixar o CRM recalcular no `parseOrcamento` (ele já chama `recalcularModulos` ao ler). Preferir **recalcular no dono** e persistir totais iguais nos dois lados.

---

## 11. Riscos

| Risco | Mitigação |
|-------|-----------|
| Integrar só o DOM / o texto “R$ …” | Documentar que a UI é vitrine; a API/tabela é a fonte |
| Usar `markup_orcamento_linhas` vazia | Usar `modulos` até haver migração explícita |
| Fórmula de preço diferente no outro sistema | Compartilhar testes de `markup-calculo` ou recalcular só no CRM |
| Catálogo duplicado com nomes parecidos | Sync por UUID, não por nome |
| IA reescrever composição depois do sync | Definir se orçamento `finalizado` fica travado |

---

## 12. Observações de inspeção (referência rápida)

Estas observações são o ponto de partida deste PRD:

1. **DOM Path informado** = miniatura `MarkupPreviewBody` no card do Kanban (faixa verde).
2. Essa miniatura mostra **só o rótulo “Markup” e o preço final**.
3. Os **itens** estão na calculadora e em `markup_orcamentos.modulos`.
4. A **área inteira** `http://localhost:8081/markup` (lista + configurações) faz parte do mesmo módulo e precisa entrar na sincronia, não só o card.
5. O markup também vive no lead, no quadro e (opcionalmente) nos slides de orçamento.

---

## 13. Perguntas em aberto (bloquear implementação até responder)

1. Qual é o **nome e o papel** do outro sistema (ERP, PCP, e-commerce, app de fábrica)?
2. Quem é o **dono** do catálogo de produtos? E do orçamento do lead?
3. A sync é **tempo real**, a cada salvamento, ou em lote (ex.: de hora em hora)?
4. Orçamentos `finalizado` podem ser alterados no outro lado?
5. Precisa sincronizar **prompts de IA** e checklist, ou só custo e itens?
6. O outro sistema já tem IDs de lead Selletos ou precisa de de-para?

---

## 14. Plano sugerido (depois do alinhamento)

1. Congelar o contrato JSON de `MarkupOrcamento` + `MarkupModulos` + catálogo.
2. Escolher modelo A/B/C.
3. Implementar leitura (CRM → externo) e testes de paridade de `preco_final`.
4. Implementar escrita se necessário, com recálculo único.
5. Validar as cinco superfícies do RF-09 no browser (Kanban, `/markup`, ficha, calculadora, valor do lead).

---

## 15. Referências de código

| Tema | Caminho |
|------|---------|
| Miniatura Kanban | `src/components/markup/MarkupCardPreview.tsx` |
| Tipos | `src/lib/markup-types.ts` |
| Tabelas | `src/lib/markup-tables.ts` |
| Cálculo | `src/lib/markup-calculo.ts` |
| CRUD orçamentos | `src/hooks/useMarkupOrcamentos.ts` |
| Sync valor do lead | `src/hooks/useSyncLeadMarkupValor.ts` |
| Lista | `src/pages/markup/MarkupListPage.tsx` |
| Configurações | `src/pages/markup/MarkupConfigPage.tsx` |
| Calculadora | `src/components/markup/MarkupCalculatorSheet.tsx` |
| Schema inicial | `supabase/migrations/20260708130000_markup_sistema.sql` |
| Rotas | `src/App.tsx` (`/markup`, `/markup/configuracoes`) |
