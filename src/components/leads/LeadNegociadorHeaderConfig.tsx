import { useEffect, useState, type KeyboardEvent } from 'react';
import { Loader2, Settings2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  type NegociadorConfigEscopo,
  useLeadNegociadorConfig,
} from '@/hooks/useLeadNegociadorConfig';
import {
  calcularPisoNegociador,
  configGlobalParaNegociador,
  redistribuirSplits,
  type NegociadorSplitCampo,
  validarSplits,
} from '@/lib/negociador-calculo';
import { formatarMoedaMarkup } from '@/lib/markup-calculo';
import { cn } from '@/lib/utils';

interface LeadNegociadorHeaderConfigProps {
  leadId: number;
  className?: string;
}

/** Só números, vírgula ou ponto — edição livre enquanto digita. */
function sanitizePercentDraft(raw: string): string {
  const s = raw.replace(',', '.');
  let out = '';
  let seenDot = false;
  for (const ch of s) {
    if (ch >= '0' && ch <= '9') out += ch;
    else if (ch === '.' && !seenDot) {
      out += '.';
      seenDot = true;
    }
  }
  return out;
}

function parsePercentDraft(raw: string): number | null {
  const trimmed = String(raw).trim().replace(',', '.');
  if (!trimmed || trimmed === '.') return null;
  const n = Number(trimmed);
  return Number.isFinite(n) ? n : null;
}

const percentFieldClassName = cn(
  'flex h-10 w-full min-w-0 rounded-md glass-input px-3 py-2 text-base text-foreground',
  'placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1',
  'focus-visible:ring-[color:var(--lead-gold)] disabled:cursor-not-allowed disabled:opacity-50 md:text-sm',
);

/**
 * Só o ícone fica no cabeçalho. Valores aparecem apenas ao abrir as configurações.
 * Dá para salvar para este cliente ou para todos.
 */
