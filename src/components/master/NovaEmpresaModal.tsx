import { useState } from 'react'
import { toast } from 'sonner'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useCriarEmpresa, usePlanos } from '@/hooks/useMaster'
import { brl, erroMsg, slugify } from './master-utils'

interface Props {
  open: boolean
  onClose: () => void
  onCriada?: (empresaId: string) => void
}

const VAZIO = {
  nome: '',
  slug: '',
  cnpj: '',
  razaoSocial: '',
  adminNome: '',
  adminEmail: '',
  adminSenha: '',
  planoId: 'nenhum',
  valorMensal: '',
  diaVencimento: '10',
}

/** Cria uma marcenaria nova já com o administrador e (opcional) a assinatura do sistema. */
export function NovaEmpresaModal({ open, onClose, onCriada }: Props) {
  const [f, setF] = useState(VAZIO)
  const [slugManual, setSlugManual] = useState(false)
  const { data: planos = [] } = usePlanos()
  const criar = useCriarEmpresa()

  const set = (k: keyof typeof VAZIO, v: string) => setF((p) => ({ ...p, [k]: v }))

  const fechar = () => {
    setF(VAZIO)
    setSlugManual(false)
    onClose()
  }

  const salvar = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!f.nome.trim() || !f.slug.trim() || !f.adminEmail.trim() || !f.adminNome.trim()) {
      toast.error('Preencha nome da empresa, slug e os dados do administrador.')
      return
    }
    if (f.adminSenha.length < 6) {
      toast.error('A senha do administrador precisa ter ao menos 6 caracteres.')
      return
    }
    const planoId = f.planoId === 'nenhum' ? null : f.planoId
    const valor = f.valorMensal.trim() ? Number(f.valorMensal.replace(',', '.')) : null
    try {
      const id = await criar.mutateAsync({
        nome: f.nome.trim(),
        slug: f.slug.trim(),
        cnpj: f.cnpj,
        razaoSocial: f.razaoSocial,
        adminNome: f.adminNome.trim(),
        adminEmail: f.adminEmail.trim(),
        adminSenha: f.adminSenha,
        planoId,
        valorMensal: valor,
        diaVencimento: Number(f.diaVencimento) || 10,
      })
      toast.success(`Empresa "${f.nome.trim()}" criada. O administrador já pode entrar com o e-mail e a senha informados.`)
      onCriada?.(id)
      fechar()
    } catch (err) {
      toast.error(erroMsg(err, 'Não foi possível criar a empresa'))
    }
  }

  return (
    <Modal open={open} onClose={fechar} title="Nova empresa" wide closeOnBackdrop={false}>
      <form onSubmit={salvar} className="space-y-6">
        <fieldset className="grid gap-4 sm:grid-cols-2">
          <legend className="mb-2 text-xs font-bold uppercase tracking-[0.18em] text-[#6b5244]">Marcenaria</legend>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="ne-nome">Nome *</Label>
            <Input
              id="ne-nome"
              value={f.nome}
              onChange={(e) => {
                set('nome', e.target.value)
                if (!slugManual) set('slug', slugify(e.target.value))
              }}
              placeholder="Ex.: Marcenaria Silva"
              autoFocus
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ne-slug">Identificador (slug) *</Label>
            <Input
              id="ne-slug"
              value={f.slug}
              onChange={(e) => {
                setSlugManual(true)
                set('slug', slugify(e.target.value))
              }}
              placeholder="marcenaria_silva"
            />
            <p className="text-[11px] text-[#8a7060]">Usado em links públicos. Letras minúsculas, números e _.</p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ne-cnpj">CNPJ</Label>
            <Input id="ne-cnpj" value={f.cnpj} onChange={(e) => set('cnpj', e.target.value)} />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="ne-razao">Razão social</Label>
            <Input id="ne-razao" value={f.razaoSocial} onChange={(e) => set('razaoSocial', e.target.value)} />
          </div>
        </fieldset>

        <fieldset className="grid gap-4 sm:grid-cols-2">
          <legend className="mb-2 text-xs font-bold uppercase tracking-[0.18em] text-[#6b5244]">Administrador da empresa</legend>
          <div className="space-y-1.5">
            <Label htmlFor="ne-admin-nome">Nome *</Label>
            <Input id="ne-admin-nome" value={f.adminNome} onChange={(e) => set('adminNome', e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ne-admin-email">E-mail (login) *</Label>
            <Input
              id="ne-admin-email"
              type="email"
              autoComplete="off"
              value={f.adminEmail}
              onChange={(e) => set('adminEmail', e.target.value)}
            />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="ne-admin-senha">Senha inicial *</Label>
            <Input
              id="ne-admin-senha"
              type="password"
              autoComplete="new-password"
              value={f.adminSenha}
              onChange={(e) => set('adminSenha', e.target.value)}
            />
            <p className="text-[11px] text-[#8a7060]">
              O administrador poderá cadastrar vendedores, projetistas e demais usuários da empresa.
            </p>
          </div>
        </fieldset>

        <fieldset className="grid gap-4 sm:grid-cols-3">
          <legend className="mb-2 text-xs font-bold uppercase tracking-[0.18em] text-[#6b5244]">Mensalidade do sistema</legend>
          <div className="space-y-1.5">
            <Label>Plano</Label>
            <Select
              value={f.planoId}
              onValueChange={(v) => {
                set('planoId', v)
                const p = planos.find((x) => x.id === v)
                if (p) set('valorMensal', String(p.valor_mensal))
              }}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="nenhum">Sem plano</SelectItem>
                {planos
                  .filter((p) => p.ativo)
                  .map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.nome} — {brl(p.valor_mensal)}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ne-valor">Valor mensal (R$)</Label>
            <Input
              id="ne-valor"
              inputMode="decimal"
              value={f.valorMensal}
              onChange={(e) => set('valorMensal', e.target.value)}
              placeholder="Deixe vazio para não cobrar"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ne-dia">Dia do vencimento</Label>
            <Input
              id="ne-dia"
              type="number"
              min={1}
              max={28}
              value={f.diaVencimento}
              onChange={(e) => set('diaVencimento', e.target.value)}
            />
          </div>
        </fieldset>

        <div className="flex justify-end gap-2 border-t border-[rgba(42,24,18,0.1)] pt-4">
          <Button type="button" variant="outline" onClick={fechar}>
            Cancelar
          </Button>
          <Button type="submit" disabled={criar.isPending}>
            {criar.isPending ? 'Criando…' : 'Criar empresa'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
