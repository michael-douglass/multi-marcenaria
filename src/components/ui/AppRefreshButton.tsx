import { useState } from 'react'
import { RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { refreshAppPreservingRoute } from '@/lib/app-refresh'

interface AppRefreshButtonProps {
  className?: string
  /** Exibe o texto "Atualizar" em telas maiores. */
  showLabel?: boolean
  /** Estilo compacto para o cabeçalho global. */
  variant?: 'header' | 'toolbar' | 'floating'
}

export function AppRefreshButton({
  className,
  showLabel = false,
  variant = 'header',
}: AppRefreshButtonProps) {
  const [refreshing, setRefreshing] = useState(false)

  const handleRefresh = () => {
    if (refreshing) return
    setRefreshing(true)
    refreshAppPreservingRoute()
    window.setTimeout(() => setRefreshing(false), 900)
  }

  const isCompactHeader = variant === 'header' && !showLabel
  /** No cabeçalho, o texto só aparece a partir de sm — no celular fica só o ícone. */
  const headerWithLabel = variant === 'header' && showLabel

  const variantClass =
    variant === 'floating'
      ? 'fixed right-4 top-4 z-50 h-10 w-10 rounded-full border border-[rgba(240,210,140,0.35)] bg-[rgba(20,8,4,0.92)] text-[#f2d892] shadow-[0_8px_28px_rgba(0,0,0,0.45)] backdrop-blur-md hover:border-[rgba(240,210,140,0.6)] hover:bg-[rgba(240,210,140,0.12)] hover:text-[#f5e0a8]'
      : variant === 'toolbar' || headerWithLabel
        ? cn(
            'h-8 border border-[rgba(240,210,140,0.22)] bg-[rgba(240,210,140,0.05)] text-[0.68rem] font-semibold uppercase tracking-wide text-[#edd9c4]',
            'hover:border-[rgba(240,210,140,0.4)] hover:bg-[rgba(240,210,140,0.12)] hover:text-[#f5e0a8]',
            headerWithLabel ? 'w-8 justify-center px-0 sm:w-auto sm:gap-1.5 sm:px-2.5' : 'gap-1.5 px-2.5',
          )
        : 'h-8 w-8 text-[#edd9c4] hover:bg-[rgba(240,210,140,0.1)] hover:text-[#f5e0a8]'

  return (
    <Button
      type="button"
      variant="ghost"
      size={isCompactHeader ? 'icon' : 'sm'}
      className={cn(
        'app-refresh-btn group relative shrink-0 transition-all duration-200',
        variantClass,
        className,
      )}
      onClick={handleRefresh}
      disabled={refreshing}
      title="Atualizar página"
      aria-label="Atualizar página"
    >
      <RefreshCw
        size={variant === 'toolbar' ? 14 : 16}
        className={cn(
          'shrink-0 transition-transform duration-500',
          refreshing ? 'animate-spin' : 'group-hover:rotate-90',
        )}
        aria-hidden
      />
      {showLabel && (
        <span className={headerWithLabel || isCompactHeader ? 'hidden sm:inline' : 'inline'}>
          Atualizar
        </span>
      )}
      <span
        className="pointer-events-none absolute inset-0 rounded-[inherit] opacity-0 transition-opacity duration-300 group-hover:opacity-100"
        style={{
          boxShadow: 'inset 0 0 0 1px rgba(240,210,140,0.22), 0 0 18px rgba(240,210,140,0.12)',
        }}
        aria-hidden
      />
    </Button>
  )
}
