import * as React from 'react';
import { cva, VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const buttonVariants = cva(
  'inline-flex justify-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 min-w-0 flex-1 whitespace-nowrap rounded-xl bg-gold text-left text-[#1a120e] shadow-md hover:bg-gold/90 h-9 flex-row items-center gap-1.5 px-2.5 py-0 text-md font-medium',
  {
    variants: {
      color: {
        green: 'bg-green-500 text-white hover:bg-green-600',
      },
    },
    defaultVariants: {
      color: 'gold',
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  color?: 'green';
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, color = 'gold', ...props }, ref) => (
    <button
      ref={ref}
      className={cn(
        buttonVariants({ color }),
        className
      )}
      {...props}
    />
  )
)

export { Button }
