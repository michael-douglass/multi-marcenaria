# IA no card lead — tarefas (T01–T29)

Modo pair-to-peer: **uma tarefa por vez** (diagnóstico → OK do humano → implementa → valida → marca `[x]` → pausa). Execução pelo agente `agent-estrutural-e-frontend`; desenho feito com Fable 5.2. Sem commit/push sem pedido. Marcadores: **[MIG]** exige OK para `pnpm migrate`; **[DEPLOY]** exige OK para deploy de edge em produção; **[DROP]** irreversível, OK explícito.
Validação padrão de toda tarefa: `pnpm exec tsc --noEmit -p tsconfig.app.json` (sem erros novos nos arquivos tocados; baseline antigo ~209) e `pnpm build`.

## Context

Hoje a aba "IA" do card do lead (`LeadAIAnalysisTab`: subabas "Análise visual" e "Renderização de projetos") aparece para todos, usa chave/modelo/prompt **por empresa** (`crm.pipeline_lead_ai_config`, editável em `/pipeline/configuracoes` e `/configuracoes-ia`), não passa pelo bloqueio de plano e **nenhum token é medido**. O dono quer: (1) função "IA no card lead" ligável por plano e por empresa em `/master/planos`; (2) apagar a Análise visual; (3) motor/modelos/prompts/chave da Renderização só no master (`/master/modelos`); (4) controle de tokens por empresa; (5) ao final, reparo visual do card via `/reparo-visual`.

## Decisões do dono (confirmadas)
- Análise visual: "apagar tudo, inclusive tabelas" → executado em duas etapas seguras (T23 quarentena reversível, T24 DROP só do que é comprovadamente exclusivo, com OK explícito). **Não derrubar** `lead_ai_analises`, `lead_ai_knowledge_*`, `openai_api_key`, `lead_ai_renders`/bucket (slides e Markup IA dependem).
- `iaCardLead` nasce **desligada** em todos os planos existentes (migration).
- Estouro do limite mensal = **bloqueio duro** (limite no plano, sobreposição por empresa; sem limite = não bloqueia).
- **Um motor global** (uma chave, modelos de visão/imagem, prompts) em `/master/modelos`; a empresa não vê nem edita.

## Pontos a confirmar na aprovação (propostas já assumidas no plano)
D1 Markup IA perde o contexto "análise/conhecimento" em leads novos (aceitar; erro de `compose-markup-ia:1751` vira "Anexe imagens ou PDFs ao lead"). D2 empresa **sem plano** é recusada no servidor, salvo ajuste "liberada" em EmpresaDetalhe. D3 plano novo nasce com `iaCardLead` bloqueado (default da coluna). D4 renders já salvos continuam visíveis em anexos/slides. D5 limite = tokens totais por mês-calendário (America/Sao_Paulo); `dall-e-2` conta valor fixo configurável por imagem. D6 empresa só vê aviso de limite, números ficam com o master. D7 chave própria da empresa segue para markup/contrato; deixa de ser usada no render. D8 código legado não roteado: só remover a chamada a `analyze-lead-photos`.

## Achados que moldam o desenho
- `showIa` já existe em `LeadNavVisibility`/`LeadModalNav`/`LeadModalSearch`; `LeadModal.tsx` passa `true` fixo (~:1637, ~:1720) e renderiza a aba (~:2531) sem checar. `usePaginaLiberada` já é usado em `LeadModal.tsx:259-260`.
- Edges `render-lead-project`, `render-lead-ambiente`, `edit-lead-render` não chamam `motivoRecusa`, leem a config **sem filtro de `empresa_id`**, confiam em `empresaSchema` do body (regex `emp_*` × front mandando `crm`) e descartam `usage`. Modo somente-leitura hoje vira 500.
- Chave da empresa fica em texto puro e o admin da empresa a baixa para o navegador (`usePipelineLeadAIConfig.ts:171-176`). **A chave da plataforma nunca pode ir para essa tabela.**
- Não há tabela de config/segredo da plataforma; última migration real: `20261119120000_webhooks_admin_empresa.sql`.
- Empresa sem assinatura/plano tem tudo liberado (`app_paginas_bloqueadas`) → cota do servidor precisa recusar "sem plano" (D2).

## Tarefas

