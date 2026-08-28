import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { parseBlocks } from '@/lib/lead-ai-formatted-content';
import { normalizarRelatorioAnaliseIa } from '@/lib/lead-ai-relatorio-markdown';

function esc(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function renderInlineHtml(text: string): string {
  const parts = text.split(/(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/g);
  return parts
    .map((part) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return `<strong>${esc(part.slice(2, -2))}</strong>`;
      }
      if (part.startsWith('*') && part.endsWith('*') && !part.startsWith('**')) {
        return `<em>${esc(part.slice(1, -1))}</em>`;
      }
      if (part.startsWith('`') && part.endsWith('`')) {
        return `<code>${esc(part.slice(1, -1))}</code>`;
      }
      return esc(part);
    })
    .join('');
}

function markdownToBodyHtml(raw: string): string {
  const blocks = parseBlocks(normalizarRelatorioAnaliseIa(raw));
  if (blocks.length === 0) return '';

  return blocks
    .map((block) => {
      if (block.type === 'hr') return '<hr class="separador" />';
      if (block.type === 'h1' && block.text) {
        return `<h1 class="titulo-principal">${renderInlineHtml(block.text)}</h1>`;
      }
      if (block.type === 'h2' && block.text) {
        return `<h2 class="secao">${renderInlineHtml(block.text)}</h2>`;
      }
      if (block.type === 'h3' && block.text) {
        return `<h3 class="subsecao">${renderInlineHtml(block.text)}</h3>`;
      }
      if (block.type === 'h4' && block.text) {
        return `<h4 class="subtitulo">${renderInlineHtml(block.text)}</h4>`;
      }
      if (block.type === 'ul' && block.items) {
        const items = block.items.map((item) => `<li>${renderInlineHtml(item)}</li>`).join('');
        return `<ul class="lista">${items}</ul>`;
      }
      if (block.type === 'ol' && block.items) {
        const items = block.items.map((item) => `<li>${renderInlineHtml(item)}</li>`).join('');
        return `<ol class="lista-numerada">${items}</ol>`;
      }
      if (block.type === 'p' && block.text) {
        return `<p class="paragrafo">${renderInlineHtml(block.text)}</p>`;
      }
      return '';
    })
    .join('\n');
}

const RELATORIO_PDF_CSS = `
  * { box-sizing: border-box; margin: 0; padding: 0; }

  @page {
    size: A4 portrait;
    margin: 14mm 16mm;
  }

  html, body {
    width: 100%;
    margin: 0;
    padding: 0;
    background: #fff;
  }

  body {
    font-family: 'Segoe UI', system-ui, sans-serif;
    font-size: 11pt;
    line-height: 1.55;
    color: #1a1a1a;
  }

  .pagina {
    width: 100%;
    max-width: 178mm;
    margin: 0 auto;
    padding: 0;
  }

  .cabecalho {
    display: flex;
    align-items: center;
    gap: 16px;
    padding-bottom: 12px;
    margin-bottom: 16px;
    border-bottom: 2px solid #c9a07b;
    page-break-after: avoid;
    break-after: avoid;
  }

  .logo {
    max-height: 52px;
    max-width: 120px;
    object-fit: contain;
    flex-shrink: 0;
  }

  .empresa-info { flex: 1; min-width: 0; }

  .empresa-nome {
    font-size: 16pt;
    font-weight: 700;
    color: #2a1812;
    word-wrap: break-word;
  }

  .empresa-cnpj {
    font-size: 9pt;
    color: #666;
    margin-top: 2px;
  }

  .meta {
    font-size: 10pt;
    color: #666;
    margin-bottom: 20px;
  }

  .meta-titulo {
    font-size: 13pt;
    font-weight: 600;
    color: #2a1812;
    margin-bottom: 4px;
  }

  .conteudo { margin-bottom: 8px; }

  .titulo-principal {
    font-size: 15pt;
    font-weight: 700;
    color: #2a1812;
    margin: 18px 0 10px;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    page-break-after: avoid;
    break-after: avoid;
  }

  .secao {
    font-size: 13pt;
    font-weight: 600;
    color: #2a1812;
    margin: 16px 0 8px;
    padding-bottom: 4px;
    border-bottom: 1px solid #e0d4c4;
    page-break-after: avoid;
    break-after: avoid;
  }

  .subsecao {
    font-size: 11.5pt;
    font-weight: 600;
    color: #3d2a1f;
    margin: 12px 0 6px;
    page-break-after: avoid;
    break-after: avoid;
  }

  .subtitulo {
    font-size: 11pt;
    font-weight: 600;
    color: #5c4a3a;
    margin: 10px 0 4px;
  }

  .paragrafo { margin-bottom: 8px; text-align: justify; }

  .lista, .lista-numerada {
    margin: 6px 0 10px 1.2em;
    padding-left: 0.4em;
  }

  .lista li, .lista-numerada li { margin-bottom: 4px; }

  .separador {
    border: none;
    border-top: 1px solid #e5e5e5;
    margin: 16px 0;
  }

  code {
    font-family: Consolas, monospace;
    font-size: 0.9em;
    background: #f4f0ea;
    padding: 1px 4px;
    border-radius: 3px;
  }

  .briefing {
    margin-top: 24px;
    padding: 14px 16px;
    border: 1px solid #c9a07b;
    border-radius: 6px;
    background: #faf6ef;
    page-break-inside: avoid;
    break-inside: avoid;
  }

  .briefing-titulo {
    font-size: 10pt;
    font-weight: 700;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: #8b6914;
    margin-bottom: 10px;
  }

  .rodape {
    margin-top: 28px;
    padding-top: 10px;
    border-top: 1px solid #e5e5e5;
    font-size: 8pt;
    color: #888;
    text-align: center;
  }

  @media print {
    body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .pagina { max-width: none; }
    .secao, .subsecao, .titulo-principal { page-break-after: avoid; }
    .paragrafo, .lista li { orphans: 3; widows: 3; }
  }
`;

