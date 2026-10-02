import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { FolderOpen } from 'lucide-react'
import { useApp } from '@/context/AppContext'
import { useFuncionarios, type FuncionarioListagem } from '@/hooks/useFuncionarios'
import { FuncionarioFolderCard } from '@/components/funcionarios/FuncionarioFolderCard'
import { FuncionariosPageAura } from '@/components/funcionarios/FuncionariosPageAura'
import { EscritorioArquivosPanel } from '@/components/funcionarios/EscritorioArquivosPanel'
import { ExportarDocumentosChecklistButton } from '@/components/funcionarios/ExportarDocumentosChecklistButton'
import { Modal } from '@/components/ui/Modal'
import { ModalFormFooter } from '@/components/ui/ModalFormFooter'
import { Field } from '@/components/ui/Field'
import { EmptyState, LoadingState, ErrorState } from '@/components/ui/EmptyState'
import {
  FUNCIONARIO_CATEGORIA_LABEL,
  FUNCIONARIO_CATEGORIAS,
  FUNCIONARIO_TIPO_LABEL,
  FUNCIONARIO_TIPOS_CADASTRO,
  categoriaPadraoPorTipo,
} from '@/lib/funcionario-constants'
import { canViewMarkupCustos, isPastaPontoRegistrosRestrita } from '@/lib/role-access'
import { showToast } from '@/lib/toast'
import type { FuncionarioCategoria, FuncionarioInput, FuncionarioTipo } from '@/types'

const BLANK: FuncionarioInput = {
  nome: '',
  tipo: 'design',
  categoria: 'design',
}

type AbaFuncionarios = FuncionarioListagem | 'escritorio'

function parseAba(raw: string | null, podeEscritorio: boolean): AbaFuncionarios {
  if (raw === 'dispensados') return 'dispensados'
  if (raw === 'escritorio' && podeEscritorio) return 'escritorio'
  return 'ativos'
}

interface Props {
  readOnly?: boolean
}

