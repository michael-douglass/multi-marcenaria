# PRD — Lousa (Whiteboard) do Lead

**Produto:** CRM Selletos (Multi-empresas)  
**Módulo:** Lousa do Lead (anotação sobre fotos de projeto)  
**Versão:** 1.1 (PRD + ponteiro para guia técnico atualizado)  
**Data:** 03/08/2026 · atualizado 20/10/2026  
**Status:** Sistema em produção — PRD retrospectivo para recriar em outro sistema  
**Onde vive:** dentro do modal do Lead (aba/seção Lousa) · portal do Prestador (só leitura)  
**Config admin:** Pipeline → Configurações → aba Lousa  

> **Guia técnico atualizado (recomentado para recriar em outro sistema):**  
> [`docs/lousa-lead-guia-recriacao.md`](docs/lousa-lead-guia-recriacao.md)  
> Inclui quadro branco, notas da foto, mapa de pastas e fluxos do código atual.

> **Atenção:** neste CRM existem **duas** telas chamadas de “lousa”. Este PRD cobre a **Lousa do Lead** (anotar fotos de marcenaria/projeto). No final há um apêndice sobre a **Lousa de Marketing** (planejamento visual com React Flow), que é outro produto.

---

## 1. Resumo executivo (em linguagem simples)

Imagine que o vendedor vai na casa do cliente, tira foto da parede/cozinha/quarto, e precisa **riscar em cima da foto** o que vai ser feito: onde fica o armário, a medida de 2,40 m, uma seta, um texto “porta de correr”.

A **Lousa** é exatamente isso:

1. Você coloca uma **foto** na tela (upload, câmera ou foto já anexada no lead).
2. Em cima dessa foto, você usa **ferramentas de desenho** (caneta, formas, texto, medição, móveis prontos).
3. Tudo fica **salvo no lead**, ligado àquela foto.
4. Quando terminar, você pode **gerar uma imagem final** (foto + riscado) e mandar para os **anexos** do lead — útil para orçamento, IA e o time de produção.

Não é um quadro branco infinito tipo Miro. É uma **folha transparente por cima da foto**.

---

## 2. Problema que o módulo resolve

| Situação anterior | Impacto |
|-------------------|---------|
| Medidas e ideias só no WhatsApp / caderno | Informação se perde fora do lead |
| Foto sem anotação | Produção e orçamento não entendem o projeto |
| Desenhar móvel do zero toda vez | Demora e inconsistência |
| Prestador sem ver o risco do projeto | Retrabalho na obra |
| Trabalho em campo sem internet | Anotações sumiriam sem modo offline |

---

## 3. Objetivos

### Objetivos de negócio
- Registrar o projeto visualmente **dentro do lead**, não espalhado
- Acelerar a conversa de marcenaria com **módulos prontos** de móveis
- Entregar ao orçamento / IA / produção a **mesma foto anotada**
- Isolar dados por empresa (multi-tenant)

### Objetivos de produto
- Ferramentas claras: selecionar, desenhar, apagar, formas, texto, pontos, medir, móveis
- Zoom/pan confortável no celular e no desktop
- Desfazer / refazer
- Funcionar **offline** e sincronizar depois
- Exportar JPEG para anexos e limpar a lousa
- Prestador vê, mas **não edita** (quando permitido)

### Fora do escopo atual (não existe hoje)
- Sticky notes
- Colaboração em tempo real (cursores de outras pessoas)
- Biblioteca tipo Excalidraw / tldraw / Fabric / Konva
- Link público para compartilhar a lousa
- Templates de lousa do lead
- Histórico versionado de desenhos

---

## 4. Personas e permissões

| Persona | O que pode fazer |
|---------|------------------|
| **Admin / Vendedor** (com edição de lead) | Inserir fotos, desenhar, editar, apagar, exportar para anexos, tela cheia |
| **Admin** | Configurar fonte, tamanho e cor padrão do texto (aba Lousa nas configurações do Pipeline) |
| **Prestador** | Ver a lousa **somente leitura**, se a permissão `pode_ver_lousa` estiver ligada no vínculo lead↔prestador |
| **Visitante / cliente final** | Não tem acesso |

**Regra de isolamento:** cada empresa tem suas tabelas no schema próprio (`emp_*`). A lousa de um lead da Empresa A não aparece na Empresa B.

