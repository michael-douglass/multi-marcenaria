import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { erroMsg } from '@/components/master/master-utils'
import {
  useConsumoIaEmpresas,
  usePrecosIa,
  useSalvarPrecosIa,
  type PrecoIa,
} from '@/hooks/useMaster'
import { Numeros, Painel, Vazio } from '@/master/components/MasterUi'
import { cn } from '@/lib/utils'

export const usd = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 4 }).format(v)
export const tokensBR = (v: number) => new Intl.NumberFormat('pt-BR').format(Math.round(v))

/** "YYYY-MM" do input month → primeiro dia do mês para a RPC (undefined = mês atual). */
const mesParaRpc = (mes: string) => (/^\d{4}-\d{2}$/.test(mes) ? `${mes}-01` : undefined)

export function BarraUso({ usado, limite }: { usado: number; limite: number | null }) {
  if (limite == null) return <span className="text-[0.8rem] text-[var(--m-ink-2)]">sem limite</span>
  const pct = limite > 0 ? Math.min(100, (usado / limite) * 100) : 0
  const alerta = pct >= 80
  return (
    <div className="flex min-w-[9rem] items-center gap-2">
      <div
        className="h-1.5 flex-1 overflow-hidden rounded-full bg-[var(--m-line)]"
        role="progressbar"
        aria-valuenow={Math.round(pct)}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div className={cn('h-full rounded-full', alerta ? 'bg-[var(--m-total)]' : 'bg-[var(--m-accent)]')} style={{ width: `${pct}%` }} />
      </div>
      <span className={cn('m-num w-10 text-right text-[0.8rem]', alerta ? 'font-medium text-[var(--m-total)]' : 'text-[var(--m-ink-2)]')}>
        {Math.round(pct)}%
      </span>
    </div>
  )
}

