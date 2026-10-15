# Diagnóstico — falso “concluído” ×2 · análise `7af3758b`

## Sintoma
UI (`AiThoughtConsole`) mostrou aviso de lote concluído **duas vezes**, enquanto o título ainda era **“6 · BOM”** (etapa de precificação / BOM, não “Pronto”).

## Causa
Corrida entre **cliente (aba)** e **Edge Function** `orcamentos-ia-pipeline`:

1. A cadeia async na nuvem chega em `ready_for_pricing` e o navegador começa a precificar (passo BOM).
2. Um `chain_tick` atrasado (extract de página) ainda estava em voo e **reescrevia** `async_chain_status` / status para “lendo páginas”.
3. O cliente, ao terminar a precificação local, disparava toast **“Lote concluído”** sem reler o banco.
4. O auto-resume / Retomar via o status “sujo” e rodava de novo → **segundo toast**, enquanto a UI ainda mostrava etapa 6 · BOM.

## Correção aplicada (2026-10-15)
1. **Edge v67** — `chain_tick` / `extract_page` / `audit_environment` retornam `skipped: client_or_ready` se já estiver em `ready_for_pricing`, `pricing_pending`, `fetching_prices`, `persisting`, `completed` ou status `COMPLETED` / `NEEDS_REVIEW` / `FETCHING_MARKET_PRICES`.
2. **Cliente** (`OrcamentosIaBackgroundContext`) — toast de sucesso só após confirmar no banco `status ∈ {COMPLETED, NEEDS_REVIEW}`; senão mensagem “Precificação quase pronta” + `needsResume`.

## Estado final da análise
| Campo | Valor |
|-------|-------|
| status | `COMPLETED` |
| pipeline_stage | `completed` |
| sale_price | R$ 27.466,36 |
| materials_cost | R$ 15.106,50 |
| mpc | 45% |
| modules | Armário · Divisoria Amendoeira Com Nichos · Painel ripado |
| materiais | 103 linhas |

## Cortecloud #22168837 (referência)
- Chapas: 5 Amendoeira + 11 Branco 15 + 4 Branco 6 + 6 Lino = **26**
- Corrediças ocultas: **24×450 + 6×350 + 2×300** (NÃO INCLUSO na central)
- Dobradiças: **5 pct × 10** (50 un na lista central; pct 10)
- Materiais central: R$ 6.463,40 · Total central: R$ 10.485,54

## Lacunas BOM nosso × Cortecloud (neste lote)
- **Zero corrediças** e **zero dobradiças** no nosso BOM (há minifix, cavilha, trilho, kit roldana, cabideiro, puxador).
- Só **3 módulos** vs composição HelloMob (guarda-roupa fatiado, balcões, portas, gaveteiros…).
- Custo material nosso ~2,3× o da central (tabela + BOM mais grosso + itens sem corrediça/dobradiça compensados por outros).
