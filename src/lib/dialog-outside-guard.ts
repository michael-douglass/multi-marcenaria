import { MARKUP_CALCULATOR_OPEN_ATTR, MARKUP_ORCAMENTO_SIMPLES_OPEN_ATTR } from '@/lib/markup-ui';

/** Evita que Dialog Radix feche ao abrir o seletor de arquivos do sistema. */

export const ENVIAR_PROJETO_DIALOG_OPEN_ATTR = 'data-enviar-projeto-dialog-open';

/** Compositor de ambiente em tela cheia (acima do card do lead). */
export const AMBIENTE_FULLSCREEN_ATTR = 'data-ambiente-fullscreen';

export function setEnviarProjetoDialogOpenFlag(open: boolean) {
  if (typeof document === 'undefined') return;
  if (open) {
    document.documentElement.setAttribute(ENVIAR_PROJETO_DIALOG_OPEN_ATTR, 'true');
  } else {
    document.documentElement.removeAttribute(ENVIAR_PROJETO_DIALOG_OPEN_ATTR);
  }
}

export interface DialogOutsideEvent {
  target: EventTarget | null;
  detail?: { originalEvent?: Event };
}

export function shouldPreventDialogOutsideClose(
  e: DialogOutsideEvent,
  options?: { filePickerActive?: boolean },
): boolean {
  if (options?.filePickerActive) return true;

  const original = e.detail?.originalEvent;
  if (original?.type === 'focusin') return true;

  const target = e.target as HTMLElement | null;
  if (target?.closest('[data-markup-calculator]')) return true;
  if (target?.closest('[data-markup-orcamento-simples]')) return true;
  if (target?.closest('[data-enviar-projeto-dialog]')) return true;
  if (typeof document !== 'undefined' && document.documentElement.hasAttribute(MARKUP_CALCULATOR_OPEN_ATTR)) {
    return true;
  }
  if (typeof document !== 'undefined' && document.documentElement.hasAttribute(MARKUP_ORCAMENTO_SIMPLES_OPEN_ATTR)) {
    return true;
  }
  if (typeof document !== 'undefined' && document.documentElement.hasAttribute(ENVIAR_PROJETO_DIALOG_OPEN_ATTR)) {
    return true;
  }
  if (target?.closest('[data-pontua-garbo-dialog]')) return true;
  if (target?.closest('[data-whiteboard-viewport]')) return true;
  if (target?.closest('[data-furniture-catalog]')) return true;
  if (target?.closest('[data-furniture-catalog-overlay]')) return true;
  if (target?.closest('[data-ambiente-composer-fullscreen]')) return true;
  if (typeof document !== 'undefined' && document.documentElement.hasAttribute(AMBIENTE_FULLSCREEN_ATTR)) {
    return true;
  }
  if (target?.closest('[data-dialog-file-picker-zone]')) return true;
  if (target?.closest('[data-lead-origem-picker]')) return true;
  if (target?.closest('[data-lead-name-autocomplete]')) return true;
  if (target?.closest('[data-radix-popover-content]')) return true;
  if (target?.closest('[data-radix-select-content]')) return true;
  if (target?.closest('[data-floating-agenda-root]')) return true;
  if (target?.closest('[data-floating-ui-root]')) return true;
  if (target?.closest('[data-radix-dropdown-menu-content]')) return true;
  if (target?.closest('[role="menu"]')) return true;

  return false;
}

/** Marca janela como “seletor de arquivo aberto” até o foco voltar ao app. */
export function runWithFilePickerGuard(onActiveChange: (active: boolean) => void, open: () => void) {
  onActiveChange(true);
  open();
  const release = () => {
    onActiveChange(false);
    window.removeEventListener('focus', release);
  };
  window.addEventListener('focus', release);
}
