# Structure — mapa de navegação do repositório

Contagens reais (arquivos, não linhas), verificadas por `find`:

| Pasta | Arquivos |
|---|---|
| `src/components` | 698 |
| `src/lib` | 366 |
| `src/hooks` | 219 |
| `src/pages` | 91 |
| `supabase/migrations` | 204 |
| `supabase/functions` | 52 |
| `src/context` (núcleo, singular) | 6 |
| `src/contexts` (CRM, plural) | 9 |
| `src/types` | 5 |
| `src/integrations` | 2 |

## A armadilha nº 1 do repositório: `context/` vs `contexts/`

O código é a fusão de dois apps originalmente separados. Isso aparece como **módulos paralelos com
nomes parecidos** — sempre confirmar em qual dos dois se está antes de reaproveitar um nome:

- **`src/context/`** (singular) — núcleo Movelaria. `AppContext.tsx`, `CaixaContext.tsx`,
  `FinanceDataContext.tsx`, `ObrasContext.tsx`.
- **`src/contexts/`** (plural) — CRM Selletos. `AppContext.tsx` (um `useApp()` **diferente** — o
  próprio arquivo comenta "Não confundir com `@/context/AppContext` da fábrica"), `AuthContext.tsx`,
  `EmpresaContext.tsx`.

Mesma duplicidade nos papéis: `UserRole` (núcleo) vs `CrmRole` (CRM) — dois sistemas de permissão
independentes, cada um com sua função de gate (`canAccessSection` vs `canAccessCrmPath`).

## Roteamento (`src/App.tsx`)

Todo roteamento autenticado passa por `AuthenticatedRoutes()`. Acesso é decidido **inline, por rota**,
não por um wrapper genérico de guarda: `canAccessSection`/`canAccessFuncionarioPasta` (núcleo) ou
`crmPage(path, element)`/`canAccessCrmPath` (CRM). Rotas públicas (sem sessão Supabase) são declaradas
fora de `AuthenticatedRoutes`, direto em `App()` — ex. `/orcamento/:schema/:id` (visualização pública
de orçamento), `/agendar/:slug`, `/cadastro/:tipo`.

Páginas do CRM são majoritariamente `lazy()`; páginas do núcleo são eager.

## Onde vive cada peça do domínio "orçamento com IA" (para não redescobrir na fase de DESIGN)

### Pipeline de composição por IA

| Peça | Caminho |
|---|---|
| Orquestração das 7 fases (edge function) | `supabase/functions/compose-markup-ia/index.ts` |
| Fase Fidelidade | `runFidelidadeFase`, dentro do arquivo acima; lógica compartilhada em `_shared/markup-ia-fidelidade.ts` |
| Fase Projetista (identifica móveis/dimensões) | `runProjetistaFase`; schema/parsing em `_shared/markup-ia-projetista.ts` |
| Fase Inventariante (hoje decide quantidade em texto livre) | `runInventarioFase`; dicas por categoria em `_shared/markup-ia-verificacao.ts` (inclui `getCaixariaGlossarioHint`) e `_shared/markup-cortecloud.ts` (`getCortecloudInventarioHint`) |
| Auditor de inventário + retry | dentro do mesmo `index.ts` (`MAX_RETRIES_INVENTARIO = 2`) |
| Fase Precificação | `runPrecificacaoFase`, mesmo arquivo |
| Prompts editáveis por agente | `markup_config.markup_ia_agent_prompts`; UI `MarkupIAAgentesPanel.tsx` |
| Motor de cálculo determinístico (existe, **não é a fonte de verdade hoje**) | `src/lib/markup-motor-calculo.ts` + espelho `supabase/functions/_shared/markup-motor-calculo.ts` |
| Matching item extraído → catálogo | `src/lib/markup-match.ts` + espelho `_shared/markup-match.ts` (`casarProdutoNoCatalogo`, `confiancaEhSugerivel`, `deveAutoAceitarMatch`) |
| Regras construtivas (espessuras, folgas, % perda) | tabela `emp_garbo.markup_regras_construtivas`; UI `MarkupRegrasConstrutivasEditor.tsx` |

