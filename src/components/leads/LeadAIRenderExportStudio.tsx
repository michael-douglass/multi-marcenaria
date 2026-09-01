import { useState, type ReactNode } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { LeadAIRenderExportFoil } from '@/components/leads/LeadAIRenderExportFoil';
import { useEmpresa } from '@/contexts/EmpresaContext';
import {
  buildLeadAIRenderExportBaseName,
  downloadLeadAIRenderPng,
  downloadLeadAIRenderPairPngs,
  exportLeadAIRenderComparisonPng,
  exportLeadAIRenderPdf,
  openLeadAIRenderPrintPage,
} from '@/lib/lead-ai-render-export';
import { GARBO_LOGO_SRC } from '@/lib/garbo-brand';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { FileImage, FileText, Loader2, Printer } from 'lucide-react';
import { toast } from 'sonner';

interface LeadAIRenderExportStudioProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sketchUrl: string | null;
  sketchLabel?: string;
  outputUrl: string | null;
  leadName?: string | null;
  leadId?: number | null;
}

type ExportJob = 'antes' | 'depois' | 'par' | 'prancha' | 'pdf' | 'print' | null;

export function LeadAIRenderExportStudio({
  open,
  onOpenChange,
  sketchUrl,
  sketchLabel = 'Composição de ambiente',
  outputUrl,
  leadName,
  leadId,
}: LeadAIRenderExportStudioProps) {
  const { empresa } = useEmpresa();
  const [job, setJob] = useState<ExportJob>(null);

  const opts = {
    sketchUrl,
    sketchLabel,
    outputUrl,
    logoUrl: empresa?.logo_url || GARBO_LOGO_SRC,
    nomeEmpresa: empresa?.nome || 'Garbo Movelaria',
    cnpj: empresa?.cnpj,
    leadName,
    leadId,
  };

  const dataGeracao = format(new Date(), "dd 'de' MMMM 'de' yyyy", { locale: ptBR });
  const busy = job !== null;

  const run = async (next: Exclude<ExportJob, null>, work: () => Promise<void>, ok: string) => {
    setJob(next);
    try {
      await work();
      toast.success(ok);
    } catch (error) {
      toast.error('Não foi possível exportar', {
        description: error instanceof Error ? error.message : 'Tente novamente.',
      });
    } finally {
      setJob(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        nested
        overlayClassName="z-[80]"
        className={cn(
          'flex max-h-[min(96dvh,920px)] w-[min(1080px,calc(100vw-1rem))] flex-col gap-0 overflow-hidden p-0',
          '!z-[81] border-gold/30 bg-[#140c09] shadow-2xl shadow-black/70',
        )}
        onPointerDown={(event) => event.stopPropagation()}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="relative overflow-hidden border-b border-gold/25 px-5 py-4 sm:px-6">
          <LeadAIRenderExportFoil />
          <div className="relative">
            <DialogHeader className="space-y-1 text-left">
              <p className="font-display text-[11px] tracking-[0.28em] text-[#f2d892]">Estúdio de impressão</p>
              <DialogTitle className="font-display text-2xl tracking-[0.08em] text-[#f4ead6]">
                Prancha antes e depois
              </DialogTitle>
              <DialogDescription className="max-w-xl text-sm text-[#d7c4ae]">
                Página pronta para apresentar ao cliente: PNG solto, prancha completa ou PDF em folha A4 deitada.
              </DialogDescription>
            </DialogHeader>
          </div>
        </div>

        <div className="grid min-h-0 flex-1 grid-cols-1 gap-0 overflow-y-auto">
          <div className="bg-[#1a100c] p-3 sm:p-5">
            <div
              className="relative mx-auto aspect-[297/210] w-full min-h-[200px] max-w-[820px] overflow-hidden rounded-[2px] shadow-[0_24px_60px_rgba(0,0,0,0.45)]"
              style={{ background: '#f4ead6', color: '#2a1812' }}
            >
              <div className="absolute inset-[3.2%] border border-[#9a7b3c]/80">
                <div className="absolute left-[4%] right-[4%] top-[5%] flex items-start justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <img
                      src={opts.logoUrl}
                      alt=""
                      className="h-8 w-auto object-contain sm:h-10"
                    />
                    <div className="min-w-0">
                      <p className="font-display text-[11px] tracking-[0.06em] text-[#2a1812] sm:text-sm">
                        {opts.nomeEmpresa}
                      </p>
                      <p className="text-[8px] uppercase tracking-[0.18em] text-[#9a7b3c] sm:text-[9px]">
                        Prancha de apresentação · Antes e depois
                      </p>
                    </div>
                  </div>
                  <div className="shrink-0 text-right text-[8px] leading-snug text-[#6b5344] sm:text-[10px]">
                    {leadName ? <p className="max-w-[12rem] truncate">{leadName}</p> : null}
                    <p>{dataGeracao}</p>
                  </div>
                </div>
                <div className="absolute left-[4%] right-[4%] top-[22%] h-px bg-[#9a7b3c]/80" />
                <div className="absolute bottom-[12%] left-[4%] right-[4%] top-[26%] grid grid-cols-2 gap-2 sm:gap-3">
                  <PrintPreviewCol
                    badge="Antes"
                    label={sketchLabel}
                    src={sketchUrl}
                    empty="Sem montagem"
                  />
                  <PrintPreviewCol
                    badge="Depois"
                    label="Render fotorrealista"
                    src={outputUrl}
                    empty="Sem render"
                  />
                </div>
                <div className="absolute bottom-[3.5%] left-[4%] right-[4%] flex items-center justify-between border-t border-[#9a7b3c]/70 pt-1.5 text-[7px] text-[#6b5344] sm:text-[9px]">
                  <span>Documento para apresentação ao cliente</span>
                  <span>Impressão ateliê</span>
                </div>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-3 border-t border-gold/20 bg-[#120a08] p-4 sm:p-5 lg:border-l lg:border-t-0">
            <p className="font-display text-[11px] tracking-[0.22em] text-[#f2d892]">Exportar</p>
            <StudioAction
              icon={<FileImage className="h-4 w-4" />}
              title="PNG do antes"
              hint="A montagem da lousa, sozinha"
              disabled={busy || !sketchUrl}
              loading={job === 'antes'}
              onClick={() =>
                void run(
                  'antes',
                  () => downloadLeadAIRenderPng(sketchUrl!, `${buildLeadAIRenderExportBaseName(opts)}-antes.png`),
                  'PNG do antes baixado',
                )
              }
            />
            <StudioAction
              icon={<FileImage className="h-4 w-4" />}
              title="PNG do depois"
              hint="O render fotorrealista, sozinho"
              disabled={busy || !outputUrl}
              loading={job === 'depois'}
              onClick={() =>
                void run(
                  'depois',
                  () => downloadLeadAIRenderPng(outputUrl!, `${buildLeadAIRenderExportBaseName(opts)}-depois.png`),
                  'PNG do depois baixado',
                )
              }
            />
            <StudioAction
              icon={<FileImage className="h-4 w-4" />}
              title="PNG da prancha"
              hint="Antes e depois na mesma folha"
              disabled={busy || (!sketchUrl && !outputUrl)}
              loading={job === 'prancha'}
              onClick={() =>
                void run('prancha', () => exportLeadAIRenderComparisonPng(opts), 'Prancha PNG baixada')
              }
            />
            <StudioAction
              icon={<FileText className="h-4 w-4" />}
              title="PDF para imprimir"
              hint="Folha A4 deitada, pronta para o cliente"
              disabled={busy || (!sketchUrl && !outputUrl)}
              loading={job === 'pdf'}
              onClick={() => void run('pdf', () => exportLeadAIRenderPdf(opts), 'PDF da prancha baixado')}
            />
            <StudioAction
              icon={<Printer className="h-4 w-4" />}
              title="Imprimir agora"
              hint="Abre a página elaborada e chama a impressora"
              disabled={busy || (!sketchUrl && !outputUrl)}
              loading={job === 'print'}
              onClick={() =>
                void run('print', () => openLeadAIRenderPrintPage(opts), 'Página de impressão aberta')
              }
            />
            {(sketchUrl || outputUrl) && (
              <Button
                type="button"
                variant="outline"
                disabled={busy}
                onClick={() =>
                  void run('par', () => downloadLeadAIRenderPairPngs(opts), 'PNG do antes e do depois baixados')
                }
                className="mt-1 h-10 border-[#f2d892]/35 bg-transparent text-xs text-[#f2d892] hover:bg-[#f2d892]/10 hover:text-[#f2d892]"
              >
                {job === 'par' ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : null}
                Baixar os dois PNG de uma vez
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function PrintPreviewCol({
  badge,
  label,
  src,
  empty,
}: {
  badge: string;
  label: string;
  src: string | null;
  empty: string;
}) {
  return (
    <article className="flex h-full min-h-0 flex-col">
      <p className="text-[8px] font-semibold uppercase tracking-[0.18em] text-[#9a7b3c] sm:text-[9px]">{badge}</p>
      <p className="mb-1 truncate text-[8px] text-[#6b5344] sm:text-[10px]">{label}</p>
      <div className="flex min-h-0 flex-1 items-center justify-center overflow-hidden border border-[#c4a574]/80 bg-[#efe4cc]">
        {src ? (
          <img src={src} alt={label} className="h-full w-full object-contain" />
        ) : (
          <p className="px-2 text-center text-[9px] italic text-[#6b5344]">{empty}</p>
        )}
      </div>
    </article>
  );
}

function StudioAction({
  icon,
  title,
  hint,
  disabled,
  loading,
  onClick,
}: {
  icon: ReactNode;
  title: string;
  hint: string;
  disabled?: boolean;
  loading?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onPointerDown={(event) => event.stopPropagation()}
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        onClick();
      }}
      className={cn(
        'flex w-full items-start gap-3 rounded-xl border px-3 py-3 text-left transition',
        'border-[#f2d892]/20 bg-[#1c100c]/80 hover:border-[#f2d892]/50 hover:bg-[#f2d892]/8',
        'disabled:cursor-not-allowed disabled:opacity-45',
      )}
    >
      <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[#f2d892]/40 text-[#f2d892]">
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : icon}
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-medium text-[#f4ead6]">{title}</span>
        <span className="mt-0.5 block text-xs leading-relaxed text-[#c4a090]">{hint}</span>
      </span>
    </button>
  );
}
