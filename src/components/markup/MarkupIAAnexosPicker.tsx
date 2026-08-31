import { useEffect, useMemo, useState } from 'react';
import { FileText, Image as ImageIcon, Paperclip } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
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
  const selecionados = useMemo(
    () => items.filter((item) => selectedKeys.has(item.key)),
    [items, selectedKeys],
  );
  const acimaDoTetoArquivos = selectedKeys.size > PIPELINE_LEAD_AI_MAX_ITEMS_PER_ANALYSIS;

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
    <div className="space-y-2 rounded-lg border border-violet-500/20 bg-violet-500/5 p-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <Label className="flex items-center gap-1.5 text-xs font-medium">
            <Paperclip className="h-3.5 w-3.5" />
            Usar estes anexos para precificar
          </Label>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            PDF e foto já no lead — sem enviar de novo. Até {PIPELINE_LEAD_AI_MAX_ITEMS_PER_ANALYSIS}{' '}
            arquivos e {PIPELINE_LEAD_AI_MAX_IMAGES_PER_ANALYSIS} páginas.
          </p>
        </div>
        <div className="flex gap-1">
          <Button type="button" variant="ghost" size="sm" className="h-7 text-[11px]" onClick={selecionarAnexosDoLead}>
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
      </div>

      {isLoading ? (
        <p className="text-[11px] text-muted-foreground">Carregando anexos do lead…</p>
      ) : items.length === 0 ? (
        <p className="rounded-md border border-dashed px-3 py-4 text-center text-xs text-muted-foreground">
          Nenhum PDF ou foto neste lead. Anexe na ficha (pasta orçamentos) e volte aqui.
        </p>
      ) : (
        <ScrollArea className="h-[min(11rem,28vh)] rounded-md border bg-background/60">
          <ul className="divide-y">
            {items.map((item) => {
              const id = `markup-ia-anexo-${item.key.replace(/[^a-zA-Z0-9_-]/g, '_')}`;
              const selected = selectedKeys.has(item.key);
              return (
                <li key={item.key}>
                  <label
                    htmlFor={id}
                    className={cn(
                      'flex cursor-pointer items-center gap-2 px-2.5 py-2 text-xs',
                      selected && 'bg-violet-500/10',
                    )}
                  >
                    <Checkbox
                      id={id}
                      checked={selected}
                      onCheckedChange={(value) => toggle(item.key, value === true)}
                    />
                    {item.kind === 'pdf' ? (
                      <FileText className="h-3.5 w-3.5 shrink-0 text-amber-700" />
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
  );
}
