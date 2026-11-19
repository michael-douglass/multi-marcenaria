import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { erroMsg } from '@/components/master/master-utils'
import { useModelosCatalogo, useSalvarModelosPlano, type ModeloCatalogo } from '@/hooks/useMaster'
import { Painel } from '@/master/components/MasterUi'
import { TIPO_MODELO } from './modelos-ui'

/** Quais modelos publicados uma marcenaria criada neste plano recebe. */
export function ModelosDoPlano({ plano }: { plano: { id: string; nome: string } }) {
  const { data: catalogo = [], isLoading } = useModelosCatalogo()
  const salvar = useSalvarModelosPlano()

  const doPlano = useMemo(() => catalogo.filter((m) => m.planos.includes(plano.id)).map((m) => m.id), [catalogo, plano.id])
  const [marcados, setMarcados] = useState<Set<string>>(new Set(doPlano))
  // Chave em texto: um refetch com o mesmo conteúdo não descarta o que está sendo editado.
  const chave = [...doPlano].sort().join(',')
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => setMarcados(new Set(doPlano)), [chave])

  const visiveis = catalogo.filter((m) => m.publicado || marcados.has(m.id))
  const grupos = useMemo(() => {
    const g = new Map<string, ModeloCatalogo[]>()
    for (const m of visiveis) g.set(m.empresa_modelo_nome, [...(g.get(m.empresa_modelo_nome) ?? []), m])
    return [...g.entries()]
  }, [visiveis])

  const mudou = marcados.size !== doPlano.length || doPlano.some((id) => !marcados.has(id))

  const alternar = (id: string, v: boolean) =>
    setMarcados((p) => {
      const n = new Set(p)
      if (v) n.add(id)
      else n.delete(id)
      return n
    })

  const gravar = async () => {
    try {
      await salvar.mutateAsync({ planoId: plano.id, modelos: [...marcados] })
      toast.success(`Modelos do plano ${plano.nome} salvos.`)
    } catch (err) {
      toast.error(erroMsg(err, 'Não foi possível salvar os modelos do plano'))
    }
  }

  return (
    <Painel
      className="mb-8"
      titulo="Modelos que este plano recebe"
      descricao="Marcenaria criada neste plano já nasce com uma cópia destes modelos. Para quem já existe, use Enviar em Modelos padrão."
      acao={mudou ? (
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => setMarcados(new Set(doPlano))} disabled={salvar.isPending}>Descartar</Button>
          <Button size="sm" onClick={() => void gravar()} disabled={salvar.isPending}>Salvar</Button>
        </div>
      ) : null}
      corpoClassName="p-0"
    >
      {isLoading ? (
        <p className="px-5 py-6 text-sm text-[var(--m-ink-2)]">Carregando…</p>
      ) : visiveis.length === 0 ? (
        <p className="px-5 py-6 text-sm text-[var(--m-ink-2)]">
          Nenhum modelo publicado. Publique em{' '}
          <Link to="/master/modelos" className="font-medium text-[var(--m-accent)] underline underline-offset-2">Modelos padrão</Link>.
        </p>
      ) : (
        <div className="grid gap-4 p-4 md:grid-cols-2">
          {grupos.map(([empresa, itens]) => (
            <div key={empresa} className="rounded-md border border-[var(--m-line)] bg-[var(--m-surface)]">
              <p className="border-b border-[var(--m-line)] px-4 py-2.5 text-[0.8rem] font-semibold text-[var(--m-ink-2)]">{empresa}</p>
              <ul className="divide-y divide-[var(--m-line)]">
                {itens.map((m) => (
                  <li key={m.id} className="flex items-center gap-3 px-4 py-2.5">
                    <Checkbox id={`pm-${plano.id}-${m.id}`} checked={marcados.has(m.id)} onCheckedChange={(v) => alternar(m.id, v === true)} />
                    <label htmlFor={`pm-${plano.id}-${m.id}`} className="min-w-0 flex-1 cursor-pointer">
                      <span className="block text-[0.92rem] text-[var(--m-ink)]">{m.nome}</span>
                      <span className="block truncate text-[0.75rem] text-[var(--m-ink-2)]">
                        {TIPO_MODELO[m.tipo].rotulo}{m.publicado ? '' : ' · despublicado (não será entregue)'}
                      </span>
                    </label>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </Painel>
  )
}
