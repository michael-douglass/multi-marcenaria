# PRD — Sistema de QR Code

| Campo | Valor |
|--------|--------|
| **Produto** | FinanceApp (Michael Douglas Finanças) |
| **Nome do sistema** | Sistema de QR Code |
| **Status** | Entregue (v1) |
| **Superfície** | Página Contas a pagar (`/despesas`) |
| **Versão do documento** | 1.0 |
| **Data** | 27/07/2026 |

---

## 1. Resumo executivo

O **Sistema de QR Code** é uma ferramenta leve dentro do painel web do FinanceApp. Ela permite:

1. **Colar** um número, ID, telefone ou linha digitável de boleto.
2. **Gerar** um QR Code em **texto puro** (sem URL, sem JSON).
3. **Copiar** esse texto para a área de transferência.
4. **Ler** o QR pela câmera do celular (no mesmo site / PWA) e **copiar automaticamente** o conteúdo, com aviso (toast).

O objetivo é transferir códigos longos (especialmente linhas de boleto) de um aparelho para outro de forma rápida e sem digitação.

---

## 2. Problema

Códigos financeiros (linha digitável, IDs, telefones) são longos e fáceis de errar ao digitar. O usuário precisa:

- Mostrar o código em uma tela (computador).
- Ler em outra tela (celular) e colar em apps de banco ou formulários.

Leitores comuns de celular, ao encontrar **espaços** na linha digitável, às vezes copiam **só o último bloco** — o que quebra o uso do boleto.

---

## 3. Objetivos

| Objetivo | Como mediamos o sucesso |
|----------|-------------------------|
| Transferir texto sem digitar | Usuário gera QR → escaneia → texto completo na área de transferência |
| Zero fricção no painel | Acesso em 1 clique a partir de Contas a pagar |
| Confiabilidade em boletos | Linha com espaços/pontos vira dígitos contínuos no QR |
| Transparência | UI mostra exatamente o texto gravado no QR |

### Fora de escopo (v1)

- App nativo Android/iOS separado.
- Histórico de QRs no banco (Supabase).
- QR com URL, PIX EMV, JSON ou payloads estruturados.
- Integração automática com APIs bancárias.
- Compartilhamento por e-mail/WhatsApp do arquivo da imagem.

---

## 4. Personas e contexto de uso

| Persona | Contexto |
|---------|----------|
| Usuário do FinanceApp | Já autenticado no hub financeiro, na página de despesas |
| Uso tipico | Cola linha digitável no PC → gera QR → lê no celular → cola no app do banco |

Não há app móvel nativo neste repositório: o “aplicativo móvel” é o **mesmo site** aberto no navegador do celular (ou atalho PWA).

---

## 5. Fluxos principais

### 5.1 Gerar QR

```
Usuário abre Contas a pagar
  → clica no ícone QR (ao lado do seletor de mês)
  → aba "Gerar"
  → cola/digita o texto
  → "Gerar QR"
  → vê a imagem + o texto exatamente gravado no QR
  → (opcional) "Copiar número"
```

### 5.2 Ler QR

```
Usuário abre o mesmo diálogo no celular
  → aba "Ler"
  → permite câmera
  → aponta para o QR
  → sistema extrai o texto completo
  → copia para a área de transferência
  → toast: "Número completo copiado"
  → mostra o valor lido na tela
```

### 5.3 Compactação de linha numérica (boleto)

Se o texto colado contém **apenas** dígitos, espaços, pontos e hífens, o sistema:

- Remove espaços, pontos e outros não-dígitos.
- Grava no QR um **bloco contínuo** de números.
- Avisa o usuário (toast + rótulo “sem espaços/pontos”).
- Exibe o payload final sob a imagem do QR.

**Exemplo**

| Entrada (colada) | Texto no QR |
|------------------|-------------|
| `10497.96574 10000.100049 00001.587039 9 15230000303936` | `10497965741000010004900001587039915230000303936` |

Textos que não forem “só números com separadores” (ex.: IDs alfanuméricos) são gravados **exatamente** como digitados (após trim).

---

## 6. Requisitos funcionais

