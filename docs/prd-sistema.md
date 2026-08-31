# PRD — Reconstrução do CRM Selletos (Multi-empresas)

**Produto:** CRM Selletos  
**Versão:** 1.0  
**Data:** 27/08/2026  
**Status:** Documentação retrospectiva do sistema em produção — receita para reconstruir  
**Público:** quem for refazer o produto (produto, design, engenharia)  
**Ambiente de referência:** web Vite/React na porta 3000 (`pnpm dev`)

Este é o **índice mestre**. Leia nesta ordem: visual → arquitetura → telas → módulos de negócio → mobile → checklist.

---

## 1. O que este PRD é (e o que não é)

Este conjunto descreve **como o sistema funciona hoje**, com detalhes suficientes para:

- clonar a identidade visual (fontes, cores, sombras, vidro, composição);
- reconstruir as rotas e os papéis de acesso;
- entender o que cada tela faz, de onde vêm os dados e quais regras vale a pena copiar.

Não é um pitch de produto novo. Não substitui o código. Quando um módulo já tem PRD próprio, este índice **aponta** para ele em vez de copiar 400 linhas.

---

## 2. Como ler (linguagem simples)

Pense no CRM como um **escritório de mogno e ouro** (Bourbon Daylight):

1. A pessoa entra (login) e o sistema descobre **quem ela é** (papel, empresa, horário).
2. O **menu lateral** mostra só o que aquele papel pode ver.
3. O trabalho do dia a dia acontece no **Pipeline** (quadro de leads) e no **card do lead** (uma ficha grande).
4. Em volta disso existem oficinas: agenda, projetos, contratos, markup, slides de orçamento, marketing, financeiro Pontua Garbo.

Se você for reconstruir, primeiro copie o **DNA visual** (capítulo 01). Depois o **esqueleto** (capítulo 02). Só então pinte cada tela (capítulo 03).

---

## 3. Mapa da pasta

| Arquivo | Conteúdo |
|---------|----------|
| [00-indice.md](00-indice.md) | Capa, glossário, ordem de leitura |
| [01-design-system.md](01-design-system.md) | Fontes, cores, sombras, glass, efeitos — valores exatos |
| [02-arquitetura.md](02-arquitetura.md) | Stack, multi-empresa, auth, RLS, Edge Functions, storage |
| [03-telas/](03-telas/) | Uma ficha por tela (rota ou shell) |
| [04-dominios/](04-dominios/) | Tela → tabelas → funções → regras |
| [05-mobile.md](05-mobile.md) | App Expo: o que espelha o web e o que não clona pixel a pixel |
| [06-checklist-rebuild.md](06-checklist-rebuild.md) | Ordem de reconstrução e “definição de pronto” |

### Telas (`03-telas/`)

| Ficha | Rota / shell |
|-------|----------------|
| [00-shell-main-layout.md](03-telas/00-shell-main-layout.md) | Sidebar + header + ícones flutuantes |
| [01-auth.md](03-telas/01-auth.md) | Login / reset de senha |
| [02-pending-e-horario.md](03-telas/02-pending-e-horario.md) | Acesso pendente e fora do horário |
| [03-pipeline.md](03-telas/03-pipeline.md) | `/pipeline` |
| [04-pipeline-kanban.md](03-telas/04-pipeline-kanban.md) | `/pipeline/:kanbanSlug` |
| [05-pipeline-config.md](03-telas/05-pipeline-config.md) | `/pipeline/configuracoes` |
| [06-lead-modal.md](03-telas/06-lead-modal.md) | Ficha do lead (não é rota) |
| [07-leads.md](03-telas/07-leads.md) | `/leads` |
| [08-projetos.md](03-telas/08-projetos.md) | `/projetos` |
| [09-agenda.md](03-telas/09-agenda.md) | `/agenda` |
| [10-prestador.md](03-telas/10-prestador.md) | Portal do prestador |
| [11-admin.md](03-telas/11-admin.md) | `/admin` e subpáginas |
| [12-contratos.md](03-telas/12-contratos.md) | `/contratos*` |
| [13-markup.md](03-telas/13-markup.md) | `/markup*` |
| [14-orcamento-slides.md](03-telas/14-orcamento-slides.md) | `/orcamento-slides*` e links públicos |
| [15-marketing.md](03-telas/15-marketing.md) | Conteúdo, disparos, apresentações Garbo |
| [16-eventos-gastos.md](03-telas/16-eventos-gastos.md) | Eventos e gastos |
| [17-financeiro.md](03-telas/17-financeiro.md) | `/financeiro` Pontua Garbo |
| [18-publicas.md](03-telas/18-publicas.md) | Agendar, cadastros, 404, perfil, biblioteca, automações |
| [19-webhooks-automacoes.md](03-telas/19-webhooks-automacoes.md) | Webhooks e negativação |

