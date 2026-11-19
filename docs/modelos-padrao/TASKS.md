# Modelos padrão do master — Tarefas

> Modo pair-to-peer: **uma tarefa por vez**: diagnóstico → OK → implementa → valida → `[x]` → relatório → OK.
> Requisitos: [`REQUIREMENTS.md`](./REQUIREMENTS.md) · Design: [`DESIGN.md`](./DESIGN.md).
> Não confundir com `docs/TASKS.md` (outro trabalho).
>
> **Validação base:**
> - `pnpm exec tsc --noEmit -p tsconfig.app.json`: erros antigos são reportados, não escondidos.
> - Banco: `node --env-file=.env scripts/multi-empresa/q.mjs --write -f scripts/multi-empresa/test-plataforma.sql` (sempre rollback; blocos novos a partir de T42).
> - Migration só com OK do humano (`pnpm migrate`).

---

## T01 — Docs e levantamento

- [x] **T01**: concluída em 2026-11-18.
  - REQUIREMENTS, DESIGN, TASKS e ADR 0005 criados.
  - Levantamento somente leitura nos dois bancos (DESIGN §1): os dados de markup e slides da Garbo **só existem no banco antigo**, e 6 imagens dos blocos de slide estão no storage antigo.
- **Validação:** consultas `q.mjs` sem `--write` (novo) e conexão com `default_transaction_read_only=on` (antigo).

## T02 — Isolar `compose-markup-ia` por empresa

- [x] **T02** — concluída: 8 consultas com `.eq('empresa_id', empresaId)` (serviços, despesas, parâmetros, produtos, categorias, config IA do pipeline, config IA do markup) + checagem de que o lead é da empresa (protege análises e base de conhecimento); recusa usuário sem empresa. `_shared` não consulta o banco. Deno não instalado — sem `deno check`. **Pendente: deploy** (`supabase functions deploy compose-markup-ia`).
- **Objetivo:** toda leitura feita com service role em `supabase/functions/compose-markup-ia/index.ts` filtra `empresa_id` (catálogo, config, serviços, despesas, `pipeline_lead_ai_config`). Conferir os pares em `_shared`.
- **Aceite:** nenhuma consulta a tabela de tenant sem `.eq('empresa_id', …)`; `deno check` ou typecheck sem erro novo.
- **Validação:** `grep` das consultas; `test-isolamento.mjs`. Avisar que precisa de deploy.

## T03 — Trazer os dados da Garbo do banco antigo

- [x] **T03** — concluída: `scripts/modelos-padrao/importar-empresa-antiga.mjs` (ensaio → execução → reensaio com 0 inseridas). Garbo no novo: 5 categorias, 244 produtos, config, 6 despesas, 13 serviços, 4 regras, 1 template, 11 blocos, 9 perguntas, 43 opções, 3 formas, 4 contratos antigos (ativo = "Contrto sem e-mail", o padrão semeado ficou inativo), +11 campos. 6 imagens copiadas para `orcamento-slides` do novo com dono = usuário da Garbo; HEAD 200; 0 URLs antigas.
- **Objetivo:** copiar do `emp_garbo` antigo para a Garbo no banco novo:
  - as 6 tabelas de markup;
  - as 7 de slides;
  - os modelos de contrato que faltam;
  - as 6 imagens do storage antigo para o bucket `orcamento-slides` novo, reescrevendo as URLs.
- **Aceite:** as contagens batem com o DESIGN §1; nenhuma URL `zzqgtclvuetemzhqzhbq` restante; o antigo é aberto só em leitura.
- **Validação:** ensaio (`--dry-run`, ROLLBACK) → OK humano → execução; contagens; telas `/markup` e `/orcamento-slides` da Garbo abrindo com os dados.

## T04 — Migration: empresa-modelo e catálogo

