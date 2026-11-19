# Página Pontua e sistema sem "Garbo" — Requisitos

> Design: [`DESIGN.md`](./DESIGN.md) · Tarefas: [`TASKS.md`](./TASKS.md) · ADR [0006](../decisions/0006-marca-neutra.md)

## Por quê
O sistema passou a atender várias empresas (marcenarias, gráficas e outros prestadores). Mesmo assim, o nome "Garbo" ainda aparecia na marca do app, nos PDFs, no Pontua, no banco e nos dados da empresa-modelo. Toda empresa que recebesse um modelo herdaria esse nome e, nos contratos, até o CNPJ e o CPF da Garbo. A Garbo continua como **empresa cliente**: o nome, o slug e os dados próprios dela continuam no banco.

## O que muda
1. **Página Pontua**
   - A rota passa a ser `/marketing/pontua` (antes `/marketing/pontua-garbo`) e o nome no menu passa a ser "Pontua".
   - A página mostra só o programa, da dobra "PROGRAMA DE PONTUAÇÃO" para baixo: abertura, Como funciona e Painel.
   - O título é **"Programa de pontuação para parceiros"** e pode ser editado.
2. **Nome do programa no resto do sistema**: continua "Pontua {empresa}" (cartões, financeiro, portal).
3. **Link público próprio**: `/apresentacao/:slug/pontua`. O link da apresentação (`/apresentacao/:slug`) continua como está.
4. **Editor próprio do Pontua**: fica em `/marketing/pontua/editar`, com prévia só do Pontua. O "Editar" do Pontua em `/master/modelos` abre essa tela.
5. **Empresa-modelo**
   - A apresentação e o Pontua passam a usar o texto neutro, com `{empresa}`; as fotos continuam.
   - Os contratos usam `{{empresa_*}}` e não têm dados da Garbo.
   - Os slides não têm o texto nem os arquivos da Garbo.
6. **Marca da plataforma**
   - Depois do login, o app mostra o nome e a logo da empresa.
   - Antes do login e no PWA, mostra o rótulo genérico "Gestão" com um monograma simples.
7. **Código e banco**: sem "garbo" em `src/`, `supabase/functions/`, `public/`, `index.html` e `vite.config.ts`. O mesmo vale para os nomes de tabelas, colunas, funções e valores gravados. As migrations já aplicadas são histórico e continuam como estão.

## Critérios de sucesso
- `grep -ri garbo src supabase/functions public index.html vite.config.ts` → 0.
- Nenhum objeto do banco (tabela, coluna, função, trigger, índice, default) tem "garbo" no nome ou no corpo.
- Os dados da empresa-modelo não têm "garbo".
- `/master/modelos` → Pontua → Editar abre o editor do Pontua, e a prévia mostra só o programa.
- As suítes `test-plataforma.sql`, `test-isolamento.mjs` e `test-modelos-api.mjs`, `pnpm build`, `check-catalogo` e `check-paginas-visiveis` passam, e o typecheck não tem erro novo.
