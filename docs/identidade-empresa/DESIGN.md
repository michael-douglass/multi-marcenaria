# Identidade da marcenaria — Design técnico

> Requisitos em [`REQUIREMENTS.md`](./REQUIREMENTS.md); tarefas em [`TASKS.md`](./TASKS.md).
> Contexto multi-empresa: `docs/multi-empresa/DESIGN.md` §1.1 e ADRs 0003/0004.

## 1. O que já existe (reaproveitar)

| Peça | Onde |
|---|---|
| Tabela da empresa (plataforma, sem `empresa_id`/`tenant_isolamento`) | `public."CRM-multi-empresas>empresas<"` — `supabase/baseline/000_baseline_schema.sql:19888`. Já tem `nome`, `logo_url`, `cor_primaria`, `cnpj`, `razao_social`. **Sem** endereço/telefone/e-mail. |
| RPC da empresa ativa | `app_minha_empresa()` — versão atual em `supabase/migrations/20261118100100_master_inspecao.sql:121-143` |
| Front da empresa ativa | `src/hooks/useEmpresaAtiva.ts` (`EmpresaAtiva`, `mapEmpresa`), `useApp().empresa`, `src/contexts/EmpresaContext.tsx` (`useEmpresa`/`useEmpresaOptional`) |
| Storage da logo | bucket público `empresa-branding`, isolado por `tenant_isolamento_storage` |
| Upload/branding | `src/hooks/useEmpresaBranding.ts` (`uploadLogo`, `salvarBranding`, `removerLogo`), `EmpresaBrandingForm.tsx` |
| CNPJ (máscara) | `src/pages/admin/ConfiguracaoMarca.tsx` (`formatCNPJ`) |
| BrasilAPI no front | `src/lib/geocoding.ts:152` (CEP, fetch direto com CORS) |
| Fallbacks de marca | `src/lib/app-branding.ts` (`resolveBrandLogo`, `resolveBrandName`) |
| Policies de UPDATE na empresa | `me_empresas_admin_update_branding` (admin CRM), `me_empresas_contratos_timbrado_update` (admin **e vendedor**), `me_empresas_super_admin_all` (master, FOR ALL) |
| RPC da página pública | `orcamento_publico_obter(p_id)` — `supabase/migrations/20261117150200_multi_empresa_orcamento_publico.sql` |

## 2. Banco — migration `20261118120000_empresa_dados_cadastrais.sql`

1. Colunas novas em `"CRM-multi-empresas>empresas<"` (todas `text` nullable): `cep, logradouro, numero, complemento, bairro, cidade, uf, telefone, email`.
2. Normalização do CNPJ: `update … set cnpj = nullif(regexp_replace(cnpj, '\D', '', 'g'), '')`. Trigger `BEFORE INSERT OR UPDATE OF cnpj` mantém só dígitos para qualquer escritor (front, console master, `plataforma_criar_empresa`/`plataforma_atualizar_empresa`).
3. `app_minha_empresa()`: `drop` + `create` (o tipo de retorno muda). Mantém as 13 colunas atuais na mesma ordem e acrescenta as novas no fim. Mesmos atributos: `language sql stable security definer set search_path = public, pg_temp`, owner `postgres` (padrão do runner), `revoke … from public, anon` + `grant execute … to authenticated`.
4. `orcamento_publico_obter(p_id)`: `create or replace` (assinatura e retorno `jsonb` iguais, grants preservados) com a chave nova `'empresa'`: `{nome, razao_social, cnpj, logo_url, telefone, email, cidade, uf}` — filtrada pelo `empresa_id` do próprio orçamento.
5. Somente leitura do master: a tabela de empresas não tem `tenant_isolamento`, então o laço de `master_inspecao.sql` §6 **não** criou `tenant_master_leitura_*` nela, e `me_empresas_super_admin_all` permite ao master atualizar a empresa inspecionada. A migration adiciona uma policy RESTRICTIVE de UPDATE que recusa a escrita na empresa em inspeção quando o modo é somente leitura (RNF02).

Aplicação manual (`pnpm migrate`), só com autorização do usuário.

### 2.1 Escrita por RPC — `20261118120100_empresa_atualizar_dados.sql`

Achado da T01: todo `UPDATE` direto de `authenticated` na tabela de empresas falha com `infinite recursion detected in policy`. A causa é a `me_empresas_contratos_timbrado_update`, que faz join com a própria tabela. Além disso, `me_empresas_admin_update_branding` depende de `"CRM-multi-empresas>user_roles<"`, que está vazia. Decisão do usuário (opção A): gravar por RPC, **sem mexer nas policies antigas**. A recursão continua existindo e a correção entra na TS01.

- `empresa_atualizar_dados(p_dados jsonb) returns void`, com `security definer`, owner `postgres` e `search_path = public, pg_temp`. Execute só para `authenticated`.
- Empresa = `app_empresa_atual()`. Quem pode chamar: admin do CRM da empresa (`crm.user_roles` com `role = 'admin'` e o mesmo `empresa_id`) ou o master em inspeção com acesso total. Chama `app_assert_escrita_permitida()` antes de qualquer coisa.
- Colunas aceitas: `nome, razao_social, cnpj, cep, logradouro, numero, complemento, bairro, cidade, uf, telefone, email, logo_url, cor_primaria`. Chave fora dessa lista gera erro.
- Só as chaves presentes são gravadas. String vazia vira NULL, exceto `nome`, que é mantido. Também valida CNPJ com 14 dígitos e UF com 2 letras, e atualiza `atualizado_em`.
- Front: `atualizarDadosEmpresa()` em `useEmpresaBranding.ts`, usado por `salvarBranding`, `removerLogo`, `salvarDadosEmpresa`, `useContratosEmpresaConfig` e pelo CNPJ de `/admin/marca`. Só grava a empresa ativa: `GerenciamentoEmpresas` (tela antiga do master) não edita mais outra empresa por esse formulário.
- Os banners do prestador (`usePrestadorBanner*`) ainda fazem UPDATE direto e continuam quebrados pela mesma recursão. Ficam fora do escopo (TS01).