### UI da calculadora e da composição por IA

| Peça | Caminho |
|---|---|
| Calculadora de markup (sheet principal) | `src/components/markup/MarkupCalculatorSheet.tsx` |
| Seletor de anexos / upload | `MarkupIAAnexosPicker.tsx` |
| Overlay de progresso da composição | `MarkupIAComposeOverlay.tsx` |
| Diálogo de conferência (semáforo de confiança) | `MarkupIAConferenciaDialog.tsx` |
| Painel de resultado final editável | `MarkupIAResumoPanel.tsx` |
| Checklist de verificação por categoria | `MarkupIAVerificacaoChecklist.tsx` |
| Marcadores visuais sobre a imagem/PDF | `MarkupIAMoveisMarkers.tsx` |
| Painel do projetista / fidelidade | `MarkupIAProjetistaPanel.tsx`, `MarkupIAFidelidadePanel.tsx` |

### Persistência (client-side, `src/lib/markup-tables.ts` resolve nome real da tabela por schema)

`markup_categorias`, `markup_produtos`, `markup_config`, `markup_despesa_templates`,
`markup_servico_templates`, `markup_orcamentos`, `markup_orcamento_linhas`,
`markup_regras_construtivas`. Todas dentro do schema-per-empresa (ex. `emp_garbo`), nunca em
`public`.

### Composição do cliente-side do orçamento final

- `src/lib/markup-compose.ts` — monta `materiais.linhas` final (função `agregarLinhasPorProduto`,
  chamada por `aplicarComposicaoIA`). É o ponto onde o resultado do pipeline se torna o orçamento
  persistido.
- `src/lib/markup-compose-validate.ts` — valida antes de salvar; hoje só popula `avisos`, nunca
  `erros` (ver `docs/decisions/` e `specs/orcamento-com-ia/REQUIREMENTS.md`, pendência P1).

### Módulo separado de proposta ao cliente (Orçamento Slides — ~40 arquivos)

Não faz parte do pipeline de IA hoje, mas é um dos destinos definidos para o resultado do módulo
"Orçamento com IA":

| Peça | Caminho |
|---|---|
| Páginas | `src/pages/orcamento-slides/*.tsx` (lista, novo/editar, apresentar, config, público) |
| Lógica de slide/preço/mídia | `src/lib/orcamento-slide-*.ts` (~35 arquivos: layout, precificação, export, vídeo, formas de pagamento, etc.) |
| Hooks | `src/hooks/useOrcamentoSlide*.ts`, `useCrmOrcamentoSlides.ts` |
| Rota pública de visualização do cliente | `/orcamento/:schema/:id` → `OrcamentoPublicoPage.tsx` (fora de `AuthenticatedRoutes`, sem sessão) |

### Documentos de referência já existentes sobre este mesmo assunto

- `docs/prd-markup-ia-composicao-visual.md` — PRD anterior (composição visual/anotação de imagem),
  já com diagnóstico de que o pipeline funciona e mapa de reaproveitamento.
- `docs/sistemadeprecificacaocomia.md` — guia de referência fornecido pelo usuário (arquitetura de
  3 fases, fórmulas, schema de insumos) que inspirou o motor de cálculo determinístico.
- `docs/referencia-caixaria-mdf.md` — pesquisa técnica com fontes externas sobre chapas MDF,
  corrediças, categoria "Pedras e Bancadas" — calibra o motor de cálculo e os prompts da IA.

## Higiene do repositório

A raiz acumula artefatos de trabalhos antigos: arquivos soltos como `App.js`, `Button.tsx`,
`deploy-*.json`, `deploy-*.ts`, `.md` de planejamento na raiz (`deshboard.md`, `lousa.md`,
`identidadevizual.md`). **Nada disso é código vivo** — o entrypoint real é `src/App.tsx`. Não assumir
que um arquivo de nome igual na raiz é o código que roda.

