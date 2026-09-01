import { useCallback, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useEmpresa } from '@/contexts/EmpresaContext';
import {
  downloadLeadAIRenderPng,
  exportLeadAIRenderComparisonPng,
  exportLeadAIRenderPdf,
} from '@/lib/lead-ai-render-export';
import { leadNestedMenuClass } from '@/lib/overlay-z-index';
import { cn } from '@/lib/utils';
import { ChevronDown, Download, FileImage, FileText, LayoutTemplate, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface LeadAIRenderDownloadMenuProps {
  outputUrl: string | null;
  sketchUrl?: string | null;
  sketchLabel?: string;
  triggerLabel?: string;
  /** Em telas pequenas, esconde o texto e mantém só o ícone. */
  compactTrigger?: boolean;
  /** Apenas ícone (ideal em cards estreitos). */
  iconOnly?: boolean;
  menuTitle?: string;
  className?: string;
  triggerClassName?: string;
  leadName?: string | null;
  leadId?: number | null;
  onOpenStudio?: () => void;
  /**
   * Só use true fora de um Dialog. Dentro do card do lead, modal=true cria um
   * véu do Radix que engole os cliques (nada fecha, nada responde).
   */
  menuModal?: boolean;
}

export function LeadAIRenderDownloadMenu({
  outputUrl,
  sketchUrl = null,
  sketchLabel = 'Esboço',
  triggerLabel = 'Baixar',
  compactTrigger = true,
  iconOnly = false,
  menuTitle = 'Exportar comparação',
  className,
  triggerClassName,
  leadName,
  leadId,
  onOpenStudio,
  menuModal = false,
}: LeadAIRenderDownloadMenuProps) {
  const { empresa } = useEmpresa();
  const [isDownloading, setIsDownloading] = useState(false);

  const canExport = Boolean(outputUrl || sketchUrl);

  const exportOpts = {
    sketchUrl,
    sketchLabel,
    outputUrl,
    logoUrl: empresa?.logo_url,
    nomeEmpresa: empresa?.nome,
    cnpj: empresa?.cnpj,
    leadName,
    leadId,
  };

  const handleDownloadPng = useCallback(async (url: string | null, suffix: string) => {
    if (!url) return;
    setIsDownloading(true);
    try {
      await downloadLeadAIRenderPng(url, `${suffix}.png`);
      toast.success('PNG baixado');
    } catch (error) {
      toast.error('Erro ao baixar PNG', {
        description: error instanceof Error ? error.message : 'Tente novamente.',
      });
    } finally {
      setIsDownloading(false);
    }
  }, []);

  const handleExportPdf = useCallback(async () => {
    setIsDownloading(true);
    try {
      await exportLeadAIRenderPdf(exportOpts);
      toast.success('PDF da prancha baixado');
    } catch (error) {
      toast.error('Erro ao exportar PDF', {
        description: error instanceof Error ? error.message : 'Tente novamente.',
      });
    } finally {
      setIsDownloading(false);
    }
  }, [exportOpts]);

  const handlePranchaPng = useCallback(async () => {
    setIsDownloading(true);
    try {
      await exportLeadAIRenderComparisonPng(exportOpts);
      toast.success('Prancha PNG baixada');
    } catch (error) {
      toast.error('Erro ao exportar prancha', {
        description: error instanceof Error ? error.message : 'Tente novamente.',
      });
    } finally {
      setIsDownloading(false);
    }
  }, [exportOpts]);

  if (!canExport) return null;

  return (
    <DropdownMenu modal={menuModal}>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size={iconOnly ? 'icon' : 'sm'}
          disabled={isDownloading}
          aria-label={iconOnly ? triggerLabel : undefined}
          title={iconOnly ? triggerLabel : undefined}
          onPointerDown={(event) => event.stopPropagation()}
          onClick={(event) => event.stopPropagation()}
          className={cn(
            iconOnly
              ? 'h-8 w-8 shrink-0 text-cream-muted hover:bg-gold/10 hover:text-gold'
              : 'h-8 text-xs text-cream-muted hover:text-gold',
            triggerClassName,
            className,
          )}
        >
          {isDownloading ? (
            <Loader2 className={cn('h-3.5 w-3.5 animate-spin', !iconOnly && 'mr-1.5')} />
          ) : (
            <Download className={cn('h-3.5 w-3.5', !iconOnly && 'mr-1.5')} />
          )}
          {!iconOnly && (
            <span className={compactTrigger ? 'hidden sm:inline' : undefined}>
              {isDownloading ? 'Baixando…' : triggerLabel}
            </span>
          )}
          {!iconOnly && <ChevronDown className="ml-1 h-3 w-3 opacity-70" />}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        sideOffset={8}
        data-lead-ai-render-download-menu=""
        onCloseAutoFocus={(event) => event.preventDefault()}
        onPointerDown={(event) => event.stopPropagation()}
        onFocusOutside={(event) => event.preventDefault()}
        className={cn(
          leadNestedMenuClass,
          'w-64 p-2 rounded-xl border border-gold-border-subtle/30',
          '!bg-[#2a1812] !text-cream-secondary pointer-events-auto shadow-2xl shadow-black/50',
        )}
      >
        <DropdownMenuLabel className="text-[10px] uppercase tracking-[0.18em] text-cream-muted font-semibold px-2 py-1.5">
          {menuTitle}
        </DropdownMenuLabel>
        <DropdownMenuSeparator className="bg-gold-border-subtle/20" />
        {onOpenStudio && (
          <DropdownMenuItem
            disabled={isDownloading}
            onSelect={() => onOpenStudio()}
            className="flex items-start gap-3 rounded-lg px-3 py-2.5 cursor-pointer focus:bg-gold/10 focus:text-gold"
          >
            <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gold/10 text-gold ring-1 ring-gold/20">
              <LayoutTemplate className="h-4 w-4" />
            </span>
            <span className="flex flex-col gap-0.5 min-w-0">
              <span className="text-sm font-medium">Estúdio de impressão</span>
              <span className="text-xs text-cream-muted leading-snug">
                Ver a prancha e escolher PDF ou PNG
              </span>
            </span>
          </DropdownMenuItem>
        )}
        {sketchUrl && (
          <DropdownMenuItem
            disabled={isDownloading}
            onSelect={() => void handleDownloadPng(sketchUrl, 'antes')}
            className="flex items-start gap-3 rounded-lg px-3 py-2.5 cursor-pointer focus:bg-gold/10 focus:text-gold"
          >
            <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gold/10 text-gold ring-1 ring-gold/20">
              <FileImage className="h-4 w-4" />
            </span>
            <span className="flex flex-col gap-0.5 min-w-0">
              <span className="text-sm font-medium">PNG do antes</span>
              <span className="text-xs text-cream-muted leading-snug">Montagem da lousa</span>
            </span>
          </DropdownMenuItem>
        )}
        {outputUrl && (
          <DropdownMenuItem
            disabled={isDownloading}
            onSelect={() => void handleDownloadPng(outputUrl, 'depois')}
            className="flex items-start gap-3 rounded-lg px-3 py-2.5 cursor-pointer focus:bg-gold/10 focus:text-gold"
          >
            <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gold/10 text-gold ring-1 ring-gold/20">
              <FileImage className="h-4 w-4" />
            </span>
            <span className="flex flex-col gap-0.5 min-w-0">
              <span className="text-sm font-medium">PNG do depois</span>
              <span className="text-xs text-cream-muted leading-snug">Render fotorrealista</span>
            </span>
          </DropdownMenuItem>
        )}
        <DropdownMenuItem
          disabled={isDownloading}
          onSelect={() => void handlePranchaPng()}
          className="flex items-start gap-3 rounded-lg px-3 py-2.5 cursor-pointer focus:bg-gold/10 focus:text-gold"
        >
          <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gold/10 text-gold ring-1 ring-gold/20">
            <FileImage className="h-4 w-4" />
          </span>
          <span className="flex flex-col gap-0.5 min-w-0">
            <span className="text-sm font-medium">PNG da prancha</span>
            <span className="text-xs text-cream-muted leading-snug">Antes e depois na mesma folha</span>
          </span>
        </DropdownMenuItem>
        <DropdownMenuItem
          disabled={isDownloading}
          onSelect={() => void handleExportPdf()}
          className="flex items-start gap-3 rounded-lg px-3 py-2.5 cursor-pointer focus:bg-gold/10 focus:text-gold"
        >
          <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gold/10 text-gold ring-1 ring-gold/20">
            <FileText className="h-4 w-4" />
          </span>
          <span className="flex flex-col gap-0.5 min-w-0">
            <span className="text-sm font-medium">PDF para imprimir</span>
            <span className="text-xs text-cream-muted leading-snug">
              Folha A4 deitada, pronta para o cliente
            </span>
          </span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
