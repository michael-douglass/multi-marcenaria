/**
 * Posicionamento dos ícones/popups flutuantes abaixo do NavigationHeader (h-14).
 * Evita sobrepor os switches "Recolher popups" / "Desativar notificações".
 */

/** h-14 (3.5rem) + 0.5rem de respiro */
export const FLOATING_ICONS_TOP = 'top-[4rem]';

/**
 * Topo absoluto da viewport (Saldo do mês + Agenda Geral).
 * Ficam sempre na faixa mais alta da tela, com respiro da safe-area.
 */
export const FLOATING_TOP_EDGE =
  'top-[max(0.75rem,env(safe-area-inset-top))] sm:top-4';

/** Ícone da Agenda no canto superior direito. */
export const FLOATING_AGENDA_ICON_RIGHT =
  'right-[max(0.75rem,env(safe-area-inset-right))] sm:right-4';

/**
 * Saldo do mês: à esquerda do ícone da agenda (h-14 + gap),
 * para os dois caberem no topo sem um cobrir o outro.
 */
export const FLOATING_SALDO_RIGHT =
  'right-[calc(max(0.75rem,env(safe-area-inset-right))+4rem)] sm:right-[calc(1rem+4rem)]';

/** Faixa de ícones (~3rem) abaixo do header */
export const FLOATING_POPUP_TOP = 'top-[7.25rem]';

export const FLOATING_HORIZONTAL = 'right-4';

export const floatingIconsPositionClass = `fixed ${FLOATING_ICONS_TOP} ${FLOATING_HORIZONTAL} z-[70]`;

export const floatingPopupPositionClass = `fixed ${FLOATING_POPUP_TOP} ${FLOATING_HORIZONTAL} z-[55]`;

/** Popups que abrem à esquerda da coluna de ícones (ex.: presença) */
export const floatingPopupBesideIconsClass = `fixed ${FLOATING_ICONS_TOP} right-36 z-[70]`;

/** Altura máxima útil para painéis flutuantes */
export const floatingPopupMaxHeightStyle = {
  maxHeight: 'min(800px, calc(100vh - 8.5rem))', // Aumentado para 800px
} as const;

/** Popups de lembrete no horário — logo abaixo da faixa de ícones flutuantes (direita) */
export const floatingReminderToastPositionClass =
  `fixed ${FLOATING_POPUP_TOP} ${FLOATING_HORIZONTAL} z-[60]`;

/** Altura máxima do painel de lembretes quando ancorado abaixo dos ícones */
export const floatingReminderPanelMaxHeightClass =
  'max-h-[min(calc(100vh-8.5rem),520px)]';
