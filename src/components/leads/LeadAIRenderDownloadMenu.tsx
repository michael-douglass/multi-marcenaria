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
  exportLeadAIRenderPdf,
} from '@/lib/lead-ai-render-export';
import { cn } from '@/lib/utils';
import { ChevronDown, Download, FileImage, FileText } from 'lucide-react';
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
  /** Use false dentro de diálogos modais para o menu abrir corretamente. */
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
  menuModal = false,
}: LeadAIRenderDownloadMenuProps) {
  const { empresa } = useEmpresa();
  const [isDownloading, setIsDownloading] = useState(false);

  const canExport = Boolean(outputUrl || sketchUrl);

  const handleDownloadPng = useCallback(async () => {
    if (!outputUrl) return;
    setIsDownloading(true);
    try {
      await downloadLeadAIRenderPng(outputUrl);
      toast.success('Imagem baixada com sucesso');
    } catch (error) {
      toast.error('Erro ao baixar imagem', {
        description: error instanceof Error ? error.message : 'Tente novamente.',
      });
    } finally {
      setIsDownloading(false);
    }
  }, [outputUrl]);

  const handleExportPdf = useCallback(() => {
    try {
      exportLeadAIRenderPdf({
        sketchUrl,
        sketchLabel,
        outputUrl,
        logoUrl: empresa?.logo_url,
        nomeEmpresa: empresa?.nome,
        cnpj: empresa?.cnpj,
      });
    } catch (error) {
      toast.error('Erro ao exportar PDF', {
        description: error instanceof Error ? error.message : 'Tente novamente.',
      });
    }
  }, [empresa?.cnpj, empresa?.logo_url, empresa?.nome, outputUrl, sketchLabel, sketchUrl]);

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
          className={cn(
            iconOnly
              ? 'h-8 w-8 shrink-0 text-cream-muted hover:bg-gold/10 hover:text-gold'
              : 'h-8 text-xs text-cream-muted hover:text-gold',
            triggerClassName,
            className,
          )}
        >
          <Download className={cn('h-3.5 w-3.5', !iconOnly && 'mr-1.5')} />
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
        className={cn(
          'z-[100] w-64 p-2 rounded-xl border border-gold-border-subtle/30',
          'bg-mahogany-panel/95 backdrop-blur-xl text-foreground shadow-2xl shadow-black/50',
        )}
      >
        <DropdownMenuLabel className="text-[10px] uppercase tracking-[0.18em] text-cream-muted font-semibold px-2 py-1.5">
          {menuTitle}
        </DropdownMenuLabel>
        <DropdownMenuSeparator className="bg-gold-border-subtle/20" />
        {outputUrl && (
          <DropdownMenuItem
            disabled={isDownloading}
            onSelect={() => void handleDownloadPng()}
            className="flex items-start gap-3 rounded-lg px-3 py-2.5 cursor-pointer focus:bg-gold/10 focus:text-gold"
          >
            <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gold/10 text-gold ring-1 ring-gold/20">
              <FileImage className="h-4 w-4" />
            </span>
            <span className="flex flex-col gap-0.5 min-w-0">
              <span className="text-sm font-medium">Baixar render (PNG)</span>
              <span className="text-xs text-cream-muted leading-snug">
                Salva a imagem fotorrealista no seu computador
              </span>
            </span>
          </DropdownMenuItem>
        )}
        <DropdownMenuItem
          onSelect={handleExportPdf}
          className="flex items-start gap-3 rounded-lg px-3 py-2.5 cursor-pointer focus:bg-gold/10 focus:text-gold"
        >
          <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gold/10 text-gold ring-1 ring-gold/20">
            <FileText className="h-4 w-4" />
          </span>
          <span className="flex flex-col gap-0.5 min-w-0">
            <span className="text-sm font-medium">Exportar PDF</span>
            <span className="text-xs text-cream-muted leading-snug">
              {sketchUrl && outputUrl
                ? 'Antes e depois com logo e nome da empresa'
                : 'Com logo e nome da empresa'}
            </span>
          </span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