export function LeadNegociadorHeaderConfig({
  leadId,
  className,
}: LeadNegociadorHeaderConfigProps) {
  const { isLoading, efetiva, leadConfig, temOverrideLead, globalConfig, salvar } =
    useLeadNegociadorConfig(leadId);
  const [open, setOpen] = useState(false);
  const [portalContainer, setPortalContainer] = useState<HTMLElement | null>(null);
  const [escopo, setEscopo] = useState<NegociadorConfigEscopo>('lead');
  const [margem, setMargem] = useState('100');
  const [pctMaterial, setPctMaterial] = useState('33.34');
  const [pctMaoObra, setPctMaoObra] = useState('33.33');
  const [pctLucro, setPctLucro] = useState('33.33');

  useEffect(() => {
    if (!open) return;
    const fonte =
      escopo === 'lead' && leadConfig
        ? {
            margemMinimaPercent: leadConfig.margem_minima_percent,
            splits: {
              material: leadConfig.pct_material,
              maoObra: leadConfig.pct_mao_obra,
              lucro: leadConfig.pct_lucro,
            },
          }
        : escopo === 'lead'
          ? efetiva
          : configGlobalParaNegociador(globalConfig);

    setMargem(String(fonte.margemMinimaPercent));
    setPctMaterial(String(fonte.splits.material));
    setPctMaoObra(String(fonte.splits.maoObra));
    setPctLucro(String(fonte.splits.lucro));
    // Só ao abrir / trocar escopo — não a cada render (senão apaga o que a pessoa digita).
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intencional
  }, [open, escopo]);

  const previewPiso = calcularPisoNegociador(10, parsePercentDraft(margem) ?? 0);

  const splitsAtuais = {
    material: parsePercentDraft(pctMaterial) ?? 0,
    maoObra: parsePercentDraft(pctMaoObra) ?? 0,
    lucro: parsePercentDraft(pctLucro) ?? 0,
  };

  const handleSplitChange = (campo: NegociadorSplitCampo, raw: string) => {
    const draft = sanitizePercentDraft(raw);
    if (campo === 'material') setPctMaterial(draft);
    if (campo === 'maoObra') setPctMaoObra(draft);
    if (campo === 'lucro') setPctLucro(draft);
  };

  const handleSplitCommit = (campo: NegociadorSplitCampo, raw: string) => {
    const n = parsePercentDraft(raw);
    const next = redistribuirSplits(campo, n ?? 0, splitsAtuais);
    setPctMaterial(String(next.material));
    setPctMaoObra(String(next.maoObra));
    setPctLucro(String(next.lucro));
  };

  const handleSalvar = async () => {
    const margemNum = parsePercentDraft(margem);
    let splits = {
      material: parsePercentDraft(pctMaterial) ?? 0,
      maoObra: parsePercentDraft(pctMaoObra) ?? 0,
      lucro: parsePercentDraft(pctLucro) ?? 0,
    };
    if (margemNum == null || margemNum < 0) {
      toast.error('Margem mínima inválida');
      return;
    }
    if (!validarSplits(splits)) {
      splits = redistribuirSplits('material', splits.material, splits);
      setPctMaterial(String(splits.material));
      setPctMaoObra(String(splits.maoObra));
      setPctLucro(String(splits.lucro));
    }
    await salvar.mutateAsync({
      escopo,
      margemMinimaPercent: margemNum,
      splits,
    });
    setOpen(false);
  };

  const handleUsarGeralNesteCliente = async () => {
    await salvar.mutateAsync({
      escopo: 'lead',
      margemMinimaPercent: efetiva.margemMinimaPercent,
      splits: efetiva.splits,
      limparOverrideLead: true,
    });
    setOpen(false);
  };

  const onEnterCommit =
    (commit?: (raw: string) => void) => (e: KeyboardEvent<HTMLInputElement>) => {
      e.stopPropagation();
      if (e.key !== 'Enter') return;
      e.preventDefault();
      const el = e.currentTarget;
      commit?.(el.value);
      el.blur();
    };

  return (
    <Popover
      modal={false}
      open={open}
      onOpenChange={(next) => {
        if (next) {
          // Dentro do card do lead: o Dialog não “rouba” o foco e a digitação funciona.
          setPortalContainer(document.querySelector<HTMLElement>('[data-lead-card]'));
        }
        setOpen(next);
      }}
    >
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            'inline-flex h-8 w-8 items-center justify-center rounded-lg border border-[color:var(--lead-line)]',
            'text-[color:var(--lead-gold)] transition-colors',
            'hover:border-[color:var(--lead-gold)]/50 hover:bg-[color:var(--lead-cream)]/35',
            'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--lead-gold)]',
            className,
          )}
          aria-label="Abrir configurações do Negociador"
          title="Configurações do Negociador"
        >
          {isLoading ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          ) : (
            <Settings2 className="h-4 w-4" aria-hidden />
          )}
        </button>
      </PopoverTrigger>

      <PopoverContent
        align="end"
        side="bottom"
        portalContainer={portalContainer}
        className="w-[min(100vw-2rem,340px)] space-y-3 p-4"
        onOpenAutoFocus={(e) => e.preventDefault()}
        onCloseAutoFocus={(e) => e.preventDefault()}
        onKeyDown={(e) => e.stopPropagation()}
        onPointerDown={(e) => e.stopPropagation()}
      >
        <div>
          <p className="text-sm font-semibold text-foreground">Configurações do Negociador</p>
          <p className="mt-0.5 text-xs text-muted-foreground leading-relaxed">
            Digite os números no teclado. Com material R$ 10, o piso fica em{' '}
            <strong>{formatarMoedaMarkup(previewPiso)}</strong>.
          </p>
        </div>

        <div
          className="grid grid-cols-2 gap-1 rounded-lg border bg-muted/40 p-1"
          role="tablist"
          aria-label="Escopo da configuração"
        >
          <button
            type="button"
            role="tab"
            aria-selected={escopo === 'lead'}
            onClick={() => setEscopo('lead')}
            className={cn(
              'rounded-md px-2 py-1.5 text-xs font-medium transition-colors',
              escopo === 'lead'
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            Este cliente
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={escopo === 'global'}
            onClick={() => setEscopo('global')}
            className={cn(
              'rounded-md px-2 py-1.5 text-xs font-medium transition-colors',
              escopo === 'global'
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            Todos os clientes
          </button>
        </div>

        {escopo === 'lead' && temOverrideLead ? (
          <p className="text-[11px] text-amber-800 bg-amber-50 border border-amber-200/80 rounded-md px-2 py-1.5">
            Este cliente tem margem própria (não usa a geral).
          </p>
        ) : null}
        {escopo === 'lead' && !temOverrideLead ? (
          <p className="text-[11px] text-muted-foreground">
            Ainda usa a margem geral. Ao salvar aqui, passa a ser só deste cliente.
          </p>
        ) : null}
        {escopo === 'global' ? (
          <p className="text-[11px] text-muted-foreground">
            Altera o padrão de todos os clientes que não tiverem margem própria.
          </p>
        ) : null}

        <div className="space-y-1.5">
          <Label htmlFor="neg-header-margem" className="text-xs">
            Margem mínima (% sobre o custo)
          </Label>
          <input
            id="neg-header-margem"
            type="text"
            inputMode="decimal"
            autoComplete="off"
            spellCheck={false}
            value={margem}
            onChange={(e) => setMargem(sanitizePercentDraft(e.target.value))}
            onKeyDown={onEnterCommit()}
            onFocus={(e) => e.currentTarget.select()}
            placeholder="Ex.: 100"
            className={percentFieldClassName}
            aria-label="Margem mínima em porcentagem"
          />
        </div>

        <div className="grid grid-cols-3 gap-2">
          <div className="space-y-1">
            <Label htmlFor="neg-header-mat" className="text-[10px]">
              Material %
            </Label>
            <input
              id="neg-header-mat"
              type="text"
              inputMode="decimal"
              autoComplete="off"
              spellCheck={false}
              value={pctMaterial}
              onChange={(e) => handleSplitChange('material', e.target.value)}
              onBlur={(e) => handleSplitCommit('material', e.target.value)}
              onKeyDown={onEnterCommit((raw) => handleSplitCommit('material', raw))}
              onFocus={(e) => e.currentTarget.select()}
              placeholder="33"
              className={percentFieldClassName}
              aria-label="Percentual de material"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="neg-header-mo" className="text-[10px]">
              Mão obra %
            </Label>
            <input
              id="neg-header-mo"
              type="text"
              inputMode="decimal"
              autoComplete="off"
              spellCheck={false}
              value={pctMaoObra}
              onChange={(e) => handleSplitChange('maoObra', e.target.value)}
              onBlur={(e) => handleSplitCommit('maoObra', e.target.value)}
              onKeyDown={onEnterCommit((raw) => handleSplitCommit('maoObra', raw))}
              onFocus={(e) => e.currentTarget.select()}
              placeholder="33"
              className={percentFieldClassName}
              aria-label="Percentual de mão de obra"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="neg-header-luc" className="text-[10px]">
              Lucro %
            </Label>
            <input
              id="neg-header-luc"
              type="text"
              inputMode="decimal"
              autoComplete="off"
              spellCheck={false}
              value={pctLucro}
              onChange={(e) => handleSplitChange('lucro', e.target.value)}
              onBlur={(e) => handleSplitCommit('lucro', e.target.value)}
              onKeyDown={onEnterCommit((raw) => handleSplitCommit('lucro', raw))}
              onFocus={(e) => e.currentTarget.select()}
              placeholder="33"
              className={percentFieldClassName}
              aria-label="Percentual de lucro"
            />
          </div>
        </div>
        <p className="text-[11px] text-muted-foreground">
          Digite o % no teclado e saia do campo (ou Enter): os outros dois se ajustam para 100%.
        </p>

        <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
          {escopo === 'lead' && temOverrideLead ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-8 px-2 text-xs text-muted-foreground"
              onClick={() => void handleUsarGeralNesteCliente()}
              disabled={salvar.isPending}
            >
              Usar margem geral
            </Button>
          ) : (
            <span />
          )}
          <div className="flex gap-2 ml-auto">
            <Button type="button" variant="outline" size="sm" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={() => void handleSalvar()}
              disabled={salvar.isPending}
            >
              {salvar.isPending ? (
                <>
                  <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
                  Salvando
                </>
              ) : (
                'Salvar'
              )}
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
