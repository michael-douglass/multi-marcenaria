import { Calculator, ExternalLink, Plus } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { CrmLeadSection } from '@/components/crm/CrmLeadSection'
import { MarkupCardPreview } from '@/components/crm/MarkupCardPreview'
import { formatarMoedaMarkup } from '@/lib/markup-calculo'
import type { CrmMarkupListaItem } from '@/lib/crm-markup'
import { fmtDate } from '@/lib/utils'

interface MarkupLeadSectionProps {
  leadId: number
  leadNome: string
  itens: CrmMarkupListaItem[]
  readOnly?: boolean
  onOpen?: (orcamentoId?: string) => void
}

export function MarkupLeadSection({
  leadId,
  leadNome,
  itens,
  readOnly = false,
  onOpen,
}: MarkupLeadSectionProps) {
  const maisRecente = itens[0] ?? null

  return (
    <CrmLeadSection
      title="Markup (custo interno)"
      icon={Calculator}
      description={
        readOnly
          ? 'Valores de referência. A calculadora fica só para a gestão.'
          : '“Novo markup” abre a calculadora deste lead. O original continua na lista.'
      }
      badge={
        itens.length > 0 ? (
          <span className="rounded-full bg-emerald-500/15 px-1.5 py-0.5 text-[10px] font-medium text-emerald-200">
            {itens.length}
          </span>
        ) : null
      }
      actions={
        !readOnly && onOpen ? (
          <Button size="sm" variant="outline" type="button" onClick={() => onOpen()}>
            <Plus className="h-4 w-4" />
            Novo markup
          </Button>
        ) : null
      }
    >
      {itens.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border/60 p-4 text-center">
          <p className="mb-3 text-sm text-muted-foreground">
            Nenhum markup calculado para {leadNome}.
          </p>
          {!readOnly && onOpen && (
            <Button size="sm" className="mt-3" type="button" onClick={() => onOpen()}>
              <Calculator className="h-4 w-4" />
              Abrir calculadora
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {maisRecente && (
            <MarkupCardPreview
              resumo={{
                lead_id: leadId,
                orcamento_id: maisRecente.id,
                preco_final: maisRecente.preco_final,
                titulo: maisRecente.titulo,
                atualizado_em: maisRecente.atualizado_em ?? '',
              }}
              readOnly={readOnly}
              onClick={readOnly || !onOpen ? undefined : () => onOpen(maisRecente.id)}
            />
          )}
          {itens.length > 1 && (
            <ul className="space-y-1.5 border-t border-border/50 pt-2">
              {itens.slice(1).map(item => (
                <li key={item.id}>
                  {readOnly || !onOpen ? (
                    <div className="flex items-center justify-between gap-2 px-2 py-1.5 text-sm">
                      <MarkupLinhaMeta item={item} />
                      <span className="shrink-0 font-medium tabular-nums">
                        {formatarMoedaMarkup(item.preco_final)}
                      </span>
                    </div>
                  ) : (
                    <button
                      type="button"
                      className="flex w-full items-center justify-between gap-2 rounded px-2 py-1.5 text-left text-sm hover:bg-muted/50"
                      onClick={() => onOpen(item.id)}
                    >
                      <MarkupLinhaMeta item={item} />
                      <span className="shrink-0 font-medium tabular-nums">
                        {formatarMoedaMarkup(item.preco_final)}
                      </span>
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
          {maisRecente?.atualizado_em && (
            <p className="text-[10px] text-muted-foreground">
              Mais recente atualizado em {fmtDate(maisRecente.atualizado_em)}
            </p>
          )}
        </div>
      )}
      {!readOnly && (
        <Button variant="ghost" size="sm" className="mt-2 w-full text-xs" asChild>
          <Link to="/markup/configuracoes">
            <ExternalLink className="h-3 w-3" />
            Configurar catálogo e parâmetros
          </Link>
        </Button>
      )}
    </CrmLeadSection>
  )
}

function MarkupLinhaMeta({ item }: { item: CrmMarkupListaItem }) {
  return (
    <span className="min-w-0 truncate text-muted-foreground">
      {item.titulo}
      {item.status === 'rascunho' && (
        <span className="ml-1.5 text-[10px] text-amber-400/80">rascunho</span>
      )}
    </span>
  )
}
