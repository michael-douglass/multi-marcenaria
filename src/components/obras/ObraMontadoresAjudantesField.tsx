import { useState } from 'react'
import { ChevronDown, ChevronUp, Loader2, Shield, User } from 'lucide-react'
import { getObraMontadorIds, getObraMontadorNomes } from '@/lib/obra-montadores'
import type { ObraFull } from '@/types'

interface MontadorOption {
  id: string
  nome?: string | null
  email: string
  perfil: string
}

interface ObraMontadoresAjudantesFieldProps {
  obra: Pick<
    ObraFull,
    | 'montador_id'
    | 'montador_ids'
    | 'montador_nome'
    | 'montador_nomes'
    | 'montador_admin_id'
    | 'montador_admin_nome'
  >
  montadores: MontadorOption[]
  canEdit: boolean
  loading?: boolean
  onChange: (montadorIds: string[]) => void
  /** Define o montador administrador da obra (campo separado dos ajudantes). */
  onChangeAdmin?: (montadorAdminId: string | null) => void
  /** Versão enxuta para o card do kanban. */
  compact?: boolean
}

function displayMontadorName(m: Pick<MontadorOption, 'nome' | 'email'>): string {
  return m.nome?.trim() || m.email.split('@')[0] || m.email
}

/**
 * Lista de montadores com checkbox: marcado = vai atuar (ajudante) na obra.
 * Também permite designar o Montador Admin.
 * Salva direto no card, sem precisar abrir o formulário de edição.
 */
