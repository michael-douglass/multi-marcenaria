import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { LogIn, Plus, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { NovaEmpresaModal } from '@/components/master/NovaEmpresaModal'
import { brl, fimDoMes, inicioDoMes } from '@/components/master/master-utils'
import { useMasterResumo, type StatusEmpresa } from '@/hooks/useMaster'
import { EntrarEmpresaDialog } from '@/master/components/EntrarEmpresaDialog'
import { MasterPage, SituacaoTag, StatusEmpresaTag, Vazio } from '@/master/components/MasterUi'

/** Lista de marcenarias: busca, filtros, criação e entrada (inspeção). */
export default function Empresas() {
  const navigate = useNavigate()
  const { data: empresas = [], isLoading } = useMasterResumo(inicioDoMes(), fimDoMes())
  const [busca, setBusca] = useState('')
  const [status, setStatus] = useState<'todas' | StatusEmpresa>('todas')
  const [plano, setPlano] = useState('todos')
  const [novaAberta, setNovaAberta] = useState(false)
  const [entrar, setEntrar] = useState<{ id: string; nome: string } | null>(null)

  const planos = useMemo(() => [...new Set(empresas.map((e) => e.plano).filter(Boolean))] as string[], [empresas])

  const lista = useMemo(() => {
    const t = busca.trim().toLowerCase()
    return empresas.filter((e) => {
      if (status !== 'todas' && e.status !== status) return false
      if (plano === 'sem' && e.plano) return false
      if (plano !== 'todos' && plano !== 'sem' && e.plano !== plano) return false
      if (!t) return true
      return (
        e.nome.toLowerCase().includes(t) ||
        e.slug.includes(t) ||
        (e.cnpj ?? '').includes(t) ||
        e.admins.some((a) => (a.nome ?? '').toLowerCase().includes(t) || a.email.toLowerCase().includes(t))
      )
    })
  }, [empresas, busca, status, plano])

  return (
    <MasterPage
      titulo="Marcenarias"
      resumo="Clique numa marcenaria para ver os dados, as páginas liberadas, os usuários e as mensalidades."
      acoes={
        <Button onClick={() => setNovaAberta(true)}>
          <Plus className="mr-2 h-4 w-4" aria-hidden /> Nova marcenaria
        </Button>
      }
    >
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="relative min-w-[16rem] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--m-ink-2)]" aria-hidden />
          <Input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar por nome, CNPJ ou administrador"
            aria-label="Buscar marcenaria"
            className="h-10 bg-[var(--m-surface)] pl-9"
          />
        </div>
        <Select value={status} onValueChange={(v) => setStatus(v as typeof status)}>
          <SelectTrigger className="h-10 w-40 bg-[var(--m-surface)]" aria-label="Filtrar por situação"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todas">Todas</SelectItem>
            <SelectItem value="ativa">Ativas</SelectItem>
            <SelectItem value="bloqueada">Bloqueadas</SelectItem>
            <SelectItem value="inativa">Inativas</SelectItem>
          </SelectContent>
        </Select>
        <Select value={plano} onValueChange={setPlano}>
          <SelectTrigger className="h-10 w-44 bg-[var(--m-surface)]" aria-label="Filtrar por plano"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os planos</SelectItem>
            <SelectItem value="sem">Sem plano</SelectItem>
            {planos.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div className="overflow-x-auto rounded-md border border-[var(--m-line)] bg-[var(--m-surface)]">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Marcenaria</TableHead>
              <TableHead>Administrador</TableHead>
              <TableHead className="text-right">Usuários</TableHead>
              <TableHead className="text-right">Faturamento no mês</TableHead>
              <TableHead>Plano</TableHead>
              <TableHead>Mensalidade</TableHead>
              <TableHead><span className="sr-only">Ações</span></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={7}><Vazio>Carregando…</Vazio></TableCell></TableRow>
            ) : lista.length === 0 ? (
              <TableRow><TableCell colSpan={7}><Vazio>{empresas.length ? 'Nenhuma marcenaria com esses filtros.' : 'Nenhuma marcenaria cadastrada.'}</Vazio></TableCell></TableRow>
            ) : (
              lista.map((e) => (
                <TableRow
                  key={e.empresa_id}
                  className="cursor-pointer hover:bg-[var(--m-bg)]"
                  onClick={() => navigate(`/master/empresas/${e.empresa_id}`)}
                >
                  <TableCell>
                    <div className="font-medium text-[var(--m-ink)]">{e.nome}</div>
                    <StatusEmpresaTag status={e.status} />
                  </TableCell>
                  <TableCell>
                    {e.admins.length === 0 ? (
                      <span className="text-[0.85rem] text-[var(--m-total)]">Sem administrador</span>
                    ) : (
                      e.admins.map((a) => (
                        <div key={a.id} className="text-[0.85rem]">
                          <div>{a.nome ?? a.email}</div>
                          <div className="text-[var(--m-ink-2)]">{a.email}</div>
                        </div>
                      ))
                    )}
                  </TableCell>
                  <TableCell className="m-num text-right">{e.total_usuarios}</TableCell>
                  <TableCell className="m-num text-right">{brl(e.faturamento)}</TableCell>
                  <TableCell className="text-[0.85rem]">
                    {e.plano ?? '—'}
                    {e.valor_mensal != null ? <div className="m-num text-[var(--m-ink-2)]">{brl(e.valor_mensal)}/mês</div> : null}
                  </TableCell>
                  <TableCell><SituacaoTag situacao={e.situacao_mensalidade} /></TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={(ev) => {
                        ev.stopPropagation()
                        setEntrar({ id: e.empresa_id, nome: e.nome })
                      }}
                    >
                      <LogIn className="mr-1.5 h-4 w-4" aria-hidden /> Entrar
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <NovaEmpresaModal open={novaAberta} onClose={() => setNovaAberta(false)} onCriada={(id) => navigate(`/master/empresas/${id}`)} />
      <EntrarEmpresaDialog empresa={entrar} onClose={() => setEntrar(null)} />
    </MasterPage>
  )
}
