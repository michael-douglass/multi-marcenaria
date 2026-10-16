# Modelo canônico HelloMob — DET_CLÍNICA / Cortecloud #23496206

| Campo | Valor |
| ----- | ----- |
| Data | 16/10/2026 |
| Plano | [#23496206](https://marceneiro.cortecloud.com.br/#/plans/23496206/editmodules) |
| Cliente | Renata Almeida |
| Fonte REA | `inspect_web_network_capture` em HAR micro (≤32 MB) |
| Fonte HelloMob | `docs/evidence/hellomob-23496206/23496206.json` (zip S3) |
| HAR completo | `docs/evidence/captura_cortecloud-23496206.har` (~66 MB — acima do budget REA) |
| HAR micro | `docs/evidence/captura_cortecloud-23496206-micro.har` (5 records) |
| JSON agregado | `docs/evidence/resultado_cortecloud_23496206.json` |

**Gate E1:** 139 instâncias · 9 SKUs de chapa · 668 peças (API parts) — **OK**.

---

## 1. Como a fábrica forma o móvel

```text
Projeto HelloMob (23496206.json)
  └─ furniture (ambiente) .............. 7 nomes
       └─ modules[] .................... 139 instâncias (uuid único)
            ├─ id / name ............... tipologia biblioteca (ex: balcao_gavetas_iguais)
            ├─ recipe .................. URL zip biblioteca.hellomob.com.br/modulos/...
            ├─ L×A×P (mm) .............. cotas do módulo
            ├─ preferences.d ........... regras (trilho, fitagem, dispositivos…)
            └─ lista[] ................. peças já explodidas (prontas p/ Cortecloud)
                 ├─ function ........... Lateral, Porta, Frente gaveta…
                 ├─ board_id ........... SKU de chapa
                 ├─ c1/c2/l1/l2 + edge_id
                 └─ module_uuid ........ liga peça → módulo
```

No Cortecloud (API carpenter), o mesmo grafo aparece como:

| API (HAR micro / REA) | Papel |
| --------------------- | ----- |
| `GET …/services/23496206` | Meta do serviço + `hellomob_project` (zip) |
| `GET …/services/23496206/clients` | Ambientes (`furniture`) × cliente |
| `GET …/services/23496206/parts` | 524 linhas / **668** qtd — peças fabril |
| `GET …/boards_services` | Quais `board_id` estão no serviço |
| `GET …/services/23496206/edges` | 6 fitas do projeto |

REA confirmou esses 5 endpoints no micro-HAR (ordinals 0–4).

---

## 2. Totais de paridade (conferência)

| Indicador | Valor |
| --------- | ----: |
| Ambientes (`furniture`) | **7** |
| Módulos HelloMob (`modules.length`) | **139** |
| Tipos de módulo (`name` distintos) | **15** |
| Peças API Cortecloud (linhas / qtd) | 524 / **668** |
| Peças em `lista[]` HelloMob (linhas) | 546 |
| SKUs chapa (área > 0) | **9** |
| Chapas estimadas (ceil m²/chapa) | **41** |
| Área peças (m²) | **186,11** |
| Fitas (edge ids no serviço) | **6** |

---

## 3. Árvore Ambiente → tipos de módulo

| Ambiente | Instâncias | Composição (name × qtd) |
| -------- | ---------: | ----------------------- |
| Sala Luiz Fernando | 39 | Lateral 10, Painel 6, Tampo 4, Rodapé 4, Balcão 2p 3, Forno 3, Gavetas 2, Nicho 2, Vista 2, Balcão 3p/1p/Aéreo 3p… |
| Sala Renata | 32 | Balcão 2p 4, Lateral 6, Tampo 5, Painel 7, Rodapé 3, Gavetas 2, Aéreo 2p 2, Aéreo 1p, Balcão 1p, Vista… |
| Divisoria | 23 | Lateral 19, Tampo 4 |
| Painel recepçao | 15 | Painel avulso 15 |
| Esterilizaçao | 12 | Lateral 4, Aéreo 2p 2, Balcão 2p 2, Tampo 2, Gavetas 1, Balcão 1p 1 |
| Balcao recepçao | 11 | Lateral 6, Tampo 2, Painel 2, Gavetas 1 |
| Cozinha | 7 | Lateral 2, Balcão 1p/2p/gavetas/2 colunas, Tampo |

---

## 4. Catálogo de tipologias (15)

| `name` (HelloMob) | `id` tipico | Instâncias | Papel fabril |
| ----------------- | ----------- | ---------: | ------------ |
| Lateral de tamponamento | `lateral_tamponamento` | **47** | Lateral avulsa / fechamento |
| Painel avulso | (painel) | **30** | Painéis / revestimento |
| Tampo para tamponamento | (tampo) | **18** | Tampo de fechamento |
| Balcão 2 portas | | **10** | Caixa + 2 portas → dobradiças |
| Balcão gavetas iguais | `balcao_gavetas_iguais` | **7** | Corpo + gavetas → **corrediças** |
| Estrutura rodape avulsa | | **7** | Rodapé |
| Aéreo 2 portas | | **4** | Aéreo |
| Balcão 1 porta | | **4** | |
| Vista horizontal | | **3** | |
| Balcão para forno embutido | | **3** | |
| Nicho com prateleiras | | **2** | |
| Aéreo 1 / 3 portas, Balcão 3 portas, 2 colunas | | 1 cada | |

### Regra de ferragem (preferências HelloMob)

Nos `Balcão gavetas iguais` observados:

- `preferences.d.tipo_trilho_gavetas` ∈ {`oculto`, `telescopico`} (4 oculto + 3 telescópico neste projeto)
- Peças de gaveta na `lista` / API parts: `Frente gaveta`, `Fundo gaveta`, `Contra frente/fundo`, `Lateral … gaveta` (27 un. cada no agregador parts)

**Implicação Corte Claude:** se o PDF/extração tiver gavetas e `corredica == 0`, está fora da receita de fábrica.

---

## 5. Peça → chapa → fita

### Funções mais frequentes (API parts, qtd)

| function | Qtd |
| -------- | --: |
| Lateral | 47 |
| Painel | 36 |
| Lateral direita / esquerda | 34 / 34 |
| Base | 34 |
| Tampo | 30 |
| Prateleira conjunto | 29 |
| Laterais / contra / frente / fundo **gaveta** | 27 cada |
| Porta direita / esquerda | 21 / 20 |

### Chapas (9 SKUs — ver `resultado_cortecloud_23496206.json`)

| board_id | Cor / mm | m² | Un. est. |
| -------: | -------- | -: | -------: |
| 6874 | Branco 15 Eucatex | 56,76 | 12 |
| 188060 | Salerno 15 | 33,00 | 7 |
| 96542 | Carvalho Lir 15 | 23,78 | 5 |
| 127948 | Itapua 15 | 17,00 | 4 |
| 127772 | Cinza Fossil 15 | 15,37 | 4 |
| 4700 | Branco 6 | 14,07 | 3 |
| 8527 | Areia 15 | 13,55 | 3 |
| 40297 | Fontana Magma 15 | 9,60 | 2 |
| 137882 | Lana 15 | 2,98 | 1 |

Cada peça carrega **um** `board_id` — a paleta **não** colapsa para um único SKU.

### Fitas do serviço (6)

| edge_id | Cor | Largura |
| ------: | --- | ------: |
| 6688 | Itapua | 22 |
| 10278 | Branco | 22 |
| 66350 | Areia | 22 |
| 72928 | Salerno | 22 |
| 48605 | Carvalho Lir | 22 |
| 45391 | Cinza Fossil | 22 |

Bandeiras C1/C2/L1/L2 + `*_edge_id` na peça = regra C1–L2 do PRD v11.

---

## 6. Exemplo concreto — 1× “Balcão gavetas iguais”

| Campo | Valor |
| ----- | ----- |
| uuid | (ex.) `8ad8122f-8c47-402f-9ccf-17bd795b66cc` |
| Cotas | L590 × A650 × P520 mm |
| recipe | `…/modulos/balcao_gavetas_iguais.185.zip` |
| Trilho | `oculto` (preferência) |
| Lista | Laterais, bases/tampos, peças de gaveta, cada uma com `board_id` (ex. 6874 Branco 15) e fitas |

Uma única “instância” HelloMob já explode em **dezenas de peças**. No nosso sistema, isso costuma virar 1 módulo genérico “Bancada/Armário” — daí 139 → 34.

---

## 7. O que o Corte Claude precisa espelhar

1. **Ambiente** = `furniture` (não inventar “Quarto Suíte” em clínica).
2. **Módulo** = tipologia biblioteca + cotas + uuid lógico (não só nome livre).
3. **Explosão** = peças com função (incl. gaveta/porta/tamponamento), não só caixa agregada.
4. **Chapa** = `board_id` / cor+mm por peça (paleta multi-SKU).
5. **Fita** = C1–L2 por aresta.
6. **Ferragem** = preferência de trilho/dobradiça a partir da tipologia (gavetas → corrediças).

---

## 8. Artefatos gerados neste épico

| Arquivo | Uso |
| ------- | --- |
| `docs/evidence/captura_cortecloud-23496206-micro.har` | Entrada REA (budget 32 MB) |
| `docs/evidence/hellomob-23496206.json.zip` | Projeto HelloMob bruto |
| `docs/evidence/hellomob-23496206/23496206.json` | Árvore modules/lista |
| Este documento | Modelo canônico para E2–E7 |

**Nota:** o HAR completo falhou no REA (`out_of_range` > 33 554 432 bytes). O micro-HAR + zip HelloMob cobrem o grafo necessário.
