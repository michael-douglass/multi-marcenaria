import { useEffect, useState } from 'react'
import { LayoutGrid } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { ModalFormFooter } from '@/components/ui/ModalFormFooter'
import {
  VISUALIZACAO_PAINEIS,
  checkboxStateToPaineisVisiveis,
  getVisualizacaoPaineisCheckboxState,
  type VisualizacaoPainelId,
} from '@/lib/visualizacao-paineis'
import { showToast } from '@/lib/toast'

interface VisualizacaoPaineisConfigModalProps {
  open: boolean
  onClose: () => void
  salvos: VisualizacaoPainelId[] | null
  saving: boolean
  onSave: (paineis: VisualizacaoPainelId[]) => Promise<void>
}

export function VisualizacaoPaineisConfigModal({
  open,
  onClose,
  salvos,
  saving,
  onSave,
}: VisualizacaoPaineisConfigModalProps) {
  const [state, setState] = useState<Record<VisualizacaoPainelId, boolean>>(() =>
    getVisualizacaoPaineisCheckboxState(salvos),
  )

  useEffect(() => {
    if (!open) return
    setState(getVisualizacaoPaineisCheckboxState(salvos))
  }, [open, salvos])

  const toggle = (id: VisualizacaoPainelId) => {
    setState(prev => ({ ...prev, [id]: !prev[id] }))
  }

  const marcarTodos = (valor: boolean) => {
    setState(Object.fromEntries(
      VISUALIZACAO_PAINEIS.map(p => [p.id, valor]),
    ) as Record<VisualizacaoPainelId, boolean>)
  }

  const handleSave = async () => {
    const selecionados = checkboxStateToPaineisVisiveis(state)
    if (selecionados.length === 0) {
      showToast('Selecione ao menos um painel para o visualizador.', 'error')
      return
    }
    try {
      await onSave(selecionados)
      showToast('Painéis do visualizador atualizados.', 'success')
      onClose()
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : 'Não foi possível salvar os painéis.',
        'error',
      )
    }
  }

  const selecionados = checkboxStateToPaineisVisiveis(state).length

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Painéis do Visualizador"
      wide
    >
      <div className="mb-4 flex items-start gap-3 rounded-lg border border-[rgba(240,210,140,0.18)] bg-[rgba(10,4,2,0.35)] p-3">
        <LayoutGrid size={18} className="mt-0.5 shrink-0 text-[#f2d892]" />
        <p className="text-sm text-[#edd9c4] leading-relaxed">
          Escolha quais cards aparecem para usuários com perfil{' '}
          <strong className="text-[#f2d892]">Visualizador</strong>.
          Novos painéis adicionados ao sistema entram automaticamente nesta lista.
        </p>
      </div>

      <div className="mb-3 flex flex-wrap gap-2">
        <button type="button" className="btn btn-outline btn-sm" onClick={() => marcarTodos(true)}>
          Marcar todos
        </button>
        <button type="button" className="btn btn-outline btn-sm" onClick={() => marcarTodos(false)}>
          Desmarcar todos
        </button>
        <span className="self-center text-xs text-[#edd9c4]">
          {selecionados} de {VISUALIZACAO_PAINEIS.length} selecionado(s)
        </span>
      </div>

      <div className="space-y-2 max-h-[50vh] overflow-y-auto pr-1">
        {VISUALIZACAO_PAINEIS.map(painel => (
          <label
            key={painel.id}
            className="flex cursor-pointer items-start gap-3 rounded-lg border border-[rgba(240,210,140,0.14)] bg-[rgba(255,255,255,0.02)] p-3 transition-colors hover:bg-[rgba(240,210,140,0.06)]"
          >
            <input
              type="checkbox"
              checked={state[painel.id]}
              onChange={() => toggle(painel.id)}
              className="mt-1 h-4 w-4 shrink-0 accent-[#f2d892]"
            />
            <span className="min-w-0">
              <span className="block text-sm font-semibold text-cream">{painel.label}</span>
              <span className="block text-xs text-[#edd9c4] mt-0.5">{painel.description}</span>
              {painel.exibicao === 'fullscreen' ? (
                <span className="mt-1 inline-block text-[10px] font-semibold uppercase tracking-wide text-[#f2d892]/80">
                  Só tela cheia
                </span>
              ) : null}
            </span>
          </label>
        ))}
      </div>

      <ModalFormFooter
        onCancel={onClose}
        onSubmit={() => { void handleSave() }}
        submitLabel="Salvar painéis"
        submittingLabel="Salvando…"
        submitting={saving}
      />
    </Modal>
  )
}
