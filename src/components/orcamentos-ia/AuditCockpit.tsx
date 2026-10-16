import { useMemo, useState } from 'react'
import {
  ChevronDown,
  ChevronUp,
  ClipboardCopy,
  Download,
  FileDown,
  FileText,
  Loader2,
  Sparkles,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'
import { copyText } from '@/lib/qr/copy-text'
import { showToast } from '@/lib/toast'
import { PriceAuditorPanel } from '@/components/orcamentos-ia/PriceAuditorPanel'
import { ResponseInspectorPanel } from '@/components/orcamentos-ia/ResponseInspectorPanel'
import type { ObservabilityBlocks } from '@/lib/orcamentos-ia/observability'
import {
  cockpitExportFileBase,
  downloadCockpitMarkdown,
  downloadCockpitPdf,
  formatCockpitExportMarkdown,
  hasCockpitExportContent,
  type CockpitExportMeta,
} from '@/lib/orcamentos-ia/cockpit-export'

type CockpitTab = 'cot' | 'auditor' | 'inspector'

interface AuditCockpitProps {
  blocks: ObservabilityBlocks | null
  meta?: CockpitExportMeta | null
  onOpenPromptStudio?: () => void
  className?: string
}

export function AuditCockpit({
  blocks,
  meta,
  onOpenPromptStudio,
  className,
}: AuditCockpitProps) {
  const [open, setOpen] = useState(true)
  const [tab, setTab] = useState<CockpitTab>('auditor')
  const [exportingPdf, setExportingPdf] = useState(false)

  const tabs = useMemo(
    () =>
      [
        { id: 'cot' as const, label: 'CoT' },
        { id: 'auditor' as const, label: 'Auditor' },
        { id: 'inspector' as const, label: 'JSON' },
      ] as const,
    [],
  )

  const canExport = hasCockpitExportContent(blocks)

  const buildMarkdown = (): string | null => {
    if (!blocks || !hasCockpitExportContent(blocks)) {
      showToast('Nada para exportar no cockpit.', 'error')
      return null
    }
    return formatCockpitExportMarkdown(blocks, {
      ...meta,
      generatedAt: meta?.generatedAt || new Date().toISOString(),
    })
  }

  const handleCopy = async () => {
    const markdown = buildMarkdown()
    if (!markdown) return
    await copyText(markdown, 'Conteúdo do cockpit copiado.', { compact: false })
  }

  const handleDownloadMd = () => {
    const markdown = buildMarkdown()
    if (!markdown) return
    downloadCockpitMarkdown(markdown, `${cockpitExportFileBase(meta)}.md`)
    showToast('Markdown do cockpit baixado.')
  }

  const handleDownloadPdf = async () => {
    const markdown = buildMarkdown()
    if (!markdown) return
    setExportingPdf(true)
    try {
      await downloadCockpitPdf(markdown, `${cockpitExportFileBase(meta)}.pdf`)
      showToast('PDF do cockpit baixado.')
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Falha ao gerar PDF do cockpit.', 'error')
    } finally {
      setExportingPdf(false)
    }
  }

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
          className="flex min-w-0 flex-1 items-center gap-2 text-left text-xs font-semibold text-[#0f1419]"
          onClick={() => setOpen((v) => !v)}
        >
          <span className="truncate">Cockpit Corte Claude</span>
          {open ? <ChevronUp className="h-3.5 w-3.5 shrink-0" /> : <ChevronDown className="h-3.5 w-3.5 shrink-0" />}
        </button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="h-7 shrink-0 gap-1 px-2 text-[11px]"
              disabled={!canExport || exportingPdf}
            >
              {exportingPdf ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin text-[#0066FF]" />
              ) : (
                <Download className="h-3.5 w-3.5 text-[#0066FF]" />
              )}
              Exportar
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52">
            <DropdownMenuItem disabled={!canExport || exportingPdf} onClick={() => void handleCopy()}>
              <ClipboardCopy className="mr-2 h-3.5 w-3.5" />
              Copiar texto
            </DropdownMenuItem>
            <DropdownMenuItem disabled={!canExport || exportingPdf} onClick={handleDownloadMd}>
              <FileText className="mr-2 h-3.5 w-3.5" />
              Baixar Markdown (.md)
            </DropdownMenuItem>
            <DropdownMenuItem
              disabled={!canExport || exportingPdf}
              onClick={() => void handleDownloadPdf()}
            >
              <FileDown className="mr-2 h-3.5 w-3.5" />
              Baixar PDF
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        {onOpenPromptStudio && (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="h-7 shrink-0 gap-1 px-2 text-[11px]"
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
