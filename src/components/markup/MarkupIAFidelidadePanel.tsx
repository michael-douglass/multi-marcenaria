import type { MarkupIAFidelidadeInventario } from '@/lib/markup-ia-fidelidade';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';

interface MarkupIAFidelidadePanelProps {
  fidelidade: MarkupIAFidelidadeInventario | null;
  scanning?: boolean;
}

export function MarkupIAFidelidadePanel({ fidelidade, scanning }: MarkupIAFidelidadePanelProps) {
  if (!fidelidade && !scanning) return null;

  return (
    <div className="rounded-lg border border-amber-500/15 bg-slate-950/50">
      <div className="flex items-center justify-between gap-2 border-b border-amber-500/10 px-3 py-2">
        <span className="text-xs font-medium text-slate-200">Inventário de fidelidade</span>
        {fidelidade && (
          <Badge variant="outline" className="h-5 border-amber-500/30 text-[9px] text-amber-300">
            {fidelidade.paginas_texto || fidelidade.paginas_lidas} pág.
          </Badge>
        )}
      </div>
      <ScrollArea className="max-h-36 px-3 py-2">
        {scanning && !fidelidade && (
          <p className="text-[11px] text-slate-400">Contando módulos, cores e o que não deve entrar…</p>
        )}
        {fidelidade && (
          <div className="space-y-2 text-[11px] text-slate-300">
            {fidelidade.quantitativo_resumo && (
              <p>{fidelidade.quantitativo_resumo}</p>
            )}
            <p>
              Chapas especiais:{' '}
              <span className={fidelidade.chapas_especiais_solicitadas ? 'text-amber-300' : 'text-emerald-400'}>
                {fidelidade.chapas_especiais_solicitadas ? 'pedidas no documento' : 'não usar'}
              </span>
            </p>
            {fidelidade.nao_adicionar.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {fidelidade.nao_adicionar.slice(0, 8).map((item) => (
                  <span
                    key={item}
                    className="rounded border border-red-500/30 bg-red-500/10 px-1.5 py-0.5 text-[10px] text-red-300"
                  >
                    não: {item}
                  </span>
                ))}
              </div>
            )}
            <ul className="space-y-0.5 text-slate-400">
              {fidelidade.moveis.slice(0, 4).map((movel) => (
                <li key={`${movel.comodo}-${movel.nome_tipo}`} className={cn('truncate')}>
                  {movel.comodo} · {movel.nome_tipo} · {movel.modulos.length} módulo(s)
                </li>
              ))}
            </ul>
          </div>
        )}
      </ScrollArea>
    </div>
  );
}