### Fase A — Fundação e gating no front
- [x] **T01 — Docs base (sem código)**: `docs/ia-lead/{REQUIREMENTS,DESIGN,TASKS}.md`, `docs/decisions/0007-motor-ia-global-do-master.md`, ponteiros M58+ em `docs/multi-empresa/{TASKS,PROGRESSO}.md`. Aceite: D1–D8 registradas.
- [ ] **T02 — Função no catálogo**: `src/lib/paginas-catalogo.ts` → `FUNCAO_IA_CARD_LEAD='iaCardLead'` + item em `FUNCOES_CATALOGO` (`titulo 'IA no card lead'`, `url '/funcao/ia-card-lead'`, descrição). Aceite: aparece em `/master/planos` → "Funções do CRM" e em EmpresaDetalhe → Páginas. Validação: `npx tsx --tsconfig tsconfig.app.json scripts/multi-empresa/check-catalogo.mjs`.
- [ ] **T03 — Migration nasce desligada [MIG]** `20261120100000_ia_card_lead_funcao.sql`: acrescenta `iaCardLead` a `plataforma_planos.paginas_bloqueadas` (modelo: `20261119100000_pontua_pagina.sql`) e `alter column paginas_bloqueadas set default '{iaCardLead}'` (D3).
- [ ] **T04 — Gating no modal**: `LeadModal.tsx` → `iaLiberada = usePaginaLiberada(FUNCAO_IA_CARD_LEAD)`; `showIa={iaLiberada}` ×2; `initialTab==='analise-ia' && !iaLiberada` cai em `'info'` (~:618-626) + efeito que tira de `analise-ia` se virar false; render da aba (~:2531) exige `iaLiberada`; handlers :628-655 ignoram `analise-ia` bloqueado.
- [ ] **T05 — Entradas externas**: `pages/Pipeline.tsx` (:217-239 descarta `tab=analise-ia` bloqueado), `CrmSelletosDock.tsx` (:99-107, :122-141 não monta ícone/popup), `LeadAIRenderBackgroundContext.tsx` (:143 e os `start*`: recusam com toast). Grep por `startRender|startEdit|startAmbiente|invokeRenderLead`.

### Fase B — Servidor recusa
- [ ] **T06 — Helper v1 + gate nas 3 edges [DEPLOY]**: novo `supabase/functions/_shared/ia-card-lead.ts` (`autorizarIaCardLead(req, recurso)` → identidade, `empresaStatus`, somente-leitura, `iaCardLead` bloqueado → `{status,code,error}`); usado em `render-lead-project`, `render-lead-ambiente`, `edit-lead-render`. Render conta como **escrita** (recusa em somente-leitura, inclusive `action:'analyze'`). Aceite: bloqueada → 403 `funcao_bloqueada`; master leitura → 403 (não 500).
- [ ] **T07 — `empresa_id` só do chamador [DEPLOY]**: diagnóstico read-only antes (contagens `crm.lead_ai_renders` × tabela legada `public."CRM-multi-empresas>lead_ai_renders<"`, `pipeline_lead_ai_config`, `marketing_medias`). Depois remover `isEmpresaSchema/resolveDb/*TableName`, usar `schema('crm')` + `.eq('empresa_id', ctx.empresaId)`, `storagePrefix=empresaId`, ignorar `body.empresaSchema`, validar `leadId` da empresa. Se o dado vivo estiver na tabela legada: parar e replanejar.

### Fase C — Motor global do master
- [ ] **T08 — Migration motor e segredo [MIG]** `20261120110000_ia_motor_global.sql` + bloco em `scripts/multi-empresa/test-plataforma.sql`:
  - `plataforma_ia_motor` (singleton: `ativo, render_ativo, render_ambiente_ativo, vision_model, image_model, 4 prompts (null=default do código), tokens_por_imagem_fixa`), policy `plataforma_master`.
  - `plataforma_ia_segredos (nome, valor, final4, …)` com RLS **sem policy** e `revoke all … from public, anon, authenticated` (só service role lê; só RPCs gravam).
  - RPCs `master_ia_motor_obter/salvar/salvar_chave/limpar_chave` (padrão `security definer set search_path=public,pg_temp` + `app_assert_master()` + revoke/grant). `obter` devolve só `chave_configurada/final4`.
  - Aceite: `select * from plataforma_ia_segredos` como authenticated (inclusive master) falha; não-master recebe 42501.
