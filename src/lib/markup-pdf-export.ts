import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import type { MarkupModulos, MarkupOrcamento } from './markup-types';
import { arredondar, formatarMoedaMarkup } from './markup-calculo';
import { resolverValorHoraLinhaServico } from './markup-servicos';

function esc(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export interface MarkupPdfBranding {
  empresaNome: string;
  empresaCnpj?: string | null;
  logoUrl?: string | null;
  timbradoUrl?: string | null;
  clienteNome?: string;
}

function truncar(texto: string, max: number): string {
  const t = texto.trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1).trimEnd()}…`;
}

function buildMarkupPdfHtml(
  orcamento: MarkupOrcamento,
  branding: MarkupPdfBranding,
): string {
  const { modulos, observacoes_rodape: obsRodape, titulo } = orcamento;
  const dataGeracao = format(new Date(), "dd/MM/yyyy HH:mm", { locale: ptBR });
  const logoSrc = branding.timbradoUrl || branding.logoUrl || '';
  const t = modulos.totais;

  const materiais = modulos.materiais.linhas.filter(
    (l) => l.quantidade > 0 && l.ativo !== false,
  );
  const servicos = (modulos.servicos.linhas ?? []).filter(
    (l) => l.ativo !== false && l.horas > 0,
  );
  const despesas = modulos.despesas.filter((d) => d.ativo !== false && d.valor > 0);

  const somaSobras = Math.max(0, t.custo_materiais_ajustado - t.custo_materiais);
  const somaImpostos = arredondar(
    t.subtotal_custo * (modulos.impostos.percentual_imposto / 100),
  );
  const somaTaxas = arredondar(
    t.subtotal_custo * (modulos.impostos.taxas_financeiras / 100),
  );
  const somaMargem = Math.max(0, t.preco_final_bruto - t.custo_com_impostos);
  const descontoPct = modulos.margem.desconto_final_percent ?? 0;
  const valorDesconto =
    descontoPct > 0 ? t.preco_final_bruto - t.preco_final : 0;

  const linhasMateriais = materiais
    .map(
      (l) => `
      <tr>
        <td class="item">${esc(l.descricao)}${l.variacao ? ` <span class="muted">· ${esc(l.variacao)}</span>` : ''}</td>
        <td class="num">${l.quantidade}</td>
        <td class="num">${formatarMoedaMarkup(l.valor_unitario)}</td>
        <td class="num strong">${formatarMoedaMarkup(l.valor_total)}</td>
      </tr>`,
    )
    .join('');

  const linhasServicos = servicos
    .map((linha) => {
      const valorHora = resolverValorHoraLinhaServico(linha, modulos.servicos.valor_hora);
      const custoLinha = arredondar(linha.horas * valorHora);
      return `
      <tr>
        <td class="item">${esc(linha.descricao)}</td>
        <td class="num">${linha.horas}h</td>
        <td class="num">${formatarMoedaMarkup(valorHora)}</td>
        <td class="num strong">${formatarMoedaMarkup(custoLinha)}</td>
      </tr>`;
    })
    .join('');

  const linhasDespesas = despesas
    .map(
      (d) => `
      <tr>
        <td class="item" colspan="3">${esc(d.descricao)}</td>
        <td class="num strong">${formatarMoedaMarkup(d.valor)}</td>
      </tr>`,
    )
    .join('');

  const textoResumo = orcamento.modulos.meta?.resumo_ia?.texto_resumo?.trim()
    ? truncar(orcamento.modulos.meta.resumo_ia.texto_resumo, 420)
    : '';

  const obs = obsRodape.trim() ? truncar(obsRodape.trim(), 280) : '';

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="utf-8"/>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  @page { size: A4 portrait; margin: 8mm; }
  body {
    font-family: "IBM Plex Sans", "Segoe UI", system-ui, sans-serif;
    font-size: 8pt;
    line-height: 1.25;
    color: #1c1917;
    background: #fff;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  .folha {
    width: 194mm;
    min-height: 277mm;
    max-height: 277mm;
    margin: 0 auto;
    padding: 6mm 7mm;
    display: flex;
    flex-direction: column;
    gap: 3.5mm;
    overflow: hidden;
  }
  .topo {
    display: grid;
    grid-template-columns: auto 1fr auto;
    gap: 4mm;
    align-items: center;
    padding-bottom: 3mm;
    border-bottom: 2.5px solid #292524;
  }
  .logo { max-height: 14mm; max-width: 32mm; object-fit: contain; }
  .marca { min-width: 0; }
  .empresa { font-size: 12pt; font-weight: 700; letter-spacing: -0.02em; color: #1c1917; }
  .cnpj { font-size: 7pt; color: #78716c; margin-top: 1px; }
  .selo {
    text-align: right;
    font-size: 7pt;
    color: #57534e;
    line-height: 1.35;
  }
  .selo strong { display: block; font-size: 9pt; color: #1c1917; font-weight: 700; }
  .titulo-bloco {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    gap: 4mm;
  }
  .titulo {
    font-size: 11pt;
    font-weight: 700;
    letter-spacing: -0.02em;
    color: #1c1917;
  }
  .meta { font-size: 7.5pt; color: #78716c; white-space: nowrap; }
  .grid-principal {
    display: grid;
    grid-template-columns: 1.35fr 1fr;
    gap: 4mm;
    flex: 1;
    min-height: 0;
  }
  .col { display: flex; flex-direction: column; gap: 2.5mm; min-width: 0; }
  .secao {
    border: 1px solid #e7e5e4;
    border-radius: 2px;
    overflow: hidden;
  }
  .secao-h {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 2mm;
    padding: 1.6mm 2.2mm;
    background: #f5f5f4;
    border-bottom: 1px solid #e7e5e4;
    font-size: 7.5pt;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: #44403c;
  }
  .secao-h .soma { font-variant-numeric: tabular-nums; color: #1c1917; letter-spacing: 0; text-transform: none; }
  table { width: 100%; border-collapse: collapse; }
  th, td {
    padding: 1.2mm 2mm;
    border-bottom: 1px solid #f5f5f4;
    vertical-align: top;
  }
  th {
    font-size: 6.5pt;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.03em;
    color: #78716c;
    background: #fafaf9;
  }
  td { font-size: 7.5pt; }
  td.item { width: 100%; word-break: break-word; }
  td.num, th.num {
    text-align: right;
    white-space: nowrap;
    font-variant-numeric: tabular-nums;
  }
  td.strong { font-weight: 700; color: #1c1917; }
  .muted { color: #a8a29e; font-size: 6.5pt; }
  .vazio {
    padding: 2.5mm;
    color: #a8a29e;
    font-size: 7pt;
    font-style: italic;
  }
  .params {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 1.2mm;
    padding: 2mm;
  }
  .param {
    display: flex;
    justify-content: space-between;
    gap: 2mm;
    padding: 1.4mm 1.8mm;
    background: #fafaf9;
    border: 1px solid #f5f5f4;
    border-radius: 2px;
  }
  .param span:first-child { color: #57534e; font-size: 6.8pt; }
  .param span:last-child {
    font-weight: 700;
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
    font-size: 7.2pt;
  }
  .param .pct { color: #a8a29e; font-weight: 500; margin-left: 1mm; }
  .fin-rows { width: 100%; }
  .fin-rows td {
    padding: 1.3mm 2.2mm;
    font-size: 7.5pt;
    border-bottom: 1px solid #f5f5f4;
  }
  .fin-rows tr.sub td { font-weight: 600; background: #fafaf9; }
  .fin-rows tr.final td {
    font-size: 10pt;
    font-weight: 800;
    background: #1c1917;
    color: #fafaf9;
    border-bottom: none;
    padding: 2.4mm 2.2mm;
  }
  .fin-rows tr.final td.num { color: #fafaf9; }
  .texto {
    padding: 2mm 2.2mm;
    font-size: 7pt;
    line-height: 1.35;
    color: #44403c;
    white-space: pre-wrap;
  }
  .rodape {
    margin-top: auto;
    padding-top: 2mm;
    border-top: 1px solid #d6d3d1;
    display: flex;
    justify-content: space-between;
    gap: 4mm;
    font-size: 6.5pt;
    color: #78716c;
  }
  .rodape strong { color: #44403c; }
</style>
</head>
<body>
<div class="folha" id="markup-pdf-folha">
  <header class="topo">
    ${logoSrc ? `<img class="logo" src="${esc(logoSrc)}" alt="Logo"/>` : '<div></div>'}
    <div class="marca">
      <div class="empresa">${esc(branding.empresaNome)}</div>
      ${branding.empresaCnpj ? `<div class="cnpj">CNPJ ${esc(branding.empresaCnpj)}</div>` : ''}
    </div>
    <div class="selo">
      <strong>Composição de custo</strong>
      Folha única A4 · ${esc(dataGeracao)}
    </div>
  </header>

  <div class="titulo-bloco">
    <div class="titulo">${esc(titulo)}</div>
    <div class="meta">${branding.clienteNome ? `Cliente: ${esc(branding.clienteNome)}` : 'Orçamento interno'}</div>
  </div>

  <div class="grid-principal">
    <div class="col">
      <section class="secao">
        <div class="secao-h">
          <span>Materiais — custo por item</span>
          <span class="soma">${formatarMoedaMarkup(t.custo_materiais)}</span>
        </div>
        ${
          materiais.length
            ? `<table>
          <thead>
            <tr>
              <th>Item</th>
              <th class="num">Qtd</th>
              <th class="num">Unit.</th>
              <th class="num">Custo</th>
            </tr>
          </thead>
          <tbody>${linhasMateriais}</tbody>
        </table>`
            : '<div class="vazio">Nenhum material informado.</div>'
        }
      </section>

      <section class="secao">
        <div class="secao-h">
          <span>Mão de obra — custo por item</span>
          <span class="soma">${formatarMoedaMarkup(t.custo_servicos)}</span>
        </div>
        ${
          servicos.length
            ? `<table>
          <thead>
            <tr>
              <th>Serviço</th>
              <th class="num">Horas</th>
              <th class="num">R$/h</th>
              <th class="num">Custo</th>
            </tr>
          </thead>
          <tbody>${linhasServicos}</tbody>
        </table>`
            : '<div class="vazio">Nenhuma mão de obra informada.</div>'
        }
      </section>

      ${
        despesas.length
          ? `<section class="secao">
        <div class="secao-h">
          <span>Despesas — custo por item</span>
          <span class="soma">${formatarMoedaMarkup(t.custo_despesas)}</span>
        </div>
        <table>
          <thead>
            <tr>
              <th colspan="3">Descrição</th>
              <th class="num">Custo</th>
            </tr>
          </thead>
          <tbody>${linhasDespesas}</tbody>
        </table>
      </section>`
          : ''
      }

      ${
        textoResumo
          ? `<section class="secao">
        <div class="secao-h"><span>Resumo do projeto</span></div>
        <div class="texto">${esc(textoResumo)}</div>
      </section>`
          : ''
      }
    </div>

    <div class="col">
      <section class="secao">
        <div class="secao-h"><span>Parâmetros e impacto em R$</span></div>
        <div class="params">
          <div class="param">
            <span>Valor hora<span class="pct">${formatarMoedaMarkup(modulos.servicos.valor_hora)}/h</span></span>
            <span>${formatarMoedaMarkup(t.custo_servicos)}</span>
          </div>
          <div class="param">
            <span>Sobras<span class="pct">${modulos.margem.fator_sobras}%</span></span>
            <span>${formatarMoedaMarkup(somaSobras)}</span>
          </div>
          <div class="param">
            <span>Impostos<span class="pct">${modulos.impostos.percentual_imposto}%</span></span>
            <span>${formatarMoedaMarkup(somaImpostos)}</span>
          </div>
          <div class="param">
            <span>Taxas<span class="pct">${modulos.impostos.taxas_financeiras}%</span></span>
            <span>${formatarMoedaMarkup(somaTaxas)}</span>
          </div>
          <div class="param">
            <span>Margem<span class="pct">${modulos.margem.margem_lucro}%</span></span>
            <span>${formatarMoedaMarkup(somaMargem)}</span>
          </div>
          <div class="param">
            <span>Frete</span>
            <span>${formatarMoedaMarkup(modulos.margem.custo_frete)}</span>
          </div>
        </div>
      </section>

      <section class="secao">
        <div class="secao-h"><span>Resumo financeiro</span></div>
        <table class="fin-rows">
          <tbody>
            <tr>
              <td>Materiais (itens)</td>
              <td class="num">${formatarMoedaMarkup(t.custo_materiais)}</td>
            </tr>
            <tr>
              <td>Materiais + sobras (${modulos.margem.fator_sobras}%)</td>
              <td class="num">${formatarMoedaMarkup(t.custo_materiais_ajustado)}</td>
            </tr>
            <tr>
              <td>Mão de obra (itens)</td>
              <td class="num">${formatarMoedaMarkup(t.custo_servicos)}</td>
            </tr>
            <tr>
              <td>Despesas (itens)</td>
              <td class="num">${formatarMoedaMarkup(t.custo_despesas)}</td>
            </tr>
            <tr>
              <td>Frete</td>
              <td class="num">${formatarMoedaMarkup(modulos.margem.custo_frete)}</td>
            </tr>
            <tr class="sub">
              <td>Subtotal de custo</td>
              <td class="num">${formatarMoedaMarkup(t.subtotal_custo)}</td>
            </tr>
            <tr>
              <td>Impostos (${modulos.impostos.percentual_imposto}%)</td>
              <td class="num">${formatarMoedaMarkup(somaImpostos)}</td>
            </tr>
            <tr>
              <td>Taxas financeiras (${modulos.impostos.taxas_financeiras}%)</td>
              <td class="num">${formatarMoedaMarkup(somaTaxas)}</td>
            </tr>
            <tr class="sub">
              <td>Custos totais (com impostos/taxas)</td>
              <td class="num">${formatarMoedaMarkup(t.custo_com_impostos)}</td>
            </tr>
            <tr>
              <td>Margem de lucro (${modulos.margem.margem_lucro}%) sobre custos totais</td>
              <td class="num">${formatarMoedaMarkup(somaMargem)}</td>
            </tr>
            <tr class="sub">
              <td>Preço antes do desconto</td>
              <td class="num">${formatarMoedaMarkup(t.preco_final_bruto)}</td>
            </tr>
            ${
              descontoPct > 0
                ? `<tr>
              <td>Desconto final (${descontoPct}%)</td>
              <td class="num">−${formatarMoedaMarkup(valorDesconto)}</td>
            </tr>`
                : ''
            }
            <tr class="final">
              <td>Preço final de venda</td>
              <td class="num">${formatarMoedaMarkup(t.preco_final)}</td>
            </tr>
          </tbody>
        </table>
      </section>

      ${
        obs
          ? `<section class="secao">
        <div class="secao-h"><span>Observações</span></div>
        <div class="texto">${esc(obs)}</div>
      </section>`
          : ''
      }
    </div>
  </div>

  <footer class="rodape">
    <div><strong>CRM Selletos</strong> · Markup interno — custo discriminado por item</div>
    <div>1 / 1 · A4</div>
  </footer>
</div>
</body>
</html>`;
}

