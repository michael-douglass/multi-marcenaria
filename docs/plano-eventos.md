# Plano — Controle de Eventos (PRD 1.0)

**Fonte:** [eventos.md](eventos.md)  
**Rotas:** `/controle-eventos` (grade) · `/controle-eventos/:eventoId` (caderno)  
**Data:** 28/08/2026  
**Status:** E0–E5 aplicados e testados no browser (28/08/2026, usuário admin).

Tintas: ouro e âmbar = papel, pasta, lacre. **Sem ciano** do ateliê. **Sem chat / rádio.**

A URL antiga `/eventos-crm` redireciona para a grade. Menu: **Marketing ▸ Controle de Eventos**.

---

## O que já existia (e por que não basta)

- Página `/eventos-crm` com `CrmPageFrame`: lista o título, a data e as páginas do caderno via RPC `movelaria_crm_eventos_boot`.
- Faltavam: pastas de papel, pin, tarefas na capa, quadro de 4 colunas, folha branca com autosave, fotos com lápis, PDF do dossiê, lacre WebGL.
- O menu ficava no Comercial (vendedor). O PRD coloca no **Marketing**; vendedor puro e projetista-only **não** entram.

---

## Épicos

### E0 — Domínio (regras, sem “cara nova” ainda)

- `canAccessControleEventos` / `canAccessMarketingConteudo`: admin **ou** marketing (marketing-only **sim**).
- Menu filho de Marketing; `hideIfVendedorRestricted`; projetista-only não vê.
- Tipos em `evento-types.ts`; busca, data local, totais, catálogo em `evento-helpers.ts`.
- Hooks: `useControleEventos`, `useEventoBoard`, `useEventoTarefas`.
- Sem Realtime. Sem tabela de mensagens.

**Teste:** script de fonte (papéis, rotas, helpers de busca/data/totais, hooks).

### E1 — Grade de pastas

- `/controle-eventos`: kicker MARKETING · DOSSIÊ, busca, Nova pasta, grid 1/2/3.
- `EventoFolderCard`: aba ouro, mogno, data 42 px, calendário na capa, pin CSS, menu ⋯.
- Criar pasta **já abre** o board. Excluir apaga filhos (cascade).

**Teste:** fonte do card/dialog + abrir a grade no browser.

### E2 — Board de 4 colunas

- `/controle-eventos/:id`: voltar Pastas, Tarefas N, PDF.
- Coluna 1 pessoas (lead ou convidado), coluna 2 compras + catálogo, coluna 3 caderno branco, coluna 4 totais.
- Caderno: 3 seções, várias folhas, autosave 400 ms, blur / troca / `beforeunload`.

**Teste:** fonte do board + caderno + abrir uma pasta no browser.

### E3 — Tarefas + fotos com lápis

- `EventoTarefasDialog` da lista e do board.
- Galeria + SVG (`EventoPhotoDrawCanvas`): lápis, borracha, cores, espessura, grava a cada traço.
- Storage `eventos/{id}/participantes|itens/{ownerId}/…`.

**Teste:** fonte do dialog/lápis + checklist no browser.

### E4 — PDF + auras WebGL

- `EventoPdfExportDialog` + lacre (`uFill`).
- Folha A4 HTML (não jsPDF no fluxo principal).
- Aura do caderno 64×64. Pastas **sem** WebGL.
- PDF só das fotos (composite traço + bitmap).

**Teste:** fonte do PDF/auras + dialog no browser.

### E5 — Busca, empty states, E2E

- Busca ignora acentos; empty “Nenhuma pasta ainda”; pasta inexistente.
- Script único E0–E4 + volta no browser (lista → criar → board → tarefas → PDF).

**Teste:** `scripts/test-controle-eventos.mjs` + fluxo real na porta 3001.

---

## Regras que não negociamos

1. Duas rotas. Criar pasta cai no board.
2. Caderno branco é a única exceção light do tema.
3. Sem chat, sem rádio, sem Realtime de mensagem.
4. WebGL só no selo do caderno e no lacre do PDF.
5. Catálogo é memória de preço, não estoque.
6. Pin + data na capa, sem obrigar a abrir o board.
7. Não misturar com `/controle-gastos` nem com Pontua.
8. Sem commit até o usuário pedir.
