# PRD v15 — Paridade Fabril Cortecloud #23125828 (Flaviane e Hélio / Anamá Arq)

| Campo | Valor |
| --- | --- |
| **Versão** | **v15.0** |
| **Data** | 14 de Outubro de 2026 |
| **Base** | PRD v11 (Corte Claude / BOM), v12 circuit-breaker, evidência Flaviane |
| **Plano referência** | Cortecloud `#23125828` — [marceneiro.cortecloud.com.br/#/plans/23125828/view](https://marceneiro.cortecloud.com.br/#/plans/23125828/view) |
| **Análise GARBO** | `fde3a87b-a249-4e95-8a2d-f75f6c9b7818` |

---

## 1. Problema validado

O custo de **materiais** do Orçamentos IA já está na faixa correta (~**R$ 24.320** nosso vs ~**R$ 24.084** Cortecloud, Δ ≈ **1%**).

A lacuna é de **cobertura fabril**:

| Métrica | Cortecloud #23125828 | Nosso (baseline) |
| --- | --- | --- |
| Chapas | **74** | **42** |
| Peças (API / UI) | **919** linhas / **1223** un. qty | 17 móveis in-scope |
| Ambientes | 13 (incl. Quarto 02/03, Lavabo, Área Externa) | 7 com marcenaria precificada |
| Fora do escopo | — | **39** (vários móveis MDF marcados indevidamente) |

Evidências:

- `docs/evidence/resultado_cortecloud_23125828.json` (HAR + REA `inspect_web_network_capture`)
- `docs/evidence/nosso_resultado.json`
- `docs/evidence/parity-report-23125828.json`
- `docs/evidence/compare-fde3-vs-cortecloud-23125828.json`
- `captura_flaviane.har` / `docs/evidence/captura_flaviane-filtered.har`

---

## 2. Matriz de paridade — chapas (ground truth HAR)

| Cor / espessura | Consumo Cortecloud |
| --- | ---: |
| Branco TX 15 mm | 33 |
| Branco TX 6 mm | 10 |
| Imbuia Caiapó 15 mm | 8 |
| Imbuia Caiapó 6 mm | 2 |
| Areia Noronha 15 mm | 8 |
| Areia Noronha 6 mm | 1 |
| Blush Essencial 15 mm | 3 |
| Blush Essencial 6 mm | 1 |
| Mint Essencial 15 mm | 2 |
| Mint Essencial 6 mm | 1 |
| Azul Astral 15 mm | 2 |
| Lord Matt 15 mm | 2 |
| Bege Papiro 15 mm | 1 |
| **Total** | **74** |

### Ambientes omitidos no baseline GARBO (obrigatórios na v15)

- Quarto 02, Quarto 03  
- Lavabo  
- Área Externa  
- Banheiro 01 / Banheiro 02 (quando houver caixaria MDF)  
- Sala de jantar (mesa / aparadores em madeira)

---

## 3. Travas anti-descarte de escopo (normativo)

### 3.1 Regra

**PROIBIDO** marcar tipologias de marcenaria (MDF/MDP/madeira) como `out_of_scope`.

`out_of_scope = true` **somente** para:

- Marmoraria (granito, mármore, quartzo, Silestone, Dekton, porcelanato)
- Obra civil (alvenaria, gesso/drywall, pintura, revestimento)
- Eletros, metais sanitários, decoração solta, iluminação avulsa
- Cadeiras/banquetas de loja
- Módulo **separado** de tampo em pedra (o móvel MDF sob a pedra permanece in-scope)

### 3.2 Implementação

| Camada | Arquivo | Comportamento |
| --- | --- | --- |
| Prompt Extrator/Auditor | `src/lib/orcamentos-ia/prompts/engineering-modular.ts` + Edge `_shared/engineering-modular-prompts.ts` | Trava textual + paleta + fatiamento atômico |
| Merge | `src/lib/orcamentos-ia/merge-extraction.ts` | `isMarcenariaModule` / `BOX_MODULE_RE` → sempre `out_of_scope: false` + caixaria mínima |
| Schema | `src/lib/orcamentos-ia/schemas.ts` | Normaliza tipologia/nome de marcenaria com OOS → `false` |
| Pipeline sanitize | `src/lib/orcamentos-ia/pipeline.ts` | Não apaga tipologias de caixa sem peças; completa placeholder |
| Edge | `supabase/functions/orcamentos-ia-pipeline/index.ts` | `ensurePlaceholders` prioriza caixa sobre hints OOS |

### 3.3 Hints ambíguos

`led` e `espelho` **não** forçam OOS se o nome/tipologia for caixaria (ex.: “Armário com LED”, “porta espelhada”).

---

## 4. Fatiamento atômico por ambiente (caixaria)

Para **cada** móvel em chapa, em **qualquer** ambiente da planta:

1. Laterais E+D  
2. Base  
3. Prateleiras / divisórias / travessas conforme desenho  
4. Fundo **6 mm** rebaixado quando houver fundo  
5. Frentes/portas/gavetas na **cor do projeto**  
6. Caixa interna = **MDF Branco TX** (dual material)

### Paleta obrigatória (Flaviane / #23125828)

`Bege Papiro` · `Lord Matt` · `Mint Essencial` · `Blush Essencial` · `Azul Astral` · `Imbuia Caiapó` · `Areia Noronha` · `Branco TX`

Frentes/tampos **não** podem colapsar tudo em Branco TX.

---

## 5. Precificação (inalterada)

Continua valendo o PRD v11:

- Venda só por BOM + margem MPC % ou ×N  
- **PROIBIDO** m² de fachada  
- Ferragens por unidade individual  
- Fallback estoque → `market_reference_prices`

O modelo de preço **não** é a causa do gap de 32 chapas.

---

## 6. Critérios de aceite v15

1. Reprocessar o PDF Flaviane com prompts/Edge atualizados.  
2. Chapas agregadas ≥ **70** (alvo **74**).  
3. Ambientes Quarto 02/03, Lavabo e Área Externa com marcenaria **in-scope** quando houver MDF no desenho.  
4. Materiais ainda próximos do Cortecloud (ordem de grandeza R$ 24k ± cobertura extra).  
5. Relatório `docs/evidence/parity-report-23125828.json` com `sheets_ok: true`.

---

## 7. Ferramentas REA usadas neste épico

| Slash mental | Ferramenta real |
| --- | --- |
| `/rea-doctor` | CLI `rea doctor` (MCP `user-rea` já ativo nesta sessão) |
| `/rea-analyze-network-capture` | `inspect_web_network_capture` em `captura_flaviane-filtered.har` |
| `/rea-compare` | `scripts/compare-parity-cortecloud.mjs` (domínio BOM; REA não compara JSON de orçamento) |
| `/rea-analyze-javascript-application` | `analyze_javascript_application` em `src/lib/orcamentos-ia` → `docs/evidence/rea-js-app-orcamentos-ia-summary.json` |

Script de captura: `scripts/capture-flaviane.js` (`--auto` com `CORTECLOUD_*`).

---

## 8. Próximo passo operacional

1. Deploy da Edge `orcamentos-ia-pipeline` com prompts espelhados.  
2. Clicar **Reprocessar PDF** na auditoria `fde3a87b-…` (cadeia async anti-504).  
3. Regenerar `nosso_resultado.json` + `parity-report-23125828.json` até `sheets_ok`.
