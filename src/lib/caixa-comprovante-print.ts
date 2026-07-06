import { garboBrandLogo } from '@/lib/garbo-brand'
import type { ReciboConfig } from '@/hooks/useReciboConfig'
import { fmtCur, fmtDate } from '@/lib/utils'

const MESES_PT = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
]

const NOME_EMPRESA = 'GARBO MOVELARIA'

export interface CaixaComprovanteInput {
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

const DEFAULT_TEMPLATE = `COMPROVANTE DE PAGAMENTO

A empresa {{nome_empresa}}, inscrita no CNPJ {{cnpj}}, declara ter efetuado o pagamento de {{valor_pagamento}} em favor de {{nome_destinatario}}, referente a {{descricao_pagamento}}.

Período de referência: {{mes_referencia}} de {{ano_referencia}}.
Data do pagamento: {{data_pagamento}}.

Este documento comprova que o valor acima foi pago ao destinatário indicado.`

/** Texto do comprovante — confirma pagamento feito pela empresa ao destinatário. */
export function buildCaixaComprovanteTexto(
  input: CaixaComprovanteInput,
  config: ReciboConfig | null,
): string {
  const cnpj = config?.cnpj?.trim() ?? '—'
  const vars: Record<string, string> = {
    nome_destinatario: input.destinatarioNome,
    valor_pagamento: fmtCur(input.valor),
    descricao_pagamento: input.descricao,
    mes_referencia: MESES_PT[input.mesReferencia - 1] ?? String(input.mesReferencia),
    ano_referencia: String(input.anoReferencia),
    data_pagamento: fmtDate(input.dataPagamento),
    cnpj,
    nome_empresa: NOME_EMPRESA,
  }

  let texto = DEFAULT_TEMPLATE
  for (const [key, val] of Object.entries(vars)) {
    texto = texto.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), val)
  }
  return texto.trim()
}

export function imprimirCaixaComprovante(
  input: CaixaComprovanteInput,
  corpo: string,
  config: ReciboConfig | null,
): void {
  const logoUrl = new URL(garboBrandLogo, window.location.origin).href
  const destinatario = escapeHtml(input.destinatarioNome)
  const corpoHtml = escapeHtml(corpo).replace(/\n/g, '<br>')
  const cnpj = escapeHtml(config?.cnpj?.trim() || '—')
  const valorFmt = escapeHtml(fmtCur(input.valor))

  const printWindow = window.open('', '_blank')
  if (!printWindow) return

  printWindow.document.write(`
    <!DOCTYPE html>
    <html lang="pt-BR">
      <head>
        <meta charset="utf-8" />
        <title>Comprovante de pagamento — ${destinatario}</title>
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
          .doc-page {
            max-width: 180mm;
            margin: 0 auto;
            border: 2px solid #2a1812;
            padding: 14mm 16mm;
          }
          .doc-titulo {
            text-align: center;
            font-size: 13pt;
            font-weight: 700;
            letter-spacing: 0.08em;
            color: #2a1812;
            margin-bottom: 8mm;
            text-transform: uppercase;
          }
          .doc-header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 16px;
            padding-bottom: 8mm;
            border-bottom: 1px solid #ccc;
            margin-bottom: 8mm;
          }
          .doc-header img {
            max-height: 52px;
            width: auto;
            object-fit: contain;
          }
          .doc-header-meta {
            text-align: right;
            font-size: 9pt;
            color: #444;
          }
          .doc-header-meta strong {
            display: block;
            font-size: 11pt;
            color: #2a1812;
            letter-spacing: 0.04em;
          }
          .doc-resumo {
            background: #f7f4ef;
            border: 1px solid #ddd;
            border-radius: 4px;
            padding: 5mm 6mm;
            margin-bottom: 8mm;
            font-size: 10pt;
          }
          .doc-resumo-row {
            display: flex;
            justify-content: space-between;
            gap: 12px;
            margin-bottom: 3mm;
          }
          .doc-resumo-row:last-child { margin-bottom: 0; }
          .doc-resumo-label { color: #555; }
          .doc-resumo-valor {
            font-weight: 700;
            font-size: 12pt;
            color: #2a1812;
          }
          .doc-body {
            min-height: 70mm;
            white-space: pre-wrap;
            word-break: break-word;
            font-size: 11pt;
          }
          .doc-footer {
            margin-top: 14mm;
            padding-top: 8mm;
            border-top: 1px solid #ccc;
            display: flex;
            align-items: flex-end;
            justify-content: space-between;
            gap: 20px;
          }
          .doc-assinatura {
            flex: 1;
            text-align: center;
          }
          .doc-assinatura-linha {
            width: 70%;
            margin: 0 auto 6px;
            border-top: 1px solid #333;
            padding-top: 4px;
          }
          .doc-assinatura img {
            max-height: 36px;
            width: auto;
            opacity: 0.92;
            margin-bottom: 4px;
          }
          .doc-assinatura-nome {
            font-weight: 700;
            font-size: 10pt;
            letter-spacing: 0.06em;
            color: #2a1812;
          }
          .doc-assinatura-cnpj {
            font-size: 9pt;
            color: #555;
            margin-top: 2px;
          }
          .doc-selo {
            font-size: 8pt;
            color: #888;
            text-transform: uppercase;
            letter-spacing: 0.12em;
            max-width: 28mm;
            line-height: 1.4;
          }
        </style>
      </head>
      <body>
        <div class="doc-page">
          <p class="doc-titulo">Comprovante de pagamento</p>
          <header class="doc-header">
            <img src="${logoUrl}" alt="GARBO Movelaria" />
            <div class="doc-header-meta">
              <strong>${escapeHtml(NOME_EMPRESA)}</strong>
              Móveis Planejados de Alta Qualidade<br />
              CNPJ: ${cnpj}
            </div>
          </header>
          <div class="doc-resumo">
            <div class="doc-resumo-row">
              <span class="doc-resumo-label">Pagamos a</span>
              <strong>${destinatario}</strong>
            </div>
            <div class="doc-resumo-row">
              <span class="doc-resumo-label">Valor pago</span>
              <span class="doc-resumo-valor">${valorFmt}</span>
            </div>
            <div class="doc-resumo-row">
              <span class="doc-resumo-label">Data</span>
              <span>${escapeHtml(fmtDate(input.dataPagamento))}</span>
            </div>
          </div>
          <div class="doc-body">${corpoHtml}</div>
          <footer class="doc-footer">
            <p class="doc-selo">Emitido pelo caixa · pagamento efetuado</p>
            <div class="doc-assinatura">
              <img src="${logoUrl}" alt="" aria-hidden="true" />
              <div class="doc-assinatura-linha"></div>
              <p class="doc-assinatura-nome">${escapeHtml(NOME_EMPRESA)}</p>
              <p class="doc-assinatura-cnpj">CNPJ: ${cnpj}</p>
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