export interface LeadAIRelatorioPdfExportInput {
  content: string;
  briefingContent?: string | null;
  logoUrl?: string | null;
  nomeEmpresa?: string | null;
  cnpj?: string | null;
  leadName?: string | null;
  leadId?: number | null;
}

function buildCabecalhoHtml(
  logoUrl: string | null | undefined,
  nomeEmpresa: string | null | undefined,
  cnpj: string | null | undefined,
): string {
  const nomeDisplay = nomeEmpresa?.trim() || '';
  return `
    <div class="cabecalho">
      ${logoUrl ? `<img src="${esc(logoUrl)}" alt="Logo" class="logo" crossorigin="anonymous" />` : ''}
      <div class="empresa-info">
        ${nomeDisplay ? `<div class="empresa-nome">${esc(nomeDisplay)}</div>` : ''}
        ${cnpj?.trim() ? `<div class="empresa-cnpj">CNPJ: ${esc(cnpj.trim())}</div>` : ''}
      </div>
    </div>
  `;
}

function buildRelatorioBodyHtml(input: LeadAIRelatorioPdfExportInput): string {
  const { content, briefingContent } = input;
  const corpoHtml = markdownToBodyHtml(content);
  const briefingHtml = briefingContent?.trim() ? markdownToBodyHtml(briefingContent) : '';

  return `
    <div class="conteudo">
      ${corpoHtml}
    </div>
    ${
      briefingHtml
        ? `
    <section class="briefing">
      <p class="briefing-titulo">Perguntas para briefing</p>
      ${briefingHtml}
    </section>`
        : ''
    }
  `;
}

export function buildLeadAIRelatorioPdfFileName(leadId?: number | null, leadName?: string | null): string {
  const datePart = format(new Date(), 'yyyy-MM-dd');
  const slug = leadName
    ?.trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);

  if (leadId && slug) return `relatorio-ia-${slug}-${leadId}-${datePart}.pdf`;
  if (leadId) return `relatorio-ia-lead-${leadId}-${datePart}.pdf`;
  return `relatorio-ia-${datePart}.pdf`;
}

export function openLeadAIRelatorioPdfPrint(input: LeadAIRelatorioPdfExportInput): void {
  if (!input.content.trim() && !input.briefingContent?.trim()) {
    throw new Error('O relatório está vazio.');
  }

  const nomeDisplay = input.nomeEmpresa?.trim() || '';
  const dataGeracao = format(new Date(), "dd 'de' MMMM 'de' yyyy 'às' HH:mm", { locale: ptBR });
  const tituloDoc = input.leadName?.trim()
    ? `Relatório IA — ${input.leadName.trim()}`
    : 'Relatório de análise IA';

  const metaParts: string[] = [`Gerado em ${dataGeracao}`];
  if (input.leadId) metaParts.push(`Lead #${input.leadId}`);

  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <title>${esc(tituloDoc)}</title>
  <style>${RELATORIO_PDF_CSS}</style>
</head>
<body>
  <div class="pagina">
    ${buildCabecalhoHtml(input.logoUrl, input.nomeEmpresa, input.cnpj)}
    <div class="meta">
      ${input.leadName?.trim() ? `<p class="meta-titulo">${esc(input.leadName.trim())}</p>` : ''}
      <p>Relatório de análise visual com IA · ${esc(metaParts.join(' · '))}</p>
    </div>
    ${buildRelatorioBodyHtml(input)}
    <div class="rodape">
      ${nomeDisplay ? `${esc(nomeDisplay)} · ` : ''}Documento gerado pelo CRM Selletos
    </div>
  </div>
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
</html>`;

  const janela = window.open('', '_blank', 'width=900,height=700');
  if (!janela) {
    throw new Error('Permita pop-ups para exportar o PDF.');
  }
  janela.document.open();
  janela.document.write(html);
  janela.document.close();
}
