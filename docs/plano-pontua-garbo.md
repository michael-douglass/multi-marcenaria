# Plano — Pontua Garbo (portaria, mural e pontuação)

**Fonte:** [pontuagarbo.md](pontuagarbo.md)  
**Referência 1:1:** [CRM-Multiemrpesas](https://github.com/michael-douglass/CRM-Multiemrpesas)  
**Onde:** `/admin` (portaria), `/financeiro-pontua` (mural), campo **Pontua Garbo** no card do lead  
**Data:** 28/08/2026

Pense nisso como três cômodos da mesma casa: quem entra (cadastro), quanto cada um tem na carteira (mural) e o vínculo no card do cliente.

---

## O que a vistoria encontrou

### Cadastro (banco `emp_garbo.usuarios`)

| Tipo | Comissão | Quantos |
|------|----------|---------|
| Colaborador | desligada | **5** |
| Prestador | **ligada** | **23** |
| Lead | — | **0** |

Isso é exatamente o retrato do PRD. Os 23 com o interruptor ligado são os cartões **Reconhecido** do mural.

### Motor de pontos (já igual ao GitHub)

Arquivos com o mesmo conteúdo do repositório:

- `pontua-garbo.ts` (10% padrão, venda ganha, carteira)
- `pontua-garbo-saque`, `-access`, `-arquiteto`, `-comissao-liberacao`, `-indicacoes-mes`, `-partner-match`
- `usePontuaGarboFinanceiro`, `usePontuaGarboComissaoLiberacao`, `useLeadPontuaGarboSaleInfo`, `useUsers`
- Edge compartilhada `pontua-garbo-lead.ts`

A tela viva do mural **já é** `src/pages/Financeiro.tsx` em `/financeiro-pontua` (não misturar com o Caixa da fábrica).

### O que faltava (existe no GitHub)

| Peça | Papel |
|------|--------|
| `lead-email.ts` + validação no cadastro do parceiro | E-mail no formato certo antes de criar o acesso |
| Painel de contato no card | Recusa e-mail inválido em vez de mandar lixo |
| Visibilidade do prestador também para vendedor | GitHub: não só admin |
| Hook `usePontuaGarboArquitetosPorLeads` | Nome do arquiteto por lead (catálogo) |
| Script de totais aberto/fechado por mês | Conferência do “placar” |

### Pontuação real hoje (indicações no campo Pontua Garbo)

Não é um “score” de jogo: é **indicação + comissão em reais**.

Quem já tem lead vinculado:

- João Paulo — 9 (6 andamento, 3 perdidos)
- Julia Honório — 3 (1 andamento, 2 perdidos)
- Elis Felisale Barbosa — 2 (2 perdidos)
- Cintia, Dany, Marcela — 1 em andamento cada
- Matheus Figueiredo — 1 venda ganha
- Thais — 1 perdido
- Demais 16 prestadores — 0 vínculos ainda (aparecem no mural mesmo assim)

Há também 10 lançamentos, 9 pedidos de saque e 12 liberações no banco.

---

## Épicos

### P0 — Inventário

Comparar GitHub × Garbo e ler usuários/pontos no banco.

**Teste:** SQL em `emp_garbo` + hashes dos arquivos do motor.

### P1 — Portaria e mural (domínio)

Nada a migrar: colunas `comissao_ativa`, campo custom **Pontua Garbo**, origem e títulos já existem. Confirmar 28 / 23 no Admin e no mural.

**Teste:** `/admin` filtros + `/financeiro-pontua` com 23 reconhecidos.

### P2 — Cadastro do parceiro no card (e-mail)

Copiar `lead-email.ts`, o hook `usePontuaGarboPartnerLeads` e o painel de contato.

**Teste:** script de fonte (parse/validação) + abrir o card.

### P3 — O que o prestador vê

Vendedor também controla a visibilidade; switches desligam se o card estiver só leitura.

**Teste:** fonte do `LeadCustomFieldsSection` + `LeadModal`.

### P4 — Placar mensal e hook de nomes

Copiar `usePontuaGarboArquitetosPorLeads` e o teste de indicações por mês.

**Teste:** `node --test scripts/test-pontua-garbo-indicacoes-mes.mjs`.

### P5 — Conferência no browser

Admin (filtros/badge) e mural (23 cartões, busca, KPIs). Sem disparar saque real.

---

## Regras

1. Tipo ≠ papel. Prestador no Pontua = `comissao_ativa`.
2. Não misturar com o Caixa `/caixa`.
3. Não sobrescrever o `LeadModal` inteiro (já tem Projetos e render).
4. Sem commit até o usuário pedir.
