# PRD — Sistema de Notificações de Contas a Pagar

**Produto:** GARBO Movelaria  
**Módulo:** Financeiro / Contas a Pagar  
**Versão do documento:** 1.0  
**Data:** 10/08/2026  
**Status:** Implementado (produção)

---

## 1. Resumo (em uma frase)

Um **sino de lembretes** no topo do sistema avisa o administrador sobre contas que vencem **hoje** e contas **vencidas do mês**, sem alterar o pagamento da conta — só organiza o que precisa ser visto.

---

## 2. Problema que resolve

Antes, o administrador só via contas a pagar entrando na página `/contas-pagar`. Contas do dia e atrasadas podiam passar despercebidas em outras telas (Dashboard, Obras, etc.).

**Dor:** esquecer de revisar contas que vencem no dia ou que já passaram da data.

**Solução:** lembretes visíveis em **todas as páginas** (perfil Administrador), com contador e lista rápida.

---

## 3. Objetivos

| Objetivo | Como medir |
|----------|------------|
| Ver contas do dia sem abrir a tela completa | Sino + badge no header |
| Ver atrasadas do mês atual | Itens com status “Vencido” na lista |
| Dispensar o lembrete sem “pagar” a conta | Botão **Excluir** (só some o aviso) |
| Não spam amanhã com o que já foi visto hoje | Exclusão vale **só no dia** |
| Acesso só de quem gerencia financeiro | Apenas perfil **Administrador** |

---

## 4. Fora de escopo

- Não marca conta como **paga** (não chama pagamento / caixa).
- Não envia e-mail, WhatsApp ou push do celular.
- Não aparece para Financeiro, Marceneiro, Montador, Visualizador etc.
- Não lista contas futuras (amanhã, próximo mês), salvo se forem “hoje” ou “vencidas do mês”.

---

## 5. Quem usa

| Perfil | Vê o sino? |
|--------|------------|
| Administrador | Sim |
| Demais perfis | Não |

---

## 6. Regras de negócio

### 6.1 Quais contas entram no sino

Entram **duas famílias** de contas:

1. **Do dia (hoje)**  
   - `data_vencimento = data de hoje`  
   - **Qualquer status:** pendente, parcialmente pago ou pago  
   - Motivo: o admin revisa o que vence hoje, mesmo se já estiver pago.

2. **Vencidas do mês atual (ainda não pagas)**  
   - `data_vencimento` entre o **1º dia do mês** e **ontem**  
   - Status: `pendente` ou `parcialmente_pago`  
   - **Não** entram contas antigas de meses anteriores só por estarem atrasadas (evita dezenas de avisos históricos).  
   - **Não** entram contas já `pago` do passado.

### 6.2 Excluir notificação

- Cada item tem botão **Excluir**.
- Efeito: some **só da lista de notificações** daquele usuário **naquele dia**.
- **Não** muda `status`, `valor_pago` nem movimentação de caixa.
- No dia seguinte (`dia_referencia` novo):
  - Contas de **hoje** (novo dia) aparecem frescas.
  - Contas ainda **vencidas e não pagas** no mês podem voltar a aparecer (se ainda se encaixarem na regra).

### 6.3 Contador (badge)

- Número = quantidade de itens ainda não excluídos hoje.
- Se passar de 99, mostra `99+`.

---

## 7. Experiência do usuário (UX)

### 7.1 Sino (canto superior direito)

- Ícone de sino no **header**, em todas as rotas autenticadas (via layout principal).
- Badge vermelho com a quantidade.
- Clique abre/fecha o popup.
- Visual alinhado ao tema Garbo (dourado / madeira escura); pulso leve quando há itens.

### 7.2 Popup (canto superior direito)

- Abre logo abaixo do header, à direita.
- Cabeçalho: título “Contas a pagar”, subtítulo “Hoje e vencidas do mês”, data e contagem.
- Lista **com scroll** (rolagem na área do meio; cabeçalho e rodapé fixos).
- Cada linha mostra:
  - Fornecedor  
  - **Status** (badge: Pendente / Parcial / Pago / Vencido)  
  - Descrição  
  - Data de vencimento e valor  
  - Botão **Excluir**
- Rodapé: atalho “Abrir Contas a Pagar” → `/contas-pagar`.
- Fecha com Esc, clique fora ou botão X.

---

## 8. Arquitetura técnica (visão simples)