- [ ] **T09 — Tela do motor em `/master/modelos`**: tipos/hooks em `src/hooks/useMaster.ts` (`useMotorIa`, `useSalvarMotorIa`, `useSalvarChaveMotorIa`, `useLimparChaveMotorIa`); novo `src/master/components/ia/MotorIaPainel.tsx` (reuso de `AiApiKeyField`); `Modelos.tsx` ganha `Tabs` (`modelos` = atual; `ia` = "Motor de IA do card lead"): painéis Chave, Modelos (aviso dall-e-2), Renderização, Renderização com ambiente ("Restaurar padrão"). Aceite: chave salva nunca volta ao navegador (aba Rede).
- [ ] **T10 — Edges usam o motor global [DEPLOY]**: helper ganha `carregarMotor()` (lê motor+segredo via service role); 3 edges deixam de ler `pipeline_lead_ai_config`; `ALLOWED_*` saem das edges para `_shared/ia-card-lead-modelos.ts` ↔ `src/lib/ia-card-lead-modelos.ts` (par); erros OpenAI com chave/billing viram `motor_indisponivel` (log completo no servidor). **Pré-condição:** T09 em produção + chave cadastrada + relatório read-only por empresa (SQL em DESIGN) + liberações decididas.
- [ ] **T11 — Migration status para o front [MIG]** `20261120120000_ia_card_lead_status.sql`: RPC `app_ia_card_lead_status()` (`liberada, motor_pronto, render_ativo, render_ambiente_ativo`; sem modelo/prompt/chave/números).
- [ ] **T12 — `LeadAIRenderTab` lê o status**: novo `src/hooks/useIaCardLeadStatus.ts`; trocar `aiConfig.renderAtivo/renderAmbienteAtivo/apiKeyConfigured` (:850-928, :1139-1147, :1216-1277, :1297-1321) pelo status; `*-api.ts` (render-lead-project, edit-lead-render, render-lead-ambiente) mapeiam `data.code` para textos. Aceite: nenhuma menção a "chave", "Pipeline → Configurações", "Configurações IA".
- [ ] **T13 — Card de Configurações perde o bloco de render**: `PipelineLeadAISettingsCard.tsx` (remove :279-469), `usePipelineLeadAIConfig.ts` (tira `RENDER_FIELDS/RENDER_AMBIENTE_FIELDS`), `configuracoes-ia/index.tsx:95-97` (texto "orçamento com IA (markup)"), constantes de modelos de render → `src/lib/ia-card-lead-modelos.ts`.

### Fase D — Tokens
- [ ] **T14 — Migration uso, preços, limites, cota [MIG]** `20261120130000_ia_tokens.sql`: `plataforma_ia_uso` (empresa_id, user_id, funcao, etapa visao|imagem, modelo, lead_id, ref_id, tokens_entrada/saida/total, imagens, estimado, custo_usd, criado_em; índices; policy master só select), `plataforma_ia_precos` (seed zerado), `plataforma_planos.ia_tokens_limite_mensal bigint`, `plataforma_empresa_ia (empresa_id, modo plano|personalizado|sem_limite, tokens_limite_mensal)`, RPC `plataforma_ia_cota(empresa)` (service_role; motivos em ordem: `funcao_bloqueada`, `sem_plano` (D2), `cota_estourada`, ok; mês em America/Sao_Paulo), `plataforma_ia_registrar_uso(...)` (só service_role), RPCs master `master_ia_consumo_empresas/_empresa/uso_recente/salvar_limite_plano/salvar_limite_empresa/precos_salvar`. Concorrência: checa antes, registra depois (estouro marginal aceito, documentado). Testes SQL.
- [ ] **T15 — Edges medem e registram [DEPLOY]**: `_shared/openai-image-edit.ts` ganha `callOpenAIImageEditComUso/GenerateComUso` (antigas viram wrappers); `chatVisao()` unificado em `_shared/ia-card-lead.ts` (hoje duplicado em render-lead-project:268 e render-lead-ambiente:137); cada edge: `checarCota()` antes da 1ª chamada, `registrarUso()` após cada sucesso (nunca lança). gpt-image-* usa `usage` da resposta (conferir formato real e logar cru uma vez); dall-e-2 / sem usage = custo fixo, `estimado=true`. Aceite: um render = 2 linhas (visão+imagem); limite 1 → 2ª tentativa 429 sem chamar a OpenAI.
- [ ] **T16 — Master: limite e consumo**: `Planos.tsx` (campo "Limite mensal de tokens de IA", desabilitado se `iaCardLead` bloqueado no plano; `Plano` + `useSalvarPlano`/hook novo), `EmpresaDetalhe.tsx` nova aba `ia` ("IA e tokens": estado da função e origem, limite plano/personalizado/sem limite, `Numeros`, barras 6 meses com recharts, últimos usos, aviso "sem plano"), `Modelos.tsx` aba IA: "Consumo do mês" (tabela por empresa, seletor de mês) e "Preços por modelo".
- [ ] **T17 — Lead: aviso de cota [MIG]** `20261120140000_…`: `app_ia_card_lead_status` (drop+create) devolve `cota_estourada`; banner e botões desabilitados em `LeadAIRenderTab`; contexto de fundo trata 429 sem retry.

