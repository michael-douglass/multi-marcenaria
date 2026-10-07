/**
 * Exportação do catálogo de produtos do Markup (tabela de preços).
 * Texto (clipboard), planilha (CSV/XLS) e PDF — todos com preço unitário.
 */

import { format } from 'date-fns';
import { jsPDF } from 'jspdf';
import { formatarMoedaMarkup } from '@/lib/markup-calculo';
import type { MarkupProdutoComCategoria } from '@/hooks/useMarkupProdutos';

export interface MarkupCatalogoExportRow {
  ordem: number;
  categoria: string;
  subcategoria: string;
  nome: string;
  variacao: string;
  precoUnitario: number | null;
  unidade: string;
  ativo: boolean;
}

function rotuloCategoria(produto: MarkupProdutoComCategoria): string {
  return produto.categoria?.nome?.trim() || 'Sem categoria';
}

function rotuloSubcategoria(produto: MarkupProdutoComCategoria): string {
  return produto.categoria?.subcategoria?.trim() || '';
}

function compararCatalogo(
  a: MarkupProdutoComCategoria,
  b: MarkupProdutoComCategoria,
): number {
  const ordemDiff = (a.ordem ?? 0) - (b.ordem ?? 0);
  if (ordemDiff !== 0) return ordemDiff;
  const cat = rotuloCategoria(a).localeCompare(rotuloCategoria(b), 'pt-BR');
  if (cat !== 0) return cat;
  const sub = rotuloSubcategoria(a).localeCompare(rotuloSubcategoria(b), 'pt-BR');
  if (sub !== 0) return sub;
  const nome = a.nome.localeCompare(b.nome, 'pt-BR', { sensitivity: 'base' });
  if (nome !== 0) return nome;
  return (a.variacao ?? '').localeCompare(b.variacao ?? '', 'pt-BR', {
    sensitivity: 'base',
  });
}

export function buildMarkupCatalogoExportRows(
  produtos: MarkupProdutoComCategoria[],
): MarkupCatalogoExportRow[] {
  return [...produtos].sort(compararCatalogo).map((p, index) => ({
    ordem: index + 1,
    categoria: rotuloCategoria(p),
    subcategoria: rotuloSubcategoria(p),
    nome: p.nome.trim() || '—',
    variacao: p.variacao?.trim() || '',
    precoUnitario: p.preco_unitario != null ? Number(p.preco_unitario) : null,
    unidade: p.unidade?.trim() || 'un',
    ativo: p.ativo !== false,
  }));
}

function formatarPrecoCsv(valor: number | null): string {
  if (valor == null || !Number.isFinite(valor)) return '';
  return valor.toFixed(2).replace('.', ',');
}

function formatarPrecoPdf(valor: number | null): string {
  if (valor == null || !Number.isFinite(valor)) return 'Pendente';
  return formatarMoedaMarkup(valor);
}

