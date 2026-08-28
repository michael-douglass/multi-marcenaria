# Plano — Ateliê de Projetos (PRD 1.0)

**Fonte:** [projetos.md](projetos.md)  
**Rota:** `/projetos`  
**Data:** 28/08/2026  
**Status:** P0–P5 aplicados e testados no browser (28/08/2026, usuário admin).

Tintas: ouro `#f2d892` = comercial; ciano `#7dd3fc` = desenho; âmbar = fila; teal = visita; esmeralda = feito.

---

## O que já existia (e por que não basta)

- Página genérica com `CrmPageFrame`, colunas do Kanban comercial e um painel simples no LeadModal.
- Faltavam: fundo/medidor/lâmpada WebGL, rádio, claim visível, dois escopos de busca, dialog de envio com fotos, selo CSS na Pipeline, `contextoProjeto` / `modoProjeto`.

---

## Épicos

### P0 — Domínio (regras, sem “cara nova” ainda)

- Funções em `src/lib/app-roles.ts`: `canAccessProjetosBoard`, `isProjetistaOnly`, `isProjetistaAdminRole`, `isProjetistaRole`.
- `src/lib/projetos-atelie.ts`: kinds pelo **nome** (`waiting` / `visita` / `feito` / `other`), `isProjetoEmDesenho`, fila (`aguardando` / `aguadando` / `fila`), feitos = **última** coluna.
- Hooks: `useLeadProjetos({ realtime })`, pegar / soltar / mover / concluir / reabrir / solicitar / puxar, realtime em `lead_projetos`.
- Menu: projetista-only **não** vê Pipeline; home continua `/projetos`.

**Teste:** script de fonte + classificação das 5 colunas reais (Visita, Aguardando, Urgentes aguadando, Semi prontos, Feitos).

### P1 — Casco da página + auras

- Página ocupa a altura (`flex-1 overflow-hidden`), **sem** `CrmPageFrame`.
- `ProjetosBoardAura` no fundo; cabeçalho z-30 (SETOR / Projetos / medidor / rádio / zoom / Novo / Colunas).
- `ProjetosAbertosCard` (arco WebGL). Coluna visita com `ProjetoVisitaColumnAura`.
- Kanban `DndContext` + `pointerWithin` + 8 px; scrollbar flutuante; `?id=` abre o modal.

**Teste:** fonte da página + abrir `/projetos` no browser (cabeçalho, fundo, colunas).

### P2 — Card do ateliê + selo na Pipeline

- `ProjetoKanbanCard` (lâmpada, titular, parceiro, ações, CSS claimed).
- `KanbanProjetoSignal` no card comercial (CSS, sem canvas).
- Anel `kanbanCardProjetoRingClass`. Realtime na Pipeline.

**Teste:** fonte do card/selo + Pipeline mostra o selo num lead que está no ateliê.

### P3 — Chat / rádio

- Thread, composer, badge, sheet do rádio, waveform.
- Upload na pasta `chat` do bucket `marketing-medias`.
- Tinturas: projetista puro = ciano; dual/titular = ouro.

**Teste:** fonte do rádio + composer (Ctrl+Enter, 2000 chars) + lib de upload.

### P4 — LeadModal no ateliê + envio da Pipeline

- Flags `contextoProjeto`, `modoProjeto`, `statusChangeOnSelect={false}`.
- Painel de conclusão no topo; notas; composição (slides+markup) no topo.
- Ocultar envio inicial no ateliê; contratos escondidos se `modoProjeto`.
- `LeadEnviarProjetoDialog` na Pipeline (8 chars ou foto, até 8 imagens).

**Teste:** fonte do modal + dialog de envio.

### P5 — Busca, novo lead, colunas, E2E

- Busca dois escopos (1 letra no quadro / 2 letras em todos).
- Novo lead: cria comercial + fila, sem dialog de recado.
- Config de colunas só admin / projetista_admin.
- E2E browser: quadro, rádio, abrir card, Pipeline.

**Teste:** script P0–P5 + volta no browser.

---

## Regras que não negociamos

1. Funil comercial ≠ colunas do ateliê.
2. Um `lead_projetos` por lead.
3. Claim visível (lâmpada) quando `arquiteto_id` e não está na fila.
4. WebGL só em peças únicas; Pipeline em CSS.
5. Confirmar soltar / reabrir / solicitar / puxar. Pegar e arrastar não confirmam.
6. Sem commit até o usuário pedir.
