import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useApp } from '@/context/AppContext'
import { useFuncionarios, type FuncionarioListagem } from '@/hooks/useFuncionarios'
import { FuncionarioFolderCard } from '@/components/funcionarios/FuncionarioFolderCard'
import { ExportarDocumentosChecklistButton } from '@/components/funcionarios/ExportarDocumentosChecklistButton'
import { Modal } from '@/components/ui/Modal'
import { ModalFormFooter } from '@/components/ui/ModalFormFooter'
import { Field } from '@/components/ui/Field'
import { EmptyState, LoadingState, ErrorState } from '@/components/ui/EmptyState'
import { FUNCIONARIO_TIPO_LABEL } from '@/lib/funcionario-constants'
import { isPastaPontoRegistrosRestrita } from '@/lib/role-access'
import type { FuncionarioInput, FuncionarioTipo } from '@/types'

const BLANK: FuncionarioInput = { nome: '', tipo: 'montador' }

interface Props {
  readOnly?: boolean
}

export function Funcionarios({ readOnly }: Props) {
  const { roles } = useApp()
  const pastaPontoRestrita = isPastaPontoRegistrosRestrita(roles)
  const [searchParams, setSearchParams] = useSearchParams()
  const abaInicial: FuncionarioListagem =
    searchParams.get('aba') === 'dispensados' ? 'dispensados' : 'ativos'
  const [aba, setAba] = useState<FuncionarioListagem>(abaInicial)
  const { data, loading, error, create } = useFuncionarios({ listagem: aba })
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState<FuncionarioInput>(BLANK)
  const [saving, setSaving] = useState(false)
  const [search, setSearch] = useState('')
  const [filtroTipo, setFiltroTipo] = useState<FuncionarioTipo | 'todos'>('todos')
  const [createdNome, setCreatedNome] = useState<string | null>(null)

  const mudarAba = (nova: FuncionarioListagem) => {
    setAba(nova)
    if (nova === 'dispensados') {
      setSearchParams({ aba: 'dispensados' })
    } else {
      setSearchParams({})
    }
  }

  const filtered = useMemo(() => data.filter(f => {
    if (filtroTipo !== 'todos' && f.tipo !== filtroTipo) return false
    const q = search.trim().toLowerCase()
    if (!q) return true
    return [f.nome, f.email ?? '', f.telefone ?? '', f.cpf ?? ''].join(' ').toLowerCase().includes(q)
  }), [data, filtroTipo, search])

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
          <h1 className="font-display text-[2.2rem] tracking-[.08em] text-[#f2d892]">
            {pastaPontoRestrita ? 'Pastas de ponto' : 'Funcionários'}
          </h1>
          <p className="section-label mt-1">
            {pastaPontoRestrita
              ? aba === 'ativos'
                ? `${filtered.length} pasta${filtered.length !== 1 ? 's' : ''} da equipe`
                : `${filtered.length} pasta${filtered.length !== 1 ? 's' : ''} de histórico`
              : aba === 'ativos'
                ? `${filtered.length} colaborador${filtered.length !== 1 ? 'es' : ''} ativo${filtered.length !== 1 ? 's' : ''}`
                : `${filtered.length} dispensado${filtered.length !== 1 ? 's' : ''} (somente histórico)`}
          </p>
        </div>
        {!pastaPontoRestrita && (
          <div className="flex flex-wrap items-center gap-2">
            <ExportarDocumentosChecklistButton />
            {!readOnly && aba === 'ativos' && (
              <button type="button" className="btn btn-gold btn-md" onClick={() => { setForm(BLANK); setOpen(true) }}>
                + Novo Funcionário
              </button>
            )}
          </div>
        )}
      </div>

      <nav
        className="mb-5 flex gap-1 rounded-xl border border-[rgba(212,168,83,0.2)] bg-[rgba(36,16,8,0.45)] p-1"
        aria-label="Abas de funcionários"
      >
        <button
          type="button"
          onClick={() => mudarAba('ativos')}
          className={`flex-1 rounded-lg px-4 py-2.5 text-sm font-medium transition ${
            aba === 'ativos'
              ? 'bg-[rgba(240,210,140,0.14)] text-[#f2d892]'
              : 'text-[#b8957f] hover:text-[#edd9c4]'
          }`}
        >
          Ativos
        </button>
        <button
          type="button"
          onClick={() => mudarAba('dispensados')}
          className={`flex-1 rounded-lg px-4 py-2.5 text-sm font-medium transition ${
            aba === 'dispensados'
              ? 'bg-[rgba(240,210,140,0.14)] text-[#f2d892]'
              : 'text-[#b8957f] hover:text-[#edd9c4]'
          }`}
        >
          Dispensados
        </button>
      </nav>

      {createdNome && (
        <div className="glass-card mb-5 flex flex-wrap items-center justify-between gap-3 border border-emerald-500/30 p-4">
          <div>
            <p className="font-medium text-emerald-300">Funcionário cadastrado!</p>
            <p className="mt-1 text-sm text-[#b8957f]">
              Pasta criada para <strong className="text-[#edd9c4]">{createdNome}</strong>.
            </p>
          </div>
          <button type="button" className="btn btn-outline btn-sm" onClick={() => setCreatedNome(null)}>
            Fechar
          </button>
        </div>
      )}

      {pastaPontoRestrita && aba === 'ativos' && (
        <p className="glass-card mb-5 border border-sky-500/20 bg-sky-500/5 p-4 text-sm text-[#edd9c4]">
          Abra a pasta para ver os registros de ponto e lançar batidas manuais da equipe.
          O ponto da sua titularidade não pode ser alterado.
        </p>
      )}

      {aba === 'dispensados' && (
        <p className="glass-card mb-5 border border-violet-500/20 bg-violet-500/5 p-4 text-sm text-[#edd9c4]">
          {pastaPontoRestrita
            ? 'Pastas de quem já saiu. Você consulta só o histórico de ponto.'
            : 'Funcionários dispensados não aparecem no ponto nem nas operações do dia a dia. Aqui você consulta apenas o histórico: documentos, recibos e batidas antigas.'}
        </p>
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
          {(pastaPontoRestrita
            ? (['montador', 'montador_admin', 'administrador_obras'] as FuncionarioTipo[])
            : (Object.keys(FUNCIONARIO_TIPO_LABEL) as FuncionarioTipo[])
          ).map(t => (
            <option key={t} value={t}>{FUNCIONARIO_TIPO_LABEL[t]}</option>
          ))}
        </select>
      </div>

      {loading && <LoadingState />}
      {!loading && error && <ErrorState message={error} />}
      {!loading && !error && filtered.length === 0 && (
        <EmptyState
          title={aba === 'ativos' ? 'Nenhuma pasta encontrada' : 'Nenhum funcionário dispensado'}
          description={
            pastaPontoRestrita
              ? aba === 'ativos'
                ? 'Ainda não há pastas de ponto da equipe para você.'
                : 'Não há pastas de histórico no momento.'
              : aba === 'ativos'
                ? 'Cadastre o primeiro funcionário para começar.'
                : 'Quando um administrador dispensar alguém, a pasta aparecerá aqui.'
          }
        />
      )}

      {!loading && !error && filtered.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filtered.map(f => (
            <FuncionarioFolderCard
              key={f.id}
              funcionario={f}
              dispensado={aba === 'dispensados'}
              pontoOnly={pastaPontoRestrita}
            />
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