export function ObraMontadoresAjudantesField({
  obra,
  montadores,
  canEdit,
  loading = false,
  onChange,
  onChangeAdmin,
  compact = false,
}: ObraMontadoresAjudantesFieldProps) {
  const options = montadores.filter(m => m.perfil === 'montador' || m.perfil === 'montador_admin')
  const adminOptions = montadores.filter(m => m.perfil === 'montador_admin')
  const selectedIds = getObraMontadorIds(obra)
  const selectedNomes = getObraMontadorNomes(obra)
  const adminId = obra.montador_admin_id ?? null
  const adminNome =
    obra.montador_admin_nome?.trim()
    || adminOptions.find(m => m.id === adminId)?.nome?.trim()
    || (adminId ? displayMontadorName(adminOptions.find(m => m.id === adminId) ?? { nome: null, email: 'Admin' }) : null)

  const canEditAdmin = canEdit && !!onChangeAdmin
  const [listaAberta, setListaAberta] = useState(false)
  const mostrarLista = !compact || listaAberta

  const toggle = (id: string) => {
    if (!canEdit || loading) return
    if (selectedIds.includes(id)) {
      onChange(selectedIds.filter(x => x !== id))
      return
    }
    onChange([...selectedIds, id])
  }

  const handleAdminChange = (value: string) => {
    if (!canEditAdmin || loading) return
    onChangeAdmin(value || null)
  }

  // Só leitura: mantém o título "Montadores" visível no card com quem já está na obra.
  if (!canEdit) {
    if (selectedNomes.length === 0 && selectedIds.length === 0 && !adminNome) return null
    return (
      <div
        className={[
          'min-w-0 w-full rounded-md border border-[rgba(240,210,140,0.14)] bg-[rgba(10,4,2,0.35)]',
          compact ? 'px-2 py-1.5' : 'px-3 py-2.5',
        ].join(' ')}
        onClick={e => e.stopPropagation()}
      >
        <p className="text-[0.65rem] uppercase tracking-wider text-[#edd9c4]">Montadores</p>
        {adminNome && (
          <div className={`mt-1.5 flex min-w-0 items-center gap-1.5 ${compact ? 'text-[0.52rem]' : 'text-[0.65rem]'}`}>
            <Shield size={compact ? 9 : 11} className="shrink-0 text-[#f2d892]" aria-hidden />
            <span className="truncate text-[#d4bc9f]">Admin:</span>
            <span className="truncate font-medium text-[#f2d892]">{adminNome}</span>
          </div>
        )}
        {(selectedNomes.length > 0 || selectedIds.length > 0) && (
          <div className={`mt-1.5 flex flex-wrap ${compact ? 'gap-1' : 'gap-1.5'}`}>
            {(selectedNomes.length > 0 ? selectedNomes : selectedIds.map(() => 'Montador')).map((nome, i) => (
              <span
                key={`${nome}-${i}`}
                className={[
                  'inline-flex max-w-full min-w-0 items-center gap-1 rounded-full border border-[rgba(240,210,140,0.25)] bg-[rgba(240,210,140,0.1)] font-medium text-[#f2d892]',
                  compact ? 'px-1.5 py-0.5 text-[0.52rem]' : 'px-2 py-0.5 text-[0.65rem]',
                ].join(' ')}
              >
                <User size={compact ? 9 : 11} className="shrink-0" aria-hidden />
                <span className="truncate min-w-0">{nome}</span>
              </span>
            ))}
          </div>
        )}
      </div>
    )
  }

  if (options.length === 0 && adminOptions.length === 0) {
    return (
      <div
        className="min-w-0 w-full rounded-md border border-[rgba(240,210,140,0.14)] px-2 py-1.5 bg-[rgba(10,4,2,0.35)]"
        onClick={e => e.stopPropagation()}
      >
        <p className="text-[0.65rem] uppercase tracking-wider text-[#edd9c4]">Montadores</p>
        <p className={`mt-1 text-[#edd9c4] ${compact ? 'text-[0.58rem]' : 'text-xs'}`}>
          Nenhum montador cadastrado.
        </p>
      </div>
    )
  }

  return (
    <div
      className={[
        'min-w-0 w-full rounded-md border border-[rgba(240,210,140,0.14)] bg-[rgba(10,4,2,0.35)]',
        compact ? 'px-2 py-1.5' : 'px-3 py-2.5',
      ].join(' ')}
      onClick={e => e.stopPropagation()}
    >
      <div className="mb-1.5 flex min-w-0 items-center justify-between gap-2">
        <p className="text-[0.65rem] uppercase tracking-wider text-[#edd9c4]">Montadores</p>
        {loading ? (
          <Loader2 size={12} className="animate-spin shrink-0 text-[#f2d892]" aria-label="Salvando" />
        ) : (
          <span className={`shrink-0 tabular-nums text-[#f2d892] ${compact ? 'text-[0.52rem]' : 'text-[0.6rem]'}`}>
            {selectedIds.length}/{options.length}
          </span>
        )}
      </div>

      {/* Montador Admin — no card compacto só aparece ao abrir a lista */}
      {canEditAdmin && (!compact || listaAberta) && (
        <div className={compact ? 'mb-1.5' : 'mb-2.5'}>
          <label className={`mb-1 flex items-center gap-1 text-[#d4bc9f] ${compact ? 'text-[0.52rem]' : 'text-[0.62rem]'}`}>
            <Shield size={compact ? 9 : 11} className="shrink-0 text-[#f2d892]" aria-hidden />
            Montador Admin
          </label>
          {adminOptions.length === 0 ? (
            <p className={`text-[#edd9c4] ${compact ? 'text-[0.52rem]' : 'text-xs'}`}>
              Nenhum montador admin cadastrado.
            </p>
          ) : (
            <select
              className={[
                'glass-input w-full min-w-0',
                compact ? 'h-7 py-0 text-[0.58rem]' : 'text-sm',
              ].join(' ')}
              value={adminId ?? ''}
              disabled={loading}
              onClick={e => e.stopPropagation()}
              onChange={e => handleAdminChange(e.target.value)}
              aria-label="Montador administrador da obra"
            >
              <option value="">— Nenhum —</option>
              {adminOptions.map(m => (
                <option key={m.id} value={m.id}>
                  {displayMontadorName(m)}
                </option>
              ))}
            </select>
          )}
        </div>
      )}

      {options.length > 0 && (
        <>
          {compact ? (
            <div className="mb-1 flex min-w-0 flex-col gap-1">
              {!listaAberta && selectedNomes.length === 0 ? (
                <p className="text-[0.52rem] leading-snug text-[#d4bc9f]">Nenhum montador definido.</p>
              ) : null}
              <button
                type="button"
                className="inline-flex w-fit items-center gap-1 text-[0.52rem] font-semibold text-[#f2d892] hover:underline"
                onClick={e => {
                  e.stopPropagation()
                  setListaAberta(v => !v)
                }}
              >
                {listaAberta ? <ChevronUp size={10} aria-hidden /> : <ChevronDown size={10} aria-hidden />}
                {listaAberta ? 'Fechar lista' : 'Definir montadores'}
              </button>
            </div>
          ) : (
            <p className="mb-1.5 text-[0.62rem] leading-snug text-[#d4bc9f]">
              Marque quem será ajudante nesta obra.
            </p>
          )}

          {mostrarLista && (
          <div
            className={[
              'flex flex-col',
              compact ? 'gap-1 max-h-[9.5rem] overflow-y-auto overscroll-contain pr-0.5' : 'gap-1.5',
            ].join(' ')}
          >
            {options.map(m => {
              const checked = selectedIds.includes(m.id)
              const label = `${displayMontadorName(m)}${m.perfil === 'montador_admin' ? ' (Admin)' : ''}`
              return (
                <label
                  key={m.id}
                  className={[
                    'flex min-w-0 items-center gap-2 rounded-md border transition-colors',
                    compact ? 'px-1.5 py-1' : 'px-2.5 py-2',
                    checked
                      ? 'border-[rgba(240,210,140,0.4)] bg-[rgba(240,210,140,0.1)]'
                      : 'border-[rgba(240,210,140,0.12)] bg-[rgba(255,255,255,0.02)]',
                    !loading
                      ? 'cursor-pointer hover:border-[rgba(240,210,140,0.3)]'
                      : 'cursor-default opacity-90',
                  ].join(' ')}
                  title={checked ? `${label} vai atuar nesta obra` : `${label} não será ajudante nesta obra`}
                >
                  <input
                    type="checkbox"
                    className="shrink-0 accent-[#f2d892]"
                    checked={checked}
                    disabled={loading}
                    onChange={() => toggle(m.id)}
                    onClick={e => e.stopPropagation()}
                  />
                  <User
                    size={compact ? 10 : 12}
                    className="shrink-0 text-[#f2d892]"
                    aria-hidden
                  />
                  <span
                    className={[
                      'min-w-0 flex-1 truncate text-cream',
                      compact ? 'text-[0.58rem]' : 'text-[0.72rem]',
                    ].join(' ')}
                  >
                    {label}
                  </span>
                </label>
              )
            })}
          </div>
          )}
        </>
      )}
    </div>
  )
}
