# 0002 — O motor de cálculo determinístico passa a decidir a quantidade de material

**Status:** Aceita
**Data:** 2026-09-18

## Contexto

Hoje a fase "Inventariante" do pipeline decide a quantidade de cada material (chapas, dobradiças,
fita de borda, parafusos) lendo o documento anexado em texto livre e "chutando" o número via LLM.
Existe, em paralelo, um motor de cálculo determinístico (`src/lib/markup-motor-calculo.ts` + espelho
`_shared/`) que já implementa as fórmulas corretas (área bruta → chapas inteiras com % de perda;
metros de fita de borda; corrediça em tamanho comercial fixo; dobradiça por faixa de altura) — mas
ele nunca foi ligado como fonte de verdade. Isso ficou registrado como "decisão de risco" pendente em
`docs/prd-markup-ia-composicao-visual.md`: religar essa lógica dentro de um arquivo de 1.813 linhas,
sem suíte de testes, servindo orçamentos reais, exigiria um teste ponta-a-ponta que só é possível com
deploy real.

Testes reais subsequentes confirmaram o custo de não ter feito essa troca: a quantidade de material
saiu bem abaixo do esperado em pelo menos duas rodadas de teste ao vivo (lead 10482), mesmo após
correções pontuais (glossário de caixaria, categoria Pedras e Bancadas, fallback de
`totais_consolidados`). A causa recorrente é a mesma: pedir para a LLM decidir uma conta em texto
livre, em vez de calculá-la em código a partir de dados que a própria IA já extrai bem (dimensões,
tipologia).

## Decisão

O **motor de cálculo determinístico decide a quantidade de material**. O papel da IA na fase
Inventariante deixa de ser "decidir quantas peças" e passa a ser "extrair dimensão, tipologia e
tipo de acabamento" — dados que alimentam o motor. O motor, por sua vez, é alimentado pelas regras
construtivas editáveis (`markup_regras_construtivas`), não por números fixos no código.

Isso corresponde à "Opção B" descrita no PRD anterior como a escolha que de fato aproveita as
fórmulas do documento de referência do usuário (`docs/sistemadeprecificacaocomia.md`), em vez de
deixar a LLM "chutar" a conta.

## Consequências

- Elimina a classe de erro observada nos testes (aritmética incorreta da LLM em texto livre).
- Reduz o número de chamadas OpenAI por composição (a fase Inventariante não precisa mais "pensar"
  a conta, só extrair dados) — mitiga parte do risco de custo já sinalizado no PRD anterior (Epic 5).
- Todo resultado do motor precisa continuar rastreável e editável na revisão humana (ex.: "3
  dobradiças — regra: até 1600mm"), não uma caixa preta.
- Como o cenário Cortecloud (planilha do fornecedor com `QUANT` real) já é a fonte mais confiável
  quando existe, a especificação (`specs/orcamento-com-ia/REQUIREMENTS.md`) precisa definir a relação
  entre planilha real e motor de fórmula — isso está registrado ali como requisito funcional, não
  reaberto aqui.
- Exige reescrever a decisão de quantidade dentro de `compose-markup-ia/index.ts`, um arquivo grande
  sem suíte de testes automatizada — a verificação depende de teste manual ponta-a-ponta contra o
  ambiente real (consistente com o guardrail já documentado em `docs/tech.md`).
