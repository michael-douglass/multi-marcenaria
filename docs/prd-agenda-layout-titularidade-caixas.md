# PRD — Layout da Agenda Geral (titularidade, caixas lotadas e popup)

**Produto:** GARBO Movelaria / CRM Selletos  
**Módulo:** Agenda Geral (painel flutuante + página Agenda Comercial)  
**Versão do documento:** 1.0  
**Data:** 28/09/2026  
**Status:** Implementado (código local)  
**Onde vive:**
- Painel flutuante (ícone de calendário no canto)
- Página `/agenda-comercial` (aba Agenda Geral)
- Arquivos principais: `useAgendaGeral.ts`, `useAgendaPessoal.ts`, `FullCalendar.tsx`, `AgendaHourClusterBox.tsx`, `calendar-event-layout.ts`

**Relacionado:** [agenda-proximo.md](agenda-proximo.md) (cards, adiar, hover)

---

## 1. Resumo (em uma frase)

Cada pessoa vê **só as próprias tarefas** no painel flutuante; quando muitos compromissos caem no **mesmo horário**, eles viram uma **caixa com busca** que pode abrir **no meio da tela**, em vez de sumirem atrás uns dos outros.

---

## 2. Problema que resolve

### 2.1 Titularidade confusa

Antes, o administrador podia abrir o painel flutuante e ver tarefas de **outras pessoas** (se o filtro da Agenda Comercial estivesse em “Todos” ou em outro prestador). Isso misturava a “gaveta pessoal” do canto com a visão de gestão.

**Dor:** “Abri a agenda do canto e apareceu o que não é meu.”

### 2.2 Horários lotados escondiam tarefas

Quando 20, 40 ou 50 tarefas caíam no mesmo horário (ex.: 10:00), o calendário só mostrava cerca de **5 faixas lado a lado**. O resto ficava **empilhado por cima** — inacessível sem saber que existia.

**Dor:** “Sei que tenho 75 eventos hoje, mas no popup só vejo 3 lembretes de lead.”

### 2.3 Caixa compacta sem busca nem espaço

A lista empilhada no painel estreito era difícil de vasculhar. Faltava **buscar por nome** e **abrir grande** no centro da tela.

---

## 3. Objetivos

| Objetivo | Como medir |
|----------|------------|
| Painel flutuante = só o que é meu | Contador e grade filtram por titular do usuário logado |
| Admin continua podendo ver outros **só na página** | Filtro “Titularidade” na Agenda Comercial |
| Nenhuma tarefa some no horário lotado | Caixa “HH:mm · N tarefas” com lista completa (rolável) |
| Achar rápido no meio de dezenas | Campo de busca na caixa e no popup central |
| Ler com conforto | Botão ampliar abre popup no centro com lista maior |

---

## 4. Fora de escopo

- Não muda regras de **criação** de tarefas, lembretes ou reuniões.
- Não altera permissões RLS do banco (só o que a UI pede e filtra).
- Não unifica Agenda Pessoal / Lembretes / Reuniões em abas diferentes do painel (continua sendo a **Agenda Geral** misturada).
- Não redefine cores dos tipos (lead / pessoal / marketing / reunião) — só o **layout** quando há muitos no mesmo horário.
- Não trata notificações push / WhatsApp deste escopo.

---

## 5. Quem usa

| Perfil | Painel flutuante | Página Agenda Comercial |
|--------|------------------|-------------------------|
| Vendedor / titular comum | Só as próprias | Só as próprias (dados já limitados) |
| Admin / quem vê todos os titulares | Só as próprias (sempre) | Pode escolher: Somente os meus / Todos / Um prestador |
| Super admin | Igual admin | Igual admin |

---

## 6. Regras de negócio

### 6.1 Titularidade nativa

1. **Painel flutuante** (`compact` / `forceOwnTitular: true`)  
   - Sempre filtra eventos onde o usuário logado é titular (ou está em `titular_ids`).  
   - Ignora a preferência salva do admin na Agenda Comercial (mesmo se lá estiver “Todos”).

2. **Página Agenda Comercial**  
   - Admin pode salvar filtro: `self` | `all` | `provider`.  
   - **Padrão nativo** (sem preferência salva): `self` (somente os meus) — antes o padrão implícito era “todos”.  
   - Texto de ajuda deixa claro: o painel flutuante **não** segue o filtro da página.

3. **Contador do ícone** (badge vermelho)  
   - Conta só pendências **do próprio titular** no dia de hoje.

### 6.2 O que entra na Agenda Geral (tipos)

Continua misturando:

| Tipo no card | Origem | Prefixo típico |
|--------------|--------|----------------|
| `lembrete` | Lembrete de lead | `[Lead: Nome]` |
| `pessoal` | Agenda pessoal / evento | `[Pessoal]` / `[Evento]` |
| `tarefa` | Reunião (Agenda de Tarefas) | título da reunião |
| `conteudo` | Marketing | `[Marketing: …]` |

Filtro de titularidade aplica-se a cada tipo conforme o campo de responsável (`titular_id` / `titular_ids` / `criado_por` em marketing).

### 6.3 Quando vira “caixa de horário”

- Eventos no **mesmo intervalo** (se sobrepõem no tempo) formam um **cluster**.  
- No **painel flutuante** (layout compacto): se o cluster tiver **mais de 3** itens → modo **lista empilhada** (caixa).  
- Na **página cheia**: até **5** colunas lado a lado; o que extrapola vira botão **“+N mais”** (não some atrás).

### 6.4 Busca dentro da caixa / popup

- Busca filtra **só as tarefas daquele horário** (não a agenda inteira).  
- Usa o mesmo critério de texto da busca geral da Agenda Geral (título, lead, detalhes, tipo, horário).  
- Termo vazio = mostra todas do cluster.  
- Contador: “Mostrando todas as N” ou “X de N tarefas”.

