# PRD — Configurações do Pop-up da Agenda Geral

**Produto:** GARBO Movelaria / CRM Selletos  
**Módulo:** Agenda Geral (painel flutuante lateral)  
**Versão do documento:** 1.0  
**Data:** 30/09/2026  
**Status:** Retrato das configurações em produção (código local)  
**Autor do documento:** Auto (agente Cursor)

**Onde vive na tela:** painel fixo à direita (ou esquerda), aberto pelo ícone de calendário.  
**Componentes que você marcou no inspetor:**

| Elemento na tela | React |
|------------------|-------|
| Conteúdo interno do painel | `AgendaGeralContent` |
| Caixa “14:00 · 10 tarefas” / “16:00 · 13 tarefas” | `AgendaHourClusterBox` |
| Balão de prévia + Adiar | `AgendaEventHoverPreview` (+ `AgendaEventPostponeControls`) |
| Cascata do painel | `FloatingAgendaGeralPopup` → `FullCalendar` |

**Documentos relacionados:**

| Documento | O que cobre |
|-----------|-------------|
| [prd-agenda-layout-titularidade-caixas.md](prd-agenda-layout-titularidade-caixas.md) | Titularidade + por que existem as caixas |
| [agenda-proximo.md](agenda-proximo.md) | Cards, cores, balão, adiar (visão narrativa) |
| [prd-agenda-comercial-sistema.md](prd-agenda-comercial-sistema.md) | Sistema completo da Agenda Comercial |

---

## 1. Resumo (em uma frase)

Este PRD documenta **três configurações** do pop-up lateral da Agenda: **tamanho do painel e dos cards**, **agrupamento de tarefas no mesmo horário** e **prévia + adiamento** no balão de vidro.

Em linguagem simples: o pop-up é uma “gaveta” estreita na lateral. Quando muitas tarefas caem na mesma hora, elas viram uma **caixinha de papel** com busca. Ao passar o mouse (ou tocar) num card, abre um **balão** com detalhes e setas para **adiar** o compromisso — sem misturar isso com “mudar o dia que estou olhando” no calendário.

---

## 2. Escopo

### 2.1 Dentro do escopo

1. **Tamanho e layout do painel flutuante** (largura, zoom, altura da grade, tipografia compacta).  
2. **Sistema de agrupamento** (`AgendaHourClusterBox`): quando vira caixa, altura, busca, popup central.  
3. **Prévia e adiamento** (`AgendaEventHoverPreview` + setas de dia/hora): delays, medidas do balão, regras de gravação.

### 2.2 Fora do escopo

- Criação de tarefas / formulários públicos.  
- Notificações push / WhatsApp.  
- Regras RLS do banco (só o que a UI já grava).  
- Agenda de Obras (módulo separado).

---

## 3. Mapa visual (o que é o quê)

```
Ícone calendário (canto)
└── FloatingAgendaGeralPopup  ← painel lateral (z-[240])
    ├── barra: arrastar lado · zoom · minimizar · fechar
    └── AgendaGeralContent (compact)
        ├── busca geral + histórico concluídos
        └── FullCalendar (vista Dia / Sem / Mês)
            ├── chip solto (poucos no horário)
            ├── AgendaHourClusterBox  ← “14:00 · 10 tarefas”
            │     ├── busca “Buscar nesta hora…”
            │     ├── lista rolável de chips
            │     └── ampliar → Dialog no centro
            └── chip → AgendaEventHoverPreview (z-[205])
                  ├── título + meta + descrição
                  ├── Adiar tarefa (dia + 15 min)
                  └── Concluir / Excluir
```

---

## 4. Configuração A — Tamanho do painel e dos cards

### 4.1 Painel lateral (`FloatingAgendaGeralPopup`)