---

## 5. Mapa da experiência (onde o usuário clica)

```
Pipeline → abre o Lead
  └─ seção / aba "Lousa"
       ├─ Inserir foto (arquivo / câmera / do projeto)
       ├─ Escolher foto ativa (miniaturas embaixo)
       ├─ Barra de ferramentas (caneta, formas, medição, móveis…)
       ├─ Desenhar / anotar sobre a foto
       ├─ Salvar nos anexos (gera JPEG e limpa a lousa)
       └─ Tela cheia (mesmo board em Dialog maior)
```

Fluxo mental em 4 passos:

1. **Coloca a foto**  
2. **Risca o que precisa**  
3. **Salva** (no banco automaticamente a cada traço/anotação)  
4. **Opcional:** “Salvar nos anexos” → vira uma foto pronta no lead

---

## 6. Conceito técnico (como a mágica funciona)

Pense em **camadas empilhadas**, como folhas transparentes:

```
┌─────────────────────────────────────┐
│  5. Canvas temporário do lápis      │  ← enquanto você desenha
│  4. Camada de anotações (SVG/HTML)  │  ← texto, formas, medidas, móveis
│  3. Traços livres já salvos (SVG)   │  ← paths do lápis
│  2. Foto ativa                      │  ← imagem de fundo
│  1. Viewport (pan + zoom)           │  ← “câmera” da tela
└─────────────────────────────────────┘
```

### Mundo vs. tela
- O **mundo** tem o tamanho da foto (ex.: 1920×1080 pixels da imagem).
- A **tela** é o que você vê (pode estar com zoom 50% ou 200%).
- Todo traço e toda anotação são salvos em **coordenadas do mundo**, para não “descolar” da foto quando você der zoom.

### Uma lousa = várias fotos
- Um lead pode ter **várias fotos** na lousa.
- Cada desenho fica **preso à foto** em que foi feito (não mistura anotações da cozinha com as do quarto).
- Só a **foto ativa** mostra seus desenhos.

---

## 7. Inventário completo das ferramentas

### 7.1 Ferramentas da barra (Tool IDs)

| ID | Nome na UI | Como o usuário usa | O que é salvo |
|----|------------|--------------------|---------------|
| `select` | Selecionar | Clica num objeto para mover, redimensionar ou rotacionar | Atualiza o JSON da anotação |
| `pencil` | Desenhar | Arrasta o dedo/mouse → traço livre | Path SVG (`M x y L x y …`) |
| `eraser` | Apagar | Clica num traço ou anotação → remove | Delete do registro |
| `line` | Linha reta | Clique + arraste de A até B | `kind: 'line'` `{a,b}` |
| `rect` | Retângulo | Clique + arraste | `kind: 'rect'` `{x,y,w,h,rotation}` |
| `ellipse` | Elipse | Clique + arraste | `kind: 'ellipse'` `{cx,cy,rx,ry,rotation}` |
| `text` | Texto | Clique coloca caixa editável; digita; redimensiona | `kind: 'text'` |
| `points` | Pontos e linhas | Cliques sucessivos formam uma polilinha; **duplo clique finaliza**; pode “grudar” (snap) em pontos existentes | `kind: 'polyline'` |
| `measure` | Medição reta | 1º clique ponto A, 2º ponto B; aparece label (ex.: `58,5`) com setas | `kind: 'measure'` |
| `measure_arc` | Medição em arco | 3 etapas: A → B → ajustar o arco (`via`) | `kind: 'measure'` com `via` |
| `furniture` | Móveis | Escolhe o tipo no catálogo; 1º clique = **topo**; 2º = **base** (de cima para baixo) | `kind: 'furniture_module'` |

### 7.2 Controles que não são “ferramenta”, mas fazem parte do produto

