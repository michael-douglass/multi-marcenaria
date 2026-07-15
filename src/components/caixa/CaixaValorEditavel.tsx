import { useEffect, useRef, useState } from 'react'
import { cn, fmtCur, parseMoneyBr } from '@/lib/utils'

interface CaixaValorEditavelProps {
  valor: number
  /** Quando false, só exibe o valor (sem edição). */
  editavel?: boolean
  className?: string
  emptyLabel?: string
  title?: string
  onSave: (novoValor: number) => Promise<void>
}

/**
 * Célula clicável: o número vira um campo para digitar.
 * Enter ou sair do campo salva; Escape cancela.
 */
export function CaixaValorEditavel({
  valor,
  editavel = true,
  className,
  emptyLabel,
  title = 'Clique para editar',
  onSave,
}: CaixaValorEditavelProps) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')
  const [saving, setSaving] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const cancelledRef = useRef(false)
  const committingRef = useRef(false)

  useEffect(() => {
    if (!editing) return
    inputRef.current?.focus()
    inputRef.current?.select()
  }, [editing])

  const display =
    emptyLabel != null && valor <= 0
      ? emptyLabel
      : fmtCur(valor)

  const startEdit = () => {
    if (!editavel || saving) return
    cancelledRef.current = false
    committingRef.current = false
    setDraft(
      valor.toLocaleString('pt-BR', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }),
    )
    setEditing(true)
  }

  const cancel = () => {
    cancelledRef.current = true
    setEditing(false)
    setDraft('')
  }

  const commit = async () => {
    if (cancelledRef.current || committingRef.current || saving) return
    committingRef.current = true

    const parsed = parseMoneyBr(draft)
    if (!Number.isFinite(parsed) || parsed < 0) {
      committingRef.current = false
      alert('Informe um valor válido (zero ou positivo).')
      inputRef.current?.focus()
      return
    }

    const novo = Math.round(parsed * 100) / 100
    if (Math.abs(novo - valor) <= 0.009) {
      setEditing(false)
      committingRef.current = false
      return
    }

    setSaving(true)
    try {
      await onSave(novo)
      setEditing(false)
    } catch (err) {
      committingRef.current = false
      alert(err instanceof Error ? err.message : 'Não foi possível salvar o valor.')
      inputRef.current?.focus()
    } finally {
      setSaving(false)
    }
  }

  if (!editavel) {
    return <span className={className}>{display}</span>
  }

  if (editing) {
    return (
      <input
        ref={inputRef}
        type="text"
        inputMode="decimal"
        disabled={saving}
        value={draft}
        aria-label="Editar valor"
        className={cn(
          'ml-auto w-[7.5rem] rounded border border-white/15 bg-white/5 px-2 py-1 text-right text-[0.85rem] font-semibold outline-none',
          'focus:border-[#f2d892]/60 focus:ring-1 focus:ring-[#f2d892]/30',
          'disabled:opacity-60',
          className,
        )}
        onChange={e => setDraft(e.target.value)}
        onKeyDown={e => {
          if (e.key === 'Enter') {
            e.preventDefault()
            void commit()
          }
          if (e.key === 'Escape') {
            e.preventDefault()
            cancel()
          }
        }}
        onBlur={() => {
          void commit()
        }}
      />
    )
  }

  return (
    <button
      type="button"
      title={title}
      disabled={saving}
      onClick={startEdit}
      className={cn(
        'ml-auto block w-full cursor-pointer rounded px-1 py-0.5 text-right transition-colors',
        'hover:bg-white/[0.06] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#f2d892]/40',
        'disabled:cursor-wait disabled:opacity-60',
        className,
      )}
    >
      {display}
    </button>
  )
}
