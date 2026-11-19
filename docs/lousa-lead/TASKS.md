# TASKS — Lousa do card de lead

Requisitos: `REQUIREMENTS.md` · Desenho: `DESIGN.md` · Plano: `C:\Users\PC\.claude\plans\joyful-drifting-yeti.md`

Ritmo: uma tarefa por vez — diagnóstico → OK → implementa → valida → `[x]` → relatório → OK.
Validação padrão: `pnpm exec tsc --noEmit -p tsconfig.app.json` (só erros nos arquivos tocados; há erros antigos) + `pnpm build`.
Lead de teste: `http://localhost:3091/pipeline?id=39`. Sem commit/push sem pedido.

## Fase 0 — Planejamento

- [x] **T00 — Specify & Plan**
  - `REQUIREMENTS.md`, `DESIGN.md`, `TASKS.md` nesta pasta.
  - Aceite: humano aprova os três.

## Fase 1 — Base

- [ ] **T01 — Auditoria de base no navegador** (nenhuma mudança no app)
  - Script Playwright em `scripts/lousa-lead/`; perfil de login gitignorado; matriz de 5 viewports; cada ferramenta exercitada; console capturado.
  - Aceite: `AUDITORIA.md` com bugs reais por ferramenta e viewport; bugs novos viram tarefas propostas.

## Fase 2 — Objetos

- [ ] **T02 — Tirar a criação de objetos** (`LeadWhiteboard.tsx`)
  - Aceite: sem botão "Móveis" e sem catálogo; demais ferramentas iguais; typecheck sem erro novo.
- [ ] **T03 — Móveis antigos só leitura** (`WhiteboardAnnotationsLayer.tsx`)
  - Aceite: móvel antigo aparece, move e apaga; sem menu de móvel; JPEG exportado igual.

## Fase 3 — Offline

- [ ] **T04 — Mutations rodam sem rede** (`networkMode: 'always'`; erro de rede vai para a fila)
  - Aceite: `set_offline` no meio do uso — traço, forma e medida salvam local na hora.
- [ ] **T05 — Pendentes sempre visíveis** (merge na query; `onSuccess` troca só o seu `tmp`)
  - Aceite: 5 traços offline seguidos continuam todos na tela.
- [ ] **T06 — Foto e quadro branco offline corretos** (dimensões reais, revoke, remover local, remapear `WB_IMG:off_`)
  - Aceite: foto + desenhos offline → reconecta → tudo no lugar certo no servidor.
- [ ] **T07 — Fila de operações** (`pending-ops`, IndexedDB v4: apagar, limpar, restaurar, mover foto, nota + rascunho da nota)
  - Aceite: cada operação offline aparece na hora e chega ao servidor em ordem.
- [ ] **T08 — Sync, aviso e isolamento** (`empresa_id`/`user_id` nos pendentes, limpeza no logout/troca de empresa, sync de todos os leads da conta, indicador na barra)
  - Aceite: outra conta não vê nem envia pendentes alheios; contador correto.

## Fase 4 — Responsivo e input

- [ ] **T09 — Responsivo** (alvos ≥ 44px por `pointer: coarse`, safe-area, refit em rotação, `aria-label`)
  - Aceite: screenshots das 5 viewports sem corte/sobreposição.
- [ ] **T10 — Caneta, palma e roda do mouse**
  - Aceite: verificado no Playwright + teste manual do humano em iPad e Samsung.

## Fase 5 — Fechamento

- [ ] **T11 — Revalidação final** (matriz online/offline, `security-check` no diff, `web-design-guidelines`)
  - Aceite: zero erro de console novo; sem achado alto/crítico; seção "depois" no `AUDITORIA.md`.

## Propostas fora do escopo (aguardam decisão)

- **P01 — Credenciais em texto puro** em `docs/ususariostestes.md`: mover para fora do repositório (gerenciador de senhas) e trocar as senhas. Não lido nem copiado por este trabalho.
