import { useState, useEffect } from 'react'
import { Pencil, Trash2, KeyRound, UserPlus, ShieldCheck, ToggleLeft, ToggleRight } from 'lucide-react'
import { useUsuarios, type UsuarioAdmin } from '../hooks/useUsuarios'
import { useApp } from '../context/AppContext'
import { Modal } from '../components/ui/Modal'
import { ModalFormFooter } from '../components/ui/ModalFormFooter'
import { Field } from '../components/ui/Field'
import { LoadingState, ErrorState, EmptyState } from '../components/ui/EmptyState'
import { showToast } from '../lib/toast'

type TabCriacao = 'novo' | 'existente'

// ── Perfis disponíveis ───────────────────────────────────────
const PERFIS = [
  { value: 'administrador',  label: 'Administrador',  cor: '#f2d892' },
  { value: 'financeiro',     label: 'Financeiro',     cor: '#3b82f6' },
  { value: 'marceneiro',     label: 'Marceneiro',     cor: '#8b5cf6' },
  { value: 'montador',       label: 'Montador',       cor: '#f59e0b' },
  { value: 'montador_admin', label: 'Montador Admin', cor: '#10b981' },
  { value: 'administrador_obras', label: 'Administrador de Obras', cor: '#fb923c' },
  { value: 'visualizador', label: 'Visualizador', cor: '#a78bfa' },
]

function PerfilBadge({ perfil }: { perfil: string }) {
  const p = PERFIS.find(x => x.value === perfil)
  if (!p) return <span className="text-[#edd9c4] text-xs">{perfil}</span>
  return (
    <span
      className="rounded-full px-2.5 py-0.5 text-[0.68rem] font-bold uppercase tracking-wide"
      style={{ backgroundColor: `${p.cor}20`, color: p.cor, border: `1px solid ${p.cor}40` }}
    >
      {p.label}
    </span>
  )
}

function PerfisBadges({ perfil, perfis_extras }: { perfil: string; perfis_extras: string[] }) {
  const all = [perfil, ...(perfis_extras ?? [])]
  return (
    <div className="flex flex-wrap gap-1">
      {all.map(p => <PerfilBadge key={p} perfil={p} />)}
    </div>
  )
}

// ── Modal criar/editar usuário ───────────────────────────────
interface UserFormState {
  email: string
  nome: string
  perfil: string
  perfis_extras: string[]
  senha: string
  confirmSenha: string
}

const BLANK_FORM: UserFormState = {
  email: '', nome: '', perfil: 'marceneiro', perfis_extras: [], senha: '', confirmSenha: '',
}

