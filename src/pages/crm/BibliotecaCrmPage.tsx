import { Images, Search } from 'lucide-react'
import { CrmPageFrame, CrmPageHeader } from '@/components/crm/CrmPageFrame'
import { Button } from '@/components/ui/button'
import { LoadingState, EmptyState } from '@/components/ui/EmptyState'
import { useCrmMarketing, useCrmMarketingMedias } from '@/hooks/useCrmMarketing'

export function BibliotecaCrmPage() {
  const { data, loading, error } = useCrmMarketing()
  const medias = useCrmMarketingMedias()
  const imagens = medias.items.filter(i => i.tipo === 'imagem').length
  const videos = medias.items.filter(i => i.tipo === 'video' || i.tipo === 'vídeo').length
  const arquivos = medias.items.length - imagens - videos

  return (
    <CrmPageFrame padded>
      <CrmPageHeader
        title="Acervo digital"
        subtitle="Biblioteca de mídias do CRM. Separada da biblioteca de comprovantes da fábrica."
        icon={(
          <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-pink-400/30 bg-pink-400/15">
            <Images className="h-4 w-4 text-pink-300" />
          </div>
        )}
      />
      {loading && <LoadingState variant="page" message="Abrindo o acervo..." />}
      {error && <p className="text-sm text-rose-300">{error}</p>}
      {!loading && !error && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Count label="Todas" value={data.totalMidias} />
            <Count label="Imagens" value={imagens} />
            <Count label="Vídeos" value={videos} />
            <Count label="Arquivos" value={Math.max(0, arquivos)} />
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" className={!medias.folderId && !medias.semPasta ? 'btn btn-gold btn-sm' : 'btn btn-outline btn-sm'} onClick={() => { medias.setFolderId(null); medias.setSemPasta(false); medias.setOffset(0) }}>
              Todas ({data.totalMidias})
            </button>
            <button type="button" className={medias.semPasta ? 'btn btn-gold btn-sm' : 'btn btn-outline btn-sm'} onClick={() => { medias.setFolderId(null); medias.setSemPasta(true); medias.setOffset(0) }}>
              Sem pasta ({data.semPasta})
            </button>
            {data.pastas.map(p => (
              <button key={p.id} type="button" className={medias.folderId === p.id ? 'btn btn-gold btn-sm' : 'btn btn-outline btn-sm'} onClick={() => { medias.setFolderId(p.id); medias.setSemPasta(false); medias.setOffset(0) }}>
                {p.nome} ({p.total})
              </button>
            ))}
          </div>
          <label className="relative block max-w-sm">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input className="glass-input w-full pl-9" placeholder="Buscar mídia" value={medias.busca} onChange={e => { medias.setBusca(e.target.value); medias.setOffset(0) }} />
          </label>
          {medias.loading && <LoadingState message="Carregando mídias..." />}
          {!medias.loading && medias.items.length === 0 && <EmptyState message="Nenhuma mídia nesta pasta." />}
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
            {medias.items.map(item => (
              <a key={item.id} href={item.fileUrl} target="_blank" rel="noreferrer" className="overflow-hidden rounded-lg border border-border/70 bg-card">
                {item.tipo === 'imagem'
                  ? <img src={item.fileUrl} alt={item.titulo} className="h-28 w-full object-cover" loading="lazy" width={160} height={112} />
                  : <div className="flex h-28 items-center justify-center text-xs uppercase text-muted-foreground">{item.tipo}</div>}
                <p className="truncate px-2 py-1.5 text-xs">{item.titulo || item.fileName}</p>
              </a>
            ))}
          </div>
          {medias.total > medias.limit && (
            <div className="flex gap-2">
              <Button size="sm" variant="outline" disabled={medias.offset === 0} onClick={() => medias.setOffset(Math.max(0, medias.offset - medias.limit))}>Anterior</Button>
              <Button size="sm" variant="outline" disabled={medias.offset + medias.limit >= medias.total} onClick={() => medias.setOffset(medias.offset + medias.limit)}>Próxima</Button>
            </div>
          )}
        </div>
      )}
    </CrmPageFrame>
  )
}

function Count({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-border/80 bg-card px-3 py-2">
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="text-lg font-semibold tabular-nums">{value}</p>
    </div>
  )
}
