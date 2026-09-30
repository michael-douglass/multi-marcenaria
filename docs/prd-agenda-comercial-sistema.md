# PRD — Sistema de Agenda Comercial

**Produto:** GARBO Movelaria / CRM Selletos  
**Módulo:** Agenda Comercial  
**Rota principal:** `/agenda-comercial` (alias legado `/agenda` redireciona para cá)  
**Versão do documento:** 1.0  
**Data:** 29/09/2026  
**Status:** Retrato do sistema em produção (código local)  
**Autor do documento:** Auto (agente Cursor)

---

## Documentos relacionados

| Documento | O que cobre |
|-----------|-------------|
| [prd-agenda-popup-configuracoes.md](prd-agenda-popup-configuracoes.md) | Tamanho do painel/cards, agrupamento por horário, prévia e adiamento |
| [prd-agenda-layout-titularidade-caixas.md](prd-agenda-layout-titularidade-caixas.md) | Titularidade no painel flutuante + caixas de horário lotado |
| [agenda-proximo.md](agenda-proximo.md) | Cards coloridos, balão de prévia, adiar, arrastar |
| [menusidebar.md](menusidebar.md) | Onde a Agenda aparece no menu Comercial |

---

## 1. Resumo (em uma frase)

A Agenda Comercial é o **quadro de compromissos da equipe de vendas**: reuniões com clientes, lembretes ligados a leads, tarefas pessoais do dia a dia e (quando há) conteúdos de marketing — tudo reunido numa página com abas e num **ícone flutuante** que acompanha a pessoa em qualquer tela.

---

## 2. Por que existe

Sem a Agenda Comercial, o time espalha compromissos em WhatsApp, caderno e cabeça. O resultado típico:

- Esquecer follow-up de lead
- Duas pessoas marcarem no mesmo horário
- Admin não saber “o que está na mão de cada um”
- Cliente marcar visita sem horário livre

Este módulo resolve isso com **um lugar só**, com titular (responsável), status e calendário compartilhado.

---

## 3. Onde vive no produto

```
┌─────────────────────────────────────────────────────────────┐
│  Qualquer página (MainLayout)                               │
│                                                             │
│                    [73] ← FloatingCalendarIcon              │
│                      │                                      │
│                      └── Painel lateral Agenda Geral        │
│                          (só minhas tarefas)                │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│  Página /agenda-comercial                                   │
│                                                             │
│  [Agenda Geral] [Agenda de Tarefas] [Lembrete de Leads]     │
│  [Agenda Pessoal]                                           │
│                                                             │
│  Botão Criar → reunião / tarefa pessoal / lembrete          │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│  Público (sem login)                                        │
│  /agendar/:slug  → cliente marca reunião sozinho            │
└─────────────────────────────────────────────────────────────┘
```

---

## 4. Quem usa

| Perfil | Pode abrir a página? | Vê o ícone flutuante? | O que enxerga |
|--------|----------------------|------------------------|---------------|
| Vendedor / colaborador CRM | Sim (se tiver acesso à rota) | Sim | Só o que é titular / criado por ele |
| Admin CRM / Super admin | Sim | Sim | Na **página**: pode filtrar Todos / Só eu / Um prestador. No **ícone**: sempre só o próprio |
| Montador / equipe fábrica com ficha ativa | Em geral não a rota Comercial | Sim (Agenda Geral) | Só titularidade própria |
| Prestador de serviço / Lead / Portal parceiro | Não | Não | — |

**Regra de ouro:** o número vermelho no ícone do canto (`FloatingCalendarIcon`) conta **somente pendências suas de hoje**, nunca as da equipe.

---

## 5. Visão geral das abas

A página tem **4 abas**. Você citou as três principais; a quarta (Lembretes) também faz parte do sistema e aparece na Agenda Geral.

| Aba | Papel em linguagem simples | Fonte principal no banco |
|-----|----------------------------|---------------------------|
| **Agenda Geral** | “Tudo misturado no calendário” — visão do dia | União de reuniões + lembretes + pessoais + marketing |
| **Agenda de Tarefas** | Reuniões / atendimentos (internos e públicos) | `agenda_reunioes` + `agenda_config` |
| **Lembrete de Leads** | Follow-ups ligados a um cliente do CRM | `lead_lembretes` |
| **Agenda Pessoal** | Minhas tarefas do dia (únicas ou repetidas) | `crm_multiempresas_agenda_pessoal_tarefas` |

