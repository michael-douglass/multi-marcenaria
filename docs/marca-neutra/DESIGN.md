# Página Pontua e sistema sem "Garbo" — Design

> Requisitos: [`REQUIREMENTS.md`](./REQUIREMENTS.md) · Tarefas: [`TASKS.md`](./TASKS.md)

## 1. Estado levantado (2026-11-19, somente leitura)
- **Banco novo antes da produção:** 2 usuários; leads, campos, tabelas do Pontua, contas a pagar e clientes vazios. Por isso as renomeações são diretas, sem fase de compatibilidade. Migration, edge functions e front precisam ser publicados juntos.
- **Front:** cerca de 1.400 ocorrências em 192 arquivos e 49 arquivos com o nome. Os grupos:
  - marca padrão (manifesto, título, logo);
  - textos fixos usados quando falta o nome da empresa nos PDFs;
  - o valor gravado `'Pontua Garbo'`;
  - o id de página `pontuaGarbo`;
  - chaves de localStorage;
  - ids do DOM;
  - a pasta `public/imagens/apresentacao-garbo/`.
- **Banco:**
  - tabelas `pontua_garbo_*`;
  - colunas `config_pontua_garbo`, `pontua_garbo_percentual` e `leads.pontua_garbo_usuario_id`;
  - 4 funções e 1 trigger com o nome, e 15 funções com o nome no corpo;
  - índices `idx_garbo_*`;
  - default `'GARBO MOVELARIA'`;
  - recibo com o nome fixo.
- **Empresa-modelo "Marcenaria":**
  - apresentação e Pontua com textos da Garbo;
  - 4 contratos com o CNPJ, o CPF e o endereço da Garbo;
  - bloco de garantia dos slides com o nome;
  - 6 imagens apontando para os arquivos da Garbo;
  - campo e serviço chamados `'Pontua Garbo'`.

## 2. Página Pontua
- O componente da apresentação ganha `somentePontua`. Com ele, a página mostra só a seção do Pontua, a navegação usa `PONTUA_NAV`, o carregamento mostra "Pontua" e não há formulário de parceria.
- O h2 usa `pontua.title`; o padrão neutro é "Programa de pontuação para parceiros". A chave `title` salva é removida, porque o campo nunca apareceu na tela.
- O id de página `pontuaGarbo` vira `pontua`. A migration troca esse id em `plataforma_planos.paginas_bloqueadas` e `plataforma_empresa_paginas.pagina_id`.
- O link público `/apresentacao/:slug/pontua` reaproveita a RPC `apresentacao_publica`.
- Editor do Pontua: os campos compartilhados vão para `editor-campos.tsx`. O salvamento é parcial: o upsert envia só a coluna da tela.

## 3. Marca neutra
- `APP_SYSTEM_NAME = 'Gestão'`; o monograma fica em `public/imagens/marca-padrao.svg`, com ícones PNG gerados a partir dele.
- Depois do login, `document.title` passa a ser o nome da empresa.
- PDFs e páginas usam `empresaDocumento()`/`useEmpresaIdentidade()`, sem texto fixo.

## 4. Banco
- Renomes:
  - `crm.pontua_garbo_lancamentos` → `crm.pontua_lancamentos`;
  - `crm.pontua_garbo_comissao_liberacoes` → `crm.pontua_comissao_liberacoes`;
  - as gêmeas legadas em `public` seguem o mesmo padrão;
  - colunas: `config_pontua`, `pontua_percentual`, `pontua_usuario_id`;
  - funções `*_pontua_garbo` → `*_pontua`;
  - índices `idx_garbo_*` → `idx_*`.
- As funções que citam os nomes antigos são recriadas.
- Os valores `'Pontua Garbo'` passam a ser `'Pontua'`, e `'Lead Garbo'` passa a ser `'Lead'`.
- O recibo usa o nome da empresa.
- A empresa-modelo recebe o conteúdo neutro, gerado a partir do TS por script.

## 5. Riscos
- **Nomes gravados no banco:** se o front, o banco e as edge functions forem publicados em momentos diferentes, os nomes não batem. Por isso a publicação é conjunta. Edge functions a publicar: `create-user-admin`, `register-public`, `rep-gerar-comprovante`, `orcamentos-ia-chat` e `compose-markup-ia`.
- **Chaves de localStorage renomeadas:** zeram uma vez o cache e as preferências locais.
- **Links antigos:** `/marketing/pontua-garbo` era só interno e passa a cair na tela inicial. O link `/apresentacao/garbo` continua funcionando, porque `garbo` é o slug da empresa.
