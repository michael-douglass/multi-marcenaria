import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { format, parseISO } from 'date-fns';
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
  CalendarIcon,
  Clock,
  ExternalLink,
  FileText,
  CheckCircle2,
} from 'lucide-react';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
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
  const [saving, setSaving] = useState(false);
  const [completing, setCompleting] = useState(false);
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

  useEffect(() => {
    if (!open) return;
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
    } else {
      setTitulo(`Lembrete: ${leadName}`);
      setDescricao('');
      setData(initialDate ?? new Date());
      setHora(getCurrentHora24h());
      setTitularIds(user?.id ? [user.id] : []);
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" floatingLayer={floatingLayer}>
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
              <Label>Data *</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    className={cn(
                      'w-full justify-start text-left font-normal',
                      !data && 'text-muted-foreground',
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4 shrink-0" />
                    {data ? format(data, 'dd/MM/yyyy', { locale: ptBR }) : 'Selecione dia, mês e ano'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={data}
                    onSelect={setData}
                    locale={ptBR}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
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
            <Label htmlFor="descricao">Detalhes</Label>
            <Textarea
              id="descricao"
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              placeholder="Anotações sobre o que conversar..."
              rows={3}
            />
          </div>

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
  );
}
