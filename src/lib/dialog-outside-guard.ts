import { MARKUP_CALCULATOR_OPEN_ATTR, MARKUP_ORCAMENTO_SIMPLES_OPEN_ATTR } from '@/lib/markup-ui';

/** Evita que Dialog Radix feche ao abrir o seletor de arquivos do sistema. */

export const ENVIAR_PROJETO_DIALOG_OPEN_ATTR = 'data-enviar-projeto-dialog-open';

/** Painel da agenda flutuante (não o ícone). */
export const FLOATING_AGENDA_PANEL_ATTR = 'data-floating-agenda-panel';

export const AMBIENTE_FULLSCREEN_ATTR = 'data-ambiente-fullscreen';

/** Lousa digital em tela cheia, por cima do card do lead. */
export const WHITEBOARD_FULLSCREEN_ATTR = 'data-whiteboard-fullscreen-open';

/** Seletor de imagens do projeto (lousa / compositor de ambiente). */
export const PROJECT_IMAGE_PICKER_OPEN_ATTR = 'data-project-image-picker-open';

/** Seletor nativo de arquivos aberto (input type=file). */
export const FILE_PICKER_OPEN_ATTR = 'data-file-picker-open';

/** Visualização do orçamento em slides, aberta por cima do card do lead. */
export const ORCAMENTO_VISUALIZAR_OPEN_ATTR = 'data-orcamento-visualizar-open';

const orcamentoVisualizarListeners = new Set<() => void>();
const leadModalPassthroughListeners = new Set<() => void>();

function notifyLeadModalPassthrough() {
  leadModalPassthroughListeners.forEach((listener) => listener());
}

export function setOrcamentoVisualizarOpenFlag(open: boolean) {
  if (typeof document === 'undefined') return;
  if (open) {
    document.documentElement.setAttribute(ORCAMENTO_VISUALIZAR_OPEN_ATTR, 'true');
  } else {
    document.documentElement.removeAttribute(ORCAMENTO_VISUALIZAR_OPEN_ATTR);
  }
  orcamentoVisualizarListeners.forEach((listener) => listener());
  notifyLeadModalPassthrough();
}

/** Tela cheia do compositor de ambiente — o card do lead não pode “comer” os cliques. */
export function setAmbienteFullscreenOpenFlag(open: boolean) {
  if (typeof document === 'undefined') return;
  if (open) {
    document.documentElement.setAttribute(AMBIENTE_FULLSCREEN_ATTR, 'true');
  } else {
    document.documentElement.removeAttribute(AMBIENTE_FULLSCREEN_ATTR);
  }
  notifyLeadModalPassthrough();
}

/** Tela cheia da lousa — mesmo caso da composição de ambiente. */
export function setWhiteboardFullscreenOpenFlag(open: boolean) {
  if (typeof document === 'undefined') return;
  if (open) {
    document.documentElement.setAttribute(WHITEBOARD_FULLSCREEN_ATTR, 'true');
  } else {
    document.documentElement.removeAttribute(WHITEBOARD_FULLSCREEN_ATTR);
  }
  notifyLeadModalPassthrough();
}

export function isOrcamentoVisualizarOpen(): boolean {
  if (typeof document === 'undefined') return false;
  return document.documentElement.hasAttribute(ORCAMENTO_VISUALIZAR_OPEN_ATTR);
}

export function subscribeOrcamentoVisualizarOpen(onStoreChange: () => void): () => void {
  orcamentoVisualizarListeners.add(onStoreChange);
  return () => {
    orcamentoVisualizarListeners.delete(onStoreChange);
  };
}

/** Orçamento em slides, lousa ou composição em tela cheia — o card passa a ser não-modal. */
export function isLeadModalPassthroughOpen(): boolean {
  if (typeof document === 'undefined') return false;
  const root = document.documentElement;
  return (
    root.hasAttribute(ORCAMENTO_VISUALIZAR_OPEN_ATTR) ||
    root.hasAttribute(AMBIENTE_FULLSCREEN_ATTR) ||
    root.hasAttribute(WHITEBOARD_FULLSCREEN_ATTR)
  );
}

export function subscribeLeadModalPassthrough(onStoreChange: () => void): () => void {
  leadModalPassthroughListeners.add(onStoreChange);
  return () => {
    leadModalPassthroughListeners.delete(onStoreChange);
  };
}

/**
 * Clique/foco numa janela por cima do card (tela cheia, confirmação).
 * Não use preventDefault nesses eventos: o Radix cancela o clique original
 * e a lousa / o texto ficam inacessíveis.
 */
export function isLeadNestedLayerEvent(e: { target: EventTarget | null }): boolean {
  const target = e.target as HTMLElement | null;
  if (!target?.closest) return false;
  return Boolean(
    target.closest('[data-ambiente-composer-fullscreen]') ||
      target.closest('[data-whiteboard-fullscreen]') ||
      target.closest('[data-lead-ai-image-fullscreen]') ||
      target.closest('[data-lead-ai-render-fullscreen]') ||
      target.closest('[data-whiteboard-project-picker]') ||
      target.closest('[data-ambiente-photo-studio]') ||
      target.closest('[data-lead-folder-picker]') ||
      target.closest('[data-enviar-projeto-dialog]') ||
      target.closest('[data-markup-orcamento-simples]') ||
      target.closest('[data-lead-lembrete-dialog]') ||
      target.closest('[data-agenda-create-dialog]') ||
      target.closest('[data-floating-agenda-panel]') ||
      target.closest('[data-radix-dialog-content][data-floating-agenda-root]') ||
      target.closest('[data-saldo-mes-insight]') ||
      target.closest('[data-floating-ui-root]') ||
      target.closest('[data-nested-dialog]'),
  );
}

