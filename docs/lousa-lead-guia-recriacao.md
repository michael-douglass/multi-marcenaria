# Guia da Lousa do Lead — funções + estrutura para recriar

**Produto:** CRM Selletos (GARBO Movelaria)  
**Módulo:** Lousa do Lead (anotar foto / quadro branco de projeto)  
**Versão:** 2.0 (estado do código em produção)  
**Onde aparece:** Modal do Lead → seção **Lousa** (`#lead-sec-lousa` → `#lead-whiteboard`)  
**Componente React que você viu no inspector:** `BoardInner` (o DevTools pode mostrar `BoardInner2` após hot-reload — é o mesmo componente)

> Este documento explica **o que a lousa faz** (para um profissional não técnico) e **como o código está organizado** (para recriar em outro sistema).  
> Há um PRD complementar em `lousa.md` na raiz do repo; este arquivo é o guia técnico atualizado.

---

## 1. Em linguagem simples: o que é a lousa?

Imagine uma **folha transparente** colocada em cima de uma foto (ou de um papel em branco).

1. Você coloca o fundo: **quadro branco**, **foto do celular**, **arquivo** ou **imagem já do projeto**.
2. Em cima, você **risca, mede, escreve e coloca móveis** desenhados.
3. Tudo fica **salvo no lead**, ligado àquela foto.
4. No fim, você pode **salvar nos anexos**: vira um JPEG (foto + riscos) e a lousa limpa para o próximo trabalho.

**Não é** um Miro infinito. O “mundo” da lousa tem o **tamanho da imagem ativa**. Zoom e pan só mudam a câmera; os riscos não “descolam” da foto.

---

## 2. A tela vazia que você apontou

Quando **não há foto ativa**, o centro da área escura (`bg-[#120c09]`) mostra quatro ações:

| Botão | O que faz no código |
|-------|---------------------|
| **Quadro branco** | Cria uma imagem JPEG branca 1280×720 (`createBlankWhiteboardFile`) e faz upload como se fosse uma foto. Abre em tela cheia se possível. |
| **Inserir foto** | Abre o seletor de arquivos do sistema (galeria). |
| **Tirar foto** | Abre o fluxo de câmera (`WhiteboardCameraCapture`). |
| **Do projeto** | Abre o picker de mídias já anexadas no lead (`WhiteboardProjectImagePicker`). |

Texto da UI:

> “Abra um quadro branco para desenhar sem foto, ou insira uma imagem para medir e anotar.”

**Pré-requisito:** o lead precisa estar **salvo** (ter `leadId`). Sem isso, aparece toast pedindo para salvar o lead.

---

## 3. Mapa de experiência (fluxo do usuário)

```
Pipeline → abre Lead → seção Lousa
  │
  ├─ Estado vazio
  │    ├─ Quadro branco
  │    ├─ Inserir foto
  │    ├─ Tirar foto
  │    └─ Do projeto
  │
  ├─ Com foto ativa
  │    ├─ Miniaturas (trocar foto)
  │    ├─ Notas da foto (painel ao lado / abaixo)
  │    ├─ Barra de ferramentas (caneta, formas, medida, móveis…)
  │    ├─ Zoom / pan / ajustar
  │    ├─ Undo / Redo
  │    ├─ Tela cheia
  │    └─ Salvar nos anexos (escolhe pasta → JPEG + opcional nota → limpa lousa)
  │
  └─ Config admin (Pipeline → Lousa): fonte/tamanho/cor padrão do texto
```

---

## 4. Inventário completo das funções

### 4.1 Entrada de fundo (antes de desenhar)

| Função | Comportamento |
|--------|----------------|
| Quadro branco | Folha branca; serve para croqui sem foto |
| Upload | Arquivo de imagem ≤ 15 MB; comprime/normaliza (HEIC, resolução alta) |
| Câmera | Captura webcam/celular |
| Do projeto | Copia URL de mídia já do lead para a lousa |
| Import externo | Evento `LEAD_WHITEBOARD_IMPORT_EVENT` (ex.: botão “Editar na lousa” nos anexos) |

### 4.2 Ferramentas da barra (`Tool`)

