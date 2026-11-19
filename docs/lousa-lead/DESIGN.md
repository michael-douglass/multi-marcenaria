# DESIGN — Lousa do card de lead

Referência funcional: `docs/lousa-lead-guia-recriacao.md` (inventário de ferramentas no §4).

## Mapa atual

| Peça | Arquivo |
|---|---|
| Componente | `src/components/leads/LeadWhiteboard.tsx` (montado em `LeadModal.tsx` `#lead-sec-lousa`, lazy) |
| Camada de anotações (SVG + HTML) | `src/components/leads/whiteboard/WhiteboardAnnotationsLayer.tsx` |
| Barra (grupos, `draftingIconClass`) | `src/components/leads/whiteboard/WhiteboardDraftingChrome.tsx` |
| Dados + fila offline | `src/hooks/useLeadWhiteboard.ts`, `src/lib/offline-storage.ts` (IndexedDB `crm-offline-whiteboard` v3) |
| Zoom/pinça/roda | `src/hooks/useWhiteboardViewport.ts` |
| Tipos e codificação | `src/lib/whiteboard-annotations.ts` (`WB_IMG:{id}:` + `WB_JSON:{...}`) |
| Export JPEG | `src/lib/whiteboard-render-export.ts`, `src/lib/lead-whiteboard-save.ts` |

Tabelas: `crm.lead_whiteboard_images` e `crm.lead_whiteboard_drawings` (isoladas por `empresa_id` + RLS; o trigger preenche a empresa — o front não envia). Bucket `marketing-medias`, caminho `leads/{leadId}/…`.

## D1 — Remoção dos objetos (R1)

- **Sai** de `LeadWhiteboard.tsx`: botão `Box`, catálogo inline por família, `Tool 'furniture'`, estados/refs de móvel, `selectFurnitureModule`, `createFurnitureModule`, prévia, ramos de pointer/Esc/undo/clear e a faixa "Segure no topo do móvel…".
- **Sai** de `WhiteboardAnnotationsLayer.tsx`: menu de edição do móvel (tamanho, largura, variantes, fixar, traços, giro, alças) e seus handlers.
- **Fica**: tipo `furniture_module` em `whiteboard-annotations.ts` (Ambiente IA usa), render na camada, `annotationBounds`, export JPEG. Móvel antigo vira anotação comum: seleciona, move, apaga (Delete/borracha).
- **Não muda**: arquivos `furniture-*`, `FurnitureModuleGfx`, Ambiente IA, lousa de obra. Sem migration.

## D2 — Offline (R3)

Princípio: **a tela nunca espera a rede**. Toda operação aplica na hora (cache do TanStack) e grava uma entrada local; o envio ao servidor é um passo separado.

1. **Rodar sem rede**: `networkMode: 'always'` na query e nas mutations da lousa, para que o ramo local rode mesmo com o `onlineManager` offline. Erro de rede com `navigator.onLine = true` (detectado por `src/lib/network-error.ts`) também cai na fila.
2. **Pendentes sempre na tela**: a query sempre mescla os pendentes do IndexedDB (com ou sem cache). O `onSuccess` troca só o `tmp` daquela operação.
3. **Foto offline**: guarda largura/altura reais (`createImageBitmap`); `blob:` revogado ao trocar/remover; remover foto `off_…` mexe só no IndexedDB. No sync, a foto sobe primeiro e os desenhos pendentes com `WB_IMG:off_X` são reescritos para o UUID novo antes de subir.
4. **Fila de operações** (store `pending-ops`, IndexedDB v4): `delete`, `clear`, `restore`, `update-image` (mover/nota). Aplicada em ordem de criação. Rascunho da nota salvo localmente.
5. **Isolamento**: cada registro leva `empresa_id` e `user_id`. Sync e leitura filtram pela conta/empresa atuais. Logout e troca de empresa limpam o banco local (mesmo ponto onde hoje se limpa o cache do TanStack, `useEmpresaAtiva.ts`).
6. **Sync**: ao voltar o sinal e ao abrir o card, envia os pendentes de todos os leads da conta, um por vez; falha mantém na fila.
7. **Estado visível**: na barra, substitui o ícone Cloud/CloudOff por *Offline · N pendentes* / *Sincronizando…* / *Tudo salvo*.

Sem service worker novo e **sem cache em tempo de execução para `supabase.co`** (regra do projeto).

## D3 — Responsividade e input (R4)

- **Alvos de toque**: o tamanho do botão passa a depender de `pointer: coarse` (toque), não de `isMobile`. Toque: 44×44px; mouse: mantém o compacto. Bolinhas de cor e alças ganham área de toque invisível de 44px sem mudar o desenho.
- **Safe-area**: tela cheia e barra flutuante usam `env(safe-area-inset-*)` (o `index.html` já tem `viewport-fit=cover`).
- **Rotação**: `fitContent` também em `resize`/`orientationchange` da tela cheia.
- **Acessibilidade**: `aria-label` em todos os botões de ferramenta (hoje só tooltip).
- **Caneta**: com caneta detectada (`pointerType === 'pen'`), toques de dedo não desenham (palma); ignorar o `touchstart` que o Safari dispara junto com o Apple Pencil.
- **Roda do mouse**: no modo embutido, sem Ctrl a roda rola o card; com Ctrl (ou pinça do trackpad, que chega com `ctrlKey`) dá zoom. Em tela cheia, zoom livre.

## D4 — Testes no navegador

- Playwright Python (skill `webapp-testing`), scripts em `scripts/lousa-lead/`.
- Login: perfil persistente do Playwright numa pasta gitignorada; o humano loga uma vez na janela visível. Nenhuma senha em script.
- Matriz: 390×844, 360×800, 800×1280, 820×1180, 1024×1366 (retrato e paisagem nos tablets), 1440×900. `has_touch`/`is_mobile` nos aparelhos de toque.
- Offline: `context.set_offline(True)` no meio do uso; depois `False` e conferir no servidor.
- Coleta: `page.on('console')` e `page.on('pageerror')`; screenshots numa pasta gitignorada.
