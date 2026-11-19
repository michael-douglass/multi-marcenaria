# Modelo de contrato pré-cadastrado — Tarefas

> Modo pair-to-peer: **uma tarefa por vez**, com relatório ao concluir cada uma.
> Requisitos: [`REQUIREMENTS.md`](./REQUIREMENTS.md) · Design: [`DESIGN.md`](./DESIGN.md).
> Verificação base de toda tarefa: `pnpm build` sem erros. Não confundir com `docs/TASKS.md` (outro trabalho).

---

## C01 — Docs e consulta de leitura ao banco

- [x] **C01** — concluída em 2026-11-18.
  - **Resumo:** criados `REQUIREMENTS.md`, `DESIGN.md` e este `TASKS.md`. Texto do modelo lido do banco antigo (só `SELECT`) e generalizado no DESIGN §9.
  - **Consulta (banco novo, read-only):** 1 empresa (Garbo) com 0 modelos e 1 variável (`cpf`); nenhuma duplicata `(empresa_id, nome)`; check de tipo = `contratos_variaveis_tipo_check`; `app_minha_empresa()` retorna `TABLE(...)` com 22 colunas; `empresa_atualizar_dados(jsonb)` retorna `void`. Detalhes no DESIGN §2.
  - **Achados:** a lista de campos do plano tem 17 itens, não 18 (DESIGN §3). A Garbo não tem modelo no banco novo, então o backfill vai semear o padrão nela.
- **Objetivo:** registrar requisitos, desenho e tarefas, e levantar o estado do banco antes da migration.
- **Arquivos:** `docs/contrato-padrao/REQUIREMENTS.md`, `DESIGN.md`, `TASKS.md` (novos).
- **Critérios de aceite:** DESIGN com o texto completo generalizado, tabela dos campos, sintaxe `{{#se}}`, calculadas, `empresa_*` novas, riscos e "Estado atual do banco". Texto sem "Garbo", "58.838.942", "Fábio", "Boa Esperança" nem telefone fixo.
- **Validação:** `q.mjs` sem `--write`; `grep` das palavras proibidas no texto.

## C02 — Migration do contrato padrão

- [x] **C02** — concluída: migration aplicada; `test-plataforma.sql` T37–T41 ok (T36 reescrito: a Garbo agora tem plano próprio).
- **Objetivo:** representante legal na empresa, `valor_padrao` e tipos novos nos campos, `unique (empresa_id, nome)`, seed do contrato padrão em toda empresa nova e backfill.
- **Arquivos:** `supabase/migrations/20261118130000_contrato_padrao.sql` (novo), `scripts/multi-empresa/test-plataforma.sql`.
- **Critérios de aceite:**
  - colunas `representante_nome`, `representante_cpf`, `representante_qualificacao` na tabela de empresas;
  - `app_minha_empresa()` devolve as 22 colunas atuais na mesma ordem + as 3 novas; definer, `search_path`, execute só para `authenticated` (fora `service_role`/`app_tenant_definer` herdados);
  - `empresa_atualizar_dados` grava o representante e recusa CPF inválido;
  - `crm.contratos_variaveis.valor_padrao`; check aceita `numero` e `sim_nao`; `unique (empresa_id, nome)`;
  - `crm_seed_contrato_padrao` sem execute para public/anon/authenticated; só age em empresa sem modelo; idempotente;
  - `plataforma_seed_empresa` = corpo de `20261118110000` + o seed novo;
  - backfill: toda empresa sem modelo fica com 1 modelo ativo e os 17 campos.
- **Validação:** host do `DATABASE_URL` contém `vejugdspjfgfajdpfiht`; `pnpm migrate`; `node --env-file=.env scripts/multi-empresa/q.mjs --write -f scripts/multi-empresa/test-plataforma.sql` (rollback); consulta de leitura pós-backfill.

## C03 — Representante legal no Perfil

- [x] **C03** — concluída: bloco "Representante legal" no `EmpresaDadosForm`; `empresa_cidade_uf` + `empresa_representante_*`.
- **Objetivo:** expor e editar o representante legal; novas variáveis `empresa_*`.
- **Arquivos:** `src/hooks/useEmpresaAtiva.ts`, `src/contexts/EmpresaContext.tsx`, `src/lib/empresa-identidade.ts`, `src/hooks/useEmpresaBranding.ts`, `src/components/admin/EmpresaDadosForm.tsx`, `src/lib/contratos-print.ts`.
- **Critérios de aceite:**
  - `EmpresaAtiva` com `representanteNome`, `representanteCpf`, `representanteQualificacao`;
  - `EmpresaIdentidade` com `representanteNome`, `representanteCpfFormatado`, `representanteQualificacao`, `cidadeUf`;
  - `EmpresaDadosForm` com o bloco "Representante legal (aparece nos contratos)": nome, CPF com máscara e validação, qualificação;
  - `VARIAVEIS_EMPRESA` com `empresa_cidade_uf` e `empresa_representante_{nome,cpf,qualificacao}`.