```text
Administrador logado
        │
        ▼
ContasPagarNotifProvider (MainLayout)
        │
        ├── Sino no NavigationHeader
        └── Popup flutuante (portal)
                │
                ▼
useContasPagarNotificacoes
        │
        ├── SELECT contas (hoje + vencidas do mês)
        └── SELECT dismiss do usuário no dia
                │
                ▼
        Lista filtrada → badge + UI
                │
                ▼ (Excluir)
        INSERT/UPSERT em movelaria_contas_pagar_notif_dismiss
```

### 8.1 Arquivos principais

| Arquivo | Função |
|---------|--------|
| `src/hooks/useContasPagarNotificacoes.ts` | Busca, contagem, exclusão |
| `src/components/layout/ContasPagarNotifications.tsx` | Provider, sino, popup |
| `src/components/layout/MainLayout.tsx` | Envolve o app com o provider |
| `src/components/layout/NavigationHeader.tsx` | Posiciona o sino |
| `supabase/migrations/154_*.sql` | Tabela de dismiss |
| `supabase/migrations/155_*.sql` | Dismiss por dia (`dia_referencia`) |

### 8.2 Banco de dados

**Tabela:** `movelaria_contas_pagar_notif_dismiss`

| Coluna | Uso |
|--------|-----|
| `usuario_id` | Quem excluiu (auth) |
| `conta_pagar_id` | Qual conta |
| `dia_referencia` | Em qual dia o lembrete foi dispensado |
| `dismissed_at` | Quando |

- Unique: `(usuario_id, conta_pagar_id, dia_referencia)`
- RLS: usuário só lê/grava os próprios registros (`auth.uid() = usuario_id`)

**Fonte das contas:** `movelaria_contas_pagar` (já existente).

### 8.3 Atualização

- Recarrega a cada ~10s e ao voltar para a aba (`useAutoRefresh`), alinhado aos outros hooks do sistema.

---

## 9. Critérios de aceite (definição de “pronto”)

- [x] Sino visível só para Administrador, em todas as páginas do layout.
- [x] Badge mostra a quantidade correta.
- [x] Lista inclui contas com vencimento **hoje** (ex.: Aluguel Aloísio, Consórcio), qualquer status.
- [x] Lista inclui **vencidas do mês** não pagas (ex.: parcialmente pagas atrasadas).
- [x] Não lista contas pagas antigas (ex.: dia 01/06 já pago).
- [x] Não lista contas só do próximo mês / futuro.
- [x] **Excluir** remove o item hoje e **não** altera status da conta no banco.
- [x] Popup abre no canto superior direito e a lista é **rolável**.
- [x] Link “Abrir Contas a Pagar” navega para `/contas-pagar`.
- [x] Migrations aplicadas no projeto Supabase e versionadas no repositório.

---

## 10. Casos de uso

### CU-01 — Revisar o dia

1. Admin entra no sistema.  
2. Vê o sino com número.  
3. Abre a lista, confere status e valores.  
4. Clica em Contas a Pagar se for pagar de verdade.

### CU-02 — Tirar o lembrete da frente

1. Admin já tratou ou não quer ver o item hoje.  
2. Clica **Excluir**.  
3. Item some; badge diminui.  
4. Na página Contas a Pagar, a conta continua igual.

### CU-03 — Virada do dia

1. À meia-noite (novo `dia_referencia`).  
2. Exclusões de ontem não valem mais para o filtro do dia.  
3. Contas do **novo dia** e vencidas ainda abertas no mês reaparecem conforme a regra.

---

## 11. Riscos e cuidados

| Risco | Mitigação |
|-------|-----------|
| Confundir “Excluir” com “Marcar como pago” | Texto explícito no rodapé; botão não chama `marcarPago` |
| Muitas vencidas históricas | Limite: só mês atual + não pagas |
| Fuso horário | `todayISO()` no cliente + `dia_referencia` DATE no banco |
| Dois admins | Cada um tem sua própria lista de exclusões |

---

## 12. Evoluções futuras (backlog)

- Notificar também perfil **Financeiro**.
- Filtro “só não pagas” no dia (opcional).
- “Excluir todas”.
- Som / destaque quando nasce conta do dia.
- Push ou e-mail diário (resumo).

---

## 13. Glossário

| Termo | Significado |
|-------|-------------|
| **Notificação / lembrete** | Aviso na UI; não é pagamento |
| **Excluir** | Esconder o lembrete hoje |
| **Vencida** | Data de vencimento &lt; hoje e ainda não paga |
| **Badge** | Número vermelho no sino |
| **PRD** | Documento de requisitos do produto (às vezes chamado PDR) |

---

*Documento alinhado à implementação atual no repositório Movelaria (commit da feature de notificações).*
