import { NavLink, Outlet } from 'react-router-dom'
import { Building2, Copy, History, LayoutList, LogOut, Receipt, SlidersHorizontal } from 'lucide-react'
import { useApp } from '@/context/AppContext'
import { cn } from '@/lib/utils'

const NAV = [
  { to: '/master', label: 'Visão geral', icon: LayoutList, end: true },
  { to: '/master/empresas', label: 'Marcenarias', icon: Building2, end: false },
  { to: '/master/financeiro', label: 'Mensalidades', icon: Receipt, end: false },
  { to: '/master/planos', label: 'Planos e páginas', icon: SlidersHorizontal, end: false },
  { to: '/master/modelos', label: 'Modelos padrão', icon: Copy, end: false },
  { to: '/master/acessos', label: 'Entradas nas empresas', icon: History, end: false },
] as const

/** Casca do console master: trilho de navegação à esquerda (no celular, barra no topo). */
export function MasterLayout() {
  const { user, signOut } = useApp()

  return (
    <div className="min-h-svh lg:grid lg:grid-cols-[248px_1fr]">
      <aside className="sticky top-0 z-20 border-b border-[var(--m-line)] bg-[var(--m-surface)] lg:h-svh lg:border-b-0 lg:border-r">
        <div className="flex items-center justify-between gap-3 px-5 py-4 lg:block lg:px-6 lg:pb-8 lg:pt-7">
          <div>
            <p className="m-titulo text-[1.35rem] text-[var(--m-ink)]">Plataforma</p>
            <p className="text-[0.8rem] text-[var(--m-ink-2)]">Console do master</p>
          </div>
          <button
            type="button"
            onClick={() => void signOut()}
            className="inline-flex min-h-10 items-center gap-1.5 rounded-md px-2 text-sm text-[var(--m-ink-2)] hover:text-[var(--m-ink)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--m-accent)] lg:hidden"
          >
            <LogOut className="h-4 w-4" aria-hidden /> Sair
          </button>
        </div>

        <nav aria-label="Console master" className="overflow-x-auto px-3 pb-3 lg:px-3 lg:pb-0">
          <ul className="flex gap-1 lg:flex-col">
            {NAV.map(({ to, label, icon: Icon, end }) => (
              <li key={to}>
                <NavLink
                  to={to}
                  end={end}
                  className={({ isActive }) =>
                    cn(
                      'relative flex min-h-11 items-center gap-3 whitespace-nowrap rounded-md px-3 text-[0.93rem] transition-colors',
                      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--m-accent)]',
                      isActive
                        ? 'bg-[var(--m-accent-soft)] font-semibold text-[var(--m-ink)] lg:before:absolute lg:before:inset-y-2 lg:before:-left-3 lg:before:w-[3px] lg:before:rounded-r lg:before:bg-[var(--m-accent)]'
                        : 'text-[var(--m-ink-2)] hover:bg-[var(--m-bg)] hover:text-[var(--m-ink)]',
                    )
                  }
                >
                  <Icon className="h-[18px] w-[18px] shrink-0" aria-hidden />
                  {label}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>

        <div className="absolute inset-x-0 bottom-0 hidden border-t border-[var(--m-line)] px-6 py-5 lg:block">
          <p className="truncate text-[0.82rem] text-[var(--m-ink-2)]" title={user?.email ?? ''}>{user?.email}</p>
          <button
            type="button"
            onClick={() => void signOut()}
            className="mt-2 inline-flex min-h-9 items-center gap-1.5 rounded-md text-sm font-medium text-[var(--m-ink)] hover:text-[var(--m-accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--m-accent)]"
          >
            <LogOut className="h-4 w-4" aria-hidden /> Sair
          </button>
        </div>
      </aside>

      <main id="conteudo-master" className="min-w-0">
        <Outlet />
      </main>
    </div>
  )
}
