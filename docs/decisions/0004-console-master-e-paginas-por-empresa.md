# 0004 — Console Master isolado, inspeção com modo e páginas liberadas por plano/empresa

**Status:** Aceita
**Data:** 2026-11-17

## Contexto

Com a plataforma multi-empresa (ADR 0003), o Painel Master rodava dentro do app da marcenaria: mesmo
layout, sidebar, popups e providers do CRM e das Obras. Trocar de empresa servia ao mesmo tempo para
"administrar a plataforma" e para "trabalhar dentro de uma empresa". O master pediu um ambiente só
dele, entrar nas marcenarias para verificar as operações e controlar quais páginas cada marcenaria usa.

## Decisão

1. **Console separado no roteamento:** `/master*` renderiza `MasterApp` (lazy) fora do
   `AuthenticatedApp`, com layout próprio e sem providers da empresa. O master só vê telas de uma
   marcenaria depois de "Entrar".
2. **Inspeção com modo, aplicado no banco:** `plataforma_master_contexto.somente_leitura` mais uma
   policy RESTRICTIVE `tenant_master_leitura` (insert/update/delete) em toda tabela de tenant. Cada
   entrada fica registrada em `plataforma_master_acessos`.
3. **Páginas por lista de bloqueio:**
   - `plataforma_planos.paginas_bloqueadas` mais os ajustes de `plataforma_empresa_paginas`;
   - o catálogo de páginas é derivado do menu (`app-navigation.ts`), sem segunda lista para manter;
   - o bloqueio é aplicado no front (menu, rotas, atalhos) e nas edge functions de IA.

## Alternativas rejeitadas

- **Lista de páginas permitidas:** toda página nova nasceria bloqueada para todas as empresas, o que
  contraria "empresa nova recebe tudo".
- **Bloqueio de página por RLS:** as mesmas tabelas servem várias páginas (ex.: leads aparecem no
  pipeline, nos projetos e nos contratos). Bloquear dados por página quebraria telas liberadas.
  O isolamento entre empresas continua no RLS (ADR 0003). O bloqueio de página é uma regra comercial.
- **App master em outro domínio/build:** isola mais, mas duplica autenticação, deploy e componentes.
  A separação por rota e chunk já evita carregar o app da empresa.

## Consequências

- Rotas novas do app precisam estar no menu, ou em `paginaIdFromPath`, para serem controláveis.
- Tabela de tenant nova precisa também da policy `tenant_master_leitura`, que o gerador
  `gerar-tenant-migration.mjs` (modo `leitura`) cria.
- Função nova do `postgres` que grava dados de empresa precisa checar `app_master_somente_leitura()`.