| Configuração | Valor | Onde |
|--------------|-------|------|
| Posição | `fixed top-0 bottom-0` (altura total da janela) | `FloatingAgendaGeralPopup` |
| Lado | direita ou esquerda (preferência do usuário) | `FloatingAgendaSide` |
| z-index do painel | **240** | `overlay-z-index.ts` → `floatingAgendaPanelClass` |
| Fundo | `bg-background/95 backdrop-blur-md` + borda + sombra | popup |
| Canto arredondado | `rounded-l-xl` (direita) / `rounded-r-xl` (esquerda) | popup |
| Entrada | zoom + slide + fade (~300 ms; largura anima 200 ms) | popup |
| Conteúdo | `AgendaGeralContent` com `compact` + `px-2 pb-2 pt-1.5` | DOM que você marcou |
| Largura base (mobile &lt; 640px) | **320 px** × zoom | `FLOATING_AGENDA_BASE_WIDTH_PX` |
| Largura base (desktop ≥ 640px) | **340 px** × zoom | `FLOATING_AGENDA_BASE_WIDTH_SM_PX` |
| Largura máxima | 92% da tela (desktop) ou `100vw − 1rem` (mobile) | `floatingAgendaPanelWidthPx` |
| Exemplo medido (sua tela) | ~**405 px** de largura × ~**973 px** de altura útil do conteúdo | bate com zoom &gt; 100% |

**Zoom do painel** (independente do Kanban):

| Item | Valor |
|------|-------|
| Padrão | 100% |
| Mínimo | **80%** |
| Máximo | **200%** |
| Passo | **10%** |
| Efeito | Aumenta a **largura do painel** e escala a **grade** (hora em px) — **não** usa CSS `zoom` (evita cortar cards) |

Arquivos: `floating-agenda-zoom-preferences.ts`, `FloatingAgendaZoomControls`, `useFloatingAgendaZoom`.

### 4.2 Grade do calendário no modo compacto

Valores base antes do zoom (`getCalendarLayout(compact: true)`):

| Medida | Compacto (painel) | Página cheia |
|--------|-------------------|--------------|
| Altura de 1 hora (vista Dia) | **40 px** | 96 px |
| Altura de 1 hora (vista Semana) | **32 px** | 80 px |
| Altura mínima do evento (Dia) | **24 px** | 40 px |
| Altura mínima do evento (Semana) | **16 px** | 22 px |
| Coluna de horário (Dia) | 36 px | 100 px |
| Faixa “Sem horário” (máx.) | 64 px | 120 px |
| Altura fixa da vista | `null` (preenche o painel) | 700 px |

Com zoom, todos esses números são multiplicados pela escala (ex.: 120% → hora do dia ≈ 48 px).

### 4.3 Chip (card) solto na grade

| Item | Compacto |
|------|----------|
| Tipografia | `text-[10px]`, padding `px-1.5 py-0.5` |
| Visual | borda, sombra leve, hover `brightness-95` |
| Concluído | `opacity-60` + riscado |
| Texto típico | `HH:mm · [título]` |
| Arraste | ativo após mover ≥ 5 px; balão desliga durante o arraste |

### 4.4 Tipografia / chrome da caixa de horário (compacto)

| Elemento | Classes / medidas |
|----------|-------------------|
| Título da caixa | `text-[8px]` uppercase, tracking largo, cor tinta `#6b5344` |
| Exemplo | `14:00 · 10 TAREFAS` / `16:00 · 13 TAREFAS` |
| Campo busca mini | altura **24 px** (`h-6`), `text-[10px]`, placeholder “Buscar nesta hora…” |
| Botão ampliar | ícone ~12×12 (`h-5 w-5` no compacto) |
| Fundo da caixa | creme `#fffcf8` / cabeçalho `#f7f0e6` / tinta `#2a1812` |

### 4.5 Espaçamento do conteúdo (`AgendaGeralContent` compacto)

- Container: `gap-1.5`, `flex-1 min-h-0`, padding do popup `px-2 pb-2 pt-1.5`.  
- Card interno: `border-0 shadow-none` (sem “card” extra no painel).  
- FAB “Criar” no canto inferior direito da grade (`z-50` local).

### 4.6 Critérios de aceite — tamanho

- [ ] Zoom 80–200% altera largura do painel e altura das horas sem cortar chips.  
- [ ] Em viewport estreito, painel não passa de `100vw − 1rem`.  
- [ ] Vista Dia no painel usa ~40 px/hora (× zoom), não os 96 px da página.  
- [ ] Título da caixa lotada permanece legível em `text-[8px]` sem quebrar o layout.

---

