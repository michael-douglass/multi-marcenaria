# Diagnóstico — cotação baixa `c5bada09` (Casa Mesa)

**PDF:** Caderno Executivo Pav Inferior — Casa Mesa (49 páginas)  
**Sintoma:** ao chegar em precificação, a UI tratou como “pronto”, mas o valor ficou bem abaixo do necessário.

## Números observados

| Fonte | Materiais | Venda (MPC 45%) | Módulos cobráveis |
|-------|-----------|-----------------|-------------------|
| BOM persistido (DB) | ~R$ 4.929 | ~R$ 8.961 | 8 (de 12; 4 OOS) |
| UI capa (materiais) | ~R$ 9.802 | ~R$ 17.822 | — |
| Job anterior `c4a1db11` | ~R$ 11.940 | ~R$ 21.709 | ~14 |

Status no banco ficou preso em `AUDITING_REVISION` / `pricing_pending` (sem `sale_price` gravado), enquanto a tela já mostrava totais — sensação de “concluído” com orçamento incompleto.

## Causas raiz

1. **Inventário da capa curto demais** — só 3 ambientes / 4 móveis (Cozinha Armário+Bancada, Home Office Mesa, Área de Serviço Armário Organizador). Cobertura “4/4” enganava o circuit breaker.
2. **Extração parcial era rica (~20 módulos)** — portas, gaveteiro, divisória, mesas no Quarto Suíte etc. — mas a árvore **precificada** ficou magra (stubs genéricos + vários OOS).
3. **Corrida ready_for_pricing** — cliente começou a gravar BOM enquanto a Edge ainda auditava (ex.: Banheiro). Thought log: `persisting` e `auditing Banheiro` no mesmo minuto.
4. **Filtro de inventário agressivo** — em lavanderia, qualquer módulo sem “tanque/máquina” no nome era descartado (afetava armário organizador).
5. **Sem freio de subcotação** — PDF de 49 páginas com poucos módulos / custo baixo ainda podia ir para COMPLETED.

## Correções aplicadas (Edge v65 + cliente)

- Inventário async com **2ª passada** nas pranchas de detalhe + prompt pedindo vários ambientes em PDF grande.
- `expandInventoryFromExtraction` — âncora cresce com o que foi extraído (não fecha cobertura falsa).
- Auditoria incremental **prefers richer** (não apaga módulos com peças).
- Cliente espera **2 polls estáveis** em `ready_for_pricing` e exige todos os ambientes auditados.
- Self-heal cirúrgico descartado se reduzir módulos demais (<70%).
- Circuit breaker: PDF ≥25 págs. com <8 módulos cobráveis ou materiais < R$ 8.000 → `NEEDS_REVIEW`.
- `start_async` idempotente (não reinicia cadeia já `running`/`ready`).
- Filtro de lavanderia corrigido.

## Reteste

Recomeçar do zero disparado em `c5bada09` após deploy v65. Acompanhar até `COMPLETED` / `NEEDS_REVIEW` com inventário amplo e custo coerente.