- **Validação:** `pnpm build`.

## C04 — Motor de variáveis e par TS do modelo

- [x] **C04** — concluída: `contrato-variaveis.ts`, `contrato-padrao.ts`, `numeroPorExtenso`; `scripts/test-contrato-padrao.mjs` 99 checagens ok.
- **Objetivo:** blocos `{{#se}}`, calculadas, valores padrão; texto e campos do modelo em TS; teste automatizado.
- **Arquivos:** `src/lib/contrato-variaveis.ts`, `src/lib/contrato-padrao.ts` (novos), `src/lib/valor-monetario-extenso.ts` + `supabase/functions/_shared/valor-monetario-extenso.ts` (`numeroPorExtenso`), `src/lib/contrato-rascunho.ts`, `src/hooks/useContratosVariaveis.ts`, `scripts/test-contrato-padrao.mjs` (novo).
- **Critérios de aceite:**
  - nenhum `{{…}}` sobra no modelo padrão preenchido;
  - nenhum "Garbo", "58.838.942" ou "Fábio";
  - 60/40 de R$ 10.000,00 = R$ 6.000,00 e R$ 4.000,00, com os textos por extenso certos; 50% muda os dois;
  - `incluir_clausula_imagem = nao` remove o 4.4 sem deixar linha vazia;
  - o padrão `{{empresa_cnpj}}` da chave PIX resolve;
  - o texto do `.ts` é igual ao da migration.
- **Validação:** `pnpm build`; `npx tsx --tsconfig tsconfig.app.json scripts/test-contrato-padrao.mjs`.

## C05 — Telas de Configurações e Novo contrato

- [x] **C05** — concluída: valor padrão, tipos Número e Sim/Não, só campos do modelo, painel "Calculado automaticamente", aviso de dados da empresa faltando, botão "Modelo padrão".
- **Objetivo:** valor padrão e tipos novos no editor; formulário só com os campos do modelo; calculadas em leitura; Switch; "Restaurar modelo padrão".
- **Arquivos:** `src/pages/contratos/ContratosConfigPage.tsx`, `src/pages/contratos/NovoContratoPage.tsx`, `src/hooks/useContratosModelo.ts`, `src/hooks/useContratosVariaveis.ts`.
- **Critérios de aceite:**
  - dialog de campo com "Valor padrão" e tipos Número e Sim/Não; lista mostra o padrão;
  - painel de variáveis com "Calculadas automaticamente" e a dica do `{{#se …}}`; nomes reservados recusados;
  - contrato novo: campos vazios pré-preenchidos com o padrão; Sim/Não vira Switch; só campos usados no modelo (mais o CPF fixo); obrigatórios só dos exibidos; calculadas em leitura;
  - modelos antigos continuam com `sugerirCamposPorExtenso`;
  - sem modelos: botão "Restaurar modelo padrão".
- **Validação:** `pnpm build`.

## C06 — IA, legado, docs e roteiro de verificação

- [x] **C06** — concluída: IA recebe número/Sim-Não como texto (sem deploy); legado `src/pages/crm/ContratosPage.tsx` fora de rota (não alterado); docs atualizados. Verificação no navegador fica com o usuário.
- **Objetivo:** conferir `compose-contrato-ia` e a tela legada; atualizar `CLAUDE.md` e `docs/structure.md`; advisors de segurança; roteiro do navegador.
- **Arquivos:** `supabase/functions/compose-contrato-ia/index.ts` (se precisar), `src/lib/crm-contratos.ts` (se a rota legada existir), `CLAUDE.md`, `docs/structure.md`.
- **Critérios de aceite:** a IA preserva `{{…}}` e `{{#se}}` (prompt alterado sem deploy, se preciso); legado espelhado ou anotado; docs atualizados; advisors sem aviso novo.
- **Validação:** `pnpm build`; `get_advisors` (security); roteiro manual do navegador para o usuário.
