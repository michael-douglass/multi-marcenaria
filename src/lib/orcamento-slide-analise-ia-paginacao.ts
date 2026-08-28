import { parseBlocks, type MarkdownContentBlock } from '@/lib/lead-ai-formatted-content';
import { normalizarRelatorioAnaliseIa } from '@/lib/lead-ai-relatorio-markdown';

function estimateBlockWeight(block: MarkdownContentBlock): number {
  switch (block.type) {
    case 'h1':
      return 4.5;
    case 'h2':
      return 4;
    case 'h3':
      return 3.2;
    case 'h4':
      return 2.6;
    case 'hr':
      return 1.2;
    case 'ul':
    case 'ol':
      return 2 + (block.items?.length ?? 0) * 1.15;
    case 'p': {
      const len = block.text?.length ?? 0;
      return 1 + len / 180;
    }
    default:
      return 1;
  }
}

function isSectionStart(block: MarkdownContentBlock): boolean {
  return block.type === 'h1' || block.type === 'h2' || block.type === 'h3';
}

/**
 * Divide o relatório em “páginas” de slide — cada uma vira uma dobra no PDF.
 * Respeita listas e prefere quebrar antes de novas seções.
 */
export function paginarBlocosAnaliseIa(
  raw: string,
  mobile: boolean,
): MarkdownContentBlock[][] {
  const blocks = parseBlocks(normalizarRelatorioAnaliseIa(raw));
  if (blocks.length === 0) return [[]];

  const maxWeight = mobile ? 24 : 48;
  const firstPageOverhead = mobile ? 10 : 14;

  const pages: MarkdownContentBlock[][] = [];
  let current: MarkdownContentBlock[] = [];
  let weight = 0;

  const limitFor = (isFirstPage: boolean) => maxWeight - (isFirstPage ? firstPageOverhead : 3);

  const flush = () => {
    if (current.length === 0) return;
    pages.push(current);
    current = [];
    weight = 0;
  };

  for (const block of blocks) {
    const blockWeight = estimateBlockWeight(block);
    const isFirstPage = pages.length === 0 && current.length === 0;
    const limit = limitFor(isFirstPage);
    const wouldOverflow = weight + blockWeight > limit;
    const shouldBreakBeforeSection =
      current.length > 0
      && isSectionStart(block)
      && weight > limit * 0.45;

    if (wouldOverflow || shouldBreakBeforeSection) {
      flush();
    }

    current.push(block);
    weight += blockWeight;
  }

  flush();
  return pages.length > 0 ? pages : [[]];
}

export function paginarConteudoAnaliseIa(raw: string, mobile: boolean): MarkdownContentBlock[][] {
  return paginarBlocosAnaliseIa(raw, mobile);
}
