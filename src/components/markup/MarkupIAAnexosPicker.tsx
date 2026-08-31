import { useEffect, useMemo, useState } from 'react';
import { ChevronDown, FileText, Image as ImageIcon, Paperclip } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ScrollArea } from '@/components/ui/scroll-area';
import type { LeadAIMediaItem } from '@/lib/lead-ai-media-sources';
import { prewarmPdfPageCount } from '@/lib/lead-ai-media-viewer';
import {
  PIPELINE_LEAD_AI_MAX_IMAGES_PER_ANALYSIS,
  PIPELINE_LEAD_AI_MAX_ITEMS_PER_ANALYSIS,
} from '@/lib/pipeline-lead-ai-config';
import { cn } from '@/lib/utils';

interface MarkupIAAnexosPickerProps {
  items: LeadAIMediaItem[];
  selectedKeys: Set<string>;
  onChange: (keys: Set<string>) => void;
  isLoading?: boolean;
}

function PdfPageHint({ item }: { item: LeadAIMediaItem }) {
  const [pages, setPages] = useState<number | null>(null);

  useEffect(() => {
    if (item.kind !== 'pdf' || !item.fileUrl) return;
    let cancelled = false;
    void prewarmPdfPageCount(item).then((count) => {
      if (!cancelled) setPages(count);
    });
    return () => {
      cancelled = true;
    };
  }, [item]);

  if (item.kind !== 'pdf') return null;
  if (pages == null) return <span className="text-[10px] text-muted-foreground">PDF</span>;
  return (
    <span className="text-[10px] text-muted-foreground">
      {pages} {pages === 1 ? 'página' : 'páginas'}
    </span>
  );
}