URL com aba: `/agenda-comercial?tab=geral|tarefas|lembretes|pessoal`

---

## 6. Aba Agenda Geral

### 6.1 O que é

Um **calendário único** (Dia / Semana / Mês) que junta quatro tipos de compromisso em chips coloridos.

| Cor | Tipo na tela | Nome amigável | Origem |
|-----|--------------|---------------|--------|
| Azul | `tarefa` | Reunião | Agenda de Tarefas |
| Âmbar | `lembrete` | Lembrete | Lembrete de Leads |
| Verde | `pessoal` | Pessoal / Evento | Agenda Pessoal (e espelho de Controle de Eventos) |
| Roxo | `conteudo` | Marketing | Tarefas de conteúdo |

### 6.2 Onde aparece

1. **Página** `/agenda-comercial` → aba Agenda Geral (`AgendaGeralTab` → `AgendaGeralContent`)
2. **Painel flutuante** → mesmo conteúdo em modo `compact` (`FloatingAgendaGeralPopup`)

### 6.3 Capacidades

| Capacidade | Descrição |
|------------|-----------|
| Busca | Filtra por título, lead, detalhes, tipo, horário |
| Filtro de titularidade (admin, só na página) | `self` (padrão) · `all` · `provider` |
| Criar | Menu: reunião, tarefa pessoal, lembrete de lead |
| Clique no horário vazio (painel) | Abre criar tarefa naquele slot |
| Arrastar chip | Muda horário (passos de 15 min) |
| Balão (hover/toque) | Prévia + Adiar + Concluir + Excluir |
| Caixa de horário lotado | Quando muitos itens no mesmo horário → lista com busca e popup central |
| Histórico de concluídos | Lista à parte na página |
| Zoom (painel) | 80%–140%, preferência salva |

### 6.4 Regras de titularidade (Agenda Geral)

1. Painel flutuante: `forceOwnTitular: true` — **sempre** só o usuário logado.
2. Página: admin pode salvar preferência; padrão nativo sem preferência = **somente os meus**.
3. Reunião / lembrete: pode ter **vários titulares** (`titular_ids`).
4. Pessoal: um `titular_id`; opção `ocultar_de_outros_admins`.
5. Marketing: responsável = `criado_por`.

Detalhes de layout lotado: ver PRD de titularidade/caixas.

---

## 7. Aba Agenda de Tarefas

### 7.1 O que é

A gaveta das **reuniões e atendimentos**: visitas, calls, aulas experimentais, agendamentos que o cliente fez pelo link público.

Não é a “lista de afazeres pessoais” — isso fica na Agenda Pessoal. O nome “Tarefas” aqui = **tarefas de atendimento / reunião**.

### 7.2 Tela

Layout em duas colunas (desktop):

- **Esquerda:** calendário mensal das reuniões + resumo (pendentes / públicos)
- **Direita:** lista do dia com busca e filtros

Cards de resumo no topo:

| Card | Significado |
|------|-------------|
| Reuniões hoje | Quantas caem no dia de hoje |
| Pendentes | Ainda não concluídas / canceladas |
| Agendamentos públicos | Vieram do link `/agendar/...` |
| Duração padrão | Minutos configurados em `agenda_config` |

### 7.3 Status de uma reunião

| Status | Quando |
|--------|--------|
| `pendente` | Criada, ainda não confirmada |
| `confirmado` | Equipe ou fluxo confirmou |
| `concluido` | Atendimento feito (pode disparar webhook de conclusão) |
| `cancelado` | Não aconteceu |

### 7.4 Tipos

| Tipo | Origem |
|------|--------|
| `interno` | Criado pela equipe no sistema |
| `publico` | Cliente agendou sozinho pelo link público |

### 7.5 Configuração (`AgendaConfigPanel`)

Administra a “loja da agenda”:

- Nome, slug, duração, intervalo entre horários
- Dias e faixa de horário disponíveis
- Antecedência mínima / máxima
- Bloqueios recorrentes (ex.: toda segunda 15h–15h30)
- Formulário / banners / texto da página pública
- Captura de metadados (dispositivo, hora da marcação, localização)
- Webhooks: lembrete, conclusão, relatório, cancelamento
- Templates de mensagem
- Criar lead automático no pipeline ao agendar

### 7.6 Link público

Se a agenda tem `slug` ativo, a aba mostra o link (ex. `/agendar/{slug}`) e botão **Copiar**. Cliente marca sem login; a reunião nasce como `tipo: publico`.

