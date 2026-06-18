import { buildComissaoItensFromObra, sumObraComissao } from '@/lib/obra-comissao'
import { fmtCur } from '@/lib/utils'
import type { ObraComissaoItem, ObraFull } from '@/types'

interface ObraComissaoFieldProps {
  obra: ObraFull | null
  habilitada: boolean
  itens: ObraComissaoItem[]
  montadorIds: string[]
  montadores: { id: string; nome?: string | null; email: string }[]
  locked: boolean
  onHabilitadaChange: (v: boolean) => void
  onItensChange: (itens: ObraComissaoItem[]) => void
}

export function ObraComissaoField({
  obra,
  habilitada,
  itens,
  montadorIds,
  montadores,
  locked,
  onHabilitadaChange,
  onItensChange,
}: ObraComissaoFieldProps) {
  const opcoes = buildComissaoItensFromObra(obra, montadorIds, montadores)

  const rows = opcoes.map(op => {
    const atual = itens.find(i => i.prestador_id === op.prestador_id)
    return {
      ...op,
      incluido: !!atual,
      valor: atual?.valor ?? 0,
    }
  })

  const total = sumObraComissao(itens)

  const toggleIncluido = (prestadorId: string, checked: boolean) => {
    const row = rows.find(r => r.prestador_id === prestadorId)
    if (!row) return
    if (!checked) {
      onItensChange(itens.filter(i => i.prestador_id !== prestadorId))
      return
    }
    if (itens.some(i => i.prestador_id === prestadorId)) return
    onItensChange([
      ...itens,
      { prestador_id: prestadorId, prestador_nome: row.prestador_nome, valor: 0 },
    ])
  }

  const setValor = (prestadorId: string, raw: string) => {
    const valor = raw === '' ? 0 : Math.max(0, Number(raw) || 0)
    onItensChange(
      itens.map(i =>
        i.prestador_id === prestadorId ? { ...i, valor } : i,
      ),
    )
  }

  return (
    <div className="obra-comissao-field rounded-lg border border-[rgba(240,210,140,0.18)] bg-[rgba(68,46,34,0.35)] p-3">
      <div className="flex items-center justify-between gap-3 mb-3">
        <p className="text-[0.72rem] font-semibold uppercase tracking-wider text-[#f2d892]">Comissão</p>
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            className="accent-[#f2d892]"
            checked={habilitada}
            disabled={locked}
            onChange={e => onHabilitadaChange(e.target.checked)}
          />
          <span className="text-xs text-[#c4a882]">Habilitar comissão</span>
        </label>
      </div>

      {locked && (
        <p className="text-[0.68rem] text-amber-400/90 mb-2">
          Pagamentos já gerados — comissão bloqueada para edição.
        </p>
      )}

      {habilitada && (
        <>
          {rows.length === 0 ? (
            <p className="text-xs text-[#edd9c4]">
              Selecione montadores responsáveis para definir os valores de comissão.
            </p>
          ) : (
            <>
              <p className="text-[0.65rem] text-[#edd9c4] mb-2">
                Marque o montador e informe o valor da comissão.
              </p>
              <div className="flex flex-col gap-2">
                {rows.map(row => (
                  <div
                    key={row.prestador_id}
                    className="flex flex-wrap items-center gap-2 rounded-lg border border-[rgba(240,210,140,0.12)] bg-[rgba(0,0,0,0.2)] px-3 py-2"
                  >
                    <label className="flex items-center gap-2 min-w-[140px] flex-1 cursor-pointer">
                      <input
                        type="checkbox"
                        className="accent-[#f2d892]"
                        checked={row.incluido}
                        disabled={locked}
                        onChange={e => toggleIncluido(row.prestador_id, e.target.checked)}
                      />
                      <span className="text-sm text-cream truncate">{row.prestador_nome}</span>
                    </label>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className="text-xs text-[#edd9c4]">R$</span>
                      <input
                        type="number"
                        min={0}
                        step="0.01"
                        className="glass-input !py-1 !px-2 w-[110px] text-sm"
                        value={row.incluido ? (row.valor > 0 ? row.valor : '') : ''}
                        disabled={locked || !row.incluido}
                        placeholder="0,00"
                        onChange={e => setValor(row.prestador_id, e.target.value)}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}

          <p className="mt-3 text-right text-sm font-semibold text-[#f2d892]">
            Total: {fmtCur(total)}
          </p>
        </>
      )}
    </div>
  )
}
