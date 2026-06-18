import { GarboLoadingBrand } from '@/components/ui/GarboLoadingBrand'

interface EmptyStateProps {
  message: string
}

export function EmptyState({ message }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div style={{ fontSize: '2.2rem', marginBottom: '.75rem', opacity: .3 }}>◈</div>
      <p style={{ color: '#edd9c4', fontSize: '.85rem' }}>{message}</p>
    </div>
  )
}

interface LoadingStateProps {
  message?: string
}

export function LoadingState({ message = 'Carregando...' }: LoadingStateProps) {
  return <GarboLoadingBrand variant="inline" message={message} />
}

export function ErrorState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div style={{ fontSize: '2rem', marginBottom: '.75rem' }}>⚠</div>
      <p style={{ color: '#f87171', fontSize: '.85rem' }}>{message}</p>
    </div>
  )
}