## 3. Front — núcleo dos dados

- `src/lib/empresa-identidade.ts` (novo): `somenteDigitos`, `formatCnpj`, `cnpjValido` (dígitos verificadores), `formatEnderecoEmpresa(e)`, `nomePrograma(nome) => \`Pontua ${resolveBrandName(nome)}\``.
- `src/lib/cnpj-receita.ts` (novo): `consultarCnpjReceita(cnpj): Promise<DadosReceita | null>` — BrasilAPI `https://brasilapi.com.br/api/cnpj/v1/{14}` com timeout (AbortController) e fallback `https://publica.cnpj.ws/cnpj/{14}`. Mapeia `razao_social`, `nome_fantasia`, `cep`, `logradouro` (prefixado por `descricao_tipo_de_logradouro`), `numero`, `complemento`, `bairro`, `municipio`, `uf`, `ddd_telefone_1`, `email`, `descricao_situacao_cadastral`.
- `EmpresaAtiva` (`useEmpresaAtiva.ts`) e `Empresa` (`EmpresaContext.tsx`): campos novos.
- `src/hooks/useEmpresaIdentidade.ts` (novo): `{ nomeFantasia, razaoSocial, cnpjFormatado, cnpjDigitos, logoUrl, endereco, telefone, email, nomePrograma }`, lido de `useEmpresaOptional()` com fallbacks. **Fonte única** para telas e PDFs.
- `useEmpresaBranding.ts`: corrige B1 (`trocarEmpresa` → `recarregarEmpresa`), exporta `uploadLogo`, nova mutation `salvarDadosEmpresa` (CNPJ em dígitos, razão social, nome, endereço, telefone, e-mail) seguida de `recarregarEmpresa()`.

## 4. Front — tela

- `src/components/admin/EmpresaDadosForm.tsx` (novo), 3 blocos: **Logo** (lógica de `EmpresaBrandingForm`), **CNPJ** (máscara; consulta automática com debounce ao ter 14 dígitos válidos; spinner; botão "Buscar na Receita"; aviso se situação ≠ ATIVA; erro → toast), **Dados cadastrais**. Botão único "Salvar dados da empresa".
- `src/pages/Profile.tsx`: seção "Dados da empresa" só se `isCrmAdmin(crmProfile)` / `hasRole('admin')`, no visual atual (ProfileAura, tons dourados).
- `src/pages/admin/ConfiguracaoMarca.tsx`: cards "Identidade visual" e "Timbrado" → `EmpresaDadosForm`; gate por `hasRole('admin')`; banner do prestador mantido.
- `ContratosConfigPage.tsx` ("Dados da contratada"): leitura + link "Editar em Perfil".

## 5. Front — consumo

- **Logo:** `src/components/Logo.tsx` lê `useApp().empresa?.logoUrl` → `resolveBrandLogo`; `alt` = nome fantasia; `onError` volta para a logo padrão.
- **Slides:** `EmpresaDadosLegais.tsx` aceita prop `empresa` (do RPC público) além do contexto; `OrcamentoPublicoPage` passa `data.empresa`; `orcamento-slide-export-cache.ts` inclui CNPJ, razão social e logo no fingerprint.
- **Contratos:** `formatCnpj` em cabeçalho/assinatura; variáveis `{{empresa_*}}` em `substituirVariaveis` (`contratos-print.ts`), listadas no editor (`ContratosConfigPage.tsx:326`) e excluídas do formulário de `NovoContratoPage`. `compose-contrato-ia/index.ts` busca o nome com `serviceClient(await empresaDoChamador(req))` filtrando por `id`.
- **PDFs:** funções recebem `empresa` (nome, razão social, CNPJ, logo) por parâmetro, passado pelo componente via `useEmpresaIdentidade`. Prioridade config própria → empresa → genérico. REP/AFD com `somenteDigitos`. `RepConfigPanel.tsx:11`: padrão de `razao_social` vem da empresa.
- **Pontua:** menu estático (`app-navigation.ts:592`) vira rótulo "Pontua" com substituição dinâmica no `AppSidebar`/busca para o item `pontuaGarbo`. Valores gravados (`'Pontua Garbo'`) mapeados só na exibição: `rótulo = valor === 'Pontua Garbo' ? nomePrograma : valor`.

## 6. Riscos e mitigação

| Risco | Mitigação |
|---|---|
| `drop function app_minha_empresa()` quebra chamadas durante a migration | Drop + create na mesma transação (runner usa transação por arquivo) |
| Colunas novas legíveis por `anon` via `anon_select_empresas_public_slug` (SELECT para empresa ativa) | Dados de contato empresarial, públicos na Receita; registrar e avaliar em TS01 |
| Vendedor pode editar a empresa (`me_empresas_contratos_timbrado_update`) | Fora do escopo — TS01 |
| CNPJ mascarado gravado por escritores antigos | Trigger de normalização no banco |
| BrasilAPI fora do ar / CORS | Fallback `publica.cnpj.ws` + preenchimento manual |
| Regex de logo em `scripts/test-sidebar-search.mjs`/`test-crm-pipeline.mjs` | Ajuste em T13 |
