# PRD — Composição Visual com IA (Íris) na Calculadora de Markup

**Produto:** GARBO Movelaria
**Módulo:** Markup / Calculadora de Orçamento
**Versão do documento:** 1.0
**Data:** 17/09/2026
**Status:** Proposto — aguardando decisão sobre a Decisão Arquitetural Central (seção 3) antes de detalhar sprints

Referência usada como inspiração: `docs/sistemadeprecificacaocomia.md` ("Guia Mestre — IA Orçamentista de Marcenaria"). Este PRD **não** implementa esse guia literalmente — ele foi lido, comparado ao que já existe no código, e adaptado. Boa parte do que o guia propõe **já existe** neste projeto, com um pipeline mais granular do que o do guia.

---

## 1. Resumo (em uma frase)

Redesenhar a experiência do botão **"Compor com IA"** para abrir um popup onde o usuário anexa a imagem/PDF do projeto, vê cada móvel identificado marcado sobre a própria imagem, clica num móvel para ir direto ao campo do orçamento correspondente, e pode ensinar a IA (Íris) a calcular caixaria/chapas através de regras editáveis — mantendo tudo revisável e editável antes de aplicar ao orçamento final.

---

## 2. Diagnóstico — por que "não está funcionando" hoje

Antes de redesenhar, uma auditoria do código (4 frentes: UI, backend/IA, schema, infraestrutura de IA já existente) não encontrou nenhum bug, TODO ou stub. O fluxo atual (`MarkupCalculatorSheet.tsx:1384` → `MarkupIAAnexosPicker` → `invokeComposeMarkupIAStream` → `MarkupIAComposeOverlay` → `MarkupIAConferenciaDialog` → `MarkupIAResumoPanel`) é funcional e já roda um pipeline de 6-7 chamadas à OpenAI.

**Hipótese mais provável:** o botão fica clicável, mas há 3 pré-condições que travam com um toast (não um erro visível/persistente) se qualquer uma estiver desligada:

| Pré-condição | Onde mora | Efeito se desligada |
|---|---|---|
| `markup_config.markup_ia_ativo` | Markup → Configurações → aba IA | Toast de erro, nada acontece |
| Chave OpenAI configurada (`apiKeyConfigured`) | Pipeline → Configurações → IA do Lead | Toast de erro, nada acontece |
| `pipelineAiConfig.ativo` | Pipeline → Configurações → IA do Lead | Toast de erro, nada acontece |

**Ação imediata (Epic 0, antes de qualquer redesign):** confirmar no ambiente de produção se essas 3 chaves estão ligadas e a chave OpenAI está configurada. Se sim, "não está funcionando" pode ser sobre a **experiência** (popup pouco claro, sem feedback de progresso) — o que este PRD já resolve — e não sobre a lógica.

---

## 3. Decisão Arquitetural Central (precisa ser respondida antes de detalhar os épicos 2 e 3)

O documento de referência do usuário propõe 3 fases: **extração multimodal → engenharia construtiva (fórmulas fixas) → cálculo financeiro determinístico** (Python/openpyxl). O sistema atual já faz a extração multimodal bem (fase "Projetista"), mas a fase de quantidade/engenharia **hoje é decidida pela IA em texto livre** (o agente "Inventariante" lê o prompt e "decide" quantas chapas, parafusos, dobradiças — não existe uma fórmula matemática determinística rodando em código).

Isso importa porque o usuário pediu explicitamente um campo para **"treinar"** a IA mostrando "como é uma caixaria, quanto tem de chapa" — ou seja, quer ensinar uma regra de engenharia. Há duas formas de fazer isso, com trade-offs bem diferentes:

| | **Opção A — Regras como contexto de prompt** | **Opção B — Motor de cálculo determinístico (recomendado)** |
|---|---|---|
| Como funciona | Usuário edita uma base de regras estruturada (dobradiça por altura, chapa por m², etc.) que é **compilada em texto** e injetada no prompt do agente Inventariante/Projetista. A IA continua fazendo a conta. | A IA (fase Projetista) só **extrai** tipologia e dimensões. Um motor de cálculo em TypeScript (na Edge Function) aplica as fórmulas (chapas inteiras = `ceil(área×1.2 / 5.06)`, dobradiças por faixa de altura, fita de borda com 15% de perda) usando os parâmetros editáveis como **inputs de fórmula**, não texto. |
| Confiabilidade do cálculo | Depende da LLM fazer aritmética certa — LLMs erram conta com frequência, principalmente em preenchimento de tabela grande. | Determinístico — mesma entrada, mesma saída, sempre. É dinheiro; não deveria ser probabilístico. |
| Esforço | Menor — é uma extensão da Epic 3 já planejada (novo editor de regras + injeção no prompt). | Maior — precisa de um motor de fórmulas novo, e de campos técnicos novos no catálogo (`markup_produtos` não tem `espessura_mm`/`largura_mm`/`comprimento_mm` hoje). |
| Alinhamento com o documento de referência do usuário | Parcial. | Total — é literalmente a Fase 2+3 do guia anexado. |
| Auditável ("por que deu esse número?") | Difícil — está dentro do raciocínio da IA. | Fácil — cada número tem uma fórmula e um parâmetro editável por trás. |

