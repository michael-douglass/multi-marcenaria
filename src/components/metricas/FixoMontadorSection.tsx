import { useEffect, useMemo, useState } from 'react'
import { Plus, Save } from 'lucide-react'
import { DateInput } from '@/components/ui/DateInput'
import type { useFixoMontador } from '@/hooks/useFixoMontador'
import { EmptyState } from '@/components/ui/EmptyState'
import { fmtCur, fmtDate } from '@/lib/utils'
import type { MontadorFixoMensal } from '@/types'

const STATUS_LABEL: Record<MontadorFixoMensal['status_mes'], string> = {
  pendente: 'Pendente',
  pago: 'Pago',
  sem_fixo: 'Sem fixo',
}

const STATUS_COLOR: Record<MontadorFixoMensal['status_mes'], string> = {
  pendente: '#f59e0b',
  pago: '#10b981',
  sem_fixo: '#d4bc9f',
}

interface FixoMontadorSectionProps {
  mes: number
  ano: number
  periodoLabel: string
  canEdit: boolean
  comissaoConcluidaPorMontador?: Record<string, number>
  fixo: ReturnType<typeof useFixoMontador>
}

function defaultVencimento(): string {
  const d = new Date()
  d.setMonth(d.getMonth() + 1)
  d.setDate(10)
  return d.toISOString().slice(0, 10)
}

