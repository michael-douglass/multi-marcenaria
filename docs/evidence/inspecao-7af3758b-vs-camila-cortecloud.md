# Relatório de inspeção — lote `7af3758b` × lista Camila × Cortecloud #22168837

| Campo | Valor |
| ----- | ----- |
| Data | 15/10/2026 |
| Análise GARBO | `7af3758b-2f7b-4d1a-a1c0-2446a741a169` |
| Projeto PDF | A4_ARQ_DET_QUARTO SUÍTE_CO_REV01 |
| Status | COMPLETED |
| Venda (MPC 45%) | R$ 27.466,36 |
| Custo materiais | R$ 15.106,50 |
| Lista esperada | Camila Fisio – João Paulo / Cliente Camila Rosa (15/10/2026 16:15) |
| Cortecloud | [#22168837](https://marceneiro.cortecloud.com.br/#/plans/22168837/view) — Camila e Otavio – Quarto |
| HelloMob módulos | 33 granulares (evidência `hellomob-22168837-modules.json`) |

---

## 1. Veredito (em uma frase)

**Paridade BAIXA.** O sistema detectou só **3 módulos agregados** (esperava dezenas fatiadas no HelloMob), **zerou corrediças e dobradiças**, e nas chapas de compra ficou **abaixo** da lista esperada e do Cortecloud — mesmo com preço de venda alto (kit roldana e chapas “fantasma” de peça com R$ 0).

---

## 2. Módulos — o buraco principal

### Nosso resultado (3)
| Ambiente | Módulo | Cotas gravadas | Materiais |
| -------- | ------ | -------------- | --------- |
| Quarto Suíte | Armário | 800×720×500 | 39 |
| Quarto Suíte | Divisoria Amendoeira Com Nichos | 870×2700×210 | 40 |
| Quarto Suíte | Painel ripado | 2520×1550×50 | 24 |

### Cortecloud / HelloMob (33)
Contagem por tipo:

| Tipo HelloMob | Qtd |
| ------------- | --: |
| Armário 1 coluna | 10 |
| Balcão | 5 |
| Lateral tamponamento | 3 |
| Porta avulsa | 4 |
| Vista vertical | 2 |
| Nicho | 2 |
| Painel avulso (liso) | 2 |
| Painel ripado | 2 |
| Gaveteiro horizontal | 2 |
| Tampo tamponamento | 1 |
| **Total** | **33** |

### Faltando no nosso inventário (cobertura)
- Guarda-roupa fatiado em **colunas + balcões + portas** (nós temos 1 “Armário” 800×720 — cotas de **balcão baixo**, não do roupeiro alto).
- **Gaveteiros** (origem das corrediças 30/35/45).
- **Painel liso** separado do ripado (nós fundimos no “Painel ripado” 2520×1550).
- Laterais / tampo de tamponamento, vistas, nichos avulsos, sapateira (peças na lista CC).
- Cabeceira / criado / aparador / espelho (vistos em rodadas anteriores do mesmo PDF; **ausentes** neste lote).

**Conclusão módulos:** a IA leu o PDF e “achatou” o projeto em 3 caixas. O Cortecloud trabalha com **~11× mais módulos**. Isso explica ferragens e chapas incompletas.

---

## 3. Lista esperada (Camila) × Nosso × Cortecloud

Leitura da lista enviada (estilo Calcme “OUTROS”):
- `MADEIRA · 15/22` ≈ Amendoeira (chapa 15 mm / fita 22 mm)
- `NEUTRO · 15/22` ≈ Lino Chess
- `MDF BRANCO · 15/22/6` ≈ Branco Eucatex/Multimarcas

| Item esperado | Esperado | Nosso (compra/un) | Cortecloud | Status |
| ------------- | -------: | ----------------: | ---------: | ------ |
| CORREDIÇA OCULTA · 30 | 2 | **0** | 2 (300 mm) | FALTA |
| CORREDIÇA OCULTA · 35 | 6 | **0** | 6 (350 mm) | FALTA |
| CORREDIÇA OCULTA · 45 | 24 | **0** | 24 (450 mm) | FALTA |
| DOBRADIÇA · RETA | 100 | **0** | 5 pct×10 = **50** un* | FALTA (e lista×CC diverge) |
| MADEIRA · 15 (Amendoeira chapa) | 5 | **2** | 5 | ABAIXO |
| MADEIRA · 22 (fita Amendoeira) | 4 | ~75 m agregados** | 4 rolos | UNIDADE DIFERENTE |
| MDF BRANCO · 15 | 11 | **6** | 11 | ABAIXO |
| MDF BRANCO · 22 | 5 | ~56 m** | 90 (unid. CC) | UNIDADE DIFERENTE |
| MDF BRANCO · 6 | 4 | **5–6** | 4 | PRÓXIMO / leve excesso |
| NEUTRO · 15 (Lino chapa) | 6 | **4** | 6 | ABAIXO |
| NEUTRO · 22 (fita Lino) | 11 | ~185 m** | 11 rolos | UNIDADE DIFERENTE |
| RM-331 PERFIL LED EMB | 5 | **1** | (não listado no bloco Componente visto) | ABAIXO |
| TAB 15 PCT/10UNI | 10 | **0** | 10 pct | FALTA |

\* No Cortecloud a dobradiça aparece como **5 pacotes de 10** (= 50 un). Sua lista pede **100** — vale confirmar se o Calcme conta unidade solta ou se há outro ambiente.
\*\* Nosso BOM grava fita em **metros**, não em rolos/pacotes — não dá para bater 1:1 com “· 22 — N” sem converter (rolo ~20 m no CC Lino/Amendoeira).

---

## 4. Ferragens críticas (detalhe)

| Família | Esperado / CC | Nosso | Impacto |
| ------- | ------------- | ----- | ------- |
| Corrediças ocultas | 32 un (2+6+24) | 0 | Gavetas não precificadas |
| Dobradiças | 50–100 un | 0 | Portas batente sem ferragem |
| TAB prateleira | 10 pct | 0 | Nichos/prateleiras sem suporte |
| Perfil LED RM-331 | 5 | 1 | LED subdimensionado |
| Kit roldana porta correr | — (CC usa portas avulsas/batente) | **12 × R$ 750** | Provável **erro tipológico** (portas de correr no BOM vs portas avulsas no HelloMob) |
| Cabideiro oval | — | 4 | Extra nosso |
| Minifix + cavilha | — | 140+192 | Presentes, mas sem base de gaveta/dobradiça |

---

## 5. Preço

| Fonte | Valor | O que significa |
| ----- | ----: | --------------- |
| Cortecloud materiais | R$ 6.463,40 | Material da central |
| Cortecloud total central | R$ 10.485,54 | Corte + material + serviço (retirada) |
| Nosso custo materiais | R$ 15.106,50 | ~2,3× material CC |
| Nosso venda MPC 45% | R$ 27.466,36 | Não comparável 1:1 com total central |

Infladores óbvios no nosso BOM: **12 kits roldana a R$ 750** (= R$ 9.000 sozinhos) + chapas de compra incompletas misturadas com linhas de peça a R$ 0.

---

## 6. Causas-raiz (por que faltaram módulos)

1. **Agregação excessiva na extração/auditoria** — um “Armário” + “Painel ripado” + “Divisória” no lugar do fatiamento HelloMob (colunas/balcões/portas/gaveteiros).
2. **Corrida Edge×cliente durante o lote** — o status oscilou extract ↔ ready_for_pricing várias vezes; o inventário final ficou com só 3 módulos (em momentos intermediários o poll chegou a marcar 8–9 `mods`, depois caiu).
3. **Motor de ferragem amarrado a tipologias** — sem gaveteiro detectado → zero corrediças; sem portas batente → zero dobradiças; sem TAB → zero suporte prateleira.
4. **Tipologia de porta errada** — “Porta de correr 1…5” + kit roldana, enquanto o Cortecloud lista **portas avulsas** no guarda-roupa.

---

## 7. Checklist de ação (prioridade)

1. **P0** — Reprocessar inventário exigindo split HelloMob (já há regra no prompt; neste lote não “pegou”).
2. **P0** — Garantir módulos: colunas do guarda-roupa, balcões, portas avulsas, 2 gaveteiros, painel liso ≠ ripado, laterais/tampo.
3. **P0** — Regenerar ferragens: 24+6+2 corrediças, dobradiças, 10 TAB; remover ou recalibrar kit roldana se tipología for batente.
4. **P1** — Chapas de compra alinhar a 5 / 11 / 4 / 6 (Amendoeira / Branco15 / Branco6 / Lino).
5. **P1** — Perfil LED 5 un (ou metros equivalentes à cava).
6. **P2** — Confirmar com você: dobradiça **100** (Calcme) vs **50** (5×10 no Cortecloud).

---

## 8. Fontes

- Banco: `quote_analyses` / `quote_modules` / `quote_materials` id `7af3758b…`
- Lista usuário: mensagem 15/10/2026 16:17 (Camila Fisio – João Paulo)
- Cortecloud ao vivo: plano [#22168837](https://marceneiro.cortecloud.com.br/#/plans/22168837/view)
- Módulos HelloMob: `docs/evidence/hellomob-22168837-modules.json`
