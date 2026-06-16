import { fmtCur, fmtDate } from '@/lib/utils'
import { gerarPixPayload } from '@/lib/pixBrcode'
import type { ReciboConfig } from '@/hooks/useReciboConfig'
import type { ContaReceber, FormaPagamento } from '@/types'

const MESES_PT = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
]

export interface ReciboPrintOverrides {
  chavePix: string
  formaPagamento: FormaPagamento
  /** ISO YYYY-MM-DD */
  dataPagamento: string
  nomeBeneficiario?: string | null
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export function buildReciboTexto(
  conta: ContaReceber,
  config: ReciboConfig,
  overrides: ReciboPrintOverrides,
  pmLabel: Record<FormaPagamento, string>,
): string {
  const vencimento = conta.data_vencimento ?? ''
  const [ano, mes] = vencimento ? vencimento.split('-').map(Number) : [0, 0]
  const chavePix = overrides.chavePix.trim()
  const dataPagFmt = fmtDate(overrides.dataPagamento)

  const pixPayload = chavePix
    ? gerarPixPayload({
        chave: chavePix,
        valor: conta.valor_parcela,
        nomeBeneficiario: overrides.nomeBeneficiario?.trim() || 'GARBO MOVELARIA',
      })
    : '(PIX não informado)'

  const vars: Record<string, string> = {
    nome_cliente: conta.cliente_nome ?? '',
    valor_fatura: fmtCur(conta.valor_parcela),
    data_vencimento: fmtDate(conta.data_vencimento),
    mes_referencia: mes ? MESES_PT[mes - 1] : '',
    ano_referencia: ano ? String(ano) : '',
    numero_parcela: String(conta.numero_parcela),
    total_parcelas: String(conta.total_parcelas),
    descricao_cobranca:
      conta.total_parcelas > 1
        ? `Parcela ${conta.numero_parcela}/${conta.total_parcelas}`
        : 'Pagamento à vista',
    data_hoje: dataPagFmt,
    data_pagamento: dataPagFmt,
    forma_pagamento: pmLabel[overrides.formaPagamento] ?? overrides.formaPagamento,
    chave_pix: chavePix,
    pix_copia_cola: pixPayload,
    cnpj: config.cnpj,
    nome_empresa: 'GARBO MOVELARIA',
  }

  let texto = config.template_texto
  for (const [key, val] of Object.entries(vars)) {
    texto = texto.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), val)
  }
  return texto
}

export function imprimirRecibo(
  conta: ContaReceber,
  config: ReciboConfig,
  overrides: ReciboPrintOverrides,
  pmLabel: Record<FormaPagamento, string>,
): void {
  const texto = buildReciboTexto(conta, config, overrides, pmLabel)
  const textoHtml = escapeHtml(texto).replace(/\n/g, '<br>')
  const cliente = escapeHtml(conta.cliente_nome ?? 'Cliente')

  const printWindow = window.open('', '_blank')
  if (!printWindow) return

  printWindow.document.write(`
    <!DOCTYPE html>
    <html lang="pt-BR">
      <head>
        <meta charset="utf-8" />
        <title>Recibo - ${cliente}</title>
        <style>
          @page {
            size: A4 portrait;
            margin: 10mm;
          }
          * { box-sizing: border-box; }
          html, body {
            width: 100%;
            height: 100%;
            margin: 0;
            padding: 0;
          }
          body {
            font-family: Arial, Helvetica, sans-serif;
            font-size: 11pt;
            line-height: 1.35;
            color: #222;
            background: #fff;
          }
          .recibo-page {
            width: 100%;
            max-width: 190mm;
            min-height: 0;
            margin: 0 auto;
            padding: 0;
            page-break-inside: avoid;
            page-break-after: avoid;
          }
          .recibo-box {
            border: 1px solid #333;
            padding: 10mm 12mm;
            max-height: 277mm;
            overflow: hidden;
            white-space: pre-wrap;
            word-break: break-word;
          }
          .header {
            text-align: center;
            border-bottom: 1px solid #ccc;
            margin-bottom: 8mm;
            padding-bottom: 4mm;
          }
          .header h2 {
            margin: 0;
            font-size: 16pt;
            letter-spacing: 0.04em;
          }
          .header .sub {
            font-size: 9pt;
            color: #555;
            margin-top: 2mm;
          }
          .conteudo {
            font-size: 11pt;
            line-height: 1.4;
          }
          .footer {
            margin-top: 10mm;
            text-align: center;
          }
          .assinatura {
            border-top: 1px solid #333;
            display: inline-block;
            min-width: 70mm;
            margin-top: 8mm;
            padding-top: 3mm;
            font-size: 10pt;
          }
          @media print {
            body { padding: 0; }
            .recibo-box {
              border: 1px solid #333;
              max-height: none;
            }
          }
        </style>
      </head>
      <body>
        <div class="recibo-page">
          <div class="recibo-box">
            <div class="header">
              <h2>GARBO MOVELARIA</h2>
              <div class="sub">Móveis Planejados de Alta Qualidade</div>
            </div>
            <div class="conteudo">${textoHtml}</div>
            <div class="footer">
              <div class="assinatura">GARBO MOVELARIA</div>
            </div>
          </div>
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
