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
import type { OrcamentoExportFormat } from '@/lib/orcamento-slide-export';

export type OrcamentoExportViewport = 'desktop' | 'mobile';

interface OrcamentoSlideExportMenuProps {
  onExport: (viewport: OrcamentoExportViewport, format: OrcamentoExportFormat) => void;
  isExporting?: boolean;
  label?: string;
  className?: string;
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
    descricaoPdf: '1920×1080 — PDF A4 paisagem, uma página por slide',
    descricaoImagens: '1920×1080 — uma imagem JPEG por slide (download direto)',
    Icon: Monitor,
  },
  {
    id: 'mobile',
    titulo: 'Celular',
    descricaoPdf: '1080×1920 — PDF A4 retrato, uma página por slide',
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
}: OrcamentoSlideExportMenuProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          size="sm"
          disabled={isExporting}
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
        className={cn(
          'w-80 p-2 rounded-xl border border-white/10',
          'bg-[#2a1812]/95 backdrop-blur-xl text-white shadow-2xl shadow-black/50',
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