| Controle | Comportamento |
|----------|---------------|
| **Cor** | Cor do traço / forma / móvel |
| **Espessura** | Grossura do lápis e contornos |
| **Undo / Redo** | Ctrl+Z / Ctrl+Y (pilha local de histórico) |
| **Apagar último desenho** | Remove o traço mais recente |
| **Zoom − / + / ajustar foto** | Aproxima, afasta, encaixa a foto na tela |
| **Pinça (mobile)** | Zoom com dois dedos |
| **Duplo clique no fundo** | “Fit” — ajusta a foto na tela |
| **Inserir foto** | Upload de arquivo |
| **Câmera** | Captura pela webcam/celular |
| **Do projeto** | Puxa imagem já existente nos anexos/projeto do lead |
| **Salvar nos anexos** | Rasteriza foto + desenhos → JPEG nos anexos → limpa a lousa |
| **Remover foto ativa** | Tira a foto (e seus desenhos) |
| **Limpar desenhos** | Apaga anotações da foto ativa (mantém a foto) |
| **Tela cheia** | Abre o mesmo board em Dialog maior |
| **Barra recolhível** | Esconde/mostra a toolbar para ganhar espaço |
| **Ajuda / dicas** | Painel expansível com instruções de uso |
| **Config de texto (admin)** | Fonte, tamanho e cor padrão das caixas de texto |

### 7.3 Comportamentos especiais do `select`

- Move, redimensiona (cantos) e rotaciona anotações.
- Texto: edita conteúdo, redimensiona, rotaciona.
- Medição: pode ajustar pontos A/B e o arco (`via`).
- Móvel: enquanto **não estiver travado** (`locked`), permite apagar traços individuais, trocar tipo, rotacionar, redimensionar; ao clicar **Salvar**, fica fixo na lousa.
- Modo “lousa bloqueada” (`contentLocked`): formas não movem; texto ainda edita/redimensiona.

### 7.4 Catálogo de móveis (famílias)

Colocação padrão: **1º clique no topo, 2º na base** (puxar para baixo). Cada módulo tem proporção típica de largura e profundidade 3D (esboço isométrico).

| Família | Exemplos de variantes |
|---------|------------------------|
| Nicho | simples, colmeia, losango, Goulart, vazio, cruz, hex |
| Armário | vazio, 2 portas, 4 portas, prateleiras, canto |
| Guarda-roupa | padrão, casal, correr, gavetas |
| Cozinha | armário, 2 gavetas, canto |
| Gaveta | 1, 3, 5 gavetas |
| Sapateira | padrão, basculante, prateleiras |
| Aéreo | padrão, 2 portas, prateleira |
| Painel TV | padrão, nichos, rack |
| Mesa cabeceira | padrão, 2 gavetas |
| Bancada | padrão, ilha |
| Cristaleira | padrão, alta |
| Rack | padrão, 2 nichos |

**Total aproximado:** ~39 variantes tipadas no código.

---

## 8. Modelo de dados (o que guardar no banco)

### 8.1 Tabelas

#### `lead_whiteboard_images` (fotos na lousa)

| Campo | Tipo | Significado |
|-------|------|-------------|
| `id` | UUID | Identificador |
| `lead_id` | BIGINT | Lead dono |
| `file_url` | TEXT | URL no Storage |
| `file_name` | TEXT | Nome do arquivo |
| `position_x` / `position_y` | NUMERIC | Posição no mundo (legado; foto ativa ocupa o mundo) |
| `width` / `height` | NUMERIC | Tamanho do mundo da foto |
| `z_index` | INTEGER | Ordem |
| `criado_em` / `atualizado_em` | TIMESTAMPTZ | Auditoria |

#### `lead_whiteboard_drawings` (tudo que é riscado)

| Campo | Tipo | Significado |
|-------|------|-------------|
| `id` | UUID | Identificador |
| `lead_id` | BIGINT | Lead dono |
| `path_data` | TEXT | Traço SVG **ou** anotação JSON (ver encoding abaixo) |
| `cor` | TEXT | Cor (ex.: `#e85d04`) |
| `stroke_width` | NUMERIC | Espessura |
| `criado_em` | TIMESTAMPTZ | Quando foi criado |

#### `lead_whiteboard_text_config` (singleton por empresa)

| Campo | Significado |
|-------|-------------|
| `singleton_key` | Sempre `'default'` |
| `font_family` | Fonte padrão do texto |
| `font_size_px` | Tamanho padrão |
| `text_color_hex` | Cor padrão |
| `atualizado_em` / `atualizado_por` | Auditoria |

### 8.2 Encoding do campo `path_data` (contrato importante)

O mesmo campo guarda **três formatos**:

1. **Traço livre (lápis)**  
   Path SVG puro:  
   `M 10 20 L 12 22 L 15 30 …`