## Multi-empresa (plataforma SaaS)

Desde 2026-11 o sistema atende várias marcenarias isoladas por `empresa_id` + RLS, com o schema `crm`
compartilhado (antigo `emp_garbo`), usuário master e Painel/Financeiro Master. Arquitetura, decisões e
scripts: `docs/multi-empresa/DESIGN.md`, `docs/multi-empresa/PROGRESSO.md` e
`docs/decisions/0003-multi-tenant-por-empresa-id.md`.

- Banco: `app_empresa_atual()`, trigger `aaa_tenant_fill`, policy RESTRICTIVE `tenant_isolamento`,
  role `app_tenant_definer`, tabelas `plataforma_*`, RPCs `master_*`.
- Front: `src/hooks/useEmpresaAtiva.ts`, `src/contexts/EmpresaContext.tsx`, `src/hooks/useMaster.ts`,
  `src/master/*` (console isolado: `MasterApp`, `MasterLayout`, `pages/`, `components/PaginasEditor`),
  `src/components/master/*` (faixa de inspeção, nova empresa), `src/lib/paginas-catalogo.ts`,
  `src/lib/kanbans-padrao.ts` (Pipeline/kanbans padrão; par SQL `crm_seed_pipeline_padrao`).
  `src/lib/contrato-padrao.ts` (modelo de contrato padrão + 17 campos; par SQL `crm_seed_contrato_padrao`) e
  `src/lib/contrato-variaveis.ts` (motor: padrões, calculadas, `{{#se}}`; usado por `buildConteudoContrato`).
- Edge Functions: `supabase/functions/_shared/tenant.ts`.
- Scripts: `scripts/multi-empresa/*` (gerador de migration, testes de isolamento, deploy).

## Modelos padrão do master (markup, slides, contratos, apresentação, Pontua)

O master monta modelos em **empresas-modelo** (`empresas.e_modelo`, com `segmento`) editando nas telas normais (inspeção em acesso total), publica em `/master/modelos`, liga a planos em `/master/planos` e envia; cada empresa recebe uma **cópia** que só acrescenta. Docs: `docs/modelos-padrao/`, ADR `0005`.

- Banco: `plataforma_modelos` / `plataforma_plano_modelos` / `plataforma_modelo_entregas`; cópias `plataforma_copiar_{markup,slides,contrato,apresentacao,pontua}` (postgres, `empresa_id` explícito, chaves naturais); `plataforma_aplicar_modelo`; RPCs `master_criar_empresa_modelo`, `master_listar_modelos`, `master_publicar_modelo`, `master_salvar_modelos_plano`, `master_enviar_modelo`, `master_listar_entregas`. `master_criar_empresa` aplica os modelos publicados do plano antes do seed. Migrations `20261118140000`–`20261118140600`. **Tabela nova num módulo copiável exige atualizar a função de cópia.**
- Apresentação/Pontua: `crm.apresentacao_conteudo` (jsonb por empresa) + `apresentacao_publica(slug)`; front em `src/components/marketing/apresentacao-empresa/apresentacao-conteudo.ts` (padrão neutro com `{empresa}`, mescla), `ApresentacaoConteudoContext.tsx`, `src/hooks/useApresentacaoConteudo.ts`. Editores: `ApresentacaoEditorPage.tsx` (`/marketing/apresentacao-interna/editar`, grava `conteudo`) e `PontuaEditorPage.tsx` (`/marketing/pontua/editar`, grava `pontua`), campos em `editor-campos.tsx`. Página Pontua `/marketing/pontua` (`PontuaPage.tsx`, modo `somentePontua` de `ApresentacaoEmpresa`). Links públicos `/apresentacao/:slug` e `/apresentacao/:slug/pontua`.
- Console: `src/master/pages/Modelos.tsx`, `src/master/components/modelos/*`.
- Testes: blocos T42–T57 de `scripts/multi-empresa/test-plataforma.sql`; `node --env-file=.env scripts/modelos-padrao/test-modelos-api.mjs` (API real, cria e apaga). Importação única do banco antigo: `scripts/modelos-padrao/importar-empresa-antiga.mjs`.

