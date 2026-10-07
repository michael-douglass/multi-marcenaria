import { useState } from 'react';
import {
  ChevronDown,
  ClipboardCopy,
  FileDown,
  FileSpreadsheet,
  FileText,
  Loader2,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { MarkupProdutoComCategoria } from '@/hooks/useMarkupProdutos';
import {
  copiarMarkupCatalogoTexto,
  downloadMarkupCatalogoCsv,
  downloadMarkupCatalogoXls,
  exportarMarkupCatalogoPdf,
} from '@/lib/markup-catalogo-export';

interface MarkupCatalogoExportButtonProps {
  produtos: MarkupProdutoComCategoria[];
  empresaNome: string;
  disabled?: boolean;
}

type FormatoExport = 'texto' | 'pdf' | 'xls' | 'csv';

/** Menu para exportar o catálogo de markup com preços (texto, PDF ou planilha). */
export function MarkupCatalogoExportButton({
  produtos,
  empresaNome,
  disabled = false,
}: MarkupCatalogoExportButtonProps) {
  const [exporting, setExporting] = useState<FormatoExport | null>(null);
  const semDados = produtos.length === 0;

  const handleExport = async (formato: FormatoExport) => {
    if (semDados || exporting) return;

    // Texto: monta e copia já com preços, sem esperar setState (evita perder a permissão do navegador).
    if (formato === 'texto') {
      try {
        await copiarMarkupCatalogoTexto({ produtos, empresaNome });
        toast.success('Texto com preços copiado', {
          description: `${produtos.length} item${produtos.length === 1 ? '' : 's'} prontos para colar no WhatsApp ou e-mail.`,
        });
      } catch (err) {
        toast.error('Não foi possível copiar o texto', {
          description: err instanceof Error ? err.message : 'Tente novamente.',
        });
      }
      return;
    }

    setExporting(formato);
    try {
      if (formato === 'pdf') {
        await exportarMarkupCatalogoPdf(produtos, empresaNome);
        toast.success('PDF do catálogo gerado', {
          description: `${produtos.length} item${produtos.length === 1 ? '' : 's'} com preço.`,
        });
      } else if (formato === 'xls') {
        downloadMarkupCatalogoXls(produtos, empresaNome);
        toast.success('Planilha Excel baixada', {
          description: `${produtos.length} item${produtos.length === 1 ? '' : 's'} com preço.`,
        });
      } else {
        downloadMarkupCatalogoCsv(produtos, empresaNome);
        toast.success('Planilha CSV baixada', {
          description: `${produtos.length} item${produtos.length === 1 ? '' : 's'} com preço.`,
        });
      }
    } catch (err) {
      toast.error('Não foi possível exportar', {
        description: err instanceof Error ? err.message : 'Tente novamente.',
      });
    } finally {
      setExporting(null);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="outline"
          disabled={disabled || semDados || exporting != null}
          title={
            semDados
              ? 'Cadastre produtos para exportar'
              : 'Exportar catálogo com preços (texto, PDF ou planilha)'
          }
        >
          {exporting ? (
            <Loader2 className="h-4 w-4 mr-1 animate-spin" aria-hidden />
          ) : (
            <FileDown className="h-4 w-4 mr-1" aria-hidden />
          )}
          Exportar
          <ChevronDown className="h-3.5 w-3.5 ml-1 opacity-70" aria-hidden />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel className="font-normal text-muted-foreground">
          Todos os itens com preço
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          disabled={exporting != null}
          onSelect={() => {
            void handleExport('texto');
          }}
        >
          <ClipboardCopy className="h-4 w-4 mr-2 shrink-0" aria-hidden />
          <div className="flex flex-col gap-0.5">
            <span>Copiar texto com preços</span>
            <span className="text-xs text-muted-foreground">
              Nome + preço unitário (WhatsApp / e-mail)
            </span>
          </div>
        </DropdownMenuItem>
        <DropdownMenuItem
          disabled={exporting != null}
          onSelect={() => {
            void handleExport('pdf');
          }}
        >
          <FileText className="h-4 w-4 mr-2 shrink-0" aria-hidden />
          <div className="flex flex-col gap-0.5">
            <span>PDF com preços</span>
            <span className="text-xs text-muted-foreground">
              Lista agrupada por categoria (A4)
            </span>
          </div>
        </DropdownMenuItem>
        <DropdownMenuItem
          disabled={exporting != null}
          onSelect={() => {
            void handleExport('xls');
          }}
        >
          <FileSpreadsheet className="h-4 w-4 mr-2 shrink-0" aria-hidden />
          <div className="flex flex-col gap-0.5">
            <span>Excel com preços</span>
            <span className="text-xs text-muted-foreground">
              Planilha .xls (abre no Excel)
            </span>
          </div>
        </DropdownMenuItem>
        <DropdownMenuItem
          disabled={exporting != null}
          onSelect={() => {
            void handleExport('csv');
          }}
        >
          <FileSpreadsheet className="h-4 w-4 mr-2 shrink-0" aria-hidden />
          <div className="flex flex-col gap-0.5">
            <span>CSV com preços</span>
            <span className="text-xs text-muted-foreground">
              Separado por ponto e vírgula
            </span>
          </div>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
