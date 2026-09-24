// Primeiro import: garante crypto.randomUUID antes de qualquer módulo do app
import './lib/crypto-polyfill'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient } from '@tanstack/react-query'
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client'
import { createSyncStoragePersister } from '@tanstack/query-sync-storage-persister'
import './index.css'
import App from './App'
import { AppProvider } from './context/AppContext'
import { markBootAndDetectLoop } from './lib/boot-guard'
import { QueryPersistBootGate } from './components/QueryPersistBootGate'

if (markBootAndDetectLoop()) {
  document.documentElement.dataset.garboSafeMode = '1'
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      gcTime: 1000 * 60 * 60 * 24,
      staleTime: 1000 * 30,
      retry: 1,
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
    },
  },
})

const persister = createSyncStoragePersister({
  storage: typeof window !== 'undefined' ? window.localStorage : undefined,
  key: 'garbo-crm-rq-cache-v1',
  throttleTime: 1000,
  deserialize: (cached) => {
    try {
      return JSON.parse(cached)
    } catch {
      console.warn('[CRM] Cache local inválido; iniciando sem cache persistido.')
      return undefined
    }
  },
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{
        persister,
        buster: 'garbo-empresa-queries-ready-v1',
        maxAge: 1000 * 60 * 60 * 12,
        dehydrateOptions: {
          shouldDehydrateQuery: (query) => {
            const k = query.queryKey?.[0]
            if (typeof k !== 'string') return false
            return [
              'kanban-config-pages',
              'lead-origins',
              'regioes',
              'pipeline-custom-stages',
            ].includes(k)
          },
        },
      }}
      onSuccess={() => {
        queryClient.resumePausedMutations()
        void queryClient.refetchQueries({
          type: 'active',
          predicate: (query) => query.state.dataUpdatedAt === 0,
        })
      }}
    >
      <QueryPersistBootGate>
        <AppProvider>
          <App />
        </AppProvider>
      </QueryPersistBootGate>
    </PersistQueryClientProvider>
  </StrictMode>,
)