### Fase E — Remoção da Análise visual
- [ ] **T18 — Subaba some**: `lead-modal-nav.ts` (remove `ia-visual`; `LeadIaSubtab='render'`), `LeadAIAnalysisTab.tsx` renderiza só `LeadAIRenderTab`, `LeadModal.tsx:209` default `'render'`, `Pipeline.tsx` aceita `iaSubtab=visual` antigo como `render` **mantendo** a tripla `[leadIdFromUrl, tabFromUrl, iaSubtabFromUrl]` (`scripts/test-crm-lead-modal.mjs:128`), `LeadModalNav`/`lead-modal-search.ts:75`: com 1 item, clique vai direto à aba.
- [ ] **T19 — Apagar front exclusivo** (Grep de importadores = 0 antes de cada exclusão): componentes `LeadAIAnalysisVisualTab, LeadAIAnalysisReader, LeadAIAnalysisFullscreenDialog, LeadAIAnalysisThinkingState, LeadAIMediaGalleryFullscreenDialog, LeadAIRelatorioExportDialog, IncluirAnaliseNaApresentacaoDialog, LeadSkyChatPanel, LeadKnowledgeMemoryCard, LeadAIAnalysisMediaStrip` + arquivo solto `leadAIAnalysisFullscreenDialog.tsx` na raiz; hooks `useLeadSkyChat, useLeadKnowledgeIndexControl, useAutoIndexLeadKnowledge`; libs `iris-sky-agent, iris-spot-session, iris-spot-vision, lead-knowledge-index-client, analyze-lead-photos-api, lead-ai-relatorio-pdf-export`; `LeadAIAnalysisBackgroundContext.tsx` + provider em `CrmSelletosProviders.tsx:5,21,33`; ramo `analysis` de `LeadAIAnalysisBackgroundPopup.tsx` (checar `scripts/test-ambiente-draw-colors.mjs:17-19`). **Manter** `useLeadAIAnalyses`, `lead-ai-formatted-content`, `lead-ai-relatorio-markdown`, `lead-ai-media-*`, `pdf-image-cache`, `lead-ai-analysis-media-utils.tsx`.
- [ ] **T20 — Pontas soltas**: remover `bumpLeadKnowledgeReindex` (`useLeadPDFs.ts:211`, `useLeadProjetos.ts:650,1181`, `lead-projeto-chat.ts:226`) e `lib/lead-knowledge-reindex.ts`; `useCrmComunicacao.ts:178-208` sem chamada a `analyze-lead-photos` (D8; ajustar `test-crm-lead-modal.mjs` se exigir); `PipelineLeadAISettingsCard.tsx` perde blocos Análise visual/Íris Sky (se esvaziar, remover montagem em `PipelineSettings.tsx:278` e o arquivo); `usePipelineLeadAIConfig.ts` tira `IRIS_SKY_FIELDS/system_prompt/briefing_prompt` dos selects.
- [ ] **T21 — Edges da Análise visual [DEPLOY]**: `compose-markup-ia/index.ts:1751` novo texto (D1) + redeploy; apagar `analyze-lead-photos`, `chat-iris-sky`, `index-lead-knowledge`, `_shared/iris-sky-prompts.ts`; limpar `supabase/config.toml` (~26, 32, 65), `scripts/build-deploy-payload.mjs:14-27`, `.deploy-payloads/*`. Remoção das 3 funções no projeto Supabase só com OK separado e logs sem chamadas desde T19. **Manter** `_shared/lead-knowledge.ts`.

### Fase F — Chave da empresa só-escrita (recomendada; adiável)
- [ ] **T22 — [MIG]** `20261120150000_…`: diagnóstico de `pg_policies`/`column_privileges` de `crm.pipeline_lead_ai_config` (as policies `me_pipeline_lead_ai_config_admin_*` não estão nas migrations); RPC `empresa_ia_salvar_chave(p_tipo, p_chave)` (admin, `app_assert_escrita_permitida()`); `revoke select, update` + `grant` por coluna sem as chaves; front usa flags `*_configured` da view pública e a RPC (`usePipelineLeadAIConfig.ts:171-176,197-198,426-494`). Grep por `select *` na tabela antes.

