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

export function LoadingState() {
  return (
    <div className="flex items-center justify-center py-16 gap-3">
      <div
        style={{
          width: 20, height: 20,
          border: '2px solid rgba(240,210,140,.2)',
          borderTop: '2px solid #f2d892',
          borderRadius: '50%',
          animation: 'spin 1s linear infinite',
        }}
      />
      <span style={{ color: '#edd9c4', fontSize: '.85rem' }}>Carregando...</span>
    </div>
  )
}

export function ErrorState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div style={{ fontSize: '2rem', marginBottom: '.75rem' }}>⚠</div>
      <p style={{ color: '#f87171', fontSize: '.85rem' }}>{message}</p>
    </div>
  )
}
