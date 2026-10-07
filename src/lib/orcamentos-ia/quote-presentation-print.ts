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
    margin: 10mm;
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
    width: 190mm;
    max-width: 100%;
    margin: 0 auto;
    padding: 0 0 8mm;
    background: ${T.card};
  }

  .qp-cover {
    padding: 8mm 8mm 6mm;
    border-bottom: 2px solid ${T.accent};
    background:
      linear-gradient(180deg, rgba(0,102,255,0.06) 0%, transparent 55%),
      ${T.card};
  }

  .qp-brand-row {
    display: flex;
    align-items: center;
    gap: 14px;
    margin-bottom: 14px;
  }

  .qp-logo {
    max-height: 52px;
    max-width: 120px;
    object-fit: contain;
  }

  .qp-brand-name {
    font-size: 16pt;
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
    font-size: 8pt;
    font-weight: 600;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: ${T.accent};
    margin-bottom: 6px;
  }

  .qp-title {
    font-size: 18pt;
    font-weight: 700;
    line-height: 1.2;
    color: ${T.ink};
    word-break: break-word;
  }

  .qp-date {
    margin-top: 6px;
    font-size: 9pt;
    color: ${T.muted};
  }

  .qp-totals {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 10px;
    margin-top: 16px;
  }

  .qp-total-block {
    padding: 10px 12px;
    border: 1px solid rgba(15, 20, 25, 0.1);
    border-radius: 8px;
    background: ${T.paper};
  }

  .qp-total-block.sale {
    border-color: rgba(0, 102, 255, 0.35);
    background: rgba(0, 102, 255, 0.06);
  }

  .qp-total-label {
    font-size: 8pt;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: ${T.muted};
  }

  .qp-total-value {
    margin-top: 4px;
    font-size: 16pt;
    font-weight: 700;
    font-variant-numeric: tabular-nums;
    color: ${T.ink};
  }

  .qp-total-block.sale .qp-total-value {
    color: ${T.accent};
  }

  .qp-formula {
    margin-top: 8px;
    font-size: 8.5pt;
    color: ${T.muted};
  }

  .qp-env {
    padding: 6mm 8mm 5mm;
    page-break-inside: avoid;
    break-inside: avoid;
  }

  .qp-env + .qp-env {
    border-top: 1px solid rgba(15, 20, 25, 0.08);
  }

  .qp-env-hero {
    width: 100%;
    height: 148px;
    object-fit: cover;
    border-radius: 10px;
    border: 1px solid rgba(0, 102, 255, 0.22);
    margin-bottom: 10px;
    background:
      linear-gradient(135deg, rgba(0,102,255,0.1), transparent 55%),
      repeating-linear-gradient(0deg, transparent, transparent 9px, rgba(0,102,255,0.07) 9px, rgba(0,102,255,0.07) 10px),
      repeating-linear-gradient(90deg, transparent, transparent 9px, rgba(0,102,255,0.07) 9px, rgba(0,102,255,0.07) 10px),
      ${T.paper};
    display: block;
  }

  .qp-env-hero.qp-thumb-ph {
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 10pt;
    font-weight: 700;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: ${T.accent};
  }

  .qp-env-head {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 12px;
    margin-bottom: 12px;
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
    font-size: 14pt;
    font-weight: 700;
    color: ${T.ink};
  }

  .qp-env-sub {
    margin-top: 3px;
    font-size: 8.5pt;
    color: ${T.muted};
  }

  .qp-env-money {
    text-align: right;
    flex-shrink: 0;
  }

  .qp-env-sale {
    font-size: 13pt;
    font-weight: 700;
    font-variant-numeric: tabular-nums;
    color: ${T.accent};
  }

  .qp-env-cost {
    margin-top: 2px;
    font-size: 8.5pt;
    color: ${T.muted};
    font-variant-numeric: tabular-nums;
  }

  .qp-modules {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .qp-mod {
    display: grid;
    grid-template-columns: 132px 1fr auto;
    gap: 12px;
    align-items: stretch;
    padding: 0;
    border: 1px solid rgba(15, 20, 25, 0.1);
    border-radius: 10px;
    background: #fafaf8;
    overflow: hidden;
    page-break-inside: avoid;
    break-inside: avoid;
  }

  .qp-mod-thumb {
    width: 132px;
    height: 110px;
    object-fit: cover;
    border: none;
    border-right: 1px solid rgba(0, 102, 255, 0.15);
    background: ${T.paper};
    display: block;
  }

  .qp-mod-thumb.qp-thumb-ph {
    width: 132px;
    height: 110px;
  }

  .qp-mod-body {
    padding: 10px 4px 10px 0;
    display: flex;
    flex-direction: column;
    justify-content: center;
    min-width: 0;
  }

  .qp-mod-name {
    font-size: 11pt;
    font-weight: 700;
    color: ${T.ink};
  }

  .qp-mod-meta {
    margin-top: 3px;
    font-size: 8pt;
    color: ${T.muted};
  }

  .qp-mod-money {
    text-align: right;
    padding: 10px 12px 10px 0;
    display: flex;
    flex-direction: column;
    justify-content: center;
  }

  .qp-mod-sale {
    font-size: 11.5pt;
    font-weight: 700;
    font-variant-numeric: tabular-nums;
    color: ${T.ink};
  }

  .qp-mod-cost {
    margin-top: 2px;
    font-size: 8pt;
    color: ${T.muted};
    font-variant-numeric: tabular-nums;
  }

  .qp-oos {
    padding: 5mm 8mm 6mm;
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
    padding: 5mm 8mm 6mm;
    border-top: 1px solid rgba(15, 20, 25, 0.08);
    font-size: 9.5pt;
    font-weight: 700;
    letter-spacing: 0.04em;
    color: ${T.ink};
    text-align: center;
  }

  @media print {
    html, body { background: #fff; }
    .qp-sheet { width: 100%; }
  }
`

function thumbHtml(url: string | null, className: string, placeholder: string): string {
  if (url) {
    return `<img class="${className}" src="${esc(url)}" alt="" />`
  }
  return `<div class="${className} qp-thumb-ph" aria-hidden="true">${esc(placeholder)}</div>`
}

/** Corpo HTML do documento (preview e print). */
export function buildQuotePresentationBodyHtml(layout: QuotePresentationLayout): string {
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
        .map(
          (mod) => `
        <article class="qp-mod">
          ${thumbHtml(mod.imageUrl, 'qp-mod-thumb', 'Foto')}
          <div class="qp-mod-body">
            <div class="qp-mod-name">${esc(mod.name)}</div>
            <div class="qp-mod-meta">
              ${mod.dimensionsLabel ? esc(mod.dimensionsLabel) : 'Móvel sob medida'}
              ${mod.pageNumber != null ? ` · pág. ${mod.pageNumber}` : ''}
            </div>
          </div>
          <div class="qp-mod-money">
            <div class="qp-mod-sale">${esc(formatBRL(mod.salePrice))}</div>
            <div class="qp-mod-cost">Materiais ${esc(formatBRL(mod.materialsCost))}</div>
          </div>
        </article>`,
        )
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
            <div class="qp-env-cost">Materiais ${esc(formatBRL(env.materialsCost))}</div>
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
        <div class="qp-total-block">
          <div class="qp-total-label">Materiais</div>
          <div class="qp-total-value">${esc(formatBRL(pricing.materialsCost))}</div>
        </div>
        <div class="qp-total-block sale">
          <div class="qp-total-label">Preço de venda</div>
          <div class="qp-total-value">${esc(formatBRL(pricing.salePrice))}</div>
        </div>
      </div>
      <p class="qp-formula">Cálculo: ${esc(pricing.formulaLabel)}</p>
    </header>
    ${envHtml || '<section class="qp-env"><p class="qp-env-sub">Nenhum ambiente cotado nesta análise.</p></section>'}
    ${oosHtml}
    <footer class="qp-footer">Garbo orçamentos</footer>
  </article>`
}

export function buildQuotePresentationHtml(layout: QuotePresentationLayout): string {
  const title = `Proposta — ${layout.projectTitle}`
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
  ${buildQuotePresentationBodyHtml(layout)}
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
export function openQuotePresentationPrint(layout: QuotePresentationLayout): void {
  const html = buildQuotePresentationHtml(layout)

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

  // Fallback sem pop-up: Blob URL
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const tab = window.open(url, '_blank')
  if (tab) {
    setTimeout(() => URL.revokeObjectURL(url), 60_000)
    return
  }

  // Último recurso: iframe oculto + diálogo de impressão
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

  // Se o navegador não disparar onload a tempo, ainda assim limpa
  setTimeout(cleanup, 120_000)
}
