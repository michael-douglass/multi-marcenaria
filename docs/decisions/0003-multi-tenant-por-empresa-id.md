# 0003 — Multi-tenant por `empresa_id` + RLS, com o CRM num schema compartilhado `crm`

**Status:** Aceita
**Data:** 2026-11-17

## Contexto

O sistema nasceu para uma marcenaria só (Garbo) e vai virar uma plataforma SaaS para várias
marcenarias, com um usuário master que acessa todas, um Painel Master e um Financeiro Master com
bloqueio por inadimplência (`docs/multi-empresa/REQUIREMENTS.md`).

Hoje convivem dois modelos de separação, nenhum completo:

- o **núcleo** (61 tabelas `movelaria_*` em `public`) não tem coluna de empresa — tudo é da Garbo;
- o **CRM** (129 tabelas) vive no schema `emp_garbo`, num desenho "schema por empresa" que nunca foi
  ligado de verdade: `EmpresaContext` tem constantes fixas, ~90 funções SQL citam `'emp_garbo'`
  literalmente e a identidade (`movelaria_obter_minha_identidade`) lê `emp_garbo.*` direto.

Há ainda brechas de RLS (tabelas financeiras abertas a `anon`, 64 policies `USING (true)` no CRM,
`create-user-admin` sem checagem de papel). O banco novo (`vejugdspjfgfajdpfiht`) ainda não tem
dados, o que torna barato adicionar colunas `NOT NULL` agora.

## Decisão

Todo dado de tenant é isolado **por linha**: cada tabela recebe
`empresa_id uuid not null default app_empresa_atual() references empresas(id)`, e toda policy de RLS
filtra por `empresa_id = public.app_empresa_atual()`. Essa função resolve a empresa do usuário
(`usuario_empresa`) ou a escolhida pelo master (`plataforma_master_contexto`) e devolve `NULL` para
empresa bloqueada ou inativa.

O schema `emp_garbo` é **renomeado para `crm`** e passa a ser compartilhado por todas as empresas,
também filtrado por `empresa_id`. O front do CRM continua chamando `supabase.schema(schemaEmpresa)`,
agora sempre com `'crm'`.

## Alternativas rejeitadas

- **Híbrido (núcleo por `empresa_id`, CRM por schema `emp_<slug>`):** mantém dois mecanismos de
  isolamento, exige criar e migrar um schema inteiro a cada empresa nova, multiplica o SQL dinâmico
  por schema nas funções e nas edge functions e deixa o Painel Master com consultas agregadas
  atravessando N schemas. Não resolve as brechas de RLS por si.
- **Schema por empresa para tudo (núcleo incluído):** isolamento forte, mas cada empresa nova vira
  DDL (≈190 tabelas, funções, policies, grants, exposição na API via Management API), toda migration
  futura precisa rodar em N schemas, e o PostgREST precisa de cada schema na lista de expostos. O
  custo operacional cresce linearmente com o número de clientes, o oposto do que um SaaS precisa.

## Consequências

- **Mais fácil:** criar empresa vira inserir linhas (`plataforma_seed_empresa`); migrations rodam uma
  vez; o Painel Master agrega com `GROUP BY empresa_id`; bloqueio por inadimplência é aplicado pelo
  próprio RLS (a função devolve `NULL`).
- **Mais difícil:** o isolamento depende de toda tabela de tenant ter `empresa_id` e policy correta —
  uma tabela nova sem isso vaza dados. Mitigação: gerador de migration a partir do catálogo, teste de
  isolamento (`scripts/multi-empresa/test-isolamento.mjs`) e `get_advisors` a cada mudança.
- Unicidades e PKs "por instalação" (singletons, numeração de contratos/orçamentos, config de agenda)
  passam a ser compostas com `empresa_id`.
- Funções `SECURITY DEFINER` ignoram RLS: cada uma precisa filtrar por `app_empresa_atual()` explicitamente.
- Cada usuário pertence a uma única empresa (`unique(user_id)` em `usuario_empresa`); só o master acessa várias.
- Links públicos passam a identificar a empresa pelo slug, não pelo nome do schema; a rota antiga
  `/orcamento/:schema/:id` fica por compatibilidade.
- As tabelas master legadas `"CRM-multi-empresas>X<"` saem do caminho, exceto `empresas`,
  `usuario_empresa` e `super_admins`, que viram tabelas de plataforma.
