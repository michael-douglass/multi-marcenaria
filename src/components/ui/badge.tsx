import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const badgeVariants = cva(
  'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
  {
    variants: {
      variant: {
        default: 'border-transparent bg-primary text-primary-foreground hover:bg-primary/80',
        secondary: 'border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80',
        destructive: 'border-transparent bg-destructive text-destructive-foreground hover:bg-destructive/80',
        outline: 'text-foreground',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  },
)

const statusMap: Record<string, string> = {
  aguardando_aprovacao: 'badge badge-gold',
  aprovado: 'badge badge-green',
  recusado: 'badge badge-red',
  pago: 'badge badge-green',
  pendente: 'badge badge-amber',
  parcialmente_pago: 'badge badge-blue',
  recebido: 'badge badge-green',
  vencido: 'badge badge-red',
  aberto: 'badge badge-amber',
}

const labelMap: Record<string, string> = {
  aguardando_aprovacao: 'Aguardando Aprovação',
  aprovado: 'Aprovado',
  recusado: 'Recusado',
  pago: 'Pago',
  pendente: 'Pendente',
  parcialmente_pago: 'Parcial',
  recebido: 'Recebido',
  vencido: 'Vencido',
  aberto: 'Aberto',
}

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {
  /** API da fábrica (Caixa / contas): status do registro. */
  status?: string
}

const Badge = React.forwardRef<HTMLDivElement, BadgeProps>(function Badge(
  { className, variant, status, children, ...props },
  ref,
) {
  if (status && children == null) {
    return (
      <span className={cn(statusMap[status] ?? 'badge badge-amber', className)} {...props}>
        {labelMap[status] ?? status}
      </span>
    )
  }

  return (
    <div ref={ref} className={cn(badgeVariants({ variant }), className)} {...props}>
      {children}
    </div>
  )
})

Badge.displayName = 'Badge'

export { Badge, badgeVariants }