| ID | Requisito | Prioridade |
|----|-----------|------------|
| RF-01 | Botão ícone QR no header de Contas a pagar, ao lado do seletor de mês | P0 |
| RF-02 | Diálogo com abas **Gerar** e **Ler** | P0 |
| RF-03 | Campo de texto (área maior) para colar números/códigos longos | P0 |
| RF-04 | Geração de QR em texto puro a partir do payload preparado | P0 |
| RF-05 | Compactar linhas numéricas com espaços/pontos antes de gravar no QR | P0 |
| RF-06 | Exibir preview do QR e do texto gravado | P0 |
| RF-07 | Botão copiar o número (payload do QR quando existir) | P0 |
| RF-08 | Leitura por câmera no navegador/PWA | P0 |
| RF-09 | Ao ler, copiar texto completo + toast | P0 |
| RF-10 | Encerrar câmera ao fechar o diálogo ou trocar de aba | P0 |
| RF-11 | Mensagem clara se câmera/permissão falhar | P1 |

---

## 7. Requisitos não funcionais

| ID | Requisito |
|----|-----------|
| RNF-01 | Sem dependência de backend/API para gerar ou ler QR (tudo no cliente) |
| RNF-02 | Bibliotecas leves e open-source: `qrcode`, `html5-qrcode` |
| RNF-03 | UI alinhada ao hub (slate + acento rose), ícone minimizado |
| RNF-04 | Correção de erro do QR em nível **H** para leitura mais robusta |
| RNF-05 | Funciona em HTTPS ou localhost (exigência de câmera do navegador) |
| RNF-06 | Sem persistência de dados sensíveis do QR no Supabase (v1) |

---

## 8. Experiência do usuário (UI)

### Entrada (minimizado)

- Botão `outline` só com ícone `QrCode`.
- Posição: header de Contas a pagar, imediatamente após o bloco do mês.

### Diálogo

- Título: “QR Code”.
- Aba **Gerar**: textarea, Gerar QR, Copiar número, preview + “Texto gravado no QR”.
- Aba **Ler**: preview da câmera, resultado lido, Copiar de novo / Ler outro.

### Feedback

- Toast de sucesso ao copiar / ao ler.
- Toast informativo quando a linha foi compactada (sem espaços/pontos).
- Toast/erro se câmera indisponível.

---

## 9. Arquitetura técnica (v1)

```
┌─────────────────────────────┐
│  DespesasHub (header)       │
│    └─ QrCodeToolkit         │
│         ├─ Gerar            │
│         │    prepareQrPayload → qrcode.toDataURL
│         │    copy-text (clipboard + sonner)
│         └─ Ler              │
│              html5-qrcode → clipboard + toast
└─────────────────────────────┘
         (sem API / sem migration)
```

| Peça | Caminho |
|------|---------|
| UI | `src/components/qr/QrCodeToolkit.tsx` |
| Geração / compactação | `src/lib/qr/generate-qr.ts` |
| Clipboard | `src/lib/qr/copy-text.ts` |
| Integração | `src/components/hub/DespesasHub.tsx` |

---

## 10. Critérios de aceite

- [x] Ícone QR visível em `/despesas` ao lado do seletor de mês.
- [x] Colar texto e gerar QR contendo apenas texto puro.
- [x] Linha de boleto com espaços gera QR com dígitos contínuos e mostra o payload.
- [x] Copiar número coloca o payload correto na área de transferência.
- [x] Aba Ler solicita câmera, lê o QR, copia o texto e exibe toast.
- [x] Fechar o diálogo encerra a câmera.
- [x] Sem necessidade de migration ou Edge Function específica para o QR.

---

## 11. Riscos e mitigações

| Risco | Mitigação |
|-------|-----------|
| Scanner do celular corta no espaço | Compactação automática de linhas numéricas |
| Usuário não sabe o que foi gravado | Bloco “Texto gravado no QR” |
| Sem permissão de câmera | Mensagem + botão “Tentar de novo” |
| Expectativa de app nativo | Documentar que o escaneamento é no mesmo site/PWA |

---

## 12. Evoluções futuras (opcional)

- Histórico local (últimos N códigos) sem enviar ao servidor.
- Toggle “manter espaços” para quem quiser o texto literal.
- Botão QR em outras páginas (Receitas, Resumo).
- Download da imagem PNG do QR.
- App nativo (React Native / Expo) com scanner dedicado, se o produto exigir.

---

## 13. Glossário

| Termo | Significado |
|-------|-------------|
| **Texto puro** | Conteúdo do QR é só a string (sem `https://`, sem JSON) |
| **Payload** | String efetivamente gravada dentro do QR |
| **Compactação** | Remoção de espaços/pontos em linhas só numéricas |
| **Toast** | Aviso rápido na tela (biblioteca Sonner) |
| **PWA** | Site instalável no celular como “atalho de app” |
