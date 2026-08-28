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
  downloadLeadFotosPdf,
  downloadLeadImageAsJpg,
} from '@/lib/lead-fotos-pdf-export';
import { cn } from '@/lib/utils';
import { ChevronDown, Download, FileImage, FileText, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface LeadAttachmentDownloadMenuProps {
  imageUrl: string;
  fileName: string;
  imageLabel?: string;
  leadName?: string | null;
  leadId?: number | null;
  triggerLabel?: string;
  iconOnly?: boolean;
  menuTitle?: string;
  className?: string;
  triggerClassName?: string;
  /** Use true dentro de diálogos modais para o menu abrir corretamente. */
  menuModal?: boolean;
}

export function LeadAttachmentDownloadMenu({
  imageUrl,
  fileName,
  imageLabel,
  leadName,
  leadId,
  triggerLabel = 'Baixar',
  iconOnly = false,
  menuTitle = 'Baixar imagem',
  className,
  triggerClassName,
  menuModal = true,
}: LeadAttachmentDownloadMenuProps) {
  const { empresa } = useEmpresa();
  const [isDownloading, setIsDownloading] = useState(false);

  const handleDownloadJpg = useCallback(async () => {
    setIsDownloading(true);
    try {
      await downloadLeadImageAsJpg(imageUrl, fileName);
      toast.success('Imagem baixada em JPG');
    } catch (error) {
      toast.error('Erro ao baixar imagem', {
        description: error instanceof Error ? error.message : 'Tente novamente.',
      });
    } finally {
      setIsDownloading(false);
    }
  }, [fileName, imageUrl]);

  const handleDownloadPdf = useCallback(async () => {
    setIsDownloading(true);
    try {
      await downloadLeadFotosPdf({
        imageUrls: [imageUrl],
        imageLabels: [imageLabel || fileName],
        logoUrl: empresa?.logo_url,
        nomeEmpresa: empresa?.nome,
        cnpj: empresa?.cnpj,
        leadName,
        leadId,
      });
      toast.success('PDF baixado com sucesso');
    } catch (error) {
      toast.error('Erro ao baixar PDF', {
        description: error instanceof Error ? error.message : 'Tente novamente.',
      });
    } finally {
      setIsDownloading(false);
    }
  }, [
    empresa?.cnpj,
    empresa?.logo_url,
    empresa?.nome,
    fileName,
    imageLabel,
    imageUrl,
    leadId,
    leadName,
  ]);

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
            iconOnly ? 'h-7 w-7' : 'h-8 text-xs',
            triggerClassName,
            className,
          )}
          onClick={(e) => e.stopPropagation()}
        >
          {isDownloading ? (
            <Loader2 className={cn('h-3.5 w-3.5 animate-spin', !iconOnly && 'mr-1.5')} />
          ) : (
            <Download className={cn('h-3.5 w-3.5', !iconOnly && 'mr-1.5')} />
          )}
          {!iconOnly && (
            <span>{isDownloading ? 'Baixando…' : triggerLabel}</span>
          )}
          {!iconOnly && <ChevronDown className="ml-1 h-3 w-3 opacity-70" />}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        sideOffset={8}
        className="z-[110] w-60 p-2"
        onClick={(e) => e.stopPropagation()}
      >
        <DropdownMenuLabel className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold px-2 py-1.5">
          {menuTitle}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          disabled={isDownloading}
          onSelect={() => void handleDownloadJpg()}
          className="flex items-start gap-3 rounded-lg px-3 py-2.5 cursor-pointer"
        >
          <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted">
            <FileImage className="h-4 w-4" />
          </span>
          <span className="flex flex-col gap-0.5 min-w-0">
            <span className="text-sm font-medium">Baixar JPG</span>
            <span className="text-xs text-muted-foreground leading-snug">
              Salva a imagem original no seu computador
            </span>
          </span>
        </DropdownMenuItem>
        <DropdownMenuItem
          disabled={isDownloading}
          onSelect={() => void handleDownloadPdf()}
          className="flex items-start gap-3 rounded-lg px-3 py-2.5 cursor-pointer"
        >
          <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted">
            <FileText className="h-4 w-4" />
          </span>
          <span className="flex flex-col gap-0.5 min-w-0">
            <span className="text-sm font-medium">Baixar PDF</span>
            <span className="text-xs text-muted-foreground leading-snug">
              Com logo e nome da empresa
            </span>
          </span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