**Recomendação deste PRD: Opção B.** Preços e listas de compra são a parte do sistema onde erro de aritmética custa dinheiro real. Vale o esforço extra de um motor determinístico, e ele reaproveita quase tudo que já existe — a IA continua fazendo a parte que ela faz bem (ler imagem, identificar móveis, ler dimensões), só troca **quem faz a conta de quantidade**.

Os épicos abaixo já assumem a Opção B, mas cada um está marcado onde a Opção A mudaria o escopo.

---

## 4. O que já existe hoje (inventário — não recriar)

| Capacidade | Onde | Reaproveitar como está? |
|---|---|---|
| Pipeline multiagente (Fidelidade → Projetista → Inventariante/categoria → 2 Auditores → Precificador) | `supabase/functions/compose-markup-ia/index.ts` | Sim — é a espinha dorsal |
| OpenAI já é o provedor, modelo selecionável (principal + auditor) | `callOpenAIChat` (`index.ts:272`), `MARKUP_IA_ALLOWED_MODELS` (`_shared/markup-ia-prompts.ts:5`) | Sim |
| Prompts por agente editáveis, persistidos no banco | `markup_config.markup_ia_agent_prompts` (7 chaves), UI em `MarkupIAAgentesPanel` | Sim, vira a base da Epic 3 |
| PDF → imagem por página (JPEG/PNG) | `src/lib/pdf-to-image.ts` (`pdfAllPagesToJpegBlobs` etc.) | Sim — não recriar |
| Revisão com semáforo de confiança | `MarkupIAConferenciaDialog` | Sim — ótima UX, manter |
| Resultado final editável por cômodo/móvel/material | `MarkupIAResumoPanel` | Sim — só precisa ganhar âncoras clicáveis (Epic 2) |
| Streaming de progresso por fase | `invokeComposeMarkupIAStream`, `MarkupIAFluxoVerificacao` | Sim — reusar no popup novo |
| Catálogo de insumos (preço/unidade) | `markup_categorias`/`markup_produtos` | Sim, mas **falta dimensão física** (ver Epic 3) |

**O que não existe (é 100% trabalho novo):** qualquer coordenada/posição de móvel na imagem, qualquer clique-na-imagem→campo, upload de arquivo dentro do próprio popup (hoje só escolhe entre mídia já anexada ao lead), seletor de modelo no ponto de uso (só existe dentro de Configurações, como campo de texto livre — nem é dropdown), e motor de cálculo determinístico (se Opção B for escolhida).

---

## 5. Objetivos do redesign

| Objetivo | Como medir |
|---|---|
| Usuário entende por que "não funcionou" quando falha | Erro mostra qual das 3 pré-condições falhou + link direto pra corrigir, não só um toast |
| Ver os móveis identificados sobre a própria imagem | N móveis identificados = N marcadores visíveis, sem depender de rolar uma lista de texto |
| Ir direto ao campo do orçamento a partir da imagem | Clique num marcador rola/realça a seção certa em ≤ 300ms |
| Ensinar a IA sem editar prompt cru | Existe editor estruturado de regras (dobradiça, chapa, corrediça) sem precisar tocar em texto de prompt |
| Escolher o modelo OpenAI no momento de compor | Dropdown com os modelos permitidos, visível no popup, não só nas Configurações |
| Nada é travado — tudo revisável | Todo campo do resultado (inclusive quantidade calculada) tem edição manual antes de aplicar |
| Custo de IA não surpreende | PDF grande (muitas páginas) mostra estimativa de chamadas/custo antes de rodar |

## 6. Fora de escopo (nesta fase)

- Reescrever o motor financeiro de margem/impostos (`markup_config` de parâmetros gerais) — não muda.
- Integração com Excel/openpyxl do documento de referência — este projeto já não usa planilha, usa banco de dados; a "Fase 2/3" do guia é reimplementada em TS, não em Python.
- Detecção de bounding-box pixel-perfeito — ver Epic 2, a expectativa é de marcadores aproximados, não segmentação de imagem profissional.
- Suporte a outros provedores de IA (Gemini, Claude) — fica só OpenAI, como pedido.

