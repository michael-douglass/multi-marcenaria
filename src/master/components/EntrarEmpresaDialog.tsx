import { useState } from 'react'
import { Eye, Loader2, PencilLine } from 'lucide-react'
import { toast } from 'sonner'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { useApp } from '@/context/AppContext'
import { erroMsg } from '@/components/master/master-utils'
import { cn } from '@/lib/utils'

type Modo = 'leitura' | 'total'

const MODOS: { id: Modo; titulo: string; texto: string; icon: typeof Eye; cor: string }[] = [
  {
    id: 'leitura',
    titulo: 'Somente leitura',
    texto: 'Você vê tudo como o administrador da marcenaria, mas o sistema recusa qualquer alteração.',
    icon: Eye,
    cor: 'var(--m-leitura)',
  },
  {
    id: 'total',
    titulo: 'Acesso total',
    texto: 'Você pode criar, editar e excluir dados da marcenaria. Use para corrigir algo a pedido dela.',
    icon: PencilLine,
    cor: 'var(--m-total)',
  },
]

/** Escolha do modo antes de entrar numa marcenaria. A entrada fica registrada. */
export function EntrarEmpresaDialog({ empresa, onClose }: { empresa: { id: string; nome: string } | null; onClose: () => void }) {
  const { trocarEmpresa } = useApp()
  const [modo, setModo] = useState<Modo>('leitura')
  const [entrando, setEntrando] = useState(false)

  const entrar = async () => {
    if (!empresa) return
    setEntrando(true)
    try {
      await trocarEmpresa(empresa.id, modo === 'leitura')
    } catch (err) {
      setEntrando(false)
      toast.error(erroMsg(err, 'Não foi possível entrar na marcenaria'))
    }
  }

  return (
    <Dialog open={!!empresa} onOpenChange={(o) => { if (!o && !entrando) onClose() }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="m-titulo text-2xl">Entrar em {empresa?.nome}</DialogTitle>
          <DialogDescription>Escolha o que você vai poder fazer lá dentro. A entrada fica registrada.</DialogDescription>
        </DialogHeader>

        <div role="radiogroup" aria-label="Modo de acesso" className="mt-2 grid gap-3">
          {MODOS.map((m) => {
            const ativo = modo === m.id
            const Icon = m.icon
            return (
              <button
                key={m.id}
                type="button"
                role="radio"
                aria-checked={ativo}
                onClick={() => setModo(m.id)}
                className={cn(
                  'flex items-start gap-3 rounded-md border p-4 text-left transition-colors',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--m-accent)]',
                  ativo ? 'border-2 bg-[var(--m-surface)]' : 'border-[var(--m-line)] hover:bg-[var(--m-bg)]',
                )}
                style={ativo ? { borderColor: m.cor } : undefined}
              >
                <Icon className="mt-0.5 h-5 w-5 shrink-0" style={{ color: m.cor }} aria-hidden />
                <span>
                  <span className="block font-semibold text-[var(--m-ink)]">{m.titulo}</span>
                  <span className="mt-0.5 block text-sm text-[var(--m-ink-2)]">{m.texto}</span>
                </span>
              </button>
            )
          })}
        </div>

        <div className="mt-4 flex justify-end gap-2">
          <Button variant="outline" onClick={onClose} disabled={entrando}>Cancelar</Button>
          <Button
            onClick={() => void entrar()}
            disabled={entrando}
            className={modo === 'total' ? 'bg-[var(--m-total)] hover:bg-[var(--m-total)]/90' : undefined}
          >
            {entrando ? <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden /> : null}
            {modo === 'leitura' ? 'Entrar para ver' : 'Entrar com acesso total'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