export function FixoMontadorSection({
  mes,
  ano,
  periodoLabel,
  canEdit,
  comissaoConcluidaPorMontador = {},
  fixo,
}: FixoMontadorSectionProps) {
  const { data, loading, error, savingId, salvarFixo } = fixo
  const [draftsValor, setDraftsValor] = useState<Record<string, string>>({})
  const [draftsData, setDraftsData] = useState<Record<string, string>>({})
  const [visiveis, setVisiveis] = useState<Set<string>>(new Set())
  const [montadorSelecionado, setMontadorSelecionado] = useState('')

  useEffect(() => {
    const valores: Record<string, string> = {}
    const datas: Record<string, string> = {}
    const idsComFixo = new Set<string>()

    for (const row of data) {
      if (row.valor_fixo_mensal > 0) {
        idsComFixo.add(row.montador_id)
        valores[row.montador_id] = String(row.valor_fixo_mensal)
        datas[row.montador_id] = row.primeiro_vencimento ?? defaultVencimento()
      }
    }

    setVisiveis(prev => new Set([...prev, ...idsComFixo]))
    setDraftsValor(prev => ({ ...prev, ...valores }))
    setDraftsData(prev => ({ ...prev, ...datas }))
  }, [data])

  const montadoresOcultos = useMemo(
    () => data.filter(row => !visiveis.has(row.montador_id)),
    [data, visiveis],
  )

  const linhasVisiveis = useMemo(() => {
    if (!canEdit) {
      return data.filter(row => row.valor_fixo_mensal > 0)
    }
    return data.filter(row => visiveis.has(row.montador_id))
  }, [canEdit, data, visiveis])

  const parseDraftValor = (montadorId: string, fallback: number): number => {
    const raw = draftsValor[montadorId] ?? ''
    if (raw === '') return fallback
    return Math.max(0, Number(raw.replace(',', '.')) || 0)
  }

  const totais = useMemo(() => {
    let fixo = 0
    let comissao = 0
    let aPagar = 0

    for (const row of linhasVisiveis) {
      const fixoLinha = canEdit
        ? parseDraftValor(row.montador_id, row.valor_fixo_mensal)
        : row.valor_fixo_mensal
      const comissaoLinha = comissaoConcluidaPorMontador[row.montador_id] ?? 0
      fixo += fixoLinha
      comissao += comissaoLinha
      aPagar += fixoLinha + comissaoLinha
    }

    return { fixo, comissao, aPagar }
  }, [linhasVisiveis, canEdit, draftsValor, comissaoConcluidaPorMontador])

  const adicionarMontador = () => {
    if (!montadorSelecionado) return
    setVisiveis(prev => new Set([...prev, montadorSelecionado]))
    setDraftsValor(prev => ({
      ...prev,
      [montadorSelecionado]: prev[montadorSelecionado] ?? '',
    }))
    setDraftsData(prev => ({
      ...prev,
      [montadorSelecionado]: prev[montadorSelecionado] ?? defaultVencimento(),
    }))
    setMontadorSelecionado('')
  }

  const handleSave = async (row: MontadorFixoMensal) => {
    const raw = draftsValor[row.montador_id] ?? ''
    const valor = raw === '' ? 0 : Math.max(0, Number(raw.replace(',', '.')) || 0)
    const dataPagamento = draftsData[row.montador_id] || null
    await salvarFixo(row.montador_id, valor, valor > 0 ? dataPagamento : null)

    if (valor <= 0) {
      setVisiveis(prev => {
        const next = new Set(prev)
        next.delete(row.montador_id)
        return next
      })
    }
  }

  return (
    <div className="glass-card mb-6 overflow-hidden">
      <div className="border-b border-[rgba(240,210,140,0.12)] px-4 py-3">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-[#f2d892]">
          Fixo Montador
        </h2>
        <p className="mt-1 text-xs text-[#edd9c4]">
          Selecione o montador, defina valor e data de pagamento — a cobrança recorrente é criada em Contas a Pagar
        </p>
      </div>

      {error && (
        <div className="border-b border-red-500/20 bg-red-500/10 px-4 py-2 text-xs text-red-300">
          {error}
        </div>
      )}

      {canEdit && !loading && data.length > 0 && (
        <div className="flex flex-wrap items-end gap-2 border-b border-[rgba(240,210,140,0.08)] px-4 py-3">
          <div className="min-w-[12rem] flex-1">
            <label className="mb-1 block text-[0.65rem] font-bold uppercase tracking-wider text-[#edd9c4]">
              Selecionar montador
            </label>
            <select
              className="glass-input !h-9 w-full text-sm"
              value={montadorSelecionado}
              onChange={e => setMontadorSelecionado(e.target.value)}
            >
              <option value="">Escolha um montador...</option>
              {montadoresOcultos.map(m => (
                <option key={m.montador_id} value={m.montador_id}>
                  {m.montador_nome}
                </option>
              ))}
            </select>
          </div>
          <button
            type="button"
            className="btn btn-outline btn-sm flex items-center gap-1"
            disabled={!montadorSelecionado}
            onClick={adicionarMontador}
          >
            <Plus size={14} />
            Adicionar
          </button>
        </div>
      )}

      {loading && (
        <div className="p-8 text-center text-sm text-[#edd9c4]">Carregando montadores...</div>
      )}

      {!loading && data.length === 0 && (
        <div className="p-8">
          <EmptyState message="Nenhum montador ativo cadastrado em Configurações." />
        </div>
      )}

      {!loading && data.length > 0 && linhasVisiveis.length === 0 && (
        <div className="p-8">
          <EmptyState message="Selecione um montador acima para definir o valor fixo mensal." />
        </div>
      )}

      {!loading && linhasVisiveis.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[920px] text-sm">
            <thead>
              <tr className="border-b border-[rgba(240,210,140,0.12)]">
                {[
                  'Montador',
                  'Valor fixo mensal',
                  'Valor a pagar',
                  'Data de pagamento',
                  `Status em ${periodoLabel}`,
                  '',
                ].map(h => (
                  <th
                    key={h || 'acao'}
                    className="px-4 py-3 text-left text-[0.7rem] uppercase tracking-wider text-[#edd9c4]"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {linhasVisiveis.map((row, i) => {
                const isSaving = savingId === row.montador_id
                const draftValor = draftsValor[row.montador_id] ?? ''
                const draftData = draftsData[row.montador_id] ?? defaultVencimento()
                const valorAtual = row.valor_fixo_mensal
                const fixoEfetivo = canEdit
                  ? parseDraftValor(row.montador_id, valorAtual)
                  : valorAtual
                const comissaoConcluida = comissaoConcluidaPorMontador[row.montador_id] ?? 0
                const valorAPagar = fixoEfetivo + comissaoConcluida

                return (
                  <tr
                    key={row.montador_id}
                    className={`border-b border-[rgba(240,210,140,0.06)] ${i % 2 === 0 ? 'bg-[rgba(255,255,255,0.01)]' : ''}`}
                  >
                    <td className="px-4 py-3 font-semibold text-cream">
                      {row.montador_nome}
                    </td>
                    <td className="px-4 py-3">
                      {canEdit ? (
                        <div className="flex max-w-[12rem] items-center gap-2">
                          <span className="text-[#edd9c4]">R$</span>
                          <input
                            type="number"
                            min={0}
                            step="0.01"
                            className="glass-input !h-8 !py-1 font-mono text-sm"
                            value={draftValor}
                            disabled={isSaving}
                            onChange={e => setDraftsValor(prev => ({
                              ...prev,
                              [row.montador_id]: e.target.value,
                            }))}
                            placeholder="0,00"
                          />
                        </div>
                      ) : (
                        <span className="font-mono text-[#f2d892]">
                          {valorAtual > 0 ? fmtCur(valorAtual) : '—'}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className="font-mono font-semibold text-emerald-400">
                        {valorAPagar > 0 ? fmtCur(valorAPagar) : '—'}
                      </span>
                      {comissaoConcluida > 0 && (
                        <p className="mt-0.5 text-[0.62rem] text-[#d4bc9f]">
                          {fmtCur(fixoEfetivo)} fixo + {fmtCur(comissaoConcluida)} concluídas
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {canEdit ? (
                        <DateInput
                          className="!h-8 !min-h-8 !py-1 text-sm [&_input]:!h-8 [&_input]:!min-h-8 [&_button]:!h-8 [&_button]:!w-8"
                          value={draftData}
                          disabled={isSaving}
                          onChange={iso => setDraftsData(prev => ({
                            ...prev,
                            [row.montador_id]: iso ?? '',
                          }))}
                        />
                      ) : (
                        <span className="text-[#edd9c4]">
                          {row.primeiro_vencimento ? fmtDate(row.primeiro_vencimento) : '—'}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className="text-xs font-bold uppercase tracking-wider"
                        style={{ color: STATUS_COLOR[row.status_mes] }}
                      >
                        {STATUS_LABEL[row.status_mes]}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {canEdit && (
                        <button
                          type="button"
                          className="btn btn-outline btn-sm flex items-center gap-1"
                          disabled={isSaving}
                          onClick={() => void handleSave(row)}
                        >
                          <Save size={12} />
                          {isSaving ? 'Salvando...' : 'Salvar'}
                        </button>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
            <tfoot>
              <tr className="border-t border-[rgba(240,210,140,0.2)] bg-[rgba(240,210,140,0.04)]">
                <td className="px-4 py-3 text-xs font-bold uppercase tracking-wider text-[#f2d892]">
                  Total do mês
                </td>
                <td className="px-4 py-3 font-mono font-bold text-[#f2d892]">
                  {fmtCur(totais.fixo)}
                </td>
                <td className="px-4 py-3 font-mono font-bold text-emerald-400">
                  {fmtCur(totais.aPagar)}
                </td>
                <td className="px-4 py-3 text-[0.65rem] text-[#d4bc9f]" colSpan={3}>
                  {totais.comissao > 0 && (
                    <>
                      {fmtCur(totais.fixo)} fixo + {fmtCur(totais.comissao)} concluídas (a pagar)
                    </>
                  )}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  )
}
