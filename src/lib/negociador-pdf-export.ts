import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import { formatarMoedaMarkup } from '@/lib/markup-calculo';

export interface NegociadorPdfBranding {
  empresaNome: string;
  empresaCnpj?: string | null;
  logoUrl?: string | null;
  clienteNome?: string | null;
}

export interface NegociadorPdfPayload {
  valorNegociado: number;
  piso: number;
  margemMinimaPercent: number;
  custoMaterial: number;
  precoOriginal: number;
  valorMaterial: number;
  valorMaoObra: number;
  valorLucro: number;
  pctMaterial: number;
  pctMaoObra: number;
  pctLucro: number;
  observacao?: string | null;
  markupsTitulos: string[];
}

function esc(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function buildNegociadorPdfHtml(
  data: NegociadorPdfPayload,
  branding: NegociadorPdfBranding,
): string {
  const dataGeracao = format(new Date(), "dd/MM/yyyy HH:mm", { locale: ptBR });
  const logoSrc = branding.logoUrl?.trim() || '';
  const markups =
    data.markupsTitulos.length > 0
      ? data.markupsTitulos.map((t) => `<li>${esc(t)}</li>`).join('')
      : '<li>—</li>';

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="utf-8" />
<title>Negociação</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: "Segoe UI", system-ui, sans-serif;
    color: #2a1812;
    background: #fffcf8;
    padding: 28px 32px;
    width: 794px;
  }
  .header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    border-bottom: 2px solid #c4963a;
    padding-bottom: 16px;
    margin-bottom: 20px;
  }
  .logo { max-height: 56px; max-width: 180px; object-fit: contain; }
  .empresa { text-align: right; }
  .empresa h1 { font-size: 18px; color: #8d5e22; }
  .empresa p { font-size: 11px; color: #6b5344; margin-top: 2px; }
  h2 { font-size: 15px; color: #8d5e22; margin-bottom: 6px; }
  .meta { font-size: 12px; color: #6b5344; margin-bottom: 16px; line-height: 1.45; }
  .cards {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 10px;
    margin-bottom: 18px;
  }
  .card {
    border: 1px solid #e5d4b8;
    background: #fffaf3;
    border-radius: 8px;
    padding: 10px 12px;
  }
  .card .lbl { font-size: 10px; text-transform: uppercase; letter-spacing: 0.06em; color: #6b5344; }
  .card .val { font-size: 14px; font-weight: 700; margin-top: 4px; color: #2a1812; }
  .card.accent .val { color: #8d5e22; }
  table { width: 100%; border-collapse: collapse; margin-top: 8px; }
  th, td { padding: 8px 10px; border-bottom: 1px solid #efe6d8; font-size: 12px; text-align: left; }
  th { background: #fffaf3; color: #8d5e22; font-size: 11px; text-transform: uppercase; }
  td.num, th.num { text-align: right; font-variant-numeric: tabular-nums; }
  .obs {
    margin-top: 16px;
    padding: 12px;
    border: 1px solid #e5d4b8;
    border-radius: 8px;
    background: #fff;
    font-size: 12px;
    color: #2a1812;
    white-space: pre-wrap;
  }
  ul { margin: 6px 0 0 18px; font-size: 12px; color: #2a1812; }
  .foot { margin-top: 24px; font-size: 10px; color: #6b5344; text-align: center; }
</style>
</head>
<body>
  <div class="header">
    <div>${logoSrc ? `<img class="logo" src="${esc(logoSrc)}" alt="Logo" />` : ''}</div>
    <div class="empresa">
      <h1>${esc(branding.empresaNome || 'Empresa')}</h1>
      ${branding.empresaCnpj ? `<p>CNPJ ${esc(branding.empresaCnpj)}</p>` : ''}
      <p>Proposta de negociação · ${esc(dataGeracao)}</p>
    </div>
  </div>

  <h2>Negociação comercial</h2>
  <p class="meta">
    ${branding.clienteNome ? `Cliente: <strong>${esc(branding.clienteNome)}</strong><br/>` : ''}
    Margem mínima: ${data.margemMinimaPercent}% sobre o custo de material · Piso ${formatarMoedaMarkup(data.piso)}
  </p>

  <div class="cards">
    <div class="card"><div class="lbl">Custo material</div><div class="val">${formatarMoedaMarkup(data.custoMaterial)}</div></div>
    <div class="card"><div class="lbl">Preço original</div><div class="val">${formatarMoedaMarkup(data.precoOriginal)}</div></div>
    <div class="card"><div class="lbl">Piso</div><div class="val">${formatarMoedaMarkup(data.piso)}</div></div>
    <div class="card accent"><div class="lbl">Valor negociado</div><div class="val">${formatarMoedaMarkup(data.valorNegociado)}</div></div>
  </div>

  <h2>Divisão do valor</h2>
  <table>
    <thead>
      <tr><th>Composição</th><th class="num">%</th><th class="num">Valor</th></tr>
    </thead>
    <tbody>
      <tr><td>Material</td><td class="num">${data.pctMaterial.toFixed(2)}%</td><td class="num"><strong>${formatarMoedaMarkup(data.valorMaterial)}</strong></td></tr>
      <tr><td>Mão de obra</td><td class="num">${data.pctMaoObra.toFixed(2)}%</td><td class="num"><strong>${formatarMoedaMarkup(data.valorMaoObra)}</strong></td></tr>
      <tr><td>Lucro</td><td class="num">${data.pctLucro.toFixed(2)}%</td><td class="num"><strong>${formatarMoedaMarkup(data.valorLucro)}</strong></td></tr>
      <tr><td><strong>Total</strong></td><td class="num">100%</td><td class="num"><strong>${formatarMoedaMarkup(data.valorNegociado)}</strong></td></tr>
    </tbody>
  </table>

  <h2 style="margin-top:18px">Markups incluídos</h2>
  <ul>${markups}</ul>

  ${
    data.observacao?.trim()
      ? `<div class="obs"><strong>Observação</strong><br/>${esc(data.observacao.trim())}</div>`
      : ''
  }

  <p class="foot">Documento gerado pelo Negociador · ${esc(branding.empresaNome || '')}</p>
</body>
</html>`;
}

async function salvarPdfUmaFolha(doc: Document, filename: string): Promise<void> {
  const folha = doc.body;
  const canvas = await html2canvas(folha as HTMLElement, {
    scale: 2,
    useCORS: true,
    allowTaint: true,
    backgroundColor: '#fffcf8',
  });
  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageW = pdf.internal.pageSize.getWidth();
  const pageH = pdf.internal.pageSize.getHeight();
  const margin = 6;
  const maxW = pageW - margin * 2;
  const maxH = pageH - margin * 2;
  const imgW = maxW;
  const imgH = (canvas.height * imgW) / canvas.width;
  const scale = Math.min(1, maxH / imgH);
  const finalW = imgW * scale;
  const finalH = imgH * scale;
  const x = (pageW - finalW) / 2;
  pdf.addImage(canvas.toDataURL('image/jpeg', 0.92), 'JPEG', x, margin, finalW, finalH);
  pdf.save(filename);
}

export async function exportarNegociadorPdf(
  data: NegociadorPdfPayload,
  branding: NegociadorPdfBranding,
  filename?: string,
): Promise<void> {
  const html = buildNegociadorPdfHtml(data, branding);
  const iframe = document.createElement('iframe');
  iframe.style.cssText = 'position:fixed;left:-9999px;width:794px;height:1123px;border:none;';
  document.body.appendChild(iframe);

  const doc = iframe.contentDocument ?? iframe.contentWindow?.document;
  if (!doc) {
    document.body.removeChild(iframe);
    throw new Error('Não foi possível preparar o PDF');
  }

  doc.open();
  doc.write(html);
  doc.close();

  await new Promise<void>((resolve) => {
    const imgs = doc.querySelectorAll('img');
    if (imgs.length === 0) {
      resolve();
      return;
    }
    let loaded = 0;
    const check = () => {
      loaded += 1;
      if (loaded >= imgs.length) resolve();
    };
    imgs.forEach((img) => {
      if (img.complete) check();
      else {
        img.onload = check;
        img.onerror = check;
      }
    });
    setTimeout(resolve, 3000);
  });

  await new Promise((r) => setTimeout(r, 80));

  const nome =
    filename ??
    `negociacao-${(branding.clienteNome || 'cliente').replace(/\s+/g, '-').toLowerCase()}-${format(new Date(), 'yyyy-MM-dd')}.pdf`;

  try {
    await salvarPdfUmaFolha(doc, nome);
  } finally {
    document.body.removeChild(iframe);
  }
}
