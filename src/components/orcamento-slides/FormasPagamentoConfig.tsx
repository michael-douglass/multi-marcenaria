import { useState } from 'react';
import { Loader2, CreditCard } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { useOrcamentoSlideFormasPagamentoAdmin } from '@/hooks/useOrcamentoSlideFormasPagamento';
import type { FormaPagamentoTipo, OrcamentoFormaPagamento } from '@/lib/orcamento-slide-types';

const TIPO_LABEL: Record<FormaPagamentoTipo, string> = {
  a_vista: 'À vista',
  parcelado: 'Parcelado',
  entrada_entrega: 'Entrada + entrega',
};

function FormaPagamentoCard({
  forma,
  onSalvar,
  isSaving,
}: {
  forma: OrcamentoFormaPagamento;
  onSalvar: (patch: Partial<OrcamentoFormaPagamento> & { id: string }) => void;
  isSaving: boolean;
}) {
  const [parcelas, setParcelas] = useState(String(forma.parcelas_padrao));
  const [entrada, setEntrada] = useState(String(forma.entrada_percent));
  const [entrega, setEntrega] = useState(String(forma.entrega_percent));
  const [descricao, setDescricao] = useState(forma.descricao ?? '');
  const [ativo, setAtivo] = useState(forma.ativo);

  const handleSalvar = () => {
    onSalvar({
      id: forma.id,
      descricao: descricao.trim() || null,
      parcelas_padrao: parseInt(parcelas, 10) || 12,
      entrada_percent: parseFloat(entrada) || 60,
      entrega_percent: parseFloat(entrega) || 40,
      ativo,
    });
  };

  return (
    <div className="rounded-xl border border-border/70 p-4 flex flex-col gap-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-semibold">{forma.nome}</p>
          <Badge variant="secondary" className="text-[10px] mt-1">
            {TIPO_LABEL[forma.tipo]}
          </Badge>
        </div>
        <div className="flex items-center gap-2">
          <Label htmlFor={`ativo-${forma.id}`} className="text-xs text-muted-foreground">
            Ativa
          </Label>
          <Switch
            id={`ativo-${forma.id}`}
            checked={ativo}
            onCheckedChange={setAtivo}
          />
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label className="text-xs">Descrição (exibida ao criar orçamento)</Label>
        <Input value={descricao} onChange={(e) => setDescricao(e.target.value)} />
      </div>

      {forma.tipo === 'parcelado' && (
        <div className="flex flex-col gap-1.5">
          <Label className="text-xs">Parcelas padrão</Label>
          <Input
            type="number"
            min={2}
            max={120}
            value={parcelas}
            onChange={(e) => setParcelas(e.target.value)}
          />
        </div>
      )}

      {forma.tipo === 'entrada_entrega' && (
        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs">% entrada</Label>
            <Input
              type="number"
              min={0}
              max={100}
              value={entrada}
              onChange={(e) => setEntrada(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs">% na entrega</Label>
            <Input
              type="number"
              min={0}
              max={100}
              value={entrega}
              onChange={(e) => setEntrega(e.target.value)}
            />
          </div>
        </div>
      )}

      <Button type="button" size="sm" onClick={handleSalvar} disabled={isSaving}>
        Salvar
      </Button>
    </div>
  );
}

export function FormasPagamentoConfig() {
  const { formas, isLoading, atualizarForma } = useOrcamentoSlideFormasPagamentoAdmin();

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-amber-400" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 max-w-2xl pb-8">
      <div className="flex items-center gap-2">
        <CreditCard className="h-5 w-5 text-amber-400" />
        <div>
          <h2 className="text-lg font-semibold">Formas de pagamento</h2>
          <p className="text-sm text-muted-foreground">
            Opções exibidas ao criar ou editar orçamentos (à vista, parcelado, entrada + entrega).
          </p>
        </div>
      </div>

      {formas.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Nenhuma forma cadastrada. Execute a migration mais recente no Supabase.
        </p>
      ) : (
        formas.map((forma) => (
          <FormaPagamentoCard
            key={forma.id}
            forma={forma}
            onSalvar={(patch) => atualizarForma.mutate(patch)}
            isSaving={atualizarForma.isPending}
          />
        ))
      )}
    </div>
  );
}
