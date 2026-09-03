import { useMemo, useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  AtSign,
  MapPin,
  Pencil,
  Phone,
  Plus,
  Search,
  Trash2,
  UserRound,
  Users,
} from 'lucide-react'
import { useClientes } from '../hooks/useClientes'
import { Modal } from '../components/ui/Modal'
import { ModalFormFooter } from '../components/ui/ModalFormFooter'
import { Field } from '../components/ui/Field'
import { EmptyState, LoadingState, ErrorState } from '../components/ui/EmptyState'
import { ClientesHeroAura } from '../components/clientes/ClientesHeroAura'
import type { ClienteInput } from '../types'
import { fmtDate } from '../lib/utils'
import { cn } from '@/lib/utils'

const BLANK: ClienteInput = {
  nome: '',
  cpf: '',
  telefone: '',
  email: '',
  endereco: '',
  origem: 'Manual',
}

interface Props {
  readOnly?: boolean
}

function initials(nome: string): string {
  const parts = nome.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase()
}

export function Clientes({ readOnly }: Props) {
  const { data, loading, error, create, update, remove } = useClientes()
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState<ClienteInput>(BLANK)
  const [editId, setEditId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [search, setSearch] = useState('')
  const [searchParams, setSearchParams] = useSearchParams()
  const buscaDaUrl = searchParams.get('q')

  useEffect(() => {
    const termo = buscaDaUrl?.trim()
    if (!termo) return
    setSearch(termo)
    setSearchParams(
      (prev) => {
        if (!prev.has('q')) return prev
        const next = new URLSearchParams(prev)
        next.delete('q')
        return next
      },
      { replace: true },
    )
  }, [buscaDaUrl, setSearchParams])

  const f = (k: keyof ClienteInput) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((p) => ({ ...p, [k]: e.target.value }))

  const openNew = () => {
    setForm(BLANK)
    setEditId(null)
    setOpen(true)
  }
  const openEdit = (id: string, item: ClienteInput) => {
    setForm(item)
    setEditId(id)
    setOpen(true)
  }

  const save = async () => {
    if (!form.nome.trim()) return
    setSaving(true)
    try {
      if (editId) await update(editId, form)
      else await create(form)
      setOpen(false)
    } finally {
      setSaving(false)
    }
  }

  const normalizedSearch = search.trim().toLowerCase()
  const filteredData = useMemo(
    () =>
      data.filter((cliente) => {
        if (!normalizedSearch) return true
        const haystack = [
          cliente.nome,
          cliente.telefone ?? '',
          cliente.email ?? '',
          cliente.origem ?? '',
          cliente.cpf ?? '',
          cliente.endereco ?? '',
        ]
          .join(' ')
          .toLowerCase()
        return haystack.includes(normalizedSearch)
      }),
    [data, normalizedSearch],
  )

  const stats = useMemo(() => {
    const comTelefone = filteredData.filter((c) => Boolean(c.telefone?.trim())).length
    const comEmail = filteredData.filter((c) => Boolean(c.email?.trim())).length
    return { total: filteredData.length, comTelefone, comEmail }
  }, [filteredData])

  return (
    <div className="clientes-page fade-in space-y-6 pb-8">
      {/* Hero — ateliê: madeira + folha de ouro */}
      <section className="clientes-hero relative overflow-hidden rounded-2xl border border-[rgba(242,216,146,0.22)] shadow-[0_24px_60px_-28px_rgba(0,0,0,0.75)]">
        <div
          className="absolute inset-0 bg-gradient-to-br from-[#1a0e08] via-[#120a07] to-[#0a0604]"
          aria-hidden
        />
        <ClientesHeroAura className="opacity-95" />
        <div
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_20%_30%,rgba(242,216,146,0.14),transparent_55%),radial-gradient(ellipse_at_90%_80%,rgba(140,70,30,0.2),transparent_50%)]"
          aria-hidden
        />

        <div className="relative z-10 flex flex-col gap-6 px-5 py-7 sm:px-8 sm:py-9 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-xl space-y-3">
            <p className="font-display text-[0.68rem] tracking-[0.32em] text-[#f2d892]/80 drop-shadow-[0_1px_8px_rgba(0,0,0,0.65)]">
              CARTEIRA · MOVELARIA
            </p>
            <h1 className="font-display text-[2.15rem] leading-[1.05] tracking-[0.06em] text-[#f2d892] drop-shadow-[0_2px_14px_rgba(0,0,0,0.7)] sm:text-[2.65rem]">
              Clientes
            </h1>
            <p className="max-w-md text-sm leading-relaxed text-[#fff6ea]/88 drop-shadow-[0_1px_10px_rgba(0,0,0,0.55)] sm:text-[0.95rem]">
              Quem já escolheu a Garbo. Busque, edite e mantenha o contato — o ateliê
              começa pelo nome certo.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="flex flex-wrap gap-2">
              <StatChip icon={Users} label="Na lista" value={stats.total} />
              <StatChip icon={Phone} label="Com celular" value={stats.comTelefone} />
              <StatChip icon={AtSign} label="Com e-mail" value={stats.comEmail} />
            </div>
            {!readOnly && (
              <button
                type="button"
                className="btn btn-gold btn-md inline-flex items-center gap-2 shadow-[0_0_24px_-6px_rgba(242,216,146,0.55)] transition-transform duration-300 hover:scale-[1.02] motion-reduce:transform-none"
                onClick={openNew}
              >
                <Plus size={16} strokeWidth={2.25} />
                Novo Cliente
              </button>
            )}
          </div>
        </div>
      </section>

      <Modal open={open} onClose={() => setOpen(false)} title={editId ? 'EDITAR CLIENTE' : 'NOVO CLIENTE'}>
        <Field label="Nome Completo *">
          <input
            className="glass-input"
            value={form.nome}
            onChange={f('nome')}
            placeholder="Nome completo do cliente"
          />
        </Field>
        <Field label="CPF">
          <input
            className="glass-input"
            value={form.cpf ?? ''}
            onChange={f('cpf')}
            placeholder="000.000.000-00"
          />
        </Field>
        <Field label="Celular">
          <input
            className="glass-input"
            value={form.telefone ?? ''}
            onChange={f('telefone')}
            placeholder="(00) 00000-0000"
          />
        </Field>
        <Field label="E-mail">
          <input
            className="glass-input"
            type="email"
            value={form.email ?? ''}
            onChange={f('email')}
            placeholder="cliente@email.com"
          />
        </Field>
        <Field label="Endereço">
          <input
            className="glass-input"
            value={form.endereco ?? ''}
            onChange={f('endereco')}
            placeholder="Rua, Nº, Bairro, Cidade – UF"
          />
        </Field>
        <Field label="Origem">
          <input
            className="glass-input"
            value={form.origem ?? ''}
            onChange={f('origem')}
            placeholder="Manual ou origem do lead"
          />
        </Field>
        <ModalFormFooter
          onCancel={() => setOpen(false)}
          onSubmit={save}
          submitLabel={editId ? 'Salvar' : 'Cadastrar'}
          submitting={saving}
          submitDisabled={!form.nome.trim()}
        />
      </Modal>

      {/* Busca */}
      <div className="relative">
        <Search
          size={16}
          className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[#c4a06a]/80"
          aria-hidden
        />
        <input
          className="glass-input pl-10"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por nome, telefone, e-mail, origem, CPF ou endereço…"
          aria-label="Buscar clientes"
        />
      </div>

      {/* Lista */}
      <div className="glass-card overflow-hidden border border-[rgba(242,216,146,0.14)]">
        {loading ? (
          <LoadingState />
        ) : error ? (
          <ErrorState message={error} />
        ) : filteredData.length === 0 ? (
          <EmptyState message="Nenhum cliente encontrado." />
        ) : (
          <>
            {/* Mobile: cartões de contato */}
            <ul className="divide-y divide-[rgba(242,216,146,0.1)] md:hidden">
              {filteredData.map((c, index) => (
                <li
                  key={c.id}
                  className="clientes-row px-4 py-4"
                  style={{ animationDelay: `${Math.min(index, 12) * 35}ms` }}
                >
                  <div className="flex items-start gap-3">
                    <span
                      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-[rgba(242,216,146,0.35)] bg-[rgba(242,216,146,0.08)] font-display text-xs tracking-wider text-[#f2d892]"
                      aria-hidden
                    >
                      {initials(c.nome)}
                    </span>
                    <div className="min-w-0 flex-1 space-y-1.5">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="truncate font-medium text-[#fffaf4]">{c.nome}</p>
                          <p className="text-[0.72rem] uppercase tracking-wider text-[#c4a06a]/75">
                            {c.origem || 'Manual'} · {fmtDate(c.data_cadastro || c.criado_em)}
                          </p>
                        </div>
                        {!readOnly && (
                          <div className="flex shrink-0 gap-1.5">
                            <button
                              type="button"
                              className="btn btn-outline btn-sm"
                              aria-label={`Editar ${c.nome}`}
                              onClick={() =>
                                openEdit(c.id, {
                                  nome: c.nome,
                                  cpf: c.cpf,
                                  telefone: c.telefone,
                                  email: c.email,
                                  endereco: c.endereco,
                                  origem: c.origem,
                                })
                              }
                            >
                              <Pencil size={13} />
                            </button>
                            <button
                              type="button"
                              className="btn btn-danger btn-sm"
                              aria-label={`Excluir ${c.nome}`}
                              onClick={() => remove(c.id)}
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        )}
                      </div>
                      <div className="space-y-1 text-[0.82rem] text-[#edd9c4]/90">
                        {c.telefone ? (
                          <p className="flex items-center gap-1.5">
                            <Phone size={12} className="shrink-0 text-[#c4a06a]" />
                            {c.telefone}
                          </p>
                        ) : null}
                        {c.email ? (
                          <p className="flex items-center gap-1.5 truncate">
                            <AtSign size={12} className="shrink-0 text-[#c4a06a]" />
                            {c.email}
                          </p>
                        ) : null}
                        {c.endereco ? (
                          <p className="flex items-start gap-1.5">
                            <MapPin size={12} className="mt-0.5 shrink-0 text-[#c4a06a]" />
                            <span className="line-clamp-2">{c.endereco}</span>
                          </p>
                        ) : null}
                      </div>
                    </div>
                  </div>
                </li>
              ))}
            </ul>

            {/* Desktop: tabela editorial */}
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="border-b border-[rgba(242,216,146,0.16)] bg-[rgba(0,0,0,0.22)]">
                    {['Cliente', 'CPF', 'Celular', 'E-mail', 'Origem', 'Cadastro', 'Endereço', ''].map(
                      (h, i) => (
                        <th key={i} className="section-label px-4 py-3.5 text-left">
                          {h}
                        </th>
                      ),
                    )}
                  </tr>
                </thead>
                <tbody>
                  {filteredData.map((c, index) => (
                    <tr
                      key={c.id}
                      className="clientes-row trow border-b border-[rgba(242,216,146,0.06)] transition-colors duration-200 hover:bg-[rgba(242,216,146,0.04)]"
                      style={{ animationDelay: `${Math.min(index, 16) * 28}ms` }}
                    >
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-3">
                          <span
                            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[rgba(242,216,146,0.28)] bg-[rgba(242,216,146,0.07)] font-display text-[0.65rem] tracking-wider text-[#f2d892]"
                            aria-hidden
                          >
                            {initials(c.nome)}
                          </span>
                          <span className="font-medium text-[#fffaf4]">{c.nome}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3.5 text-[0.85rem] text-[#edd9c4]">{c.cpf || '—'}</td>
                      <td className="px-4 py-3.5 text-[0.85rem] text-[#edd9c4]">
                        {c.telefone || '—'}
                      </td>
                      <td className="px-4 py-3.5 text-[0.85rem] text-[#edd9c4]">{c.email || '—'}</td>
                      <td className="px-4 py-3.5">
                        <span className="inline-flex items-center gap-1 rounded-full border border-[rgba(242,216,146,0.2)] bg-[rgba(242,216,146,0.06)] px-2.5 py-0.5 text-[0.72rem] tracking-wide text-[#f2d892]/90">
                          <UserRound size={11} />
                          {c.origem || 'Manual'}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-[0.82rem] text-[#edd9c4]">
                        {fmtDate(c.data_cadastro || c.criado_em)}
                      </td>
                      <td
                        className="max-w-[200px] truncate px-4 py-3.5 text-[0.82rem] text-[#edd9c4]"
                        title={c.endereco || undefined}
                      >
                        {c.endereco || '—'}
                      </td>
                      <td className="px-4 py-3.5 text-right">
                        {!readOnly && (
                          <div className="flex justify-end gap-2">
                            <button
                              type="button"
                              className="btn btn-outline btn-sm"
                              aria-label={`Editar ${c.nome}`}
                              onClick={() =>
                                openEdit(c.id, {
                                  nome: c.nome,
                                  cpf: c.cpf,
                                  telefone: c.telefone,
                                  email: c.email,
                                  endereco: c.endereco,
                                  origem: c.origem,
                                })
                              }
                            >
                              <Pencil size={13} />
                            </button>
                            <button
                              type="button"
                              className="btn btn-danger btn-sm"
                              aria-label={`Excluir ${c.nome}`}
                              onClick={() => remove(c.id)}
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      <style>{`
        @keyframes clientes-row-in {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .clientes-row {
          animation: clientes-row-in 0.45s ease-out both;
        }
        @media (prefers-reduced-motion: reduce) {
          .clientes-row {
            animation: none;
          }
        }
      `}</style>
    </div>
  )
}

function StatChip({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Users
  label: string
  value: number
}) {
  return (
    <div
      className={cn(
        'flex min-w-[7.5rem] flex-col gap-0.5 rounded-xl border border-[rgba(242,216,146,0.22)]',
        'bg-[rgba(10,6,4,0.55)] px-3.5 py-2.5 backdrop-blur-sm',
      )}
    >
      <span className="flex items-center gap-1.5 text-[0.65rem] uppercase tracking-[0.18em] text-[#c4a06a]">
        <Icon size={12} strokeWidth={2} />
        {label}
      </span>
      <span className="font-display text-xl tracking-wide text-[#f2d892] tabular-nums">
        {value}
      </span>
    </div>
  )
}
