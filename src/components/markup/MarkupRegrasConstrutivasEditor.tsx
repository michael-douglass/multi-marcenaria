import { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  useMarkupRegrasConstrutivas,
  type MarkupRegraConstrutivaRow,
} from '@/hooks/useMarkupRegrasConstrutivas';
import type { FaixaDobradica } from '@/lib/markup-motor-calculo';
import { cn } from '@/lib/utils';

const REGRA_PADRAO_NOVA: Omit<MarkupRegraConstrutivaRow, 'id'> = {
  tipo_movel: '',
  espessura_corpo_mm: 15,
  espessura_porta_mm: 18,
  espessura_fundo_mm: 6,
  rebaixo_fundo_mm: 10,
  regra_dobradicas: [
    { altura_max_mm: 1000, qtd: 2 },
    { altura_max_mm: 1600, qtd: 3 },
    { altura_max_mm: 2200, qtd: 4 },
    { altura_max_mm: null, qtd: 5 },
  ],
  folga_corredica_mm: 50,
  folga_puxador_mm: 20,
  perda_chapa_pct: 20,
  perda_fita_borda_pct: 15,
  area_chapa_padrao_m2: 5.06,
  ordem: 0,
  ativo: true,
};

function CampoNumero({
  label,
  value,
  onChange,
  suffix,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  suffix?: string;
}) {
  return (
    <div className="space-y-1">
      <Label className="text-[11px] text-muted-foreground">{label}</Label>
      <div className="flex items-center gap-1.5">
        <Input
          type="number"
          value={value}
          onChange={(e) => onChange(Number(e.target.value) || 0)}
          className="h-8 text-sm"
        />
        {suffix && <span className="shrink-0 text-xs text-muted-foreground">{suffix}</span>}
      </div>
    </div>
  );
}

function FaixasDobradicaEditor({
  faixas,
  onChange,
}: {
  faixas: FaixaDobradica[];
  onChange: (faixas: FaixaDobradica[]) => void;
}) {
  const ordenadas = [...faixas].sort((a, b) => (a.altura_max_mm ?? Infinity) - (b.altura_max_mm ?? Infinity));

  const atualizar = (index: number, patch: Partial<FaixaDobradica>) => {
    onChange(ordenadas.map((f, i) => (i === index ? { ...f, ...patch } : f)));
  };

  const remover = (index: number) => {
    onChange(ordenadas.filter((_, i) => i !== index));
  };

  const adicionar = () => {
    onChange([...ordenadas, { altura_max_mm: 2000, qtd: 4 }]);
  };

  return (
    <div className="space-y-1.5">
      <Label className="text-[11px] text-muted-foreground">
        Dobradiças por altura da porta (mm) — última faixa sem limite vale pra qualquer altura maior
      </Label>
      <ul className="space-y-1">
        {ordenadas.map((faixa, i) => (
          <li key={i} className="flex items-center gap-2 text-sm">
            <span className="text-xs text-muted-foreground">até</span>
            {faixa.altura_max_mm === null ? (
              <span className="w-20 text-xs font-medium">sem limite</span>
            ) : (
              <Input
                type="number"
                value={faixa.altura_max_mm}
                onChange={(e) => atualizar(i, { altura_max_mm: Number(e.target.value) || 0 })}
                className="h-8 w-20 text-sm"
              />
            )}
            <span className="text-xs text-muted-foreground">mm →</span>
            <Input
              type="number"
              value={faixa.qtd}
              onChange={(e) => atualizar(i, { qtd: Number(e.target.value) || 0 })}
              className="h-8 w-16 text-sm"
            />
            <span className="text-xs text-muted-foreground">dobradiça(s)</span>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive"
              onClick={() => remover(i)}
              aria-label="Remover faixa"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </li>
        ))}
      </ul>
      <Button type="button" variant="outline" size="sm" onClick={adicionar}>
        <Plus className="h-3.5 w-3.5 mr-1" />
        Adicionar faixa
      </Button>
    </div>
  );
}