## 5. Configuração B — Sistema de agrupamento de tarefas

### 5.1 Problema que resolve

Quando 10 ou 13 tarefas caem no mesmo horário (ex.: 14:00 e 16:00), colocar tudo lado a lado no painel estreito **esconde** itens. A solução é a **caixa de horário** (`AgendaHourClusterBox`).

### 5.2 Como o sistema decide o grupo (cluster)

1. Eventos com **sobreposição de tempo** formam um cluster (`getOverlapClusters` em `calendar-event-layout.ts`).  
2. Ordenação: por horário de início.  
3. Intervalo do cluster = do início mais cedo ao fim mais tarde do grupo.

### 5.3 Quando vira caixa empilhada vs colunas

| Contexto | Regra |
|----------|-------|
| **Painel flutuante** (`compact`) | Se o cluster tem **mais de 3** itens → `useStack = true` (caixa vertical com **todas** as tarefas). Limite de colunas lado a lado = **2** (enquanto ≤ 3 itens). |
| **Página cheia** | Não empilha por limiar (`stackThreshold` infinito). Até **5** colunas lado a lado; o que sobra vira botão **“+N mais”**. |

Constantes:

| Constante | Valor | Significado |
|-----------|-------|-------------|
| `EVENT_COMPACT_STACK_THRESHOLD` | **3** | Acima disso no painel → caixa |
| `EVENT_MAX_SIDE_BY_SIDE_COLUMNS` | **5** | Página: colunas antes do “+N” |
| `EVENT_STACK_CHIP_HEIGHT_PX` | **22** | Altura de cada linha na lista |
| `EVENT_STACK_MAX_HEIGHT_PX` | **220** | Máximo da área de lista (sem chrome) |

No painel, a altura do chip na lista ainda escala um pouco com o zoom: `22 × min(zoomScale, 1.15)`.

### 5.4 Anatomia da caixa na grade (`variant: 'box'`)

| Parte | Comportamento |
|-------|---------------|
| Cabeçalho sticky | `HH:mm · N tarefa(s)` + botão Maximize |
| Busca mini | Filtra **só** aquele horário (`matchesAgendaGeralSearch`) |
| Lista | Chips densos (`dense`); scroll interno |
| Altura total | `chrome + linhas`, limitada por `EVENT_STACK_MAX_HEIGHT_PX + chrome` **e** pelo intervalo de tempo do cluster (`getClusterTimeSpanPx`) — **não pode tapar outras horas** |
| Chrome (cabeçalho + busca) | compacto **54 px** / página **62 px** |
| Posição | `absolute z-[8]`, largura quase cheia da coluna (com gutter direito para clique em horário vazio) |

Visual: bloco de papel (creme), borda `rgba(42,24,18,0.14)`, sombra, ring suave.

### 5.5 Popup central (ampliar / “+N mais”)

| Item | Valor |
|------|-------|
| Abertura | Botão ampliar **ou** chip “+N mais” |
| Estado | Controlado no `FullCalendar` (`expandedClusterKey`) — não fecha sozinho em re-render |
| Truque de clique | `setTimeout(0)` ao abrir (evita o mesmo clique fechar o dialog) |
| Tamanho | `h-[min(90dvh,720px)]`, `w-[min(96vw,480px)]` |
| Visual | mesmo tema papel; título serifado com o horário |
| Busca | Maior, autofocus; contador “X de N” |
| Lista | Scroll nativo (`overflow-y-auto`); animação leve de entrada |
| Ações em lote | Selecionar várias / marcar todas / concluir (só itens adiáveis = não concluídos/cancelados) |
| z-index dialog na camada flutuante | **260** (`floatingAgendaDialogClass`) |

Variante `overflow-chip`: botão tracejado `+N mais` na página; abre o **mesmo** dialog.

### 5.6 Titularidade (contexto do agrupamento)

No painel (`compact`), `useAgendaGeral({ forceOwnTitular: true })`: a pessoa **só vê as próprias** tarefas. O agrupamento acontece **depois** desse filtro — a caixa “13 tarefas” são as 13 **dela** naquele horário, não da equipe inteira.

### 5.7 Critérios de aceite — agrupamento

