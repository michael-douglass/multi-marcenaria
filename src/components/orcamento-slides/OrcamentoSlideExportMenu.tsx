import { useLayoutEffect, useState } from 'react';
import {
  ChevronDown,
  Download,
  FileImage,
  FileText,
  Loader2,
  Monitor,
  Smartphone,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { leadNestedMenuClass, orcamentoVisualizarNestedClass } from '@/lib/overlay-z-index';
import type { OrcamentoExportFormat } from '@/lib/orcamento-slide-export';

export type OrcamentoExportViewport = 'desktop' | 'mobile';

interface OrcamentoSlideExportMenuProps {
  onExport: (viewport: OrcamentoExportViewport, format: OrcamentoExportFormat) => void;
  isExporting?: boolean;
  label?: string;
  className?: string;
  /**
   * `visualizar` = menu dentro da apresentação fullscreen (portal no overlay).
   * `inline` = card do lead / lista — sem véu modal (senão o Dialog engole o clique).
   */
  portalMode?: 'visualizar' | 'inline';
}

const VIEWPORT_OPCOES: {
  id: OrcamentoExportViewport;
  titulo: string;
  descricaoPdf: string;
  descricaoImagens: string;
  Icon: typeof Monitor;
}[] = [
  {
    id: 'desktop',
    titulo: 'Computador',
    descricaoPdf: '1920×1080 — um slide por página (paisagem)',
    descricaoImagens: '1920×1080 — uma imagem JPEG por slide (download direto)',
    Icon: Monitor,
  },
  {
    id: 'mobile',
    titulo: 'Celular',
    descricaoPdf: '1080×1920 — um slide por página (retrato)',
    descricaoImagens: '1080×1920 — uma imagem JPEG por slide (download direto)',
    Icon: Smartphone,
  },
];

/** Apenas UI do menu — sem importar a apresentação (evita dependência circular). */
export function OrcamentoSlideExportMenu({
  onExport,
  isExporting = false,
  label = 'Exportar',
  className,
  portalMode = 'visualizar',
}: OrcamentoSlideExportMenuProps) {
  const [portalContainer, setPortalContainer] = useState<HTMLElement | null>(null);
  const nestedInVisualizar = portalMode === 'visualizar';

  useLayoutEffect(() => {
    if (nestedInVisualizar) {
      setPortalContainer(document.querySelector<HTMLElement>('[data-orcamento-visualizar]'));
      return;
    }
    // No card do lead: portal dentro do Dialog para o FocusScope não “roubar” o foco
    // e fechar o menu na hora (fallback: body, com onFocusOutside abaixo).
    setPortalContainer(document.querySelector<HTMLElement>('[data-lead-card]'));
  }, [nestedInVisualizar]);

  return (
    <DropdownMenu
      // Dentro do Dialog do lead, modal=true cria um véu que engole cliques (mesmo padrão do LeadAIRenderDownloadMenu).
      modal={nestedInVisualizar}
    >
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          size="sm"
          disabled={isExporting}
          onPointerDown={(event) => event.stopPropagation()}
          onClick={(event) => event.stopPropagation()}
          className={cn(
            'bg-amber-600 hover:bg-amber-700 text-white gap-1.5 shadow-lg shadow-amber-950/30',
            'border border-amber-500/30 transition-all duration-200',
            className,
          )}
        >
          {isExporting ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Download className="h-4 w-4" />
          )}
          {isExporting ? 'Gerando…' : label}
          <ChevronDown className="h-3.5 w-3.5 opacity-80" />
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent
        align="end"
        sideOffset={8}
        container={portalContainer ?? undefined}
        data-orcamento-export-menu=""
        // Dentro do Dialog do lead o FocusScope puxa o foco de volta para o card;
        // sem preventDefault o menu abre e fecha na hora (mesmo padrão do LeadAIRenderDownloadMenu).
        onCloseAutoFocus={(event) => event.preventDefault()}
        onFocusOutside={(event) => event.preventDefault()}
        onPointerDown={(event) => event.stopPropagation()}
        onPointerDownOutside={(event) => {
          if (nestedInVisualizar) event.preventDefault();
        }}
        onInteractOutside={(event) => {
          if (!nestedInVisualizar) return;
          const target = event.target as HTMLElement | null;
          if (target?.closest('[data-orcamento-visualizar]')) event.preventDefault();
        }}
        className={cn(
          nestedInVisualizar ? orcamentoVisualizarNestedClass : leadNestedMenuClass,
          'w-80 p-2 rounded-xl border border-white/10',
          '!bg-[#2a1812] !text-white pointer-events-auto shadow-2xl shadow-black/50',
        )}
      >
        <DropdownMenuLabel className="text-[10px] uppercase tracking-[0.2em] text-amber-400/90 font-semibold px-2 py-1.5 flex items-center gap-1.5">
          <FileText className="h-3 w-3" />
          PDF
        </DropdownMenuLabel>
        <DropdownMenuSeparator className="bg-white/10" />

        {VIEWPORT_OPCOES.map(({ id, titulo: opcaoTitulo, descricaoPdf, Icon }) => (
          <DropdownMenuItem
            key={`pdf-${id}`}
            disabled={isExporting}
            onSelect={() => onExport(id, 'pdf')}
            className={cn(
              'flex items-start gap-3 rounded-lg px-3 py-2.5 cursor-pointer',
              'focus:bg-amber-500/15 focus:text-white data-[highlighted]:bg-amber-500/15',
            )}
          >
            <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-400/20 text-amber-200 ring-1 ring-amber-300/35 shadow-[inset_0_0_0_1px_rgba(251,191,36,0.12)]">
              <Icon className="h-5 w-5 stroke-[2.25]" />
            </span>
            <span className="flex flex-col gap-0.5 min-w-0">
              <span className="text-sm font-semibold text-white">{opcaoTitulo}</span>
              <span className="text-xs text-white/55 leading-snug">{descricaoPdf}</span>
            </span>
          </DropdownMenuItem>
        ))}

        <DropdownMenuSeparator className="bg-white/10 my-2" />

        <DropdownMenuLabel className="text-[10px] uppercase tracking-[0.2em] text-amber-400/90 font-semibold px-2 py-1.5 flex items-center gap-1.5">
          <FileImage className="h-3 w-3" />
          Imagens
        </DropdownMenuLabel>
        <DropdownMenuSeparator className="bg-white/10" />

        {VIEWPORT_OPCOES.map(({ id, titulo: opcaoTitulo, descricaoImagens, Icon }) => (
          <DropdownMenuItem
            key={`img-${id}`}
            disabled={isExporting}
            onSelect={() => onExport(id, 'imagens')}
            className={cn(
              'flex items-start gap-3 rounded-lg px-3 py-2.5 cursor-pointer',
              'focus:bg-amber-500/15 focus:text-white data-[highlighted]:bg-amber-500/15',
            )}
          >
            <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-400/20 text-amber-200 ring-1 ring-amber-300/35 shadow-[inset_0_0_0_1px_rgba(251,191,36,0.12)]">
              <Icon className="h-5 w-5 stroke-[2.25]" />
            </span>
            <span className="flex flex-col gap-0.5 min-w-0">
              <span className="text-sm font-semibold text-white">{opcaoTitulo}</span>
              <span className="text-xs text-white/55 leading-snug">{descricaoImagens}</span>
            </span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
