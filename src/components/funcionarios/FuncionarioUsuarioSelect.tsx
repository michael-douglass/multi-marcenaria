import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { Check, ChevronDown, Search, UserX } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  buscarUsuarios,
  contarUsuariosPorOrigem,
  toUsuarioOpcao,
  USUARIO_ORIGEM_LABEL,
  type UsuarioOpcao,
  type UsuarioOrigemFiltro,
} from '@/lib/funcionario-usuario-busca'
import type { UsuarioAdmin } from '@/hooks/useUsuarios'
import { FuncionarioUsuarioAura } from './FuncionarioUsuarioAura'

interface Props {
  usuarios: UsuarioAdmin[]
  value: string | null
  /** '' = sem vínculo. */
  onChange: (usuarioId: string) => void
  disabled?: boolean
  /** Perfil de login esperado pelo tipo da pasta — marca os "recomendados". */
  perfilEsperado?: string
}

const FILTROS: { id: UsuarioOrigemFiltro; label: string }[] = [
  { id: 'todas', label: 'Todos' },
  { id: 'movelaria', label: 'Movelaria' },
  { id: 'crm', label: 'CRM' },
]

export function FuncionarioUsuarioSelect({
  usuarios,
  value,
  onChange,
  disabled,
  perfilEsperado,
}: Props) {
  const rootRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLUListElement>(null)
  const listId = useId()

  const [open, setOpen] = useState(false)
  const [focused, setFocused] = useState(false)
  const [query, setQuery] = useState('')
  const [origem, setOrigem] = useState<UsuarioOrigemFiltro>('todas')
  const [incluirInativos, setIncluirInativos] = useState(false)
  const [activeIndex, setActiveIndex] = useState(0)

  const selecionado = useMemo<UsuarioOpcao | null>(() => {
    const u = usuarios.find(item => item.id === value)
    return u ? toUsuarioOpcao(u, perfilEsperado) : null
  }, [usuarios, value, perfilEsperado])

  const contagem = useMemo(
    () => contarUsuariosPorOrigem(usuarios, incluirInativos),
    [usuarios, incluirInativos],
  )

  const opcoes = useMemo(
    () =>
      buscarUsuarios(usuarios, {
        perfilEsperado,
        query,
        origem,
        incluirInativos,
        manterId: value,
      }),
    [usuarios, perfilEsperado, query, origem, incluirInativos, value],
  )

  const inativosExistem = useMemo(() => usuarios.some(u => !u.ativo), [usuarios])

  useEffect(() => {
    setActiveIndex(0)
  }, [query, origem, incluirInativos])

  useEffect(() => {
    if (!open) return
    const onPointerDown = (event: PointerEvent) => {
      const root = rootRef.current
      if (!root || !(event.target instanceof Node)) return
      if (!root.contains(event.target)) {
        setOpen(false)
        setFocused(false)
        setQuery('')
      }
    }
    document.addEventListener('pointerdown', onPointerDown)
    return () => document.removeEventListener('pointerdown', onPointerDown)
  }, [open])

  useEffect(() => {
    if (!open) return
    requestAnimationFrame(() => inputRef.current?.focus())
  }, [open])

  // Mantém o item destacado sempre visível na rolagem.
  useEffect(() => {
    if (!open) return
    const item = listRef.current?.querySelector<HTMLElement>('[data-active="true"]')
    item?.scrollIntoView({ block: 'nearest' })
  }, [open, activeIndex, opcoes.length])

  const escolher = (usuarioId: string) => {
    onChange(usuarioId)
    setOpen(false)
    setFocused(false)
    setQuery('')
  }

  const abrir = () => {
    if (disabled) return
    setOpen(true)
    setFocused(true)
  }

  const activeId = opcoes[activeIndex] ? `${listId}-${opcoes[activeIndex].id}` : undefined

  return (
    <div ref={rootRef} className="fn-user-pick relative min-w-0 flex-1">
      {!open ? (
        <button
          type="button"
          disabled={disabled}
          className={cn('fn-user-pick__trigger', disabled && 'is-disabled')}
          aria-haspopup="listbox"
          aria-expanded={false}
          onClick={abrir}
        >
          <span className="fn-user-pick__trigger-body">
            {selecionado ? (
              <>
                <span className="fn-user-pick__name">{selecionado.nome}</span>
                <span className="fn-user-pick__meta">
                  <span className="fn-user-pick__tag">
                    {USUARIO_ORIGEM_LABEL[selecionado.origem]}
                  </span>
                  {selecionado.acessos.slice(0, 2).map(acesso => (
                    <span key={acesso} className="fn-user-pick__tag is-soft">
                      {acesso}
                    </span>
                  ))}
                  {!selecionado.ativo && <span className="fn-user-pick__tag is-off">Inativo</span>}
                </span>
              </>
            ) : value ? (
              // Vínculo existe, mas a lista de identidades não veio (sem permissão de admin).
              <>
                <span className="fn-user-pick__name">Usuário vinculado</span>
                <span className="fn-user-pick__hint">Detalhes só para administradores</span>
              </>
            ) : (
              <>
                <span className="fn-user-pick__name is-empty">Sem vínculo</span>
                <span className="fn-user-pick__hint">
                  Buscar entre {contagem.todas} usuários do sistema
                </span>
              </>
            )}
          </span>
          <ChevronDown className="fn-user-pick__chevron h-4 w-4 shrink-0" aria-hidden />
        </button>
      ) : (
        <div className="fn-user-pick__field relative overflow-hidden rounded-lg">
          <FuncionarioUsuarioAura focused={focused || query.length > 0} />
          <Search
            className="fn-user-pick__icon pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2"
            aria-hidden
          />
          <input
            ref={inputRef}
            type="text"
            role="combobox"
            className="fn-user-pick__input relative z-[1] w-full bg-transparent py-2 pl-9 pr-3 text-sm outline-none"
            placeholder="Buscar por nome, e-mail, perfil ou CRM…"
            aria-label="Buscar usuário do sistema"
            aria-autocomplete="list"
            aria-expanded
            aria-controls={listId}
            aria-activedescendant={activeId}
            autoComplete="off"
            spellCheck={false}
            value={query}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            onChange={event => setQuery(event.target.value)}
            onKeyDown={event => {
              if (event.key === 'Escape') {
                event.preventDefault()
                setOpen(false)
                setQuery('')
                return
              }
              if (event.key === 'ArrowDown') {
                event.preventDefault()
                setActiveIndex(i => Math.min(i + 1, Math.max(opcoes.length - 1, 0)))
                return
              }
              if (event.key === 'ArrowUp') {
                event.preventDefault()
                setActiveIndex(i => Math.max(i - 1, 0))
                return
              }
              if (event.key === 'Home') {
                event.preventDefault()
                setActiveIndex(0)
                return
              }
              if (event.key === 'End') {
                event.preventDefault()
                setActiveIndex(Math.max(opcoes.length - 1, 0))
                return
              }
              if (event.key === 'Enter') {
                event.preventDefault()
                const escolha = opcoes[activeIndex] ?? opcoes[0]
                if (escolha) escolher(escolha.id)
              }
            }}
          />
        </div>
      )}

      {open && (
        <div className="fn-user-pick__panel absolute left-0 right-0 top-[calc(100%+6px)] z-40 rounded-lg border p-2">
          <div className="fn-user-pick__filters">
            {FILTROS.map(filtro => (
              <button
                key={filtro.id}
                type="button"
                className={cn('fn-user-pick__chip', origem === filtro.id && 'is-on')}
                aria-pressed={origem === filtro.id}
                onClick={() => setOrigem(filtro.id)}
              >
                {filtro.label}
                <span className="fn-user-pick__chip-count">
                  {filtro.id === 'todas' ? contagem.todas : contagem[filtro.id]}
                </span>
              </button>
            ))}
            {inativosExistem && (
              <button
                type="button"
                className={cn('fn-user-pick__chip is-ghost', incluirInativos && 'is-on')}
                aria-pressed={incluirInativos}
                onClick={() => setIncluirInativos(v => !v)}
              >
                Inativos
              </button>
            )}
          </div>

          <ul
            ref={listRef}
            id={listId}
            role="listbox"
            aria-label="Usuários do sistema"
            className="fn-user-pick__list max-h-[min(20rem,46vh)] overflow-y-auto"
          >
            {value && (
              <li role="presentation">
                <button type="button" className="fn-user-pick__clear" onClick={() => escolher('')}>
                  <UserX className="h-4 w-4 shrink-0" aria-hidden />
                  Remover vínculo desta pasta
                </button>
              </li>
            )}

            {opcoes.length === 0 ? (
              <li className="fn-user-pick__empty">
                Nenhum usuário encontrado{origem !== 'todas' ? ' neste filtro' : ''}.
              </li>
            ) : (
              opcoes.map((opcao, index) => {
                const atual = opcao.id === value
                return (
                  <li key={opcao.id} role="presentation">
                    <button
                      type="button"
                      id={`${listId}-${opcao.id}`}
                      role="option"
                      aria-selected={atual}
                      data-active={index === activeIndex}
                      className={cn(
                        'fn-user-pick__item',
                        index === activeIndex && 'is-active',
                        atual && 'is-current',
                        !opcao.ativo && 'is-off',
                      )}
                      onMouseEnter={() => setActiveIndex(index)}
                      onClick={() => escolher(opcao.id)}
                    >
                      <span className="fn-user-pick__item-main">
                        <span className="fn-user-pick__item-name">
                          {opcao.nome}
                          {atual && <Check className="h-3.5 w-3.5 shrink-0" aria-hidden />}
                        </span>
                        <span className="fn-user-pick__item-mail">
                          {opcao.email || 'sem e-mail'}
                        </span>
                      </span>
                      <span className="fn-user-pick__meta">
                        <span className="fn-user-pick__tag">
                          {USUARIO_ORIGEM_LABEL[opcao.origem]}
                        </span>
                        {opcao.acessos.slice(0, 2).map(acesso => (
                          <span key={acesso} className="fn-user-pick__tag is-soft">
                            {acesso}
                          </span>
                        ))}
                        {opcao.recomendado && (
                          <span className="fn-user-pick__tag is-good">Recomendado</span>
                        )}
                        {!opcao.ativo && <span className="fn-user-pick__tag is-off">Inativo</span>}
                      </span>
                    </button>
                  </li>
                )
              })
            )}
          </ul>

          <p className="fn-user-pick__foot">↑↓ navegar · Enter selecionar · Esc fechar</p>
        </div>
      )}
    </div>
  )
}
