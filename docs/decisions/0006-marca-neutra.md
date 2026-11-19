# 0006 — O sistema não tem marca de cliente; a Garbo é uma empresa

**Status:** Aceita
**Data:** 2026-11-19

## Contexto
O sistema nasceu como ferramenta interna da Garbo Movelaria e virou uma plataforma multi-empresa (ADR 0003). O nome "Garbo" continuava em vários lugares:
- na marca do app (título, PWA, logo);
- nos textos que aparecem quando a empresa não tem nome;
- no Pontua (rota, título e o valor gravado `'Pontua Garbo'`);
- em nomes de tabelas, colunas e funções do banco;
- nos dados importados para a empresa-modelo, incluindo o CNPJ e o CPF da Garbo nos contratos.

## Decisão
- A plataforma não tem marca própria fixa. Depois do login, mostra o nome e a logo da empresa. Antes do login e no PWA, usa o rótulo genérico "Gestão" com um monograma neutro.
- "Garbo" sai do código, dos assets, das edge functions e do esquema do banco. Os nomes de tabelas, colunas e funções do Pontua passam a ser `pontua_*`, e o valor gravado passa a ser `'Pontua'`.
- A renomeação no banco é feita **de uma vez, sem fase de compatibilidade**, porque o banco novo ainda não está em produção. A migration, as edge functions e o front são publicados juntos.
- As migrations já aplicadas não são editadas: elas guardam o nome antigo como histórico.
- A Garbo continua como empresa cliente: o nome, o slug `garbo` e os dados próprios dela ficam como estão.

## Consequências
- Qualquer empresa pode receber os modelos sem herdar a marca nem os dados de outra.
- Links internos antigos (`/marketing/pontua-garbo`) deixam de existir.
- As chaves de localStorage renomeadas zeram uma vez o cache local.
- Código novo não deve citar o nome de nenhuma empresa cliente. Quando o nome da empresa faltar, o código usa a identidade da empresa ativa (`useEmpresaIdentidade`/`empresaDocumento`).