2. **Anotação estruturada**  
   Prefixo `WB_JSON:` + JSON:  
   `WB_JSON:{"kind":"rect","x":10,"y":20,"w":100,"h":50,"rotation":0}`

3. **Vínculo à foto** (sempre por fora)  
   Prefixo `WB_IMG:{imageId}:` + conteúdo interno:  
   `WB_IMG:uuid-da-foto:WB_JSON:{...}`  
   ou  
   `WB_IMG:uuid-da-foto:M 10 20 L …`

**Regra:** ao salvar qualquer desenho novo, **sempre** vincular à foto ativa com `WB_IMG:`.

### 8.3 Payloads JSON das anotações

```ts
// Texto
{ kind: 'text', x, y, w, h, rotation, text, fontSize }

// Retângulo
{ kind: 'rect', x, y, w, h, rotation }

// Elipse
{ kind: 'ellipse', cx, cy, rx, ry, rotation }

// Linha
{ kind: 'line', a: {x,y}, b: {x,y} }

// Polilinha (pontos)
{ kind: 'polyline', points: [{x,y}, ...] }

// Medição (reta ou arco)
{ kind: 'measure', a, b, via?, label, colorHex?, bidirectional?, showZone? }

// Móvel
{
  kind: 'furniture_module',
  moduleType: 'armario_2_portas' | ...,
  a,              // topo
  b,              // base
  topDown?: true,
  widthOverride?, heightOverride?,
  colorHex?,
  hiddenLineIndices?: number[],  // traços apagados pelo usuário
  locked?: boolean               // true = fixo após "Salvar"
}
```

Limites da caixa de texto (mundo): min 80×32 · max 720×480.

### 8.4 Storage de arquivos

- Bucket: `marketing-medias` (no CRM atual)
- Caminho típico: `leads/{leadId}/…`
- Limite de upload de imagem na lousa: **15 MB**

---

## 9. Arquitetura sugerida para reimplantação

### 9.1 Stack atual (referência)

| Camada | Tecnologia usada hoje |
|--------|------------------------|
| Front | React + TypeScript + Vite |
| UI | Shadcn / Radix + Tailwind |
| Desenho | **SVG + Canvas nativos** (sem lib de whiteboard) |
| Dados | Supabase (PostgREST) + React Query |
| Offline | IndexedDB (`crm-offline-whiteboard`) |
| Export | Canvas 2D próprio (não depende de html2canvas para o core) |

### 9.2 Estrutura de pastas recomendada (espelho do CRM)

```
src/
  components/leads/
    LeadWhiteboard.tsx                 # orquestra UI + tools
    whiteboard/
      WhiteboardAnnotationsLayer.tsx   # render + interação das anotações
      MeasureAnnotationGfx.tsx         # desenho visual das medidas
      FurnitureModuleGfx.tsx           # esboço 3D dos móveis
      WhiteboardCameraCapture.tsx
      WhiteboardProjectImagePicker.tsx
  hooks/
    useLeadWhiteboard.ts               # CRUD images/drawings + offline
    useWhiteboardViewport.ts           # pan/zoom/fit
    useWhiteboardHistory.ts            # undo/redo
    useWhiteboardTouchLock.ts          # evita scroll do browser no gesto
    useWhiteboardTextConfig.ts
  lib/
    whiteboard-annotations.ts          # encode/decode WB_JSON / WB_IMG
    furniture-modules.ts               # catálogo + geometria dos móveis
    photo-measure-style.ts             # formato BR de medida, arco, zona
    whiteboard-render-export.ts        # foto + desenhos → JPEG
    lead-whiteboard-save.ts            # salva JPEG nos anexos + limpa
    offline-storage.ts                 # IndexedDB pending
```

### 9.3 Fluxo de persistência

```
Abrir lead
  → carrega images + drawings do banco
  → junta com pendências do IndexedDB (se houver)
  → usuário escolhe foto ativa
  → filtra desenhos com WB_IMG:imageId

Usuário desenha / anota
  → INSERT/UPDATE em drawings (otimista na UI)
  → empilha no histórico local (undo/redo)
  → se offline → grava no IndexedDB

Volta a internet
  → sync das pendências → limpa IndexedDB

"Salvar nos anexos"
  → renderiza foto + strokes + anotações em Canvas
  → sobe JPEG como anexo do lead
  → limpa desenhos (e opcionalmente a foto) da lousa
```

