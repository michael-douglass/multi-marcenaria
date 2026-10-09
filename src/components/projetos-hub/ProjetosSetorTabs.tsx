import { Hammer, Ruler, type LucideIcon } from 'lucide-react'
import { TabsList, TabsTrigger } from '@/components/ui/tabs'
import { SetorTabsShader } from '@/components/projetos-hub/SetorTabsShader'
import type { ProjetosAba } from '@/lib/projetos-hub'
import { cn } from '@/lib/utils'

/**
 * Régua de marceneiro com as abas do hub /projetos.
 * Precisa estar dentro de um <Tabs> (Radix) — o teclado (setas) e o aria vêm dele.
 * Camadas: tiques CSS → pílula CSS (fallback sem WebGL) → veio em shader → rótulos.
 */
export function ProjetosSetorTabs({ abas, active }: ProjetosSetorTabsProps) {
  const activeIndex = Math.max(abas.indexOf(active), 0)
  const meta = ABA_META[active]

  return (
    <div className="relative z-30 mb-3 flex items-center pt-1">
      <TabsList
        aria-label="Alternar entre projetos e produção"
        className="relative flex h-auto w-full overflow-hidden rounded-xl border border-[#2a1812]/10 bg-[#fbf7f0]/85 p-1 shadow-[0_10px_28px_rgba(42,24,18,0.08)] backdrop-blur-md dark:border-white/10 dark:bg-[#1c1410]/80 sm:w-[26rem]"
      >
        <span
          aria-hidden
          className="pointer-events-none absolute inset-x-2 bottom-0 h-2 bg-[repeating-linear-gradient(90deg,rgba(42,24,18,0.22)_0_1px,transparent_1px_8px)] [mask-image:linear-gradient(to_top,black,transparent)] dark:bg-[repeating-linear-gradient(90deg,rgba(243,230,212,0.2)_0_1px,transparent_1px_8px)]"
        />
        <span
          aria-hidden
          className="pointer-events-none absolute inset-x-2 bottom-0 h-3 bg-[repeating-linear-gradient(90deg,rgba(42,24,18,0.3)_0_1px,transparent_1px_40px)] [mask-image:linear-gradient(to_top,black,transparent)] dark:bg-[repeating-linear-gradient(90deg,rgba(243,230,212,0.28)_0_1px,transparent_1px_40px)]"
        />

        <div className="pointer-events-none absolute inset-1" aria-hidden>
          <span
            className={cn(
              'absolute inset-y-0 left-0 rounded-lg shadow-[0_6px_18px_rgba(42,24,18,0.18)] transition-[transform,background-color] duration-500 ease-out motion-reduce:transition-none',
              meta.pill,
            )}
            style={{
              width: `${100 / abas.length}%`,
              transform: `translateX(${activeIndex * 100}%)`,
            }}
          />
          <SetorTabsShader
            className="overflow-hidden rounded-lg"
            mix={active === 'producao' ? 1 : 0}
            activeIndex={activeIndex}
            count={abas.length}
          />
        </div>

        <div
          className="relative grid w-full"
          style={{ gridTemplateColumns: `repeat(${abas.length}, minmax(0, 1fr))` }}
        >
          {abas.map((aba) => (
            <SetorTab key={aba} aba={aba} isActive={aba === active} />
          ))}
        </div>
      </TabsList>
    </div>
  )
}

function SetorTab({ aba, isActive }: { aba: ProjetosAba; isActive: boolean }) {
  const { label, legenda, icon: Icon } = ABA_META[aba]
  return (
    <TabsTrigger
      value={aba}
      className={cn(
        'group flex min-w-0 items-center justify-center gap-2 rounded-lg bg-transparent px-3 py-2 text-left transition-colors duration-300',
        'data-[state=active]:bg-transparent data-[state=active]:shadow-none',
        'focus-visible:ring-2 focus-visible:ring-[#8d5e22]/50 focus-visible:ring-offset-0',
        isActive
          ? 'text-white [text-shadow:0_1px_2px_rgba(0,0,0,0.35)] data-[state=active]:text-white'
          : 'text-[#6b5a4c] hover:text-[#2a1812] dark:text-[#bfae9a] dark:hover:text-[#f3e6d4]',
      )}
    >
      <Icon
        className={cn('h-4 w-4 shrink-0 transition-transform duration-300', isActive && 'scale-110')}
        aria-hidden
      />
      <span className="flex min-w-0 flex-col leading-tight">
        <span className="truncate text-sm font-semibold">{label}</span>
        <span className={cn('truncate text-[10px] font-normal', isActive ? 'text-white/80' : 'opacity-70')}>
          {legenda}
        </span>
      </span>
    </TabsTrigger>
  )
}

const ABA_META: Record<ProjetosAba, AbaMeta> = {
  atelie: {
    label: 'Projetos',
    legenda: 'Ateliê · desenho',
    icon: Ruler,
    pill: 'bg-[#8d5e22]',
  },
  producao: {
    label: 'Produção',
    legenda: 'Oficina · fabricação',
    icon: Hammer,
    pill: 'bg-[#2d8c78]',
  },
}

interface AbaMeta {
  label: string
  legenda: string
  icon: LucideIcon
  pill: string
}

interface ProjetosSetorTabsProps {
  abas: ProjetosAba[]
  active: ProjetosAba
}
