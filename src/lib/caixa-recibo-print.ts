import { garboBrandLogo } from '@/lib/garbo-brand'
import type { ReciboConfig } from '@/hooks/useReciboConfig'
import { fmtCur, fmtDate } from '@/lib/utils'

const MESES_PT = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
]

export interface CaixaReciboInput {
  destinatarioNome: string
  valor: number
  dataPagamento: string
  descricao: string
  mesReferencia: number
  anoReferencia: number
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

const DEFAULT_TEMPLATE = `RECIBO DE PAGAMENTO

Recebemos de {{nome_destinatario}} a importância de {{valor_pagamento}}, referente a {{descricao_pagamento}}.

Período de referência: {{mes_referencia}} de {{ano_referencia}}.
Data do pagamento: {{data_pagamento}}.

Para maior clareza, firmamos o presente recibo.`

export function buildCaixaReciboTexto(
  input: CaixaReciboInput,
  config: ReciboConfig | null,
): string {
  const template = config?.template_texto?.trim() || DEFAULT_TEMPLATE
  const vars: Record<string, string> = {
    nome_cliente: input.destinatarioNome,
    nome_destinatario: input.destinatarioNome,
    valor_fatura: fmtCur(input.valor),
    valor_pagamento: fmtCur(input.valor),
    descricao_cobranca: input.descricao,
    descricao_pagamento: input.descricao,
    mes_referencia: MESES_PT[input.mesReferencia - 1] ?? String(input.mesReferencia),
    ano_referencia: String(input.anoReferencia),
    data_hoje: fmtDate(input.dataPagamento),
    data_pagamento: fmtDate(input.dataPagamento),
    forma_pagamento: 'Caixa',
    cnpj: config?.cnpj?.trim() ?? '',
    nome_empresa: 'GARBO MOVELARIA',
  }

  let texto = template
  for (const [key, val] of Object.entries(vars)) {
    texto = texto.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), val)
  }
  return texto.trim()
}

export function imprimirCaixaReciboTexto(
  input: CaixaReciboInput,
  corpo: string,
  config: ReciboConfig | null,
): void {
  const logoUrl = new URL(garboBrandLogo, window.location.origin).href
  const destinatario = escapeHtml(input.destinatarioNome)
  const corpoHtml = escapeHtml(corpo).replace(/\n/g, '<br>')
  const cnpj = escapeHtml(config?.cnpj?.trim() || '—')

  const printWindow = window.open('', '_blank')
  if (!printWindow) return

  printWindow.document.write(`
    <!DOCTYPE html>
    <html lang="pt-BR">
      <head>
        <meta charset="utf-8" />
        <title>Recibo - ${destinatario}</title>
        <style>
          @page { size: A4 portrait; margin: 12mm; }
          * { box-sizing: border-box; }
          body {
            margin: 0;
            font-family: Georgia, 'Times New Roman', serif;
            font-size: 11pt;
            line-height: 1.45;
            color: #1a1a1a;
            background: #fff;
          }
          .recibo-page {
            max-width: 180mm;
            margin: 0 auto;
            border: 2px solid #2a1812;
            padding: 14mm 16mm;
          }
          .recibo-header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 16px;
            padding-bottom: 10mm;
            border-bottom: 1px solid #ccc;
            margin-bottom: 8mm;
          }
          .recibo-header img {
            max-height: 52px;
            width: auto;
            object-fit: contain;
          }
          .recibo-header-meta {
            text-align: right;
            font-size: 9pt;
            color: #444;
          }
          .recibo-header-meta strong {
            display: block;
            font-size: 11pt;
            color: #2a1812;
            letter-spacing: 0.04em;
          }
          .recibo-body {
            min-height: 80mm;
            white-space: pre-wrap;
            word-break: break-word;
            font-size: 11pt;
          }
          .recibo-footer {
            margin-top: 14mm;
            padding-top: 8mm;
            border-top: 1px solid #ccc;
            display: flex;
            align-items: flex-end;
            justify-content: space-between;
            gap: 20px;
          }
          .recibo-assinatura {
            flex: 1;
            text-align: center;
          }
          .recibo-assinatura-linha {
            width: 70%;
            margin: 0 auto 6px;
            border-top: 1px solid #333;
            padding-top: 4px;
          }
          .recibo-assinatura img {
            max-height: 36px;
            width: auto;
            opacity: 0.92;
            margin-bottom: 4px;
          }
          .recibo-assinatura-nome {
            font-weight: 700;
            font-size: 10pt;
            letter-spacing: 0.06em;
            color: #2a1812;
          }
          .recibo-assinatura-cnpj {
            font-size: 9pt;
            color: #555;
            margin-top: 2px;
          }
          .recibo-selo {
            font-size: 8pt;
            color: #888;
            text-transform: uppercase;
            letter-spacing: 0.12em;
          }
        </style>
      </head>
      <body>
        <div class="recibo-page">
          <header class="recibo-header">
            <img src="${logoUrl}" alt="GARBO Movelaria" />
            <div class="recibo-header-meta">
              <strong>GARBO MOVELARIA</strong>
              Móveis Planejados de Alta Qualidade<br />
              CNPJ: ${cnpj}
            </div>
          </header>
          <div class="recibo-body">${corpoHtml}</div>
          <footer class="recibo-footer">
            <p class="recibo-selo">Documento emitido pelo caixa</p>
            <div class="recibo-assinatura">
              <img src="${logoUrl}" alt="" aria-hidden="true" />
              <div class="recibo-assinatura-linha"></div>
              <p class="recibo-assinatura-nome">GARBO MOVELARIA</p>
              <p class="recibo-assinatura-cnpj">CNPJ: ${cnpj}</p>
            </div>
          </footer>
        </div>
        <script>
          window.onload = function() {
            window.print();
            setTimeout(function() { window.close(); }, 500);
          };
        </script>
      </body>
    </html>
  `)
  printWindow.document.close()
}