### 9.4 O que NÃO precisa no MVP de outro sistema

- Realtime / presence  
- Templates de board  
- Edge Function dedicada à lousa (hoje a persistência é direta no client autenticado)  
- Copiar lousa ao duplicar lead (hoje **não** copia)

---

## 10. Requisitos funcionais (RF)

| ID | Requisito | Prioridade |
|----|-----------|------------|
| RF-01 | Inserir foto por upload | Must |
| RF-02 | Inserir foto por câmera | Should |
| RF-03 | Importar foto já existente do lead/projeto | Should |
| RF-04 | Múltiplas fotos por lead + seleção da ativa | Must |
| RF-05 | Lápis (freehand) com cor e espessura | Must |
| RF-06 | Borracha (apagar traço/anotação) | Must |
| RF-07 | Linha, retângulo, elipse | Must |
| RF-08 | Caixa de texto editável (fonte/cor configuráveis) | Must |
| RF-09 | Polilinha por cliques + snap + finalizar com duplo clique | Should |
| RF-10 | Medição reta com label editável estilo BR | Must |
| RF-11 | Medição em arco (3 etapas) | Should |
| RF-12 | Catálogo de móveis com colocação topo→base | Must (se for marcenaria) |
| RF-13 | Editar móvel (apagar traços, rotacionar) e travar com Salvar | Should |
| RF-14 | Selecionar / mover / redimensionar / rotacionar | Must |
| RF-15 | Undo / Redo | Must |
| RF-16 | Zoom, pan, fit (desktop + pinça mobile) | Must |
| RF-17 | Persistência por lead + vínculo desenho↔foto | Must |
| RF-18 | Modo offline com sync posterior | Should |
| RF-19 | Exportar JPEG para anexos e limpar lousa | Must |
| RF-20 | Visualização somente leitura (prestador) | Should |
| RF-21 | Isolamento multi-empresa | Must |
| RF-22 | Config admin de tipografia do texto | Could |
| RF-23 | Tela cheia | Should |

---

## 11. Requisitos não funcionais (RNF)

| ID | Requisito |
|----|-----------|
| RNF-01 | Coordenadas sempre no “mundo” da foto (independente do zoom) |
| RNF-02 | Upload de imagem ≤ 15 MB (ou limite definido pelo novo sistema) |
| RNF-03 | RLS / auth: só usuários autenticados da empresa acessam |
| RNF-04 | Mobile-first: toolbar usável com o polegar; gestos não brigam com scroll da página |
| RNF-05 | Optimistic UI: o traço aparece na hora, sync depois |
| RNF-06 | TypeScript strict; validar payloads JSON ao decodificar |
| RNF-07 | Não instalar lib pesada de whiteboard se Canvas/SVG nativos forem suficientes |

---

## 12. Integrações com outros módulos (no CRM atual)

| Módulo | Como usa a lousa |
|--------|------------------|
| **Anexos do lead** | Destino do JPEG exportado |
| **Orçamento / slides** | Mídias com origem `whiteboard` |
| **IA (analyze-lead-photos / lead-knowledge)** | Indexa/analisa fotos da lousa com `source: 'whiteboard'` |
| **Portal do prestador** | Aba Lousa read-only se `pode_ver_lousa` |
| **Pipeline Settings** | Aba Lousa → tipografia |

---

## 13. Critérios de aceite (checklist para o outro sistema)

- [ ] Consigo subir uma foto e desenhar com o lápis sem a anotação “descolar” ao dar zoom  
- [ ] Troco de foto e vejo só os desenhos daquela foto  
- [ ] Crio texto, retângulo, elipse, linha e polilinha  
- [ ] Meço A→B e o label aparece no formato brasileiro (vírgula decimal)  
- [ ] Coloco um armário com 2 cliques (topo→base) e travo com Salvar  
- [ ] Undo/Redo funciona para traços e anotações  
- [ ] Offline: desenho sem internet e, ao voltar, persiste  
- [ ] “Salvar nos anexos” gera JPEG com foto + risco e limpa a lousa  
- [ ] Usuário só-leitura não consegue editar  
- [ ] Dados de uma empresa não vazam para outra  

---

## 14. Plano de implantação sugerido (fases)

