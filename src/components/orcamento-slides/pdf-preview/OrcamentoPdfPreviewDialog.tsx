import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { AlertTriangle, Download, Loader2, Monitor, Printer, Share2, Smartphone, X } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Dialog, DialogDescription, DialogPortal, DialogTitle } from '@/components/ui/dialog';
import { useOrcamentoPdfPaginas, type OrcamentoPdfPagina } from '@/hooks/useOrcamentoPdfPaginas';
import type { OrcamentoPdfPronto } from '@/lib/orcamento-slide-export';
import { buildPdfFileName, triggerBlobDownload } from '@/lib/orcamento-slide-print';
import { cn } from '@/lib/utils';
import { OrcamentoPdfPreviewBackdrop } from './OrcamentoPdfPreviewBackdrop';

/**
 * Pré-visualização do PDF exportado — mostra as páginas reais (renderizadas do arquivo)
 * antes de baixar, imprimir ou compartilhar. Tela cheia no celular e no computador.
 */
export function OrcamentoPdfPreviewDialog({ pdf, onClose }: OrcamentoPdfPreviewDialogProps) {
  const { paginas, totalPaginas, isLoading, error } = useOrcamentoPdfPaginas(pdf.blob, pdf.viewport);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [paginaAtual, setPaginaAtual] = useState(1);
  const [canShare] = useState(podeCompartilharArquivo);
  const scrollRef = useRef<HTMLDivElement>(null);
  const printFrameRef = useRef<HTMLIFrameElement | null>(null);

  const isMobileFormat = pdf.viewport === 'mobile';
  const fileName = buildPdfFileName(pdf.titulo);
  const totalExibido = totalPaginas || paginas.length;

  useEffect(() => {
    const url = URL.createObjectURL(pdf.blob);
    setPdfUrl(url);
    return () => {
      URL.revokeObjectURL(url);
      printFrameRef.current?.remove();
      printFrameRef.current = null;
    };
  }, [pdf.blob]);

  // Acompanha qual página está no centro da tela (contador e miniaturas).
  useEffect(() => {
    const root = scrollRef.current;
    if (!root || paginas.length === 0) return;
    const observer = new IntersectionObserver(
      (entries) => {
        const visivel = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        const numero = Number((visivel?.target as HTMLElement | undefined)?.dataset.pagina);
        if (numero) setPaginaAtual(numero);
      },
      { root, threshold: [0.35, 0.6, 0.9] },
    );
    root.querySelectorAll('[data-pagina]').forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [paginas.length, totalExibido]);

  const irParaPagina = useCallback((numero: number) => {
    const alvo = scrollRef.current?.querySelector<HTMLElement>(`[data-pagina="${numero}"]`);
    const reduzirMovimento = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    alvo?.scrollIntoView({ behavior: reduzirMovimento ? 'auto' : 'smooth', block: 'start' });
  }, []);

  const baixar = useCallback(() => {
    triggerBlobDownload(pdf.blob, fileName);
    toast.success('PDF baixado', { description: fileName, duration: 3500 });
  }, [pdf.blob, fileName]);

  const imprimir = useCallback(() => {
    if (pdfUrl) imprimirPdf(pdfUrl, printFrameRef);
  }, [pdfUrl]);

  const compartilhar = useCallback(() => {
    void compartilharPdf(pdf.blob, fileName, pdf.titulo);
  }, [pdf.blob, fileName, pdf.titulo]);

  const acoes: AcaoPdf[] = [
    ...(canShare
      ? [{ id: 'share', label: 'Compartilhar', icon: <Share2 className="h-4 w-4" />, onClick: compartilhar }]
      : []),
    { id: 'print', label: 'Imprimir', icon: <Printer className="h-4 w-4" />, onClick: imprimir, disabled: !pdfUrl },
    { id: 'download', label: 'Baixar PDF', icon: <Download className="h-4 w-4" />, onClick: baixar, primary: true },
  ];

  const slots = Array.from({ length: Math.max(totalExibido, 1) }, (_, i) => i + 1);
  const paginaPorNumero = new Map(paginas.map((p) => [p.pageNumber, p]));
  const mostrarRail = !isMobileFormat && totalExibido > 1;

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogPortal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-[300] bg-black/70 data-[state=open]:animate-in data-[state=open]:fade-in-0" />
        <DialogPrimitive.Content
          className="fixed inset-0 z-[300] flex flex-col overflow-hidden bg-[#0c0705] text-[#f5e9d6] outline-none data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-[0.985] data-[state=open]:duration-300 motion-reduce:animate-none"
          onOpenAutoFocus={(event) => event.preventDefault()}
        >
          <OrcamentoPdfPreviewBackdrop />

          <header className="relative z-10 flex items-center gap-3 border-b border-[#e8c878]/10 bg-[#0c0705]/55 px-4 py-3 backdrop-blur-md sm:px-6 sm:py-4">
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-semibold uppercase tracking-[0.32em] text-[#e8c878]/80">
                Pré-visualização do PDF
              </p>
              <DialogTitle className="mt-0.5 truncate font-serif text-xl font-medium leading-tight text-[#fff6ea] sm:text-2xl">
                {pdf.titulo}
              </DialogTitle>
              <DialogDescription className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-[#f5e9d6]/60">
                <span className="inline-flex items-center gap-1">
                  {isMobileFormat ? <Smartphone className="h-3.5 w-3.5" /> : <Monitor className="h-3.5 w-3.5" />}
                  {isMobileFormat ? 'Celular · 9:16' : 'Computador · 16:9'}
                </span>
                <Ponto />
                <span>{totalExibido > 0 ? `${totalExibido} páginas` : 'Abrindo…'}</span>
                <Ponto />
                <span>{formatarTamanho(pdf.blob.size)}</span>
                {pdf.fromCache && (
                  <>
                    <Ponto />
                    <span className="text-[#e8c878]/80">já estava pronto</span>
                  </>
                )}
              </DialogDescription>
            </div>

            <div className="hidden items-center gap-2 sm:flex">
              {acoes.map((acao) => (
                <AcaoBotao key={acao.id} acao={acao} />
              ))}
            </div>

            <DialogPrimitive.Close asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label="Fechar pré-visualização"
                className="shrink-0 rounded-full text-[#f5e9d6]/80 hover:bg-white/10 hover:text-white"
              >
                <X className="h-5 w-5" />
              </Button>
            </DialogPrimitive.Close>
          </header>

          <div className="relative z-10 flex min-h-0 flex-1">
            {mostrarRail && (
              <MiniaturasRail
                slots={slots}
                paginaPorNumero={paginaPorNumero}
                paginaAtual={paginaAtual}
                onSelect={irParaPagina}
              />
            )}

            <div
              ref={scrollRef}
              className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 pb-28 pt-5 sm:px-8 sm:pb-12 sm:pt-8"
            >
              {error ? (
                <EstadoErro mensagem={error} onBaixar={baixar} />
              ) : paginas.length === 0 && isLoading ? (
                <EstadoAbrindo />
              ) : (
                <div
                  className={cn(
                    'mx-auto',
                    isMobileFormat
                      ? 'grid max-w-[460px] grid-cols-1 gap-8 sm:max-w-5xl sm:grid-cols-2 sm:gap-x-8 sm:gap-y-10 xl:max-w-6xl xl:grid-cols-3'
                      : 'flex max-w-[1120px] flex-col gap-10 sm:gap-14',
                  )}
                >
                  {slots.map((numero) => (
                    <PaginaFolha
                      key={numero}
                      numero={numero}
                      total={totalExibido}
                      pagina={paginaPorNumero.get(numero)}
                      isMobileFormat={isMobileFormat}
                    />
                  ))}
                </div>
              )}
            </div>

            {totalExibido > 1 && !error && (
              <div className="pointer-events-none absolute inset-x-0 bottom-24 flex justify-center sm:bottom-5">
                <span className="rounded-full border border-[#e8c878]/20 bg-[#0c0705]/75 px-3 py-1 text-[11px] font-medium tabular-nums tracking-wide text-[#f5e9d6]/85 backdrop-blur-md">
                  Página {paginaAtual} de {totalExibido}
                  {isLoading && paginas.length < totalExibido ? ' · preparando…' : ''}
                </span>
              </div>
            )}
          </div>

          <nav
            aria-label="Ações do PDF"
            className="absolute inset-x-0 bottom-0 z-20 border-t border-[#e8c878]/10 bg-[#0c0705]/85 px-3 pt-2.5 backdrop-blur-lg pb-[max(env(safe-area-inset-bottom),0.75rem)] sm:hidden"
          >
            <div className={cn('grid gap-2', acoes.length === 3 ? 'grid-cols-3' : 'grid-cols-2')}>
              {acoes.map((acao) => (
                <AcaoBotao key={acao.id} acao={acao} compacto />
              ))}
            </div>
          </nav>
        </DialogPrimitive.Content>
      </DialogPortal>
    </Dialog>
  );
}

function PaginaFolha({
  numero,
  total,
  pagina,
  isMobileFormat,
}: {
  numero: number;
  total: number;
  pagina: OrcamentoPdfPagina | undefined;
  isMobileFormat: boolean;
}) {
  return (
    <figure data-pagina={numero} className="scroll-mt-6">
      <div
        className={cn(
          'relative overflow-hidden rounded-[3px] bg-[#1a0f0a] shadow-[0_30px_80px_-20px_rgba(0,0,0,0.85),0_0_0_1px_rgba(232,200,120,0.14)]',
          isMobileFormat ? 'aspect-[9/16]' : 'aspect-video',
        )}
      >
        {pagina ? (
          <img
            src={pagina.url}
            alt={`Página ${numero} de ${total}`}
            decoding="async"
            className="h-full w-full object-contain duration-700 animate-in fade-in-0 slide-in-from-bottom-2 motion-reduce:animate-none"
          />
        ) : (
          <div className="absolute inset-0 animate-pulse bg-gradient-to-br from-[#2a1812] via-[#1a0f0a] to-[#2a1812] motion-reduce:animate-none" />
        )}
      </div>
      <figcaption className="mt-3 flex items-center gap-3">
        <span className="font-serif text-lg italic leading-none text-[#e8c878]">
          {String(numero).padStart(2, '0')}
        </span>
        <span className="h-px flex-1 bg-gradient-to-r from-[#e8c878]/30 to-transparent" />
        <span className="text-[10px] uppercase tracking-[0.28em] text-[#f5e9d6]/45">
          de {String(total).padStart(2, '0')}
        </span>
      </figcaption>
    </figure>
  );
}

function MiniaturasRail({
  slots,
  paginaPorNumero,
  paginaAtual,
  onSelect,
}: {
  slots: number[];
  paginaPorNumero: Map<number, OrcamentoPdfPagina>;
  paginaAtual: number;
  onSelect: (numero: number) => void;
}) {
  const railRef = useRef<HTMLElement>(null);

  useEffect(() => {
    railRef.current
      ?.querySelector('[aria-current="page"]')
      ?.scrollIntoView({ block: 'nearest' });
  }, [paginaAtual]);

  return (
    <aside
      ref={railRef}
      aria-label="Páginas"
      className="hidden w-48 shrink-0 overflow-y-auto border-r border-[#e8c878]/10 bg-[#0c0705]/40 px-4 py-6 backdrop-blur-sm lg:block"
    >
      <ol className="space-y-4">
        {slots.map((numero) => {
          const pagina = paginaPorNumero.get(numero);
          const isAtual = numero === paginaAtual;
          return (
            <li key={numero}>
              <button
                type="button"
                onClick={() => onSelect(numero)}
                aria-current={isAtual ? 'page' : undefined}
                aria-label={`Ir para a página ${numero}`}
                className="group flex w-full items-start gap-2 rounded-sm text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#e8c878]/70"
              >
                <span
                  className={cn(
                    'w-5 pt-0.5 text-right font-serif text-xs italic tabular-nums transition-colors',
                    isAtual ? 'text-[#e8c878]' : 'text-[#f5e9d6]/40',
                  )}
                >
                  {numero}
                </span>
                <span
                  className={cn(
                    'relative block aspect-video flex-1 overflow-hidden rounded-[2px] bg-[#1a0f0a] ring-1 transition-all',
                    isAtual
                      ? 'ring-[#e8c878] shadow-[0_0_0_3px_rgba(232,200,120,0.15)]'
                      : 'ring-white/10 opacity-70 group-hover:opacity-100 group-hover:ring-[#e8c878]/40',
                  )}
                >
                  {pagina && (
                    <img src={pagina.url} alt="" loading="lazy" className="h-full w-full object-cover" />
                  )}
                </span>
              </button>
            </li>
          );
        })}
      </ol>
    </aside>
  );
}

function AcaoBotao({ acao, compacto = false }: { acao: AcaoPdf; compacto?: boolean }) {
  return (
    <Button
      type="button"
      onClick={acao.onClick}
      disabled={acao.disabled}
      variant={acao.primary ? 'default' : 'outline'}
      className={cn(
        'gap-2 rounded-full font-semibold tracking-wide transition-colors',
        compacto && 'h-auto flex-col gap-1 rounded-xl py-2 text-[11px]',
        acao.primary
          ? 'bg-[#e8c878] text-[#1a0f0a] hover:bg-[#f2d891]'
          : 'border-[#e8c878]/25 bg-white/[0.04] text-[#f5e9d6] hover:bg-white/10 hover:text-white',
      )}
    >
      {acao.icon}
      {acao.label}
    </Button>
  );
}

function EstadoAbrindo() {
  return (
    <div className="flex h-full min-h-[50vh] flex-col items-center justify-center gap-4 text-center">
      <Loader2 className="h-7 w-7 animate-spin text-[#e8c878]" aria-hidden />
      <div>
        <p className="font-serif text-2xl text-[#fff6ea]">Abrindo as páginas…</p>
        <p className="mt-1 text-sm text-[#f5e9d6]/55">Elas aparecem uma a uma, do jeito que vão no PDF.</p>
      </div>
    </div>
  );
}

function EstadoErro({ mensagem, onBaixar }: { mensagem: string; onBaixar: () => void }) {
  return (
    <div className="mx-auto flex min-h-[50vh] max-w-md flex-col items-center justify-center gap-4 text-center">
      <AlertTriangle className="h-8 w-8 text-[#e8c878]" aria-hidden />
      <div>
        <p className="font-serif text-2xl text-[#fff6ea]">Não deu para mostrar as páginas</p>
        <p className="mt-1 text-sm text-[#f5e9d6]/60">{mensagem}</p>
        <p className="mt-1 text-sm text-[#f5e9d6]/60">O arquivo foi gerado — você ainda pode baixá-lo.</p>
      </div>
      <Button
        type="button"
        onClick={onBaixar}
        className="gap-2 rounded-full bg-[#e8c878] font-semibold text-[#1a0f0a] hover:bg-[#f2d891]"
      >
        <Download className="h-4 w-4" />
        Baixar PDF
      </Button>
    </div>
  );
}

function Ponto() {
  return <span aria-hidden className="h-0.5 w-0.5 rounded-full bg-current opacity-60" />;
}

function formatarTamanho(bytes: number): string {
  const mb = bytes / (1024 * 1024);
  if (mb < 1) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${mb.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} MB`;
}

function podeCompartilharArquivo(): boolean {
  if (typeof navigator === 'undefined' || typeof navigator.canShare !== 'function') return false;
  try {
    return navigator.canShare({ files: [new File([''], 'teste.pdf', { type: 'application/pdf' })] });
  } catch {
    return false;
  }
}

async function compartilharPdf(blob: Blob, fileName: string, titulo: string): Promise<void> {
  const file = new File([blob], fileName, { type: 'application/pdf' });
  try {
    await navigator.share({ files: [file], title: titulo });
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') return;
    toast.error('Não foi possível compartilhar', {
      description: 'Baixe o PDF e envie pelo app que preferir.',
    });
  }
}

/**
 * Computador: imprime o próprio PDF por um iframe invisível (abre o diálogo de impressão).
 * Celular/tablet: iframe de PDF não imprime — abre o arquivo no visualizador do sistema.
 */
function imprimirPdf(url: string, frameRef: { current: HTMLIFrameElement | null }): void {
  const abrirEmNovaAba = () => window.open(url, '_blank', 'noopener');
  if (window.matchMedia('(pointer: coarse)').matches) {
    abrirEmNovaAba();
    return;
  }

  frameRef.current?.remove();
  const iframe = document.createElement('iframe');
  iframe.setAttribute('aria-hidden', 'true');
  Object.assign(iframe.style, {
    position: 'fixed',
    right: '0',
    bottom: '0',
    width: '0',
    height: '0',
    border: '0',
  });
  iframe.onload = () => {
    try {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
    } catch {
      abrirEmNovaAba();
    }
  };
  iframe.src = url;
  document.body.appendChild(iframe);
  frameRef.current = iframe;
}

interface OrcamentoPdfPreviewDialogProps {
  pdf: OrcamentoPdfPronto;
  onClose: () => void;
}

interface AcaoPdf {
  id: string;
  label: string;
  icon: ReactNode;
  onClick: () => void;
  primary?: boolean;
  disabled?: boolean;
}
