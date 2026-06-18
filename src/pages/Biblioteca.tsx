import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { RefreshCw, Search } from 'lucide-react'
import { useBiblioteca } from '@/hooks/useBiblioteca'
import { AnexoLightbox, AnexoThumb } from '@/components/contas-pagar/AnexoLightbox'
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/EmptyState'
import { fmtDate } from '@/lib/utils'
import type { BibliotecaItem } from '@/types'

type FiltroTipo = 'todos' | 'imagem' | 'pdf'

interface Props {
  readOnly?: boolean
}

export function Biblioteca({ readOnly }: Props) {
  const { items, loading, error, reload, remove } = useBiblioteca()
  const [filtro, setFiltro] = useState<FiltroTipo>('todos')
  const [busca, setBusca] = useState('')
  const [lightbox, setLightbox] = useState<BibliotecaItem | null>(null)
  const [deleting, setDeleting] = useState(false)

  const filtrados = useMemo(() => {
    const q = busca.trim().toLowerCase()
    return items.filter(item => {
      if (filtro === 'imagem' && item.kind !== 'image') return false
      if (filtro === 'pdf' && item.kind !== 'pdf') return false
      if (!q) return true
      return (
        item.nome_arquivo.toLowerCase().includes(q) ||
        (item.contexto?.toLowerCase().includes(q) ?? false)
      )
    })
  }, [items, filtro, busca])

  const handleDelete = async (item: BibliotecaItem) => {
    if (readOnly) return
    if (!confirm(`Excluir "${item.nome_arquivo}" da biblioteca?`)) return
    setDeleting(true)
    try {
      await remove(item.anexoId)
      if (lightbox?.id === item.id) setLightbox(null)
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="fade-in">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1
            className="font-display"
            style={{ fontSize: '2.2rem', color: '#f2d892', letterSpacing: '.08em' }}
          >
            Biblioteca
          </h1>
          <p className="section-label mt-1">
            {items.length} arquivo{items.length !== 1 ? 's' : ''} enviado{items.length !== 1 ? 's' : ''}
            {' · '}imagens e PDFs dos lançamentos
          </p>
        </div>
        <button
          type="button"
          className="btn btn-outline btn-sm"
          onClick={() => reload()}
          disabled={loading}
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          Atualizar
        </button>
      </div>

      <div className="glass-card mb-5 flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-2">
          {(
            [
              ['todos', 'Todos'],
              ['imagem', 'Imagens'],
              ['pdf', 'PDFs'],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setFiltro(id)}
              className={`rounded-full px-3 py-1 text-xs font-semibold transition-colors ${
                filtro === id
                  ? 'border border-[#f2d892] bg-[rgba(240,210,140,0.14)] text-[#f2d892]'
                  : 'border border-[rgba(240,210,140,0.2)] text-[#edd9c4] hover:text-cream'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="relative min-w-0 flex-1 sm:max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#edd9c4]" />
          <input
            className="glass-input !pl-9"
            placeholder="Buscar por nome ou lançamento..."
            value={busca}
            onChange={e => setBusca(e.target.value)}
          />
        </div>
      </div>

      {loading ? (
        <LoadingState message={items.length > 0 ? 'Atualizando...' : 'Carregando...'} />
      ) : error ? (
        <ErrorState message={error} />
      ) : filtrados.length === 0 ? (
        <EmptyState
          message={
            items.length === 0
              ? 'Nenhum arquivo na biblioteca. Anexe imagens ou PDFs em Contas a Pagar → Lançamento Manual.'
              : 'Nenhum resultado para este filtro.'
          }
        />
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
          {filtrados.map(item => (
            <div key={item.id} className="flex flex-col gap-2">
              <AnexoThumb
                previewUrl={item.previewUrl}
                nome={item.nome_arquivo}
                kind={item.kind}
                onOpenFullscreen={() => setLightbox(item)}
                onDelete={readOnly ? undefined : () => handleDelete(item)}
              />
              <div className="px-0.5">
                <p className="text-[0.62rem] text-[#edd9c4]">
                  {item.criado_em ? fmtDate(item.criado_em.slice(0, 10)) : '—'}
                </p>
                {item.contexto && (
                  <p className="mt-0.5 line-clamp-2 text-[0.65rem] text-[#d4bc9f]" title={item.contexto}>
                    {item.contexto}
                  </p>
                )}
                <Link
                  to="/contas-pagar"
                  className="mt-1 inline-block text-[0.62rem] font-semibold text-[#f2d892] hover:underline"
                >
                  Contas a Pagar
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}

      <AnexoLightbox
        open={!!lightbox}
        imageUrl={lightbox?.previewUrl ?? ''}
        pages={lightbox?.previewUrls}
        title={lightbox?.nome_arquivo ?? ''}
        kind={lightbox?.kind}
        onClose={() => setLightbox(null)}
        onDelete={
          lightbox && !readOnly ? () => handleDelete(lightbox) : undefined
        }
        deleting={deleting}
      />
    </div>
  )
}
