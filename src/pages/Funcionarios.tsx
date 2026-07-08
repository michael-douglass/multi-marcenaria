import { useState } from 'react'
import { useFuncionarios } from '@/hooks/useFuncionarios'
import { FuncionarioFolderCard } from '@/components/funcionarios/FuncionarioFolderCard'
import { Modal } from '@/components/ui/Modal'
import { ModalFormFooter } from '@/components/ui/ModalFormFooter'
import { Field } from '@/components/ui/Field'
import { EmptyState, LoadingState, ErrorState } from '@/components/ui/EmptyState'
import { FUNCIONARIO_TIPO_LABEL } from '@/lib/funcionario-constants'
import type { FuncionarioInput, FuncionarioTipo } from '@/types'

const BLANK: FuncionarioInput = { nome: '', tipo: 'montador' }

interface Props {
  readOnly?: boolean
}

export function Funcionarios({ readOnly }: Props) {
  const { data, loading, error, create } = useFuncionarios()
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState<FuncionarioInput>(BLANK)
  const [saving, setSaving] = useState(false)
  const [search, setSearch] = useState('')
  const [filtroTipo, setFiltroTipo] = useState<FuncionarioTipo | 'todos'>('todos')
  const [createdNome, setCreatedNome] = useState<string | null>(null)

  const filtered = data.filter(f => {
    if (filtroTipo !== 'todos' && f.tipo !== filtroTipo) return false
    const q = search.trim().toLowerCase()
    if (!q) return true
    return [f.nome, f.email ?? '', f.telefone ?? '', f.cpf ?? ''].join(' ').toLowerCase().includes(q)
  })

  const save = async () => {
    if (!form.nome.trim()) return
    setSaving(true)
    try {
      const row = await create(form)
      setCreatedNome(row.nome)
      setOpen(false)
      setForm(BLANK)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fade-in">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-[2.2rem] tracking-[.08em] text-[#f2d892]">Funcionários</h1>
          <p className="section-label mt-1">
            {filtered.length} pasta{filtered.length !== 1 ? 's' : ''} de colaboradores
          </p>
        </div>
        {!readOnly && (
          <button type="button" className="btn btn-gold btn-md" onClick={() => { setForm(BLANK); setOpen(true) }}>
            + Novo Funcionário
          </button>
        )}
      </div>

      {createdNome && (
        <div className="glass-card mb-5 flex flex-wrap items-center justify-between gap-3 border border-emerald-500/30 p-4">
          <div>
            <p className="font-medium text-emerald-300">Funcionário cadastrado!</p>
            <p className="mt-1 text-sm text-[#b8957f]">
              Pasta criada para <strong className="text-[#edd9c4]">{createdNome}</strong>.
              Se o usuário já existir no sistema com o mesmo e-mail, o vínculo é automático.
              Caso contrário, crie o login em Configurações — a pasta será vinculada sozinha.
            </p>
          </div>
          <button type="button" className="btn btn-outline btn-sm" onClick={() => setCreatedNome(null)}>
            Fechar
          </button>
        </div>
      )}

      <div className="glass-card mb-5 flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
        <input
          className="glass-input flex-1"
          placeholder="Buscar por nome, e-mail, telefone…"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <select className="glass-input sm:w-48" value={filtroTipo} onChange={e => setFiltroTipo(e.target.value as FuncionarioTipo | 'todos')}>
          <option value="todos">Todos os tipos</option>
          {(Object.keys(FUNCIONARIO_TIPO_LABEL) as FuncionarioTipo[]).map(t => (
            <option key={t} value={t}>{FUNCIONARIO_TIPO_LABEL[t]}</option>
          ))}
        </select>
      </div>

      {loading && <LoadingState />}
      {!loading && error && <ErrorState message={error} />}
      {!loading && !error && filtered.length === 0 && (
        <EmptyState title="Nenhuma pasta encontrada" description="Cadastre o primeiro funcionário para começar." />
      )}

      {!loading && !error && filtered.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filtered.map(f => (
            <FuncionarioFolderCard key={f.id} funcionario={f} />
          ))}
        </div>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title="NOVO FUNCIONÁRIO">
        <Field label="Nome completo *">
          <input className="glass-input" value={form.nome} onChange={e => setForm(p => ({ ...p, nome: e.target.value }))} />
        </Field>
        <Field label="Tipo *">
          <select className="glass-input" value={form.tipo} onChange={e => setForm(p => ({ ...p, tipo: e.target.value as FuncionarioTipo }))}>
            {(Object.keys(FUNCIONARIO_TIPO_LABEL) as FuncionarioTipo[]).map(t => (
              <option key={t} value={t}>{FUNCIONARIO_TIPO_LABEL[t]}</option>
            ))}
          </select>
        </Field>
        <Field label="Telefone">
          <input className="glass-input" value={form.telefone ?? ''} onChange={e => setForm(p => ({ ...p, telefone: e.target.value }))} />
        </Field>
        <Field label="E-mail">
          <input type="email" className="glass-input" value={form.email ?? ''} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} />
        </Field>
        <ModalFormFooter onCancel={() => setOpen(false)} onSave={() => void save()} saving={saving} saveLabel="Criar pasta" />
      </Modal>
    </div>
  )
}