### Fase G — Destrutivo, isolado, em dois tempos
- [ ] **T23 — Relatório e quarentena [MIG]**: contagens por empresa + backup `pg_dump --table` local (fora do repo); migration `20261120160000_…` renomeia `crm.lead_ai_chat_messages` → `zz_remover_lead_ai_chat_messages` (e a gêmea legada, se sem uso); observar ~7 dias.
- [ ] **T24 — DROP definitivo [DROP][MIG]** só com confirmação explícita, listando o que cai e o que quebraria: `zz_remover_*`; `iris_sky_*` e `briefing_prompt` (view `_public` recriada); `render_*`/`render_ambiente_*` (perde prompts customizados antigos — exportar antes); `system_prompt`/`model` só após Grep zerado.

### Fase H — Fechamento e reparo visual
- [ ] **T25 — Docs finais**: `CLAUDE.md` (linha "Páginas por empresa" + `iaCardLead`; última migration; chaves de IA: render usa motor global em `/master/modelos`), `docs/structure.md`, `docs/multi-empresa/DESIGN.md` §12, `PROGRESSO.md`.
- [ ] **T26 — `/reparo-visual` etapa 1: auditoria** (sem código) do modal em 1440/1024/390 px, IA ligada e desligada.
- [ ] **T27 — etapa 2: estética** (tokens, tipografia, estados; sem mexer em estrutura).
- [ ] **T28 — etapa 3: layout/painéis** (aba IA agora de conteúdo único: cabeçalho com estado do motor/cota; reorganizar painéis do modal).
- [ ] **T29 — etapa 4: animações** (transição de abas, estado "pensando", `prefers-reduced-motion`).
  Arquivos prováveis: `LeadModal.tsx`, `LeadModalNav.tsx`, `LeadModalSearch.tsx`, `lead-modal-nav.ts`, `LeadAIRenderTab.tsx`, `LeadAIRender{HistoryPanel,ThinkingState,Compare}.tsx`, `LeadAIAnalysisBackgroundPopup.tsx`, `LeadPDFAttachments.tsx`. Regra: nenhuma mudança de lógica/gating/dados; aprovação entre etapas; `test-crm-lead-modal.mjs` e `check-paginas-visiveis.mjs` passam ao fim de cada uma.

## Textos para a empresa (sem "chave", "OpenAI", "token" ou modelo)
`funcao_bloqueada`/`sem_plano`: "A IA no card do lead não está liberada no plano da sua empresa. Fale com o suporte para ativar." · `cota_estourada`: "O limite mensal de uso da IA foi atingido. A renderização volta a funcionar no dia 1º ou após ajuste do plano." · `motor_indisponivel`: "A renderização por IA está temporariamente indisponível. Tente novamente mais tarde." · `recurso_desativado`: "Este tipo de renderização não está disponível no momento." · somente leitura: `MSG_SOMENTE_LEITURA`.

## Riscos e ordem
- Ordem de deploy: migration → edges → front. Sequência crítica: **T08 → T09 → dono cadastra chave/modelos → relatório por empresa e liberações → T10** (inverter deixa empresas liberadas sem render).
- Mudança só aparece após recarregar a página da empresa (`app_minha_empresa` lido uma vez); o servidor é a fonte de verdade.
- Preços zerados → custo estimado 0 até o master preencher. Estouro marginal de cota por concorrência.
- Dado vivo em tabela legada de `public` (T07) pode replanejar a fase B.
- `tsc` do `pnpm build` não checa tipos (usar `tsconfig.app.json`); "eslint falhou" do hook é ruído.

## Fora de escopo
Corrigir `emp_*`×`crm` em `compose-markup-ia`/`compose-contrato-ia`/demais edges; cota/medição de markup, contratos e Orçamentos IA; migrar dados das tabelas legadas; cobrança por excedente; outros provedores; realtime de `paginas_bloqueadas`; mobile nativo; commit/push.

## Verificação ponta a ponta
1. Scripts: `check-catalogo.mjs`, `check-paginas-visiveis.mjs` (estendidos p/ `iaCardLead`), `test-crm-lead-modal.mjs`, `test-ambiente-draw-colors.mjs`, `test-plataforma.sql` (segredo ilegível, RPCs master, cota em todos os casos, registrar_uso recusado a authenticated, status sem vazamento), `test-isolamento.mjs`, novo `scripts/ia-lead/test-ia-card-lead-api.mjs` (403 bloqueada, 503 sem motor, 429 na 2ª com limite 1).
2. Manual: master liga a função num plano, define limite, cadastra motor → usuário recarrega, abre lead, usa render/edição/ambiente → master vê consumo → baixa limite e vê o banner → desliga a função (aba some; URL direta cai em "info") → inspeção somente leitura devolve 403 limpo.