/** Consumo de tokens do mês por empresa, com o limite efetivo (plano ou sobreposição da empresa). */
export function ConsumoIaPainel() {
  const [mes, setMes] = useState('')
  const { data = [], isLoading } = useConsumoIaEmpresas(mesParaRpc(mes))

  const resumo = useMemo(() => {
    const liberadas = data.filter((r) => r.funcao_liberada).length
    const acima = data.filter((r) => r.limite != null && r.limite > 0 && r.usado / r.limite >= 0.8).length
    return {
      tokens: data.reduce((s, r) => s + r.usado, 0),
      custo: data.reduce((s, r) => s + r.custo_usd, 0),
      liberadas,
      acima,
    }
  }, [data])

  return (
    <div className="space-y-6">
      <Numeros
        itens={[
          { rotulo: 'Tokens no mês', valor: tokensBR(resumo.tokens) },
          { rotulo: 'Custo estimado', valor: usd(resumo.custo), nota: 'conforme a tabela de preços' },
          { rotulo: 'Marcenarias com a função', valor: resumo.liberadas },
          { rotulo: 'Acima de 80% do limite', valor: resumo.acima, tom: resumo.acima ? 'alerta' : undefined },
        ]}
      />
      <Painel
        titulo="Consumo por marcenaria"
        descricao="Limite do plano, ou o ajuste da própria marcenaria quando houver. O mês vira à meia-noite de Brasília."
        acao={
          <label className="flex items-center gap-2 text-sm text-[var(--m-ink-2)]">
            Mês
            <Input type="month" value={mes} onChange={(e) => setMes(e.target.value)} className="h-9 w-[10.5rem]" aria-label="Mês do consumo" />
          </label>
        }
        corpoClassName="p-0"
      >
        {isLoading ? (
          <Vazio>Carregando…</Vazio>
        ) : data.length === 0 ? (
          <Vazio>Nenhuma marcenaria.</Vazio>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-[0.78rem] text-[var(--m-ink-2)]">
                <tr className="border-b border-[var(--m-line)]">
                  <th className="px-5 py-2.5 font-medium">Marcenaria</th>
                  <th className="px-5 py-2.5 font-medium">Plano</th>
                  <th className="px-5 py-2.5 font-medium">Função</th>
                  <th className="px-5 py-2.5 text-right font-medium">Tokens</th>
                  <th className="px-5 py-2.5 font-medium">Limite</th>
                  <th className="px-5 py-2.5 text-right font-medium">Custo</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--m-line)]">
                {data.map((r) => (
                  <tr key={r.empresa_id}>
                    <td className="px-5 py-2.5">
                      <Link to={`/master/empresas/${r.empresa_id}`} className="font-medium text-[var(--m-ink)] hover:underline">
                        {r.nome}
                      </Link>
                    </td>
                    <td className="px-5 py-2.5 text-[var(--m-ink-2)]">{r.plano_nome ?? 'Sem plano'}</td>
                    <td className="px-5 py-2.5 text-[var(--m-ink-2)]">{r.funcao_liberada ? 'Ligada' : 'Desligada'}</td>
                    <td className="m-num px-5 py-2.5 text-right text-[var(--m-ink)]">{tokensBR(r.usado)}</td>
                    <td className="px-5 py-2.5">
                      <div className="flex items-center gap-2">
                        <BarraUso usado={r.usado} limite={r.limite} />
                        {r.limite != null ? <span className="m-num text-[0.78rem] text-[var(--m-ink-2)]">de {tokensBR(r.limite)}</span> : null}
                      </div>
                    </td>
                    <td className="m-num px-5 py-2.5 text-right text-[var(--m-ink-2)]">{usd(r.custo_usd)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Painel>
    </div>
  )
}

/** Tabela de preços por modelo — só estima o custo; não afeta o limite de tokens. */
export function PrecosIaPainel() {
  const { data: precos = [], isLoading } = usePrecosIa()
  const salvar = useSalvarPrecosIa()
  const [form, setForm] = useState<PrecoIa[]>([])
  useEffect(() => setForm(precos), [precos])
  const sujo = JSON.stringify(form) !== JSON.stringify(precos)

  const mudar = (modelo: string, campo: keyof Omit<PrecoIa, 'modelo'>, v: string) =>
    setForm((f) => f.map((p) => (p.modelo === modelo ? { ...p, [campo]: Math.max(0, Number(v) || 0) } : p)))

  return (
    <Painel
      titulo="Preços por modelo (US$)"
      descricao="Só para estimar o custo na tabela de consumo; não afeta o limite de tokens. Preencha com os valores atuais da OpenAI."
      acao={
        <Button
          disabled={!sujo || salvar.isPending}
          onClick={async () => {
            try {
              await salvar.mutateAsync(form)
              toast.success('Preços salvos.')
            } catch (err) {
              toast.error(erroMsg(err, 'Não foi possível salvar os preços'))
            }
          }}
        >
          {salvar.isPending ? 'Salvando…' : 'Salvar preços'}
        </Button>
      }
      corpoClassName="p-0"
    >
      {isLoading ? (
        <Vazio>Carregando…</Vazio>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-[0.78rem] text-[var(--m-ink-2)]">
              <tr className="border-b border-[var(--m-line)]">
                <th className="px-5 py-2.5 font-medium">Modelo</th>
                <th className="px-5 py-2.5 font-medium">Entrada (por 1 mi tokens)</th>
                <th className="px-5 py-2.5 font-medium">Saída (por 1 mi tokens)</th>
                <th className="px-5 py-2.5 font-medium">Por imagem</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--m-line)]">
              {form.map((p) => (
                <tr key={p.modelo}>
                  <td className="m-num px-5 py-2 font-medium text-[var(--m-ink)]">{p.modelo}</td>
                  {(['usd_por_milhao_entrada', 'usd_por_milhao_saida', 'usd_por_imagem'] as const).map((c) => (
                    <td key={c} className="px-5 py-2">
                      <Input
                        type="number"
                        min={0}
                        step="0.0001"
                        value={p[c]}
                        onChange={(e) => mudar(p.modelo, c, e.target.value)}
                        className="h-9 w-32"
                        aria-label={`${p.modelo}: ${c}`}
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Painel>
  )
}
