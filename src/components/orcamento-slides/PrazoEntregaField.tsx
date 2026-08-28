import { useMemo, useState } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { CalendarClock, CalendarIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  calcularDataEntregaPorPrazo,
  calcularPrazoEntregaPorData,
  formatarDataEntregaLegenda,
  formatarDataInicioExecucao,
  formatarDataIsoLocal,
  formatarPrazoEmDias,
  normalizarPrazoEmDias,
  parseDataIsoLocal,
} from '@/lib/orcamento-slide-datas';
import { cn } from '@/lib/utils';

interface Props {
  value: string;
  onChange: (prazoTexto: string) => void;
  /** Data de início (ISO) usada como base do cálculo quando existir. */
  inicioExecucaoIso?: string;
  id?: string;
  disabled?: boolean;
  className?: string;
}

/**
 * Prazo de entrega em dias.
 * Letras são ignoradas na conta: só o número de dias importa.
 * Data prevista = início da execução + dias.
 */
export function PrazoEntregaField({
  value,
  onChange,
  inicioExecucaoIso = '',
  id = 'prazo-entrega',
  disabled,
  className,
}: Props) {
  const [aberto, setAberto] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);

  const calculo = useMemo(
    () =>
      calcularDataEntregaPorPrazo({
        prazoTexto: value,
        inicioExecucaoIso,
      }),
    [value, inicioExecucaoIso],
  );

  const selecionada = calculo?.dataEntrega;
  const agora = new Date();
  const fromYear = agora.getFullYear();
  const toYear = agora.getFullYear() + 5;
  const baseInicio = parseDataIsoLocal(inicioExecucaoIso);

  const aplicarDataEntrega = (date: Date) => {
    const iso = formatarDataIsoLocal(date);
    const resultado = calcularPrazoEntregaPorData({
      dataEntregaIso: iso,
      inicioExecucaoIso,
    });

    if (!resultado) return;

    if (resultado.dias < 0) {
      setAviso(
        'A data de entrega está antes da data de início. Escolha uma data posterior.',
      );
      return;
    }

    setAviso(null);
    onChange(resultado.prazoTexto);
    setAberto(false);
  };

  const handleBlur = () => {
    const normalizado = normalizarPrazoEmDias(value);
    if (normalizado && normalizado !== value.trim()) {
      onChange(normalizado);
    }
  };

  return (
    <div className={cn('flex flex-col gap-2', className)}>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor={id}>Prazo de entrega (em dias)</Label>
        <div className="flex gap-2 min-w-0">
          <Input
            id={id}
            name="prazo-entrega"
            inputMode="numeric"
            autoComplete="off"
            disabled={disabled}
            value={value}
            onChange={(e) => {
              setAviso(null);
              onChange(e.target.value);
            }}
            onBlur={handleBlur}
            placeholder="Ex.: 30 dias…"
            className="min-w-0 flex-1 tabular-nums"
            aria-describedby={`${id}-hint`}
          />
          <Popover open={aberto} onOpenChange={setAberto}>
            <PopoverTrigger asChild>
              <Button
                type="button"
                variant="outline"
                disabled={disabled}
                aria-label="Abrir calendário para definir a data de entrega"
                className={cn(
                  'h-10 w-10 shrink-0 px-0 glass-input',
                  'hover:bg-background/80 focus-visible:ring-amber-500/40',
                )}
              >
                <CalendarIcon className="h-4 w-4 text-amber-400" aria-hidden="true" />
              </Button>
            </PopoverTrigger>
            <PopoverContent
              className="w-auto p-0 overscroll-contain"
              align="end"
              sideOffset={6}
            >
              <div className="border-b border-border/60 px-3 py-2">
                <p className="text-xs font-medium text-foreground">Data de entrega</p>
                <p className="text-[11px] text-muted-foreground mt-0.5 text-pretty">
                  {baseInicio
                    ? `Escolha a entrega. O prazo em dias será calculado a partir do início (${formatarDataInicioExecucao(inicioExecucaoIso)}).`
                    : 'Escolha a entrega. O prazo em dias será calculado a partir de hoje. Defina o início de execução para um cálculo mais preciso.'}
                </p>
              </div>
              <Calendar
                mode="single"
                locale={ptBR}
                selected={selecionada}
                defaultMonth={selecionada ?? baseInicio ?? agora}
                captionLayout="dropdown-buttons"
                fromYear={fromYear}
                toYear={toYear}
                disabled={baseInicio ? { before: baseInicio } : undefined}
                onSelect={(date) => {
                  if (!date) return;
                  aplicarDataEntrega(date);
                }}
                initialFocus
                className="pointer-events-auto"
              />
            </PopoverContent>
          </Popover>
        </div>
        <p id={`${id}-hint`} className="text-[11px] text-muted-foreground">
          Digite só os dias (ex.: 30). Letras são ignoradas na conta.
        </p>
      </div>

      {aviso ? (
        <p className="text-xs text-destructive" role="alert">
          {aviso}
        </p>
      ) : calculo ? (
        <div
          className={cn(
            'relative overflow-hidden rounded-xl border border-amber-500/25',
            'bg-gradient-to-br from-amber-500/12 via-amber-500/5 to-transparent',
            'px-4 py-3',
          )}
          aria-live="polite"
        >
          <div
            className="pointer-events-none absolute -right-6 -top-6 h-20 w-20 rounded-full bg-amber-400/10 blur-2xl"
            aria-hidden="true"
          />
          <div className="relative flex items-start gap-3">
            <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-amber-500/15 text-amber-300">
              <CalendarClock className="h-4 w-4" aria-hidden="true" />
            </div>
            <div className="min-w-0 flex flex-col gap-0.5">
              <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-amber-200/70">
                Data prevista de entrega
              </p>
              <p className="text-lg font-semibold tabular-nums tracking-tight text-amber-100">
                {formatarDataEntregaLegenda(calculo.dataEntrega, true)}
              </p>
              <p className="text-[11px] text-muted-foreground tabular-nums">
                {formatarPrazoEmDias(calculo.dias)}
                {baseInicio
                  ? ` a partir de ${format(baseInicio, "d 'de' MMMM", { locale: ptBR })}`
                  : ' a partir de hoje'}
              </p>
            </div>
          </div>
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">
          {baseInicio
            ? 'Informe os dias para calcular a data de entrega a partir do início.'
            : 'Defina o início da execução e os dias de prazo para gerar a data de entrega.'}
        </p>
      )}
    </div>
  );
}
