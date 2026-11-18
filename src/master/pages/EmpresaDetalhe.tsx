import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, KeyRound, LogIn } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Modal } from '@/components/ui/Modal'
import {
  useAcessosMaster,
  useAtualizarEmpresa,
  useCobrancas,
  useDefinirAdminEmpresa,
  useDefinirStatusEmpresa,
  useMasterResumo,
  useMasterUsuariosEmpresa,
  usePaginasEmpresa,
  useRedefinirSenhaUsuario,
  useSalvarPaginasEmpresa,
} from '@/hooks/useMaster'
import {
  brl,
  competenciaBR,
  dataBR,
  erroMsg,
  fimDoMes,
  inicioDoMes,
  STATUS_COBRANCA_LABEL,
} from '@/components/master/master-utils'
import { EntrarEmpresaDialog } from '@/master/components/EntrarEmpresaDialog'
import { PaginasEditor } from '@/master/components/PaginasEditor'
import { AcessosTabela } from '@/master/components/AcessosTabela'
import { MasterPage, Painel, SituacaoTag, StatusEmpresaTag, Vazio } from '@/master/components/MasterUi'
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

const COBRANCA_COR: Record<string, string> = {
  pendente: 'text-[var(--m-ink)]',
  paga: 'text-[var(--m-accent)]',
  vencida: 'text-[var(--m-total)] font-semibold',
  cancelada: 'text-[var(--m-ink-2)] line-through',
}