export function MarkupIAAnexosPicker({
  items,
  selectedKeys,
  onChange,
  isLoading,
}: MarkupIAAnexosPickerProps) {
  const [aberto, setAberto] = useState(false);
  const selecionados = useMemo(
    () => items.filter((item) => selectedKeys.has(item.key)),
    [items, selectedKeys],
  );
  const pdfs = selecionados.filter((item) => item.kind === 'pdf').length;
  const fotos = selecionados.filter((item) => item.kind !== 'pdf').length;
  const acimaDoTetoArquivos = selectedKeys.size > PIPELINE_LEAD_AI_MAX_ITEMS_PER_ANALYSIS;
  const previewNomes = selecionados.slice(0, 2).map((item) => item.label);

  const toggle = (key: string, checked: boolean) => {
    const next = new Set(selectedKeys);
    if (checked) next.add(key);
    else next.delete(key);
    onChange(next);
  };

  const selecionarAnexosDoLead = () => {
    const anexos = items.filter((item) => item.source === 'anexo');
    onChange(new Set((anexos.length > 0 ? anexos : items).map((item) => item.key)));
  };

  return (
    <Collapsible
      open={aberto}
      onOpenChange={setAberto}
      className="overflow-hidden rounded-md border border-amber-900/20 bg-[var(--color-surface-card,#fffdf9)] shadow-[inset_0_1px_0_rgba(255,248,240,0.6)]"
    >
      <CollapsibleTrigger asChild>
        <button
          type="button"
          aria-expanded={aberto}
          className={cn(
            'flex w-full items-center gap-2 px-2.5 py-1.5 text-left',
            'transition-colors duration-150 hover:bg-amber-950/[0.04]',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-800/30 focus-visible:ring-inset',
            'motion-reduce:transition-none',
            aberto && 'border-b border-amber-900/15',
          )}
        >
          <span
            aria-hidden
            className="flex h-6 w-6 shrink-0 items-center justify-center rounded-sm bg-amber-950/10 text-amber-950 dark:text-amber-100"
          >
            <Paperclip className="h-3.5 w-3.5" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
              <span className="text-[11px] font-semibold tracking-wide text-amber-950 dark:text-amber-50">
                Anexos para precificar
              </span>
              <Badge
                variant="secondary"
                className="h-5 rounded-sm px-1.5 font-mono text-[10px] font-medium tabular-nums"
              >
                {isLoading ? '…' : `${selecionados.length}/${items.length}`}
              </Badge>
              {pdfs > 0 && (
                <span className="inline-flex items-center gap-0.5 text-[10px] text-amber-800 dark:text-amber-200">
                  <FileText className="h-3 w-3" />
                  {pdfs}
                </span>
              )}
              {fotos > 0 && (
                <span className="inline-flex items-center gap-0.5 text-[10px] text-sky-800 dark:text-sky-200">
                  <ImageIcon className="h-3 w-3" />
                  {fotos}
                </span>
              )}
            </span>
            {!aberto && previewNomes.length > 0 && (
              <span className="mt-0.5 block truncate text-[10px] text-muted-foreground">
                {previewNomes.join(' · ')}
                {selecionados.length > 2 ? ` +${selecionados.length - 2}` : ''}
              </span>
            )}
            {!aberto && !isLoading && items.length === 0 && (
              <span className="mt-0.5 block text-[10px] text-muted-foreground">
                Nenhum PDF ou foto neste lead
              </span>
            )}
          </span>
          <ChevronDown
            aria-hidden
            className={cn(
              'h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform duration-200 motion-reduce:transition-none',
              aberto && 'rotate-180',
            )}
          />
        </button>
      </CollapsibleTrigger>

      <CollapsibleContent className="data-[state=closed]:animate-none">
        <div className="space-y-2 p-2.5 pt-2">
          <p className="text-[11px] leading-snug text-muted-foreground">
            PDF e foto já no lead — sem enviar de novo. Até {PIPELINE_LEAD_AI_MAX_ITEMS_PER_ANALYSIS}{' '}
            arquivos e {PIPELINE_LEAD_AI_MAX_IMAGES_PER_ANALYSIS} páginas.
          </p>
          <div className="flex flex-wrap gap-1">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 text-[11px]"
              onClick={selecionarAnexosDoLead}
            >
              Anexos do lead
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 text-[11px]"
              onClick={() => onChange(new Set(items.map((item) => item.key)))}
              disabled={items.length === 0}
            >
              Todos
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 text-[11px]"
              onClick={() => onChange(new Set())}
              disabled={selectedKeys.size === 0}
            >
              Limpar
            </Button>
          </div>

          {isLoading ? (
            <p className="text-[11px] text-muted-foreground">Carregando anexos do lead…</p>
          ) : items.length === 0 ? (
            <p className="rounded-md border border-dashed px-3 py-3 text-center text-xs text-muted-foreground">
              Nenhum PDF ou foto neste lead. Anexe na ficha (pasta orçamentos) e volte aqui.
            </p>
          ) : (
            <ScrollArea className="h-[min(9rem,24vh)] rounded-md border bg-background/70">
              <ul className="divide-y">
                {items.map((item) => {
                  const id = `markup-ia-anexo-${item.key.replace(/[^a-zA-Z0-9_-]/g, '_')}`;
                  const selected = selectedKeys.has(item.key);
                  return (
                    <li key={item.key}>
                      <label
                        htmlFor={id}
                        className={cn(
                          'flex cursor-pointer items-center gap-2 px-2.5 py-1.5 text-xs',
                          selected && 'bg-amber-900/[0.07]',
                        )}
                      >
                        <Checkbox
                          id={id}
                          checked={selected}
                          onCheckedChange={(value) => toggle(item.key, value === true)}
                        />
                        {item.kind === 'pdf' ? (
                          <FileText className="h-3.5 w-3.5 shrink-0 text-amber-800" />
                        ) : (
                          <ImageIcon className="h-3.5 w-3.5 shrink-0 text-sky-700" />
                        )}
                        <span className="min-w-0 flex-1 truncate" title={item.label}>
                          {item.label}
                        </span>
                        <PdfPageHint item={item} />
                        <Badge variant="outline" className="shrink-0 text-[9px] font-normal">
                          {item.source === 'anexo' ? 'Lead' : item.source === 'whiteboard' ? 'Lousa' : 'Slide'}
                        </Badge>
                      </label>
                    </li>
                  );
                })}
              </ul>
            </ScrollArea>
          )}

          {selecionados.length > 0 && (
            <p className="text-[11px] text-muted-foreground">
              {selecionados.length} selecionado(s)
              {acimaDoTetoArquivos
                ? ` — só os ${PIPELINE_LEAD_AI_MAX_ITEMS_PER_ANALYSIS} primeiros serão lidos.`
                : ''}
            </p>
          )}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
