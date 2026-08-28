import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Link2 } from 'lucide-react';
import type { Contrato } from '@/hooks/useContratos';
import type { ContratoVariavel } from '@/hooks/useContratosVariaveis';
import { getContratoNomeExibicao } from '@/lib/contrato-rascunho';

interface ContratoIdentificadorCellProps {
  contrato: Pick<
    Contrato,
    'cliente_nome' | 'identificador' | 'campos_valores' | 'created_at' | 'lead_id' | 'lead'
  >;
  variaveis: ContratoVariavel[];
  /** Quando true, não mostra a data (útil se a coluna Data já existe na tabela). */
  ocultarData?: boolean;
  /** Abre o card do lead no canto da tela (mesmo atalho do orçamento). */
  onAbrirLead?: (leadId: number, leadNome?: string) => void;
}

export function ContratoIdentificadorCell({
  contrato,
  variaveis,
  ocultarData = false,
  onAbrirLead,
}: ContratoIdentificadorCellProps) {
  const nome = getContratoNomeExibicao(contrato, variaveis);
  const data = format(new Date(contrato.created_at), 'dd/MM/yyyy', { locale: ptBR });
  const leadNome = contrato.lead?.nome?.trim() || null;
  const leadId = contrato.lead_id;
  const podeAbrirLead = Boolean(leadId && onAbrirLead);
  const rotuloLead = leadNome || 'vinculado';

  return (
    <div className="min-w-0">
      <p className="font-medium text-foreground truncate">{nome}</p>
      {leadId ? (
        podeAbrirLead ? (
          <button
            type="button"
            className="text-xs text-amber-400/90 flex items-center gap-1 truncate mt-0.5 max-w-full hover:text-amber-300 hover:underline underline-offset-2"
            title={`Abrir card do lead ${rotuloLead}`}
            onClick={(e) => {
              e.stopPropagation();
              onAbrirLead?.(leadId, leadNome ?? undefined);
            }}
          >
            <Link2 className="h-3 w-3 shrink-0" />
            Lead: {rotuloLead}
          </button>
        ) : (
          <p className="text-xs text-amber-400/90 flex items-center gap-1 truncate mt-0.5">
            <Link2 className="h-3 w-3 shrink-0" />
            Lead: {rotuloLead}
          </p>
        )
      ) : null}
      {!ocultarData && (
        <p className="text-xs text-muted-foreground font-mono truncate">{data}</p>
      )}
    </div>
  );
}
