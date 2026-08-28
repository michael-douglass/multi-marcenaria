# Plano — Sistema de renderização no card do lead

**Fonte:** [sistema-render.md](sistema-render.md)  
**Referência 1:1:** [CRM-Multiemrpesas](https://github.com/michael-douglass/CRM-Multiemrpesas)  
**Onde:** aba **Análise IA → Renderização de projetos** no `LeadModal`  
**Data:** 28/08/2026

Tintas: ouro de estúdio `#f2d892`. Não misturar com o ciano do ateliê de Projetos.

---

## O que a vistoria encontrou

Já iguais ao GitHub (núcleo de estúdio):

- `render-lead-project` + `edit-lead-render` (código e Edge no ar)
- `chat-iris-sky`, análise visual, comparar/AMPLIAR, pins, thinking
- APIs `render-lead-project-api` e `edit-lead-render-api`

Faltando no Garbo (existe no GitHub):

| Peça | Papel |
|------|--------|
| Terceiro botão **Renderizar com ambiente** | Sofa + foil WebGL |
| `LeadAIAmbienteComposer` + pasta `ambiente/` | Lousa do cômodo |
| `render-lead-ambiente` no frontend | Desmembrar + gerar (a Edge **já está publicada**) |
| Colunas `render_ambiente_*` na config | Interruptor e prompts |
| Jobs `ambienteJobs` no contexto de background | Não trava o card |
| Selo “Ambiente” no histórico | `mode: ambiente` |

A Edge `render-lead-ambiente` já está ativa no projeto Supabase. O buraco é a **tela** e a **config**.

---

## Épicos

### R0 — Domínio e config

Colunas `render_ambiente_ativo`, prompts, tipos, interruptor em Pipeline → IA.

**Teste:** fonte + SQL em `emp_garbo`.

### R1 — Lousa de ambiente (UI)

Copiar compositor, toolbar, foil, grade, HUD, zoom, tipos, export JPEG, sugestões YAML, catálogo de móveis e diálogo de pasta.

**Teste:** script de cores/atalhos + arquivos do mapa do PRD.

### R2 — Os três botões no card

`LeadAIRenderTab` 1:1: Editar por pontos, Renderizar projeto, Renderizar com ambiente (rola até `#lead-ai-ambiente-composer`).

**Teste:** fonte da aba + abrir a subaba no browser.

### R3 — Jobs em segundo plano + AMPLIAR/histórico

Contexto com fila de ambiente; popup do raio lista Sofa; histórico distingue estúdio vs ambiente. Fullscreen da lousa não fecha o LeadModal.

**Teste:** fonte do contexto/popup + Escape no compositor.

### R4 — Motor `render-lead-ambiente`

Código da Edge no repositório (já no ar). Cliente `render-lead-ambiente-api.ts`. Segredo OpenAI só no servidor.

**Teste:** fonte da função + invoke path.

### R5 — E2E no card

Abrir lead → Análise IA → Renderização: três botões, galeria, compositor, banners se interruptor off.

**Teste:** browser no Pipeline.

---

## Regras

1. Não sobrescrever o `LeadModal` inteiro (já tem o painel de Projetos). Só o gancho de tela cheia do ambiente.
2. Não copiar `.env` do GitHub.
3. WebGL só nos foils únicos (botão/header/toolbar), `low-power`.
4. Sem commit até o usuário pedir.
