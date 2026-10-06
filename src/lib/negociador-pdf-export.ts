import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import { formatarMoedaMarkup } from '@/lib/markup-calculo';

export interface NegociadorPdfBranding {
  empresaNome: string;
  empresaRazaoSocial?: string | null;
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
  const razaoSocial =
    branding.empresaRazaoSocial?.trim() || branding.empresaNome?.trim() || 'Empresa';
  const cnpj = branding.empresaCnpj?.trim() || '';
  const desconto = Math.max(0, (Number(data.precoOriginal) || 0) - (Number(data.valorNegociado) || 0));
  const temDesconto = desconto > 0.009;
  const pctDesconto =
    temDesconto && data.precoOriginal > 0
      ? ((desconto / data.precoOriginal) * 100).toLocaleString('pt-BR', {
          maximumFractionDigits: 1,
        })
      : null;
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
    font-family: Georgia, "Times New Roman", "Segoe UI", serif;
    color: #2a1812;
    background: #fffcf8;
    padding: 28px 32px;
    width: 794px;
  }
  .header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 16px;
    border-bottom: 2px solid #c4963a;
    padding-bottom: 16px;
    margin-bottom: 20px;
  }
  .brand { display: flex; align-items: center; gap: 14px; min-width: 0; }
  .logo { max-height: 64px; max-width: 160px; object-fit: contain; }
  .empresa-legal .nome {
    font-size: 20px;
    color: #8d5e22;
    font-weight: 700;
    letter-spacing: 0.02em;
  }
  .empresa-legal .lbl {
    display: block;
    margin-top: 8px;
    font-size: 9px;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: #c4963a;
    font-family: "Segoe UI", system-ui, sans-serif;
  }
  .empresa-legal .val {
    font-size: 12px;
    color: #6b5344;
    font-family: "Segoe UI", system-ui, sans-serif;
    line-height: 1.35;
  }
  .meta-direita { text-align: right; font-family: "Segoe UI", system-ui, sans-serif; }
  .meta-direita .titulo {
    font-family: Georgia, serif;
    font-size: 22px;
    font-style: italic;
    color: #c4963a;
  }
  .meta-direita p { font-size: 11px; color: #6b5344; margin-top: 6px; }
  h2 {
    font-size: 14px;
    color: #8d5e22;
    margin-bottom: 6px;
    font-family: "Segoe UI", system-ui, sans-serif;
    letter-spacing: 0.04em;
  }
  .meta {
    font-size: 12px;
    color: #6b5344;
    margin-bottom: 16px;
    line-height: 1.45;
    font-family: "Segoe UI", system-ui, sans-serif;
  }
  .totais {
    display: grid;
    grid-template-columns: 1fr;
    gap: 10px;
    margin-bottom: 18px;
  }
  .linha-sub {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    padding: 10px 14px;
    border: 1px solid #e5d4b8;
    background: #fffaf3;
    border-radius: 8px;
    font-family: "Segoe UI", system-ui, sans-serif;
  }
  .linha-sub .lbl {
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: #6b5344;
  }
  .linha-sub .val { font-size: 16px; font-weight: 700; color: #2a1812; }
  .desconto {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 12px;
    padding: 14px 16px;
    border: 2px solid #c45c3a;
    background: linear-gradient(135deg, #fff4ee 0%, #ffe8dc 100%);
    border-radius: 10px;
    font-family: "Segoe UI", system-ui, sans-serif;
  }
  .desconto .lbl {
    font-size: 12px;
    text-transform: uppercase;
    letter-spacing: 0.12em;
    color: #a33d1f;
    font-weight: 700;
  }
  .desconto .val {
    font-size: 26px;
    font-weight: 800;
    color: #a33d1f;
    font-variant-numeric: tabular-nums;
  }
  .desconto .pct {
    display: inline-block;
    margin-left: 8px;
    font-size: 13px;
    font-weight: 700;
    color: #fff;
    background: #c45c3a;
    border-radius: 999px;
    padding: 2px 10px;
    vertical-align: middle;
  }
  .preco-final {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 12px;
    padding: 18px 20px;
    border: 2px solid #c4963a;
    background: linear-gradient(145deg, #2a1812 0%, #3d2418 55%, #5a3a1f 100%);
    border-radius: 12px;
    box-shadow: 0 8px 24px rgba(42, 24, 18, 0.18);
  }
  .preco-final .lbl {
    font-size: 12px;
    text-transform: uppercase;
    letter-spacing: 0.18em;
    color: #f2d892;
    font-family: "Segoe UI", system-ui, sans-serif;
    font-weight: 700;
  }
  .preco-final .val {
    font-size: 36px;
    font-weight: 700;
    color: #f7efe4;
    letter-spacing: 0.01em;
    font-variant-numeric: tabular-nums;
    line-height: 1;
  }
  .obs {
    margin-top: 16px;
    padding: 12px;
    border: 1px solid #e5d4b8;
    border-radius: 8px;
    background: #fff;
    font-size: 12px;
    color: #2a1812;
    white-space: pre-wrap;
    font-family: "Segoe UI", system-ui, sans-serif;
  }
  ul {
    margin: 6px 0 0 18px;
    font-size: 12px;
    color: #2a1812;
    font-family: "Segoe UI", system-ui, sans-serif;
  }
  .foot {
    margin-top: 24px;
    font-size: 10px;
    color: #6b5344;
    text-align: center;
    font-family: "Segoe UI", system-ui, sans-serif;
  }
  .foot .legal { margin-top: 4px; }
</style>
</head>
<body>
  <div class="header">
    <div class="brand">
      ${logoSrc ? `<img class="logo" src="${esc(logoSrc)}" alt="Logo" />` : ''}
      <div class="empresa-legal">
        <div class="nome">${esc(branding.empresaNome || 'Garbo Movelaria')}</div>
        <span class="lbl">Razão Social</span>
        <div class="val">${esc(razaoSocial)}</div>
        ${
          cnpj
            ? `<span class="lbl">CNPJ</span><div class="val">${esc(cnpj)}</div>`
            : ''
        }
      </div>
    </div>
    <div class="meta-direita">
      <div class="titulo">Orçamento</div>
      <p>Proposta de negociação</p>
      <p>${esc(dataGeracao)}</p>
    </div>
  </div>

  <h2>Negociação comercial</h2>
  <p class="meta">
    ${branding.clienteNome ? `Cliente: <strong>${esc(branding.clienteNome)}</strong><br/>` : ''}
    Documento com o valor fechado com o cliente.
  </p>

  <div class="totais">
    <div class="linha-sub">
      <span class="lbl">Preço original</span>
      <span class="val">${formatarMoedaMarkup(data.precoOriginal)}</span>
    </div>
    ${
      temDesconto
        ? `<div class="desconto">
            <span class="lbl">Desconto${pctDesconto ? ` <span class="pct">−${esc(pctDesconto)}%</span>` : ''}</span>
            <span class="val">−${formatarMoedaMarkup(desconto)}</span>
          </div>`
        : ''
    }
    <div class="preco-final">
      <span class="lbl">Preço final</span>
      <span class="val">${formatarMoedaMarkup(data.valorNegociado)}</span>
    </div>
  </div>

  <h2 style="margin-top:18px">Markups incluídos</h2>
  <ul>${markups}</ul>

  ${
    data.observacao?.trim()
      ? `<div class="obs"><strong>Observação</strong><br/>${esc(data.observacao.trim())}</div>`
      : ''
  }

  <p class="foot">
    Documento gerado pelo Negociador · ${esc(branding.empresaNome || '')}
    <span class="legal"><br/>Razão Social: ${esc(razaoSocial)}${cnpj ? ` · CNPJ: ${esc(cnpj)}` : ''}</span>
  </p>
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