function UserModal({
  open, editUser, onClose, onSave, saving,
}: {
  open: boolean
  editUser: UsuarioAdmin | null
  onClose: () => void
  onSave: (form: UserFormState, tab: TabCriacao) => Promise<void>
  saving: boolean
}) {
  const [tab, setTab] = useState<TabCriacao>('novo')
  const [form, setForm] = useState<UserFormState>(BLANK_FORM)
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setTab('novo')
    setErr(null)
    if (editUser) {
      setForm({ email: editUser.email, nome: editUser.nome ?? '', perfil: editUser.perfil, perfis_extras: editUser.perfis_extras ?? [], senha: '', confirmSenha: '' })
    } else {
      setForm(BLANK_FORM)
    }
  }, [open, editUser])

  const f = (k: keyof UserFormState) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const value = e.target.value
    setForm(p => {
      const updated = { ...p, [k]: value }
      if (k === 'perfil') {
        updated.perfis_extras = p.perfis_extras.filter(x => x !== value)
      }
      return updated
    })
  }

  const handleSave = async () => {
    setErr(null)
    if (!form.email.trim()) return setErr('E-mail obrigatório.')
    if (!editUser && tab === 'novo') {
      if (!form.senha) return setErr('Senha obrigatória.')
      if (form.senha !== form.confirmSenha) return setErr('Senhas não coincidem.')
      if (form.senha.length < 6) return setErr('Senha mínima: 6 caracteres.')
    }
    if (!editUser && tab === 'existente' && form.senha) {
      if (form.senha !== form.confirmSenha) return setErr('Senhas não coincidem.')
      if (form.senha.length < 6) return setErr('Senha mínima: 6 caracteres.')
    }
    await onSave(form, tab)
  }

  return (
    <Modal open={open} onClose={onClose} title={editUser ? 'EDITAR USUÁRIO' : 'NOVO USUÁRIO'}>

      {/* Tabs de criação (só no modo criar) */}
      {!editUser && (
        <div className="flex gap-1 mb-4 p-1 rounded-lg" style={{ backgroundColor: 'rgba(0,0,0,0.2)' }}>
          {([
            { key: 'novo' as TabCriacao, label: 'Criar novo usuário' },
            { key: 'existente' as TabCriacao, label: 'Registrar usuário existente' },
          ]).map(t => (
            <button
              key={t.key}
              onClick={() => { setTab(t.key); setErr(null) }}
              className="flex-1 rounded py-1.5 text-xs font-semibold transition-colors"
              style={tab === t.key
                ? { backgroundColor: 'rgba(240,210,140,0.2)', color: '#f2d892' }
                : { color: '#edd9c4' }
              }
            >
              {t.label}
            </button>
          ))}
        </div>
      )}

      {/* Campos comuns */}
      <Field label="E-mail *">
        <input
          type="email" className="glass-input"
          value={form.email} onChange={f('email')}
          placeholder="usuario@dominio.com"
          autoComplete="off"
          disabled={!!editUser}
          style={editUser ? { opacity: 0.5 } : undefined}
        />
      </Field>

      <Field label="Nome">
        <input className="glass-input" value={form.nome} onChange={f('nome')} placeholder="Nome completo" autoComplete="off" />
      </Field>

      <Field label="Perfil principal *">
        <select className="glass-input" value={form.perfil} onChange={f('perfil')}>
          {PERFIS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
        </select>
      </Field>

      <Field label="Perfis adicionais">
        <div className="flex flex-col gap-1.5 mt-0.5">
          {PERFIS.filter(p => p.value !== form.perfil).map(p => {
            const checked = form.perfis_extras.includes(p.value)
            return (
              <label key={p.value} className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => setForm(prev => ({
                    ...prev,
                    perfis_extras: checked
                      ? prev.perfis_extras.filter(x => x !== p.value)
                      : [...prev.perfis_extras, p.value],
                  }))}
                  className="accent-[#f2d892] w-3.5 h-3.5 shrink-0"
                />
                <span
                  className="rounded-full px-2 py-0.5 text-[0.65rem] font-bold uppercase tracking-wide"
                  style={{ backgroundColor: `${p.cor}20`, color: p.cor, border: `1px solid ${p.cor}40` }}
                >
                  {p.label}
                </span>
              </label>
            )
          })}
        </div>
      </Field>

      {/* Campos exclusivos: criar novo */}
      {!editUser && tab === 'novo' && (
        <>
          <Field label="Senha temporária *">
            <input type="password" className="glass-input" value={form.senha} onChange={f('senha')} placeholder="Mínimo 6 caracteres" autoComplete="new-password" />
          </Field>
          <Field label="Confirmar senha *">
            <input type="password" className="glass-input" value={form.confirmSenha} onChange={f('confirmSenha')} placeholder="Repita a senha" autoComplete="new-password" />
          </Field>
          <p className="text-[0.72rem] text-[#edd9c4]">O usuário poderá alterar a senha após o primeiro acesso.</p>
        </>
      )}

      {/* Campos: registrar existente + senha opcional */}
      {!editUser && tab === 'existente' && (
        <>
          <div className="rounded-lg p-3 text-[0.75rem] text-[#edd9c4]" style={{ backgroundColor: 'rgba(240,210,140,0.08)', border: '1px solid rgba(240,210,140,0.15)' }}>
            Usuário que já tem conta no sistema (ex.: CRM). O perfil Movelaria será criado e a senha definida abaixo permitirá o login.
          </div>
          <Field label="Definir senha (opcional)">
            <input type="password" className="glass-input" value={form.senha} onChange={f('senha')} placeholder="Deixe em branco para manter a senha atual" autoComplete="new-password" />
          </Field>
          {form.senha && (
            <Field label="Confirmar senha">
              <input type="password" className="glass-input" value={form.confirmSenha} onChange={f('confirmSenha')} placeholder="Repita a senha" autoComplete="new-password" />
            </Field>
          )}
        </>
      )}

      {err && <p className="text-[0.8rem] text-red-400 mt-1">{err}</p>}

      <ModalFormFooter
        onCancel={onClose}
        onSubmit={handleSave}
        submitting={saving}
        submitLabel={editUser ? 'Salvar' : tab === 'novo' ? 'Criar usuário' : 'Registrar acesso'}
      />
    </Modal>
  )
}

