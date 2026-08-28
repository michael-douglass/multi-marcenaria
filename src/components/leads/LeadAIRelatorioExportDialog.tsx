import { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useEmpresa } from '@/contexts/EmpresaContext';
import { openLeadAIRelatorioPdfPrint } from '@/lib/lead-ai-relatorio-pdf-export';
import { normalizarRelatorioAnaliseIa } from '@/lib/lead-ai-relatorio-markdown';
import { FileDown, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface LeadAIRelatorioExportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialContent: string;
  initialBriefing?: string | null;
  leadName?: string | null;
  leadId?: number | null;
}

export function LeadAIRelatorioExportDialog({
  open,
  onOpenChange,
  initialContent,
  initialBriefing = null,
  leadName,
  leadId,
}: LeadAIRelatorioExportDialogProps) {
  const { empresa } = useEmpresa();
  const [content, setContent] = useState('');
  const [briefing, setBriefing] = useState('');
  const [isExporting, setIsExporting] = useState(false);

  useEffect(() => {
    if (!open) return;
    setContent(normalizarRelatorioAnaliseIa(initialContent));
    setBriefing(initialBriefing?.trim() ? normalizarRelatorioAnaliseIa(initialBriefing) : '');
  }, [open, initialContent, initialBriefing]);

  const handleExport = () => {
    if (!content.trim() && !briefing.trim()) {
      toast.error('O relatório está vazio. Adicione conteúdo antes de exportar.');
      return;
    }

    setIsExporting(true);
    try {
      openLeadAIRelatorioPdfPrint({
        content: content.trim(),
        briefingContent: briefing.trim() || null,
        logoUrl: empresa?.logo_url,
        nomeEmpresa: empresa?.nome,
        cnpj: empresa?.cnpj,
        leadName,
        leadId,
      });
      toast.success('PDF pronto para salvar ou imprimir');
      onOpenChange(false);
    } catch (error) {
      toast.error('Não foi possível exportar o PDF', {
        description: error instanceof Error ? error.message : 'Tente novamente.',
      });
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !isExporting && onOpenChange(next)}>
      <DialogContent className="flex max-h-[min(92dvh,820px)] flex-col gap-0 overflow-hidden border-gold-border-subtle/30 bg-mahogany-panel p-0 sm:max-w-2xl">
        <DialogHeader className="shrink-0 space-y-1 border-b border-gold-border-subtle/20 px-5 py-4 text-left">
          <DialogTitle className="font-display text-lg uppercase tracking-wide text-primary">
            Exportar relatório em PDF
          </DialogTitle>
          <DialogDescription className="text-sm text-cream-muted">
            Revise e edite o texto abaixo antes de gerar o PDF. O documento incluirá a logo e os dados
            da empresa.
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4">
          <div className="space-y-2">
            <Label htmlFor="relatorio-export-content" className="text-sm font-medium text-foreground">
              Relatório da análise
            </Label>
            <Textarea
              id="relatorio-export-content"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              disabled={isExporting}
              className="min-h-[220px] resize-y border-gold-border-subtle/30 bg-mahogany-muted/30 font-mono text-sm leading-relaxed"
              placeholder="Conteúdo do relatório…"
            />
            <p className="text-xs text-cream-muted">
              Suporta títulos com <code className="text-gold-soft">##</code>, listas com{' '}
              <code className="text-gold-soft">-</code> e negrito com{' '}
              <code className="text-gold-soft">**texto**</code>.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="relatorio-export-briefing" className="text-sm font-medium text-foreground">
              Perguntas para briefing{' '}
              <span className="font-normal text-cream-muted">(opcional)</span>
            </Label>
            <Textarea
              id="relatorio-export-briefing"
              value={briefing}
              onChange={(e) => setBriefing(e.target.value)}
              disabled={isExporting}
              className="min-h-[120px] resize-y border-gold-border-subtle/30 bg-mahogany-muted/30 font-mono text-sm leading-relaxed"
              placeholder="Perguntas sugeridas para o briefing com o cliente…"
            />
          </div>
        </div>

        <DialogFooter className="shrink-0 gap-2 border-t border-gold-border-subtle/20 px-5 py-4 sm:justify-end">
          <Button
            type="button"
            variant="ghost"
            disabled={isExporting}
            onClick={() => onOpenChange(false)}
          >
            Cancelar
          </Button>
          <Button type="button" disabled={isExporting} onClick={handleExport}>
            {isExporting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Gerando…
              </>
            ) : (
              <>
                <FileDown className="mr-2 h-4 w-4" />
                Baixar PDF
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