### 7.7 Lista do dia — filtros

- Busca por nome, telefone ou responsável
- Filtrar por **data da reunião** ou **data da marcação** (quando o cliente agendou)
- Editar reunião, mudar status, ajustar titulares

---

## 8. Aba Lembrete de Leads

### 8.1 O que é

Follow-ups do tipo: “Ligar para Divina Silva amanhã às 9h15”. Cada lembrete está **preso a um lead** do CRM.

### 8.2 Organização na aba

Listas em grupos:

1. Atrasados  
2. Hoje  
3. Próximos  
4. Concluídos  

Ações: editar, concluir, excluir, abrir o lead.

Deep link: `/agenda-comercial?tab=lembretes&editLembrete={id}`

### 8.3 Na Agenda Geral

Aparece como chip âmbar com título `[Lead: Nome] …`. Duração visual ≈ 1 hora (só para desenhar o bloco; no banco grava `data_hora`).

---

## 9. Aba Agenda Pessoal

### 9.1 O que é

A **agenda do dia a dia da pessoa**: entregar documento, comprar peça, reunião interna sem lead, checklist espelhado do Controle de Eventos.

### 9.2 Tipos de agendamento

| Tipo | Comportamento |
|------|---------------|
| Única | Uma data (+ hora opcional) |
| Recorrente | `todo_dia` · `dias_semana` · `mensal`, com data fim opcional |

Recorrência gera **ocorrências** na tela (não duplica dezenas de linhas no banco). Concluir/excluir pode valer **só aquele dia** da série.

### 9.3 Regras importantes

- Titular obrigatório; admin/vendedor pode atribuir a outra pessoa (conforme permissão).
- Admin na página: filtro `self` / `all` / `provider` (preferência salva).
- `ocultar_de_outros_admins`: esconde de outros admins na Pessoal e na Geral.
- Sem horário → faixa “Sem horário” no calendário dia.
- Recorrente: **não** pode mudar o **dia** pelo adiar/arraste da Geral (só o horário no mesmo dia).
- Anexos (imagens/PDF) por tarefa.
- Tarefas criadas no Controle de Eventos podem espelhar aqui (`evento_id` / `evento_tarefa_id`).

### 9.4 Ícone flutuante da Pessoal (extra)

Além do calendário da Geral, existe fluxo/ícone de Agenda Pessoal em alguns layouts (`FloatingAgendaPessoalIcon` / popup). A fonte da verdade da aba continua sendo esta aba na página.

---

## 10. Ícone flutuante (`FloatingCalendarIcon`)

### 10.1 Aparência

Botão circular fixo no canto superior direito (respeita safe-area do celular).

- Sem pendência hoje: visual “calmo”
- Com pendências: borda/brilho vermelho + **número** no centro
- `title` exemplo: “73 tarefas pendentes hoje”
- `aria-label`: “Abrir Agenda”
- `aria-pressed`: indica se o painel está aberto

### 10.2 O que o número significa

`pendingTodayCount` via `useAgendaGeral({ forceOwnTitular: true })`:

- Conta eventos de **hoje**
- Status pendente / confirmado / em andamento
- **Só** do titular logado
- Mistura os 4 tipos da Agenda Geral

### 10.3 Ao clicar

Abre `FloatingAgendaGeralPopup`:

- Painel lateral (direita ou esquerda; arrasta a barra do topo para trocar)
- Mesmo calendário da aba Geral, modo compacto
- Zoom próprio
- FAB de criar no canto do painel

Z-index alto o bastante para ficar acima do conteúdo, abaixo de dialogs críticos da agenda.

---

## 11. Menu Criar (`AgendaCreateMenu`)

Disponível no header da página e no FAB do painel.

| Opção | Abre | Resultado |
|-------|------|-----------|
| Reunião | `CreateReuniaoDialog` | Linha em `agenda_reunioes` (tipo interno) |
| Tarefa pessoal | `CreateTarefaPessoalDialog` | Linha em agenda pessoal |
| Lembrete de lead | Escolher lead → `LeadLembreteDialog` | Linha em `lead_lembretes` |

Tudo criado aqui **também aparece** na Agenda Geral (respeitando titularidade).

---

## 12. Fluxos principais (passo a passo)

### 12.1 Vendedor começa o dia

