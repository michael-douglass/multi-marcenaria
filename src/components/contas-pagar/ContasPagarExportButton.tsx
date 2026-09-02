import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Download } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Modal } from '@/components/ui/Modal'
import {
  buildContaPagarExportRow,
  buildContasPagarExportText,
  downloadContasPagarCsv,
  downloadContasPagarXls,
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
import { ContasPagarPanelStatusFilter } from '@/components/contas-pagar/ContasPagarPanelStatusFilter'
import type { ContaPagar, Fornecedor } from '@/types'

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
  const [textModalOpen, setTextModalOpen] = useState(false)
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

  const exportText = useMemo(
    () => buildContasPagarExportText(exportRows, periodLabel),
    [exportRows, periodLabel],
  )

  const validateExport = (): boolean => {
    if (needsMonth) {
      showToast('Selecione um mês ou período específico para exportar.', 'error')
      return false
    }
    if (exportRows.length === 0) {
      showToast('Marque pelo menos uma conta para exportar.', 'error')
      return false
    }
    return true
  }

  const runExport = (mode: 'csv' | 'xls' | 'pdf' | 'text') => {
    if (!validateExport()) return

    if (mode === 'csv') {
      downloadContasPagarCsv(exportRows, periodLabel)
      showToast(`Planilha CSV gerada com ${exportRows.length} conta(s).`)
      setOpen(false)
      return
    }

    if (mode === 'xls') {
      downloadContasPagarXls(exportRows, periodLabel)
      showToast(`Planilha XLS gerada com ${exportRows.length} conta(s).`)
      setOpen(false)
      return
    }

    if (mode === 'pdf') {
      imprimirContasPagarPdf(exportRows, periodLabel)
      showToast(`PDF aberto com ${exportRows.length} conta(s).`)
      setOpen(false)
      return
    }

    setOpen(false)
    setTextModalOpen(true)
  }

  const copyExportText = async () => {
    try {
      await navigator.clipboard.writeText(exportText)
      showToast('Texto copiado para a área de transferência.')
    } catch {
      showToast('Não foi possível copiar automaticamente. Selecione o texto e use Ctrl+C.', 'error')
    }
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
            background: '#f2d892', color: '#1a0f0a', borderRadius: 9999,
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
          className="cobrancas-action-panel absolute right-0 z-[200]"
          style={{ width: 340, top: 'calc(100% + 4px)' }}
        >
          <div className="cobrancas-action-panel__section">
            <p className="cobrancas-action-panel__label">Período atual</p>
            <p className="cobrancas-action-panel__period-value">{periodLabel}</p>
            {needsMonth && (
              <p className="cobrancas-action-panel__hint cobrancas-action-panel__hint--warn">
                Escolha um mês no filtro acima para exportar as despesas desse período.
              </p>
            )}
            {!needsMonth && statuses.has('pago') && (
              <p className="cobrancas-action-panel__hint">
                Inclui contas pagas neste período, mesmo que o vencimento seja em outro mês.
              </p>
            )}
          </div>

          <ContasPagarPanelStatusFilter
            activeKeys={statuses}
            onToggle={key => updateStatuses(prev => {
              const next = new Set(prev)
              if (next.has(key)) next.delete(key)
              else next.add(key)
              return next
            })}
          />

          <div className="cobrancas-action-panel__section">
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
            <label className="cobrancas-action-panel__select-all">
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
              />
              <span>Marcar todos ({listaFiltrada.length})</span>
            </label>
          )}

          <div className="cobrancas-action-panel__list">
            {listaFiltrada.length === 0 ? (
              <p className="cobrancas-action-panel__empty">Nenhuma conta encontrada.</p>
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
                  <label key={c.id} className="cobrancas-action-panel__list-row">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={e => updateSelectedIds(prev => {
                        const next = new Set(prev)
                        if (e.target.checked) next.add(c.id)
                        else next.delete(c.id)
                        return next
                      })}
                    />
                    <div className="min-w-0 flex-1">
                      <div className={`cobrancas-action-panel__list-title${checked ? '' : ' cobrancas-action-panel__list-title--muted'}`}>
                        {nome}
                      </div>
                      <div className="cobrancas-action-panel__list-meta">
                        {fmtCur(c.valor_parcela)} · {detalheData}
                      </div>
                    </div>
                    <Badge status={s} />
                  </label>
                )
              })
            )}
          </div>

          <div className="cobrancas-action-panel__footer">
            <span>
              {selectedIds.size} de {contas.length} selecionada(s)
            </span>
            {selectedIds.size > 0 && (
              <button
                type="button"
                className="cobrancas-action-panel__footer-action"
                onClick={() => updateSelectedIds(() => new Set())}
              >
                Limpar
              </button>
            )}
          </div>

          <div className="cobrancas-action-panel__actions">
            <button
              type="button"
              className="btn btn-gold btn-sm w-full"
              onClick={() => runExport('xls')}
              disabled={needsMonth || exportRows.length === 0}
            >
              Baixar planilha (XLS)
            </button>
            <button
              type="button"
              className="btn btn-outline btn-sm w-full"
              onClick={() => runExport('csv')}
              disabled={needsMonth || exportRows.length === 0}
            >
              Baixar planilha (CSV)
            </button>
            <button
              type="button"
              className="btn btn-outline btn-sm w-full"
              onClick={() => runExport('text')}
              disabled={needsMonth || exportRows.length === 0}
            >
              Copiar como texto
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

      <Modal
        open={textModalOpen}
        onClose={() => setTextModalOpen(false)}
        title="TEXTO PARA COPIAR"
        wide
      >
        <p className="mb-3 text-sm text-[#4a3428]">
          Selecione o texto abaixo ou use o botão copiar para colar em WhatsApp, e-mail ou outra planilha.
        </p>
        <textarea
          className="glass-input w-full font-mono text-xs leading-relaxed"
          readOnly
          value={exportText}
          rows={16}
          onFocus={e => e.target.select()}
          style={{ resize: 'vertical', minHeight: 280 }}
        />
        <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            className="btn btn-outline btn-sm"
            onClick={() => setTextModalOpen(false)}
          >
            Fechar
          </button>
          <button
            type="button"
            className="btn btn-gold btn-sm"
            onClick={() => void copyExportText()}
          >
            Copiar texto
          </button>
        </div>
      </Modal>
    </div>
  )
}
