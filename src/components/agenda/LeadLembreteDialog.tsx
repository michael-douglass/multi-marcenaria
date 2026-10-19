import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { addDays, format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import {
  Bell,
  Phone,
  Mail,
  MapPin,
  Calendar as CalIcon,
  Clock,
  ExternalLink,
  FileText,
  CheckCircle2,
  Maximize2,
  Minimize2,
  Calculator,
} from 'lucide-react';
import { DateInput } from '@/components/ui/DateInput';
import { getCurrentHora24h } from '@/lib/horarios-24h';
import { useAuth } from '@/contexts/AuthContext';
import { useEmpresa } from '@/contexts/EmpresaContext';
import { LeadLembrete, useLeadLembretes } from '@/hooks/useLeadLembretes';
import { useEmpresaSupabase } from '@/hooks/useEmpresaSupabase';
import { resolveLeadLembretesQueryConfig } from '@/lib/empresa-tables';
import { normalizeLembreteTitularIds } from '@/lib/lead-lembrete-titulares';
import { LeadLembreteTitularesPicker } from '@/components/agenda/LeadLembreteTitularesPicker';
import { AgendaItemAnexosField } from '@/components/agenda/AgendaItemAnexosField';
import { useAgendaItemAnexosDraft } from '@/hooks/useAgendaItemAnexosDraft';
import { AgendaColorPicker } from '@/components/agenda/AgendaColorPicker';
import { KanbanProjetoSignal } from '@/components/kanban/KanbanProjetoSignal';
import { MarkupCardPreview } from '@/components/markup/MarkupCardPreview';
import { useProjetoPorLead, useProjetoStages } from '@/hooks/useLeadProjetos';
import { resolveMarkupTable } from '@/lib/markup-tables';
import type { MarkupLeadResumo } from '@/lib/markup-types';
import {
  projetoSignalTone,
  shouldPulseFeitoAwaitingOrcamento,
} from '@/lib/projetos-atelie';
import { cn } from '@/lib/utils';
import { floatingNestedOverlayClass } from '@/lib/overlay-z-index';

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  leadId: number;
  leadName: string;
  lembrete?: LeadLembrete | null;
  /** Data pré-preenchida ao criar novo lembrete (ex.: dia visível no calendário). */
  initialDate?: Date;
  /** Acima do painel flutuante da agenda (z-95). */
  floatingLayer?: boolean;
  /** Janela aberta por cima de outro Dialog (ex.: card do lead). */
  nested?: boolean;
}

