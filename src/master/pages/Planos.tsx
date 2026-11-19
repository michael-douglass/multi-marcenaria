import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { TriangleAlert } from 'lucide-react'
import { toast } from 'sonner'
import { erroMsg, brl } from '@/components/master/master-utils'
import { useAssinaturas, usePlanos, useSalvarPaginasPlano } from '@/hooks/useMaster'
import { listarPaginas } from '@/lib/paginas-catalogo'
import { PaginasEditor } from '@/master/components/PaginasEditor'
import { ModelosDoPlano } from '@/master/components/modelos/ModelosDoPlano'
import { LimiteIaPlano } from '@/master/components/ia/LimiteIaPlano'
import { MasterPage, Vazio } from '@/master/components/MasterUi'
import { cn } from '@/lib/utils'

function plural(n: number) {
  return `${n} ${n === 1 ? 'marcenaria' : 'marcenarias'}`
}

/** Pacote de páginas de cada plano. Preço e criação de planos ficam em Mensalidades. */
export default function Planos() {
  const { data: planos = [], isLoading } = usePlanos()
  const { data: assinaturas = [] } = useAssinaturas()
  const salvar = useSalvarPaginasPlano()
  const [selecionado, setSelecionado] = useState<string | null>(null)
  const total = useMemo(() => listarPaginas().length, [])
  const plano = planos.find((p) => p.id === selecionado) ?? planos[0]
  const usoPorPlano = useMemo(() => {
    const m = new Map<string, number>()
    for (const a of assinaturas) if (a.plano_id) m.set(a.plano_id, (m.get(a.plano_id) ?? 0) + 1)
    return m
  }, [assinaturas])
  const usoDoPlano = plano ? usoPorPlano.get(plano.id) ?? 0 : 0

  return (
    <MasterPage
      titulo="Planos e páginas"
      resumo="Escolha quais modelos e quais páginas cada plano inclui. Marcenarias nesse plano recebem o pacote; ajustes individuais ficam na página da marcenaria."
    >
      {isLoading ? (
        <Vazio>Carregando…</Vazio>
      ) : planos.length === 0 ? (
        <p className="text-[var(--m-ink-2)]">
          Nenhum plano cadastrado. Crie um em{' '}
          <Link to="/master/financeiro" className="font-medium text-[var(--m-accent)] underline underline-offset-2">Mensalidades</Link>.
          Sem plano, toda marcenaria fica com todas as páginas liberadas.
        </p>
      ) : (
        <div className="grid gap-8 lg:grid-cols-[240px_1fr]">
          <nav aria-label="Planos">
            <ul className="space-y-1">
              {planos.map((p) => {
                const ativo = p.id === plano?.id
                return (
                  <li key={p.id}>
                    <button
                      type="button"
                      onClick={() => setSelecionado(p.id)}
                      aria-current={ativo ? 'true' : undefined}
                      className={cn(
                        'w-full rounded-md border px-4 py-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--m-accent)]',
                        ativo ? 'border-[var(--m-accent)] bg-[var(--m-surface)]' : 'border-transparent hover:bg-[var(--m-surface)]',
                      )}
                    >
                      <span className="block font-semibold text-[var(--m-ink)]">{p.nome}{!p.ativo ? ' (inativo)' : ''}</span>
                      <span className="m-num block text-[0.82rem] text-[var(--m-ink-2)]">
                        {brl(p.valor_mensal)}/mês, {total - p.paginas_bloqueadas.length} de {total} itens
                      </span>
                      <span className="m-num block text-[0.82rem] text-[var(--m-ink-2)]">
                        {plural(usoPorPlano.get(p.id) ?? 0)}
                      </span>
                    </button>
                  </li>
                )
              })}
            </ul>
          </nav>
          {plano ? (
            <div>
            {usoDoPlano === 0 ? (
              <p role="note" className="mb-5 flex items-start gap-2 rounded-md border border-[#e0a54a] bg-[#fff1d6] px-4 py-3 text-sm text-[#4a2c00]">
                <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                <span>
                  Nenhuma marcenaria usa o plano {plano.nome}: os bloqueios daqui ainda não valem para ninguém.
                  Ligue uma marcenaria a ele em{' '}
                  <Link to="/master/financeiro" className="font-semibold underline underline-offset-2">Mensalidades</Link>, ou bloqueie
                  direto na aba Páginas da marcenaria.
                </span>
              </p>
            ) : (
              <p className="mb-5 text-sm text-[var(--m-ink-2)]">
                Vale para {plural(usoDoPlano)}. Ajustes feitos na página de cada marcenaria têm prioridade.
              </p>
            )}
            <ModelosDoPlano key={`modelos-${plano.id}`} plano={plano} />
            <LimiteIaPlano key={`limite-ia-${plano.id}`} plano={plano} />
            <PaginasEditor
              key={plano.id}
              modo="plano"
              bloqueadas={plano.paginas_bloqueadas}
              salvando={salvar.isPending}
              onSalvar={async (bloqueadas) => {
                try {
                  await salvar.mutateAsync({ planoId: plano.id, bloqueadas })
                  toast.success(`Páginas do plano ${plano.nome} salvas.`)
                } catch (err) {
                  toast.error(erroMsg(err, 'Não foi possível salvar as páginas do plano'))
                }
              }}
            />
            </div>
          ) : null}
        </div>
      )}
    </MasterPage>
  )
}