/** Uma marcenaria no console: dados e acesso, páginas, usuários, mensalidades e entradas do master. */
export default function EmpresaDetalhe() {
  const { id = '' } = useParams()
  const { data: resumo = [], isLoading } = useMasterResumo(inicioDoMes(), fimDoMes())
  const empresa = useMemo(() => resumo.find((e) => e.empresa_id === id), [resumo, id])
  const { data: usuarios = [] } = useMasterUsuariosEmpresa(id)
  const { data: cobrancas = [] } = useCobrancas({ empresaId: id })
  const { data: paginas } = usePaginasEmpresa(id)
  const { data: acessos = [] } = useAcessosMaster(id)

  const atualizar = useAtualizarEmpresa()
  const definirStatus = useDefinirStatusEmpresa()
  const definirAdmin = useDefinirAdminEmpresa()
  const redefinirSenha = useRedefinirSenhaUsuario()
  const salvarPaginas = useSalvarPaginasEmpresa()

  const [dados, setDados] = useState({ nome: '', cnpj: '', razaoSocial: '' })
  const [admin, setAdmin] = useState({ nome: '', email: '', senha: '' })
  const [liberarAte, setLiberarAte] = useState('')
  const [senhaPara, setSenhaPara] = useState<{ id: string; nome: string } | null>(null)
  const [novaSenha, setNovaSenha] = useState('')
  const [entrar, setEntrar] = useState<{ id: string; nome: string } | null>(null)

  useEffect(() => {
    if (empresa) setDados({ nome: empresa.nome, cnpj: empresa.cnpj ?? '', razaoSocial: '' })
  }, [empresa])

  if (isLoading) return <MasterPage titulo="Marcenaria"><Vazio>Carregando…</Vazio></MasterPage>
  if (!empresa) {
    return (
      <MasterPage titulo="Marcenaria não encontrada" resumo="Ela pode ter sido removida.">
        <Button variant="outline" asChild><Link to="/master/empresas">Voltar para Marcenarias</Link></Button>
      </MasterPage>
    )
  }

  const salvarDados = async () => {
    try {
      await atualizar.mutateAsync({ id, nome: dados.nome, cnpj: dados.cnpj, razaoSocial: dados.razaoSocial })
      toast.success('Dados da marcenaria salvos.')
    } catch (err) {
      toast.error(erroMsg(err, 'Não foi possível salvar'))
    }
  }

  const mudarStatus = async (status: 'ativa' | 'bloqueada' | 'inativa', ate?: string) => {
    try {
      await definirStatus.mutateAsync({ id, status, liberadoAte: ate || null })
      toast.success(
        status === 'ativa'
          ? ate ? `Marcenaria liberada até ${dataBR(ate)}.` : 'Marcenaria ativada.'
          : status === 'bloqueada' ? 'Marcenaria bloqueada.' : 'Marcenaria inativada.',
      )
    } catch (err) {
      toast.error(erroMsg(err, 'Não foi possível alterar a situação'))
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

  const bloqueadas = paginas?.bloqueadas.length ?? 0

  return (
    <MasterPage
      titulo={empresa.nome}
      resumo={
        <span className="flex flex-wrap items-center gap-x-4 gap-y-1">
          <StatusEmpresaTag status={empresa.status} />
          <span>{empresa.total_usuarios} {empresa.total_usuarios === 1 ? 'usuário' : 'usuários'}</span>
          <span className="m-num">Faturamento no mês {brl(empresa.faturamento)}</span>
          <span>Mensalidade: <SituacaoTag situacao={empresa.situacao_mensalidade} /></span>
        </span>
      }
      acoes={
        <>
          <Button variant="ghost" asChild>
            <Link to="/master/empresas"><ArrowLeft className="mr-1.5 h-4 w-4" aria-hidden /> Marcenarias</Link>
          </Button>
          <Button onClick={() => setEntrar({ id, nome: empresa.nome })}>
            <LogIn className="mr-2 h-4 w-4" aria-hidden /> Entrar na marcenaria
          </Button>
        </>
      }
    >
      <Tabs defaultValue="geral">
        <TabsList className="mb-6 h-auto flex-wrap justify-start gap-1 bg-transparent p-0">
          {[
            ['geral', 'Dados e acesso'],
            ['paginas', `Páginas${bloqueadas ? ` (${bloqueadas} bloqueadas)` : ''}`],
            ['usuarios', `Usuários (${usuarios.length})`],
            ['mensalidades', 'Mensalidades'],
            ['acessos', 'Entradas do master'],
          ].map(([v, t]) => (
            <TabsTrigger
              key={v}
              value={v}
              className="min-h-10 rounded-md border border-transparent px-3 data-[state=active]:border-[var(--m-line)] data-[state=active]:bg-[var(--m-surface)] data-[state=active]:shadow-none"
            >
              {t}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="geral" className="space-y-6">
          <div className="grid gap-6 lg:grid-cols-2">
            <Painel titulo="Dados da marcenaria">
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="ed-nome">Nome</Label>
                  <Input id="ed-nome" value={dados.nome} onChange={(e) => setDados((d) => ({ ...d, nome: e.target.value }))} />
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="ed-cnpj">CNPJ</Label>
                    <Input id="ed-cnpj" value={dados.cnpj} onChange={(e) => setDados((d) => ({ ...d, cnpj: e.target.value }))} />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="ed-razao">Razão social</Label>
                    <Input id="ed-razao" value={dados.razaoSocial} placeholder="Deixe vazio para manter"
                      onChange={(e) => setDados((d) => ({ ...d, razaoSocial: e.target.value }))} />
                  </div>
                </div>
                <Button onClick={() => void salvarDados()} disabled={atualizar.isPending}>Salvar dados</Button>
              </div>
            </Painel>

            <Painel
              titulo="Acesso ao sistema"
              descricao="Com mensalidade vencida além da tolerância, a marcenaria é bloqueada sozinha. Aqui você decide manualmente."
            >
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" onClick={() => void mudarStatus('ativa')} disabled={empresa.status === 'ativa'}>Ativar</Button>
                <Button variant="outline" onClick={() => void mudarStatus('bloqueada')} disabled={empresa.status === 'bloqueada'}>Bloquear</Button>
                <Button variant="outline" onClick={() => void mudarStatus('inativa')} disabled={empresa.status === 'inativa'}>Inativar</Button>
              </div>
              <div className="mt-5 flex flex-wrap items-end gap-2 border-t border-[var(--m-line)] pt-5">
                <div className="space-y-1.5">
                  <Label htmlFor="ed-liberar">Liberar mesmo com atraso até</Label>
                  <Input id="ed-liberar" type="date" value={liberarAte} onChange={(e) => setLiberarAte(e.target.value)} className="w-44" />
                </div>
                <Button onClick={() => void mudarStatus('ativa', liberarAte)} disabled={!liberarAte}>Liberar</Button>
              </div>
            </Painel>
          </div>

          <Painel titulo="Administrador" descricao="Se o e-mail já for de um usuário desta marcenaria, ele vira administrador e a senha é opcional.">
            {empresa.admins.length === 0 ? (
              <p className="mb-4 text-sm font-medium text-[var(--m-total)]">Esta marcenaria ainda não tem administrador.</p>
            ) : (
              <ul className="mb-4 space-y-1 text-sm">
                {empresa.admins.map((a) => (
                  <li key={a.id}><span className="font-semibold">{a.nome ?? a.email}</span> <span className="text-[var(--m-ink-2)]">{a.email}</span></li>
                ))}
              </ul>
            )}
            <form onSubmit={salvarAdmin} className="grid gap-3 border-t border-[var(--m-line)] pt-4 sm:grid-cols-4 sm:items-end">
              <div className="space-y-1.5">
                <Label htmlFor="ea-nome">Nome</Label>
                <Input id="ea-nome" value={admin.nome} onChange={(e) => setAdmin((a) => ({ ...a, nome: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ea-email">E-mail</Label>
                <Input id="ea-email" type="email" autoComplete="off" value={admin.email} onChange={(e) => setAdmin((a) => ({ ...a, email: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ea-senha">Senha (usuário novo)</Label>
                <Input id="ea-senha" type="password" autoComplete="new-password" value={admin.senha} onChange={(e) => setAdmin((a) => ({ ...a, senha: e.target.value }))} />
              </div>
              <Button type="submit" disabled={definirAdmin.isPending}>Definir administrador</Button>
            </form>
          </Painel>
        </TabsContent>

        <TabsContent value="paginas">
          {paginas ? (
            <PaginasEditor
              modo="empresa"
              bloqueadasPlano={paginas.plano_bloqueadas}
              planoNome={paginas.plano_nome}
              ajustes={paginas.ajustes}
              salvando={salvarPaginas.isPending}
              onSalvar={async (aj) => {
                try {
                  await salvarPaginas.mutateAsync({ empresaId: id, ajustes: aj })
                  toast.success('Páginas salvas. Os usuários da marcenaria veem a mudança ao recarregar.')
                } catch (err) {
                  toast.error(erroMsg(err, 'Não foi possível salvar as páginas'))
                }
              }}
            />
          ) : (
            <Vazio>Carregando páginas…</Vazio>
          )}
        </TabsContent>

        <TabsContent value="usuarios">
          <div className="overflow-x-auto rounded-md border border-[var(--m-line)] bg-[var(--m-surface)]">
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
                {usuarios.length === 0 ? (
                  <TableRow><TableCell colSpan={5}><Vazio>Nenhum usuário.</Vazio></TableCell></TableRow>
                ) : usuarios.map((u) => (
                  <TableRow key={u.user_id}>
                    <TableCell>
                      <div className="font-medium">{u.nome ?? '—'}</div>
                      <div className="text-[0.78rem] text-[var(--m-ink-2)]">{u.email}</div>
                    </TableCell>
                    <TableCell>{u.perfil ? PERFIL_LABEL[u.perfil] ?? u.perfil : '—'}{!u.ativo ? ' (inativo)' : ''}</TableCell>
                    <TableCell className="text-sm">{u.crm_roles.join(', ') || '—'}</TableCell>
                    <TableCell className="m-num text-sm">{u.ultimo_acesso ? new Date(u.ultimo_acesso).toLocaleString('pt-BR') : 'Nunca'}</TableCell>
                    <TableCell>
                      <Button variant="ghost" size="icon" aria-label={`Redefinir senha de ${u.nome ?? u.email}`}
                        onClick={() => setSenhaPara({ id: u.user_id, nome: u.nome ?? u.email ?? 'usuário' })}>
                        <KeyRound className="h-4 w-4" aria-hidden />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        <TabsContent value="mensalidades">
          <div className="overflow-x-auto rounded-md border border-[var(--m-line)] bg-[var(--m-surface)]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Competência</TableHead>
                  <TableHead>Vencimento</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                  <TableHead>Situação</TableHead>
                  <TableHead>Paga em</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {cobrancas.length === 0 ? (
                  <TableRow><TableCell colSpan={5}><Vazio>Nenhuma mensalidade gerada. Configure a assinatura em Mensalidades.</Vazio></TableCell></TableRow>
                ) : cobrancas.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell>{competenciaBR(c.competencia)}</TableCell>
                    <TableCell className="m-num">{dataBR(c.vencimento)}</TableCell>
                    <TableCell className="m-num text-right">{brl(c.valor)}</TableCell>
                    <TableCell className={cn('text-sm', COBRANCA_COR[c.status])}>{STATUS_COBRANCA_LABEL[c.status]}</TableCell>
                    <TableCell className="m-num">{dataBR(c.pago_em)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <p className="mt-3 text-sm text-[var(--m-ink-2)]">
            Para dar baixa ou mudar o valor, use <Link to="/master/financeiro" className="font-medium text-[var(--m-accent)] underline underline-offset-2">Mensalidades</Link>.
          </p>
        </TabsContent>

        <TabsContent value="acessos">
          <AcessosTabela acessos={acessos} mostrarEmpresa={false} />
        </TabsContent>
      </Tabs>

      <Modal open={!!senhaPara} onClose={() => setSenhaPara(null)} title={`Nova senha para ${senhaPara?.nome ?? ''}`}>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="es-senha">Nova senha</Label>
            <Input id="es-senha" type="password" autoComplete="new-password" value={novaSenha} onChange={(e) => setNovaSenha(e.target.value)} />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setSenhaPara(null)}>Cancelar</Button>
            <Button onClick={() => void salvarSenha()} disabled={redefinirSenha.isPending}>Salvar senha</Button>
          </div>
        </div>
      </Modal>
      <EntrarEmpresaDialog empresa={entrar} onClose={() => setEntrar(null)} />
    </MasterPage>
  )
}
