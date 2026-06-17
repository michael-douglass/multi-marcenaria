import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Download } from 'lucide-react'
import { Badge } from '@/components/ui/Badge'
import {
  buildContaPagarExportRow,
  downloadContasPagarCsv,
  formatPeriodFilterLabel,
  imprimirContasPagarPdf,
  periodFilterRequiresMonth,
} from '@/lib/contas-pagar-export'
import { contaNoPeriodoExport, getDataReferenciaPagamento } from '@/lib/contas-pagar-valores'
import {
  getPeriodStorageKey,
  loadExportSelection,
  resolveSelectedIds,
  saveExportSelection,
} from '@/lib/contas-pagar-export-selection'
import { fmtCur, fmtDate } from '@/lib/utils'
import { showToast } from '@/lib/toast'
import type { PeriodFilter } from '@/components/ui/PeriodFilterBar'
import type { ContaPagar, Fornecedor } from '@/types'

const STATUS_OPTIONS = [
  { key: 'todos', label: 'Todos' },
  { key: 'pago', label: 'Pagas' },
  { key: 'pendente', label: 'Pendentes' },
  { key: 'vencido', label: 'Vencidos' },
  { key: 'parcialmente_pago', label: 'Parc. Pagas' },
] as const

interface ContasPagarExportButtonProps {
  todasContas: ContaPagar[]
  fornecedores: Fornecedor[]
  periodFilter: PeriodFilter
  getStatus: (vencimento: string, status: string) => string
}

