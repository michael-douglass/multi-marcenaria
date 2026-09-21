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