// ── Modal redefinir senha ────────────────────────────────────
function SenhaModal({
  open, user, onClose, onSave, saving,
}: {
  open: boolean
  user: UsuarioAdmin | null
  onClose: () => void
  onSave: (senha: string, perfil: string) => Promise<void>
  saving: boolean
}) {
  const [senha, setSenha] = useState('')
  const [confirm, setConfirm] = useState('')
  const [perfil, setPerfil] = useState('marceneiro')
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setSenha(''); setConfirm(''); setErr(null)
    setPerfil(user?.perfil ?? 'marceneiro')
  }, [open, user])

  const handleSave = async () => {
    setErr(null)
    if (!senha) return setErr('Senha obrigatória.')
    if (senha.length < 6) return setErr('Mínimo 6 caracteres.')
    if (senha !== confirm) return setErr('Senhas não coincidem.')
    await onSave(senha, perfil)
  }

  return (
    <Modal open={open} onClose={onClose} title="REDEFINIR SENHA">
      <p className="text-sm text-[#edd9c4] mb-3">
        Usuário: <span className="text-cream font-semibold">{user?.email}</span>
      </p>
      <Field label="Perfil *">
        <select className="glass-input" value={perfil} onChange={e => setPerfil(e.target.value)}>
          {PERFIS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
        </select>
      </Field>
      <Field label="Nova senha *">
        <input type="password" className="glass-input" value={senha} onChange={e => setSenha(e.target.value)} placeholder="Mínimo 6 caracteres" autoComplete="new-password" />
      </Field>
      <Field label="Confirmar *">
        <input type="password" className="glass-input" value={confirm} onChange={e => setConfirm(e.target.value)} placeholder="Repita a senha" autoComplete="new-password" />
      </Field>
      {err && <p className="text-[0.8rem] text-red-400">{err}</p>}
      <ModalFormFooter onCancel={onClose} onSubmit={handleSave} submitting={saving} submitLabel="Redefinir" />
    </Modal>
  )
}

// ── Modal confirmar exclusão ─────────────────────────────────
function ConfirmDeleteModal({
  open, user, onClose, onConfirm, saving,
}: {
  open: boolean
  user: UsuarioAdmin | null
  onClose: () => void
  onConfirm: () => Promise<void>
  saving: boolean
}) {
  return (
    <Modal open={open} onClose={onClose} title="CONFIRMAR EXCLUSÃO">
      <p className="text-sm text-[#edd9c4]">
        Deseja <span className="text-red-400 font-semibold">excluir permanentemente</span> o usuário:
      </p>
      <p className="mt-1 font-semibold text-cream">{user?.email}</p>
      <p className="mt-2 text-xs text-[#edd9c4]">
        Esta ação é irreversível e remove o acesso imediatamente.
      </p>
      <div className="flex justify-end gap-2 mt-4">
        <button onClick={onClose} className="btn btn-outline btn-md">Cancelar</button>
        <button
          onClick={onConfirm} disabled={saving}
          className="btn btn-md font-semibold"
          style={{ backgroundColor: '#ef444420', color: '#f87171', border: '1px solid #ef444440' }}
        >
          {saving ? 'Excluindo...' : 'Excluir'}
        </button>
      </div>
    </Modal>
  )
}