- [x] **T04** — concluída: `20261118140000_modelos_padrao_catalogo.sql` aplicada (`e_modelo`/`segmento`, 3 tabelas com RLS master, resumo/faturamento/lista sem modelos, `master_listar_empresas_modelo`). Testes T42, T44.
- **Objetivo:** `e_modelo`/`segmento`, `plataforma_modelos`, `plataforma_plano_modelos`, `plataforma_modelo_entregas` com RLS master; listas do master sem empresas-modelo.
- **Validação:** testes T42+ (não-master não lê; empresa-modelo fora do resumo e do faturamento).

## T05 — `plataforma_copiar_markup`

- [x] **T05** — concluída: `20261118140100_modelos_padrao_copiar_markup.sql`. Teste T43 (ids remapeados, timbrado nulo), T47 (reenvio 0 produtos), T48 (edição isolada).
- **Aceite:** ids de categoria remapeados; reenvio não duplica; editar o destino não muda a origem; `timbrado_url` nulo; `markup_config` não duplicada.

## T06 — `plataforma_copiar_slides`

- [x] **T06** — concluída: `20261118140200_modelos_padrao_copiar_slides.sql`. T43 (template sem marca, blocos/opções na própria empresa), T46 (formas de pagamento), T47 (reenvio 0 blocos/opções).
- **Aceite:** template sem logo e fundo; blocos ligados ao template novo; opções remapeadas; formas de pagamento copiadas; `orcamento_publico_obter` do destino usa o template copiado; reenvio não duplica.

## T07 — `plataforma_copiar_contrato`

- [x] **T07** — concluída: `20261118140300_modelos_padrao_copiar_contrato.sql`. T43 (ativo = ativo da origem), T46 (contrato padrão não duplica), T47 ("(v2)" inativo), T48.
- **Aceite:** variáveis citadas garantidas sem alterar as existentes; "(v2)" no reenvio; nunca dois modelos ativos.

## T08 — Orquestração e RPCs do master

- [x] **T08** — concluída: `20261118140400_modelos_padrao_orquestracao.sql` (+ `master_atualizar_empresa_modelo`, `master_listar_modelos`, `master_listar_entregas`). T42 (não-master recusado), T46, T49, T50. `test-plataforma.sql` inteiro passa; T41 ajustado (Garbo agora tem vários contratos); `q.mjs` passa a imprimir os NOTICE.
- **Objetivo:** `plataforma_aplicar_modelo`, entregas, `master_criar_empresa_modelo` (importa de uma empresa), `master_sincronizar_modelos`, `master_publicar_modelo`, `master_salvar_modelos_plano`, `master_enviar_modelo`; modelos do plano aplicados em `master_criar_empresa`.
- **Aceite:** não-master recusado em toda RPC; empresa criada com plano recebe os modelos publicados; contrato padrão não duplica.

## T09 — `/master/modelos`: empresas-modelo

- [x] **T09** — concluída: hooks em `useMaster.ts` (seção modelos padrão); `src/master/pages/Modelos.tsx` + item "Modelos padrão" no menu e rota; `NovaEmpresaModeloDialog` (começa com os dados da Garbo); "Entrar para editar" reaproveita `EntrarEmpresaDialog` (novo `modoInicial`/`destino`; `trocarEmpresa` aceita destino interno). Typecheck: 0 erros novos (209 antigos).
- **Objetivo:** hooks em `useMaster.ts`, página e menu; listar e criar empresa-modelo (com "importar da Garbo"); "Entrar para editar".
- **Validação:** typecheck; navegador.

## T10 — `/master/modelos`: catálogo e publicação

- [x] **T10** — concluída: lista por empresa-modelo com contagens (`descreverContagem`), contratos um a um, chave Publicar/Rascunho, "Editar" abre direto a tela do tipo. A sincronização roda dentro de `master_listar_modelos`.
- **Objetivo:** cartões por tipo com contagens; contratos um a um; chave Publicar; botão sincronizar.

## T11 — Enviar para empresas e histórico

