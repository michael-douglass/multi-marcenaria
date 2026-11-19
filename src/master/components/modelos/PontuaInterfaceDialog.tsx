import { Suspense, lazy, useEffect, useState } from 'react'
import { Check, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { erroMsg } from '@/components/master/master-utils'
import { useDefinirPontuaInterface, type ModeloCatalogo } from '@/hooks/useMaster'
import {
  PONTUA_INTERFACES,
  interfacePontua,
  type PontuaInterface,
} from '@/components/marketing/apresentacao-empresa/apresentacao-conteudo'
import { cn } from '@/lib/utils'

// three.js só entra no bundle do master quando o diálogo é aberto.
const PontuaInterfacePreview = lazy(() => import('./PontuaInterfacePreview'))

/**
 * Escolhe a interface da página Pontua do pacote de uma empresa-modelo, com pré-visualização.
 * Vale para quem receber o pacote depois; empresa que já tem interface própria não é sobrescrita.
 */
export function PontuaInterfaceDialog({ modelo, onClose }: { modelo: ModeloCatalogo | null; onClose: () => void }) {
  const definir = useDefinirPontuaInterface()
  const atual = interfacePontua(modelo?.contagem.interface)
  const [escolhida, setEscolhida] = useState<PontuaInterface>(atual)

  // Reabre sempre na interface vigente do modelo.
  useEffect(() => {
    if (modelo) setEscolhida(interfacePontua(modelo.contagem.interface))
  }, [modelo])

  const fechar = () => {
    if (!definir.isPending) onClose()
  }

  const salvar = async () => {
    if (!modelo) return
    try {
      await definir.mutateAsync({ empresaModeloId: modelo.empresa_modelo_id, interface: escolhida })
      toast.success('Interface da Pontua salva.')
      onClose()
    } catch (err) {
      toast.error(erroMsg(err, 'Não foi possível salvar a interface'))
    }
  }

  return (
    <Dialog open={!!modelo} onOpenChange={(o) => { if (!o) fechar() }}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle className="m-titulo text-2xl">Interface da Pontua</DialogTitle>
          <DialogDescription>
            {modelo?.empresa_modelo_nome}: define como o banner principal da página aparece para as marcenarias que
            receberem este pacote. Quem já tem interface própria não é alterada.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 md:grid-cols-[14rem_1fr]">
          <div role="radiogroup" aria-label="Interface" className="grid content-start gap-2">
            {PONTUA_INTERFACES.map((it) => {
              const ativa = escolhida === it.id
              return (
                <button
                  key={it.id}
                  type="button"
                  role="radio"
                  aria-checked={ativa}
                  onClick={() => setEscolhida(it.id)}
                  className={cn(
                    'min-h-11 rounded-md border px-3 py-2.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--m-accent)]',
                    ativa
                      ? 'border-[var(--m-accent)] bg-[var(--m-accent-soft)]'
                      : 'border-[var(--m-line)] hover:bg-[var(--m-surface)]',
                  )}
                >
                  <span className="flex items-center justify-between gap-2 text-[0.95rem] font-medium text-[var(--m-ink)]">
                    {it.nome}
                    {it.id === atual ? <span className="text-[0.7rem] font-normal text-[var(--m-ink-2)]">atual</span> : null}
                    {ativa ? <Check className="h-4 w-4 text-[var(--m-accent)]" aria-hidden /> : null}
                  </span>
                  <span className="mt-0.5 block text-[0.8rem] text-[var(--m-ink-2)]">{it.descricao}</span>
                </button>
              )
            })}
          </div>

          <div className="min-w-0">
            <Suspense
              fallback={
                <div className="flex aspect-video items-center justify-center rounded-md border border-[var(--m-line)] text-sm text-[var(--m-ink-2)]">
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden /> Carregando prévia…
                </div>
              }
            >
              {modelo ? <PontuaInterfacePreview interfaceId={escolhida} /> : null}
            </Suspense>
            <p className="mt-2 text-[0.78rem] text-[var(--m-ink-2)]">
              Prévia com texto de exemplo. O conteúdo real de cada empresa continua sendo editado em “Editar”.
            </p>
          </div>
        </div>

        <div className="mt-2 flex justify-end gap-2">
          <Button variant="outline" onClick={fechar} disabled={definir.isPending}>Cancelar</Button>
          <Button onClick={() => void salvar()} disabled={definir.isPending || escolhida === atual}>
            {definir.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden /> : null}
            Salvar interface
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