export function Funcionarios({ readOnly }: Props) {
  const { roles } = useApp()
  const pastaPontoRestrita = isPastaPontoRegistrosRestrita(roles)
  /** Contabilidade/escritório: só Administrador e Financeiro. */
  const podeEscritorio = canViewMarkupCustos(roles) && !pastaPontoRestrita
  const [searchParams, setSearchParams] = useSearchParams()
  const [aba, setAba] = useState<AbaFuncionarios>(() =>
    parseAba(searchParams.get('aba'), podeEscritorio),
  )
  const listagem: FuncionarioListagem = aba === 'dispensados' ? 'dispensados' : 'ativos'
  const { data, loading, error, create } = useFuncionarios({ listagem })
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState<FuncionarioInput>(BLANK)
  const [saving, setSaving] = useState(false)
  const [search, setSearch] = useState('')
  const [filtroTipo, setFiltroTipo] = useState<FuncionarioTipo | 'todos'>('todos')
  const [filtroCategoria, setFiltroCategoria] = useState<FuncionarioCategoria | 'todos'>('todos')
  const [createdNome, setCreatedNome] = useState<string | null>(null)

  const mudarAba = (nova: AbaFuncionarios) => {
    setAba(nova)
    if (nova === 'dispensados') {
      setSearchParams({ aba: 'dispensados' })
    } else if (nova === 'escritorio') {
      setSearchParams({ aba: 'escritorio' })
    } else {
      setSearchParams({})
    }
  }

  const filtered = useMemo(() => data.filter(f => {
    if (filtroTipo !== 'todos' && f.tipo !== filtroTipo) return false
    if (filtroCategoria !== 'todos' && f.categoria !== filtroCategoria) return false
    const q = search.trim().toLowerCase()
    if (!q) return true
    return [f.nome, f.email ?? '', f.telefone ?? '', f.cpf ?? '', f.categoria ?? '']
      .join(' ')
      .toLowerCase()
      .includes(q)
  }), [data, filtroTipo, filtroCategoria, search])

  const save = async () => {
    if (!form.nome.trim()) {
      showToast('Informe o nome completo do funcionário.', 'error')
      return
    }
    setSaving(true)
    try {
      const row = await create({
        ...form,
        categoria: form.categoria ?? categoriaPadraoPorTipo(form.tipo),
      })
      setCreatedNome(row.nome)
      setOpen(false)
      setForm(BLANK)
      showToast(`Pasta de ${row.nome} criada.`, 'success')
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : 'Não foi possível criar a pasta.',
        'error',
      )
    } finally {
      setSaving(false)
    }
  }

  const emptyMessage = pastaPontoRestrita
    ? aba === 'ativos'
      ? 'Ainda não há pastas de ponto da equipe para você.'
      : 'Não há pastas de histórico no momento.'
    : aba === 'ativos'
      ? 'Cadastre o primeiro funcionário para começar.'
      : 'Quando um administrador dispensar alguém, a pasta aparecerá aqui.'

  return (
    <div className="cobrancas-page-shell funcionarios-page-shell fade-in relative -mx-2 -mt-2 min-h-[calc(100svh-4.25rem)] px-3 pb-10 sm:-mx-3 sm:-mt-3 sm:px-4 md:px-8">
      <FuncionariosPageAura />
      <div className="relative z-[1] mx-auto max-w-6xl pt-4 md:pt-8">
      <header className="mb-6 overflow-hidden rounded-2xl border border-[rgba(26,16,12,0.12)] bg-[#fffaf4] px-5 py-6 shadow-[0_12px_32px_rgba(42,24,18,0.06)] sm:px-8 sm:py-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-[#6b3f12]">
              <FolderOpen className="h-3.5 w-3.5" aria-hidden />
              {aba === 'escritorio'
                ? 'Arquivo do escritório'
                : pastaPontoRestrita
                  ? 'Arquivo de ponto'
                  : 'Arquivo de RH'}
            </p>
            <h1 className="mt-2 font-display text-3xl tracking-[0.06em] text-[#1a100c] sm:text-5xl">
              {aba === 'escritorio'
                ? 'Escritório'
                : pastaPontoRestrita
                  ? 'Pastas de ponto'
                  : 'Funcionários'}
            </h1>
            <p className="mt-2 text-sm text-[#4a3428] sm:text-base">
              {aba === 'escritorio'
                ? 'Pastas de contabilidade e documentos administrativos'
                : pastaPontoRestrita
                  ? aba === 'ativos'
                    ? `${filtered.length} pasta${filtered.length !== 1 ? 's' : ''} da equipe`
                    : `${filtered.length} pasta${filtered.length !== 1 ? 's' : ''} de histórico`
                  : aba === 'ativos'
                    ? `${filtered.length} colaborador${filtered.length !== 1 ? 'es' : ''} ativo${filtered.length !== 1 ? 's' : ''}`
                    : `${filtered.length} dispensado${filtered.length !== 1 ? 's' : ''} (somente histórico)`}
            </p>
          </div>
          {!pastaPontoRestrita && aba !== 'escritorio' && (
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
      </header>

      <nav
        className="mb-5 flex gap-1 rounded-xl border border-[rgba(26,16,12,0.14)] bg-[#fffaf4] p-1 shadow-[0_8px_24px_rgba(42,24,18,0.05)]"
        aria-label="Abas de funcionários"
      >
        <button
          type="button"
          onClick={() => mudarAba('ativos')}
          className={`flex-1 rounded-lg px-4 py-2.5 text-sm font-semibold transition ${
            aba === 'ativos'
              ? 'bg-[#f4e4c4] text-[#6b3f12]'
              : 'text-[#4a3428] hover:bg-[rgba(26,16,12,0.04)] hover:text-[#1a100c]'
          }`}
        >
          Ativos
        </button>
        <button
          type="button"
          onClick={() => mudarAba('dispensados')}
          className={`flex-1 rounded-lg px-4 py-2.5 text-sm font-semibold transition ${
            aba === 'dispensados'
              ? 'bg-[#f4e4c4] text-[#6b3f12]'
              : 'text-[#4a3428] hover:bg-[rgba(26,16,12,0.04)] hover:text-[#1a100c]'
          }`}
        >
          Dispensados
        </button>
        {podeEscritorio && (
          <button
            type="button"
            onClick={() => mudarAba('escritorio')}
            className={`flex-1 rounded-lg px-4 py-2.5 text-sm font-semibold transition ${
              aba === 'escritorio'
                ? 'bg-[#f4e4c4] text-[#6b3f12]'
                : 'text-[#4a3428] hover:bg-[rgba(26,16,12,0.04)] hover:text-[#1a100c]'
            }`}
          >
            Escritório
          </button>
        )}
      </nav>

      {aba === 'escritorio' ? (
        <EscritorioArquivosPanel readOnly={readOnly} />
      ) : (
        <>
          {createdNome && (
            <div className="glass-card mb-5 flex flex-wrap items-center justify-between gap-3 border border-emerald-800/25 bg-emerald-50 p-4">
              <div>
                <p className="font-medium text-emerald-900">Funcionário cadastrado!</p>
                <p className="mt-1 text-sm text-[#4a3428]">
                  Pasta criada para <strong className="text-[#1a100c]">{createdNome}</strong>.
                  Folha de ponto liberada e nome disponível em Métricas de Obras para definir o fixo.
                </p>
              </div>
              <button type="button" className="btn btn-outline btn-sm" onClick={() => setCreatedNome(null)}>
                Fechar
              </button>
            </div>
          )}

          {pastaPontoRestrita && aba === 'ativos' && (
            <p className="glass-card mb-5 border border-sky-800/20 bg-sky-50 p-4 text-sm text-[#1a100c]">
              Abra a pasta para ver os registros de ponto e lançar batidas manuais da equipe.
              O ponto da sua titularidade não pode ser alterado.
            </p>
          )}

          {aba === 'dispensados' && (
            <p className="glass-card mb-5 border border-violet-800/20 bg-violet-50 p-4 text-sm text-[#1a100c]">
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
                : FUNCIONARIO_TIPOS_CADASTRO
              ).map(t => (
                <option key={t} value={t}>{FUNCIONARIO_TIPO_LABEL[t]}</option>
              ))}
            </select>
            {!pastaPontoRestrita && (
              <select
                className="glass-input sm:w-48"
                value={filtroCategoria}
                onChange={e => setFiltroCategoria(e.target.value as FuncionarioCategoria | 'todos')}
              >
                <option value="todos">Todas as categorias</option>
                {FUNCIONARIO_CATEGORIAS.map(c => (
                  <option key={c} value={c}>{FUNCIONARIO_CATEGORIA_LABEL[c]}</option>
                ))}
              </select>
            )}
          </div>

          {loading && <LoadingState />}
          {!loading && error && <ErrorState message={error} />}
          {!loading && !error && filtered.length === 0 && (
            <EmptyState message={emptyMessage} />
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
            <Field label="Tipo de pasta *">
              <select
                className="glass-input"
                value={form.tipo}
                onChange={e => {
                  const tipo = e.target.value as FuncionarioTipo
                  setForm(p => ({
                    ...p,
                    tipo,
                    categoria: categoriaPadraoPorTipo(tipo),
                  }))
                }}
              >
                {FUNCIONARIO_TIPOS_CADASTRO.map(t => (
                  <option key={t} value={t}>{FUNCIONARIO_TIPO_LABEL[t]}</option>
                ))}
              </select>
              <p className="mt-1 text-xs text-[#b8957f]">
                Escolha o tipo da pasta: Design, Projetista, Montador, Financeiro e outros.
                A pessoa ganha folha de ponto e aparece no fixo de Métricas.
              </p>
            </Field>
            <Field label="Telefone">
              <input className="glass-input" value={form.telefone ?? ''} onChange={e => setForm(p => ({ ...p, telefone: e.target.value }))} />
            </Field>
            <Field label="E-mail">
              <input type="email" className="glass-input" value={form.email ?? ''} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} />
            </Field>
            <ModalFormFooter
              onCancel={() => setOpen(false)}
              onSubmit={() => void save()}
              submitting={saving}
              submitLabel="Criar pasta"
              submittingLabel="Criando..."
              submitDisabled={!form.nome.trim()}
            />
          </Modal>
        </>
      )}
      </div>
    </div>
  )
}