### Fase 1 — Núcleo
Fotos + lápis + borracha + zoom/pan + persistência `path_data` + vínculo `WB_IMG`

### Fase 2 — Anotações
Linha, retângulo, elipse, texto, select (mover/resize), undo/redo, export JPEG

### Fase 3 — Especialistas de projeto
Medição reta/arco + catálogo de móveis + polilinha com snap

### Fase 4 — Campo e permissões
Offline, câmera, import do projeto, read-only, config tipografia, multi-empresa

---

## 15. Riscos e decisões

| Decisão | Recomendação |
|---------|--------------|
| Usar Excalidraw/tldraw? | **Não obrigatório.** O produto atual prova que SVG+Canvas bastam e dão controle fino (medida + móvel). |
| Canvas infinito vs. foto-base? | Manter **foto como mundo**. É o diferencial da lousa de projeto. |
| Colaboração realtime? | Deixar para depois; last-write-wins já cobre o fluxo de 1 vendedor no lead. |
| Onde guardar JSON? | Continuar num campo texto com prefixos (`WB_JSON` / `WB_IMG`) **ou** normalizar em colunas/`jsonb` no novo sistema (mais limpo a longo prazo). |
| Móveis | Se o novo sistema **não** for marcenaria, a Fase 3 de móveis pode ser cortada sem quebrar o núcleo. |

---

## Apêndice A — Lousa de Marketing (produto separado)

**Rota:** `/marketing-conteudo`  
**Stack:** `@xyflow/react` (React Flow) + overlay de freehand  
**Objetivo:** planejamento visual de conteúdo (cards, formas, PDF, imagens, conexões), **não** anotar foto de obra.

| Tool | Função |
|------|--------|
| select | Mover nós |
| rectangle / circle / diamond | Formas |
| text | Caixa de texto |
| pencil / eraser | Freehand SVG |
| Upload imagem/PDF | Nodes de mídia |
| Salvar template | Snapshot JSON |
| Fullscreen / limpar desenhos | Utilitários |

Tabelas tipicamente prefixadas `crm_multiempresas_marketing_planning_*` + `marketing_board_templates`.  
**Não** compartilha o mesmo motor da Lousa do Lead.

Se o objetivo do outro sistema for “riscar em cima da foto do cliente”, **ignore este apêndice** e implemente só o corpo principal deste PRD.

---

## Apêndice B — Arquivos-fonte no CRM Selletos (mapa rápido)

| Arquivo | Papel |
|---------|-------|
| `src/components/leads/LeadWhiteboard.tsx` | UI principal + tools |
| `src/components/leads/whiteboard/*` | Camadas, medida, móvel, câmera, picker |
| `src/hooks/useLeadWhiteboard.ts` | CRUD + offline |
| `src/hooks/useWhiteboardViewport.ts` | Pan/zoom |
| `src/hooks/useWhiteboardHistory.ts` | Undo/redo |
| `src/lib/whiteboard-annotations.ts` | Contrato WB_JSON / WB_IMG |
| `src/lib/furniture-modules.ts` | Catálogo de móveis |
| `src/lib/whiteboard-render-export.ts` | Export Canvas → JPEG |
| `src/lib/lead-whiteboard-save.ts` | Salvar nos anexos |
| `src/components/pipeline/WhiteboardTextSettingsCard.tsx` | Config admin |
| `supabase/migrations_archive/20260524120000_lead_whiteboard.sql` | Schema base |

---

## Apêndice C — Glossário para não técnicos

| Termo | Significado simples |
|-------|---------------------|
| **Lousa** | Folha transparente em cima da foto, onde você risca |
| **Foto ativa** | A foto que está na tela agora |
| **Traço / path** | O risco feito com o lápis |
| **Anotação** | Objeto estruturado (texto, retângulo, medida, móvel…) |
| **Mundo** | Sistema de coordenadas do tamanho da foto |
| **Viewport** | A “janela” com zoom e pan por cima do mundo |
| **Exportar** | Transformar foto+risco numa imagem JPEG única |
| **Offline** | Continuar desenhando sem internet; sincroniza depois |
| **RLS** | Trava de segurança do banco: cada usuário só vê o que pode |

---

**Documento gerado para reimplantação.**  
Priorize a **Lousa do Lead** (Fases 1–4). Trate a de Marketing como outro projeto, se necessário.
`)