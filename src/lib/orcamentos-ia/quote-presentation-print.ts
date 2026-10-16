import { CORTE_CLAUDE_TOKENS } from '@/lib/orcamentos-ia/ui-tokens'
import {
  formatBRL,
  type QuotePresentationLayout,
} from '@/lib/orcamentos-ia/quote-presentation'

function esc(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

const T = CORTE_CLAUDE_TOKENS

/** CSS compartilhado — preview na página e janela de impressão. */
export const QUOTE_PRESENTATION_CSS = `
  * { box-sizing: border-box; margin: 0; padding: 0; }

  @page {
    size: A4 portrait;
    margin: 8mm;
  }

  html, body {
    width: 100%;
    margin: 0;
    padding: 0;
    background: ${T.paperWarm};
  }

  body {
    font-family: Raleway, "Segoe UI", system-ui, sans-serif;
    font-size: 10.5pt;
    color: ${T.ink};
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }

  .qp-sheet {
    width: 194mm;
    max-width: 100%;
    margin: 0 auto;
    padding: 0 0 6mm;
    background: ${T.card};
  }

  .qp-cover {
    position: relative;
    padding: 9mm 9mm 7mm;
    border-bottom: 3px solid ${T.accent};
    overflow: hidden;
    background:
      linear-gradient(135deg, rgba(0,102,255,0.09) 0%, transparent 42%),
      linear-gradient(180deg, #f8fafc 0%, ${T.card} 70%);
  }

  .qp-cover::after {
    content: "";
    position: absolute;
    inset: 0;
    pointer-events: none;
    opacity: 0.35;
    background-image:
      linear-gradient(rgba(0,102,255,0.07) 1px, transparent 1px),
      linear-gradient(90deg, rgba(0,102,255,0.07) 1px, transparent 1px);
    background-size: 14px 14px;
    mask-image: linear-gradient(180deg, #000 0%, transparent 75%);
  }

  .qp-brand-row {
    position: relative;
    z-index: 1;
    display: flex;
    align-items: center;
    gap: 14px;
    margin-bottom: 16px;
  }

  .qp-logo {
    max-height: 56px;
    max-width: 130px;
    object-fit: contain;
  }

  .qp-brand-name {
    font-size: 17pt;
    font-weight: 700;
    letter-spacing: 0.02em;
    color: ${T.ink};
  }

  .qp-brand-meta {
    font-size: 8.5pt;
    color: ${T.muted};
    margin-top: 2px;
  }

  .qp-eyebrow {
    position: relative;
    z-index: 1;
    font-size: 8pt;
    font-weight: 700;
    letter-spacing: 0.16em;
    text-transform: uppercase;
    color: ${T.accent};
    margin-bottom: 8px;
  }

  .qp-title {
    position: relative;
    z-index: 1;
    font-size: 20pt;
    font-weight: 700;
    line-height: 1.15;
    color: ${T.ink};
    word-break: break-word;
    max-width: 140mm;
  }

  .qp-date {
    position: relative;
    z-index: 1;
    margin-top: 8px;
    font-size: 9pt;
    color: ${T.muted};
  }

  .qp-totals {
    position: relative;
    z-index: 1;
    display: grid;
    grid-template-columns: 1fr;
    gap: 10px;
    max-width: 300px;
    margin-top: 18px;
  }

  .qp-total-block {
    padding: 12px 14px;
    border: 1px solid rgba(15, 20, 25, 0.1);
    border-radius: 10px;
    background: ${T.paper};
  }

  .qp-total-block.sale {
    border-color: rgba(0, 102, 255, 0.4);
    background: linear-gradient(135deg, rgba(0,102,255,0.1), rgba(0,102,255,0.03));
    box-shadow: 0 8px 24px rgba(0, 102, 255, 0.08);
  }

  .qp-total-label {
    font-size: 8pt;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    color: ${T.muted};
  }

  .qp-total-value {
    margin-top: 4px;
    font-size: 20pt;
    font-weight: 700;
    font-variant-numeric: tabular-nums;
    color: ${T.ink};
  }

  .qp-total-block.sale .qp-total-value {
    color: ${T.accent};
  }

  .qp-env {
    padding: 7mm 9mm 6mm;
    page-break-inside: avoid;
    break-inside: avoid;
  }

  .qp-env + .qp-env {
    border-top: 1px solid rgba(15, 20, 25, 0.08);
  }

  .qp-env-hero {
    width: 100%;
    height: 210px;
    object-fit: cover;
    border-radius: 12px;
    border: 1px solid rgba(0, 102, 255, 0.25);
    margin-bottom: 12px;
    background:
      linear-gradient(135deg, rgba(0,102,255,0.12), transparent 55%),
      repeating-linear-gradient(0deg, transparent, transparent 11px, rgba(0,102,255,0.06) 11px, rgba(0,102,255,0.06) 12px),
      repeating-linear-gradient(90deg, transparent, transparent 11px, rgba(0,102,255,0.06) 11px, rgba(0,102,255,0.06) 12px),
      ${T.paper};
    display: block;
  }

  .qp-env-hero.qp-thumb-ph {
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 11pt;
    font-weight: 700;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: ${T.accent};
  }

  .qp-env-head {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 14px;
    margin-bottom: 14px;
  }

  .qp-thumb-ph {
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 8pt;
    font-weight: 600;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: ${T.accent};
  }

  .qp-env-name {
    font-size: 15pt;
    font-weight: 700;
    color: ${T.ink};
  }

  .qp-env-sub {
    margin-top: 4px;
    font-size: 9pt;
    color: ${T.muted};
  }

  .qp-env-money {
    text-align: right;
    flex-shrink: 0;
  }

  .qp-env-sale {
    font-size: 15pt;
    font-weight: 700;
    font-variant-numeric: tabular-nums;
    color: ${T.accent};
  }

  .qp-modules {
    display: flex;
    flex-direction: column;
    gap: 14px;
  }

  .qp-mod {
    display: grid;
    grid-template-columns: 188px 1fr auto;
    gap: 0;
    align-items: stretch;
    border: 1px solid rgba(15, 20, 25, 0.1);
    border-radius: 12px;
    background: #fafaf8;
    overflow: hidden;
    page-break-inside: avoid;
    break-inside: avoid;
  }

  .qp-mod-thumb {
    width: 188px;
    height: 168px;
    object-fit: cover;
    border: none;
    border-right: 1px solid rgba(0, 102, 255, 0.18);
    background: ${T.paper};
    display: block;
  }

  .qp-mod-thumb.qp-thumb-ph {
    width: 188px;
    height: 168px;
  }

  .qp-mod-body {
    padding: 12px 14px;
    display: flex;
    flex-direction: column;
    justify-content: center;
    min-width: 0;
    gap: 6px;
  }

  .qp-mod-name {
    font-size: 12pt;
    font-weight: 700;
    color: ${T.ink};
    line-height: 1.25;
  }

  .qp-mod-meta {
    font-size: 8.5pt;
    color: ${T.muted};
  }

  .qp-mod-chips {
    display: flex;
    flex-wrap: wrap;
    gap: 5px;
    margin-top: 2px;
  }

  .qp-chip {
    display: inline-block;
    padding: 2px 7px;
    border-radius: 999px;
    border: 1px solid rgba(0, 102, 255, 0.22);
    background: rgba(0, 102, 255, 0.06);
    font-size: 7.5pt;
    font-weight: 600;
    color: ${T.inkSoft};
    letter-spacing: 0.02em;
  }

  .qp-mod-desc {
    font-size: 8.5pt;
    line-height: 1.35;
    color: ${T.muted};
  }

  .qp-mod-details {
    font-size: 8pt;
    line-height: 1.4;
    color: ${T.inkSoft};
  }

  .qp-mod-money {
    text-align: right;
    padding: 12px 14px;
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: flex-end;
    min-width: 96px;
    background: linear-gradient(180deg, rgba(0,102,255,0.04), transparent);
  }

  .qp-mod-sale-label {
    font-size: 7pt;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    color: ${T.muted};
    margin-bottom: 3px;
  }

  .qp-mod-sale {
    font-size: 13pt;
    font-weight: 700;
    font-variant-numeric: tabular-nums;
    color: ${T.ink};
  }

  .qp-oos {
    padding: 5mm 9mm 6mm;
    border-top: 1px dashed rgba(15, 20, 25, 0.15);
  }

  .qp-oos-title {
    font-size: 9pt;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    color: ${T.walnutSoft};
    margin-bottom: 8px;
  }

  .qp-oos-list {
    font-size: 9pt;
    color: ${T.muted};
    line-height: 1.5;
  }

  .qp-footer {
    padding: 5mm 9mm 6mm;
    border-top: 1px solid rgba(15, 20, 25, 0.08);
    font-size: 9.5pt;
    font-weight: 700;
    letter-spacing: 0.04em;
    color: ${T.ink};
    text-align: center;
  }

  .qp-cover--compact { padding-bottom: 5mm; }
  .qp-pl-env { padding: 4mm 9mm 2mm; }
  .qp-pl-env-head {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 12px;
    margin-bottom: 2mm;
    padding-bottom: 1.5mm;
    border-bottom: 1px solid rgba(0, 102, 255, 0.25);
  }
  .qp-pl-env-head h2 {
    font-size: 12pt;
    font-weight: 700;
    color: ${T.ink};
  }
  .qp-pl-env-head span {
    font-size: 11pt;
    font-weight: 700;
    color: ${T.accent};
    white-space: nowrap;
  }
  .qp-pl-table {
    width: 100%;
    border-collapse: collapse;
    margin-bottom: 3mm;
  }
  .qp-pl-table td {
    padding: 2.2mm 0;
    border-bottom: 1px solid rgba(15, 20, 25, 0.06);
    vertical-align: top;
  }
  .qp-pl-name { font-size: 10pt; color: ${T.ink}; padding-right: 8px; }
  .qp-pl-price {
    font-size: 10pt;
    font-weight: 700;
    text-align: right;
    white-space: nowrap;
    color: ${T.ink};
    width: 28%;
  }

  @media print {
    html, body { background: #fff; }
    .qp-sheet { width: 100%; }
  }

  @media (max-width: 720px) {
    .qp-mod {
      grid-template-columns: 1fr;
    }
    .qp-mod-thumb,
    .qp-mod-thumb.qp-thumb-ph {
      width: 100%;
      height: 180px;
      border-right: none;
      border-bottom: 1px solid rgba(0, 102, 255, 0.18);
    }
    .qp-mod-money {
      align-items: flex-start;
      text-align: left;
      border-top: 1px solid rgba(15, 20, 25, 0.06);
    }
  }
`

function thumbHtml(url: string | null, className: string, placeholder: string): string {
  if (url) {
    return `<img class="${className}" src="${esc(url)}" alt="" />`
  }
  return `<div class="${className} qp-thumb-ph" aria-hidden="true">${esc(placeholder)}</div>`
}

function moduleChipsHtml(mod: {
  dimensionsLabel: string | null
  pageNumber: number | null
  sheetPieceCount: number
  hardwareCount: number
}): string {
  const chips: string[] = []
  if (mod.dimensionsLabel) chips.push(mod.dimensionsLabel)
  if (mod.pageNumber != null) chips.push(`Pág. ${mod.pageNumber}`)
  if (mod.sheetPieceCount > 0) chips.push(`${Math.round(mod.sheetPieceCount)} peças`)
  if (mod.hardwareCount > 0) chips.push(`${Math.round(mod.hardwareCount)} ferragens`)
  if (!chips.length) return ''
  return `<div class="qp-mod-chips">${chips.map((c) => `<span class="qp-chip">${esc(c)}</span>`).join('')}</div>`
}

export type QuotePresentationBodyMode = 'full' | 'priceList'

/** Lista compacta: ambiente → móveis → preços (sem fotos). */
function buildPriceListBodyHtml(layout: QuotePresentationLayout): string {
  const { branding, pricing } = layout
  const logo = branding.logoUrl
    ? `<img class="qp-logo" src="${esc(branding.logoUrl)}" alt="" />`
    : ''
  const legalBits = [branding.razaoSocial, branding.cnpj ? `CNPJ ${branding.cnpj}` : null]
    .filter(Boolean)
    .join(' · ')

  const envBlocks = layout.environments
    .map((env) => {
      const rows = env.modules
        .filter((m) => !m.outOfScope)
        .map(
          (mod) => `
        <tr>
          <td class="qp-pl-name">${esc(mod.name)}</td>
          <td class="qp-pl-price">${esc(formatBRL(mod.salePrice))}</td>
        </tr>`,
        )
        .join('')
      if (!rows) return ''
      return `
      <section class="qp-pl-env">
        <header class="qp-pl-env-head">
          <h2>${esc(env.name)}</h2>
          <span>${esc(formatBRL(env.salePrice))}</span>
        </header>
        <table class="qp-pl-table">
          <tbody>${rows}</tbody>
        </table>
      </section>`
    })
    .join('')

  return `
  <article class="qp-sheet qp-sheet--price-list">
    <header class="qp-cover qp-cover--compact">
      <div class="qp-brand-row">
        ${logo}
        <div>
          <div class="qp-brand-name">${esc(branding.companyName)}</div>
          ${legalBits ? `<div class="qp-brand-meta">${esc(legalBits)}</div>` : ''}
        </div>
      </div>
      <p class="qp-eyebrow">Lista de preços · Corte Claude</p>
      <h1 class="qp-title">${esc(layout.projectTitle)}</h1>
      <p class="qp-date">Gerado em ${esc(layout.generatedAtLabel)}</p>
      <div class="qp-totals">
        <div class="qp-total-block sale">
          <div class="qp-total-label">Total da proposta</div>
          <div class="qp-total-value">${esc(formatBRL(pricing.salePrice))}</div>
        </div>
      </div>
    </header>
    ${envBlocks || '<section class="qp-pl-env"><p class="qp-env-sub">Nenhum móvel cotado.</p></section>'}
    <footer class="qp-footer">Garbo orçamentos</footer>
  </article>`
}

/** Corpo HTML do documento (preview e print). */
export function buildQuotePresentationBodyHtml(
  layout: QuotePresentationLayout,
  mode: QuotePresentationBodyMode = 'full',
): string {
  if (mode === 'priceList') return buildPriceListBodyHtml(layout)

  const { branding, pricing } = layout
  const logo = branding.logoUrl
    ? `<img class="qp-logo" src="${esc(branding.logoUrl)}" alt="" />`
    : ''
  const legalBits = [branding.razaoSocial, branding.cnpj ? `CNPJ ${branding.cnpj}` : null]
    .filter(Boolean)
    .join(' · ')

  const envHtml = layout.environments
    .map((env) => {
      const mods = env.modules
        .map((mod) => {
          const details =
            mod.detailLines?.length > 0
              ? `<div class="qp-mod-details">${mod.detailLines.map((l) => esc(l)).join('<br/>')}</div>`
              : ''
          const desc = mod.description
            ? `<div class="qp-mod-desc">${esc(mod.description)}</div>`
            : ''
          return `
        <article class="qp-mod">
          ${thumbHtml(mod.imageUrl, 'qp-mod-thumb', 'Foto')}
          <div class="qp-mod-body">
            <div class="qp-mod-name">${esc(mod.name)}</div>
            ${moduleChipsHtml(mod)}
            ${desc}
            ${details}
          </div>
          <div class="qp-mod-money">
            <div class="qp-mod-sale-label">Preço</div>
            <div class="qp-mod-sale">${esc(formatBRL(mod.salePrice))}</div>
          </div>
        </article>`
        })
        .join('')

      return `
      <section class="qp-env">
        ${thumbHtml(env.imageUrl, 'qp-env-hero', 'Ambiente')}
        <header class="qp-env-head">
          <div>
            <h2 class="qp-env-name">${esc(env.name)}</h2>
            <p class="qp-env-sub">${env.modules.length} móvel(is) nesta proposta</p>
          </div>
          <div class="qp-env-money">
            <div class="qp-env-sale">${esc(formatBRL(env.salePrice))}</div>
          </div>
        </header>
        <div class="qp-modules">${mods}</div>
      </section>`
    })
    .join('')

  const oosHtml =
    layout.outOfScopeModules.length > 0
      ? `<section class="qp-oos">
          <h3 class="qp-oos-title">Fora do orçamento de marcenaria</h3>
          <p class="qp-oos-list">${layout.outOfScopeModules.map((m) => esc(m.name)).join(' · ')}</p>
        </section>`
      : ''

  return `
  <article class="qp-sheet">
    <header class="qp-cover">
      <div class="qp-brand-row">
        ${logo}
        <div>
          <div class="qp-brand-name">${esc(branding.companyName)}</div>
          ${legalBits ? `<div class="qp-brand-meta">${esc(legalBits)}</div>` : ''}
        </div>
      </div>
      <p class="qp-eyebrow">Proposta · Corte Claude</p>
      <h1 class="qp-title">${esc(layout.projectTitle)}</h1>
      <p class="qp-date">Gerado em ${esc(layout.generatedAtLabel)}</p>
      <div class="qp-totals">
        <div class="qp-total-block sale">
          <div class="qp-total-label">Total da proposta</div>
          <div class="qp-total-value">${esc(formatBRL(pricing.salePrice))}</div>
        </div>
      </div>
    </header>
    ${envHtml || '<section class="qp-env"><p class="qp-env-sub">Nenhum ambiente cotado nesta análise.</p></section>'}
    ${oosHtml}
    <footer class="qp-footer">Garbo orçamentos</footer>
  </article>`
}

export function buildQuotePresentationHtml(
  layout: QuotePresentationLayout,
  mode: QuotePresentationBodyMode = 'full',
): string {
  const title =
    mode === 'priceList'
      ? `Lista de preços — ${layout.projectTitle}`
      : `Proposta — ${layout.projectTitle}`
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <title>${esc(title)}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Raleway:wght@500;600;700&display=swap" rel="stylesheet" />
  <style>${QUOTE_PRESENTATION_CSS}</style>
</head>
<body>
  ${buildQuotePresentationBodyHtml(layout, mode)}
  <script>
    function waitForImages() {
      var imgs = Array.prototype.slice.call(document.images);
      if (imgs.length === 0) return Promise.resolve();
      return Promise.all(imgs.map(function(img) {
        if (img.complete && img.naturalWidth > 0) return Promise.resolve();
        return new Promise(function(resolve) {
          img.onload = resolve;
          img.onerror = resolve;
        });
      }));
    }
    window.onload = function() {
      waitForImages().then(function() {
        requestAnimationFrame(function() {
          window.focus();
          window.print();
          setTimeout(function() { window.close(); }, 500);
        });
      });
    };
  </script>
</body>
</html>`
}

/**
 * Abre a proposta para impressão/PDF.
 * 1) tenta nova aba (pop-up);
 * 2) se bloqueado, Blob URL na mesma navegação;
 * 3) se ainda falhar, iframe oculto + print.
 */
export function openQuotePresentationPrint(
  layout: QuotePresentationLayout,
  mode: QuotePresentationBodyMode = 'full',
): void {
  const html = buildQuotePresentationHtml(layout, mode)

  const janela = window.open('', '_blank', 'width=920,height=720')
  if (janela) {
    try {
      janela.document.open()
      janela.document.write(html)
      janela.document.close()
      return
    } catch {
      try {
        janela.close()
      } catch {
        /* ignore */
      }
    }
  }

  const blob = new Blob([html], { type: 'text/html;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const tab = window.open(url, '_blank')
  if (tab) {
    setTimeout(() => URL.revokeObjectURL(url), 60_000)
    return
  }

  const iframe = document.createElement('iframe')
  iframe.setAttribute('title', 'Impressão da proposta')
  iframe.style.position = 'fixed'
  iframe.style.right = '0'
  iframe.style.bottom = '0'
  iframe.style.width = '0'
  iframe.style.height = '0'
  iframe.style.border = '0'
  iframe.style.opacity = '0'
  iframe.style.pointerEvents = 'none'
  document.body.appendChild(iframe)

  const cleanup = () => {
    URL.revokeObjectURL(url)
    iframe.remove()
  }

  iframe.onload = () => {
    try {
      iframe.contentWindow?.focus()
      iframe.contentWindow?.print()
    } finally {
      setTimeout(cleanup, 1500)
    }
  }
  iframe.src = url
  setTimeout(cleanup, 120_000)
}
