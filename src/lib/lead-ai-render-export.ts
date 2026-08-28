import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { downloadImageFromUrl } from '@/lib/download-file';

function esc(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

const RENDER_PDF_CSS = `
  * { box-sizing: border-box; margin: 0; padding: 0; }

  @page {
    size: A4 landscape;
    margin: 12mm;
  }

  body {
    font-family: 'Segoe UI', system-ui, sans-serif;
    font-size: 11pt;
    color: #1a1a1a;
    background: #fff;
  }

  .pagina {
    width: 100%;
    max-width: 277mm;
    margin: 0 auto;
    padding: 4mm 0;
  }

  .cabecalho {
    display: flex;
    align-items: center;
    gap: 16px;
    padding-bottom: 12px;
    margin-bottom: 16px;
    border-bottom: 2px solid #c9a07b;
  }

  .logo {
    max-height: 56px;
    max-width: 120px;
    object-fit: contain;
    flex-shrink: 0;
  }

  .empresa-info {
    flex: 1;
    min-width: 0;
  }

  .empresa-nome {
    font-size: 16pt;
    font-weight: 700;
    color: #2a1812;
    word-wrap: break-word;
  }

  .empresa-cnpj {
    font-size: 10pt;
    color: #666;
    margin-top: 2px;
  }

  .titulo {
    font-size: 14pt;
    font-weight: 600;
    color: #2a1812;
    margin-bottom: 4px;
  }

  .subtitulo {
    font-size: 10pt;
    color: #666;
    margin-bottom: 16px;
  }

  .comparacao {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 16px;
    align-items: start;
  }

  .comparacao-coluna {
    min-width: 0;
    page-break-inside: avoid;
  }

  .coluna-badge {
    display: inline-block;
    font-size: 9pt;
    font-weight: 700;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: #8b6914;
    background: #f5ecd8;
    border: 1px solid #c9a07b;
    border-radius: 4px;
    padding: 4px 10px;
    margin-bottom: 8px;
  }

  .coluna-badge.depois {
    color: #2a1812;
    background: #ebe4d8;
  }

  .coluna-label {
    font-size: 10pt;
    font-weight: 600;
    color: #444;
    margin-bottom: 8px;
  }

  .coluna-imagem {
    width: 100%;
    max-height: 145mm;
    object-fit: contain;
    border: 1px solid #ddd;
    border-radius: 4px;
    background: #fafafa;
  }

  .coluna-vazia {
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 120mm;
    border: 1px dashed #ccc;
    border-radius: 4px;
    color: #999;
    font-size: 10pt;
    font-style: italic;
  }

  .rodape {
    margin-top: 16px;
    padding-top: 10px;
    border-top: 1px solid #e5e5e5;
    font-size: 9pt;
    color: #888;
    text-align: center;
  }

  @media print {
    body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .pagina { padding: 0; }
  }
`;

export interface LeadAIRenderExportOpts {
  sketchUrl: string | null;
  sketchLabel?: string;
  outputUrl: string | null;
  logoUrl?: string | null;
  nomeEmpresa?: string | null;
  cnpj?: string | null;
}

export async function downloadLeadAIRenderPng(
  outputUrl: string,
  fileName = `render-projeto-${Date.now()}.png`,
): Promise<void> {
  await downloadImageFromUrl(outputUrl, fileName);
}

export function exportLeadAIRenderPdf(opts: LeadAIRenderExportOpts): void {
  const {
    sketchUrl,
    sketchLabel = 'Esboço',
    outputUrl,
    logoUrl,
    nomeEmpresa,
    cnpj,
  } = opts;

  if (!sketchUrl && !outputUrl) {
    throw new Error('Nenhuma imagem disponível para exportar.');
  }

  const nomeDisplay = nomeEmpresa?.trim() || '';
  const dataGeracao = format(new Date(), "dd 'de' MMMM 'de' yyyy 'às' HH:mm", { locale: ptBR });

  const cabecalhoHtml = `
    <div class="cabecalho">
      ${logoUrl ? `<img src="${esc(logoUrl)}" alt="Logo" class="logo" />` : ''}
      <div class="empresa-info">
        ${nomeDisplay ? `<div class="empresa-nome">${esc(nomeDisplay)}</div>` : ''}
        ${cnpj?.trim() ? `<div class="empresa-cnpj">CNPJ: ${esc(cnpj.trim())}</div>` : ''}
      </div>
    </div>
  `;

  const renderColuna = (
    badge: string,
    badgeClass: string,
    label: string,
    src: string | null,
    alt: string,
  ) => `
    <div class="comparacao-coluna">
      <span class="coluna-badge ${badgeClass}">${esc(badge)}</span>
      <p class="coluna-label">${esc(label)}</p>
      ${
        src
          ? `<img src="${esc(src)}" alt="${esc(alt)}" class="coluna-imagem" />`
          : '<div class="coluna-vazia">Imagem indisponível</div>'
      }
    </div>
  `;

  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <title>Renderização IA — ${esc(sketchLabel)}</title>
  <style>${RENDER_PDF_CSS}</style>
</head>
<body>
  <div class="pagina">
    ${cabecalhoHtml}
    <h1 class="titulo">Comparação Visual — Renderização IA</h1>
    <p class="subtitulo">${esc(sketchLabel)} · Gerado em ${esc(dataGeracao)}</p>
    <div class="comparacao">
      ${renderColuna('Antes', '', sketchLabel, sketchUrl, sketchLabel)}
      ${renderColuna('Depois', 'depois', 'Render fotorrealista', outputUrl, 'Render fotorrealista')}
    </div>
    <div class="rodape">
      ${nomeDisplay ? `${esc(nomeDisplay)} · ` : ''}Documento gerado pelo CRM Selletos
    </div>
  </div>
  <script>
    window.onload = function() {
      window.focus();
      window.print();
      setTimeout(function() { window.close(); }, 500);
    };
  </script>
</body>
</html>`;

  const janela = window.open('', '_blank', 'width=1100,height=800');
  if (!janela) {
    throw new Error('Permita pop-ups para exportar o PDF.');
  }
  janela.document.open();
  janela.document.write(html);
  janela.document.close();
}
