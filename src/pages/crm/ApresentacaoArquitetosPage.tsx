import { Presentation } from 'lucide-react'
import { Link } from 'react-router-dom'
import { GarboPontuaPointsScene } from '@/components/crm/GarboPontuaPointsScene'
import { CrmPageFrame, CrmPageHeader } from '@/components/crm/CrmPageFrame'
import { Button } from '@/components/ui/button'
import { APRESENTACAO_SECTIONS } from '@/lib/crm-marketing'

export function ApresentacaoArquitetosPage() {
  return (
    <CrmPageFrame padded>
      <CrmPageHeader
        title="Apresentação para arquitetos"
        subtitle="Material institucional da Garbo para conversar com parceiros."
        icon={(
          <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-violet-400/30 bg-violet-400/15">
            <Presentation className="h-4 w-4 text-violet-300" />
          </div>
        )}
        actions={(
          <Link to="/marketing/pontua-garbo">
            <Button variant="outline" size="sm">Ver Pontua</Button>
          </Link>
        )}
      />
      <div className="space-y-4">
        {APRESENTACAO_SECTIONS.filter(s => s.id !== 'pontua').map(section => (
          <article key={section.id} className="rounded-2xl border border-border/80 bg-card p-5">
            <h2 className="font-display text-2xl tracking-wide text-[#f2d892]">{section.titulo}</h2>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{section.texto}</p>
          </article>
        ))}
      </div>
    </CrmPageFrame>
  )
}

export function PontuaGarboPage() {
  const pontua = APRESENTACAO_SECTIONS.find(s => s.id === 'pontua')
  return (
    <CrmPageFrame padded>
      <CrmPageHeader
        title="Pontua Garbo"
        subtitle="Programa de pontuação e comissão dos arquitetos."
        icon={(
          <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-amber-400/30 bg-amber-400/15">
            <Presentation className="h-4 w-4 text-amber-300" />
          </div>
        )}
      />
      <div className="relative overflow-hidden rounded-2xl border border-amber-400/25 bg-[#140c08]">
        <GarboPontuaPointsScene className="h-64 w-full sm:h-80" />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-[#140c08] to-transparent p-5">
          {pontua && (
            <>
              <h2 className="font-display text-2xl tracking-wide text-[#f2d892]">{pontua.titulo}</h2>
              <p className="mt-2 max-w-xl text-sm leading-relaxed text-[#edd9c4]">{pontua.texto}</p>
            </>
          )}
        </div>
      </div>
      <p className="text-sm text-muted-foreground">
        Saques e liberações ficam em Financeiro Pontua. O parceiro vê o saldo no portal dele — nunca no Caixa da fábrica.
      </p>
    </CrmPageFrame>
  )
}
