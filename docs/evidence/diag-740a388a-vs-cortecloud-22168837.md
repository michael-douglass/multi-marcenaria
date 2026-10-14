# Diagnóstico minucioso — Nosso 740a388a × Cortecloud #22168837

- **Cortecloud:** https://marceneiro.cortecloud.com.br/#/plans/22168837/view  
- **Cliente CC:** Camila e Otavio — Quarto  
- **Nosso:** `740a388a` — PDF `A4_ARQ_DET_QUARTO SUI_TE_CO_REV01.pdf` — Quarto Suíte  
- **Captura:** browser Cursor 14/10/2026 (~15:32 UTC)

## Totais

| | Cortecloud (central) | Nosso (740a388a) |
|--|---------------------|------------------|
| Materiais | **R$ 6.463,40** | **~R$ 13.020** |
| Mão de obra / serviços | R$ 4.022,14 | (não cotamos assim) |
| Total central / Venda | **R$ 10.485,54** | **~R$ 23.673** (MPC 45%) |
| Chapas (un.) | **26** | **26** (consolidado) / **32** nas linhas cobráveis |

Mesmo total de chapas no consolidado (26), mas **mistura de cores errada** e **custo ~2×**.

## Chapas — deveria × foi

| SKU Cortecloud | Qtd CC | Nosso consolidado / cobrável |
|----------------|-------:|------------------------------|
| Amendoeira Bold 15 mm | **5** | **0** (sumiu) |
| Lino Chess 15 mm | **6** | **0** (sumiu na paleta) |
| Branco Eucatex 15 mm | **11** | **17–20** (sobrando) |
| Branco Multimarcas 6 mm | **4** | **9–12** (sobrando) |

Causa principal: `DEFAULT_PROJECT_SHEET_PALETTE` (Flaviane: Branco/Jatobá) **colapsou** Amendoeira/Lino → Branco. Fitas no nosso ainda citam Amendoeira/Lino — inconsistência chapa vs fita.

## Módulos — estrutura

**Cortecloud (HelloMob)** — dezenas de módulos granulares: armários 1 coluna, balcões, portas avulsas, painéis lisos/ripados, nichos, gaveteiros, laterais/tampo de tamponamento.

**Nosso** — 8 móveis + espelho OOS, todos em Quarto Suíte (ambiente ok):

| Nosso | Custo | Leitura vs CC |
|-------|------:|---------------|
| Guarda Roupas | ~R$ 8.961 | Agrega várias colunas/balcões/portas; **supercotado** |
| Divisória c/ nichos | ~R$ 886 | Parcial |
| Painel TV | ~R$ 615 | Existe painel avulso no CC |
| Cabeceira | ~R$ 564 | Cotas estimadas |
| Aparador | ~R$ 563 | ≈ gaveteiros/balcão baixo |
| Mesa de cabeceira | ~R$ 563 | Existe no CC |
| Divisória ripada | ~R$ 473 | Painel ripado CC |
| Painel ripado | ~R$ 405 | Separado do TV — bom |
| Espelho | OOS | Ok |

Paridade estrutural: **média** (ambiente certo, granularidade baixa).

## Ferragens / componentes

Cortecloud (amostra na tela):

- Corrediças ocultas 450/350/300 — várias **NÃO INCLUSO** (24+6+2…)
- Parafusos e cavilhas inclusos

Nosso:

- CORREDIÇA OCULTA 45 ×12 (~R$ 900) — De-Para ok, qtd pode estar baixa vs CC
- DOBRADIÇA RETA ×76
- CABIDEIRO OVAL ×7, PUXADOR ALÇA ×7 + puxador cave Amendoeira ×12
- Minifix/cavilha em volume alto

## Lista de peças

CC mostra usinagem peça a peça (laterais, contras, fundos 6 mm, fitas C1…). Nosso grava lista de corte + chapa agregada — caminho certo, mas a **agregação de cor** quebrou o De-Para de chapa.

## Veredito

1. **Projeto é o mesmo** (Quarto suíte Camila/Otávio ↔ PDF suíte).  
2. **Não está coerente no detalhe fabril:** cores de chapa erradas; guarda-roupa grosso demais; custo materiais ~2×.  
3. **Melhorias recentes ok:** ambiente único Suíte; painel ripado ≠ TV; BOM consolidado existe; De-Para de ferragem parcial.  
4. **Próximo fix crítico:** paleta por **projeto** (Amendoeira + Lino + Branco), não default Flaviane global.
