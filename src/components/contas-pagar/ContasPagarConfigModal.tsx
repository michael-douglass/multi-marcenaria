import { useEffect, useState } from 'react'
import { Plus, Settings, Trash2 } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import type { useFormasPagamentoPagar } from '@/hooks/useFormasPagamentoPagar'
import type { FormaPagamentoPagar } from '@/types'

type FormasHook = ReturnType<typeof useFormasPagamentoPagar>

interface ContasPagarConfigButtonProps {
  readOnly?: boolean
  formasHook: FormasHook
}

export function ContasPagarConfigButton({ readOnly, formasHook }: ContasPagarConfigButtonProps) {
  const [open, setOpen] = useState(false)

  if (readOnly) return null

  return (
    <>
      <button
        type="button"
        className="btn btn-outline btn-md !px-2.5"
        onClick={() => setOpen(true)}
        title="Configurações — formas de pagamento"
        aria-label="Configurações de formas de pagamento"
      >
        <Settings className="h-4 w-4" />
      </button>
      <ContasPagarConfigModal
        open={open}
        onClose={() => setOpen(false)}
        formasHook={formasHook}
      />
    </>
  )
}

interface ModalProps {
  open: boolean
  onClose: () => void
  formasHook: FormasHook
}

function ContasPagarConfigModal({ open, onClose, formasHook }: ModalProps) {
  const { loadAll, add, remove, reload } = formasHook
  const [lista, setLista] = useState<FormaPagamentoPagar[]>([])
  const [loading, setLoading] = useState(false)
  const [novoNome, setNovoNome] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const [salvando, setSalvando] = useState(false)

  useEffect(() => {
    if (!open) return
    setErro(null)
    setNovoNome('')
    setLoading(true)
    loadAll()
      .then(rows => setLista(rows.filter(f => f.ativo)))
      .catch(e => setErro(e instanceof Error ? e.message : 'Erro ao carregar.'))
      .finally(() => setLoading(false))
  }, [open, loadAll])

  const handleAdd = async () => {
    setSalvando(true)
    setErro(null)
    try {
      await add(novoNome)
      await reload()
      const rows = await loadAll()
      setLista(rows.filter(f => f.ativo))
      setNovoNome('')
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro ao adicionar.')
    } finally {
      setSalvando(false)
    }
  }

  const handleRemove = async (id: string, nome: string) => {
    if (!confirm(`Remover "${nome}" da lista de formas de pagamento?`)) return
    setErro(null)
    try {
      await remove(id)
      await reload()
      setLista(prev => prev.filter(f => f.id !== id))
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro ao remover.')
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="CONFIGURAÇÕES — CONTAS A PAGAR">
      <p className="mb-4 text-sm text-[#edd9c4]">
        Gerencie as formas de pagamento disponíveis nos lançamentos manuais.
      </p>

      <div className="mb-4 rounded-lg border border-[rgba(240,210,140,0.22)] bg-[rgba(68,46,34,0.45)] p-3">
        <p className="section-label mb-2">Acrescentar forma de pagamento</p>
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            className="glass-input flex-1"
            value={novoNome}
            onChange={e => setNovoNome(e.target.value)}
            placeholder="Ex: Transferência, Cartão..."
            onKeyDown={e => {
              if (e.key === 'Enter') {
                e.preventDefault()
                handleAdd()
              }
            }}
          />
          <button
            type="button"
            className="btn btn-gold btn-md shrink-0"
            onClick={handleAdd}
            disabled={salvando || !novoNome.trim()}
          >
            <Plus className="h-4 w-4" />
            Adicionar
          </button>
        </div>
      </div>

      {erro && <p className="mb-3 text-sm text-red-400">{erro}</p>}

      <p className="section-label mb-2">Formas cadastradas</p>
      {loading ? (
        <p className="text-sm text-[#edd9c4]">Carregando...</p>
      ) : lista.length === 0 ? (
        <p className="text-sm text-[#edd9c4]">Nenhuma forma ativa. Adicione acima.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {lista.map(f => (
            <li
              key={f.id}
              className="flex items-center justify-between gap-3 rounded-lg border border-[rgba(240,210,140,0.18)] bg-[rgba(78,52,40,0.5)] px-3 py-2.5"
            >
              <span className="text-sm font-medium text-cream">{f.nome}</span>
              <button
                type="button"
                className="btn btn-danger btn-sm !px-2"
                onClick={() => handleRemove(f.id, f.nome)}
                aria-label={`Remover ${f.nome}`}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-5 flex justify-end">
        <button type="button" className="btn btn-outline btn-md" onClick={onClose}>
          Fechar
        </button>
      </div>
    </Modal>
  )
}