1. Vê o ícone com “12” (doze pendências próprias hoje).  
2. Clica → painel com o dia.  
3. Em 10:00 lotado, abre a caixa `10:00 · N tarefas`, busca o nome, conclui ou adia.  
4. Se precisar da visão completa, vai em `/agenda-comercial`.

### 12.2 Admin olha a equipe

1. Abre Agenda Comercial → Agenda Geral.  
2. Em Titularidade escolhe **Todos** ou um prestador.  
3. Página mostra a equipe; o ícone do canto **continua só com as dele**.

### 12.3 Cliente marca visita

1. Recebe o link público.  
2. Escolhe horário livre.  
3. Reunião nasce como pública na Agenda de Tarefas e no chip azul da Geral.  
4. (Opcional) sistema cria lead no pipeline se a config pedir.

### 12.4 Follow-up de lead

1. No card do lead ou no menu Criar → Lembrete.  
2. Define data/hora e titulares.  
3. Aparece na aba Lembretes, no chip âmbar da Geral e no contador do ícone no dia.

### 12.5 Tarefa pessoal recorrente

1. Aba Pessoal → Nova → Recorrente (ex.: toda segunda).  
2. Cada segunda gera ocorrência no calendário.  
3. Concluir uma segunda não apaga as próximas.

---

## 13. Modelo de dados (mapa simples)

```
agenda_config                    → regras da agenda pública + webhooks
agenda_reunioes                  → reuniões (Agenda de Tarefas)
agenda_bloqueios                 → bloqueios avulsos
lead_lembretes                   → follow-ups de lead
crm_multiempresas_agenda_pessoal_tarefas
                                 → tarefas pessoais (+ recorrência)
crm_multiempresas_agenda_pessoal_admin_titular_filter
                                 → preferência de filtro do admin (pessoal)
(+ preferência equivalente da Agenda Geral)
marketing tasks / content cards  → chips roxos na Geral
```

**Multi-empresa:** tabelas de reunião/config/lembrete resolvem schema por empresa (`useEmpresaSupabase` / nomes `CRM-multi-empresas>…`). Pessoal usa tabela `crm_multiempresas_*` compartilhada com `titular_id`.

---

## 14. Arquitetura de código (mapa)

```
pages/Agenda.tsx
├── AgendaGeralTab → AgendaGeralContent → useAgendaGeral → FullCalendar
├── (tarefas) AgendaCalendar + AgendaTaskList + useAgenda
├── LeadLembretesTab → useLeadLembretes
└── AgendaPessoalTab → useAgendaPessoal

layout/
├── FloatingAgendaGeralShell → FloatingCalendarIcon + FloatingAgendaGeralPopup
└── (opcional) FloatingAgendaPessoal*

hooks/
├── useAgendaGeral.ts      → unifica fontes + adiar/arraste + contador
├── useAgenda.ts           → config + reuniões
├── useAgendaPessoal.ts    → tarefas pessoais
└── useLeadLembretes.ts    → lembretes (+ realtime)
```

Edge Functions relacionadas (exemplos): `agenda-disparar-conclusao`, fluxos públicos de booking.

---

## 15. Permissões e segurança

| Tema | Regra |
|------|-------|
| Rota `/agenda-comercial` | `canAccessCrmPath` (vendedor/admin CRM; marketing-only não) |
| Ícone flutuante | `canUseAgendaGeral` (colaborador fábrica/CRM ativo; sem prestador/lead/portal) |
| Ver todos os titulares | `canViewAllTitularRecords` → admin ou super admin |
| Atribuir titular a outro | admin/super admin ou vendedor |
| RLS | Políticas no Supabase; UI não substitui segurança do banco |
| Link público | Sem sessão; só slots e dados necessários para marcar |

---

## 16. Integrações

| Integração | Como |
|------------|------|
| Pipeline / Leads | Lembretes no lead; opção criar lead ao agendar público |
| Marketing conteúdo | Tarefas entram na Geral |
| Controle de Eventos | Tarefa do evento espelha na Pessoal |
| Webhooks | Lembrete pré-reunião, conclusão, relatório, cancelamento |
| Notificações in-app | Lembretes / pessoais próximos (`AgendaRemindersNotificationPopup`) |
| WhatsApp / templates | Via config + templates de disparo |

---

## 17. Experiência visual (direção)

