import { Field } from '@/components/ui/Field'
import type { FuncionarioAdmissaoDados } from '@/types'

/** Interpreta número em formato BR (ex.: "5,50" ou "1.234,56") ou US. */
export function parseValorBr(raw: string | undefined): number | null {
  if (!raw?.trim()) return null
  const cleaned = raw.trim().replace(/[R$\s]/gi, '')
  if (!cleaned) return null

  let normalized: string
  if (cleaned.includes(',') && cleaned.includes('.')) {
    // 1.234,56 → remove milhar, troca vírgula por ponto
    normalized = cleaned.replace(/\./g, '').replace(',', '.')
  } else if (cleaned.includes(',')) {
    normalized = cleaned.replace(',', '.')
  } else {
    normalized = cleaned
  }

  const n = Number(normalized)
  return Number.isFinite(n) ? n : null
}

export function formatValorBr(value: number): string {
  return value.toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

export function calcVtValorDiario(
  quantidade: string | undefined,
  valorUnitario: string | undefined,
): string | null {
  const qtd = parseValorBr(quantidade)
  const unit = parseValorBr(valorUnitario)
  if (qtd == null || unit == null) return null
  return formatValorBr(qtd * unit)
}

export type ValeTransporteFieldKey =
  | 'usa_vale_transporte'
  | 'vt_quantidade_dia'
  | 'vt_valor_unitario'
  | 'vt_valor_diario'

interface Props {
  dados: FuncionarioAdmissaoDados
  disabled?: boolean
  onChange: (key: ValeTransporteFieldKey, value: string | boolean) => void
  /** Quando true, aplica vários campos de uma vez (útil no save com total). */
  onPatch?: (patch: Partial<FuncionarioAdmissaoDados>) => void
}

export function ValeTransporteFields({ dados, disabled, onChange, onPatch }: Props) {
  const total = calcVtValorDiario(dados.vt_quantidade_dia, dados.vt_valor_unitario)

  const applyQtdOuValor = (
    key: 'vt_quantidade_dia' | 'vt_valor_unitario',
    value: string,
  ) => {
    const nextQtd = key === 'vt_quantidade_dia' ? value : (dados.vt_quantidade_dia ?? '')
    const nextUnit = key === 'vt_valor_unitario' ? value : (dados.vt_valor_unitario ?? '')
    const diario = calcVtValorDiario(nextQtd, nextUnit)

    if (onPatch) {
      onPatch({
        [key]: value,
        vt_valor_diario: diario ?? '',
      })
      return
    }

    onChange(key, value)
    onChange('vt_valor_diario', diario ?? '')
  }

  return (
    <div className="space-y-3">
      <label className="flex items-center gap-2 text-sm text-[#edd9c4]">
        <input
          type="checkbox"
          checked={!!dados.usa_vale_transporte}
          disabled={disabled}
          onChange={e => {
            const checked = e.target.checked
            if (onPatch) {
              onPatch({
                usa_vale_transporte: checked,
                ...(checked
                  ? {}
                  : {
                      vt_quantidade_dia: '',
                      vt_valor_unitario: '',
                      vt_valor_diario: '',
                    }),
              })
              return
            }
            onChange('usa_vale_transporte', checked)
            if (!checked) {
              onChange('vt_quantidade_dia', '')
              onChange('vt_valor_unitario', '')
              onChange('vt_valor_diario', '')
            }
          }}
        />
        Usa vale-transporte?
      </label>

      {dados.usa_vale_transporte && (
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Quantidade por dia">
            <input
              type="number"
              min={0}
              step={1}
              inputMode="numeric"
              className="glass-input"
              disabled={disabled}
              placeholder="Ex.: 2"
              value={dados.vt_quantidade_dia ?? ''}
              onChange={e => applyQtdOuValor('vt_quantidade_dia', e.target.value)}
            />
          </Field>
          <Field label="Valor (unitário)">
            <input
              className="glass-input"
              disabled={disabled}
              placeholder="Ex.: 5,50"
              value={dados.vt_valor_unitario ?? ''}
              onChange={e => applyQtdOuValor('vt_valor_unitario', e.target.value)}
            />
          </Field>
          <div className="sm:col-span-2 rounded-lg border border-[rgba(212,168,83,0.25)] bg-[rgba(0,0,0,0.2)] px-3 py-2 text-sm">
            <span className="text-[#b8957f]">Total do dia: </span>
            <span className="font-medium text-[#f2d892]">
              {total != null ? `R$ ${total}` : '—'}
            </span>
          </div>
        </div>
      )}
    </div>
  )
}
