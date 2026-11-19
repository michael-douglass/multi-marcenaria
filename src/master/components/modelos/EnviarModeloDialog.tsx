import { useMemo, useState } from 'react'
import { CheckCircle2, Loader2, XCircle } from 'lucide-react'
import { toast } from 'sonner'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { erroMsg } from '@/components/master/master-utils'
import { useEnviarModelo, useMasterEmpresas, type ModeloCatalogo, type ResultadoEnvio } from '@/hooks/useMaster'
import { descreverResumo } from './modelos-ui'

/** Escolhe marcenarias e envia uma cópia do modelo. Reenvio só acrescenta (nunca apaga o que a empresa editou). */
export function EnviarModeloDialog({ modelo, onClose }: { modelo: ModeloCatalogo | null; onClose: () => void }) {
  const { data: empresas = [] } = useMasterEmpresas(!!modelo)
  const enviar = useEnviarModelo()
  const [marcadas, setMarcadas] = useState<Set<string>>(new Set())
  const [busca, setBusca] = useState('')
  const [resultado, setResultado] = useState<ResultadoEnvio[] | null>(null)

  const visiveis = useMemo(() => {
    const t = busca.trim().toLowerCase()
    return t ? empresas.filter((e) => e.nome.toLowerCase().includes(t)) : empresas
  }, [empresas, busca])

  const fechar = () => {
    if (enviar.isPending) return
    setMarcadas(new Set())
    setBusca('')
    setResultado(null)
    onClose()
  }

  const alternar = (id: string, v: boolean) =>
    setMarcadas((p) => {
      const n = new Set(p)
      if (v) n.add(id)
      else n.delete(id)
      return n
    })

  const confirmar = async () => {
    if (!modelo || marcadas.size === 0) return
    try {
      const r = await enviar.mutateAsync({ modeloId: modelo.id, empresas: [...marcadas] })
      setResultado(r ?? [])
      const falhas = (r ?? []).filter((x) => !x.ok).length
      if (falhas) toast.error(`${falhas} envio(s) com erro. Veja os detalhes.`)
      else toast.success('Modelo enviado.')
    } catch (err) {
      toast.error(erroMsg(err, 'Não foi possível enviar o modelo'))
    }
  }

  return (
    <Dialog open={!!modelo} onOpenChange={(o) => { if (!o) fechar() }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="m-titulo text-2xl">Enviar “{modelo?.nome}”</DialogTitle>
          <DialogDescription>
            Cada marcenaria recebe uma cópia própria. Quem já tem só ganha o que falta: nada do que ela editou é apagado
            {modelo?.tipo === 'contrato' ? ' (o contrato chega como um modelo novo, com “(v2)” no nome se o nome já existir)' : ''}.
          </DialogDescription>
        </DialogHeader>

        {resultado ? (
          <ul className="mt-2 divide-y divide-[var(--m-line)] rounded-md border border-[var(--m-line)]">
            {resultado.map((r) => (
              <li key={r.empresa_id} className="flex items-start gap-3 px-4 py-3">
                {r.ok
                  ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[var(--m-accent)]" aria-label="Enviado" />
                  : <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-[var(--m-total)]" aria-label="Erro" />}
                <span className="min-w-0">
                  <span className="block font-medium text-[var(--m-ink)]">{r.empresa ?? r.empresa_id}</span>
                  <span className="block text-[0.8rem] text-[var(--m-ink-2)]">
                    {r.ok ? descreverResumo(modelo?.tipo, r.resumo) : r.erro}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <div className="mt-2 grid gap-3">
            <Input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar marcenaria" aria-label="Buscar marcenaria" />
            <ul className="max-h-72 divide-y divide-[var(--m-line)] overflow-y-auto rounded-md border border-[var(--m-line)]">
              {visiveis.length === 0 ? (
                <li className="px-4 py-6 text-center text-sm text-[var(--m-ink-2)]">Nenhuma marcenaria.</li>
              ) : visiveis.map((e) => (
                <li key={e.id} className="flex items-center gap-3 px-4 py-2.5">
                  <Checkbox id={`env-${e.id}`} checked={marcadas.has(e.id)} onCheckedChange={(v) => alternar(e.id, v === true)} />
                  <label htmlFor={`env-${e.id}`} className="min-w-0 flex-1 cursor-pointer text-[0.92rem] text-[var(--m-ink)]">{e.nome}</label>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="mt-4 flex justify-end gap-2">
          {resultado ? (
            <Button onClick={fechar}>Fechar</Button>
          ) : (
            <>
              <Button variant="outline" onClick={fechar} disabled={enviar.isPending}>Cancelar</Button>
              <Button onClick={() => void confirmar()} disabled={enviar.isPending || marcadas.size === 0}>
                {enviar.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden /> : null}
                Enviar para {marcadas.size || ''} {marcadas.size === 1 ? 'marcenaria' : 'marcenarias'}
              </Button>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