| ID | Nome | Uso | Persistência |
|----|------|-----|--------------|
| `select` | Selecionar | Mover, redimensionar, rotacionar; editar texto/medida/móvel | UPDATE do JSON |
| `pencil` | Desenhar | Arrasta → traço livre no canvas temporário | Path SVG `M… L…` |
| `eraser` | Apagar | Clique no traço/anotação | DELETE |
| `line` | Linha | Arraste A→B | `kind: 'line'` |
| `rect` | Retângulo | Arraste | `kind: 'rect'` |
| `ellipse` | Elipse | Arraste | `kind: 'ellipse'` |
| `text` | Texto | Clique coloca caixa; digita depois | `kind: 'text'` |
| `points` | Pontos e linhas | Cliques formam polilinha; **duplo clique finaliza**; snap em pontos | `kind: 'polyline'` |
| `measure` | Medição reta | Clique A, clique B; label editável (ex. `58,5`) | `kind: 'measure'` |
| `measure_arc` | Medição arco | A → B → ajustar arco (`via`) | `measure` com `via` |
| `furniture` | Móveis | Catálogo; 1º clique **topo**, 2º **base** | `kind: 'furniture_module'` |

### 4.3 Controles auxiliares

| Controle | Função |
|----------|--------|
| Cor / espessura | Traço, formas, móveis |
| Undo / Redo | Pilha local (`useWhiteboardHistory`) — Ctrl+Z / Ctrl+Y |
| Zoom − / + / ajustar | Viewport; pinça no mobile; duplo clique no fundo = fit |
| Limpar desenhos | Apaga anotações da foto ativa (mantém a foto) |
| Remover foto | Remove foto + seus desenhos |
| Tela cheia | Mesmo `BoardInner` em Dialog maior |
| Barra recolhível | Ganha espaço na mesa |
| Dicas / ajuda | `LousaUsageTips` |
| Indicador online/offline | Nuvem / nuvem riscada |
| Notas da foto | Texto livre por imagem (`observacao`) |
| Salvar nos anexos | Rasteriza → JPEG → pasta do lead → limpa lousa |
| Nota no save | Opcional: arquivo de nota com miniatura da foto na mesma pasta |

### 4.4 Comportamentos especiais

- **Select + móvel:** enquanto não `locked`, edita traços internos, tipo, rotação, tamanho; **Salvar** no móvel trava (`locked: true`).
- **contentLocked:** formas não movem; texto ainda edita/redimensiona.
- **Texto:** criado no **próximo clique** na lousa (não ao só escolher a ferramenta).
- **Uma foto = um conjunto de desenhos:** cada drawing carrega prefixo `WB_IMG:{imageId}:…`.

---

## 5. Arquitetura em camadas (como a mágica funciona)

```
┌──────────────────────────────────────────┐
│  Canvas temporário do lápis              │  ← só enquanto desenha
│  Camada SVG/HTML de anotações            │  ← texto, formas, medida, móvel
│  Traços livres já salvos (SVG paths)     │
│  Foto / quadro branco ativo              │
│  Viewport (pan + zoom)                   │  ← “câmera”
└──────────────────────────────────────────┘
```

### Mundo vs. tela

- **Mundo** = tamanho da foto (`width` × `height` da imagem no banco).
- **Tela** = o que você vê com zoom.
- Conversão: `screenToWorld` / `worldToScreen` em `useWhiteboardViewport`.
- Todo traço e anotação são gravados em **coordenadas do mundo**.

### Componentes React (árvore)

```
LeadModal
  └─ <Suspense>
       └─ LeadWhiteboard                    ← wrapper (inline + fullscreen)
            ├─ BoardInner (variant=inline)  ← o que você inspecionou
            └─ Dialog (tela cheia)
                 └─ BoardInner (variant=fullscreen)
```

`BoardInner` orquestra:

- hooks de dados / viewport / histórico / touch
- canvas do lápis
- `WhiteboardAnnotationsLayer`
- toolbar (`WhiteboardDraftingChrome`, `WhiteboardWoodFoil`)
- notas (`WhiteboardImageNotes`)
- diálogos (câmera, picker, pasta de save)

---

## 6. Estrutura de pastas (mapa do código)

