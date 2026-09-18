# Referência técnica — Caixaria de MDF, chapas e ferragens

Pesquisa feita em 17/09/2026 para calibrar o motor de cálculo (`src/lib/markup-motor-calculo.ts` /
`supabase/functions/_shared/markup-motor-calculo.ts`) e os prompts da IA de composição de markup
(`markup-ia-verificacao.ts`, `markup-cortecloud.ts`). Objetivo: quantidade de material EXATA, com
fórmulas e faixas rastreáveis a uma fonte, em vez de a IA "chutar" números.

## 1. O que é uma caixaria

Caixaria é a estrutura de um módulo de marcenaria — as peças de chapa que formam o "caixote" antes de
portas/gavetas/acabamento:

| Peça | Espessura | Papel |
|---|---|---|
| Laterais (2 por módulo) | 15mm | Estrutural — sustenta o peso do móvel |
| Base + tampo/prateleiras | 15mm | Estrutural |
| Fundo | 6mm | Não estrutural — só fecha o móvel por trás |
| Portas / frentes / gavetas | 18mm | Peça visível, recebe dobradiça e puxador |

Fontes: [Club ArqExpress](https://clubarqexpress.com.br/blogs/clubarqexpress/voce-sabe-especificar-chapas-de-mdf),
[Duratex](https://www.duratex.com.br/blog/conheca-as-espessuras-de-mdf-existentes-e-saiba-como-usa-las),
[Blog Viana Franco](https://blog.vianafranco.com.br/2020/09/16/as-diferentes-espessuras-do-mdf-nos-moveis-planejados/),
[Bella Casa Marcenaria](https://bellacasamarcenaria.com.br/post/mdf-de-15mm-ou-18mm-entenda-a-diferenca/61/).
Todas convergem no mesmo padrão: **6mm para fundos, 15mm para caixaria/estrutura, 18mm para portas e
frentes**. O 15mm é preferido para a estrutura em vez do 18mm por ter mais massa (maior densidade linear:
~670 kg/m³ vs ~660 kg/m³) e menor grau de curvatura; o 18mm compensa isso na porta por aguentar mais
tração de parafuso/dobradiça.

Isso já bate com os defaults de `markup_regras_construtivas` (migration
`20260917150000_markup_regras_construtivas.sql`): `espessura_corpo_mm=15`, `espessura_porta_mm=18`,
`espessura_fundo_mm=6`.

## 2. Chapa padrão e cálculo de quantidade

Formato comercial padrão: **2,75m × 1,84m = 5,06m²** por chapa inteira. Confirmado por fabricante
(Masisa: "Formato 1,84 x 2,75 mm em espessuras de 5,5 a 30mm") e por revenda
([Mercado Livre](https://lista.mercadolivre.com.br/chapa-mdf-15mm-2.75-x-1.84),
[PlanoCorte](https://planosdecorte.com.br/blog/medidas-padrao-chapas-mdf-mdp),
[Duratex — guia de plano de corte](https://www.duratex.com.br/blog/guia-plano-de-corte-de-mdf-para-marcenaria)).
Existem variações por fabricante (2,44×1,22m, 2,75×2,10m para peças longas), mas 2,75×1,84m é o formato
mais citado e é o já usado como `area_chapa_padrao_m2` default na tabela de regras.

**Percentual de perda de corte**: a pesquisa NÃO encontrou um percentual padronizado de mercado — cada
fonte trata isso como "depende do plano de corte" sem número fixo. O `perda_chapa_pct = 20` usado no
motor de cálculo vem do documento de referência interno do projeto
(`docs/sistemadeprecificacaocomia.md`, não de uma norma externa) — é uma margem de segurança de compra,
não uma medição de mercado. Vale revisar esse número com o histórico real de compras da empresa se
houver dados (quanto sobrou vs. quanto foi comprado nos últimos orçamentos).

Fórmula usada (motor de cálculo + glossário injetado na IA):
```
área_bruta_m² = Σ(comprimento_mm × largura_mm / 1_000_000 × quantidade)  [por grupo de espessura]
área_com_perda = área_bruta × (1 + perda_chapa_pct/100)
chapas_inteiras = ceil(área_com_perda / area_chapa_padrao_m2)
```

## 3. Corrediças — tamanhos comerciais fixos

Corrediças (telescópicas ou ocultas) são vendidas em uma linha fixa de tamanhos, não em qualquer
medida. Confirmado em múltiplos fornecedores:
- [Tudo na Mão](https://www.tudonamao.net.br/componentes-para-moveis/corredicas-dobradicas-e-pistoes/corredica-telescopica-zincada-para-gaveta-ate-40kg) (H45): 250/300/350/400/450/500/550/600mm
- [Soprano](https://loja.soprano.com.br/kit-4-pares-corredica-telescopica-larga-45x500mm-06803-0455-13/p): mesma linha de 8 medidas, 250–600mm
- [Desicon](https://www.desicon.com.br/corredica-telescopica-30cm) (H35, mais leve): mesma linha 250–600mm
- [Helos Concept](https://helosconcept.pt/categoria-produto/ferragens/corredicas/) (ocultas com amortecedor): 250–550mm

Padrão de mercado: **250, 300, 350, 400, 450, 500, 550, 600mm**, em passos de 50mm — exatamente o que
`CORREDICA_TAMANHOS_COMERCIAIS_MM` usa no motor de cálculo. Uma corrediça "de 483mm" pedida por uma
fórmula sem arredondamento simplesmente não existe pra comprar; por isso
`arredondarParaTamanhoComercialCorredica()` sempre arredonda pro tamanho comercial mais próximo que
ainda cabe no espaço disponível (nunca pro tamanho maior, que não encaixaria na caixa).

## 4. Escolha de modelo OpenAI para documentos densos (Cortecloud)

Um benchmark dedicado a tabelas densas e desenhos técnicos
([BusinessWare Tech](https://www.businesswaretech.com/blog/benchmarking-ai-on-tables-and-engineering-drawings-results-findings))
encontrou que o **GPT-4o "underperformed drastically"**, com dificuldade para manter a estrutura de
tabela mesmo em layouts moderadamente complexos — achado que os autores destacam como a "maior
surpresa" do estudo. O benchmark não incluiu GPT-4.1 diretamente (comparou GPT-4o, GPT-4o Mini, Gemini,
Claude Opus, Grok, Pixtral, Qwen VL Plus); Gemini liderou nesse teste específico, mas não é uma opção
disponível na allowlist deste projeto (`MARKUP_IA_ALLOWED_MODELS`).

Para GPT-4.1 especificamente, os números disponíveis são de benchmarks gerais de documento
denso/multimodal, não de desenhos técnicos: no MMMU (perguntas dependentes de imagem), GPT-4.1 marca
74,8% contra 68,7% do GPT-4o; uma avaliação interna citada pela OpenAI
([anúncio oficial do GPT-4.1](https://openai.com/index/gpt-4-1/)) encontrou 50% de melhora na recuperação
de dados densos em documentos grandes. Não é uma prova direta de que o 4.1 lê melhor uma planilha
Cortecloud com muitas linhas — mas é consistente com a hipótese, e é a melhor opção já disponível na
allowlist deste projeto para esse tipo de documento.

**Recomendação prática**: para leads com planilha Cortecloud densa (muitas linhas de material), preferir
`gpt-4.1` no seletor de modelo por composição (`MarkupCalculatorSheet.tsx`) em vez do padrão `gpt-4o`.
Isso já é possível hoje (Epic 1 do PRD) — não requer nenhuma mudança de código, só escolha no dropdown.

## 5. Categoria "Pedras e Bancadas" — lacuna real encontrada

A checklist de verificação (`MARKUP_IA_VERIFICACAO_PADRAO` / config salva em
`emp_garbo.markup_config.markup_ia_verificacao`) tinha 6 categorias, todas de MDF/ferragem — nenhuma
para granito, mármore, quartzo ou porcelanato de bancada. Em um teste real (lead 10482, orçamento com
planilha Cortecloud de mármore), isso é uma causa plausível de subcontagem: a IA lê uma planilha inteira
sobre pedra e não tem onde encaixar essas linhas como material MDF, então tende a tratá-las como
"referência" ou ignorar. Corrigido nesta sessão: nova categoria `pedras_bancadas` adicionada ao código
(default para tenants novos) e à config já persistida deste tenant
(`scripts/apply-markup-checklist-pedras-bancadas.mjs`, aplicado em produção), com dica explícita no modo
Cortecloud: "mesmo que o documento inteiro seja sobre pedra, essas linhas SÃO material".

## 6. Onde cada coisa vive no código

| Conceito | Arquivo |
|---|---|
| Fórmulas de chapa/corrediça/dobradiça/fita | `src/lib/markup-motor-calculo.ts` + cópia `_shared/` |
| Glossário de caixaria injetado na IA (categoria chapas_mdf) | `getCaixariaGlossarioHint()` em `_shared/markup-ia-verificacao.ts` |
| Categorias do checklist (incl. pedras_bancadas) | `MARKUP_IA_VERIFICACAO_PADRAO` em `markup-ia-verificacao.ts` (client + server) |
| Dica Cortecloud por categoria (incl. pedras_bancadas) | `getCortecloudInventarioHint()` em `markup-cortecloud.ts` (client + server) |
| Regras construtivas editáveis (espessuras, folgas, % perda) | `emp_garbo.markup_regras_construtivas` + UI `MarkupRegrasConstrutivasEditor.tsx` |
