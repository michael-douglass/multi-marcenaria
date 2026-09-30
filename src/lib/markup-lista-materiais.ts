/**
 * Extrai a lista de materiais do caderno de markup (MDF, ferragens, dobradiças…)
 * com quantidades consolidadas — para oficina / compra, sem preço de venda.
 */

import { format } from 'date-fns';
import { jsPDF } from 'jspdf';
import type { MarkupLinhaProduto, MarkupModulos, MarkupOrcamento } from '@/lib/markup-types';

export interface MarkupListaMaterialItem {
  categoria: string;
  descricao: string;
  variacao: string | null;
  unidade: string | null;
  quantidade: number;
  produto_id: string | null;
}

export interface MarkupListaMaterialGrupo {
  categoria: string;
  itens: MarkupListaMaterialItem[];
}

function chaveConsolidacao(linha: MarkupLinhaProduto, categoria: string): string {
  if (linha.produto_id) return `id:${linha.produto_id}`;
  return [
    'txt',
    categoria,
    linha.descricao.trim().toLowerCase(),
    (linha.variacao ?? '').trim().toLowerCase(),
    (linha.unidade ?? '').trim().toLowerCase(),
  ].join('|');
}

function categoriaDaLinha(linha: MarkupLinhaProduto): string {
  const cat = linha.categoria?.trim();
  return cat || 'Outros';
}

function rotuloItem(item: MarkupListaMaterialItem): string {
  const base = item.descricao.trim() || 'Item';
  return item.variacao?.trim() ? `${base} · ${item.variacao.trim()}` : base;
}

function formatarQuantidade(qtd: number): string {
  if (!Number.isFinite(qtd)) return '0';
  return qtd.toLocaleString('pt-BR', {
    maximumFractionDigits: 3,
    minimumFractionDigits: 0,
  });
}

/** Consolida linhas ativas com quantidade > 0, agrupadas por categoria. */
export function extrairListaMateriais(modulos: MarkupModulos): MarkupListaMaterialGrupo[] {
  const mapa = new Map<string, MarkupListaMaterialItem>();

  for (const linha of modulos.materiais?.linhas ?? []) {
    if (linha.ativo === false) continue;
    const quantidade = Number(linha.quantidade) || 0;
    if (quantidade <= 0) continue;

    const categoria = categoriaDaLinha(linha);
    const chave = chaveConsolidacao(linha, categoria);
    const existente = mapa.get(chave);
    if (existente) {
      existente.quantidade += quantidade;
      continue;
    }
    mapa.set(chave, {
      categoria,
      descricao: linha.descricao.trim() || 'Item',
      variacao: linha.variacao?.trim() || null,
      unidade: linha.unidade?.trim() || null,
      quantidade,
      produto_id: linha.produto_id,
    });
  }

  const porCategoria = new Map<string, MarkupListaMaterialItem[]>();
  for (const item of mapa.values()) {
    const lista = porCategoria.get(item.categoria) ?? [];
    lista.push(item);
    porCategoria.set(item.categoria, lista);
  }

  return Array.from(porCategoria.entries())
    .map(([categoria, itens]) => ({
      categoria,
      itens: itens.sort((a, b) =>
        rotuloItem(a).localeCompare(rotuloItem(b), 'pt-BR', { sensitivity: 'base' }),
      ),
    }))
    .sort((a, b) => a.categoria.localeCompare(b.categoria, 'pt-BR', { sensitivity: 'base' }));
}

export function contarItensListaMateriais(grupos: MarkupListaMaterialGrupo[]): number {
  return grupos.reduce((acc, grupo) => acc + grupo.itens.length, 0);
}

/** Texto simples para colar no WhatsApp / e-mail. */
export function formatarListaMateriaisTexto(input: {
  titulo: string;
  clienteNome?: string | null;
  grupos: MarkupListaMaterialGrupo[];
}): string {
  const linhas: string[] = [];
  linhas.push(`Lista de materiais — ${input.titulo.trim() || 'Markup'}`);
  if (input.clienteNome?.trim()) {
    linhas.push(`Cliente: ${input.clienteNome.trim()}`);
  }
  linhas.push(`Gerado em ${format(new Date(), 'dd/MM/yyyy HH:mm')}`);
  linhas.push('');

  if (input.grupos.length === 0) {
    linhas.push('Nenhum material com quantidade neste markup.');
    return linhas.join('\n');
  }

  for (const grupo of input.grupos) {
    linhas.push(grupo.categoria.toUpperCase());
    for (const item of grupo.itens) {
      const unidade = item.unidade ? ` ${item.unidade}` : '';
      linhas.push(`• ${rotuloItem(item)} — ${formatarQuantidade(item.quantidade)}${unidade}`);
    }
    linhas.push('');
  }

  return linhas.join('\n').trimEnd();
}

