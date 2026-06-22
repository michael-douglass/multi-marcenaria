import { useState } from 'react'
import { Plus, Trash2, UserPlus } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/button'
import { Field } from '@/components/ui/Field'
import { useCaixa } from '@/hooks/useCaixa'
import type { TipoDestinatarioCaixa } from '@/types'

interface GerenciarDestinatariosDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function GerenciarDestinatariosDialog({ open, onOpenChange }: GerenciarDestinatariosDialogProps) {
  const { destinatarios, addDestinatario, removeDestinatario } = useCaixa(1, 2024) // Mes/ano não importa aqui
  const [isAdding, setIsAdding] = useState(false)
  const [nome, setNome] = useState('')
  const [tipo, setTipo] = useState<TipoDestinatarioCaixa>('outros')

  const handleAdd = async () => {
    if (!nome.trim()) return
    try {
      await addDestinatario({
        nome: nome.trim(),
        tipo,
        ativo: true
      })
      setNome('')
      setIsAdding(false)
    } catch (err) {
      alert('Erro ao adicionar destinatário')
    }
  }

  return (
    <Modal
      open={open}
      onClose={() => onOpenChange(false)}
      title="Gerenciar Destinatários"
      wide
    >
      <div className="space-y-6">
        {isAdding ? (
          <div className="glass-card p-4 space-y-4 border-[#f2d892]/20 bg-[#f2d892]/5">
            <h4 className="text-xs font-bold text-[#f2d892] uppercase tracking-wider flex items-center gap-2">
              <UserPlus className="w-3.5 h-3.5" />
              Novo Destinatário
            </h4>
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Nome">
                <input
                  value={nome}
                  onChange={e => setNome(e.target.value)}
                  className="w-full bg-black/20 border border-white/10 rounded-md px-3 py-2 text-sm text-cream focus:outline-none focus:border-[#f2d892]/50"
                  placeholder="Ex: João Marceneiro"
                />
              </Field>
              <Field label="Tipo">
                <select
                  value={tipo}
                  onChange={e => setTipo(e.target.value as TipoDestinatarioCaixa)}
                  className="w-full bg-black/20 border border-white/10 rounded-md px-3 py-2 text-sm text-cream focus:outline-none focus:border-[#f2d892]/50"
                >
                  <option value="marceneiro">Marceneiro / Produção</option>
                  <option value="fornecedor">Fornecedor</option>
                  <option value="funcionario">Funcionário</option>
                  <option value="outros">Outros</option>
                </select>
              </Field>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" size="sm" onClick={() => setIsAdding(false)}>Cancelar</Button>
              <Button size="sm" className="bg-[#f2d892] text-[#2a1812]" onClick={handleAdd}>Salvar</Button>
            </div>
          </div>
        ) : (
          <Button
            onClick={() => setIsAdding(true)}
            className="w-full border-dashed border-white/10 hover:bg-white/5"
            variant="outline"
          >
            <Plus className="w-3.5 h-3.5 mr-2 text-[#f2d892]" />
            Adicionar Destinatário
          </Button>
        )}

        <div className="space-y-2 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
          {destinatarios.map(d => (
            <div key={d.id} className="flex items-center justify-between p-3 rounded-lg bg-white/5 border border-white/5 group hover:border-white/10 transition-all">
              <div>
                <p className="text-sm font-semibold text-cream">{d.nome}</p>
                <p className="text-[0.65rem] text-[#edd9c4] uppercase tracking-wider">{d.tipo}</p>
              </div>
              <button
                onClick={() => {
                  if (confirm(`Remover ${d.nome}?`)) removeDestinatario(d.id)
                }}
                className="p-2 text-red-400/50 hover:text-red-400 hover:bg-red-400/10 rounded-md transition-all opacity-0 group-hover:opacity-100"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
          {destinatarios.length === 0 && (
            <p className="text-center py-10 text-xs text-[#edd9c4]">Nenhum destinatário cadastrado.</p>
          )}
        </div>
      </div>
    </Modal>
  )
}
