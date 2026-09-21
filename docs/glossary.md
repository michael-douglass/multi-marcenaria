# Glossary — vocabulário do domínio

Pré-requisito para ler qualquer requisito do módulo "Orçamento com IA"
(`specs/orcamento-com-ia/REQUIREMENTS.md`). Termos técnicos de marcenaria trazem a fonte usada para
calibrar o motor de cálculo, já pesquisada em `docs/referencia-caixaria-mdf.md`.

## Marcenaria — material e construção

| Termo | Definição |
|---|---|
| **Caixaria** | Estrutura de um módulo de marcenaria — as peças de chapa que formam o "caixote" antes de portas/gavetas/acabamento: laterais, base, tampo/prateleiras, fundo. |
| **Chapa** | Placa de MDF/MDP. Formato comercial padrão: **2,75m × 1,84m = 5,06m²** por chapa inteira. |
| **MDF 6mm** | Espessura usada para **fundo** (não estrutural, só fecha o móvel por trás). |
| **MDF 15mm** | Espessura usada para **caixaria/estrutura** (laterais, base) — preferida à 18mm por ter mais massa e menor curvatura. |
| **MDF 18mm** | Espessura usada para **portas e frentes** — aguenta mais tração de parafuso/dobradiça. |
| **Fita de borda** | Material que cobre a borda cortada da chapa, vendido em rolos (tipicamente 20m ou 50m). |
| **Corrediça** | Ferragem de gaveta, vendida em **tamanhos comerciais fixos**: 250/300/350/400/450/500/550/600mm, em passos de 50mm — não existe corrediça de qualquer medida arbitrária. |
| **Dobradiça** | Ferragem de porta; quantidade por porta varia por faixa de altura (regra construtiva editável). |
| **Rebaixo de fundo** | Recorte na lateral/base onde o fundo (6mm) encaixa. |
| **Perda de corte (`perda_chapa_pct`)** | Margem de segurança de compra sobre a área bruta calculada (hoje 20% para chapa, 15% para fita de borda no motor de cálculo) — **não é uma norma de mercado**, é um número de referência interno do projeto, revisável com histórico real de compras. |
| **Regras construtivas** | Conjunto editável de parâmetros (espessuras, folgas, % de perda, tabela de dobradiça por altura) que o motor de cálculo usa para transformar dimensão em quantidade de material. Tabela `emp_garbo.markup_regras_construtivas`. |
| **Pedras e Bancadas** | Categoria de material adicionada ao checklist de verificação (granito, mármore, quartzo, silestone, porcelanato de bancada) — não é MDF/ferragem, mas aparece em planilhas de fornecedor e precisa ser contada como material. |

## Sistema — pipeline de IA

| Termo | Definição |
|---|---|
| **Compor com IA** | Botão na Calculadora de Markup que dispara o pipeline de agentes de IA a partir de arquivos anexados ao lead (PDF, imagem, planilha). |
| **Íris** | Nome/persona usado para a IA de composição neste sistema (aparece em `chat-iris-sky`, na UI do popup "Oficina Íris"). |
| **Cortecloud** | Planilha de plano de corte fornecida por fabricante/fornecedor, com coluna `QUANT` por peça — quando presente, é a fonte mais confiável de quantidade real (documento denso, tabular). |
| **`modoCortecloud`** | Flag da composição inteira; quando ativa, os prompts reforçam "não invente quantidade sem QUANT > 0 na planilha". |
| **Fidelidade** (fase) | Primeira fase do pipeline — lê o material anexado com fidelidade ao que está escrito/desenhado. |
| **Projetista** (fase) | Extrai móveis, dimensões físicas (altura/largura/profundidade) e tipologia; hoje também produz `totais_consolidados` como estimativa por móvel. |
| **Inventariante** (fase) | Hoje decide a quantidade de cada material lendo o documento em texto livre — é o ponto onde a subcontagem de material foi identificada nos testes reais. |
| **Auditor de Inventário / Auditor Projetista** | Fases de conferência com retry (`MAX_RETRIES_INVENTARIO = 2`) sobre o resultado das fases anteriores. |
| **Precificador** (fase) | Calcula o valor financeiro a partir do inventário já auditado. |
| **`bloqueado`** | Flag calculada no servidor quando a auditoria encontra lacuna crítica; hoje aparece como aviso na UI mas **não** impede salvar (ver decisão em aberto P1). |
| **`totais_consolidados`** | Array de materiais estimados pelo Projetista a partir de dimensões reais — pensado como rede de segurança para o que o Inventariante (leitura em texto livre) pode não encontrar. |
| **Motor de cálculo determinístico** | Módulo de código (`markup-motor-calculo.ts`) que calcula quantidade de chapa/fita/dobradiça por fórmula fixa a partir de dimensão + regra construtiva — hoje existe e é testado, mas **não é a fonte de verdade** do pipeline (decisão em aberto/fechada, ver ADRs). |

## Sistema — negócio

| Termo | Definição |
|---|---|
| **Lead** | Cliente em prospecção no funil de vendas (CRM Selletos). |
| **Pipeline** | Funil de vendas — etapas de um lead até fechar contrato. |
| **Markup** | Módulo de cálculo de custo interno de um projeto — materiais + serviços + despesas → preço final. Não confundir com "markup" como termo genérico de margem; aqui é o nome do módulo. |
| **Orçamento (markup)** | Registro persistido em `markup_orcamentos`/`markup_orcamento_linhas` — o custo interno calculado para um lead. |
| **Orçamento Slides** | Módulo separado que monta a apresentação/proposta que o **cliente** vê — hoje desconectado do markup, preenchido manualmente. |
| **Obra** | Projeto de marcenaria já vendido, em produção/instalação — acompanhado no núcleo Movelaria (`ObrasContext`). |
| **Ponto** | Controle de jornada de trabalho dos funcionários (núcleo Movelaria). |
| **Schema-per-empresa** | Modelo multi-tenant do banco: cada empresa cliente tem seu próprio schema Postgres (ex. `emp_garbo`), não uma tabela `public` compartilhada com coluna de tenant. |
