import { useEffect, useState } from 'react'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { erroMsg, dataBR } from '@/components/master/master-utils'
import {
  useConsumoIaEmpresa,
  useLimiteIaEmpresa,
  usePaginasEmpresa,
  usePlanos,
  useSalvarLimiteIaEmpresa,
  useUsoIaRecente,
} from '@/hooks/useMaster'
import { FUNCAO_IA_CARD_LEAD } from '@/lib/paginas-catalogo'
import { Numeros, Painel, Vazio } from '@/master/components/MasterUi'
import { BarraUso, tokensBR, usd } from '@/master/components/ia/ConsumoIaPainel'

type Modo = 'plano' | 'personalizado' | 'sem_limite'

const ROTULO_FUNCAO: Record<string, string> = {
  render_projeto: 'Render de projeto',
  render_ambiente_analise: 'Ambiente: análise',
  render_ambiente: 'Render de ambiente',
  render_edicao: 'Edição pontual',
}

/** Aba "IA e tokens" da marcenaria: estado da função, limite e consumo. */
export function IaEmpresaPainel({ empresaId, onAbrirPaginas }: { empresaId: string; onAbrirPaginas: () => void }) {
  const { data: paginas } = usePaginasEmpresa(empresaId)
  const { data: planos = [] } = usePlanos()
  const { data: detalhe } = useConsumoIaEmpresa(empresaId, 6)
  const { data: usos = [] } = useUsoIaRecente(empresaId)
  const { data: limiteEmpresa } = useLimiteIaEmpresa(empresaId)
  const salvar = useSalvarLimiteIaEmpresa()

  const [modo, setModo] = useState<Modo>('plano')
  const [limite, setLimite] = useState('')
  useEffect(() => {
    if (!limiteEmpresa) return
    setModo(limiteEmpresa.modo)
    setLimite(limiteEmpresa.limite == null ? '' : String(limiteEmpresa.limite))
  }, [limiteEmpresa])

  const plano = planos.find((p) => p.id === paginas?.plano_id)
  const limitePlano = plano?.ia_tokens_limite_mensal ?? null
  const liberada = paginas ? !paginas.bloqueadas.includes(FUNCAO_IA_CARD_LEAD) : false
  const origemAjuste = paginas ? FUNCAO_IA_CARD_LEAD in paginas.ajustes : false
  const semPlano = !!paginas && !paginas.plano_id

  const limiteEfetivo = modo === 'sem_limite' ? null : modo === 'personalizado' ? Number(limite) || null : limitePlano
  const mesAtual = detalhe?.meses[detalhe.meses.length - 1]
  const usado = mesAtual?.tokens ?? 0

  const grafico = (detalhe?.meses ?? []).map((m) => ({ mes: m.mes, tokens: Number(m.tokens) }))
  const sujo = !!limiteEmpresa && (modo !== limiteEmpresa.modo || (modo === 'personalizado' && (Number(limite) || null) !== limiteEmpresa.limite))

  return (
    <div className="space-y-6">
      <Numeros
        itens={[
          { rotulo: 'Função “IA no card lead”', valor: liberada ? 'Ligada' : 'Desligada', nota: origemAjuste ? 'ajuste desta marcenaria' : plano ? `plano ${plano.nome}` : 'sem plano' },
          { rotulo: 'Tokens no mês', valor: tokensBR(usado) },
          { rotulo: 'Limite no mês', valor: limiteEfetivo == null ? 'Sem limite' : tokensBR(limiteEfetivo) },
          { rotulo: 'Custo estimado no mês', valor: usd(Number(mesAtual?.custo_usd ?? 0)) },
        ]}
      />

      {semPlano && !origemAjuste ? (
        <p role="note" className="rounded-md border border-[#e0a54a] bg-[#fff1d6] px-4 py-3 text-sm text-[#4a2c00]">
          Esta marcenaria não tem plano: a IA do card do lead só funciona com liberação explícita na aba Páginas.
        </p>
      ) : null}

      <Painel
        titulo="Limite de tokens"
        descricao="Por padrão vale o limite do plano. Use o ajuste para liberar mais (ou menos) só para esta marcenaria."
        acao={
          <div className="flex gap-2">
            <Button variant="outline" onClick={onAbrirPaginas}>Páginas e funções</Button>
            <Button
              disabled={!sujo || salvar.isPending || (modo === 'personalizado' && !(Number(limite) > 0))}
              onClick={async () => {
                try {
                  await salvar.mutateAsync({ empresaId, modo, limite: modo === 'personalizado' ? Number(limite) : null })
                  toast.success('Limite da marcenaria salvo.')
                } catch (err) {
                  toast.error(erroMsg(err, 'Não foi possível salvar o limite'))
                }
              }}
            >
              {salvar.isPending ? 'Salvando…' : 'Salvar limite'}
            </Button>
          </div>
        }
      >
        <fieldset className="space-y-3">
          <legend className="sr-only">Modo do limite</legend>
          {(
            [
              ['plano', `Seguir o plano (${limitePlano == null ? 'sem limite' : `${tokensBR(limitePlano)} tokens/mês`})`],
              ['personalizado', 'Limite próprio'],
              ['sem_limite', 'Sem limite'],
            ] as Array<[Modo, string]>
          ).map(([v, t]) => (
            <label key={v} className="flex min-h-10 items-center gap-2.5 text-sm text-[var(--m-ink)]">
              <input type="radio" name={`modo-ia-${empresaId}`} checked={modo === v} onChange={() => setModo(v)} className="h-4 w-4 accent-[var(--m-accent)]" />
              {t}
              {v === 'personalizado' ? (
                <Input
                  type="number"
                  min={1}
                  inputMode="numeric"
                  value={limite}
                  disabled={modo !== 'personalizado'}
                  onChange={(e) => setLimite(e.target.value)}
                  placeholder="tokens/mês"
                  aria-label="Limite próprio em tokens por mês"
                  className="ml-2 h-9 w-40"
                />
              ) : null}
            </label>
          ))}
        </fieldset>
        <div className="mt-4 max-w-[26rem]">
          <p className="mb-1 text-[0.8rem] text-[var(--m-ink-2)]">Uso no mês</p>
          <BarraUso usado={usado} limite={limiteEfetivo} />
        </div>
      </Painel>

      <Painel titulo="Últimos 6 meses" descricao="Tokens consumidos por mês.">
        {grafico.every((g) => g.tokens === 0) ? (
          <Vazio>Nenhum uso registrado.</Vazio>
        ) : (
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={grafico} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke="var(--m-line)" />
                <XAxis dataKey="mes" tickLine={false} axisLine={false} fontSize={12} stroke="var(--m-ink-2)" />
                <YAxis tickLine={false} axisLine={false} fontSize={12} width={64} stroke="var(--m-ink-2)" tickFormatter={(v: number) => tokensBR(v)} />
                <Tooltip formatter={(v) => `${tokensBR(Number(v))} tokens`} cursor={{ fill: 'var(--m-accent-soft)' }} />
                <Bar dataKey="tokens" name="Tokens" fill="var(--m-accent)" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </Painel>

      <Painel titulo="Últimos usos" corpoClassName="p-0">
        {usos.length === 0 ? (
          <Vazio>Nenhum uso registrado.</Vazio>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-[0.78rem] text-[var(--m-ink-2)]">
                <tr className="border-b border-[var(--m-line)]">
                  <th className="px-5 py-2.5 font-medium">Quando</th>
                  <th className="px-5 py-2.5 font-medium">Função</th>
                  <th className="px-5 py-2.5 font-medium">Modelo</th>
                  <th className="px-5 py-2.5 font-medium">Lead</th>
                  <th className="px-5 py-2.5 text-right font-medium">Tokens</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--m-line)]">
                {usos.map((u) => (
                  <tr key={u.id}>
                    <td className="m-num whitespace-nowrap px-5 py-2.5 text-[var(--m-ink-2)]">{dataBR(u.criado_em)}</td>
                    <td className="px-5 py-2.5 text-[var(--m-ink)]">{ROTULO_FUNCAO[u.funcao] ?? u.funcao}</td>
                    <td className="m-num px-5 py-2.5 text-[var(--m-ink-2)]">{u.modelo}</td>
                    <td className="m-num px-5 py-2.5 text-[var(--m-ink-2)]">{u.lead_id ?? '—'}</td>
                    <td className="m-num px-5 py-2.5 text-right text-[var(--m-ink)]">
                      {tokensBR(u.tokens_total)}
                      {u.estimado ? <span className="ml-1 text-[var(--m-ink-2)]" title="Valor fixo por imagem (modelo sem medição)">~</span> : null}
                    </td>
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