- [ ] 4+ tarefas sobrepostas no painel viram caixa `HH:mm · N tarefas`.  
- [ ] Busca na caixa reduz a lista; limpar restaura todas do horário.  
- [ ] Altura da caixa não cobre o horário seguinte além do intervalo do cluster.  
- [ ] Ampliar abre dialog central com todas as tarefas do grupo.  
- [ ] “+N mais” na página abre o mesmo tipo de dialog.  
- [ ] Nenhuma tarefa do cluster fica inacessível “atrás” de outra.

---

## 6. Configuração C — Prévia de tarefas e adiamento

### 6.1 O balão de prévia (`AgendaEventHoverPreview`)

É um **HoverCard** (Radix). No painel ele “nasce” **dentro** do painel (`data-floating-agenda-root`), para não sumir atrás de outras camadas nem sair da gaveta.

#### 6.1.1 Medidas e timing (compacto = painel)

| Item | Painel (`compact`) | Página |
|------|--------------------|--------|
| Delay abrir | **180 ms** | 280 ms |
| Delay fechar | **320 ms** | 400 ms |
| Lado preferido | **cima** (`side="top"`) | esquerda |
| Offset | 4 px | 8 px |
| Largura | **máx. 11,5 rem** (~184 px — bate com o que você mediu) | máx. 16 rem |
| Altura máx. | **20 rem** (~320 px — bate com a medida) | 22 rem |
| z-index | **205** | 50 |
| Visual | vidro: `bg-background/30`, blur, saturate | popover clássico |
| Collision | `collisionBoundary` = raiz do painel; padding 8 | padding 16 |

#### 6.1.2 Conteúdo do balão

1. Bolinha da cor do tipo.  
2. **Título** (clicável → abre edição; riscado se concluído).  
3. Meta: `HH:mm · subtítulo · tipo` (ex.: `09:47 · Agda e Renato · Lembrete`).  
4. Bloco **Adiar tarefa** (se permitido).  
5. Descrição / texto do compromisso (se houver).  
6. Dica: “Toque no título para editar”.  
7. Rodapé: **Concluir** / **Excluir** (quando as ações existem).

#### 6.1.3 Fixar (pin) no toque

- Primeiro toque/clique no chip **prende** o balão (`pinned`).  
- Clique fora do balão e do chip solta e fecha.  
- Enquanto arrasta na grade, prévia fica `disabled`.  
- Em modo seleção em lote, hover também desliga.

### 6.2 Adiar tarefa (`AgendaEventPostponeControls`)

**Importante:** as setas do balão **não** mudam o dia que o calendário está mostrando. Elas preparam um **novo horário só daquele card**. Só grava no botão **Adiar**.

| Controle | Comportamento |
|----------|---------------|
| Stepper de **dia** | −1 / +1 dia; label compacto `dd/MM` |
| Stepper de **hora** | passo fixo **15 minutos** (`TIME_STEP_MINUTES`) |
| Botão Adiar | Ativo só se o rascunho ≠ horário atual; ao salvar: “Adiando…” |
| Duração | Mantida (`buildPostponedAgendaRange`). Lembrete: fim fictício 1 h só para desenhar |
| Recorrente pessoal | Setas de **dia desligadas**; só horário no mesmo dia |
| Concluído / cancelado | **Não** mostra Adiar (`isAgendaEventPostponable`) |

Botões do stepper (compacto): **24×24** (`h-6 w-6`), texto `10px`, botão Adiar `h-6`.

Atributo `data-agenda-postpone` evita que clique nas setas seja tratado como “abrir edição”.

### 6.3 O que grava no banco (mesmo caminho do arraste)

Confirmar Adiar chama o mesmo `onEventDrop` / `handleEventDrop` do arraste na grade:

| Tipo | Campo(s) atualizados |
|------|----------------------|
| Reunião (`tarefa`) | `data_hora_inicio` + fim (+ duração) |
| Lembrete | `data_hora` |
| Pessoal (única) | `data` + `hora` |
| Pessoal (recorrente) | só `hora` no mesmo dia; outro dia → erro / toast |
| Marketing | `data_agendada` + `hora_agendada` |

Se o **dia** mudou: o calendário **acompanha** o card (`setSelectedDate` / focus) e toast do tipo “Tarefa adiada para …”.  
Se só o horário mudou: toast “Horário atualizado para …”.