/** Captura a folha e encaixa em exatamente 1 página A4. */
async function salvarPdfUmaFolha(doc: Document, filename: string): Promise<void> {
  const folha = doc.getElementById('markup-pdf-folha') ?? doc.body;
  const canvas = await html2canvas(folha as HTMLElement, {
    scale: 2.5,
    useCORS: true,
    logging: false,
    backgroundColor: '#ffffff',
    windowWidth: 794,
  });

  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageW = pdf.internal.pageSize.getWidth();
  const pageH = pdf.internal.pageSize.getHeight();
  const margin = 4;
  const maxW = pageW - margin * 2;
  const maxH = pageH - margin * 2;

  const imgW = maxW;
  const imgH = (canvas.height * imgW) / canvas.width;
  const scale = Math.min(1, maxH / imgH);
  const finalW = imgW * scale;
  const finalH = imgH * scale;
  const x = (pageW - finalW) / 2;
  const y = margin;

  pdf.addImage(canvas.toDataURL('image/jpeg', 0.92), 'JPEG', x, y, finalW, finalH);
  pdf.save(filename);
}

export async function exportarMarkupPdf(
  orcamento: MarkupOrcamento,
  branding: MarkupPdfBranding,
  filename?: string,
): Promise<void> {
  const html = buildMarkupPdfHtml(orcamento, branding);
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

  // Pequena pausa para layout/fonts
  await new Promise((r) => setTimeout(r, 80));

  const nomeArquivo =
    filename ??
    `markup-${orcamento.titulo.replace(/\s+/g, '-').toLowerCase()}-${format(new Date(), 'yyyy-MM-dd')}.pdf`;

  try {
    await salvarPdfUmaFolha(doc, nomeArquivo);
  } finally {
    document.body.removeChild(iframe);
  }
}

export function imprimirMarkupPdf(
  orcamento: MarkupOrcamento,
  branding: MarkupPdfBranding,
): void {
  const html = buildMarkupPdfHtml(orcamento, branding);
  const win = window.open('', '_blank');
  if (!win) {
    throw new Error('Permita pop-ups para imprimir o markup');
  }
  win.document.write(html);
  win.document.close();
  win.onload = () => win.print();
}
