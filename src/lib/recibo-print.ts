import { garboBrandLogo } from '@/lib/garbo-brand'
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

export interface ReciboPrintLayout {
  clienteNome: string
  valorLabel: string
  parcelaLabel: string
  dataPagamentoLabel: string
  formaPagamentoLabel: string
  cnpj: string
  texto: string
  logoUrl: string
  foilDataUrl?: string | null
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export function resolveReciboLogoUrl(): string {
  if (typeof window === 'undefined') return garboBrandLogo
  if (garboBrandLogo.startsWith('http') || garboBrandLogo.startsWith('data:')) return garboBrandLogo
  return new URL(garboBrandLogo, window.location.origin).href
}

/** Tira o cabeçalho/rodapé antigo do texto, agora desenhados no layout. */
export function normalizeReciboCorpo(texto: string): string {
  return texto
    .replace(/^GARBO MOVELARIA\s*\n(?:Móveis Planejados de Alta Qualidade\s*\n)?/i, '')
    .replace(/^\s*RECIBO(?: DE PAGAMENTO)?\s*\n+/i, '')
    .replace(/\n_{8,}\s*\nGARBO MOVELARIA\s*$/i, '')
    .trim()
}

export function parcelaReciboLabel(conta: Pick<ContaReceber, 'numero_parcela' | 'total_parcelas'>): string {
  return conta.total_parcelas > 1
    ? `Parcela ${conta.numero_parcela}/${conta.total_parcelas}`
    : 'Pagamento à vista'
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

/** Texto do miolo — o cabeçalho visual (logo, faixa, ficha) vai no layout. */
export function buildReciboCompleto(
  conta: ContaReceber,
  config: ReciboConfig,
  overrides: ReciboPrintOverrides,
  pmLabel: Record<FormaPagamento, string>,
): string {
  return buildReciboTexto(conta, config, overrides, pmLabel)
}

export function buildReciboPrintLayout(
  conta: ContaReceber,
  texto: string,
  extras: {
    formaPagamentoLabel: string
    dataPagamento: string
    cnpj?: string
    foilDataUrl?: string | null
  },
): ReciboPrintLayout {
  return {
    clienteNome: conta.cliente_nome ?? 'Cliente',
    valorLabel: fmtCur(conta.valor_parcela),
    parcelaLabel: parcelaReciboLabel(conta),
    dataPagamentoLabel: fmtDate(extras.dataPagamento),
    formaPagamentoLabel: extras.formaPagamentoLabel,
    cnpj: extras.cnpj?.trim() ?? '',
    texto: normalizeReciboCorpo(texto),
    logoUrl: resolveReciboLogoUrl(),
    foilDataUrl: extras.foilDataUrl ?? null,
  }
}

export const RECIBO_SHEET_CSS = `
  .recibo-frame {
    --paper: #f6eee0;
    --ink: #2a1812;
    --muted: #7a6555;
    --gold: #b8923a;
    --line: rgba(184, 146, 58, 0.38);
    box-sizing: border-box;
    padding: 7px;
    background:
      linear-gradient(180deg, rgba(248, 236, 210, 0.55), rgba(184, 146, 58, 0.12)),
      #e8d7b4;
    border: 1px solid rgba(90, 58, 24, 0.28);
  }
  .recibo-sheet {
    position: relative;
    background: var(--paper);
    color: var(--ink);
    border: 1px solid rgba(42, 24, 18, 0.12);
    overflow: hidden;
    min-height: 100%;
  }
  .recibo-sheet::after {
    content: "";
    position: absolute;
    inset: 0;
    pointer-events: none;
    opacity: 0.055;
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='140' height='140'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");
    mix-blend-mode: multiply;
  }
  .recibo-foil-strip {
    position: relative;
    height: 48px;
    overflow: hidden;
  }
  .recibo-foil,
  .recibo-foil-fallback,
  .recibo-foil-slot {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
  .recibo-foil-fallback {
    background:
      radial-gradient(120% 90% at 18% 40%, rgba(201, 162, 70, 0.7), transparent 58%),
      linear-gradient(90deg, #3a2114 0%, #c4a056 48%, #6b4420 100%);
  }
  .recibo-masthead-inner {
    padding: 18px 24px 16px;
    text-align: center;
  }
  .recibo-logo {
    height: 72px;
    width: auto;
    display: block;
    margin: 0 auto 12px;
  }
  .recibo-eyebrow {
    margin: 0;
    font-family: 'DM Sans', 'Segoe UI', sans-serif;
    font-size: 9px;
    font-weight: 600;
    letter-spacing: 0.34em;
    text-transform: uppercase;
    color: #8a6420;
  }
  .recibo-title {
    margin: 6px 0 0;
    font-family: 'Cormorant Garamond', Georgia, 'Times New Roman', serif;
    font-size: 34px;
    font-weight: 600;
    letter-spacing: 0.2em;
    text-transform: uppercase;
    color: var(--ink);
    line-height: 1;
  }
  .recibo-tag {
    margin: 8px 0 0;
    font-family: 'Cormorant Garamond', Georgia, serif;
    font-style: italic;
    font-size: 13px;
    color: var(--muted);
  }
  .recibo-meta {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 0;
    border-top: 1px solid var(--line);
    border-bottom: 1px solid var(--line);
  }
  .recibo-meta-cell {
    padding: 14px 18px;
  }
  .recibo-meta-cell:nth-child(odd) {
    border-right: 1px solid var(--line);
  }
  .recibo-meta-cell:nth-child(-n+2) {
    border-bottom: 1px solid var(--line);
  }
  .recibo-label {
    display: block;
    font-family: 'DM Sans', 'Segoe UI', sans-serif;
    font-size: 8.5px;
    font-weight: 600;
    letter-spacing: 0.22em;
    text-transform: uppercase;
    color: var(--muted);
    margin-bottom: 4px;
  }
  .recibo-value {
    font-family: 'Cormorant Garamond', Georgia, serif;
    font-size: 17px;
    font-weight: 600;
    color: var(--ink);
    line-height: 1.2;
  }
  .recibo-value-gold {
    color: #8a6420;
    font-size: 20px;
  }
  .recibo-body {
    padding: 22px 22px 8px;
    font-family: 'Cormorant Garamond', Georgia, serif;
    font-size: 14.5px;
    line-height: 1.55;
    white-space: pre-wrap;
    word-break: break-word;
    overflow-wrap: anywhere;
  }
  .recibo-sign {
    margin: 28px 22px 26px;
    text-align: center;
  }
  .recibo-sign-line {
    width: 240px;
    margin: 0 auto 8px;
    border-top: 1px solid rgba(42, 24, 18, 0.45);
  }
  .recibo-sign-name {
    margin: 0;
    font-family: 'Cormorant Garamond', Georgia, serif;
    font-size: 15px;
    letter-spacing: 0.16em;
    text-transform: uppercase;
  }
  .recibo-sign-meta {
    margin: 4px 0 0;
    font-family: 'DM Sans', 'Segoe UI', sans-serif;
    font-size: 10px;
    letter-spacing: 0.08em;
    color: var(--muted);
  }
  .recibo-foot-edge {
    height: 8px;
    background: linear-gradient(90deg, #3a2114 0%, #c4a056 48%, #6b4420 100%);
  }
`

export function buildReciboSheetInnerHtml(layout: ReciboPrintLayout, foilMode: 'image' | 'slot' = 'image'): string {
  const foil =
    foilMode === 'slot'
      ? `<div class="recibo-foil-slot"></div>`
      : layout.foilDataUrl
        ? `<img class="recibo-foil" src="${escapeHtml(layout.foilDataUrl)}" alt="" />`
        : `<div class="recibo-foil-fallback" aria-hidden="true"></div>`

  const cnpj = layout.cnpj
    ? `<p class="recibo-sign-meta">CNPJ ${escapeHtml(layout.cnpj)}</p>`
    : ''

  return `
    <div class="recibo-frame">
      <article class="recibo-sheet">
        <header class="recibo-masthead">
          <div class="recibo-foil-strip">${foil}</div>
          <div class="recibo-masthead-inner">
            <img class="recibo-logo" src="${escapeHtml(layout.logoUrl)}" alt="GARBO Movelaria" />
            <p class="recibo-eyebrow">Comprovante de recebimento</p>
            <h1 class="recibo-title">Recibo</h1>
            <p class="recibo-tag">Móveis planejados de alta qualidade</p>
          </div>
        </header>
        <section class="recibo-meta">
          <div class="recibo-meta-cell">
            <span class="recibo-label">Recebemos de</span>
            <div class="recibo-value">${escapeHtml(layout.clienteNome)}</div>
          </div>
          <div class="recibo-meta-cell">
            <span class="recibo-label">Valor</span>
            <div class="recibo-value recibo-value-gold">${escapeHtml(layout.valorLabel)}</div>
          </div>
          <div class="recibo-meta-cell">
            <span class="recibo-label">Referente</span>
            <div class="recibo-value">${escapeHtml(layout.parcelaLabel)}</div>
          </div>
          <div class="recibo-meta-cell">
            <span class="recibo-label">Data e forma</span>
            <div class="recibo-value">${escapeHtml(layout.dataPagamentoLabel)} · ${escapeHtml(layout.formaPagamentoLabel)}</div>
          </div>
        </section>
        <div class="recibo-body">${escapeHtml(layout.texto)}</div>
        <footer class="recibo-sign">
          <div class="recibo-sign-line"></div>
          <p class="recibo-sign-name">Garbo Movelaria</p>
          ${cnpj}
        </footer>
        <div class="recibo-foot-edge" aria-hidden="true"></div>
      </article>
    </div>
  `
}

export function buildReciboPrintHtml(layout: ReciboPrintLayout): string {
  const cliente = escapeHtml(layout.clienteNome)
  return `<!DOCTYPE html>
<html lang="pt-BR">
  <head>
    <meta charset="utf-8" />
    <title>Recibo — ${cliente}</title>
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,600;1,400&family=DM+Sans:wght@400;600&display=swap" rel="stylesheet" />
    <style>
      @page { size: A4 portrait; margin: 10mm; }
      * { box-sizing: border-box; }
      html, body {
        width: 100%;
        margin: 0;
        padding: 0;
        background: #fff;
      }
      body {
        font-family: 'Cormorant Garamond', Georgia, serif;
        color: #2a1812;
      }
      .recibo-page {
        width: 100%;
        max-width: 190mm;
        margin: 0 auto;
      }
      ${RECIBO_SHEET_CSS}
      @media print {
        body { background: #fff; }
        .recibo-frame { break-inside: avoid; }
      }
    </style>
  </head>
  <body>
    <div class="recibo-page">
      ${buildReciboSheetInnerHtml(layout, 'image')}
    </div>
    <script>
      (function () {
        function readyThenPrint() {
          var imgs = Array.prototype.slice.call(document.images || []);
          var waits = imgs.map(function (img) {
            if (img.complete) return Promise.resolve();
            return new Promise(function (resolve) {
              img.addEventListener('load', resolve, { once: true });
              img.addEventListener('error', resolve, { once: true });
            });
          });
          var fonts = (document.fonts && document.fonts.ready)
            ? document.fonts.ready
            : Promise.resolve();
          var timeout = new Promise(function (resolve) { setTimeout(resolve, 1600); });
          Promise.all([Promise.all(waits), Promise.race([fonts, timeout])])
            .then(function () {
              window.focus();
              window.print();
            });
        }
        if (document.readyState === 'complete') readyThenPrint();
        else window.addEventListener('load', readyThenPrint);
      })();
    </script>
  </body>
</html>`
}

export function imprimirReciboLayout(layout: ReciboPrintLayout): void {
  const printWindow = window.open('', '_blank')
  if (!printWindow) return
  printWindow.document.write(buildReciboPrintHtml(layout))
  printWindow.document.close()
}

export function imprimirReciboTexto(
  conta: ContaReceber,
  texto: string,
  extras?: {
    formaPagamentoLabel?: string
    dataPagamento?: string
    cnpj?: string
    foilDataUrl?: string | null
  },
): void {
  imprimirReciboLayout(
    buildReciboPrintLayout(conta, texto, {
      formaPagamentoLabel: extras?.formaPagamentoLabel ?? '—',
      dataPagamento: extras?.dataPagamento ?? conta.data_recebimento?.slice(0, 10) ?? '',
      cnpj: extras?.cnpj,
      foilDataUrl: extras?.foilDataUrl,
    }),
  )
}

export function imprimirRecibo(
  conta: ContaReceber,
  config: ReciboConfig,
  overrides: ReciboPrintOverrides,
  pmLabel: Record<FormaPagamento, string>,
): void {
  imprimirReciboTexto(conta, buildReciboCompleto(conta, config, overrides, pmLabel), {
    formaPagamentoLabel: pmLabel[overrides.formaPagamento] ?? overrides.formaPagamento,
    dataPagamento: overrides.dataPagamento,
    cnpj: config.cnpj,
  })
}