// ── Página principal ─────────────────────────────────────────
export function Configuracoes() {
  const { userProfile } = useApp()
  const hook = useUsuarios()

  const [userModalOpen, setUserModalOpen] = useState(false)
  const [editUser, setEditUser] = useState<UsuarioAdmin | null>(null)
  const [savingUser, setSavingUser] = useState(false)

  const [senhaModalOpen, setSenhaModalOpen] = useState(false)
  const [senhaUser, setSenhaUser] = useState<UsuarioAdmin | null>(null)
  const [savingSenha, setSavingSenha] = useState(false)

  const [deleteModalOpen, setDeleteModalOpen] = useState(false)
  const [deleteUser, setDeleteUser] = useState<UsuarioAdmin | null>(null)
  const [savingDelete, setSavingDelete] = useState(false)

  const openNovo = () => { setEditUser(null); setUserModalOpen(true) }
  const openEditar = (u: UsuarioAdmin) => { setEditUser(u); setUserModalOpen(true) }

  const handleSaveUser = async (form: UserFormState, tab: TabCriacao) => {
    setSavingUser(true)
    try {
      if (editUser) {
        await hook.atualizar(editUser.id, form.perfil, form.nome || null, editUser.ativo, form.perfis_extras)
        showToast('Usuário atualizado.', 'success')
      } else if (tab === 'existente') {
        await hook.registrarExistente(form.email, form.nome, form.perfil, form.senha || undefined)
        showToast('Usuário registrado com sucesso.', 'success')
      } else {
        await hook.criar(form.email, form.senha, form.nome, form.perfil)
        showToast('Usuário criado com sucesso.', 'success')
      }
      setUserModalOpen(false)
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Erro ao salvar usuário.', 'error')
    } finally {
      setSavingUser(false)
    }
  }

  const handleToggleAtivo = async (u: UsuarioAdmin) => {
    try {
      await hook.atualizar(u.id, u.perfil, u.nome, !u.ativo)
      showToast(u.ativo ? 'Usuário desativado.' : 'Usuário reativado.', 'success')
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Erro.', 'error')
    }
  }

  const handleRedefinirSenha = async (senha: string, perfil: string) => {
    if (!senhaUser) return
    setSavingSenha(true)
    try {
      await hook.redefinirSenha(senhaUser.id, senha, perfil, senhaUser.nome)
      // Recarrega lista para refletir mudança de perfil
      await hook.reload()
      showToast('Senha redefinida com sucesso.', 'success')
      setSenhaModalOpen(false)
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Erro ao redefinir senha.', 'error')
    } finally {
      setSavingSenha(false)
    }
  }

  const handleExcluir = async () => {
    if (!deleteUser) return
    setSavingDelete(true)
    try {
      await hook.excluir(deleteUser.id)
      showToast('Usuário excluído.', 'success')
      setDeleteModalOpen(false)
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Erro ao excluir.', 'error')
    } finally {
      setSavingDelete(false)
    }
  }

  const ativos = hook.data.filter(u => u.ativo)
  const inativos = hook.data.filter(u => !u.ativo)

  return (
    <div className="fade-in">
      {/* Cabeçalho */}
      <div className="flex items-start justify-between mb-6 gap-4 flex-wrap">
        <div>
          <h1 className="font-display" style={{ fontSize: '2.2rem', color: '#f2d892', letterSpacing: '.08em' }}>
            Configurações
          </h1>
          <p className="section-label mt-1">
            {ativos.length} usuário{ativos.length !== 1 ? 's' : ''} ativo{ativos.length !== 1 ? 's' : ''}
            {inativos.length > 0 && ` · ${inativos.length} inativo${inativos.length !== 1 ? 's' : ''}`}
          </p>
        </div>
        <button
          type="button"
          className="btn btn-gold btn-md flex items-center gap-1.5"
          onClick={openNovo}
        >
          <UserPlus size={14} /> Novo Usuário
        </button>
      </div>

      {hook.loading && <LoadingState />}
      {!hook.loading && hook.error && <ErrorState message={hook.error} />}

      {!hook.loading && !hook.error && hook.data.length === 0 && (
        <EmptyState message="Nenhum usuário encontrado." />
      )}

      {!hook.loading && !hook.error && hook.data.length > 0 && (
        <div className="glass-card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[rgba(240,210,140,0.12)]">
                {['Usuário', 'Perfil', 'Status', 'Criado em', 'Ações'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-[0.7rem] uppercase tracking-wider text-[#edd9c4]">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {hook.data.map((u, i) => {
                const isMe = u.id === userProfile?.id
                return (
                  <tr
                    key={u.id}
                    className={`border-b border-[rgba(240,210,140,0.06)] transition-colors ${i % 2 === 0 ? 'bg-[rgba(255,255,255,0.01)]' : ''} ${!u.ativo ? 'opacity-50' : ''}`}
                  >
                    {/* Usuário */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div
                          className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 text-[0.65rem] font-bold"
                          style={{ backgroundColor: 'rgba(240,210,140,0.15)', color: '#f2d892' }}
                        >
                          {(u.nome ?? u.email).charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="font-semibold text-cream">
                            {u.nome ?? <span className="text-[#edd9c4] italic">sem nome</span>}
                            {isMe && (
                              <span className="ml-1.5 text-[0.6rem] bg-[#f2d892]/15 text-[#f2d892] rounded px-1">você</span>
                            )}
                          </p>
                          <p className="text-[0.72rem] text-[#edd9c4]">{u.email}</p>
                        </div>
                      </div>
                    </td>

                    {/* Perfil */}
                    <td className="px-4 py-3">
                      <PerfisBadges perfil={u.perfil} perfis_extras={u.perfis_extras} />
                    </td>

                    {/* Status */}
                    <td className="px-4 py-3">
                      <span className={`text-[0.72rem] font-semibold ${u.ativo ? 'text-emerald-400' : 'text-[#edd9c4]'}`}>
                        {u.ativo ? '● Ativo' : '○ Inativo'}
                      </span>
                    </td>

                    {/* Criado em */}
                    <td className="px-4 py-3 text-[0.75rem] text-[#edd9c4]">
                      {new Date(u.criado_em).toLocaleDateString('pt-BR')}
                    </td>

                    {/* Ações */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        {/* Editar */}
                        <button
                          title="Editar usuário"
                          onClick={() => openEditar(u)}
                          className="p-1.5 rounded text-[#edd9c4] hover:text-[#f2d892] hover:bg-[rgba(240,210,140,0.1)] transition-colors"
                        >
                          <Pencil size={13} />
                        </button>

                        {/* Redefinir senha */}
                        <button
                          title="Redefinir senha"
                          onClick={() => { setSenhaUser(u); setSenhaModalOpen(true) }}
                          className="p-1.5 rounded text-[#edd9c4] hover:text-blue-400 hover:bg-blue-400/10 transition-colors"
                        >
                          <KeyRound size={13} />
                        </button>

                        {/* Ativar / Desativar */}
                        {!isMe && (
                          <button
                            title={u.ativo ? 'Desativar usuário' : 'Reativar usuário'}
                            onClick={() => handleToggleAtivo(u)}
                            className={`p-1.5 rounded transition-colors ${u.ativo ? 'text-[#edd9c4] hover:text-amber-400 hover:bg-amber-400/10' : 'text-[#edd9c4] hover:text-emerald-400 hover:bg-emerald-400/10'}`}
                          >
                            {u.ativo ? <ToggleRight size={15} /> : <ToggleLeft size={15} />}
                          </button>
                        )}

                        {/* Excluir */}
                        {!isMe && (
                          <button
                            title="Excluir usuário"
                            onClick={() => { setDeleteUser(u); setDeleteModalOpen(true) }}
                            className="p-1.5 rounded text-[#edd9c4] hover:text-red-400 hover:bg-red-400/10 transition-colors"
                          >
                            <Trash2 size={13} />
                          </button>
                        )}

                        {isMe && (
                          <span title="Seu próprio usuário">
                            <ShieldCheck size={14} className="text-[#f2d892] ml-1" />
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Legenda de perfis */}
      {!hook.loading && (
        <div className="mt-6 flex flex-wrap gap-3">
          {PERFIS.map(p => (
            <div key={p.value} className="flex items-center gap-1.5 text-[0.72rem] text-[#edd9c4]">
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: p.cor }} />
              {p.label}
            </div>
          ))}
        </div>
      )}

      {/* Modais */}
      <UserModal
        open={userModalOpen}
        editUser={editUser}
        onClose={() => setUserModalOpen(false)}
        onSave={(form, tab) => handleSaveUser(form, tab)}
        saving={savingUser}
      />

      <SenhaModal
        open={senhaModalOpen}
        user={senhaUser}
        onClose={() => setSenhaModalOpen(false)}
        onSave={(senha, perfil) => handleRedefinirSenha(senha, perfil)}
        saving={savingSenha}
      />

      <ConfirmDeleteModal
        open={deleteModalOpen}
        user={deleteUser}
        onClose={() => setDeleteModalOpen(false)}
        onConfirm={handleExcluir}
        saving={savingDelete}
      />
    </div>
  )
}
