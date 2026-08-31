import { useEffect, useRef, useState } from 'react';
import { Eye, EyeOff, Pencil, Sparkles } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { OrcamentoSlideBloco } from '@/lib/orcamento-slide-types';
import {
  chaveEtiquetaAnaliseIa,
  chaveTextoAnaliseIa,
  chaveTituloAnaliseIa,
  resolveAnaliseIaConteudo,
} from '@/lib/orcamento-slide-analise-ia';
import { LeadAIFormattedContent } from '@/lib/lead-ai-formatted-content';
import type { OrcamentoSlide } from '@/lib/orcamento-slide-types';

export interface AnaliseIaEditorValues {
  etiqueta: string;
  titulo: string;
  corpo: string;
}

interface OrcamentoAnaliseIAEditorProps {
  bloco: OrcamentoSlideBloco;
  orcamento: OrcamentoSlide;
  onChange: (values: AnaliseIaEditorValues) => void;
  className?: string;
  compact?: boolean;
  /** Quando informado, exibe o interruptor para mostrar/ocultar o slide na apresentação. */
  visivelNaApresentacao?: boolean;
  onVisivelChange?: (visivel: boolean) => void;
}

export function OrcamentoAnaliseIAEditor({
  bloco,
  orcamento,
  onChange,
  className,
  compact = false,
  visivelNaApresentacao = true,
  onVisivelChange,
}: OrcamentoAnaliseIAEditorProps) {
  const inicial = resolveAnaliseIaConteudo(orcamento, bloco);
  const [etiqueta, setEtiqueta] = useState(inicial.etiqueta);
  const [titulo, setTitulo] = useState(inicial.titulo);
  const [corpo, setCorpo] = useState(inicial.corpo);
  const [modo, setModo] = useState<'editar' | 'visualizar'>('editar');
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const corpoKey = orcamento.dados.textos_blocos?.[chaveTextoAnaliseIa(bloco.id)] ?? '';
  const etiquetaKey = orcamento.dados.textos_blocos?.[chaveEtiquetaAnaliseIa(bloco.id)] ?? '';
  const tituloKey = orcamento.dados.textos_blocos?.[chaveTituloAnaliseIa(bloco.id)] ?? '';
  const podeControlarVisibilidade = typeof onVisivelChange === 'function';
  const ocultaNaApresentacao = podeControlarVisibilidade && !visivelNaApresentacao;

  useEffect(() => () => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
  }, []);

  useEffect(() => {
    const next = resolveAnaliseIaConteudo(orcamento, bloco);
    setEtiqueta(next.etiqueta);
    setTitulo(next.titulo);
    setCorpo(next.corpo);
  }, [bloco.id, corpoKey, etiquetaKey, tituloKey]);

  const scheduleSave = (next: AnaliseIaEditorValues) => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => onChange(next), 700);
  };

  const emit = (patch: Partial<AnaliseIaEditorValues>) => {
    const next = {
      etiqueta: patch.etiqueta ?? etiqueta,
      titulo: patch.titulo ?? titulo,
      corpo: patch.corpo ?? corpo,
    };
    scheduleSave(next);
  };

  return (
    <div
      className={cn(
        'paper-accent-card rounded-xl',
        ocultaNaApresentacao
          ? 'opacity-90'
          : '',
        compact ? 'p-3 space-y-3' : 'p-4 sm:p-5 space-y-4',
        className,
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-2 text-[#8d5e22]">
          <Sparkles className="h-4 w-4 shrink-0" aria-hidden />
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-sm font-semibold">Análise de IA</p>
              {ocultaNaApresentacao && (
                <Badge variant="secondary" className="gap-1 text-[10px] font-normal">
                  <EyeOff className="h-3 w-3" aria-hidden />
                  Oculta na apresentação
                </Badge>
              )}
            </div>
            {!compact && (
              <p className="text-xs text-muted-foreground">
                Relatório formatado para o cliente — edite livremente antes de apresentar.
              </p>
            )}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {podeControlarVisibilidade && (
            <div className="flex items-center gap-2 rounded-lg border border-border/60 bg-background/40 px-2.5 py-1.5">
              <Switch
                id={`analise-ia-visivel-${bloco.id}`}
                checked={visivelNaApresentacao}
                onCheckedChange={onVisivelChange}
                className="data-[state=checked]:bg-amber-500"
                aria-label="Mostrar análise de IA na apresentação"
              />
              <Label
                htmlFor={`analise-ia-visivel-${bloco.id}`}
                className="cursor-pointer text-xs font-medium text-foreground/90"
              >
                {visivelNaApresentacao ? 'Mostrar no orçamento' : 'Ocultar no orçamento'}
              </Label>
            </div>
          )}
          <div className="flex rounded-lg border border-border/60 p-0.5">
            <Button
              type="button"
              variant={modo === 'editar' ? 'secondary' : 'ghost'}
              size="sm"
              className="h-7 px-2.5 text-xs"
              onClick={() => setModo('editar')}
            >
              <Pencil className="h-3.5 w-3.5 mr-1" />
              Editar
            </Button>
            <Button
              type="button"
              variant={modo === 'visualizar' ? 'secondary' : 'ghost'}
              size="sm"
              className="h-7 px-2.5 text-xs"
              onClick={() => setModo('visualizar')}
              disabled={!corpo.trim()}
            >
              <Eye className="h-3.5 w-3.5 mr-1" />
              Visualizar
            </Button>
          </div>
        </div>
      </div>

      {ocultaNaApresentacao && (
        <p className="text-xs text-muted-foreground rounded-md border border-dashed border-border/50 bg-muted/20 px-3 py-2">
          Esta análise continua salva aqui, mas não aparece nos slides nem no PDF do orçamento.
          Ligue o interruptor acima se quiser mostrar de novo.
        </p>
      )}

      <div className={cn('grid gap-3', compact ? 'grid-cols-1' : 'sm:grid-cols-2')}>
        <div className="space-y-1.5">
          <Label className="text-xs">Etiqueta</Label>
          <Input
            value={etiqueta}
            onChange={(e) => {
              setEtiqueta(e.target.value);
              emit({ etiqueta: e.target.value });
            }}
            placeholder="Estudo do ambiente"
            className="h-9"
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Título do slide</Label>
          <Input
            value={titulo}
            onChange={(e) => {
              setTitulo(e.target.value);
              emit({ titulo: e.target.value });
            }}
            placeholder="Análise do seu projeto"
            className="h-9"
          />
        </div>
      </div>

      {modo === 'visualizar' ? (
        <div className="rounded-lg border border-border/50 bg-mahogany-muted/20 p-4 sm:p-5 max-h-[min(60vh,520px)] overflow-y-auto">
          {corpo.trim() ? (
            <LeadAIFormattedContent content={corpo} className="text-sm" />
          ) : (
            <p className="text-sm italic text-muted-foreground">Nenhum conteúdo para visualizar.</p>
          )}
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="space-y-1.5 lg:order-2">
            <Label className="text-xs">Conteúdo completo da análise</Label>
            <Textarea
              value={corpo}
              onChange={(e) => {
                setCorpo(e.target.value);
                emit({ corpo: e.target.value });
              }}
              rows={compact ? 16 : 20}
              className="min-h-[320px] resize-y text-[13px] leading-relaxed"
              placeholder="O relatório da IA do lead aparecerá aqui automaticamente quando disponível…"
              spellCheck
              lang="pt-BR"
            />
          </div>
          <div className="space-y-1.5 lg:order-1">
            <Label className="text-xs text-muted-foreground">Pré-visualização</Label>
            <div className="rounded-lg border border-dashed border-amber-500/25 bg-mahogany-muted/15 p-4 min-h-[320px] max-h-[min(60vh,560px)] overflow-y-auto">
              {corpo.trim() ? (
                <LeadAIFormattedContent content={corpo} className="text-sm" />
              ) : (
                <p className="text-sm italic text-muted-foreground">
                  A pré-visualização aparece conforme você edita o texto.
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
