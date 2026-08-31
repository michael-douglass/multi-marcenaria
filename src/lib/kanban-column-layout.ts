/** Largura das colunas do Kanban — suficiente para nome, data e botões do card. */
export const KANBAN_COLUMN_WIDTH_CLASS =
  'w-[min(100%,248px)] min-w-[228px] max-w-[248px] sm:w-[280px] sm:min-w-[280px] sm:max-w-[280px]';

export const KANBAN_COLUMN_SHELL_CLASS = [
  'relative flex flex-none flex-col h-auto min-h-[min(72vh,calc(100svh-11rem))] overflow-visible',
  KANBAN_COLUMN_WIDTH_CLASS,
  'bg-[rgba(12,6,3,0.88)] rounded-2xl border',
  'transition-[border-color,box-shadow,transform] duration-300',
].join(' ');
