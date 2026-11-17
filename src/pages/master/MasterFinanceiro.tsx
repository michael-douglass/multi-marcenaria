import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { AlertTriangle, ArrowLeft, CheckCircle2, Clock, RefreshCw, Wallet } from 'lucide-react'
import { toast } from 'sonner'
import { DashboardCardShell, DashboardKpiCard } from '@/components/dashboard/DashboardCardShell'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Modal } from '@/components/ui/Modal'
import {
  type Assinatura,
  type Cobranca,
  type FormaPagamentoPlataforma,
  type Plano,
  useAssinaturas,
  useCancelarCobranca,
  useCobrancas,
  useDarBaixaCobranca,
  useFormasPagamentoPlataforma,
  useMasterEmpresas,
  usePlanos,
  useProcessarCobrancas,
  useSalvarAssinatura,
  useSalvarFormaPagamento,
  useSalvarPlano,
} from '@/hooks/useMaster'
import {
  brl,
  competenciaBR,
  dataBR,
  erroMsg,
  fimDoMes,
  inicioDoMes,
  isoDate,
  STATUS_COBRANCA_CLASS,
  STATUS_COBRANCA_LABEL,
} from '@/components/master/master-utils'
import { cn } from '@/lib/utils'

const toNum = (s: string) => Number(String(s).replace(',', '.'))

/** Financeiro Master: mensalidades do sistema cobradas de cada marcenaria. */
export default function MasterFinanceiro() {
  const { data: empresas = [] } = useMasterEmpresas()
  const nomeEmpresa = useMemo(() => new Map(empresas.map((e) => [e.id, e.nome])), [empresas])
  const processar = useProcessarCobrancas()

  const rodarProcessamento = async () => {
    try {
      const r = await processar.mutateAsync()
      toast.success(
        `Cobranças geradas: ${r.geradas}. Vencidas: ${r.vencidas}. Bloqueadas: ${r.bloqueadas}. Desbloqueadas: ${r.desbloqueadas}.`,
      )
    } catch (err) {
      toast.error(erroMsg(err, 'Não foi possível processar as cobranças'))
    }
  }

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6 pb-10">
      <Link to="/master" className="inline-flex items-center gap-1 text-xs font-semibold text-[#6b5244] hover:text-[#2a1812]">
        <ArrowLeft className="h-3.5 w-3.5" aria-hidden /> Painel Master
      </Link>
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.22em] text-amber-700">
            <Wallet className="h-3.5 w-3.5" aria-hidden /> Financeiro Master
          </p>
          <h1 className="font-display text-3xl tracking-[0.02em] text-[#2a1812]">Mensalidades do sistema</h1>
          <p className="text-xs text-[#8a7060]">
            As cobranças do mês são geradas e os atrasos conferidos todo dia às 06:15 (horário de Brasília).
          </p>
        </div>
        <Button variant="outline" onClick={() => void rodarProcessamento()} disabled={processar.isPending}>
          <RefreshCw className={cn('mr-2 h-4 w-4', processar.isPending && 'animate-spin')} aria-hidden />
          Gerar / atualizar agora
        </Button>
      </header>

      <Tabs defaultValue="cobrancas">
        <TabsList>
          <TabsTrigger value="cobrancas">Cobranças</TabsTrigger>
          <TabsTrigger value="assinaturas">Assinaturas</TabsTrigger>
          <TabsTrigger value="planos">Planos</TabsTrigger>
          <TabsTrigger value="formas">Formas de pagamento</TabsTrigger>
        </TabsList>
        <TabsContent value="cobrancas" className="mt-4">
          <AbaCobrancas nomeEmpresa={nomeEmpresa} empresas={empresas} />
        </TabsContent>
        <TabsContent value="assinaturas" className="mt-4">
          <AbaAssinaturas empresas={empresas} />
        </TabsContent>
        <TabsContent value="planos" className="mt-4">
          <AbaPlanos />
        </TabsContent>
        <TabsContent value="formas" className="mt-4">
          <AbaFormas />
        </TabsContent>
      </Tabs>
    </div>
  )
}