```
src/
  components/leads/
    LeadWhiteboard.tsx                      # Orquestrador UI (~3500 linhas)
    LeadFolderPickDialog.tsx                # Escolher pasta ao salvar nos anexos
    whiteboard/
      WhiteboardAnnotationsLayer.tsx        # Render + interação das anotações
      MeasureAnnotationGfx.tsx              # Visual das medidas (setas, label)
      FurnitureModuleGfx.tsx                # Esboço isométrico dos móveis
      WhiteboardFurnitureCatalog.tsx        # Catálogo na toolbar
      WhiteboardCameraCapture.tsx           # Tirar foto
      WhiteboardProjectImagePicker.tsx      # “Do projeto”
      WhiteboardImageNotes.tsx              # Painel de nota da foto
      WhiteboardDraftingChrome.tsx          # Estilo da barra + dicas
      WhiteboardWoodFoil.tsx                # Acabamento visual da barra
      ProjectImageStudio.tsx                # Estúdio/crop (fluxo de projeto)
      ImageStudioCropFrame.tsx
      ChecklistGoldFoil.tsx

  hooks/
    useLeadWhiteboard.ts                    # CRUD images/drawings + offline + sync
    useWhiteboardViewport.ts                # pan / zoom / fit / screen↔world
    useWhiteboardHistory.ts                 # undo / redo
    useWhiteboardTouchLock.ts               # evita scroll da página no gesto
    useWhiteboardTextConfig.ts              # tipografia padrão da empresa

  lib/
    whiteboard-annotations.ts               # encode/decode WB_JSON / WB_IMG + tipos
    furniture-modules.ts                    # catálogo + geometria dos móveis
    photo-measure-style.ts                  # formato BR, arco, zona, cores
    whiteboard-render-export.ts             # foto + desenhos → Canvas → JPEG
    lead-whiteboard-save.ts                 # File JPEG para anexos
    lead-whiteboard-note-export.ts          # cartão de nota com miniatura
    whiteboard-image-upload.ts              # blank board, compressão, limites
    lead-whiteboard-import.ts               # evento de import + helpers
    whiteboard-text-config.ts               # limites de fonte
    offline-storage.ts                      # IndexedDB pending images/drawings

  components/pipeline/
    WhiteboardTextSettingsCard.tsx          # Config admin tipografia

  pages/crm/
    LeadLousaPage.tsx                       # Rota dedicada /leads/:id/lousa (opcional)
```

### Responsabilidade de cada camada (para recriar)

| Camada | Deve fazer | Não deve fazer |
|--------|------------|----------------|
| **UI (`LeadWhiteboard`)** | Tools, gestos, previews, dialogs | SQL direto espalhado |
| **Hook de dados** | Carregar/salvar images + drawings, offline | Conhecer SVG de móvel |
| **Viewport** | Só câmera (scale, x, y) | Persistir desenhos |
| **Annotations layer** | Hit-test, drag, resize, commit | Upload de arquivo |
| **Lib annotations** | Contrato de encoding | React |
| **Export** | Rasterizar mundo → JPEG | UI |

---

## 7. Modelo de dados

### 7.1 Tabelas

#### `lead_whiteboard_images`

| Campo | Significado |
|-------|-------------|
| `id` | UUID da foto na lousa |
| `lead_id` | Lead dono |
| `file_url` | URL no Storage |
| `file_name` | Nome |
| `width` / `height` | Tamanho do **mundo** |
| `position_x` / `position_y` | Legado de layout |
| `z_index` | Ordem |
| `observacao` | Nota textual da foto (migration 204) |
| `criado_em` / `atualizado_em` | Auditoria |

#### `lead_whiteboard_drawings`

| Campo | Significado |
|-------|-------------|
| `id` | UUID |
| `lead_id` | Lead dono |
| `path_data` | Traço SVG **ou** anotação JSON (ver encoding) |
| `cor` | Cor do traço/forma |
| `stroke_width` | Espessura |
| `criado_em` | Quando |

#### `lead_whiteboard_text_config` (por empresa)

| Campo | Significado |
|-------|-------------|
| `singleton_key` | `'default'` |
| `font_family` / `font_size_px` / `text_color_hex` | Padrão do texto |

### 7.2 Encoding de `path_data` (contrato crítico)