export function nomeArquivoListaMateriais(titulo: string, hoje = new Date()): string {
  const slug = titulo
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase()
    .slice(0, 48);
  return `lista-materiais-${slug || 'markup'}-${format(hoje, 'yyyy-MM-dd')}.pdf`;
}

export interface MarkupListaMateriaisBranding {
  empresaNome: string;
  clienteNome?: string | null;
}

/** PDF interno só com materiais e quantidades (pode ter várias páginas). */
export async function exportarListaMateriaisPdf(
  orcamento: Pick<MarkupOrcamento, 'titulo' | 'modulos'>,
  branding: MarkupListaMateriaisBranding,
  filename?: string,
): Promise<void> {
  const grupos = extrairListaMateriais(orcamento.modulos);
  if (contarItensListaMateriais(grupos) === 0) {
    throw new Error('Não há materiais com quantidade neste markup.');
  }

  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageW = pdf.internal.pageSize.getWidth();
  const pageH = pdf.internal.pageSize.getHeight();
  const marginX = 14;
  const marginTop = 16;
  const marginBottom = 16;
  const contentW = pageW - marginX * 2;
  let y = marginTop;

  const garantirEspaco = (altura: number) => {
    if (y + altura <= pageH - marginBottom) return;
    pdf.addPage();
    y = marginTop;
  };

  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(14);
  pdf.text('Lista de materiais', marginX, y);
  y += 7;

  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(10);
  pdf.setTextColor(60);
  pdf.text(branding.empresaNome.trim() || 'Empresa', marginX, y);
  y += 5;
  pdf.text(`Proposta: ${orcamento.titulo.trim() || 'Markup'}`, marginX, y);
  y += 5;
  if (branding.clienteNome?.trim()) {
    pdf.text(`Cliente: ${branding.clienteNome.trim()}`, marginX, y);
    y += 5;
  }
  pdf.text(`Gerado em ${format(new Date(), "dd/MM/yyyy 'às' HH:mm")}`, marginX, y);
  y += 8;
  pdf.setTextColor(0);

  for (const grupo of grupos) {
    garantirEspaco(12);
    pdf.setFillColor(245, 240, 232);
    pdf.rect(marginX, y - 4, contentW, 8, 'F');
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(10);
    pdf.text(grupo.categoria, marginX + 2, y + 1);
    y += 8;

    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(9);
    for (const item of grupo.itens) {
      const qtd = formatarQuantidade(item.quantidade);
      const unidade = item.unidade ? ` ${item.unidade}` : '';
      const qtdLabel = `${qtd}${unidade}`;
      const nomeLinhas = pdf.splitTextToSize(rotuloItem(item), contentW - 42) as string[];
      const blocoH = Math.max(6, nomeLinhas.length * 4.2);
      garantirEspaco(blocoH + 2);

      pdf.text(nomeLinhas, marginX + 1, y);
      pdf.setFont('helvetica', 'bold');
      pdf.text(qtdLabel, pageW - marginX, y, { align: 'right' });
      pdf.setFont('helvetica', 'normal');
      y += blocoH;
    }
    y += 3;
  }

  const totalItens = contarItensListaMateriais(grupos);
  garantirEspaco(10);
  pdf.setFont('helvetica', 'italic');
  pdf.setFontSize(8);
  pdf.setTextColor(100);
  pdf.text(
    `${totalItens} item${totalItens === 1 ? '' : 's'} · quantidades consolidadas do caderno de markup`,
    marginX,
    y,
  );

  pdf.save(filename ?? nomeArquivoListaMateriais(orcamento.titulo));
}

export async function copiarListaMateriaisTexto(input: {
  titulo: string;
  clienteNome?: string | null;
  modulos: MarkupModulos;
}): Promise<string> {
  const grupos = extrairListaMateriais(input.modulos);
  const texto = formatarListaMateriaisTexto({
    titulo: input.titulo,
    clienteNome: input.clienteNome,
    grupos,
  });
  if (contarItensListaMateriais(grupos) === 0) {
    throw new Error('Não há materiais com quantidade neste markup.');
  }
  await navigator.clipboard.writeText(texto);
  return texto;
}
