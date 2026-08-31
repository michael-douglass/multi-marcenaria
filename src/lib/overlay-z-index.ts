/**
 * Escala de camadas da Agenda flutuante.
 * Precisa ficar acima de Dialog/Sheet comuns (z-50) e toasts (z-100),
 * para o painel e os popups internos permanecerem clicáveis no celular.
 */

/**
 * Confirmações abertas por cima de um Dialog (ex.: Duplicar/Excluir no card do lead).
 * Acima do Dialog padrão (z-50) e abaixo de toasts (z-100) / IA flutuante (z-70).
 */
export const Z_NESTED_MODAL = 60;

/**
 * Card “IA em segundo plano” (render/análise).
 * Acima do LeadModal (z-50) e abaixo de toasts (z-100) / Agenda (z-200),
 * para minimizar e acompanhar tarefas com o card do lead aberto.
 */
export const Z_FLOATING_AI_BACKGROUND = 70;

/** Painel lateral da Agenda Geral (MainLayout). */
export const Z_FLOATING_AGENDA_PANEL = 200;

/** Ícone flutuante do calendário. */
export const Z_FLOATING_AGENDA_ICON = 210;

/** Diálogos abertos a partir do painel flutuante. */
export const Z_FLOATING_AGENDA_DIALOG = 220;

/** Select, popover e dropdown dentro desses diálogos. */
export const Z_FLOATING_AGENDA_NESTED = 230;

/** Visualização em tela cheia do orçamento em slides (portal sobre o card). */
export const Z_ORCAMENTO_VISUALIZAR = 240;

/** Menu Exportar / painéis abertos por cima dessa visualização. */
export const Z_ORCAMENTO_VISUALIZAR_NESTED = 260;

/** Classes Tailwind correspondentes (evita números mágicos espalhados). */
export const nestedModalClass = '!z-[60]';
export const floatingAiBackgroundClass = 'z-[70]';
export const floatingAgendaPanelClass = 'z-[200]';
export const floatingAgendaIconClass = 'z-[210]';
export const floatingAgendaDialogClass = '!z-[220]';
export const floatingNestedOverlayClass = '!z-[230]';
export const orcamentoVisualizarOverlayClass = 'z-[240]';
export const orcamentoVisualizarNestedClass = '!z-[260]';

/** Seletor CSS / data-attr para ignorar o “fechar ao clicar fora” do LeadModal. */
export const FLOATING_AGENDA_ROOT_ATTR = 'data-floating-agenda-root';

/** UI flutuante (IA em segundo plano etc.) clicável com Dialog aberto. */
export const FLOATING_UI_ROOT_ATTR = 'data-floating-ui-root';
