import { Trophy } from 'lucide-react'
import { CrmPageFrame, CrmPageHeader } from '@/components/crm/CrmPageFrame'
import { Button } from '@/components/ui/button'
import { LoadingState, ErrorState, EmptyState } from '@/components/ui/EmptyState'
import { useApp } from '@/context/AppContext'
import { isCrmAdmin } from '@/lib/crm-identity'
import { useCrmPontuaAdmin } from '@/hooks/useCrmMarketing'
import { fmtCur, fmtDate } from '@/lib/utils'
import { showToast } from '@/lib/toast'

export function FinanceiroPontuaPage() {
  const { crmProfile } = useApp()
  const admin = isCrmAdmin(crmProfile)
  const { prestadores, saques, liberacoes, loading, error, aprovarSaque, rejeitarSaque, liberarComissao } = useCrmPontuaAdmin()
  const pendentes = saques.filter(s => s.status === 'pendente')
  const nomeDe = (id: string) => prestadores.find(p => p.id === id)?.nome ?? 'Parceiro'
  const totalSaques = saques.reduce((s, item) => s + item.valor, 0)
  const totalPendente = pendentes.reduce((s, item) => s + item.valor, 0)

  return (
    <CrmPageFrame padded>
      <CrmPageHeader
        title="Financeiro · Pontua Garbo"
        subtitle="Arquitetos cadastrados. Não mistura com o Caixa da fábrica."
        icon={(
          <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-amber-400/30 bg-amber-400/15">
            <Trophy className="h-4 w-4 text-amber-300" />
          </div>
        )}
      />
      {loading && <LoadingState variant="page" message="Abrindo o Pontua..." />}
      {!loading && error && <ErrorState message={error} />}
      {!loading && !error && (
        <div className="space-y-8">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Kpi label="Arquitetos" value={String(prestadores.length)} />
            <Kpi label="Saques pedidos" value={fmtCur(totalSaques)} />
            <Kpi label="Aguardando PIX" value={fmtCur(totalPendente)} accent />
            <Kpi label="Liberações" value={String(liberacoes.length)} />
          </div>

          <section>
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">Mural de arquitetos</h2>
            {prestadores.length === 0 ? <EmptyState message="Nenhum arquiteto ativo." /> : (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {prestadores.map(p => (
                  <article key={p.id} className="rounded-xl border border-amber-400/20 bg-card p-4">
                    <p className="font-medium text-[#f2d892]">{p.nome}</p>
                    <p className="text-xs text-muted-foreground">{p.titulo}{p.email ? ` · ${p.email}` : ''}</p>
                  </article>
                ))}
              </div>
            )}
          </section>

          <section>
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">Pedidos de saque</h2>
            {saques.length === 0 ? <EmptyState message="Nenhum pedido." /> : (
              <ul className="divide-y divide-border/50 rounded-xl border border-border/80">
                {saques.map(s => (
                  <li key={s.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-sm">
                    <div>
                      <p>{nomeDe(s.prestadorId)} · {fmtCur(s.valor)}</p>
                      <p className="text-xs text-muted-foreground">{s.status} · {fmtDate(s.criadoEm)} · {s.chavePix}</p>
                    </div>
                    {admin && s.status === 'pendente' && (
                      <div className="flex gap-2">
                        <Button size="sm" type="button" onClick={() => void aprovarSaque(s.id).then(() => showToast('Saque aprovado.')).catch(err => showToast(err instanceof Error ? err.message : 'Erro', 'error'))}>Aprovar</Button>
                        <Button size="sm" variant="outline" type="button" onClick={() => void rejeitarSaque(s.id).then(() => showToast('Pedido rejeitado.')).catch(err => showToast(err instanceof Error ? err.message : 'Erro', 'error'))}>Rejeitar</Button>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
            {admin && pendentes.length > 0 && <p className="mt-2 text-xs text-amber-300/80">{pendentes.length} aguardando você.</p>}
          </section>

          <section>
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">Comissões aguardando liberação</h2>
            {liberacoes.length === 0 ? <EmptyState message="Nada aguardando." /> : (
              <ul className="divide-y divide-border/50 rounded-xl border border-border/80">
                {liberacoes.map(l => (
                  <li key={l.id} className="flex items-center justify-between px-3 py-2 text-sm">
                    <span>{nomeDe(l.prestadorId)} · lead {l.leadId}</span>
                    {admin && (
                      <Button size="sm" type="button" onClick={() => void liberarComissao(l.id).then(() => showToast('Comissão liberada.')).catch(err => showToast(err instanceof Error ? err.message : 'Erro', 'error'))}>Liberar</Button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      )}
    </CrmPageFrame>
  )
}

function Kpi({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="rounded-xl border border-border/80 bg-card px-3 py-2">
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={`text-lg font-semibold tabular-nums ${accent ? 'text-amber-300' : ''}`}>{value}</p>
    </div>
  )
}
