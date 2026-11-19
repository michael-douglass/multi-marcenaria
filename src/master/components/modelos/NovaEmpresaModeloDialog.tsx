import { useState } from 'react'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { erroMsg, slugify } from '@/components/master/master-utils'
import { useCriarEmpresaModelo, useMasterEmpresas } from '@/hooks/useMaster'

const SEGMENTOS = ['marcenaria', 'gráfica', 'serviços']
const NADA = 'nada'

/** Cria uma empresa-modelo (fonte dos modelos padrão), opcionalmente copiando os dados de uma empresa. */
export function NovaEmpresaModeloDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { data: empresas = [] } = useMasterEmpresas(open)
  const criar = useCriarEmpresaModelo()
  const [nome, setNome] = useState('')
  const [slug, setSlug] = useState('')
  const [slugManual, setSlugManual] = useState(false)
  const [segmento, setSegmento] = useState('marcenaria')
  const [origem, setOrigem] = useState<string>(NADA)

  const fechar = () => {
    if (criar.isPending) return
    setNome('')
    setSlug('')
    setSlugManual(false)
    setSegmento('marcenaria')
    setOrigem(NADA)
    onClose()
  }

  const salvar = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!nome.trim() || !slug.trim()) {
      toast.error('Informe o nome e o identificador da empresa-modelo.')
      return
    }
    try {
      await criar.mutateAsync({
        nome: nome.trim(),
        slug: slug.trim(),
        segmento: segmento.trim() || null,
        importarDe: origem === NADA ? null : origem,
      })
      toast.success(`Empresa-modelo "${nome.trim()}" criada.`)
      fechar()
    } catch (err) {
      toast.error(erroMsg(err, 'Não foi possível criar a empresa-modelo'))
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) fechar() }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="m-titulo text-2xl">Nova empresa-modelo</DialogTitle>
          <DialogDescription>
            É onde você monta os modelos de um segmento. Ela não é cliente: não tem mensalidade nem aparece nas marcenarias.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={salvar} className="mt-2 grid gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="nem-nome">Nome</Label>
            <Input
              id="nem-nome"
              value={nome}
              autoFocus
              placeholder="Ex.: Modelo Marcenaria"
              onChange={(e) => {
                setNome(e.target.value)
                if (!slugManual) setSlug(slugify(e.target.value))
              }}
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="nem-slug">Identificador</Label>
              <Input
                id="nem-slug"
                value={slug}
                placeholder="modelo_marcenaria"
                onChange={(e) => {
                  setSlugManual(true)
                  setSlug(slugify(e.target.value))
                }}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="nem-seg">Segmento</Label>
              <Input id="nem-seg" list="nem-segmentos" value={segmento} onChange={(e) => setSegmento(e.target.value)} />
              <datalist id="nem-segmentos">
                {SEGMENTOS.map((s) => <option key={s} value={s} />)}
              </datalist>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Começar com os dados de</Label>
            <Select value={origem} onValueChange={setOrigem}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value={NADA}>Nada (começa vazia)</SelectItem>
                {empresas.map((e) => <SelectItem key={e.id} value={e.id}>{e.nome}</SelectItem>)}
              </SelectContent>
            </Select>
            <p className="text-[0.78rem] text-[var(--m-ink-2)]">
              Copia markup, slides de orçamento e contratos. A empresa de origem não é alterada; logo, fundo e timbrado não vêm.
            </p>
          </div>
          <div className="mt-2 flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={fechar} disabled={criar.isPending}>Cancelar</Button>
            <Button type="submit" disabled={criar.isPending}>
              {criar.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden /> : null}
              Criar empresa-modelo
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