### Domínios (`04-dominios/`)

| Capítulo | Módulo |
|----------|--------|
| [leads-pipeline.md](04-dominios/leads-pipeline.md) | Leads, kanban, origens, métricas |
| [projetos.md](04-dominios/projetos.md) | Ateliê / prancheta |
| [agenda.md](04-dominios/agenda.md) | Ponte para o PRD de 01/08/2026 |
| [contratos.md](04-dominios/contratos.md) | Contratos e modelos |
| [markup.md](04-dominios/markup.md) | Ponte para o PRD de 26/08/2026 |
| [orcamento-slides.md](04-dominios/orcamento-slides.md) | Ponte para o PRD de 12/06/2026 |
| [lead-ia.md](04-dominios/lead-ia.md) | Análise, Iris Sky, render, ambiente |
| [marketing.md](04-dominios/marketing.md) | Conteúdo + WhatsApp |
| [eventos-gastos.md](04-dominios/eventos-gastos.md) | Eventos e planilha de gastos |
| [pontua-prestador.md](04-dominios/pontua-prestador.md) | Comissões, saques, portal |
| [admin-multi-empresa.md](04-dominios/admin-multi-empresa.md) | Usuários, marca, empresas |
| [automacoes.md](04-dominios/automacoes.md) | Negativação e webhooks |
| [biblioteca-cadastros.md](04-dominios/biblioteca-cadastros.md) | Mídias e formulários públicos |

### PRDs já existentes (não duplicar)

- Agenda: `docs/prd/2026-08-01-agenda-e-notificacoes-prd.md`
- Lousa: `docs/prd/2026-08-03-lousa-whiteboard-prd.md`
- Orçamento slides: `docs/prd/2026-06-12-orcamento-slides-prd.md`
- Markup (sincronia): `docs/prd/2026-08-26-markup-sincronizacao-sistema-externo-prd.md`
- Pipeline (otimização): `docs/prd/2026-08-14-otimizacao-pipeline-crm-prd.md`

---

## 4. Glossário curto

| Termo | Significado em linguagem simples |
|-------|----------------------------------|
| **Lead** | Pessoa ou empresa em negociação. Mora no quadro e na ficha. |
| **Kanban / Pipeline** | Quadro com colunas. Cada coluna é um estágio (ex.: Novo Lead). |
| **Schema `emp_*`** | “Caderno” isolado de uma empresa no banco (ex.: `emp_garbo`). |
| **Master** | Tabelas no schema `public` com nomes `CRM-multi-empresas>tabela<`. |
| **Papel** | `admin`, `vendedor`, `projetista`, `projetista_admin`, `marketing`, `nenhum`. Uma pessoa pode ter vários. |
| **Prestador** | `tipo_usuario = prestador_servico`. Entra num portal próprio, sem menu lateral. |
| **Bourbon Daylight** | Nome do visual: mogno `#2a1812` + ouro `#f2d892`. |
| **Glass** | Superfície semi-transparente com desfoque (blur) e borda dourada. |
| **Pontua Garbo** | Programa de comissão para arquitetos / parceiros. |
| **Markup** | Caderno de custo interno de marcenaria (não é o slide de orçamento do cliente). |

---

## 5. Fonte da verdade no código

| Assunto | Arquivo |
|---------|---------|
| Rotas e guards | `src/App.tsx` |
| Menu | `src/lib/app-navigation.ts` + `src/components/layout/AppSidebar.tsx` |
| Papéis | `src/lib/app-roles.ts` |
| Tokens visuais | `src/index.css` + `tailwind.config.ts` |
| Fontes | `index.html` |
| Multi-empresa | `src/lib/empresa-tables.ts` + `src/contexts/EmpresaContext.tsx` |
| Funções de backend | `supabase/functions/` |

---

## 6. Princípio de reconstrução

1. **Um visual só** — copie os tokens do capítulo 01 antes de desenhar telas.
2. **Auth em camadas** — login ≠ papel ≠ tipo de usuário ≠ horário ≠ permissão de campo.
3. **Tenant primeiro** — toda query de negócio precisa saber a empresa ativa (`emp_*` ou master).
4. **Não copiar legado cego** — nomes `CRM-Selletos>`, Stripe/Mercado Pago da escola ProForco e buckets antigos não fazem parte do CRM atual.
5. **Telas densas primeiro** — Pipeline + LeadModal resolvem 70% do dia a dia comercial.
