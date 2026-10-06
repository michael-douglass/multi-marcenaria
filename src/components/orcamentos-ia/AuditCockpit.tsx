import { useMemo, useState } from 'react'
import { ChevronDown, ChevronUp, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { PriceAuditorPanel } from '@/components/orcamentos-ia/PriceAuditorPanel'
import { ResponseInspectorPanel } from '@/components/orcamentos-ia/ResponseInspectorPanel'
import type { ObservabilityBlocks } from '@/lib/orcamentos-ia/observability'

type CockpitTab = 'cot' | 'auditor' | 'inspector'

interface AuditCockpitProps {
  blocks: ObservabilityBlocks | null
  onOpenPromptStudio?: () => void
  className?: string
}

export function AuditCockpit({
  blocks,
  onOpenPromptStudio,
  className,
}: AuditCockpitProps) {
  const [open, setOpen] = useState(true)
  const [tab, setTab] = useState<CockpitTab>('auditor')

  const tabs = useMemo(
    () =>
      [
        { id: 'cot' as const, label: 'CoT' },
        { id: 'auditor' as const, label: 'Auditor' },
        { id: 'inspector' as const, label: 'JSON' },
      ] as const,
    [],
  )

  return (
    <aside
      className={cn(
        'flex flex-col overflow-hidden rounded-xl border border-[#0066FF]/25 bg-white shadow-sm',
        className,
      )}
    >
      <div className="flex items-center gap-2 border-b border-border px-2 py-1.5">
        <button
          type="button"
          className="flex flex-1 items-center gap-2 text-left text-xs font-semibold text-[#0f1419]"
          onClick={() => setOpen((v) => !v)}
        >
          Cockpit Corte Claude
          {open ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
        </button>
        {onOpenPromptStudio && (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="h-7 gap-1 px-2 text-[11px]"
            onClick={onOpenPromptStudio}
          >
            <Sparkles className="h-3.5 w-3.5 text-[#0066FF]" />
            Prompts
          </Button>
        )}
      </div>

      {open && (
        <>
          <div className="flex gap-1 border-b border-border p-1">
            {tabs.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                className={cn(
                  'flex-1 rounded-md px-2 py-1 text-[11px] font-medium transition-colors',
                  tab === t.id
                    ? 'bg-[#0066FF] text-white'
                    : 'text-muted-foreground hover:bg-muted',
                )}
              >
                {t.label}
              </button>
            ))}
          </div>
          <div className="min-h-[220px] max-h-[360px] flex-1 overflow-hidden">
            {tab === 'cot' && (
              <div className="h-full overflow-auto p-2">
                {blocks?.chainOfThought ? (
                  <pre className="whitespace-pre-wrap font-sans text-[11px] leading-relaxed text-[#2a3340]">
                    {blocks.chainOfThought}
                  </pre>
                ) : (
                  <p className="p-4 text-center text-xs text-muted-foreground">
                    Sem Chain of Thought ainda.
                  </p>
                )}
              </div>
            )}
            {tab === 'auditor' && blocks && (
              <PriceAuditorPanel
                rows={blocks.priceAuditor}
                materialsTotal={blocks.priceAuditorTotal}
                salePrice={blocks.salePrice}
                formulaLabel={blocks.formulaLabel}
              />
            )}
            {tab === 'auditor' && !blocks && (
              <p className="p-4 text-center text-xs text-muted-foreground">Sem BOM para auditar.</p>
            )}
            {tab === 'inspector' && (
              <ResponseInspectorPanel payload={blocks?.responseJson ?? null} />
            )}
          </div>
        </>
      )}
    </aside>
  )
}
