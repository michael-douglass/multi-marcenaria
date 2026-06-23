import { useEffect, useState } from 'react'
import { Plus, Pencil, Trash2, Landmark, Wallet } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/button'
import { Field } from '@/components/ui/Field'
import { CaixaMesFilterBar } from '@/components/caixa/CaixaMesFilterBar'
import { useCaixaSaldoAlocacoes } from '@/hooks/useCaixaSaldoAlocacoes'
import { fmtCur, cn, parseMoneyBr } from '@/lib/utils'
import type { CaixaSaldoAlocacao } from '@/types'

interface SaldoDisponivelDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  mesInicial: number
  anoInicial: number
}

function monthLabel(mes: number, ano: number): string {
  return new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' }).format(
    new Date(ano, mes - 1, 1),
  )
}

export function SaldoDisponivelDialog({
  open,
  onOpenChange,
  mesInicial,
  anoInicial,
}: SaldoDisponivelDialogProps) {
  const [mes, setMes] = useState(mesInicial)
  const [ano, setAno] = useState(anoInicial)
  const [descricao, setDescricao] = useState('')
  const [valor, setValor] = useState('')
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [editing, setEditing] = useState<CaixaSaldoAlocacao | null>(null)

  const {
    alocacoes,
    contasGlobais,
    totalGlobalContas,
    saldoSistemaGlobal,
    totalPagoSistemaGlobal,
    saldoDisponivel,
    totalAlocado,
    diferenca,
    loading,
    loadingGlobal,
    error,
    adicionar,
    atualizar,
    remover,
  } = useCaixaSaldoAlocacoes(mes, ano)

  useEffect(() => {
    if (!open) return
    setMes(mesInicial)
    setAno(anoInicial)
    setEditing(null)
    setDescricao('')
    setValor('')
    setFormError(null)
  }, [open, mesInicial, anoInicial])

  const resetForm = () => {
    setEditing(null)
    setDescricao('')
    setValor('')
    setFormError(null)
  }

  const startEdit = (item: CaixaSaldoAlocacao) => {
    setEditing(item)
    setDescricao(item.descricao)
    setValor(String(item.valor))
    setFormError(null)
  }

  const handleSave = async () => {
    const valorNum = parseMoneyBr(valor)
    if (!descricao.trim()) {
      setFormError('Informe a descrição (banco, conta ou local).')
      return
    }
    if (!valorNum || valorNum <= 0) {
      setFormError('Informe um valor válido.')
      return
    }

    setSaving(true)
    setFormError(null)
    try {
      if (editing) {
        await atualizar(editing.id, descricao, valorNum)
      } else {
        await adicionar(descricao, valorNum)
      }
      resetForm()
    } catch {
      setFormError('Não foi possível salvar. Tente novamente.')
    } finally {
      setSaving(false)
    }
  }

  const handleRemove = async (item: CaixaSaldoAlocacao) => {
    const ok = confirm(`Remover "${item.descricao}" (${fmtCur(item.valor)})?`)
    if (!ok) return
    try {
      await remover(item.id)
      if (editing?.id === item.id) resetForm()
    } catch {
      alert('Erro ao remover alocação.')
    }
  }

  return (
    <Modal
      open={open}
      onClose={() => onOpenChange(false)}
      title="ONDE ESTÁ O SALDO"
      wide
      closeOnBackdrop={false}
      headerTop={
        <div className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-lg border border-emerald-500/25 bg-emerald-500/5 p-3 sm:p-4">
              <p className="text-[0.65rem] font-bold uppercase tracking-wider text-[#edd9c4]">
                Total em todas as contas (todos os meses)
              </p>
              {loadingGlobal ? (
                <p className="mt-1 text-lg font-bold text-emerald-400/60 animate-pulse">Carregando...</p>
              ) : contasGlobais.length === 0 ? (
                <p className="mt-1 text-sm text-[#edd9c4]">Nenhuma conta cadastrada ainda.</p>
              ) : (
                <p className="mt-1 text-2xl font-bold text-emerald-400">{fmtCur(totalGlobalContas)}</p>
              )}
            </div>

            <div className="rounded-lg border border-[#f2d892]/25 bg-[#f2d892]/5 p-3 sm:p-4">
              <p className="text-[0.65rem] font-bold uppercase tracking-wider text-[#edd9c4]">
                Saldo disponível reservado no sistema
              </p>
              {loadingGlobal ? (
                <p className="mt-1 text-lg font-bold text-[#f2d892]/60 animate-pulse">Carregando...</p>
              ) : (
                <>
                  <p className="mt-1 text-2xl font-bold text-[#f2d892]">{fmtCur(saldoSistemaGlobal)}</p>
                  <p className="mt-2 text-[0.65rem] uppercase tracking-wider text-[#edd9c4]">
                    Total pago no sistema
                  </p>
                  <p className="mt-0.5 text-sm font-semibold text-red-400/90">{fmtCur(totalPagoSistemaGlobal)}</p>
                </>
              )}
            </div>
          </div>

          {!loadingGlobal && contasGlobais.length > 0 && (
            <div className="rounded-lg border border-emerald-500/15 bg-emerald-500/[0.03] p-3 sm:p-4">
              <p className="mb-2 text-[0.6rem] font-bold uppercase tracking-wider text-[#edd9c4]">
                Detalhe por conta
              </p>
              <div className="flex flex-wrap gap-2">
                {contasGlobais.map(conta => (
                  <div
                    key={conta.descricao}
                    className="inline-flex items-center gap-2 rounded-md border border-white/10 bg-black/20 px-2.5 py-1.5"
                  >
                    <Landmark className="h-3.5 w-3.5 shrink-0 text-[#f2d892]" />
                    <span className="truncate text-xs font-medium text-cream max-w-[140px] sm:max-w-[180px]">
                      {conta.descricao}
                    </span>
                    <span className="shrink-0 text-xs font-bold text-emerald-400">
                      {fmtCur(conta.total)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      }
      headerExtra={
        <div className="space-y-3">
          <p className="text-xs text-[#edd9c4]">
            Registre em quais bancos ou contas o saldo disponível de{' '}
            <span className="text-cream font-semibold">{monthLabel(mes, ano)}</span> está guardado.
          </p>
          <CaixaMesFilterBar
            mes={mes}
            ano={ano}
            onChange={(m, a) => {
              setMes(m)
              setAno(a)
              resetForm()
            }}
          />
        </div>
      }
    >
      <div className="space-y-5">
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-3">
            <p className="text-[0.65rem] font-bold uppercase tracking-wider text-[#edd9c4]">
              Saldo disponível
            </p>
            <p className="mt-1 text-lg font-bold text-emerald-400">{fmtCur(saldoDisponivel)}</p>
          </div>
          <div className="rounded-lg border border-[#f2d892]/20 bg-[#f2d892]/5 p-3">
            <p className="text-[0.65rem] font-bold uppercase tracking-wider text-[#edd9c4]">
              Total guardado no banco
            </p>
            <p className="mt-1 text-lg font-bold text-[#f2d892]">{fmtCur(totalAlocado)}</p>
          </div>
          <div
            className={cn(
              'rounded-lg border p-3',
              Math.abs(diferenca) < 0.01
                ? 'border-emerald-500/20 bg-emerald-500/5'
                : diferenca > 0
                  ? 'border-amber-500/20 bg-amber-500/5'
                  : 'border-red-500/20 bg-red-500/5',
            )}
          >
            <p className="text-[0.65rem] font-bold uppercase tracking-wider text-[#edd9c4]">
              {Math.abs(diferenca) < 0.01
                ? 'Tudo justificado'
                : diferenca > 0
                  ? 'Sem justificar'
                  : 'Acima do saldo'}
            </p>
            <p
              className={cn(
                'mt-1 text-lg font-bold',
                Math.abs(diferenca) < 0.01
                  ? 'text-emerald-400'
                  : diferenca > 0
                    ? 'text-amber-400'
                    : 'text-red-400',
              )}
            >
              {Math.abs(diferenca) < 0.01 ? '✓' : fmtCur(Math.abs(diferenca))}
            </p>
          </div>
        </div>

        <div className="rounded-lg border border-white/10 bg-black/20 p-4 space-y-4">
          <h4 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#f2d892]">
            {editing ? <Pencil className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
            {editing ? 'Editar conta / banco' : 'Adicionar conta / banco'}
          </h4>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Descrição (banco, conta ou local)">
              <input
                className="glass-input w-full"
                value={descricao}
                onChange={e => setDescricao(e.target.value)}
                placeholder="Ex: Nubank, Caixa físico, Bradesco..."
              />
            </Field>
            <Field label="Valor (R$)">
              <input
                className="glass-input w-full"
                value={valor}
                onChange={e => setValor(e.target.value)}
                placeholder="0,00"
              />
            </Field>
          </div>
          {formError && <p className="text-sm text-red-400">{formError}</p>}
          <div className="flex justify-end gap-2">
            {editing && (
              <Button variant="ghost" size="sm" onClick={resetForm}>
                Cancelar edição
              </Button>
            )}
            <Button
              size="sm"
              className="bg-[#f2d892] text-[#2a1812] hover:bg-[#b88f44]"
              onClick={() => void handleSave()}
              disabled={saving}
            >
              {saving ? 'Salvando...' : editing ? 'Salvar alterações' : 'Adicionar'}
            </Button>
          </div>
        </div>

        {error && (
          <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-400">
            {error}
          </p>
        )}

        <div className="space-y-2">
          <h4 className="text-xs font-bold uppercase tracking-wider text-[#edd9c4]">
            Contas cadastradas — {monthLabel(mes, ano)}
          </h4>

          {loading ? (
            <div className="py-10 text-center text-sm text-[#edd9c4] animate-pulse">
              Carregando...
            </div>
          ) : alocacoes.length === 0 ? (
            <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-white/10 py-10 text-center">
              <Wallet className="h-8 w-8 text-[#edd9c4]/50" />
              <p className="text-sm text-[#edd9c4]">
                Nenhuma conta cadastrada para este mês.
              </p>
              <p className="text-xs text-[#edd9c4]/80">
                Adicione onde o dinheiro está guardado (banco, caixa, etc.).
              </p>
            </div>
          ) : (
            <div className="divide-y divide-white/5 rounded-lg border border-white/10 overflow-hidden">
              {alocacoes.map(item => (
                <div
                  key={item.id}
                  className="flex items-center gap-3 px-4 py-3 hover:bg-white/[0.02] transition-colors"
                >
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#f2d892]/10">
                    <Landmark className="h-4 w-4 text-[#f2d892]" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold text-cream text-sm">{item.descricao}</p>
                  </div>
                  <p className="shrink-0 font-bold text-emerald-400">{fmtCur(item.valor)}</p>
                  <div className="flex shrink-0 items-center gap-1">
                    <button
                      type="button"
                      className="btn btn-outline btn-sm !px-2"
                      title="Editar"
                      onClick={() => startEdit(item)}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      className="btn btn-danger btn-sm !px-2"
                      title="Remover"
                      onClick={() => void handleRemove(item)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </Modal>
  )
}