### 6.5 Popup central

- Aberto pelo ícone **ampliar** na caixa **ou** pelo **“+N mais”**.  
- Fica no **centro da tela**, acima do painel flutuante (z-index de dialog da agenda).  
- Clique numa linha abre a edição da tarefa (mesmo fluxo de clique no calendário).  
- Fechar (X ou fora) volta à caixa compacta; a busca do popup pode ser reiniciada.

---

## 7. Experiência do usuário (fluxo)

### 7.1 Dia a dia do titular

1. Clica no ícone de calendário.  
2. Vê só o que é dele.  
3. Em horário lotado, aparece caixa `10:00 · 52 tarefas`.  
4. Digita “Virna” na busca da caixa **ou** amplia e busca no popup.  
5. Clica no card e edita / conclui.

### 7.2 Admin revisando a equipe

1. Abre **Agenda Comercial** (página).  
2. Em **Titularidade**, escolhe “Todos” ou um prestador.  
3. A página mostra a visão escolhida.  
4. O painel do canto **continua só com as tarefas dele**.

---

## 8. Layout e design (decisões)

**Direção visual:** bloco de papel da agenda (creme `#fffcf8`, tinta `#2a1812`), alinhado ao painel já existente — não um card genérico roxo.

| Elemento | Comportamento |
|----------|----------------|
| Cabeçalho da caixa | `HH:mm · N tarefas` + botão ampliar |
| Busca mini | Campo estreito “Buscar nesta hora…” |
| Lista | Chips coloridos por tipo; rolagem interna se passar da altura máxima |
| Popup | Título serifado com o horário; busca maior; lista com animação leve de entrada |
| “+N mais” | Contorno tracejado dourado/papel; abre o **mesmo** popup |

**Altura da caixa compacta:** limitada (~220px de lista + cabeçalho/busca) para não cobrir o dia inteiro; o resto se resolve no popup.

---

## 9. Arquitetura técnica (mapa simples)

```
FloatingAgendaGeralShell
  forceOwnTitular → contador
FloatingAgendaGeralPopup
  └── AgendaGeralContent (compact)
        └── useAgendaGeral({ forceOwnTitular: true })
              ├── useAgendaPessoal({ forceOwnTitular })
              └── titularFilteredEvents
        └── FullCalendar (compact)
              └── layoutTimedClusters(...)
                    ├── colunas (poucos itens)
                    ├── AgendaHourClusterBox (muitos itens)
                    └── “+N mais” → mesmo box em modo overflow-chip
```

**Estado do popup ampliado:** controlado no `FullCalendar` (`expandedClusterKey`), para não fechar sozinho quando a grade re-renderiza.

---

## 10. Arquivos tocados (referência)

| Arquivo | Papel |
|---------|--------|
| `src/hooks/useAgendaGeral.ts` | `forceOwnTitular`; padrão admin `self`; filtro de eventos |
| `src/hooks/useAgendaPessoal.ts` | Query só do próprio titular no painel |
| `src/components/agenda/AgendaGeralContent.tsx` | Passa `forceOwnTitular: compact` |
| `src/components/layout/FloatingAgendaGeralShell.tsx` | Contador com `forceOwnTitular` |
| `src/components/agenda/AgendaGeralTitularFilter.tsx` | Texto: filtro vale só na página |
| `src/components/agenda/AgendaPessoalTab.tsx` | Texto equivalente na Agenda Pessoal |
| `src/lib/calendar-event-layout.ts` | Clusters, stack, sem esconder extras |
| `src/components/agenda/FullCalendar.tsx` | Usa clusters + caixas |
| `src/components/agenda/AgendaHourClusterBox.tsx` | Caixa + busca + dialog central |

---

## 11. Critérios de aceite

- [ ] Usuário A no painel flutuante **não** vê tarefas cujo titular é só o usuário B.  
- [ ] Admin com filtro “Todos” na página **ainda** vê só as próprias no painel flutuante.  
- [ ] Dia com 50+ itens às 10:00 mostra caixa `10:00 · N tarefas` (não some item).  
- [ ] Busca na caixa reduz a lista; limpar volta a mostrar todas do horário.  
- [ ] Ampliar abre dialog central com o horário no título e busca funcional.  
- [ ] “+N mais” na visão cheia abre o mesmo tipo de dialog com todas do cluster.  
- [ ] Clicar um item no dialog abre a edição correta (lead / pessoal / etc.).  
- [ ] Badge do ícone bate com pendências **próprias** de hoje.

---

## 12. Riscos e cuidados

| Risco | Mitigação |
|-------|-----------|
| Popup fecha no mesmo clique que abre | Abertura adiada (`setTimeout 0`) + estado no `FullCalendar` |
| Caixa cobre horários seguintes | Altura máxima + scroll; ampliar para ler tudo |
| Admin achar que “Todos” vale no canto | Texto explícito no filtro da página |
| FAB “Criar” cobrir o botão ampliar | Usuário rola a lista ou amplia; eventual ajuste futuro de z-index/posição do FAB |

---

## 13. Glossário rápido

| Termo | Significado simples |
|-------|---------------------|
| Painel flutuante | Agenda lateral que abre pelo ícone de calendário |
| Titular | Pessoa responsável pela tarefa / lembrete |
| Cluster | Grupo de tarefas que se sobrepõem no mesmo horário |
| Caixa de horário | Lista compacta “10:00 · N tarefas” |
| Popup central | Janela no meio da tela com a lista ampliada |

---

## 14. Histórico

| Data | Versão | O que entrou |
|------|--------|--------------|
| 28/09/2026 | 1.0 | Titularidade nativa no flutuante; caixas lotadas; busca; popup central; PRD |