function RegraForm({
  regra,
  onChange,
}: {
  regra: Omit<MarkupRegraConstrutivaRow, 'id'>;
  onChange: (patch: Partial<Omit<MarkupRegraConstrutivaRow, 'id'>>) => void;
}) {
  return (
    <div className="space-y-3 pt-2">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        <CampoNumero
          label="Espessura corpo"
          value={regra.espessura_corpo_mm}
          onChange={(v) => onChange({ espessura_corpo_mm: v })}
          suffix="mm"
        />
        <CampoNumero
          label="Espessura porta"
          value={regra.espessura_porta_mm}
          onChange={(v) => onChange({ espessura_porta_mm: v })}
          suffix="mm"
        />
        <CampoNumero
          label="Espessura fundo"
          value={regra.espessura_fundo_mm}
          onChange={(v) => onChange({ espessura_fundo_mm: v })}
          suffix="mm"
        />
        <CampoNumero
          label="Folga corrediça"
          value={regra.folga_corredica_mm}
          onChange={(v) => onChange({ folga_corredica_mm: v })}
          suffix="mm"
        />
        <CampoNumero
          label="Folga puxador"
          value={regra.folga_puxador_mm}
          onChange={(v) => onChange({ folga_puxador_mm: v })}
          suffix="mm"
        />
        <CampoNumero
          label="Área da chapa padrão"
          value={regra.area_chapa_padrao_m2}
          onChange={(v) => onChange({ area_chapa_padrao_m2: v })}
          suffix="m²"
        />
        <CampoNumero
          label="Perda de chapa"
          value={regra.perda_chapa_pct}
          onChange={(v) => onChange({ perda_chapa_pct: v })}
          suffix="%"
        />
        <CampoNumero
          label="Perda de fita de borda"
          value={regra.perda_fita_borda_pct}
          onChange={(v) => onChange({ perda_fita_borda_pct: v })}
          suffix="%"
        />
      </div>
      <FaixasDobradicaEditor
        faixas={regra.regra_dobradicas}
        onChange={(regra_dobradicas) => onChange({ regra_dobradicas })}
      />
    </div>
  );
}

export function MarkupRegrasConstrutivasEditor({ className }: { className?: string }) {
  const { data: regras = [], isLoading, criarRegra, atualizarRegra, removerRegra } = useMarkupRegrasConstrutivas();
  const [novoTipo, setNovoTipo] = useState('');
  const [removerId, setRemoverId] = useState<string | null>(null);

  const regraParaRemover = regras.find((r) => r.id === removerId);

  const salvarNova = () => {
    const tipo = novoTipo.trim().toLowerCase();
    if (!tipo) return;
    criarRegra.mutate({ ...REGRA_PADRAO_NOVA, tipo_movel: tipo, ordem: regras.length });
    setNovoTipo('');
  };

  return (
    <div className={cn('space-y-3', className)}>
      <div>
        <Label className="text-sm font-medium">Regras construtivas (motor de cálculo)</Label>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Como calcular chapa, fita de borda, dobradiça e corrediça por tipo de móvel — a IA lê
          dimensão e tipo da foto/PDF; a conta sai daqui, não do "achismo" da IA. Tipo{' '}
          <code className="rounded bg-muted px-1">padrao</code> é usado quando nenhum tipo
          específico bate com o móvel identificado.
        </p>
      </div>

      {isLoading ? (
        <p className="text-xs text-muted-foreground">Carregando regras…</p>
      ) : regras.length === 0 ? (
        <p className="rounded-md border border-dashed px-3 py-4 text-center text-xs text-muted-foreground">
          Nenhuma regra cadastrada ainda. Crie ao menos a regra <code>padrao</code> abaixo.
        </p>
      ) : (
        <Accordion type="multiple" className="rounded-lg border bg-card/50">
          {regras.map((regra) => (
            <AccordionItem key={regra.id} value={regra.id} className="border-b px-3 last:border-0">
              <div className="flex items-center gap-2 py-1">
                <Switch
                  checked={regra.ativo}
                  onCheckedChange={(ativo) => atualizarRegra.mutate({ id: regra.id, ativo })}
                  aria-label={`Ativar regra ${regra.tipo_movel}`}
                />
                <AccordionTrigger className="flex-1 py-3 hover:no-underline">
                  <div className="flex flex-1 items-center justify-between gap-2 pr-2 text-left">
                    <span className="text-sm font-medium">{regra.tipo_movel}</span>
                    <Badge variant="secondary" className="text-[10px] font-normal">
                      corpo {regra.espessura_corpo_mm}mm
                    </Badge>
                  </div>
                </AccordionTrigger>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive"
                  onClick={() => setRemoverId(regra.id)}
                  aria-label={`Remover regra ${regra.tipo_movel}`}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
              <AccordionContent className="pb-4 pt-0">
                <RegraForm
                  regra={regra}
                  onChange={(patch) => atualizarRegra.mutate({ id: regra.id, ...patch })}
                />
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <Input
          value={novoTipo}
          onChange={(e) => setNovoTipo(e.target.value)}
          placeholder="Novo tipo (ex.: gaveteiro)"
          className="h-9 max-w-[14rem] text-sm"
        />
        <Button type="button" variant="outline" size="sm" onClick={salvarNova} disabled={!novoTipo.trim()}>
          <Plus className="h-3.5 w-3.5 mr-1" />
          Adicionar tipo
        </Button>
      </div>

      <AlertDialog open={removerId !== null} onOpenChange={(open) => !open && setRemoverId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover regra?</AlertDialogTitle>
            <AlertDialogDescription>
              A regra de <strong>{regraParaRemover?.tipo_movel}</strong> será removida. Móveis
              desse tipo passam a usar a regra <code>padrao</code> na próxima composição.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (removerId) removerRegra.mutate(removerId);
                setRemoverId(null);
              }}
            >
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