/** Horários em formato 24h (00:00 até 23:45, a cada 15 min) */
const HORARIOS_24H: string[] = (() => {
  const slots: string[] = [];
  for (let h = 0; h < 24; h++) {
    for (let m = 0; m < 60; m += 15) {
      slots.push(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
    }
  }
  return slots;
})();

export function LeadLembreteDialog({
  open,
  onOpenChange,
  leadId,
  leadName,
  lembrete,
  initialDate,
  floatingLayer,
  nested,
}: Props) {
  const { user } = useAuth();
  const { schemaEmpresa, queriesReady } = useEmpresa();
  const db = useEmpresaSupabase();
  const lembretesConfig = resolveLeadLembretesQueryConfig(schemaEmpresa);
  const { createLembrete, updateLembrete, completeLembrete } = useLeadLembretes();
  const navigate = useNavigate();

  const [titulo, setTitulo] = useState('');
  const [descricao, setDescricao] = useState('');
  const [data, setData] = useState<Date | undefined>(undefined);
  const [hora, setHora] = useState('09:00');
  const [titularIds, setTitularIds] = useState<string[]>([]);
  const [cor, setCor] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [completing, setCompleting] = useState(false);
  /** Popup central para ler/editar a descrição com mais espaço. */
  const [descricaoExpandidaOpen, setDescricaoExpandidaOpen] = useState(false);
  const anexosDraft = useAgendaItemAnexosDraft({
    accept: 'images',
    scope: 'lembretes',
    open,
  });
  const resetAnexos = anexosDraft.reset;

  /** Quem marcou o lembrete permanece sempre como titular. */
  const lockedTitularId = lembrete?.criado_por || user?.id || null;

  const isConcluido = lembrete?.status === 'concluido';

  const horaOptions = useMemo(() => {
    if (hora && !HORARIOS_24H.includes(hora)) {
      return [...HORARIOS_24H, hora].sort();
    }
    return HORARIOS_24H;
  }, [hora]);

  // Buscar dados completos do lead vinculado para exibir o card com observações
  const { data: leadData } = useQuery({
    queryKey: ['lead-lembrete-card', schemaEmpresa ?? 'master', leadId],
    queryFn: async () => {
      const { data, error } = await db
        .from(lembretesConfig.leadsTable)
        .select('id, nome, telefone, email, empresa, status, origem, regiao, observacoes, data_chegada')
        .eq('id', leadId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: open && !!leadId && queriesReady,
  });

  // Mesmo sinal do pipeline: projeto do ateliê (feito / em desenho / fila)
  const { projeto } = useProjetoPorLead(open ? leadId : null);
  const { data: projetoStages = [] } = useProjetoStages();
  const projetoTone = useMemo(
    () => projetoSignalTone(projeto, projetoStages),
    [projeto, projetoStages],
  );
  const devePulsarProjetoFeito =
    projetoTone === 'done' && shouldPulseFeitoAwaitingOrcamento(leadData?.status);

  // Markup mais recente do lead (só o resumo, sem abrir a calculadora)
  const markupTable = resolveMarkupTable(schemaEmpresa, 'orcamentos');
  const { data: markupResumo } = useQuery({
    queryKey: ['lead-lembrete-markup', schemaEmpresa ?? 'master', leadId],
    queryFn: async (): Promise<MarkupLeadResumo | null> => {
      const { data, error } = await db
        .from(markupTable as 'markup_orcamentos')
        .select('id, lead_id, titulo, preco_final, atualizado_em')
        .eq('lead_id', leadId)
        .order('atualizado_em', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      if (!data?.lead_id) return null;
      return {
        lead_id: data.lead_id as number,
        orcamento_id: data.id as string,
        preco_final: Number(data.preco_final ?? 0),
        titulo: (data.titulo as string) ?? 'Markup',
        atualizado_em: (data.atualizado_em as string) ?? '',
      };
    },
    enabled: open && !!leadId && queriesReady,
  });
  const temMarkup = Boolean(markupResumo && markupResumo.preco_final > 0);

  useEffect(() => {
    if (!open) {
      setDescricaoExpandidaOpen(false);
      return;
    }
    if (lembrete) {
      setTitulo(lembrete.titulo);
      setDescricao(lembrete.descricao || '');
      const dt = parseISO(lembrete.data_hora);
      setData(dt);
      setHora(format(dt, 'HH:mm'));
      setTitularIds(
        normalizeLembreteTitularIds(
          lembrete.titular_ids?.length ? lembrete.titular_ids : [lembrete.titular_id],
          lembrete.criado_por,
        ),
      );
      setCor(lembrete.cor ?? null);
    } else {
      setTitulo(`Lembrete: ${leadName}`);
      setDescricao('');
      setData(initialDate ?? new Date());
      setHora(getCurrentHora24h());
      setTitularIds(user?.id ? [user.id] : []);
      setCor(null);
    }
    resetAnexos(lembrete?.anexos);
  }, [open, lembrete, leadName, user?.id, initialDate, resetAnexos]);

  const handleSave = async () => {
    if (!titulo.trim() || !data || !hora || !user?.id) return;
    const ids = normalizeLembreteTitularIds(titularIds, lockedTitularId || user.id);
    if (ids.length === 0) return;
    setSaving(true);
    try {
      const [hours, minutes] = hora.split(':').map(Number);
      const dataHora = new Date(data);
      dataHora.setHours(hours, minutes, 0, 0);
      const dataHoraISO = dataHora.toISOString();
      const entityId = lembrete?.id ?? crypto.randomUUID();
      const anexos = await anexosDraft.flush(entityId);
      if (lembrete) {
        await updateLembrete.mutateAsync({
          id: lembrete.id,
          updates: {
            titulo: titulo.trim(),
            descricao: descricao.trim() || null,
            data_hora: dataHoraISO,
            titular_ids: ids,
            anexos,
            cor,
          },
        });
      } else {
        await createLembrete.mutateAsync({
          id: entityId,
          lead_id: leadId,
          titulo: titulo.trim(),
          descricao: descricao.trim() || undefined,
          data_hora: dataHoraISO,
          titular_ids: ids,
          anexos,
          cor,
        });
      }
      onOpenChange(false);
    } catch (error) {
      console.error('Erro ao salvar lembrete:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleMarcarConcluida = async () => {
    if (!lembrete?.id) return;
    setCompleting(true);
    try {
      await completeLembrete.mutateAsync(lembrete.id);
      onOpenChange(false);
    } catch (error) {
      console.error('Erro ao concluir lembrete:', error);
    } finally {
      setCompleting(false);
    }
  };

  /** Fecha o dialog de lembrete e abre o card do lead no pipeline. */
  const handleAbrirLead = () => {
    if (!leadId) return;
    onOpenChange(false);
    navigate(`/pipeline?id=${leadId}`);
  };

  const handleAdiarUmDia = () => {
    setData((atual) => addDays(atual ?? new Date(), 1));
  };

  return (
    <>
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        nested={Boolean(nested) && !floatingLayer}
        data-lead-lembrete-dialog=""
        className="max-w-2xl max-h-[90vh] overflow-y-auto"
        floatingLayer={floatingLayer}
        onPointerDownOutside={(event) => {
          const target = event.target as HTMLElement | null;
          if (descricaoExpandidaOpen) {
            event.preventDefault();
            return;
          }
          if (target?.closest('[data-date-picker-root]')) event.preventDefault();
        }}
        onFocusOutside={(event) => {
          const target = event.target as HTMLElement | null;
          if (descricaoExpandidaOpen) {
            event.preventDefault();
            return;
          }
          if (target?.closest('[data-date-picker-root]')) event.preventDefault();
        }}
        onInteractOutside={(event) => {
          if (descricaoExpandidaOpen) {
            event.preventDefault();
            return;
          }
          if (!floatingLayer) event.preventDefault();
        }}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 flex-wrap">
            <Bell className="h-5 w-5 text-primary" />
            {lembrete ? 'Editar Lembrete' : 'Novo Lembrete de Lead'}
            {isConcluido && (
              <Badge variant="secondary" className="text-green-700 bg-green-100">
                Concluído
              </Badge>
            )}
          </DialogTitle>
          <DialogDescription>
            Lembrete para chamar <strong>{leadName}</strong>
          </DialogDescription>
        </DialogHeader>

        {/* Card do lead vinculado com observações */}
        {leadData && (
          <button
            type="button"
            onClick={handleAbrirLead}
            className="w-full text-left rounded-lg border border-border bg-muted/30 p-3 space-y-2 hover:bg-muted/50 hover:border-primary/40 transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
            title="Abrir card do lead no pipeline"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h4 className="font-semibold text-sm truncate">{leadData.nome}</h4>
                  {leadData.status && (
                    <Badge variant="secondary" className="text-[10px]">
                      {leadData.status}
                    </Badge>
                  )}
                  {leadData.origem && (
                    <Badge variant="outline" className="text-[10px]">
                      {leadData.origem}
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-3 mt-1 text-[11px] text-muted-foreground flex-wrap">
                  {leadData.telefone && (
                    <span className="flex items-center gap-1">
                      <Phone className="h-3 w-3" />
                      {leadData.telefone}
                    </span>
                  )}
                  {leadData.email && (
                    <span className="flex items-center gap-1 truncate max-w-[200px]">
                      <Mail className="h-3 w-3" />
                      {leadData.email}
                    </span>
                  )}
                  {leadData.regiao && (
                    <span className="flex items-center gap-1">
                      <MapPin className="h-3 w-3" />
                      {leadData.regiao}
                    </span>
                  )}
                  {leadData.data_chegada && (
                    <span className="flex items-center gap-1">
                      <CalIcon className="h-3 w-3" />
                      {format(parseISO(leadData.data_chegada), 'dd/MM/yyyy', { locale: ptBR })}
                    </span>
                  )}
                </div>
              </div>
              <span className="inline-flex h-7 items-center gap-1 rounded-md px-2 text-xs text-primary shrink-0">
                <ExternalLink className="h-3.5 w-3.5" />
                Abrir
              </span>
            </div>

            {/* Status do projeto (ateliê) + markup — iguais ao card do pipeline */}
            <div className="flex flex-col gap-2 pt-2 border-t border-border">
              <div className="flex flex-wrap items-center gap-1.5">
                {projetoTone ? (
                  <KanbanProjetoSignal tone={projetoTone} pulse={devePulsarProjetoFeito} />
                ) : (
                  <span className="inline-flex items-center rounded-full border border-border bg-muted/60 px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                    Sem projeto no ateliê
                  </span>
                )}
                {!temMarkup && (
                  <span className="inline-flex items-center gap-1 rounded-full border border-dashed border-border bg-muted/40 px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                    <Calculator className="h-3 w-3" />
                    Sem markup
                  </span>
                )}
              </div>
              {temMarkup && markupResumo && (
                <MarkupCardPreview resumo={markupResumo} compact readOnly />
              )}
            </div>

            {leadData.observacoes && (
              <div className="pt-2 border-t border-border">
                <div className="flex items-center gap-1 text-[11px] font-medium text-muted-foreground mb-1">
                  <FileText className="h-3 w-3" />
                  Observações do lead
                </div>
                <p className="text-xs text-foreground whitespace-pre-wrap break-words max-h-32 overflow-y-auto">
                  {leadData.observacoes}
                </p>
              </div>
            )}
          </button>
        )}

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="titulo">Título *</Label>
            <Input id="titulo" value={titulo} onChange={(e) => setTitulo(e.target.value)} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
            <Label htmlFor="lembrete-data">Data *</Label>
              <DateInput
                id="lembrete-data"
                disabled={isConcluido}
                value={data ? format(data, 'yyyy-MM-dd') : null}
                onChange={(iso) => {
                  if (!iso) {
                    setData(undefined);
                    return;
                  }
                  const [year, month, day] = iso.split('-').map(Number);
                  if (!year || !month || !day) return;
                  setData((atual) => {
                    const next = atual ? new Date(atual.getTime()) : new Date();
                    next.setFullYear(year, month - 1, day);
                    return next;
                  });
                }}
                aria-label="Data do lembrete"
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-8 px-2 text-xs text-muted-foreground hover:text-foreground"
                onClick={handleAdiarUmDia}
                disabled={isConcluido}
              >
                Adiar 1 dia
              </Button>
            </div>
            <div className="space-y-2">
              <Label>Hora *</Label>
              <Select value={hora} onValueChange={setHora}>
                <SelectTrigger className="w-full">
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <SelectValue placeholder="Selecione o horário" />
                  </div>
                </SelectTrigger>
                <SelectContent className="max-h-[240px]">
                  {horaOptions.map((slot) => (
                    <SelectItem key={slot} value={slot}>
                      {slot}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <Label htmlFor="descricao">Detalhes</Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-7 gap-1.5 px-2 text-xs text-muted-foreground hover:text-foreground"
                onClick={() => setDescricaoExpandidaOpen(true)}
                title="Abrir detalhes em tela ampla"
                aria-label="Abrir detalhes em tela ampla"
              >
                <Maximize2 className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Ampliar</span>
              </Button>
            </div>
            <div className="relative group">
              <Textarea
                id="descricao"
                value={descricao}
                onChange={(e) => setDescricao(e.target.value)}
                placeholder="Anotações sobre o que conversar..."
                rows={3}
                className="pr-10 max-h-40 overflow-y-auto resize-y"
              />
              <button
                type="button"
                onClick={() => setDescricaoExpandidaOpen(true)}
                className="absolute right-2 top-2 inline-flex h-7 w-7 items-center justify-center rounded-md border border-border/80 bg-background/90 text-muted-foreground opacity-80 shadow-sm transition-all hover:opacity-100 hover:text-foreground hover:border-primary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:opacity-0 sm:group-hover:opacity-100"
                title="Abrir em tela ampla"
                aria-label="Abrir detalhes em tela ampla"
              >
                <Maximize2 className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          <AgendaColorPicker
            value={cor}
            onChange={setCor}
            eventType="lembrete"
            hint="Escolha uma cor para achar este lembrete de lead mais fácil no calendário."
          />

          <LeadLembreteTitularesPicker
            value={titularIds}
            onChange={setTitularIds}
            lockedUserId={lockedTitularId}
            compact
          />

          <AgendaItemAnexosField
            draft={anexosDraft}
            accept="images"
            readOnly={isConcluido}
            floatingLayer={floatingLayer}
            title="Fotos deste lembrete"
            hint="Só neste lembrete. Não aparecem nos anexos do card do lead."
          />
        </div>

        <DialogFooter className="flex-col-reverse sm:flex-row gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving || completing}>
            Cancelar
          </Button>
          {lembrete && !isConcluido && (
            <Button
              type="button"
              variant="secondary"
              className="bg-green-600 hover:bg-green-700 text-white border-0"
              onClick={handleMarcarConcluida}
              disabled={saving || completing}
            >
              <CheckCircle2 className="h-4 w-4 mr-2" />
              {completing ? 'Concluindo…' : 'Marcar como concluída'}
            </Button>
          )}
          <Button
            onClick={handleSave}
            disabled={
              !titulo.trim() ||
              !data ||
              !hora ||
              titularIds.length === 0 ||
              saving ||
              completing ||
              isConcluido ||
              anexosDraft.converting ||
              anexosDraft.busy
            }
          >
            {saving || anexosDraft.busy ? 'Salvando...' : lembrete ? 'Salvar' : 'Criar Lembrete'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    {/* Popup central: descrição em tela ampla e rolável */}
    <Dialog open={descricaoExpandidaOpen} onOpenChange={setDescricaoExpandidaOpen}>
      <DialogContent
        nested={!floatingLayer}
        floatingLayer={floatingLayer}
        overlayClassName={floatingLayer ? floatingNestedOverlayClass : undefined}
        data-descricao-expandida-dialog=""
        className={cn(
          'flex w-[min(96vw,52rem)] max-w-[52rem] flex-col gap-0 overflow-hidden p-0',
          'h-[min(92dvh,42rem)] max-h-[92dvh]',
          'border-[#2a1812]/12 bg-[#fffcf8] text-[#2a1812] shadow-2xl sm:rounded-2xl',
          floatingLayer && floatingNestedOverlayClass,
        )}
      >
        <DialogHeader className="shrink-0 space-y-1 border-b border-[#2a1812]/10 px-5 pb-3 pt-5 pr-12 text-left">
          <DialogTitle className="flex items-center gap-2 text-base text-[#2a1812]">
            <FileText className="h-4 w-4 text-[#8b5e3c]" />
            Detalhes do lembrete
          </DialogTitle>
          <DialogDescription className="text-sm text-[#2a1812]/65">
            Leitura ampla para <strong className="font-medium text-[#2a1812]">{leadName}</strong>.
            Role a página se o texto for longo.
          </DialogDescription>
        </DialogHeader>

        <div className="relative min-h-0 flex-1">
          <Textarea
            id="descricao-expandida"
            value={descricao}
            onChange={(e) => setDescricao(e.target.value)}
            placeholder="Anotações sobre o que conversar..."
            disabled={isConcluido}
            className={cn(
              'absolute inset-5 min-h-0 resize-none overflow-y-auto overscroll-contain',
              'border-[#2a1812]/12 bg-[#fffaf3] px-4 py-3 md:text-base',
              'text-base leading-relaxed text-[#2a1812]',
              'placeholder:text-[#2a1812]/40 focus-visible:ring-[#8b5e3c]/40',
            )}
            autoFocus
          />
        </div>

        <DialogFooter className="shrink-0 flex-row justify-end gap-2 border-t border-[#2a1812]/10 bg-[#fffaf3]/80 px-5 py-3 sm:space-x-0">
          <Button
            type="button"
            variant="outline"
            className="gap-1.5 border-[#2a1812]/15 bg-white text-[#2a1812] hover:bg-[#fff6ec]"
            onClick={() => setDescricaoExpandidaOpen(false)}
          >
            <Minimize2 className="h-4 w-4" />
            Voltar ao formulário
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    </>
  );
}
