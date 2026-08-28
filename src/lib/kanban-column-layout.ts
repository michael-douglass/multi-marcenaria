/** Largura padrão das colunas do Kanban (Pipeline e páginas configuráveis). */
export const KANBAN_COLUMN_WIDTH_CLASS =
  'w-[min(100%,200px)] min-w-[168px] max-w-[200px] sm:w-[216px] sm:min-w-[216px] sm:max-w-[216px]';

export const KANBAN_COLUMN_SHELL_CLASS = [
  'flex flex-none flex-col h-full min-h-[12rem]',
  KANBAN_COLUMN_WIDTH_CLASS,
  'bg-card rounded-xl border border-border/80 shadow-sm',
  'transition-[border-color,box-shadow,transform] duration-200',
].join(' ');
