import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, KeyRound, LogIn, ShieldCheck } from 'lucide-react'
import { toast } from 'sonner'
import { DashboardCardShell } from '@/components/dashboard/DashboardCardShell'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { LoadingState } from '@/components/ui/EmptyState'
import { Modal } from '@/components/ui/Modal'
import { useApp } from '@/context/AppContext'
import {
  useAtualizarEmpresa,
  useCobrancas,
  useDefinirAdminEmpresa,
  useDefinirStatusEmpresa,
  useMasterResumo,
  useMasterUsuariosEmpresa,
  useRedefinirSenhaUsuario,
} from '@/hooks/useMaster'
import {
  brl,
  competenciaBR,
  dataBR,
  erroMsg,
  fimDoMes,
  inicioDoMes,
  STATUS_COBRANCA_CLASS,
  STATUS_COBRANCA_LABEL,
  STATUS_EMPRESA_CLASS,
  STATUS_EMPRESA_LABEL,
} from '@/components/master/master-utils'
import { cn } from '@/lib/utils'

const PERFIL_LABEL: Record<string, string> = {
  administrador: 'Administrador',
  financeiro: 'Financeiro',
  marceneiro: 'Marceneiro',
  montador: 'Montador',
  montador_admin: 'Montador admin',
  administrador_obras: 'Adm. de obras',
  visualizador: 'Visualizador',
}