/**
 * Popovers/selects abrem em portal fora do Dialog.
 * Em onFocusOutside, NÃO use preventDefault nesses alvos — senão o campo de
 * busca (ex.: “Coluna no funil”) não aceita digitação nem setas.
 * O dismiss do card continua bloqueado via onPointerDownOutside / onInteractOutside.
 */
export function shouldAllowDialogFocusOutside(e: { target: EventTarget | null }): boolean {
  const target = e.target as HTMLElement | null;
  if (!target?.closest) return false;
  if (isLeadNestedLayerEvent(e)) return true;
  return Boolean(
    target.closest('[data-radix-popover-content]') ||
      target.closest('[data-radix-select-content]') ||
      target.closest('[data-radix-dropdown-menu-content]') ||
      target.closest('[data-radix-popper-content-wrapper]') ||
      target.closest('[data-radix-menu-content]') ||
      target.closest('[cmdk-root]') ||
      target.closest('[data-lead-funnel-column-picker]') ||
      target.closest('[data-agenda-titular-picker]') ||
      target.closest('[data-lead-name-autocomplete]') ||
      target.closest('[data-lead-origem-picker]') ||
      target.closest('[data-date-picker-root]'),
  );
}

/** Mantém a tela cheia aberta sem cancelar cliques de janelas por cima (fotos do projeto, pastas). */
export function preventFullscreenOutsideDismiss(event: {
  preventDefault: () => void;
  target: EventTarget | null;
}) {
  if (isLeadNestedLayerEvent(event)) return;
  event.preventDefault();
}

/** O card não deve fechar enquanto há uma camada por cima. */
export function isLeadDismissBlocked(options?: { filePickerActive?: boolean }): boolean {
  if (shouldBlockLeadModalBackdropClose(options)) return true;
  if (typeof document === 'undefined') return false;
  return Boolean(
    document.querySelector('[data-nested-dialog][data-state="open"]') ||
      document.querySelector('[data-markup-orcamento-simples][data-state="open"]') ||
      document.querySelector('[data-lead-lembrete-dialog][data-state="open"]') ||
      document.querySelector('[data-agenda-create-dialog][data-state="open"]') ||
      document.querySelector('[data-floating-agenda-root][data-state="open"]') ||
      document.querySelector('[data-floating-agenda-panel]') ||
      document.querySelector('[data-ambiente-composer-fullscreen]') ||
      document.querySelector('[data-whiteboard-fullscreen]') ||
      document.querySelector('[data-lead-ai-image-fullscreen]') ||
      document.querySelector('[data-lead-ai-render-fullscreen]') ||
      document.querySelector('[role="alertdialog"]'),
  );
}

export function setEnviarProjetoDialogOpenFlag(open: boolean) {
  if (typeof document === 'undefined') return;
  if (open) {
    document.documentElement.setAttribute(ENVIAR_PROJETO_DIALOG_OPEN_ATTR, 'true');
  } else {
    document.documentElement.removeAttribute(ENVIAR_PROJETO_DIALOG_OPEN_ATTR);
  }
}

export function setProjectImagePickerOpenFlag(open: boolean) {
  if (typeof document === 'undefined') return;
  if (open) {
    document.documentElement.setAttribute(PROJECT_IMAGE_PICKER_OPEN_ATTR, 'true');
  } else {
    document.documentElement.removeAttribute(PROJECT_IMAGE_PICKER_OPEN_ATTR);
  }
}

export function setFilePickerOpenFlag(open: boolean) {
  if (typeof document === 'undefined') return;
  if (open) {
    document.documentElement.setAttribute(FILE_PICKER_OPEN_ATTR, 'true');
  } else {
    document.documentElement.removeAttribute(FILE_PICKER_OPEN_ATTR);
  }
}

export interface DialogOutsideEvent {
  target: EventTarget | null;
  detail?: { originalEvent?: Event };
}

/** Véu escuro do Dialog principal — clique aqui deve fechar o card. */
export function isPrimaryDialogBackdrop(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null
  if (!el?.classList?.contains('glass-overlay-mogno')) return false
  if (el.hasAttribute('data-alert-dialog-overlay')) return false
  if (el.closest('[data-nested-dialog]')) return false
  return true
}