O **mesmo campo** guarda três formatos:

1. **Lápis (freehand)**  
   `M 10 20 L 12 22 L 15 30`

2. **Anotação**  
   `WB_JSON:{"kind":"rect","x":10,"y":20,"w":100,"h":50,"rotation":0}`

3. **Vínculo à foto** (obrigatório em desenhos novos)  
   `WB_IMG:{imageId}:WB_JSON:{...}`  
   ou  
   `WB_IMG:{imageId}:M 10 20 L …`

Helpers em `whiteboard-annotations.ts`:

- `bindDrawingToImage` / `unbindDrawingImage`
- `filterDrawingsByImage`
- `encodeAnnotationPayload` / `decodeAnnotationDrawing`
- `splitWhiteboardDrawings` (separa paths livres vs anotações)

### 7.3 Payloads JSON

```ts
{ kind: 'text', x, y, w, h, rotation, text, fontSize }
{ kind: 'rect', x, y, w, h, rotation }
{ kind: 'ellipse', cx, cy, rx, ry, rotation }
{ kind: 'line', a: {x,y}, b: {x,y} }
{ kind: 'polyline', points: [{x,y}, ...] }
{ kind: 'measure', a, b, via?, label, colorHex?, bidirectional?, showZone? }
{
  kind: 'furniture_module',
  moduleType: string,   // ex. 'armario_2_portas'
  a, b,                 // topo e base
  topDown?: true,
  widthOverride?, heightOverride?,
  colorHex?,
  hiddenLineIndices?: number[],
  locked?: boolean
}
```

Limites da caixa de texto (mundo): min 80×32 · max 720×480.

### 7.4 Storage

- Bucket atual: `marketing-medias`
- Caminho típico: `leads/{leadId}/…`
- Limite: **15 MB** antes do prepare; alvo pós-compressão ~8 MB

---

## 8. API do hook `useLeadWhiteboard(leadId)`

O que a UI consome:

| Método / dado | Função |
|---------------|--------|
| `images` / `drawings` | Estado atual (servidor + offline mesclado) |
| `isLoading` / `isError` / `isOnline` / `isSaving` | Status |
| `uploadImage(file, boardWidth, placementIndex?)` | Sobe foto (ou blank) |
| `importImageFromUrl({ fileUrl, fileName, boardWidth })` | “Do projeto” |
| `addDrawing` / `updateDrawing` / `deleteDrawing` / `restoreDrawing` | CRUD de traços |
| `clearDrawings(ids?)` | Limpa desenhos (todos ou lista) |
| `clearWhiteboard()` | Apaga fotos + desenhos do lead |
| `updateImage` / `deleteImage` | Metadados / remover foto |
| `saveImageNote(imageId, text)` | Persiste `observacao` |

**Offline:** IndexedDB (`crm-offline-whiteboard`). Ao voltar online, `syncPendingImages` + `syncPendingDrawings`.

**Optimistic UI:** traços de lápis aparecem na hora; anotações JSON evitam flicker especial (ver `onMutate` do add).

---

## 9. Fluxos técnicos principais

### 9.1 Desenhar com o lápis

```
pointer down no canvas
  → acumula pontos em tela
pointer move
  → desenha preview no canvas 2D
pointer up
  → screenPointsToWorldPath(points, view)
  → bindDrawingToImage(activeImageId, path)
  → addDrawing({ path_data, cor, stroke_width })
  → push histórico 'add'
  → limpa canvas temporário
```

### 9.2 Criar anotação (ex.: retângulo)

```
tool = rect
pointer down → ponto A (mundo)
pointer move → shapePreview
pointer up → ponto B
  → encodeAnnotationPayload({ kind:'rect', ... })
  → bindDrawingToImage
  → addDrawing
  → history push
```

### 9.3 Salvar nos anexos

```
saveToAttachments()
  → exportWhiteboardImageForRender(image, drawings)  // Canvas 2D
  → buildWhiteboardAttachmentFile → File JPEG
  → LeadFolderPickDialog (pasta + nome + incluir nota?)
  → uploadPDF (anexo do lead)
  → se nota: buildWhiteboardNoteAttachmentFiles → upload
  → clearWhiteboard()
  → resetHistory()
```

### 9.4 Quadro branco

