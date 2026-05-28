interface ModalFormFooterProps {
  onCancel: () => void
  onSubmit: () => void
  cancelLabel?: string
  submitLabel: string
  submittingLabel?: string
  submitting?: boolean
  submitDisabled?: boolean
}

/** Rodapé padrão dos popups de cadastro — botões responsivos */
export function ModalFormFooter({
  onCancel,
  onSubmit,
  cancelLabel = 'Cancelar',
  submitLabel,
  submittingLabel = 'Salvando...',
  submitting = false,
  submitDisabled = false,
}: ModalFormFooterProps) {
  return (
    <div className="mt-3 flex shrink-0 flex-col-reverse gap-2 border-t border-[rgba(212,168,83,0.12)] pt-4 sm:flex-row sm:justify-end">
      <button type="button" className="btn btn-outline btn-md w-full sm:w-auto" onClick={onCancel}>
        {cancelLabel}
      </button>
      <button
        type="button"
        className="btn btn-gold btn-md w-full sm:w-auto"
        onClick={onSubmit}
        disabled={submitting || submitDisabled}
      >
        {submitting ? submittingLabel : submitLabel}
      </button>
    </div>
  )
}
