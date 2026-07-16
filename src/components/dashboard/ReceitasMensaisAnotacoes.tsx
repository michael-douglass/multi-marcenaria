import { cn, fmtCur } from '@/lib/utils'

interface MesValor {
  mes: string
  valor: number
}

interface MensalValoresAnotacoesProps {
  ano: number
  data: MesValor[]
  titulo: string
  subtitulo: string
  vazioLabel: string
  /** Cor dos valores (receitas = verde, despesas = coral). */
  tom?: 'emerald' | 'rose'
}

/** Lista valor por mês + total do ano (receitas ou despesas). */
export function MensalValoresAnotacoes({
  ano,
  data,
  titulo,
  subtitulo,
  vazioLabel,
  tom = 'emerald',
}: MensalValoresAnotacoesProps) {
  const mesesComValor = data.filter(m => m.valor > 0)
  const total = data.reduce((s, m) => s + m.valor, 0)
  const valorClass = tom === 'rose' ? 'text-red-400' : 'text-emerald-400'
  const totalBg =
    tom === 'rose' ? 'bg-red-500/10 border-[rgba(248,113,113,0.25)]' : 'bg-[rgba(52,211,153,0.08)] border-[rgba(240,210,140,0.22)]'

  if (mesesComValor.length === 0) {
    return (
      <div className="mt-4 rounded-lg border border-[rgba(240,210,140,0.12)] bg-[rgba(0,0,0,0.22)] px-4 py-5 text-center">
        <p className="text-[11px] uppercase tracking-[0.16em] text-[#edd9c4]/65">
          {vazioLabel} {ano}
        </p>
      </div>
    )
  }

  return (
    <div className="mt-5 space-y-3">
      <div>
        <p className="font-display text-base tracking-[0.14em] text-[#f2d892]">
          {titulo} · {ano}
        </p>
        <p className="mt-0.5 text-[10px] uppercase tracking-[0.14em] text-[#edd9c4]/60">
          {subtitulo}
        </p>
      </div>

      <ul className="overflow-hidden rounded-lg border border-[rgba(240,210,140,0.12)] bg-[rgba(0,0,0,0.28)]">
        {mesesComValor.map((m, i) => (
          <li
            key={m.mes}
            className={cn(
              'dash-card-enter flex items-center justify-between gap-3 px-3.5 py-2.5',
              i > 0 && 'border-t border-[rgba(240,210,140,0.08)]',
            )}
            style={{ animationDelay: `${i * 30}ms` }}
          >
            <span className="font-display text-base tracking-[0.08em] text-[#f2d892]">
              {m.mes}
            </span>
            <span className={cn('text-sm font-semibold tabular-nums', valorClass)}>
              {fmtCur(m.valor)}
            </span>
          </li>
        ))}

        <li className={cn('flex items-center justify-between gap-3 border-t px-3.5 py-3', totalBg)}>
          <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#edd9c4]">
            Total {ano}
          </span>
          <span className={cn('font-display text-xl tracking-[0.04em] tabular-nums', valorClass)}>
            {fmtCur(total)}
          </span>
        </li>
      </ul>
    </div>
  )
}

/** Atalho: receitas por mês. */
export function ReceitasMensaisAnotacoes({ ano, data }: { ano: number; data: MesValor[] }) {
  return (
    <MensalValoresAnotacoes
      ano={ano}
      data={data}
      titulo="RECEITAS POR MÊS"
      subtitulo="Valor recebido em cada mês"
      vazioLabel="Sem receitas registradas em"
      tom="emerald"
    />
  )
}

/** Atalho: despesas por mês. */
export function DespesasMensaisAnotacoes({ ano, data }: { ano: number; data: MesValor[] }) {
  return (
    <MensalValoresAnotacoes
      ano={ano}
      data={data}
      titulo="DESPESAS POR MÊS"
      subtitulo="Valor pago das contas com vencimento em cada mês"
      vazioLabel="Sem despesas registradas em"
      tom="rose"
    />
  )
}
