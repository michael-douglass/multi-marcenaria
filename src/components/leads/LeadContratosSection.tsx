import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ClipboardList, Eye, FileText, Link2, Loader2, Plus, Unlink } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  useContratosPorLead,
  useVincularContratoLead,
} from '@/hooks/useContratosLead';
import type { Contrato } from '@/hooks/useContratos';
import { ContratoVisualizarDialog } from '@/components/contratos/ContratoVisualizarDialog';
import { useContratos } from '@/hooks/useContratos';
import { useContratosVariaveis } from '@/hooks/useContratosVariaveis';
import { useCopiarLinkFormularioLead } from '@/hooks/useCopiarLinkFormularioLead';
import { getContratoNomeExibicao } from '@/lib/contrato-rascunho';

interface LeadContratosSectionProps {
  leadId: number;
  readOnly?: boolean;
}

export function LeadContratosSection({ leadId, readOnly = false }: LeadContratosSectionProps) {
  const navigate = useNavigate();
  const { data: contratos = [], isLoading } = useContratosPorLead(leadId);
  const { contratos: todosContratos } = useContratos();
  const { variaveis } = useContratosVariaveis();
  const vincular = useVincularContratoLead();
  const { copiar: copiarLinkFormulario, isCopiando, podeCopiar } =
    useCopiarLinkFormularioLead(leadId);
  const [visualizar, setVisualizar] = useState<Contrato | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);

  const disponiveis = todosContratos.filter((c) => !c.lead_id);

  const handleVincular = (contratoId: string) => {
    vincular.mutate(
      { contratoId, leadId },
      { onSuccess: () => setPickerOpen(false) },
    );
  };

  const handleDesvincular = (contratoId: string) => {
    vincular.mutate({ contratoId, leadId: null });
  };

  return (
    <div className="space-y-3 w-full min-w-0">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <Label className="text-sm font-semibold flex items-center gap-2">
          <FileText className="h-4 w-4 text-amber-400" />
          Contratos vinculados
          {contratos.length > 0 && (
            <Badge variant="secondary" className="text-xs h-5">
              {contratos.length}
            </Badge>
          )}
        </Label>
        {!readOnly && (
          <div className="flex items-center gap-1.5 flex-wrap justify-end">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 gap-1.5 text-xs"
              disabled={isCopiando || !podeCopiar}
              onClick={() => void copiarLinkFormulario()}
              title="Link público: o cliente preenche sem cadastro e o contrato nasce neste card"
            >
              {isCopiando ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <ClipboardList className="h-3.5 w-3.5" />
              )}
              Copiar link do formulário
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 gap-1.5 text-xs border-amber-500/40 text-amber-200 hover:bg-amber-500/10"
              onClick={() => navigate(`/contratos/novo?leadId=${leadId}`)}
            >
              <Plus className="h-3.5 w-3.5" />
              Novo contrato
            </Button>
            {disponiveis.length > 0 && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 gap-1.5 text-xs"
                onClick={() => setPickerOpen(true)}
              >
                <Link2 className="h-3.5 w-3.5" />
                Anexar contrato
              </Button>
            )}
          </div>
        )}
      </div>

      {isLoading ? (
        <div className="flex justify-center py-6">
          <Loader2 className="h-5 w-5 animate-spin text-amber-400" />
        </div>
      ) : contratos.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border/70 py-6 px-4 text-center text-sm text-muted-foreground">
          Nenhum contrato vinculado a este lead.
          {!readOnly && (
            <p className="text-xs mt-2">
              Copie o link do formulário para o cliente preencher sem cadastro — o contrato
              aparece aqui em rascunho. Ou use &quot;Novo contrato&quot; / &quot;Anexar contrato&quot;.
            </p>
          )}
        </div>
      ) : (
        <ul className="space-y-2">
          {contratos.map((c) => {
            const isRascunho = c.status === 'rascunho';
            return (
              <li
                key={c.id}
                className="flex items-center gap-2 rounded-lg border border-amber-500/20 bg-amber-500/5 px-3 py-2.5 group"
              >
                <FileText className="h-4 w-4 text-amber-400 shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate">
                    {getContratoNomeExibicao(c, variaveis)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {isRascunho ? 'Rascunho · ' : ''}
                    {format(new Date(c.created_at), 'dd/MM/yyyy', { locale: ptBR })}
                  </p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {isRascunho ? (
                    !readOnly && (
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className="h-8 gap-1 text-xs text-amber-200"
                        onClick={() =>
                          navigate(`/contratos/novo?rascunho=${c.id}&leadId=${leadId}`)
                        }
                      >
                        Continuar
                      </Button>
                    )
                  ) : (
                    <>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className="h-8 gap-1 text-xs"
                        onClick={() => setVisualizar(c)}
                      >
                        <Eye className="h-3.5 w-3.5" />
                        Ver
                      </Button>
                      {!readOnly && (
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8 text-muted-foreground hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                          title="Desvincular"
                          onClick={() => handleDesvincular(c.id)}
                          disabled={vincular.isPending}
                        >
                          <Unlink className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <ContratoVisualizarDialog
        contrato={visualizar}
        open={!!visualizar}
        onOpenChange={(o) => !o && setVisualizar(null)}
      />

      <Dialog open={pickerOpen} onOpenChange={setPickerOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Anexar contrato a este lead</DialogTitle>
          </DialogHeader>
          <ScrollArea className="max-h-[280px]">
            <ul className="space-y-1 pr-2">
              {disponiveis.map((c) => (
                <li key={c.id}>
                  <button
                    type="button"
                    className="w-full text-left rounded-md px-3 py-2.5 hover:bg-muted/60 transition-colors"
                    onClick={() => handleVincular(c.id)}
                    disabled={vincular.isPending}
                  >
                    <p className="text-sm font-medium truncate">
                      {getContratoNomeExibicao(c, variaveis)}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">{c.identificador}</p>
                  </button>
                </li>
              ))}
            </ul>
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </div>
  );
}