- Página: UI padrão Shadcn (tabs, cards, badges) no workspace de papel do app.
- Painéis flutuantes: vidro/blur, sombra forte, z-index dedicado.
- Chips: azul / âmbar / verde / roxo (ou cor custom hex no item).
- Horários lotados: caixa estilo papel (`#fffcf8` / tinta escura) — ver PRD de caixas.
- Mobile-first: tabs em 4 colunas com texto menor; painel flutuante usável com toque.

---

## 18. Fora de escopo deste PRD

- Agenda de **obras** / montagem (módulo separado da fábrica)
- Redesign visual completo da aba de Tarefas
- Unificar as 4 abas em uma só lista “inteligente” (hoje a Geral já é a união visual)
- Push nativo mobile / PWA avançado
- Alterar RLS (este documento descreve comportamento da UI e regras de produto)

---

## 19. Critérios de aceite (sistema)

### Página

- [ ] `/agenda-comercial` abre com 4 abas; default = Agenda Geral  
- [ ] `?tab=tarefas|lembretes|pessoal|geral` seleciona a aba correta  
- [ ] Menu Criar gera reunião, pessoal e lembrete e eles aparecem na Geral  
- [ ] Agenda de Tarefas lista, edita status e mostra link público quando houver slug  
- [ ] Lembretes agrupam atrasados / hoje / próximos / concluídos  
- [ ] Pessoal cria única e recorrente; concluir ocorrência não some a série  

### Painel flutuante

- [ ] Ícone visível onde `canUseAgendaGeral` permite  
- [ ] Badge = pendências **próprias** de hoje  
- [ ] Abrir painel mostra só eventos do titular logado  
- [ ] Admin com filtro “Todos” na página **não** altera o painel  

### Comportamento compartilhado

- [ ] Quatro cores estáveis na Geral  
- [ ] Adiar / arraste em passos de 15 min  
- [ ] Recorrente pessoal não muda de dia pelo adiar  
- [ ] Horário lotado → caixa com busca / popup (critérios do PRD de caixas)  

---

## 20. Riscos e cuidados

| Risco | Mitigação |
|-------|-----------|
| Admin achar que “Todos” vale no ícone | Texto no filtro + este PRD |
| Contador “73” assustar / poluir | Caixas de horário + busca; eventual filtro por tipo (futuro) |
| Nome “Agenda de Tarefas” confundir com Pessoal | Documentar: Tarefas = reuniões; Pessoal = afazeres |
| Multi-schema / multi-empresa | Sempre resolver tabela via empresa ativa |
| Webhook falhar na conclusão | Log suave; reunião já marcada concluída na UI |

---

## 21. Glossário

| Termo | Significado simples |
|-------|---------------------|
| Agenda Comercial | Página `/agenda-comercial` + painéis flutuantes do CRM |
| Agenda Geral | Calendário que mistura todos os tipos |
| Agenda de Tarefas | Reuniões / atendimentos |
| Agenda Pessoal | Afazeres da pessoa (únicos ou repetidos) |
| Lembrete de lead | Alarme ligado a um cliente do CRM |
| Titular | Quem é responsável pelo compromisso |
| Painel flutuante | Gaveta que abre pelo ícone do calendário |
| Link público | Página em que o cliente marca sozinho |
| Chip | Retângulo colorido no horário do calendário |
| Ocorrência | Um dia concreto de uma tarefa recorrente |
| Cluster / caixa | Grupo de muitos chips no mesmo horário |

---

## 22. Métricas sugeridas (produto)

| Métrica | Pergunta que responde |
|---------|------------------------|
| % de dias com badge > 0 por usuário | A equipe usa o ícone? |
| Tempo médio até concluir lembrete | Follow-up está saudável? |
| Taxa de no-show (público confirmado → cancelado) | Link público está gerando qualidade? |
| Uso do filtro admin “Todos” | Gestão de equipe depende da visão ampla? |

---

## 23. Roadmap possível (não comprometido)

Ideias já alinhadas ao código atual, sem data:

1. Filtro por tipo (só lembretes / só reuniões) no painel flutuante  
2. Unificar visual da aba Tarefas com o FullCalendar da Geral  
3. Notificação push / WhatsApp mais previsível por titular  
4. Relatório semanal “o que cada titular não concluiu”  
5. Ajuste fino de z-index FAB vs. botão ampliar da caixa lotada  

---

## 24. Histórico

| Data | Versão | O que entrou |
|------|--------|--------------|
| 29/09/2026 | 1.0 | PRD completo do sistema: abas, ícone flutuante, regras, dados, aceite |