/** Calculadora, tela cheia, etc. — o véu do lead não pode fechar o card nesse momento. */
export function shouldBlockLeadModalBackdropClose(options?: { filePickerActive?: boolean }): boolean {
  if (options?.filePickerActive) return true
  if (typeof document === 'undefined') return false
  const root = document.documentElement
  return (
    root.hasAttribute(MARKUP_CALCULATOR_OPEN_ATTR) ||
    root.hasAttribute(MARKUP_ORCAMENTO_SIMPLES_OPEN_ATTR) ||
    root.hasAttribute(ENVIAR_PROJETO_DIALOG_OPEN_ATTR) ||
    root.hasAttribute(AMBIENTE_FULLSCREEN_ATTR) ||
    root.hasAttribute(WHITEBOARD_FULLSCREEN_ATTR) ||
    root.hasAttribute(ORCAMENTO_VISUALIZAR_OPEN_ATTR) ||
    root.hasAttribute(PROJECT_IMAGE_PICKER_OPEN_ATTR) ||
    root.hasAttribute(FILE_PICKER_OPEN_ATTR)
  )
}

export function shouldPreventDialogOutsideClose(
  e: DialogOutsideEvent,
  options?: { filePickerActive?: boolean },
): boolean {
  if (options?.filePickerActive) return true;
  if (shouldBlockLeadModalBackdropClose(options)) return true;

  const original = e.detail?.originalEvent;
  if (original?.type === 'focusin') return true;

  const target = e.target as HTMLElement | null;
  // Clique no fundo escuro fecha o card. O restante da guarda vale para popovers e janelas por cima.
  if (isPrimaryDialogBackdrop(target)) return false;
  if (target?.closest('[data-markup-calculator]')) return true;
  if (target?.closest('[data-markup-orcamento-simples]')) return true;
  if (target?.closest('[data-enviar-projeto-dialog]')) return true;
  if (target?.closest('[data-lead-lembrete-dialog]')) return true;
  if (target?.closest('[data-agenda-create-dialog]')) return true;
  if (target?.closest('[data-floating-agenda-panel]')) return true;
  if (target?.closest('[data-whiteboard-project-picker]')) return true;
  if (target?.closest('[data-ambiente-photo-studio]')) return true;
  if (target?.closest('[data-pontua-garbo-dialog]')) return true;
  if (target?.closest('[data-whiteboard-viewport]')) return true;
  if (target?.closest('[data-whiteboard-fullscreen]')) return true;
  if (target?.closest('[data-furniture-catalog]')) return true;
  if (target?.closest('[data-furniture-catalog-overlay]')) return true;
  if (target?.closest('[data-ambiente-composer-fullscreen]')) return true;
  if (target?.closest('[data-orcamento-visualizar]')) return true;
  if (target?.closest('[data-orcamento-export-menu]')) return true;
  if (target?.closest('[data-lead-ai-render-download-menu]')) return true;
  if (target?.closest('[data-lead-ai-image-fullscreen]')) return true;
  if (target?.closest('[data-lead-ai-render-fullscreen]')) return true;
  if (target?.closest('[data-orcamento-visualizar-nested]')) return true;
  if (target?.closest('[data-dialog-file-picker-zone]')) return true;
  if (target?.closest('[data-lead-origem-picker]')) return true;
  if (target?.closest('[data-lead-name-autocomplete]')) return true;
  if (target?.closest('[data-radix-popover-content]')) return true;
  if (target?.closest('[data-radix-select-content]')) return true;
  if (target?.closest('[data-radix-popper-content-wrapper]')) return true;
  if (target?.closest('[data-date-picker-root]')) return true;
  if (target?.closest('[data-floating-agenda-root]')) return true;
  if (target?.closest('[data-floating-ui-root]')) return true;
  if (target?.closest('[data-saldo-mes-insight]')) return true;
  if (target?.closest('[data-radix-dropdown-menu-content]')) return true;
  if (target?.closest('[role="menu"]')) return true;
  // AlertDialog/Dialog aninhado (ex.: confirmar duplicar) vive em outro portal —
  // sem isso o card do lead fecha no clique e a ação nunca termina.
  if (target?.closest('[role="alertdialog"]')) return true;
  if (target?.closest('[data-alert-dialog-overlay]')) return true;
  if (target?.closest('[data-nested-dialog]')) return true;

  return false;
}

/** Marca janela como “seletor de arquivo aberto” até o foco voltar ao app. */
export function runWithFilePickerGuard(onActiveChange: (active: boolean) => void, open: () => void) {
  setFilePickerOpenFlag(true);
  onActiveChange(true);
  open();
  const release = () => {
    setFilePickerOpenFlag(false);
    onActiveChange(false);
    window.removeEventListener('focus', release);
  };
  window.addEventListener('focus', release);
}

/**
 * Depois que o véu some, o mesmo clique pode cair no quadro (Novo lead).
 * Engole o clique que ainda está a caminho.
 */
export function swallowClickThroughAfterDialogClose() {
  if (typeof document === 'undefined') return
  const swallow = (event: Event) => {
    event.preventDefault()
    event.stopPropagation()
    event.stopImmediatePropagation()
  }
  const opts: AddEventListenerOptions = { capture: true }
  document.addEventListener('click', swallow, opts)
  document.addEventListener('pointerup', swallow, opts)
  window.setTimeout(() => {
    document.removeEventListener('click', swallow, opts)
    document.removeEventListener('pointerup', swallow, opts)
  }, 400)
}