export function ContasPagarExportButton({
  todasContas,
  fornecedores,
  periodFilter,
  getStatus,
}: ContasPagarExportButtonProps) {
  const contas = useMemo(
    () => todasContas.filter(c => contaNoPeriodoExport(c, periodFilter)),
    [todasContas, periodFilter],
  )
  const [open, setOpen] = useState(false)
  const [statuses, setStatuses] = useState<Set<string>>(new Set())
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [busca, setBusca] = useState('')
  const ref = useRef<HTMLDivElement>(null)
  const selectedIdsRef = useRef(selectedIds)
  const statusesRef = useRef(statuses)
  selectedIdsRef.current = selectedIds
  statusesRef.current = statuses

  const periodKey = useMemo(() => getPeriodStorageKey(periodFilter), [periodFilter])
  const periodLabel = formatPeriodFilterLabel(periodFilter)
  const needsMonth = periodFilterRequiresMonth(periodFilter)

  const persistSelection = useCallback((
    nextSelected: Set<string>,
    nextStatuses: Set<string>,
  ) => {
    const ids = contas.map(c => c.id)
    saveExportSelection(periodKey, {
      selectedIds: ids.filter(id => nextSelected.has(id)),
      allSelected: nextSelected.size === ids.length && ids.length > 0,
      statuses: [...nextStatuses],
    })
  }, [contas, periodKey])

  const updateSelectedIds = useCallback((
    updater: (prev: Set<string>) => Set<string>,
  ) => {
    setSelectedIds(prev => {
      const next = updater(prev)
      persistSelection(next, statusesRef.current)
      return next
    })
  }, [persistSelection])

  const updateStatuses = useCallback((
    updater: (prev: Set<string>) => Set<string>,
  ) => {
    setStatuses(prev => {
      const next = updater(prev)
      persistSelection(selectedIdsRef.current, next)
      return next
    })
  }, [persistSelection])

  useEffect(() => {
    const ids = contas.map(c => c.id)
    const saved = loadExportSelection(periodKey)
    setSelectedIds(resolveSelectedIds(ids, saved))
    setStatuses(saved?.statuses.length ? new Set(saved.statuses) : new Set())
  }, [periodKey, contas])

  useEffect(() => {
    const handle = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [])

  const listaFiltrada = useMemo(() => {
    let items = contas

    if (statuses.size > 0 && !statuses.has('todos')) {
      items = items.filter(c => statuses.has(getStatus(c.data_vencimento, c.status)))
    }

    const term = busca.trim().toLowerCase().replace(/[\s.,]/g, '')
    if (term) {
      items = items.filter(c => {
        const nome = (
          c.fornecedor_nome
          ?? fornecedores.find(f => f.id === c.fornecedor_id)?.nome
          ?? c.descricao
          ?? ''
        ).toLowerCase().replace(/[\s.,]/g, '')
        const desc = (c.descricao ?? '').toLowerCase().replace(/[\s.,]/g, '')
        return nome.includes(term) || desc.includes(term)
      })
    }

    return items
  }, [contas, statuses, busca, fornecedores, getStatus])

  const selectedContas = useMemo(
    () => contas.filter(c => selectedIds.has(c.id)),
    [contas, selectedIds],
  )

  const exportRows = useMemo(
    () => selectedContas.map(c => buildContaPagarExportRow(c, fornecedores, getStatus)),
    [selectedContas, fornecedores, getStatus],
  )

  const runExport = (mode: 'csv' | 'pdf') => {
    if (needsMonth) {
      showToast('Selecione um mês ou período específico para exportar.', 'error')
      return
    }
    if (exportRows.length === 0) {
      showToast('Marque pelo menos uma conta para exportar.', 'error')
      return
    }

    if (mode === 'csv') {
      downloadContasPagarCsv(exportRows, periodLabel)
      showToast(`Planilha gerada com ${exportRows.length} conta(s).`)
    } else {
      imprimirContasPagarPdf(exportRows, periodLabel)
      showToast(`PDF aberto com ${exportRows.length} conta(s).`)
    }
    setOpen(false)
  }

  return (
    <div ref={ref} className="relative mb-4 shrink-0">
      <button
        type="button"
        className="btn btn-outline btn-sm flex items-center gap-1.5"
        onClick={() => setOpen(prev => !prev)}
        style={{ whiteSpace: 'nowrap' }}
      >
        <Download className="h-3.5 w-3.5" />
        <span>Exportar</span>
        {selectedIds.size > 0 && selectedIds.size < contas.length && (
          <span style={{
            background: '#d4a853', color: '#1a0f0a', borderRadius: 9999,
            fontSize: '.65rem', fontWeight: 700, padding: '0 .4rem',
            lineHeight: '1.35rem', minWidth: '1.35rem', textAlign: 'center' as const,
          }}>
            {selectedIds.size}
          </span>
        )}
        <span style={{ opacity: .5, fontSize: '.7rem' }}>{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div
          className="absolute right-0 z-[200] rounded-lg border border-[rgba(212,168,83,.2)]"
          style={{ background: '#1a0f0a', boxShadow: '0 8px 32px rgba(0,0,0,.7)', width: 340, top: 'calc(100% + 4px)' }}
        >
          <div className="px-3 pt-3 pb-2 border-b border-[rgba(212,168,83,.1)]">
            <div className="section-label mb-1" style={{ fontSize: '.7rem' }}>Período atual</div>
            <div style={{ color: '#f4e4d6', fontSize: '.85rem', fontWeight: 600 }}>{periodLabel}</div>
            {needsMonth && (
              <p className="mt-2 text-xs text-[#f87171]">
                Escolha um mês no filtro acima para exportar as despesas desse período.
              </p>
            )}
            {!needsMonth && statuses.has('pago') && (
              <p className="mt-2 text-xs text-[#8a6a55]">
                Inclui contas pagas neste período, mesmo que o vencimento seja em outro mês.
              </p>
            )}
          </div>

          <div className="px-3 pt-3 pb-2 border-b border-[rgba(212,168,83,.1)]">
            <div className="section-label mb-2" style={{ fontSize: '.7rem' }}>Filtrar lista por status</div>
            <div className="flex flex-wrap gap-1.5">
              {STATUS_OPTIONS.map(opt => {
                const active = statuses.has(opt.key)
                return (
                  <button
                    key={opt.key}
                    type="button"
                    onClick={() => updateStatuses(prev => {
                      const next = new Set(prev)
                      if (active) next.delete(opt.key)
                      else next.add(opt.key)
                      return next
                    })}
                    style={{
                      padding: '.2rem .55rem', borderRadius: 9999,
                      border: active ? '1px solid #d4a853' : '1px solid rgba(212,168,83,.2)',
                      background: active ? 'rgba(212,168,83,.14)' : 'transparent',
                      color: active ? '#d4a853' : '#8a6a55',
                      cursor: 'pointer', fontSize: '.75rem', fontWeight: 600,
                      fontFamily: 'Raleway, sans-serif', transition: 'all .15s',
                    }}
                  >
                    {active ? '✕ ' : ''}{opt.label}
                  </button>
                )
              })}
            </div>
          </div>

          <div className="px-3 py-2 border-b border-[rgba(212,168,83,.1)]">
            <input
              type="text"
              className="glass-input w-full"
              placeholder="Buscar conta específica..."
              value={busca}
              onChange={e => setBusca(e.target.value)}
              style={{ fontSize: '.82rem', padding: '.4rem .7rem' }}
            />
          </div>

          {listaFiltrada.length > 0 && (
            <div className="px-3 py-1.5 border-b border-[rgba(212,168,83,.08)] flex items-center gap-2">
              <input
                type="checkbox"
                ref={el => {
                  if (!el) return
                  const allChecked = listaFiltrada.every(c => selectedIds.has(c.id))
                  const someChecked = listaFiltrada.some(c => selectedIds.has(c.id))
                  el.checked = allChecked
                  el.indeterminate = someChecked && !allChecked
                }}
                onChange={e => updateSelectedIds(prev => {
                  const next = new Set(prev)
                  if (e.target.checked) listaFiltrada.forEach(c => next.add(c.id))
                  else listaFiltrada.forEach(c => next.delete(c.id))
                  return next
                })}
                style={{ accentColor: '#d4a853', flexShrink: 0 }}
              />
              <span style={{ color: '#8a6a55', fontSize: '.78rem', fontWeight: 600, fontFamily: 'Raleway, sans-serif' }}>
                Marcar todos ({listaFiltrada.length})
              </span>
            </div>
          )}

          <div style={{ maxHeight: 320, overflowY: 'auto' }}>
            {listaFiltrada.length === 0 ? (
              <div className="px-3 py-3 text-sm text-[#8a6a55]">Nenhuma conta encontrada.</div>
            ) : (
              listaFiltrada.map(c => {
                const s = getStatus(c.data_vencimento, c.status)
                const nome = c.fornecedor_nome ?? fornecedores.find(x => x.id === c.fornecedor_id)?.nome ?? c.descricao ?? '—'
                const checked = selectedIds.has(c.id)
                const dataPagamento = getDataReferenciaPagamento(c)
                const detalheData = s === 'pago' && dataPagamento
                  ? `Pago em ${fmtDate(dataPagamento)} · Venc. ${fmtDate(c.data_vencimento)}`
                  : `Venc. ${fmtDate(c.data_vencimento)}`
                return (
                  <label
                    key={c.id}
                    className="flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-[rgba(212,168,83,.05)]"
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={e => updateSelectedIds(prev => {
                        const next = new Set(prev)
                        if (e.target.checked) next.add(c.id)
                        else next.delete(c.id)
                        return next
                      })}
                      style={{ accentColor: '#d4a853', flexShrink: 0 }}
                    />
                    <div className="flex-1 min-w-0">
                      <div style={{
                        color: checked ? '#f4e4d6' : '#8a6a55',
                        fontSize: '.82rem', overflow: 'hidden',
                        textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      }}>
                        {nome}
                      </div>
                      <div style={{ color: '#8a6a55', fontSize: '.7rem' }}>
                        {fmtCur(c.valor_parcela)} · {detalheData}
                      </div>
                    </div>
                    <Badge status={s} />
                  </label>
                )
              })
            )}
          </div>

          <div className="px-3 py-2 border-t border-[rgba(212,168,83,.1)] flex items-center justify-between gap-2">
            <span style={{ fontSize: '.75rem', color: '#8a6a55' }}>
              {selectedIds.size} de {contas.length} selecionada(s)
            </span>
            {selectedIds.size > 0 && (
              <button
                type="button"
                onClick={() => updateSelectedIds(() => new Set())}
                style={{ color: '#f87171', fontSize: '.75rem', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'Raleway, sans-serif' }}
              >
                Limpar
              </button>
            )}
          </div>

          <div className="px-3 pb-3 pt-1 flex flex-col gap-2">
            <button
              type="button"
              className="btn btn-gold btn-sm w-full"
              onClick={() => runExport('csv')}
              disabled={needsMonth || exportRows.length === 0}
            >
              Baixar planilha (CSV)
            </button>
            <button
              type="button"
              className="btn btn-outline btn-sm w-full"
              onClick={() => runExport('pdf')}
              disabled={needsMonth || exportRows.length === 0}
            >
              Imprimir / salvar PDF
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
