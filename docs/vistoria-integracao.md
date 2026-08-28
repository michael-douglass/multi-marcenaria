# Vistoria de integração — Garbo (Casa + CRM)

**Data:** 28/08/2026  
**Quem leu o banco:** Auto (Cursor Grok 4.6), só leitura  
**Plano vivo:** [plano-vistoria-identidade.md](plano-vistoria-identidade.md)

Este caderno responde, em linguagem simples: **o que já está junto, o que falta, e o que é perigoso**.

---

## 1. Identidade (usuários)

A RPC junta as duas fichas **pelo mesmo id de login**. Não achamos e-mail repetido com ids diferentes — ninguém está “partido” em dois logins.

| Classe | Quantos | O que isso significa |
|--------|---------|----------------------|
| Dual (Casa + CRM no mesmo id) | **5** | Duas funções, como pedido |
| Só Casa | **7** | Entram; só vêem fábrica. Sem papel CRM |
| Só CRM | **23** | Todos são **prestador** (portal). Correto: não vêem Caixa |
| E-mail duplicado com ids diferentes | **0** | Nada para fundir no banco |

### Dual (duas funções)

| Pessoa | Função Casa | Função CRM |
|--------|-------------|------------|
| Michael Douglas (`selvomichael@gmail.com`) | Administrador | admin |
| Fabio Faria | Administrador | admin |
| Ana Julia | Administrador de Obras | marketing + vendedor |
| Gabriel | Administrador de Obras + extra Financeiro | projetista_admin |
| Rafaela Cabrera | Montador | marketing + vendedor |

### Só Casa (não receber CRM)

Bruno Henrique (montador admin), João Pedro Braga, João Pedro Paulo, Kayke Santos, Leonardo Oliveira, Matheus (montadores), Painel (visualizador).

### Enum CRM no banco

`admin`, `vendedor`, `nenhum`, `marketing`, `projetista`, `projetista_admin` — **completo**.

### Segurança (advisors)

**Crítico:** 62 tabelas em `emp_garbo` estão **sem RLS** (incluindo `usuarios` e `user_roles`). Não liguei RLS neste épico: sem políticas, o app para. Fica para um trabalho dedicado de segurança, com políticas iguais às das tabelas que já têm RLS (`leads`, contratos, markup…).

---

## 2. Matriz de módulos

| Módulo | Rota | Menu | Código | Teste script | Veredito |
|--------|------|------|--------|--------------|----------|
| Pipeline | `/pipeline` | Comercial | OK | `test-crm-pipeline.mjs` | **OK** |
| Kanban extra | `/pipeline/:slug` | Pipeline ▸ | OK | sidebar | **OK** |
| Config pipeline | `/pipeline/configuracoes` | Pipeline ▸ | OK | — | **OK** |
| Leads | `/leads` | Comercial | OK | `test-crm-leads-list.mjs` | **OK** |
| Agenda comercial | `/agenda-comercial` | Comercial | OK | agenda-* | **OK** (sem alias `/agenda`) |
| Agenda obras | `/agenda-obras` | Casa | OK | — | **OK** |
| Contratos | `/contratos` | Comercial | OK | `test-crm-contratos.mjs` | **OK** |
| Markup | `/markup` | Orçamentos | OK | markup-* | **OK** |
| Slides | `/orcamento-slides` | Orçamentos | OK | `test-crm-slides.mjs` | **OK** |
| Automações | `/automacoes` | Comercial | OK | `test-crm-automacoes.mjs` | **OK** |
| Marketing conteúdo | `/marketing-conteudo` | Marketing | OK | marketing-* | **OK** |
| Biblioteca CRM | `/biblioteca-crm` | Marketing | OK | `test-crm-biblioteca-crm.mjs` | **OK** |
| Pontua / financeiro | `/financeiro-pontua` | Marketing | OK | financeiro-pontua | **OK** |
| Eventos | `/eventos-crm` | Comercial | lista | — | **PARCIAL** (sem board `/controle-eventos`) |
| Chat interno | `/chat-crm` | Comercial | lista | — | **PARCIAL** |
| Projetos | `/projetos` | Comercial | reconstruído | `test-crm-projetos.mjs` | **OK** (quadro + painel no LeadModal) |
| Admin usuários CRM | `/admin` | Administração CRM | OK | — | **PARCIAL** (UI não marca projetista) |
| Marca / webhooks | `/admin/marca` `/admin/webhooks` | OK | OK | marca | **OK** |
| Empresas | `/admin/empresas` | omitido | página órfã + links | — | **AUSENTE** (intencional; links mortos = casco) |
| Portal parceiro | `/portal-parceiro` | Parceiros | OK | portal | **OK** |
| Caixa / obras / ponto | várias | Casa | OK | — | **OK** (não mexer) |
| Rotas públicas | agendar, cadastro, orçamento, apresentação | — | OK | agenda-publica | **OK** |
| Expo / mobile | — | — | — | — | **AUSENTE** (congelado) |

### LeadModal (ficha do cliente)

| Bloco | Veredito |
|-------|----------|
| Detalhes, WhatsApp, anexos, markup, contratos, slides, Pontua, lembretes | **OK** |
| Análise IA + render | **OK** (`lead_ai_renders` = 132) |
| Lousa | **OK** |
| Painel Projetos / prancheta | **OK** (`LeadProjetoPanel`) |
| Draw ambiente (`render-lead-ambiente`) | **AUSENTE** |

### Edge Functions no repo (`supabase/functions`)

Presentes: analyze-lead-photos, chat-iris-sky, render-lead-project, edit-lead-render, index-lead-knowledge, compose-markup-ia, WhatsApp, agenda pública, create-user-admin, register-public, marketing copy, negativação, receber-whatsapp, webhooks, delete/reset/fix user, cadastro-alunos, `rep-*` da fábrica.

**Ausente:** `render-lead-ambiente`.

---

## 3. Casco (Épico 3)

Bloqueantes típicos do plano:

- Sem redirect `/agenda` → `/agenda-comercial`
- `Admin.tsx` / marca ainda apontam `/admin/empresas`
- `AuthContext` descarta `projetista` ao mapear papéis
- Tipo CRM `lead` sem Casa cairia em dashboard vazio (hoje **não há** tipo lead na lista viva)

---

## 4. O que o Épico 1 **não** precisa gravar no banco

Não há merge de UUID. As duas funções dos 5 duais já estão no mesmo login. Os 7 da Casa não têm CRM (não promover). Os 23 do CRM são prestadores (não criar ficha de fábrica).

O Épico 1 vira: **deixar as duas funções óbvias na tela**, **projetista no admin**, e **teste no browser**.
