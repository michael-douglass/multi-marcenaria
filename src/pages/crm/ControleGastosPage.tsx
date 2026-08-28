import { useState } from 'react'
import { Plus, Wallet } from 'lucide-react'
import { CrmPageFrame, CrmPageHeader } from '@/components/crm/CrmPageFrame'
import { Button } from '@/components/ui/button'
import { LoadingState, ErrorState, EmptyState } from '@/components/ui/EmptyState'
import { Field } from '@/components/ui/Field'
import { useCrmGastos } from '@/hooks/useCrmMarketing'
import { somaLancamentos } from '@/lib/crm-marketing'
import { fmtCur, todayISO } from '@/lib/utils'
import { showToast } from '@/lib/toast'

export function ControleGastosPage() {
  const { fontes, subFontes, colunas, lancamentos, loading, error, salvarFonte, salvarSubfonte, salvarLancamento } = useCrmGastos()
  const [fonteId, setFonteId] = useState<string | null>(null)
  const [subId, setSubId] = useState<string | null>(null)
  const [nomeFonte, setNomeFonte] = useState('')
  const [nomeSub, setNomeSub] = useState('')
  const [valor, setValor] = useState('')
  const [obs, setObs] = useState('')
  const [dataLanc, setDataLanc] = useState(todayISO())
  const fonte = fontes.find(f => f.id === fonteId) ?? null
  const subs = subFontes.filter(s => s.fonteId === fonteId)
  const sub = subs.find(s => s.id === subId) ?? null
  const cols = colunas.filter(c => c.subFonteId === subId)
  const colunaValor = cols[0]
  const lancs = lancamentos.filter(l => cols.some(c => c.id === l.colunaId))

  return (
    <CrmPageFrame padded>
      <CrmPageHeader
        title="Controle de gastos"
        subtitle="Verba de marketing. Não mistura com o Caixa da fábrica."
        icon={(
          <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-emerald-400/30 bg-emerald-400/15">
            <Wallet className="h-4 w-4 text-emerald-300" />
          </div>
        )}
      />
      {loading && <LoadingState variant="page" message="Abrindo os gastos..." />}
      {!loading && error && <ErrorState message={error} />}
      {!loading && !error && !fonte && (
        <>
          <div className="mb-4 flex flex-wrap gap-2">
            <input className="glass-input max-w-xs" placeholder="Nova fonte (ex.: Instagram)" value={nomeFonte} onChange={e => setNomeFonte(e.target.value)} />
            <Button size="sm" type="button" onClick={() => {
              if (!nomeFonte.trim()) return
              void salvarFonte(null, nomeFonte.trim()).then(() => { setNomeFonte(''); showToast('Fonte criada.') })
                .catch(err => showToast(err instanceof Error ? err.message : 'Erro', 'error'))
            }}>
              <Plus className="h-4 w-4" /> Fonte
            </Button>
          </div>
          {fontes.length === 0 ? <EmptyState message="Nenhuma fonte ainda. Crie a primeira (Ads, orgânico, eventos...)." /> : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {fontes.map(f => (
                <button key={f.id} type="button" className="rounded-xl border border-border/80 p-4 text-left hover:border-amber-400/40" onClick={() => setFonteId(f.id)}>
                  <p className="font-semibold">{f.nome}</p>
                  <p className="text-xs text-muted-foreground">{subFontes.filter(s => s.fonteId === f.id).length} sub-fontes</p>
                </button>
              ))}
            </div>
          )}
        </>
      )}
      {!loading && !error && fonte && !sub && (
        <div className="space-y-4">
          <Button size="sm" variant="outline" onClick={() => setFonteId(null)}>Voltar</Button>
          <h2 className="text-lg font-semibold">{fonte.nome}</h2>
          <div className="flex flex-wrap gap-2">
            <input className="glass-input max-w-xs" placeholder="Nova sub-fonte" value={nomeSub} onChange={e => setNomeSub(e.target.value)} />
            <Button size="sm" type="button" onClick={() => {
              if (!nomeSub.trim()) return
              void salvarSubfonte(null, fonte.id, nomeSub.trim()).then(() => { setNomeSub(''); showToast('Sub-fonte criada.') })
                .catch(err => showToast(err instanceof Error ? err.message : 'Erro', 'error'))
            }}>Adicionar</Button>
          </div>
          {subs.length === 0 ? <EmptyState message="Nenhuma sub-fonte nesta fonte." /> : (
            <div className="grid gap-2">
              {subs.map(s => (
                <button key={s.id} type="button" className="rounded-lg border border-border/70 px-3 py-2 text-left hover:border-amber-400/40" onClick={() => setSubId(s.id)}>
                  {s.nome}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
      {!loading && !error && fonte && sub && (
        <div className="space-y-4">
          <Button size="sm" variant="outline" onClick={() => setSubId(null)}>Voltar</Button>
          <h2 className="text-lg font-semibold">{fonte.nome} · {sub.nome}</h2>
          <p className="text-sm text-muted-foreground">Total: {fmtCur(somaLancamentos(lancs))}</p>
          {colunaValor && (
            <div className="flex flex-wrap items-end gap-2">
              <Field label="Data">
                <input className="glass-input" type="date" value={dataLanc} onChange={e => setDataLanc(e.target.value)} />
              </Field>
              <Field label="Observação">
                <input className="glass-input" value={obs} onChange={e => setObs(e.target.value)} />
              </Field>
              <Field label="Valor">
                <input className="glass-input" value={valor} onChange={e => setValor(e.target.value)} placeholder="0,00" />
              </Field>
              <Button size="sm" type="button" onClick={() => {
                const parsed = Number(valor.replace(/\./g, '').replace(',', '.'))
                if (!Number.isFinite(parsed)) { showToast('Informe um valor.', 'error'); return }
                void salvarLancamento({ id: null, colunaId: colunaValor.id, data: dataLanc || todayISO(), valor: parsed, observacao: obs })
                  .then(() => { setValor(''); setObs(''); showToast('Lançamento salvo.') })
                  .catch(err => showToast(err instanceof Error ? err.message : 'Erro', 'error'))
              }}>Lançar</Button>
            </div>
          )}
          {lancs.length === 0 ? <EmptyState message="Nenhum lançamento ainda." /> : (
            <div className="overflow-x-auto rounded-xl border border-border/80">
              <table className="w-full min-w-[480px] text-left text-sm">
                <thead className="border-b border-border/60 text-[11px] uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2">Data</th>
                    <th className="px-3 py-2">Observação</th>
                    <th className="px-3 py-2 text-right">Valor</th>
                  </tr>
                </thead>
                <tbody>
                  {lancs.map(l => (
                    <tr key={l.id} className="border-t border-border/40">
                      <td className="px-3 py-2">{l.data}</td>
                      <td className="px-3 py-2 text-muted-foreground">{l.observacao || '—'}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{fmtCur(l.valor)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </CrmPageFrame>
  )
}
