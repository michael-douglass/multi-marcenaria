import { ReactNode } from 'react'

interface FieldProps {
  label: string
  children: ReactNode
  half?: boolean
}

export function Field({ label, children, half }: FieldProps) {
  return (
    <div
      className="mb-3 min-w-0 max-w-full last:mb-0"
      style={{ flex: half ? '1 1 min(100%, 280px)' : '1 1 100%' }}
    >
      <div className="section-label mb-1.5">{label}</div>
      <div className="min-w-0 max-w-full">{children}</div>
    </div>
  )
}

export function FieldRow({ children }: { children: ReactNode }) {
  return <div className="flex gap-4 flex-wrap">{children}</div>
}
