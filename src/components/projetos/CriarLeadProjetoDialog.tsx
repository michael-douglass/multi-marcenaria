import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useCriarLeadProjeto } from '@/hooks/useLeadProjetos'

interface CriarLeadProjetoDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreated?: (leadId: number) => void
}

export function CriarLeadProjetoDialog({ open, onOpenChange, onCreated }: CriarLeadProjetoDialogProps) {
  const criar = useCriarLeadProjeto()
  const [nome, setNome] = useState('')
  const [telefone, setTelefone] = useState('')
  const [empresa, setEmpresa] = useState('')

  const submit = async () => {
    const leadId = await criar.mutateAsync({ nome, telefone, empresa })
    setNome('')
    setTelefone('')
    setEmpresa('')
    onOpenChange(false)
    onCreated?.(leadId)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="border-[#8d5e22]/20 bg-[#fffcf8]">
        <DialogHeader>
          <DialogTitle className="font-display text-[#8d5e22]">Adicionar lead</DialogTitle>
          <DialogDescription>
            Cria o cadastro comercial e já coloca na fila. Sem recado — o time pega depois.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="novo-lead-nome">Nome</Label>
            <Input id="novo-lead-nome" value={nome} onChange={(e) => setNome(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="novo-lead-tel">Telefone</Label>
            <Input id="novo-lead-tel" value={telefone} onChange={(e) => setTelefone(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="novo-lead-emp">Empresa</Label>
            <Input id="novo-lead-emp" value={empresa} onChange={(e) => setEmpresa(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            type="button"
            className="bg-gold text-[#1a120e]"
            disabled={criar.isPending || nome.trim().length < 2}
            onClick={() => void submit()}
          >
            Criar na fila
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