function csvEscape(value: string | number): string {
  const text = String(value ?? '');
  if (/[;"\n\r]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function slugArquivo(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase()
    .slice(0, 40);
}

export function nomeArquivoCatalogoMarkup(
  empresaNome: string,
  ext: 'csv' | 'xls' | 'pdf',
  hoje = new Date(),
): string {
  const slug = slugArquivo(empresaNome) || 'markup';
  return `catalogo-precos-markup-${slug}-${format(hoje, 'yyyy-MM-dd')}.${ext}`;
}

function xmlEscape(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function xlsCellString(value: string): string {
  return `<Cell><Data ss:Type="String">${xmlEscape(value)}</Data></Cell>`;
}

function xlsCellNumber(value: number): string {
  return `<Cell><Data ss:Type="Number">${value}</Data></Cell>`;
}

function xlsRow(cells: string): string {
  return `<Row>${cells}</Row>`;
}

/** Planilha CSV (abre no Excel) com todos os itens e preços. */
export function downloadMarkupCatalogoCsv(
  produtos: MarkupProdutoComCategoria[],
  empresaNome: string,
): void {
  const rows = buildMarkupCatalogoExportRows(produtos);
  if (rows.length === 0) {
    throw new Error('Não há produtos no catálogo para exportar.');
  }

  const header = [
    'Ordem',
    'Categoria',
    'Subcategoria',
    'Produto',
    'Variação',
    'Preço unitário (R$)',
    'Unidade',
    'Ativo',
  ];

  const lines = [
    `Catálogo de preços — Markup — ${empresaNome.trim() || 'Empresa'}`,
    `Gerado em ${format(new Date(), 'dd/MM/yyyy HH:mm')}`,
    `Total de itens: ${rows.length}`,
    '',
    header.join(';'),
    ...rows.map((row) =>
      [
        csvEscape(row.ordem),
        csvEscape(row.categoria),
        csvEscape(row.subcategoria),
        csvEscape(row.nome),
        csvEscape(row.variacao),
        csvEscape(formatarPrecoCsv(row.precoUnitario)),
        csvEscape(row.unidade),
        csvEscape(row.ativo ? 'Sim' : 'Não'),
      ].join(';'),
    ),
  ];

  const blob = new Blob(['\uFEFF' + lines.join('\r\n')], {
    type: 'text/csv;charset=utf-8;',
  });
  downloadBlob(blob, nomeArquivoCatalogoMarkup(empresaNome, 'csv'));
}

/** Planilha Excel (.xls compatível) com preços. */
export function downloadMarkupCatalogoXls(
  produtos: MarkupProdutoComCategoria[],
  empresaNome: string,
): void {
  const rows = buildMarkupCatalogoExportRows(produtos);
  if (rows.length === 0) {
    throw new Error('Não há produtos no catálogo para exportar.');
  }

  const titulo = empresaNome.trim() || 'Empresa';
  const header = xlsRow(
    [
      xlsCellString('Ordem'),
      xlsCellString('Categoria'),
      xlsCellString('Subcategoria'),
      xlsCellString('Produto'),
      xlsCellString('Variação'),
      xlsCellString('Preço unitário (R$)'),
      xlsCellString('Unidade'),
      xlsCellString('Ativo'),
    ].join(''),
  );

  const body = rows
    .map((row) =>
      xlsRow(
        [
          xlsCellNumber(row.ordem),
          xlsCellString(row.categoria),
          xlsCellString(row.subcategoria),
          xlsCellString(row.nome),
          xlsCellString(row.variacao),
          row.precoUnitario != null
            ? xlsCellNumber(row.precoUnitario)
            : xlsCellString(''),
          xlsCellString(row.unidade),
          xlsCellString(row.ativo ? 'Sim' : 'Não'),
        ].join(''),
      ),
    )
    .join('');

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
  xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
  <Worksheet ss:Name="Catalogo precos">
    <Table>
      ${xlsRow(xlsCellString(`Catálogo de preços — Markup — ${titulo}`))}
      ${xlsRow(xlsCellString(`Gerado em ${format(new Date(), 'dd/MM/yyyy HH:mm')}`))}
      ${xlsRow(xlsCellString(`Total de itens: ${rows.length}`))}
      ${xlsRow(xlsCellString(''))}
      ${header}
      ${body}
    </Table>
  </Worksheet>
</Workbook>`;

  const blob = new Blob(['\uFEFF' + xml], {
    type: 'application/vnd.ms-excel;charset=utf-8;',
  });
  downloadBlob(blob, nomeArquivoCatalogoMarkup(empresaNome, 'xls'));
}

interface MarkupCatalogoGrupoPdf {
  categoria: string;
  itens: MarkupCatalogoExportRow[];
}

function agruparPorCategoria(rows: MarkupCatalogoExportRow[]): MarkupCatalogoGrupoPdf[] {
  const mapa = new Map<string, MarkupCatalogoExportRow[]>();
  for (const row of rows) {
    const chave = row.subcategoria
      ? `${row.categoria} (${row.subcategoria})`
      : row.categoria;
    const lista = mapa.get(chave) ?? [];
    lista.push(row);
    mapa.set(chave, lista);
  }
  return Array.from(mapa.entries()).map(([categoria, itens]) => ({
    categoria,
    itens,
  }));
}

function rotuloItemTexto(item: MarkupCatalogoExportRow): string {
  const base = item.variacao ? `${item.nome} · ${item.variacao}` : item.nome;
  return item.ativo ? base : `${base} (inativo)`;
}

/** Linha de catálogo com preço unitário bem explícito (WhatsApp / e-mail). */
function linhaItemCatalogoTexto(item: MarkupCatalogoExportRow): string {
  const preco = formatarPrecoPdf(item.precoUnitario);
  const unidade = item.unidade || 'un';
  return `• ${rotuloItemTexto(item)}\n  Preço: ${preco} / ${unidade}`;
}

async function escreverClipboardTexto(texto: string): Promise<void> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(texto);
      return;
    }
  } catch {
    // fallback abaixo (menu fecha e alguns browsers perdem a permissão de colar)
  }

  const ta = document.createElement('textarea');
  ta.value = texto;
  ta.setAttribute('readonly', '');
  ta.style.position = 'fixed';
  ta.style.left = '-9999px';
  ta.style.top = '0';
  document.body.appendChild(ta);
  ta.focus();
  ta.select();
  const ok = document.execCommand('copy');
  document.body.removeChild(ta);
  if (!ok) {
    throw new Error('Não foi possível copiar o texto automaticamente.');
  }
}

/** Texto simples para colar no WhatsApp / e-mail — sempre com preço unitário. */
export function formatarMarkupCatalogoTexto(input: {
  empresaNome: string;
  produtos: MarkupProdutoComCategoria[];
}): string {
  const rows = buildMarkupCatalogoExportRows(input.produtos);
  const linhas: string[] = [];
  linhas.push(`Catálogo de preços — Markup`);
  linhas.push(input.empresaNome.trim() || 'Empresa');
  linhas.push(`Gerado em ${format(new Date(), 'dd/MM/yyyy HH:mm')}`);
  linhas.push(`Total: ${rows.length} item${rows.length === 1 ? '' : 's'} (com preço unitário)`);
  linhas.push('');

  if (rows.length === 0) {
    linhas.push('Nenhum produto no catálogo.');
    return linhas.join('\n');
  }

  for (const grupo of agruparPorCategoria(rows)) {
    linhas.push(grupo.categoria.toUpperCase());
    for (const item of grupo.itens) {
      linhas.push(linhaItemCatalogoTexto(item));
    }
    linhas.push('');
  }

  return linhas.join('\n').trimEnd();
}

/** Copia o catálogo com preços para a área de transferência. */
export async function copiarMarkupCatalogoTexto(input: {
  empresaNome: string;
  produtos: MarkupProdutoComCategoria[];
}): Promise<string> {
  if (input.produtos.length === 0) {
    throw new Error('Não há produtos no catálogo para copiar.');
  }
  const texto = formatarMarkupCatalogoTexto(input);
  await escreverClipboardTexto(texto);
  return texto;
}

/** PDF A4 com tabela de preços do catálogo, agrupada por categoria. */
export async function exportarMarkupCatalogoPdf(
  produtos: MarkupProdutoComCategoria[],
  empresaNome: string,
  filename?: string,
): Promise<void> {
  const rows = buildMarkupCatalogoExportRows(produtos);
  if (rows.length === 0) {
    throw new Error('Não há produtos no catálogo para exportar.');
  }

  const grupos = agruparPorCategoria(rows);
  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageW = pdf.internal.pageSize.getWidth();
  const pageH = pdf.internal.pageSize.getHeight();
  const marginX = 12;
  const marginTop = 14;
  const marginBottom = 14;
  const contentW = pageW - marginX * 2;
  const colPreco = pageW - marginX;
  const colUn = pageW - marginX - 28;
  const colNomeW = contentW - 48;
  let y = marginTop;

  const garantirEspaco = (altura: number) => {
    if (y + altura <= pageH - marginBottom) return;
    pdf.addPage();
    y = marginTop;
  };

  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(14);
  pdf.text('Catálogo de preços — Markup', marginX, y);
  y += 6;

  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(9);
  pdf.setTextColor(70);
  pdf.text(empresaNome.trim() || 'Empresa', marginX, y);
  y += 4.5;
  pdf.text(
    `Gerado em ${format(new Date(), "dd/MM/yyyy 'às' HH:mm")} · ${rows.length} item${rows.length === 1 ? '' : 's'}`,
    marginX,
    y,
  );
  y += 7;
  pdf.setTextColor(0);

  for (const grupo of grupos) {
    garantirEspaco(12);
    pdf.setFillColor(235, 242, 255);
    pdf.rect(marginX, y - 3.5, contentW, 7.5, 'F');
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(9);
    pdf.text(grupo.categoria, marginX + 2, y + 1);
    y += 7;

    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(8);
    pdf.setTextColor(120);
    pdf.text('Produto', marginX + 1, y);
    pdf.text('Un.', colUn, y, { align: 'right' });
    pdf.text('Preço', colPreco, y, { align: 'right' });
    y += 3.5;
    pdf.setDrawColor(210);
    pdf.line(marginX, y, pageW - marginX, y);
    y += 3.5;
    pdf.setTextColor(0);

    for (const item of grupo.itens) {
      const nomeBase = item.variacao
        ? `${item.nome} · ${item.variacao}`
        : item.nome;
      const nomeComStatus = item.ativo ? nomeBase : `${nomeBase} (inativo)`;
      const nomeLinhas = pdf.splitTextToSize(nomeComStatus, colNomeW) as string[];
      const blocoH = Math.max(5.5, nomeLinhas.length * 3.8);
      garantirEspaco(blocoH + 1.5);

      if (!item.ativo) pdf.setTextColor(130);
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(8.5);
      pdf.text(nomeLinhas, marginX + 1, y);
      pdf.text(item.unidade, colUn, y, { align: 'right' });
      pdf.setFont('helvetica', 'bold');
      pdf.text(formatarPrecoPdf(item.precoUnitario), colPreco, y, { align: 'right' });
      pdf.setFont('helvetica', 'normal');
      pdf.setTextColor(0);
      y += blocoH;
    }
    y += 3;
  }

  garantirEspaco(8);
  pdf.setFont('helvetica', 'italic');
  pdf.setFontSize(7.5);
  pdf.setTextColor(110);
  pdf.text(
    'Preços unitários do catálogo interno de markup. Valores “Pendente” ainda não foram cadastrados.',
    marginX,
    y,
  );

  pdf.save(filename ?? nomeArquivoCatalogoMarkup(empresaNome, 'pdf'));
}
