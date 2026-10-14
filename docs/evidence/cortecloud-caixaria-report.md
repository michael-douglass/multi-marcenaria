# Relatório técnico — Caixaria e precificação Cortecloud (HAR)

| Campo | Valor |
| ----- | ----- |
| Data | 2026-10-13 |
| Serviço amostrado | `23516165` (company `824`) |
| HAR completo | `captura_cortecloud.har` (raiz, gitignored) |
| HAR micro REA | `docs/evidence/captura_cortecloud-micro.har` (7 records) |
| REA network | `inspect_web_network_capture` → `ev_fdae8404eb011faed3a1f160e3ed8fd3fe7bd308ba251d562bf1e9c55fdbd55b` |
| REA JS app | `analyze_javascript_application` `src/lib/orcamentos-ia` → parent `ev_ad88aaa199a5505775ee850511c036f7a67e5e39f356c30a9037f1ce7a08ef6f` |
| Extrato redigido | `docs/evidence/_cortecloud-har-extract.json` (gitignored) |

## 1. Endpoints observados **[SEEN]**

| Endpoint | Papel |
| -------- | ----- |
| `GET .../services/{id}/parts/list` | Lista de peças fatiadas (172 no serviço 23516165) |
| `GET .../services/{id}/edges` | Fitas usadas no serviço |
| `GET .../optimizations/services/{id}/materials` | Consumo de chapas/fitas + componentes (ferragens) |
| `GET .../edging_machines/{id}/rules` | Regras mínimas de colagem (espessura chapa × fita) |
| `GET .../companies/{id}/functions/list` | Catálogo de funções de peça (Base, Lateral, …) |
| `GET next.../api/core/boards\|edges/companies/{id}` | Catálogos de chapas e fitas da empresa |
| `GET biblioteca.hellomob.com.br/modulos.json` | Biblioteca HelloMob (estruturas/raio-X) |

## 2. Fatiamento de caixaria **[SEEN]**

Cada peça em `parts/list` traz:

- `function` — papel tipográfico (ex.: `Lateral direita`, `Base`, `Fundo`, `Prateleira estrutural`, `Travessa dianteira`, `Divisória`, peças de gaveta)
- `c` / `l` — cotas em mm (comprimento × largura da peça no plano de corte)
- `board` / `board_id` — chapa (ex.: MDF Branco 15 mm)
- `quantity`, `rotate`, `sequence`, `complement` (módulo de origem, ex.: “(1) Balcão gaveteiro + basculante”)
- `has_thickening` / `thicken_edge_id` — engrosso
- `machining` + `machining_compiled` — usinagens/furos JSON

### Contagem de funções no serviço 23516165

| Função Cortecloud | Qtd | Role nosso sugerido |
| ---------------- | --: | ------------------- |
| Lateral direita / esquerda | 28 | `lateral` |
| Base (+ Base 2) | 15 | `base` |
| Fundo (+ reforçado) | 14 | `fundo` |
| Laterais/contras/fundo/frente de gaveta | 53 | caixaria gaveta → `outro` ou módulo gaveteiro |
| Prateleira* | 13 | `prateleira` |
| Travessa dianteira | 8 | `sarrafo` / travessa |
| Porta* / basculante | 15 | `frentes_portas` (não caixaria) |
| Tampo | 6 | `tampo` |
| Divisória* | 6 | `divisoria` |
| Rodapé / Pé / Saia | 3 | `outro` |

Catálogo oficial `functions/list` **[SEEN]**: Base, Contra Frente/Fundo de Gaveta, Divisória, Lateral de Gaveta, Lateral Direita/Esquerda, Porta, Prateleira, Tampo, Tira, Travessa.

## 3. Fita de borda C1/C2/L1/L2 **[SEEN]**

Campos por peça:

- Booleanos: `c1`, `c2`, `l1`, `l2`
- IDs de fita: `c1_edge_id`, `c2_edge_id`, `l1_edge_id`, `l2_edge_id`
- Engrosso: `thicken_edge_id`

Distribuição observada (c1c2l1l2 como bitmask):

| Padrão | Qtd | Interpretação **[INFERRED]** |
| ------ | --: | ---------------------------- |
| `1000` (só C1) | 119 | Borda frontal/visível principal |
| `1111` (perímetro) | 26 | Peças com fita em todas as arestas |
| `0000` | 25 | Sem fita (ex.: fundo) |
| outros | 2 | Casos especiais |

Convenção dimensional **[SEEN]**: eixos `c` (comprimento) e `l` (largura) da peça; C1/C2 = arestas do comprimento; L1/L2 = arestas da largura. Isso casa 1:1 com `edge_banding.{C1,C2,L1,L2}` em `schemas.ts`.

Regras de coladeira **[SEEN]** (`edging_machines/.../rules`): para chapa 15/18 mm e fita 0.4/1 mm, `min_board` 70 mm e `min_side` 100 mm.

## 4. Precificação e serviços **[SEEN]** / **[INFERRED]** / **[UNKNOWN]**

### Observado no serviço

Campos em `services/{id}`: `price`, `packing_price`, `delivery_price`, `machining_price`, `thickening_price`, `handle_price`, `advanced_production_price`, `markup`, `boards_labour`, `tcc_carpenter`.

No serviço amostrado vários preços estavam `0`/`null` (orçamento ainda não cotado ou linha sem tabela) — **[SEEN]** campos existem; valor comercial desta amostra **[UNKNOWN]**.

### Materiais / otimização

`optimizations/.../materials` devolve:

- `boards` / `boards_pieces` — consumo de chapas
- `edges` / `edges_consumption` / `edges_applied` — metros de fita (com/sem engrosso)
- `components[]` — ferragens com `quantity`, `price`, `rounding` (arredondamento de embalagem no Cortecloud; **nossa regra v11 continua unitária**)

### Inferências de margem

- Markup e TCC carpenter existem como campos → margem aplicada no serviço Cortecloud **[INFERRED]**.
- Fórmula exata material + serviço + margem **[UNKNOWN]** sem quote fechado com `price != null`.
- Preços de colagem R$/m e corte por chapa na empresa **[UNKNOWN]** (não vieram preenchidos nesta captura; catálogo `core/edges` traz metadados de fita, não tabela de mão de obra).

## 5. Paridade com nosso código **[SEEN]**

| Cortecloud | GARBO Orçamentos IA |
| ---------- | ------------------- |
| `function` tipada | `caixariaPieceSchema.function` enum |
| `c`/`l` mm | `width_mm` / `height_mm` (mapeamento a documentar no prompt) |
| `c1..l2` + `*_edge_id` | `edge_banding.C1..L2` + `tape_name`/`meters` |
| `has_thickening` | `doubled` / fita 35–45 mm em `edgeband.ts` |
| HelloMob `modulos.json` | tipologias Zod + `bom-engine/explode.ts` |
| components unitários | `ferragens` por unidade (PRD v11) |

REA JS (`src/lib/orcamentos-ia`): 30 arquivos, parse OK; grafo semântico parcial (sem runtime).

## 6. Limitações

- HAR completo >32 MB: REA exige subset (`micro.har`).
- Preços comerciais zerados na amostra — não fechar fórmula de margem.
- Credenciais/tokens redigidos; HARs não versionados.