// ── Cobranças ────────────────────────────────────────────────────────────────────────────────────
function AbaCobrancas({
  nomeEmpresa,
  empresas,
}: {
  nomeEmpresa: Map<string, string>
  empresas: { id: string; nome: string }[]
}) {
  const [inicio, setInicio] = useState(inicioDoMes(new Date(new Date().getFullYear(), new Date().getMonth() - 2, 1)))
  const [fim, setFim] = useState(fimDoMes())
  const [status, setStatus] = useState('todas')
  const [empresaId, setEmpresaId] = useState('todas')
  const { data: cobrancas = [], isLoading } = useCobrancas({ inicio, fim, status, empresaId })
  const { data: mesAtual = [] } = useCobrancas({ inicio: inicioDoMes(), fim: fimDoMes() })
  const { data: vencidas = [] } = useCobrancas({ status: 'vencida' })
  const { data: assinaturas = [] } = useAssinaturas()
  const cancelar = useCancelarCobranca()
  const [baixa, setBaixa] = useState<Cobranca | null>(null)

  const kpi = useMemo(() => {
    const aReceber = mesAtual.filter((c) => c.status === 'pendente').reduce((s, c) => s + c.valor, 0)
    const recebido = mesAtual.filter((c) => c.status === 'paga').reduce((s, c) => s + (c.valor_pago ?? c.valor), 0)
    const vencido = vencidas.reduce((s, c) => s + c.valor, 0)
    const mrr = assinaturas.filter((a) => a.status === 'ativa').reduce((s, a) => s + a.valor, 0)
    return { aReceber, recebido, vencido, mrr }
  }, [mesAtual, vencidas, assinaturas])

  const onCancelar = async (c: Cobranca) => {
    try {
      await cancelar.mutateAsync(c.id)
      toast.success('Cobrança cancelada.')
    } catch (err) {
      toast.error(erroMsg(err, 'Não foi possível cancelar'))
    }
  }

  return (
    <div className="space-y-5">
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-label="Indicadores de mensalidades">
        <DashboardKpiCard title="A receber no mês" subtitle="cobranças pendentes" value={brl(kpi.aReceber)} icon={Clock} accent="sky" />
        <DashboardKpiCard title="Recebido no mês" subtitle="cobranças pagas" value={brl(kpi.recebido)} icon={CheckCircle2} accent="emerald" />
        <DashboardKpiCard title="Vencido" subtitle="total em atraso" value={brl(kpi.vencido)} icon={AlertTriangle} accent="rose" />
        <DashboardKpiCard title="MRR" subtitle="assinaturas ativas" value={brl(kpi.mrr)} icon={Wallet} accent="gold" />
      </section>

      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1">
          <Label htmlFor="fc-ini" className="text-xs">Vencimento de</Label>
          <Input id="fc-ini" type="date" value={inicio} onChange={(e) => setInicio(e.target.value)} className="h-9 w-40" />
        </div>
        <div className="space-y-1">
          <Label htmlFor="fc-fim" className="text-xs">até</Label>
          <Input id="fc-fim" type="date" value={fim} onChange={(e) => setFim(e.target.value)} className="h-9 w-40" />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Status</Label>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="h-9 w-36"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">Todas</SelectItem>
              <SelectItem value="pendente">Pendentes</SelectItem>
              <SelectItem value="vencida">Vencidas</SelectItem>
              <SelectItem value="paga">Pagas</SelectItem>
              <SelectItem value="cancelada">Canceladas</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Empresa</Label>
          <Select value={empresaId} onValueChange={setEmpresaId}>
            <SelectTrigger className="h-9 w-56"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">Todas</SelectItem>
              {empresas.map((e) => <SelectItem key={e.id} value={e.id}>{e.nome}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      <DashboardCardShell className="p-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Empresa</TableHead>
                <TableHead>Competência</TableHead>
                <TableHead>Vencimento</TableHead>
                <TableHead className="text-right">Valor</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Pagamento</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={7} className="py-8 text-center text-sm">Carregando…</TableCell></TableRow>
              ) : cobrancas.length === 0 ? (
                <TableRow><TableCell colSpan={7} className="py-8 text-center text-sm text-[#8a7060]">Nenhuma cobrança no filtro.</TableCell></TableRow>
              ) : (
                cobrancas.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="font-medium">{nomeEmpresa.get(c.empresa_id) ?? '—'}</TableCell>
                    <TableCell>{competenciaBR(c.competencia)}</TableCell>
                    <TableCell>{dataBR(c.vencimento)}</TableCell>
                    <TableCell className="text-right tabular-nums">{brl(c.valor)}</TableCell>
                    <TableCell>
                      <span className={cn('inline-flex rounded-full border px-2 py-0.5 text-[11px] font-semibold', STATUS_COBRANCA_CLASS[c.status])}>
                        {STATUS_COBRANCA_LABEL[c.status]}
                      </span>
                    </TableCell>
                    <TableCell className="text-xs">
                      {c.status === 'paga' ? `${dataBR(c.pago_em)} · ${brl(c.valor_pago ?? c.valor)}` : '—'}
                    </TableCell>
                    <TableCell className="text-right">
                      {c.status === 'pendente' || c.status === 'vencida' ? (
                        <div className="flex justify-end gap-1">
                          <Button size="sm" onClick={() => setBaixa(c)}>Dar baixa</Button>
                          <Button size="sm" variant="ghost" onClick={() => void onCancelar(c)}>Cancelar</Button>
                        </div>
                      ) : null}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </DashboardCardShell>

      <BaixaModal cobranca={baixa} nomeEmpresa={baixa ? nomeEmpresa.get(baixa.empresa_id) ?? '' : ''} onClose={() => setBaixa(null)} />
    </div>
  )
}

function BaixaModal({ cobranca, nomeEmpresa, onClose }: { cobranca: Cobranca | null; nomeEmpresa: string; onClose: () => void }) {
  const { data: formas = [] } = useFormasPagamentoPlataforma()
  const darBaixa = useDarBaixaCobranca()
  const [forma, setForma] = useState('')
  const [pagoEm, setPagoEm] = useState(isoDate(new Date()))
  const [valor, setValor] = useState('')
  const [obs, setObs] = useState('')

  const salvar = async () => {
    if (!cobranca) return
    if (!forma) {
      toast.error('Escolha a forma de pagamento.')
      return
    }
    try {
      await darBaixa.mutateAsync({
        cobrancaId: cobranca.id,
        formaPagamentoId: forma,
        pagoEm,
        valorPago: valor.trim() ? toNum(valor) : null,
        observacao: obs,
      })
      toast.success('Pagamento registrado. Se a empresa estava bloqueada por esta pendência, o acesso foi liberado.')
      setForma('')
      setValor('')
      setObs('')
      onClose()
    } catch (err) {
      toast.error(erroMsg(err, 'Não foi possível dar baixa'))
    }
  }

  return (
    <Modal open={!!cobranca} onClose={onClose} title={`Dar baixa — ${nomeEmpresa}`}>
      {cobranca ? (
        <div className="space-y-4">
          <p className="text-sm text-[#6b5244]">
            Competência {competenciaBR(cobranca.competencia)} · vencimento {dataBR(cobranca.vencimento)} · {brl(cobranca.valor)}
          </p>
          <div className="space-y-1.5">
            <Label>Forma de pagamento</Label>
            <Select value={forma} onValueChange={setForma}>
              <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>
                {formas.filter((f) => f.ativo).map((f) => <SelectItem key={f.id} value={f.id}>{f.nome}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="bx-data">Data do pagamento</Label>
              <Input id="bx-data" type="date" value={pagoEm} onChange={(e) => setPagoEm(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="bx-valor">Valor pago (R$)</Label>
              <Input id="bx-valor" inputMode="decimal" value={valor} onChange={(e) => setValor(e.target.value)} placeholder={String(cobranca.valor)} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="bx-obs">Observação</Label>
            <Input id="bx-obs" value={obs} onChange={(e) => setObs(e.target.value)} />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onClose}>Cancelar</Button>
            <Button onClick={() => void salvar()} disabled={darBaixa.isPending}>Confirmar pagamento</Button>
          </div>
        </div>
      ) : null}
    </Modal>
  )
}

// ── Assinaturas ──────────────────────────────────────────────────────────────────────────────────
function AbaAssinaturas({ empresas }: { empresas: { id: string; nome: string }[] }) {
  const { data: assinaturas = [] } = useAssinaturas()
  const { data: planos = [] } = usePlanos()
  const [editando, setEditando] = useState<{ empresaId: string; nome: string; atual?: Assinatura } | null>(null)
  const porEmpresa = useMemo(() => new Map(assinaturas.map((a) => [a.empresa_id, a])), [assinaturas])
  const nomePlano = useMemo(() => new Map(planos.map((p) => [p.id, p.nome])), [planos])

  return (
    <DashboardCardShell className="p-0">
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Empresa</TableHead>
              <TableHead>Plano</TableHead>
              <TableHead className="text-right">Valor</TableHead>
              <TableHead>Vencimento</TableHead>
              <TableHead>Tolerância</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {empresas.map((e) => {
              const a = porEmpresa.get(e.id)
              return (
                <TableRow key={e.id}>
                  <TableCell className="font-medium">{e.nome}</TableCell>
                  <TableCell>{a?.plano_id ? nomePlano.get(a.plano_id) ?? '—' : '—'}</TableCell>
                  <TableCell className="text-right tabular-nums">{a ? brl(a.valor) : '—'}</TableCell>
                  <TableCell>{a ? `dia ${a.dia_vencimento}` : '—'}</TableCell>
                  <TableCell>{a ? `${a.dias_tolerancia} dias` : '—'}</TableCell>
                  <TableCell className="text-xs">
                    {a ? a.status : 'sem assinatura'}
                    {a?.liberado_ate ? ` · liberada até ${dataBR(a.liberado_ate)}` : ''}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button size="sm" variant="outline" onClick={() => setEditando({ empresaId: e.id, nome: e.nome, atual: a })}>
                      {a ? 'Editar' : 'Criar assinatura'}
                    </Button>
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>
      <AssinaturaModal alvo={editando} planos={planos} onClose={() => setEditando(null)} />
    </DashboardCardShell>
  )
}

function AssinaturaModal({
  alvo,
  planos,
  onClose,
}: {
  alvo: { empresaId: string; nome: string; atual?: Assinatura } | null
  planos: Plano[]
  onClose: () => void
}) {
  const salvar = useSalvarAssinatura()
  const a = alvo?.atual
  const [planoId, setPlanoId] = useState<string>('nenhum')
  const [valor, setValor] = useState('')
  const [dia, setDia] = useState('10')
  const [tolerancia, setTolerancia] = useState('10')
  const [status, setStatus] = useState<Assinatura['status']>('ativa')
  const [chave, setChave] = useState<string | null>(null)

  // Recarrega o formulário quando muda o alvo.
  const k = alvo ? `${alvo.empresaId}-${a?.id ?? 'nova'}` : null
  if (k !== chave) {
    setChave(k)
    setPlanoId(a?.plano_id ?? 'nenhum')
    setValor(a ? String(a.valor) : '')
    setDia(String(a?.dia_vencimento ?? 10))
    setTolerancia(String(a?.dias_tolerancia ?? 10))
    setStatus(a?.status ?? 'ativa')
  }

  const enviar = async () => {
    if (!alvo) return
    if (!valor.trim() || Number.isNaN(toNum(valor))) {
      toast.error('Informe o valor mensal.')
      return
    }
    try {
      await salvar.mutateAsync({
        empresa_id: alvo.empresaId,
        plano_id: planoId === 'nenhum' ? null : planoId,
        valor: toNum(valor),
        dia_vencimento: Math.min(28, Math.max(1, Number(dia) || 10)),
        dias_tolerancia: Math.max(0, Number(tolerancia) || 0),
        status,
        liberado_ate: a?.liberado_ate ?? null,
        observacao: a?.observacao ?? null,
      })
      toast.success('Assinatura salva.')
      onClose()
    } catch (err) {
      toast.error(erroMsg(err, 'Não foi possível salvar a assinatura'))
    }
  }

  return (
    <Modal open={!!alvo} onClose={onClose} title={`Assinatura — ${alvo?.nome ?? ''}`}>
      <div className="space-y-4">
        <div className="space-y-1.5">
          <Label>Plano</Label>
          <Select
            value={planoId}
            onValueChange={(v) => {
              setPlanoId(v)
              const p = planos.find((x) => x.id === v)
              if (p) setValor(String(p.valor_mensal))
            }}
          >
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="nenhum">Sem plano (valor avulso)</SelectItem>
              {planos.map((p) => <SelectItem key={p.id} value={p.id}>{p.nome} — {brl(p.valor_mensal)}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-1.5">
            <Label htmlFor="as-valor">Valor mensal (R$)</Label>
            <Input id="as-valor" inputMode="decimal" value={valor} onChange={(e) => setValor(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="as-dia">Dia do vencimento</Label>
            <Input id="as-dia" type="number" min={1} max={28} value={dia} onChange={(e) => setDia(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="as-tol">Tolerância (dias)</Label>
            <Input id="as-tol" type="number" min={0} value={tolerancia} onChange={(e) => setTolerancia(e.target.value)} />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label>Status</Label>
          <Select value={status} onValueChange={(v) => setStatus(v as Assinatura['status'])}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="ativa">Ativa (gera cobranças)</SelectItem>
              <SelectItem value="suspensa">Suspensa (não gera)</SelectItem>
              <SelectItem value="cancelada">Cancelada</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <p className="text-[11px] text-[#8a7060]">
          Depois de vencida, a empresa é bloqueada automaticamente quando o atraso passa da tolerância.
        </p>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={() => void enviar()} disabled={salvar.isPending}>Salvar</Button>
        </div>
      </div>
    </Modal>
  )
}

// ── Planos ───────────────────────────────────────────────────────────────────────────────────────
function AbaPlanos() {
  const { data: planos = [] } = usePlanos()
  const salvar = useSalvarPlano()
  const [novo, setNovo] = useState({ nome: '', valor: '', descricao: '' })

  const criar = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!novo.nome.trim() || !novo.valor.trim()) {
      toast.error('Informe nome e valor do plano.')
      return
    }
    try {
      await salvar.mutateAsync({ nome: novo.nome.trim(), valor_mensal: toNum(novo.valor), descricao: novo.descricao || null })
      setNovo({ nome: '', valor: '', descricao: '' })
      toast.success('Plano criado.')
    } catch (err) {
      toast.error(erroMsg(err, 'Não foi possível criar o plano'))
    }
  }

  const alternar = async (p: Plano) => {
    try {
      await salvar.mutateAsync({ ...p, ativo: !p.ativo })
    } catch (err) {
      toast.error(erroMsg(err, 'Não foi possível atualizar o plano'))
    }
  }

  return (
    <div className="space-y-4">
      <DashboardCardShell className="p-5">
        <form onSubmit={criar} className="grid gap-3 sm:grid-cols-4 sm:items-end">
          <div className="space-y-1.5">
            <Label htmlFor="pl-nome">Nome do plano</Label>
            <Input id="pl-nome" value={novo.nome} onChange={(e) => setNovo((n) => ({ ...n, nome: e.target.value }))} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="pl-valor">Valor mensal (R$)</Label>
            <Input id="pl-valor" inputMode="decimal" value={novo.valor} onChange={(e) => setNovo((n) => ({ ...n, valor: e.target.value }))} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="pl-desc">Descrição</Label>
            <Input id="pl-desc" value={novo.descricao} onChange={(e) => setNovo((n) => ({ ...n, descricao: e.target.value }))} />
          </div>
          <Button type="submit" disabled={salvar.isPending}>Adicionar plano</Button>
        </form>
      </DashboardCardShell>
      <DashboardCardShell className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Plano</TableHead>
              <TableHead className="text-right">Valor</TableHead>
              <TableHead>Descrição</TableHead>
              <TableHead>Ativo</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {planos.length === 0 ? (
              <TableRow><TableCell colSpan={4} className="py-8 text-center text-sm text-[#8a7060]">Nenhum plano cadastrado.</TableCell></TableRow>
            ) : (
              planos.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="font-medium">{p.nome}</TableCell>
                  <TableCell className="text-right tabular-nums">{brl(p.valor_mensal)}</TableCell>
                  <TableCell className="text-sm">{p.descricao ?? '—'}</TableCell>
                  <TableCell>
                    <Switch checked={p.ativo} onCheckedChange={() => void alternar(p)} aria-label={`Plano ${p.nome} ativo`} />
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </DashboardCardShell>
    </div>
  )
}

// ── Formas de pagamento ──────────────────────────────────────────────────────────────────────────
function AbaFormas() {
  const { data: formas = [] } = useFormasPagamentoPlataforma()
  const salvar = useSalvarFormaPagamento()
  const [nome, setNome] = useState('')

  const criar = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!nome.trim()) return
    try {
      await salvar.mutateAsync({ nome: nome.trim(), ordem: formas.length + 1 })
      setNome('')
      toast.success('Forma de pagamento adicionada.')
    } catch (err) {
      toast.error(erroMsg(err, 'Não foi possível adicionar'))
    }
  }

  const alternar = async (f: FormaPagamentoPlataforma) => {
    try {
      await salvar.mutateAsync({ ...f, ativo: !f.ativo })
    } catch (err) {
      toast.error(erroMsg(err, 'Não foi possível atualizar'))
    }
  }

  return (
    <div className="space-y-4">
      <DashboardCardShell className="p-5">
        <form onSubmit={criar} className="flex flex-wrap items-end gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="fp-nome">Nova forma de pagamento</Label>
            <Input id="fp-nome" value={nome} onChange={(e) => setNome(e.target.value)} className="w-64" />
          </div>
          <Button type="submit" disabled={salvar.isPending}>Adicionar</Button>
        </form>
      </DashboardCardShell>
      <DashboardCardShell className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Forma</TableHead>
              <TableHead>Ativa</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {formas.map((f) => (
              <TableRow key={f.id}>
                <TableCell className="font-medium">{f.nome}</TableCell>
                <TableCell>
                  <Switch checked={f.ativo} onCheckedChange={() => void alternar(f)} aria-label={`${f.nome} ativa`} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </DashboardCardShell>
    </div>
  )
}