- [x] **T11** — concluída: `EnviarModeloDialog` (busca, seleção, resultado por empresa) + tabela de entregas na página.
- **Objetivo:** diálogo "Enviar para…" com resumo; tabela de entregas.

## T12 — Modelos do plano em `/master/planos`

- [x] **T12** — concluída: `ModelosDoPlano` acima do `PaginasEditor` em `/master/planos` (despublicado marcado como "não será entregue").
- **Objetivo:** painel com checkboxes dos modelos publicados ao lado do `PaginasEditor`.

## T13 — Migration `crm.apresentacao_conteudo`

- [x] **T13** — concluída: `20261118140500_apresentacao_conteudo.sql` (tabela com trigger, isolamento, leitura do master, papéis; `apresentacao_publica(slug)`; seed da Garbo gerado por `scripts/modelos-padrao/gerar-seed-apresentacao.mjs`). Testes T53–T55.
- **Objetivo:** tabela de tenant com policies completas; RPC pública por slug; seed da Garbo a partir das constantes atuais.
- **Validação:** testes de isolamento e de leitura do master; `apresentacao_publica('garbo')`.

## T14 — Apresentação lendo do banco

- [x] **T14** — concluída: `apresentacao-conteudo.ts` (Garbo, neutro, mescla, `{empresa}`), `ApresentacaoConteudoContext`, `useApresentacaoConteudo`; todas as seções leem do contexto; formulário de parceria usa a empresa do conteúdo (bug da Garbo fixa corrigido) e não envia na prévia; Instagram some sem feed; rota `/apresentacao/:slug`. Conferência visual pendente (precisa login).
- **Objetivo:** hook `useApresentacaoConteudo` com fallback; strings "Garbo" do JSX viram campos; formulário de parceria com a empresa correta; rota `/apresentacao/:slug`.
- **Validação:** a Garbo fica visualmente idêntica (navegador); uma empresa de teste mostra os próprios dados.

## T15 — Editor da apresentação com prévia

- [x] **T15** — concluída: `ApresentacaoEditorPage` em `/marketing/apresentacao-interna/editar` (abas Capa, Seções, Fechamento, Projetos, Contato, Pontua; upload em `marketing-medias/apresentacao/<empresa>/`; prévia ao vivo com `transform` para conter os elementos fixos).
- **Objetivo:** `/marketing/apresentacao-interna/editar`: formulário + prévia ao vivo + upload.

## T16 — Pontua editável

- [x] **T16** — concluída: aba Pontua (abertura, selo, parceiro de exemplo, passos) + `PontuaPercentualPadrao` (comissão real em `config_pontua_garbo`).
- **Objetivo:** texto e demonstração em `pontua jsonb`; percentual padrão; aba no editor.

## T17 — Cópia de apresentação e Pontua

- [x] **T17** — concluída: `20261118140600_modelos_padrao_copiar_apresentacao.sql` (`plataforma_copiar_apresentacao`/`_pontua`, catálogo com 5 tipos, contagem `configurado`, empresa-modelo importa os dois). Testes T51–T55; suíte T1–T55 passa.
- **Objetivo:** `plataforma_copiar_apresentacao` e `_pontua`; tipos no catálogo do master; testes.

## T18 — Ponta a ponta e docs

- [x] **T18** — concluída: testes automáticos (`test-modelos-api.mjs` 20/20, `test-isolamento.mjs` 27/27, `test-plataforma.sql` até T57, build, catálogo); empresa-modelo "Marcenaria" criada pelo master; páginas conferidas no navegador. **Pendente só o deploy** da `compose-markup-ia` (e das functions da marca neutra, ver `docs/marca-neutra/TASKS.md`).
- **Objetivo:**
  - `test-isolamento.mjs`: plano com modelos → empresa nova recebe → edita a cópia → modelo e Garbo intactos;
  - passeio no navegador;
  - `CLAUDE.md` e `docs/structure.md` atualizados.