---

## 7. Fluxo novo proposto (visão de produto)

1. Usuário clica **"Compor com IA"** → abre um **popup dedicado** (Dialog cheio, não mais o overlay full-bleed "Oficina Íris" atual — ver decisão de estilo abaixo).
2. Dentro do popup: usuário **anexa** um PDF/imagem novo *ou* escolhe mídia já anexada ao lead (as duas opções, não só uma). Se for PDF, o sistema já mostra "X páginas detectadas" (reaproveita `pdf-to-image.ts`) e converte cada página em imagem.
3. Usuário escolhe o **modelo de IA** (dropdown, com uma opção "Recomendado" pré-selecionada) e clica em **Analisar**.
4. Acompanha o progresso por fase em tempo real (reaproveita `MarkupIAFluxoVerificacao`), mas agora com um resultado **visual**: conforme a fase "Projetista" identifica cada móvel, um marcador numerado aparece sobre a página correspondente.
5. Ao terminar: a tela mostra a imagem/PDF com todos os móveis marcados **de um lado**, e o formulário/resumo de orçamento **do outro** (layout responsivo — pode empilhar no celular). Clicar num marcador rola e realça o card do móvel correspondente no resumo.
6. Cada card do resumo é editável (já existe) — inclusive os campos calculados (chapas, parafusos, dobradiças), que agora vêm de fórmula (Opção B) com o número exibido junto de "por quê" (ex.: "3 dobradiças — porta de 1200mm, regra: 1000–1600mm").
7. Usuário revisa, ajusta o que quiser, e aplica ao orçamento (fluxo de confirmação existente, `MarkupIAConferenciaDialog`, é mantido).

### Decisão de estilo (usar a skill `frontend-design`)

O overlay atual já tem uma identidade proposital — "Oficina Íris", tema escuro, sensação de ateliê/bastidor. Isso **não é o mesmo bug de contraste que corrigimos no `/projetos`** (lá era texto claro sobre fundo claro por acidente) — aqui é uma escolha de tema consistente (fundo escuro + texto claro, deliberado). Duas opções, e recomendo a **B**:

- **A. Trocar para a paleta clara** (Bourbon Daylight, igual ao resto do app) — mais consistente com o resto do sistema, menos distintivo.
- **B. Manter/refinar o tema escuro como "modo foco" intencional** — um popup de trabalho de IA se beneficia de um contraste visual proposital com o resto do app claro (sinaliza "você está num modo diferente, de análise"), na linha do que a skill `frontend-design` pede ("escolha uma direção estética e execute com precisão"). Mantém a marca "Íris" já estabelecida no produto (também usada em `chat-iris-sky`). Só precisa garantir que **todo** texto novo (marcadores, badges de confiança) tenha contraste correto dentro desse tema escuro — checar isso explicitamente no code review desta feature.

---

## 8. Épicos

### Epic 0 — Diagnóstico e feedback de erro (pré-requisito, esforço P)
- Confirmar em produção: `markup_ia_ativo`, chave OpenAI, `pipelineAiConfig.ativo`.
- Trocar o toast genérico (`MarkupCalculatorSheet.tsx:1386-1404`) por um estado explicativo no próprio botão/popup, com link direto para a configuração que falta.
- **Critério de aceite:** desligar de propósito uma das 3 pré-condições e confirmar que a mensagem diz exatamente qual e como corrigir.

### Epic 1 — Popup dedicado com upload direto (esforço M)
- Nova casca de Dialog (ou Sheet) substituindo o overlay atual, decisão de estilo conforme seção 7.
- Upload de arquivo novo dentro do popup (hoje só escolhe mídia já anexada) — arquivo enviado também é salvo como anexo do lead, reaproveitando o storage já existente.
- Dropdown de modelo OpenAI no ponto de uso, usando `MARKUP_IA_ALLOWED_MODELS`.
- Reaproveitar 100% da lógica de stream/fases existente (`invokeComposeMarkupIAStream`).
- **Critério de aceite:** popup abre, aceita arquivo novo ou já anexado, mostra progresso por fase, modelo é escolhido por dropdown (não texto livre).

### Epic 2 — Anotação visual clicável (esforço L — é a funcionalidade genuinamente nova)
- Estender `MarkupIAProjetistaResult.moveis[]` com página (se PDF) + região aproximada (ponto normalizado 0–1 ou bounding box) por móvel identificado.
- Ajustar o prompt/schema da fase "Projetista" para pedir essa coordenada explicitamente — prever que a precisão de modelos multimodais para bounding box é limitada; tratar como "aproximado", com marcador numerado (não caixa de seleção perfeita).
- Componente novo: camada de marcadores posicionados por percentual sobre a imagem/página (HTML absoluto, não canvas), clicável.
- Ao clicar: `scrollIntoView` + realce temporário no card correspondente do resumo/formulário.
- Fallback: se a IA não retornar coordenada com confiança mínima, o móvel aparece na lista normal (texto), sem marcador — nunca esconder o dado, só a interação visual extra.
- **Critério de aceite:** para um PDF de teste com N móveis em páginas diferentes, todos aparecem (marcados ou em lista), e todo marcador navega para o card certo.