### 6.4 Arrastar na grade (outro jeito de adiar)

- Snap de **15 minutos**.  
- Na semana, soltar em outra coluna = mudar o dia.  
- Balão não abre durante o arraste.

### 6.5 Não confundir com navegação do calendário

| Ação | Efeito |
|------|--------|
| Setas / abas Dia·Sem·Mês / Hoje | Só **olha** outro período; cards ficam onde estavam |
| Setas no balão + Adiar | **Move** aquele compromisso |
| Arrastar chip | Também move o compromisso |

### 6.6 Critérios de aceite — prévia e adiar

- [ ] No painel, balão abre dentro da gaveta (~11,5 rem × até 20 rem).  
- [ ] Meta mostra horário · lead/titular · tipo.  
- [ ] Setas de 15 min e de dia só alteram rascunho até clicar Adiar.  
- [ ] Recorrente pessoal: dia bloqueado no stepper.  
- [ ] Concluído: sem Adiar; Concluir desabilitado se já concluído.  
- [ ] Após adiar para outro dia, a vista Dia segue o card.  
- [ ] Toque no título edita; setas não abrem o editor.

---

## 7. Camadas (z-index) — ordem na tela

| Camada | z-index | Peça |
|--------|---------|------|
| Painel agenda | **240** | `FloatingAgendaGeralPopup` |
| Ícone flutuante | **250** | ícone calendário |
| Dialogs da agenda | **260** | popup central da caixa, diálogos `floatingLayer` |
| Aninhados | **270** | overlays dentro de dialogs |
| Balão de prévia (no painel) | **205** | acima do conteúdo interno; portal **dentro** do painel |

---

## 8. Quatro tipos de card (cores) — referência rápida

| Cor | `type` | Rótulo no balão | Origem típica |
|-----|--------|-----------------|---------------|
| Azul | `tarefa` | Reunião | Agenda de reuniões |
| Âmbar | `lembrete` | Lembrete | Lead (ex.: `[Lead: Agda e Renato]`) |
| Verde | `pessoal` | Pessoal | Agenda pessoal |
| Roxo | `conteudo` | Marketing | Tarefas de conteúdo |

---

## 9. Arquivos de referência

| Peça | Arquivo |
|------|---------|
| Painel lateral | `src/components/layout/FloatingAgendaGeralPopup.tsx` |
| Conteúdo | `src/components/agenda/AgendaGeralContent.tsx` |
| Grade + clusters | `src/components/agenda/FullCalendar.tsx` |
| Caixa de horário | `src/components/agenda/AgendaHourClusterBox.tsx` |
| Layout / limiares | `src/lib/calendar-event-layout.ts` |
| Zoom / largura | `src/lib/floating-agenda-zoom-preferences.ts` |
| Prévia | `src/components/agenda/AgendaEventHoverPreview.tsx` |
| Setas Adiar | `src/components/agenda/AgendaEventPostponeControls.tsx` |
| Regras de adiar | `src/lib/agenda-postpone.ts` |
| Persistência | `src/hooks/useAgendaGeral.ts` (`handleEventDrop`) |
| z-index | `src/lib/overlay-z-index.ts` |

---

## 10. Glossário

| Termo | Significado simples |
|-------|---------------------|
| Pop-up / painel flutuante | Gaveta lateral da Agenda Geral |
| Compacto | Modo “estreito” do painel (números menores) |
| Cluster | Grupo de tarefas que se esbarram no tempo |
| Caixa de horário | Lista “14:00 · 10 tarefas” com busca |
| Popup central | Janela grande no meio da tela (ampliar) |
| Balão / HoverCard | Prévia ao passar o mouse ou tocar o chip |
| Rascunho de adiar | Novo dia/hora escolhido nas setas, ainda não salvo |
| Adiar | Confirmar e gravar o novo horário no banco |

---

## 11. Histórico

| Data | Versão | O que entrou |
|------|--------|--------------|
| 30/09/2026 | 1.0 | PRD unificado: tamanho do painel/cards, agrupamento por horário, prévia e adiamento — com valores medidos no inspetor e constantes do código |