## Marca neutra (sem nome de empresa cliente)

O sistema não tem marca fixa (ADR `0006`, docs `docs/marca-neutra/`): depois do login mostra nome e logo da empresa; antes do login e no PWA usa "Gestão" e o monograma `public/imagens/marca-padrao.{svg,png}` (`src/lib/marca-padrao.ts`, gerado por `scripts/marca-neutra/gerar-icones.mjs`). Pontua no banco: tabelas `crm.pontua_lancamentos` / `crm.pontua_comissao_liberacoes`, colunas `config_pontua`, `pontua_percentual`, `leads.pontua_usuario_id`; valor gravado do campo/origem = `'Pontua'`. Lógica em `src/lib/pontua*.ts`, `src/hooks/usePontua*.ts`, edge `_shared/pontua-lead.ts`. Migrations `20261119100000`–`20261119100300`. Código novo não cita empresa cliente; fotos padrão em `public/imagens/apresentacao/`.

## Identidade da marcenaria (logo, CNPJ, nome fantasia, "Pontua {nome}")

Cada empresa cadastra a própria identidade no **/profile → "Dados da empresa"** (só admin; o mesmo formulário aparece em `/admin/marca`). Requisitos, desenho e tarefas: `docs/identidade-empresa/`.

- Banco: colunas de endereço e contato em `"CRM-multi-empresas>empresas<"`; CNPJ guardado só com dígitos (trigger `empresas_cnpj_normaliza`). `app_minha_empresa()` e `orcamento_publico_obter()` (chave `empresa`) devolvem esses dados. A escrita é feita **só** pela RPC `empresa_atualizar_dados(jsonb)` (admin da empresa ou master com acesso total), porque o UPDATE direto na tabela falha por recursão de policy (ver TS01). Migrations `20261118120000` e `20261118120100`.
- Helpers puros: `src/lib/empresa-identidade.ts`. Contém `formatCnpj`, `cnpjValido`, `formatEnderecoEmpresa`, `nomePrograma`, `rotuloPontua` e `montarEmpresaIdentidade`, além do valor guardado em módulo para os PDFs (`definirEmpresaDocumento` grava; `empresaDocumento`, `nomeEmpresaDocumento` e `logoDocumentoUrl` leem).
- Hook: `src/hooks/useEmpresaIdentidade.ts`, fonte única para as telas. Lê `useApp().empresa` do núcleo.
- Consulta à Receita: `src/lib/cnpj-receita.ts` (BrasilAPI, com `publica.cnpj.ws` de reserva). Teste: `npx tsx --tsconfig tsconfig.app.json scripts/test-cnpj-receita.mjs`.
- Tela: `src/components/admin/EmpresaDadosForm.tsx`; gravação em `src/hooks/useEmpresaBranding.ts` (`atualizarDadosEmpresa`, `salvarDadosEmpresa`).
- Consumo:
  - `src/components/Logo.tsx` (menu);
  - `EmpresaDadosLegais` + `EmpresaPublicaProvider` (slides e página pública);
  - variáveis `{{empresa_*}}` de contrato (`VARIAVEIS_EMPRESA` em `src/lib/contratos-print.ts`);
  - PDFs e recibos via `empresaDocumento()`;
  - "Pontua {nome}" via `nomePrograma` (cartões, financeiro, portal). A página `/marketing/pontua` se chama só "Pontua" no menu.
- O valor gravado do campo/origem é `'Pontua'` (`PONTUA_CAMPO_NOME`, `PONTUA_LEAD_ORIGEM`); a exibição passa por `rotuloPontua`.