### Epic 3 — Base de regras construtivas editável + (se Opção B) motor de cálculo determinístico (esforço L)
- Novo editor estruturado por tipo de móvel/regra: espessura padrão por parte (corpo/porta/fundo), regra de dobradiça por faixa de altura, corrediça por profundidade, perda de chapa (%), perda de fita de borda (%) — inspirado 1:1 nas fórmulas do documento de referência.
- Persistir estruturado (não como texto livre) — provavelmente um novo JSONB em `markup_config` ou tabela nova `markup_regras_construtivas`, separado do `markup_ia_prompt` cru (que continua existindo para quem quiser editar o prompt bruto).
- **Se Opção B:** implementar o motor de cálculo em TypeScript na Edge Function, consumindo essas regras como parâmetros de fórmula; a IA (fase Projetista) só extrai dimensão/tipologia, o motor calcula quantidade.
- **Se Opção B:** adicionar `espessura_mm`, `largura_mm`, `comprimento_mm` ao catálogo `markup_produtos` (hoje só tem preço/unidade) — necessário pra calcular "quantas chapas inteiras" de verdade.
- **Se Opção A** (mais barato, menos confiável): só compilar as regras estruturadas em texto e injetar no prompt do Inventariante — pular o motor de cálculo e os campos de dimensão no catálogo.
- **Critério de aceite:** usuário edita uma regra (ex. "dobradiça: até 1000mm = 2un") sem tocar em prompt cru; ao compor um orçamento novo com uma porta de 900mm, o resultado usa 2 dobradiças e mostra a regra aplicada.

### Epic 4 — Edição total do resultado (reforço, esforço P)
- Auditar `MarkupIAResumoPanel` e o novo card com âncora visual (Epic 2): garantir que **todo** campo — inclusive os agora calculados por fórmula (Epic 3) — tem edição manual antes de aplicar ao orçamento.
- **Critério de aceite:** nenhum número do resultado final é somente leitura.

### Epic 5 — Transparência de degradação e guardrail de custo (esforço M)
- Hoje, falha de uma fase cai em fallback silencioso (só visível em log SSE). Expor no popup quando uma fase degradou ("Auditor não confirmou 2 itens — revise"), com botão para re-rodar só aquela fase.
- Antes de rodar um PDF grande, mostrar estimativa de nº de chamadas à OpenAI (o pipeline já dispara 6–10+ chamadas por composição; sem esse aviso, PDFs grandes multiplicam isso sem transparência de custo).
- **Critério de aceite:** ao forçar uma fase a falhar (ambiente de teste), o usuário vê isso no popup, não só no log.

---

## 9. Riscos

| Risco | Mitigação |
|---|---|
| Coordenadas de bounding-box da IA são imprecisas (limite conhecido de modelos multimodais) | Tratar como aproximado desde o design (marcador, não seleção exata); fallback pra lista em texto |
| Custo de OpenAI cresce com PDFs grandes (já são 6–10+ chamadas hoje, mais a nova extração de coordenada) | Epic 5 — estimativa antes de rodar; considerar cache entre re-tentativas |
| Opção B (motor determinístico) atrasa a entrega por exigir schema novo no catálogo | Pode ser feita em 2 etapas: Epic 3 primeiro em modo Opção A (rápido), migrar para Opção B depois sem quebrar a UI já construída nos Epics 1–2 |
| Tema escuro do popup (decisão de estilo B) sair inconsistente se algum componente reaproveitado assumir fundo claro | Checklist de contraste específico no code review desta feature (mesma classe de bug já visto em `/projetos`) |

---

## 10. Decisões pendentes (responder antes de abrir os épicos como tarefas)

1. **Opção A ou B** na seção 3 (regra em prompt vs. motor determinístico)?
2. **Estilo do popup** (seção 7): manter tema escuro "Oficina Íris" como modo foco, ou trocar pra paleta clara padrão do app?
3. Upload direto no popup deve **sempre** salvar como anexo permanente do lead, ou deve existir uma opção de "só usar pra essa análise, não guardar"?
4. Prioridade: Epics 1+2 (experiência visual) antes de Epic 3 (motor de regras), ou o inverso?
