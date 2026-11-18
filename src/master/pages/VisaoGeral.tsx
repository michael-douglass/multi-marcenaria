import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Plus } from 'lucide-react'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { NovaEmpresaModal } from '@/components/master/NovaEmpresaModal'
import { brl, competenciaBR, fimDoMes, inicioDoMes } from '@/components/master/master-utils'
import { useMasterFaturamentoMensal, useMasterResumo } from '@/hooks/useMaster'
import { MasterPage, Numeros, Painel, SituacaoTag, StatusEmpresaTag, Vazio } from '@/master/components/MasterUi'

function plural(n: number, um: string, varios: string) {
  return `${n} ${n === 1 ? um : varios}`
}

/** Visão geral da plataforma: a frase de situação, os números do período e o que pede atenção. */
export default function VisaoGeral() {
  const [inicio, setInicio] = useState(inicioDoMes())
  const [fim, setFim] = useState(fimDoMes())
  const [novaAberta, setNovaAberta] = useState(false)
  const { data: empresas = [], isLoading, error } = useMasterResumo(inicio, fim)
  const { data: mensal = [] } = useMasterFaturamentoMensal(12)

  const k = useMemo(() => {
    const ativas = empresas.filter((e) => e.status === 'ativa').length
    const bloqueadas = empresas.filter((e) => e.status === 'bloqueada').length
    const usuarios = empresas.reduce((s, e) => s + e.total_usuarios, 0)
    const faturamento = empresas.reduce((s, e) => s + e.faturamento, 0)
    const mrr = empresas.filter((e) => e.status !== 'inativa').reduce((s, e) => s + (e.valor_mensal ?? 0), 0)
    const vencido = empresas.reduce((s, e) => s + e.valor_vencido, 0)
    return { ativas, bloqueadas, usuarios, faturamento, mrr, vencido }
  }, [empresas])

  const atencao = useMemo(
    () => empresas.filter((e) => e.status === 'bloqueada' || e.situacao_mensalidade === 'vencida' || e.admins.length === 0),
    [empresas],
  )

  const grafico = useMemo(() => {
    const porMes = new Map<string, number>()
    for (const r of mensal) porMes.set(r.mes, (porMes.get(r.mes) ?? 0) + r.faturamento)
    return [...porMes.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([mes, total]) => ({ mes: competenciaBR(mes), total }))
  }, [mensal])

  const frase = isLoading
    ? 'Carregando as marcenarias…'
    : empresas.length === 0
      ? 'Nenhuma marcenaria cadastrada ainda. Crie a primeira para começar.'
      : `${plural(empresas.length, 'marcenaria', 'marcenarias')} na plataforma: ${plural(k.ativas, 'ativa', 'ativas')}${
          k.bloqueadas ? `, ${plural(k.bloqueadas, 'bloqueada', 'bloqueadas')}` : ''
        }. Mensalidades contratadas somam ${brl(k.mrr)} por mês.`

  return (
    <MasterPage
      titulo="Visão geral"
      resumo={error ? `Não foi possível carregar: ${(error as Error).message}` : frase}
      acoes={
        <Button onClick={() => setNovaAberta(true)}>
          <Plus className="mr-2 h-4 w-4" aria-hidden /> Nova marcenaria
        </Button>
      }
    >
      <div className="mb-3 flex flex-wrap items-end gap-3">
        <div className="space-y-1">
          <Label htmlFor="vg-inicio" className="text-xs text-[var(--m-ink-2)]">Período de</Label>
          <Input id="vg-inicio" type="date" value={inicio} onChange={(e) => setInicio(e.target.value)} className="h-9 w-40 bg-[var(--m-surface)]" />
        </div>
        <div className="space-y-1">
          <Label htmlFor="vg-fim" className="text-xs text-[var(--m-ink-2)]">até</Label>
          <Input id="vg-fim" type="date" value={fim} onChange={(e) => setFim(e.target.value)} className="h-9 w-40 bg-[var(--m-surface)]" />
        </div>
      </div>

      <Numeros
        itens={[
          { rotulo: 'Marcenarias', valor: empresas.length, nota: `${k.ativas} ativas` },
          { rotulo: 'Bloqueadas', valor: k.bloqueadas, tom: k.bloqueadas ? 'alerta' : undefined },
          { rotulo: 'Usuários', valor: k.usuarios, nota: 'em todas' },
          { rotulo: 'Faturamento das marcenarias', valor: brl(k.faturamento), nota: 'no período' },
          { rotulo: 'Mensalidades por mês', valor: brl(k.mrr) },
          { rotulo: 'Mensalidades vencidas', valor: brl(k.vencido), tom: k.vencido ? 'alerta' : undefined },
        ]}
      />

      <div className="mt-8 grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <Painel titulo="Faturamento das marcenarias" descricao="Contas recebidas, somadas por mês (últimos 12 meses).">
          {grafico.length === 0 ? (
            <Vazio>Sem recebimentos lançados ainda.</Vazio>
          ) : (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={grafico} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                  <CartesianGrid vertical={false} stroke="var(--m-line)" />
                  <XAxis dataKey="mes" tickLine={false} axisLine={false} fontSize={12} stroke="var(--m-ink-2)" />
                  <YAxis tickLine={false} axisLine={false} fontSize={12} width={72} stroke="var(--m-ink-2)"
                    tickFormatter={(v: number) => brl(v).replace(',00', '')} />
                  <Tooltip formatter={(v) => brl(Number(v))} cursor={{ fill: 'var(--m-accent-soft)' }} />
                  <Bar dataKey="total" name="Faturamento" fill="var(--m-accent)" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </Painel>

        <Painel
          titulo="Pedem atenção"
          descricao="Bloqueadas, com mensalidade vencida ou sem administrador."
          corpoClassName="p-0"
        >
          {atencao.length === 0 ? (
            <Vazio>Tudo em ordem.</Vazio>
          ) : (
            <ul className="divide-y divide-[var(--m-line)]">
              {atencao.map((e) => (
                <li key={e.empresa_id}>
                  <Link
                    to={`/master/empresas/${e.empresa_id}`}
                    className="flex items-center justify-between gap-3 px-5 py-3 hover:bg-[var(--m-bg)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--m-accent)]"
                  >
                    <span className="min-w-0">
                      <span className="block truncate font-medium text-[var(--m-ink)]">{e.nome}</span>
                      <span className="text-[0.8rem] text-[var(--m-ink-2)]">
                        {e.admins.length === 0 ? 'Sem administrador' : e.valor_vencido ? `${brl(e.valor_vencido)} vencidos` : ''}
                      </span>
                    </span>
                    <span className="flex shrink-0 flex-col items-end gap-0.5">
                      <StatusEmpresaTag status={e.status} />
                      <SituacaoTag situacao={e.situacao_mensalidade} />
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Painel>
      </div>

      <p className="mt-6 text-sm text-[var(--m-ink-2)]">
        A lista completa, com administradores e usuários, está em{' '}
        <Link to="/master/empresas" className="font-medium text-[var(--m-accent)] underline underline-offset-2">Marcenarias</Link>.
      </p>

      <NovaEmpresaModal open={novaAberta} onClose={() => setNovaAberta(false)} />
    </MasterPage>
  )
}
