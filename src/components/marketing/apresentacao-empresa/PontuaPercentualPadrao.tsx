import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useLeadCustomFieldDefs } from '@/hooks/useLeadCustomFields';
import {
  PONTUA_PERCENTUAL_PADRAO,
  isPontuaCampoDefinitivo,
  parsePontuaPercentualInput,
} from '@/lib/pontua';

/**
 * Percentual padrão de comissão do programa (configuração real, não a demonstração):
 * fica em `config_pontua` do campo de sistema do Pontua nos campos do lead.
 */
export function PontuaPercentualPadrao() {
  const { fields, isLoading, updateField } = useLeadCustomFieldDefs();
  const campo = fields.find((f) => isPontuaCampoDefinitivo(f));
  const atual = campo?.config_pontua?.percentual_padrao ?? campo?.config_pontua?.percentual ?? PONTUA_PERCENTUAL_PADRAO;
  const [valor, setValor] = useState(String(atual));
  useEffect(() => setValor(String(atual)), [atual]);

  const salvar = () => {
    if (!campo) return;
    updateField.mutate({
      id: campo.id,
      nome: campo.nome,
      tipo: campo.tipo,
      opcoes: campo.opcoes,
      config_pontua: { ativo: true, percentual_padrao: parsePontuaPercentualInput(valor) },
    });
  };

  return (
    <div className="rounded-md border bg-muted/40 p-3">
      <Label htmlFor="pontua-pct">Comissão padrão do programa (%)</Label>
      <p className="mb-2 text-[0.75rem] text-muted-foreground">Vale para os leads novos com parceiro. Isto é configuração real; os números da demonstração abaixo são fictícios.</p>
      <div className="flex items-center gap-2">
        <Input id="pontua-pct" inputMode="decimal" className="w-28" value={valor} disabled={isLoading || !campo} onChange={(e) => setValor(e.target.value)} />
        <Button type="button" size="sm" variant="outline" onClick={salvar}
          disabled={!campo || updateField.isPending || parsePontuaPercentualInput(valor) === atual}>
          {updateField.isPending ? <Loader2 className="mr-1 h-4 w-4 animate-spin" aria-hidden /> : null}
          Salvar comissão
        </Button>
      </div>
    </div>
  );
}
