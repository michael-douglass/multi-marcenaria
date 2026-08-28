import { CalendarDays } from 'lucide-react'
import { CrmPageFrame, CrmPageHeader } from '@/components/crm/CrmPageFrame'
import { LoadingState, ErrorState, EmptyState } from '@/components/ui/EmptyState'
import { useCrmEventos } from '@/hooks/useCrmComunicacao'
import { paginasDoEvento } from '@/lib/crm-comunicacao'
import { fmtDate } from '@/lib/utils'

export function EventosCrmPage() {
  const { eventos, paginas, loading, error } = useCrmEventos()

  return (
    <CrmPageFrame padded>
      <CrmPageHeader
        title="Eventos"
        subtitle="Encontros da Garbo com arquitetos e equipe — separado da Agenda de Obras."
        icon={(
          <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-violet-400/30 bg-violet-400/15">
            <CalendarDays className="h-4 w-4 text-violet-300" />
          </div>
        )}
      />
      {loading && <LoadingState variant="page" message="Abrindo os eventos..." />}
      {!loading && error && <ErrorState message={error} />}
      {!loading && !error && eventos.length === 0 && <EmptyState message="Nenhum evento cadastrado." />}
      <div className="space-y-6">
        {eventos.map(evento => {
          const blocos = paginasDoEvento(paginas, evento.id)
          return (
            <article key={evento.id} className="rounded-2xl border border-border/80 bg-card p-5">
              <h2 className="font-display text-2xl tracking-wide text-[#f2d892]">{evento.titulo}</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {fmtDate(evento.dataEvento)}
                {evento.tipoCustom ? ` · ${evento.tipoCustom}` : evento.tipo ? ` · ${evento.tipo}` : ''}
              </p>
              {evento.observacoes && <p className="mt-2 text-sm">{evento.observacoes}</p>}
              <div className="mt-4 space-y-3">
                {blocos.filter(b => b.titulo.trim() || b.corpo.trim()).map(bloco => (
                  <section key={bloco.id} className="rounded-xl border border-border/60 p-3">
                    {bloco.titulo.trim() && <h3 className="text-sm font-semibold">{bloco.titulo}</h3>}
                    {bloco.corpo.trim() && (
                      <p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">{bloco.corpo}</p>
                    )}
                  </section>
                ))}
              </div>
            </article>
          )
        })}
      </div>
    </CrmPageFrame>
  )
}