/** Detalhe de uma marcenaria no Painel Master: dados, status, administrador, usuários e cobranças. */
export default function MasterEmpresaDetalhe() {
  const { id = '' } = useParams()
  const { trocarEmpresa } = useApp()
  const { data: resumo = [], isLoading } = useMasterResumo(inicioDoMes(), fimDoMes())
  const empresa = useMemo(() => resumo.find((e) => e.empresa_id === id), [resumo, id])
  const { data: usuarios = [] } = useMasterUsuariosEmpresa(id)
  const { data: cobrancas = [] } = useCobrancas({ empresaId: id })

  const atualizar = useAtualizarEmpresa()
  const definirStatus = useDefinirStatusEmpresa()
  const definirAdmin = useDefinirAdminEmpresa()
  const redefinirSenha = useRedefinirSenhaUsuario()

  const [dados, setDados] = useState({ nome: '', cnpj: '', razaoSocial: '' })
  const [admin, setAdmin] = useState({ nome: '', email: '', senha: '' })
  const [liberarAte, setLiberarAte] = useState('')
  const [senhaPara, setSenhaPara] = useState<{ id: string; nome: string } | null>(null)
  const [novaSenha, setNovaSenha] = useState('')

  useEffect(() => {
    if (empresa) setDados({ nome: empresa.nome, cnpj: empresa.cnpj ?? '', razaoSocial: '' })
  }, [empresa])

  if (isLoading) return <LoadingState message="Carregando empresa..." />
  if (!empresa) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-[#6b5244]">Empresa não encontrada.</p>
        <Button variant="outline" asChild><Link to="/master">Voltar</Link></Button>
      </div>
    )
  }

  const salvarDados = async () => {
    try {
      await atualizar.mutateAsync({ id, nome: dados.nome, cnpj: dados.cnpj, razaoSocial: dados.razaoSocial })
      toast.success('Dados da empresa salvos.')
    } catch (err) {
      toast.error(erroMsg(err, 'Não foi possível salvar'))
    }
  }

  const mudarStatus = async (status: 'ativa' | 'bloqueada' | 'inativa', liberadoAte?: string) => {
    try {
      await definirStatus.mutateAsync({ id, status, liberadoAte: liberadoAte || null })
      toast.success(
        status === 'ativa'
          ? liberadoAte ? `Empresa liberada até ${dataBR(liberadoAte)}.` : 'Empresa ativada.'
          : status === 'bloqueada' ? 'Empresa bloqueada.' : 'Empresa inativada.',
      )
    } catch (err) {
      toast.error(erroMsg(err, 'Não foi possível alterar o status'))
    }
  }

  const salvarAdmin = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!admin.email.trim() || !admin.nome.trim()) {
      toast.error('Informe nome e e-mail do administrador.')
      return
    }
    try {
      await definirAdmin.mutateAsync({ empresaId: id, email: admin.email.trim(), nome: admin.nome.trim(), senha: admin.senha })
      toast.success('Administrador definido.')
      setAdmin({ nome: '', email: '', senha: '' })
    } catch (err) {
      toast.error(erroMsg(err, 'Não foi possível definir o administrador'))
    }
  }

  const salvarSenha = async () => {
    if (!senhaPara) return
    if (novaSenha.length < 6) {
      toast.error('A senha precisa ter ao menos 6 caracteres.')
      return
    }
    try {
      await redefinirSenha.mutateAsync({ userId: senhaPara.id, senha: novaSenha })
      toast.success(`Senha de ${senhaPara.nome} redefinida.`)
      setSenhaPara(null)
      setNovaSenha('')
    } catch (err) {
      toast.error(erroMsg(err, 'Não foi possível redefinir a senha'))
    }
  }

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 pb-10">
      <Link to="/master" className="inline-flex items-center gap-1 text-xs font-semibold text-[#6b5244] hover:text-[#2a1812]">
        <ArrowLeft className="h-3.5 w-3.5" aria-hidden /> Painel Master
      </Link>

      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl tracking-[0.02em] text-[#2a1812]">{empresa.nome}</h1>
          <p className="text-xs text-[#8a7060]">
            {empresa.slug} · {empresa.total_usuarios} usuário(s) · faturamento no mês {brl(empresa.faturamento)}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className={cn('inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold', STATUS_EMPRESA_CLASS[empresa.status])}>
            {STATUS_EMPRESA_LABEL[empresa.status]}
          </span>
          <Button onClick={() => void trocarEmpresa(id)}>
            <LogIn className="mr-2 h-4 w-4" aria-hidden /> Entrar na empresa
          </Button>
        </div>
      </header>

      <div className="grid gap-6 lg:grid-cols-2">
        <DashboardCardShell className="space-y-4 p-5">
          <h2 className="text-xs font-bold uppercase tracking-[0.18em] text-[#6b5244]">Dados da empresa</h2>
          <div className="space-y-1.5">
            <Label htmlFor="me-nome">Nome</Label>
            <Input id="me-nome" value={dados.nome} onChange={(e) => setDados((d) => ({ ...d, nome: e.target.value }))} />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="me-cnpj">CNPJ</Label>
              <Input id="me-cnpj" value={dados.cnpj} onChange={(e) => setDados((d) => ({ ...d, cnpj: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="me-razao">Razão social</Label>
              <Input id="me-razao" value={dados.razaoSocial} onChange={(e) => setDados((d) => ({ ...d, razaoSocial: e.target.value }))} placeholder="(manter atual se vazio)" />
            </div>
          </div>
          <Button onClick={() => void salvarDados()} disabled={atualizar.isPending}>Salvar dados</Button>
        </DashboardCardShell>

        <DashboardCardShell accent="rose" className="space-y-4 p-5">
          <h2 className="text-xs font-bold uppercase tracking-[0.18em] text-[#6b5244]">Acesso ao sistema</h2>
          <p className="text-sm text-[#6b5244]">
            Empresas com mensalidade vencida além da tolerância são bloqueadas automaticamente. Aqui você bloqueia,
            libera ou inativa manualmente.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => void mudarStatus('ativa')} disabled={empresa.status === 'ativa'}>Ativar</Button>
            <Button variant="outline" onClick={() => void mudarStatus('bloqueada')} disabled={empresa.status === 'bloqueada'}>Bloquear</Button>
            <Button variant="outline" onClick={() => void mudarStatus('inativa')} disabled={empresa.status === 'inativa'}>Inativar</Button>
          </div>
          <div className="flex flex-wrap items-end gap-2 border-t border-[rgba(42,24,18,0.08)] pt-4">
            <div className="space-y-1.5">
              <Label htmlFor="me-liberar">Liberar mesmo com atraso até</Label>
              <Input id="me-liberar" type="date" value={liberarAte} onChange={(e) => setLiberarAte(e.target.value)} className="w-44" />
            </div>
            <Button onClick={() => void mudarStatus('ativa', liberarAte)} disabled={!liberarAte}>Liberar</Button>
          </div>
        </DashboardCardShell>
      </div>

      <DashboardCardShell accent="sky" className="space-y-4 p-5">
        <h2 className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-[#6b5244]">
          <ShieldCheck className="h-4 w-4" aria-hidden /> Administrador
        </h2>
        {empresa.admins.length === 0 ? (
          <p className="text-sm text-red-700">Esta empresa ainda não tem administrador.</p>
        ) : (
          <ul className="space-y-1 text-sm">
            {empresa.admins.map((a) => (
              <li key={a.id}><span className="font-semibold">{a.nome ?? a.email}</span> — {a.email}</li>
            ))}
          </ul>
        )}
        <form onSubmit={salvarAdmin} className="grid gap-3 border-t border-[rgba(42,24,18,0.08)] pt-4 sm:grid-cols-4 sm:items-end">
          <div className="space-y-1.5">
            <Label htmlFor="ma-nome">Nome</Label>
            <Input id="ma-nome" value={admin.nome} onChange={(e) => setAdmin((a) => ({ ...a, nome: e.target.value }))} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ma-email">E-mail</Label>
            <Input id="ma-email" type="email" autoComplete="off" value={admin.email} onChange={(e) => setAdmin((a) => ({ ...a, email: e.target.value }))} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ma-senha">Senha (novo usuário)</Label>
            <Input id="ma-senha" type="password" autoComplete="new-password" value={admin.senha} onChange={(e) => setAdmin((a) => ({ ...a, senha: e.target.value }))} />
          </div>
          <Button type="submit" disabled={definirAdmin.isPending}>Definir administrador</Button>
        </form>
        <p className="text-[11px] text-[#8a7060]">
          Se o e-mail já for de um usuário desta empresa, ele é promovido a administrador (a senha é opcional).
        </p>
      </DashboardCardShell>

      <DashboardCardShell className="p-0">
        <h2 className="border-b border-[rgba(42,24,18,0.08)] px-5 py-4 text-xs font-bold uppercase tracking-[0.18em] text-[#6b5244]">
          Usuários ({usuarios.length})
        </h2>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Perfil</TableHead>
                <TableHead>CRM</TableHead>
                <TableHead>Último acesso</TableHead>
                <TableHead className="w-12"><span className="sr-only">Ações</span></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {usuarios.map((u) => (
                <TableRow key={u.user_id}>
                  <TableCell>
                    <div className="font-medium">{u.nome ?? '—'}</div>
                    <div className="text-[11px] text-[#8a7060]">{u.email}</div>
                  </TableCell>
                  <TableCell>{u.perfil ? PERFIL_LABEL[u.perfil] ?? u.perfil : '—'}{!u.ativo ? ' (inativo)' : ''}</TableCell>
                  <TableCell className="text-xs">{u.crm_roles.join(', ') || '—'}</TableCell>
                  <TableCell className="text-xs">{u.ultimo_acesso ? new Date(u.ultimo_acesso).toLocaleString('pt-BR') : 'Nunca'}</TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={`Redefinir senha de ${u.nome ?? u.email}`}
                      onClick={() => setSenhaPara({ id: u.user_id, nome: u.nome ?? u.email ?? 'usuário' })}
                    >
                      <KeyRound className="h-4 w-4" aria-hidden />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </DashboardCardShell>

      <DashboardCardShell accent="amber" className="p-0">
        <div className="flex items-center justify-between border-b border-[rgba(42,24,18,0.08)] px-5 py-4">
          <h2 className="text-xs font-bold uppercase tracking-[0.18em] text-[#6b5244]">Mensalidades</h2>
          <Link to="/master/financeiro" className="text-xs font-semibold text-[#6b5244] underline">Financeiro Master</Link>
        </div>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Competência</TableHead>
                <TableHead>Vencimento</TableHead>
                <TableHead className="text-right">Valor</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Pago em</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {cobrancas.length === 0 ? (
                <TableRow><TableCell colSpan={5} className="py-8 text-center text-sm text-[#8a7060]">Nenhuma cobrança.</TableCell></TableRow>
              ) : (
                cobrancas.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell>{competenciaBR(c.competencia)}</TableCell>
                    <TableCell>{dataBR(c.vencimento)}</TableCell>
                    <TableCell className="text-right tabular-nums">{brl(c.valor)}</TableCell>
                    <TableCell>
                      <span className={cn('inline-flex rounded-full border px-2 py-0.5 text-[11px] font-semibold', STATUS_COBRANCA_CLASS[c.status])}>
                        {STATUS_COBRANCA_LABEL[c.status]}
                      </span>
                    </TableCell>
                    <TableCell>{dataBR(c.pago_em)}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </DashboardCardShell>

      <Modal open={!!senhaPara} onClose={() => setSenhaPara(null)} title={`Nova senha — ${senhaPara?.nome ?? ''}`}>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="ms-senha">Nova senha</Label>
            <Input id="ms-senha" type="password" autoComplete="new-password" value={novaSenha} onChange={(e) => setNovaSenha(e.target.value)} />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setSenhaPara(null)}>Cancelar</Button>
            <Button onClick={() => void salvarSenha()} disabled={redefinirSenha.isPending}>Salvar senha</Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