```
startBlankBoard()
  → pede fullscreen com createBlankIfEmpty
  → ensureBlankBoard()
       espera loading terminar
       se images.length === 0
         createBlankWhiteboardFile(1280, 720)
         uploadImage(file, ...)
```

---

## 10. Dependências externas (o que o outro sistema precisa)

| Necessidade | Como está hoje |
|-------------|----------------|
| React + TypeScript | Vite SPA |
| UI kit | Shadcn/Radix + Tailwind + Lucide |
| Banco | Postgres (Supabase) multi-schema por empresa |
| Cache remoto | React Query (`['lead-whiteboard', schema, leadId]`) |
| Auth / RLS | Usuário autenticado da empresa |
| Offline | IndexedDB |
| Lib de whiteboard | **Nenhuma** — SVG + Canvas nativos |

**Não precisa** de Excalidraw, tldraw, Fabric ou Konva para reproduzir o produto.

---

## 11. Plano de recriação em outro sistema (fases)

### Fase 1 — Núcleo
- Tabela de imagens + tabela de drawings
- Upload de foto
- Viewport pan/zoom/fit
- Lápis + borracha
- Encoding `WB_IMG` + path SVG
- Persistência online

### Fase 2 — Anotações
- Linha, retângulo, elipse, texto
- Select (mover/resize/rotate)
- Undo/redo
- Export JPEG

### Fase 3 — Projeto (marcenaria)
- Medição reta + arco (label BR)
- Catálogo de móveis (pode começar pequeno)
- Polilinha com snap

### Fase 4 — Campo e produto
- Quadro branco
- Câmera + import do projeto
- Notas da foto + export da nota
- Offline sync
- Read-only (prestador)
- Config tipografia
- Multi-tenant

### O que cortar no MVP de outro domínio
- Catálogo enorme de móveis/eletros/decoração (hoje tem dezenas de `moduleType`)
- Visual “madeira/ouro” da toolbar (é só branding)
- Integração com slides de orçamento / IA (específico deste CRM)

---

## 12. Checklist de aceite (outro sistema)

- [ ] Foto sobe e o lápis não descola ao dar zoom  
- [ ] Quadro branco funciona sem foto real  
- [ ] Trocar de foto mostra só os desenhos daquela foto  
- [ ] Texto, formas, linha, polilinha  
- [ ] Medida A→B com vírgula decimal  
- [ ] Móvel topo→base + travar  
- [ ] Undo/Redo  
- [ ] Offline desenha e sincroniza depois  
- [ ] Salvar nos anexos gera JPEG com riscos e limpa a lousa  
- [ ] Nota opcional salva na mesma pasta  
- [ ] Usuário só-leitura não edita  
- [ ] Dados isolados por empresa  

---

## 13. Glossário

| Termo | Significado simples |
|-------|---------------------|
| Lousa | Folha transparente em cima da foto |
| Foto ativa | Imagem na tela agora |
| Quadro branco | Foto artificial toda branca |
| Traço / path | Risco do lápis (SVG) |
| Anotação | Objeto estruturado (texto, retângulo, medida…) |
| Mundo | Coordenadas do tamanho da foto |
| Viewport | Janela com zoom e pan |
| Exportar | Transformar foto+risco em um JPEG |
| Offline | Continua sem internet; sincroniza depois |

---

## 14. Arquivos para abrir primeiro (ordem de leitura)

1. `src/components/leads/LeadWhiteboard.tsx` — UI e ferramentas  
2. `src/hooks/useLeadWhiteboard.ts` — dados e offline  
3. `src/lib/whiteboard-annotations.ts` — contrato dos dados  
4. `src/hooks/useWhiteboardViewport.ts` — câmera  
5. `src/components/leads/whiteboard/WhiteboardAnnotationsLayer.tsx` — interação  
6. `src/lib/whiteboard-render-export.ts` — export JPEG  
7. `src/lib/furniture-modules.ts` — só se for marcenaria  
8. `supabase/migrations/204_lead_whiteboard_image_observacao.sql` — coluna de nota  

---

**Documento gerado para reimplantação.**  
Priorize Fases 1–2; adicione medida/móveis só se o novo sistema for de marcenaria/projeto.
