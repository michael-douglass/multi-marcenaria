# REQUIREMENTS — GARBO Movelaria multi-empresas (SaaS para marcenarias)

> O quê e por quê. O como está em [`DESIGN.md`](./DESIGN.md); o passo a passo, em [`TASKS.md`](./TASKS.md).
> Decisão arquitetural registrada em [`docs/decisions/0003-multi-tenant-por-empresa-id.md`](../decisions/0003-multi-tenant-por-empresa-id.md).

## 1. Contexto

Hoje o sistema atende uma marcenaria só (Garbo). A meta é virar uma plataforma onde:

- cada marcenaria tem o próprio sistema isolado: painel, dashboard, vendedores, projetistas,
  financeiro, obras, ponto etc.;
- **selvomichael@gmail.com** é o **usuário master** e acessa todas as empresas;
- existe um **Painel Master**: criar empresas e definir o admin de cada uma; ver o total de empresas
  e, por empresa, admin, nº de usuários e faturamento;
- existe um **Financeiro Master**: mensalidade de cada empresa, com baixa manual, formas de pagamento
  cadastráveis e **bloqueio automático por inadimplência**.

### 1.1 O que já existe no banco, mas está desligado no app

- tabela `public."CRM-multi-empresas>empresas<"`;
- vínculo usuário→empresa `public."CRM-multi-empresas>usuario_empresa<"`;
- tabela `public."CRM-multi-empresas>super_admins<"` e as funções `me_is_super_admin`, `me_criar_empresa`;
- a tela `src/pages/admin/GerenciamentoEmpresas.tsx`, que não está roteada
  (`/admin/empresas` redireciona para `/admin/marca` em `src/App.tsx:537`).

### 1.2 O que está travado na Garbo

- `src/contexts/EmpresaContext.tsx:23-80`: constantes fixas e `isSuperAdmin: false`;
- `src/lib/empresa-tables.ts:2` (`API_EXPOSED_SCHEMAS`);
- a RPC `movelaria_obter_minha_identidade`, usada por `src/hooks/useAuth.ts:77`, lê `emp_garbo.*` direto;
- cerca de 90 funções SQL com `'emp_garbo'` escrito no código;
- `orcamentos_ia_tenant_company_id()` devolve uma constante.

### 1.3 O que não tem coluna de empresa

- as 61 tabelas `movelaria_*` (núcleo);
- as 129 tabelas do CRM ficam no schema `emp_garbo`, e a única separação entre empresas é o próprio schema.

### 1.4 Brechas de segurança atuais

- 7 tabelas financeiras (`clientes`, `contas_pagar`, `contas_receber`, `fornecedores`, `pedidos`,
  `pedidos_itens`, `produtos`) aceitam até `anon`;
- 64 policies do CRM usam `USING (true)`;
- a edge function `create-user-admin` não confere o papel de quem chama.

### 1.5 Por que agora

O banco novo (`vejugdspjfgfajdpfiht`) ainda **não tem dados**, só a linha da empresa Garbo (fase C de
`docs/TASKS.md`). Pôr `empresa_id NOT NULL` agora não exige migrar dados.

## 2. Decisões do usuário

1. **Isolamento: tudo por `empresa_id`**, com RLS por empresa. Fim do schema por empresa.
2. **Cada usuário pertence a uma única empresa.** Só o master acessa todas, por um seletor.
3. **Mensalidade:** controle manual com bloqueio automático por atraso; o master pode liberar.
4. **A migração pendente (T11, T13, T14 de `docs/TASKS.md`) entra neste plano.** O primeiro admin
   da T11 vira o master.

## 3. Requisitos funcionais

### RF1 — Isolamento por empresa
- Todo dado de tenant (núcleo, CRM, Corte Claude, storage) pertence a exatamente uma empresa.
- Um usuário comum só lê e escreve dados da própria empresa; isso é garantido pelo banco (RLS), não pelo front.
- `anon` não lê nenhuma tabela de tenant, exceto pelos fluxos públicos explícitos (orçamento, agenda,
  cadastro), resolvidos pelo slug da empresa.

### RF2 — Usuário master
- `selvomichael@gmail.com` é o master: vê todas as empresas, troca a empresa ativa por um seletor e
  nunca é bloqueado.
- Ao trocar de empresa, os dados exibidos mudam sem misturar cache entre empresas.

### RF3 — Painel Master (`/master`)
- Criar empresa com o admin dela (e-mail e senha) em um passo, com o seed inicial da empresa.
- Ver total de empresas (ativas e bloqueadas), total de usuários, faturamento somado, MRR e inadimplência.
- Por empresa: nome, status, plano, admin(s), nº de usuários, faturamento no período e situação da mensalidade.
- Detalhe da empresa: dados cadastrais, admin (trocar, resetar senha), usuários, histórico de
  cobranças e ações (ativar, bloquear, liberar, entrar na empresa).

### RF4 — Financeiro Master (`/master/financeiro`)
- Cadastro de planos, formas de pagamento (seed: Pix, Boleto, Cheque, Dinheiro, Cartão) e assinaturas.
- Geração mensal automática de cobranças; baixa manual com forma de pagamento, data e valor.
- Bloqueio automático quando o atraso passa da tolerância (padrão 10 dias) e não há liberação vigente.
- Baixa desbloqueia a empresa na hora; o master pode liberar até uma data.

### RF5 — Empresa bloqueada
- Usuários de empresa bloqueada ou inativa veem uma tela de acesso suspenso com contato, e a API
  devolve vazio para eles.

### RF6 — Fechamento da migração do banco novo
- Primeiro admin (master), cópia das configurações da Garbo, deploy das edge functions e smoke test
  (antigas T11, T13, T14).

## 4. Fora de escopo

- Cobrança automática por gateway de pagamento (boleto/Pix gerado pela plataforma). O controle é manual.
- Um usuário pertencer a mais de uma empresa (só o master acessa várias).
- Migração de dados do banco antigo além das configurações escolhidas na M29.

## 5. Critérios de sucesso (verificação ponta a ponta)

1. `pnpm build` passa a cada tarefa.
2. **Teste de isolamento** (`scripts/multi-empresa/test-isolamento.mjs`, `node --env-file=.env`):
   - criar as empresas A e B, cada uma com seu admin;
   - logado como admin A, inserir lead, obra e conta a receber;
   - logado como admin B, `select` nessas tabelas devolve 0 linhas, e `update`/`delete` por id da A afetam 0 linhas;
   - `anon` não lê nenhuma tabela `movelaria_*`;
   - storage de B não lista nem baixa arquivos de A.
3. **Master:**
   - vê as duas empresas em `/master`, com admin, nº de usuários e faturamento que batem com as
     contas recebidas lançadas;
   - "entrar na empresa" troca os dados exibidos sem misturar o cache.
4. **Bloqueio:** criar uma cobrança vencida além da tolerância e rodar `plataforma_atualizar_inadimplencia()`:
   - o admin da empresa vê a tela de acesso suspenso, e a API devolve vazio;
   - dar baixa reativa a empresa na hora.
5. `get_advisors` (security) sem novas tabelas sem RLS e sem policies `true` em tabela de tenant.
6. `grep -r "emp_garbo"` em `src/`, `supabase/functions/` e nas funções do banco (`pg_proc.prosrc`)
   sem resultado, exceto em migrations antigas.
