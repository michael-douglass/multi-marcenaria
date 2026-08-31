import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import {
  Bot,
  CheckCircle2,
  ClipboardList,
  FileSearch,
  Package,
  RefreshCw,
  Ruler,
  Scale,
  ShieldCheck,
} from 'lucide-react';

const ETAPAS = [
  {
    id: 'anexos',
    titulo: 'Anexos',
    descricao: 'A Íris lê os PDFs e fotos que você marcou no lead (texto nativo + visão).',
    icon: FileSearch,
  },
  {
    id: 'fidelidade',
    titulo: 'Fidelidade',
    descricao: 'Lê todas as páginas, cores e o que NÃO deve ser inventado (chapas especiais, peças extras).',
    icon: ClipboardList,
  },
  {
    id: 'projetista',
    titulo: 'Projetista',
    descricao: 'Fase 0: descreve cômodos, móveis, cores e modelos — sem quantificar materiais.',
    icon: Ruler,
  },
  {
    id: 'inventariante',
    titulo: 'Inventariante',
    descricao: 'Fase 1: quantifica materiais (QUANT da planilha + levantamento do projetista).',
    icon: Package,
  },
  {
    id: 'auditor',
    titulo: 'Auditor',
    descricao: 'Fase 2: valida checklist crítico e coerência inventário × projetista.',
    icon: Scale,
  },
  {
    id: 'retry',
    titulo: 'Retry',
    descricao: 'Se faltar item crítico, o inventariante releitura focada (até 2 tentativas).',
    icon: RefreshCw,
  },
  {
    id: 'precificador',
    titulo: 'Precificador',
    descricao: 'Fase 3: materiais montados no sistema; IA estima horas, despesas e resumo.',
    icon: Bot,
  },
  {
    id: 'validacao',
    titulo: 'Validação',
    descricao: 'Confere subtotal e abre a conferência verde/amarelo/vermelho antes de fechar o preço.',
    icon: ShieldCheck,
  },
] as const;

interface MarkupIAFluxoVerificacaoProps {
  etapaAtiva?: string;
  className?: string;
  /** inline = bloco padrão; floating = painel flutuante esfumaçado (só na composição IA) */
  variant?: 'inline' | 'floating';
}

export function MarkupIAFluxoVerificacao({
  etapaAtiva,
  className,
  variant = 'inline',
}: MarkupIAFluxoVerificacaoProps) {
  const isFloating = variant === 'floating';

  return (
    <TooltipProvider delayDuration={200}>
      <div
        className={cn(
          isFloating
            ? 'rounded-xl border border-slate-700/60 bg-slate-950/75 p-3 shadow-lg backdrop-blur-md'
            : 'rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900/50',
          className,
        )}
      >
        <div className="mb-3 flex items-center gap-2">
          <ClipboardList className="h-4 w-4 text-amber-500" />
          <p className="text-sm font-medium text-slate-700 dark:text-slate-200">
            Pipeline sequencial de agentes
          </p>
        </div>
        <div
          className={cn(
            'grid gap-2',
            isFloating ? 'grid-cols-2 sm:grid-cols-4' : 'grid-cols-2 sm:grid-cols-4 lg:grid-cols-7',
          )}
        >
          {ETAPAS.map((etapa) => {
            const Icon = etapa.icon;
            const ativa = etapaAtiva === etapa.id;
            return (
              <Tooltip key={etapa.id}>
                <TooltipTrigger asChild>
                  <div
                    className={cn(
                      'flex flex-col items-center gap-1.5 rounded-lg border px-2 py-2 text-center transition-colors',
                      ativa
                        ? 'border-amber-500/50 bg-amber-500/10 text-amber-700 dark:text-amber-300'
                        : 'border-transparent bg-white/50 text-slate-500 dark:bg-slate-800/40 dark:text-slate-400',
                    )}
                  >
                    <Icon className={cn('h-4 w-4', ativa && 'text-amber-500')} />
                    <span className="text-[10px] font-medium leading-tight sm:text-xs">
                      {etapa.titulo}
                    </span>
                  </div>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="max-w-xs text-xs">
                  {etapa.descricao}
                </TooltipContent>
              </Tooltip>
            );
          })}
        </div>
        {etapaAtiva && (
          <div className="mt-3 flex items-center gap-2 text-xs text-emerald-600 dark:text-emerald-400">
            <CheckCircle2 className="h-3.5 w-3.5" />
            <span>Etapa em andamento: {ETAPAS.find((e) => e.id === etapaAtiva)?.titulo}</span>
          </div>
        )}
      </div>
    </TooltipProvider>
  );
}
