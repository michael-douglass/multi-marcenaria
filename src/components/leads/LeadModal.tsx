import { useEffect, useState, useMemo, useRef, useCallback, lazy, Suspense } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import type { Lead, LeadOrigin, LeadStatus, User } from '@/types/selletos';
import { useLeads, useLeadDetail, type LeadWithVendor } from '@/hooks/useLeads';
import { useUsers } from '@/hooks/useUsers';
import { useWebhooks } from '@/hooks/useWebhooks';
import { useAuth } from '@/contexts/AuthContext';
import { usePermissions } from '@/hooks/usePermissions';
import { useLeadOrigins } from '@/hooks/useLeadOrigins';
import { DEFAULT_PIPELINE_STAGES, usePipelineCustomStages } from '@/hooks/usePipelineCustomStages';
import { getPipelineInboxStageName, groupLeadModalStatusOptions, resolveLeadStatusDisplay, type LeadModalStatusOption } from '@/lib/pipeline-status-options';
import {
  LeadStatusColumnDisplay,
  LeadStatusColumnOptionRow,
} from './LeadStatusColumnDisplay';
import { useRegioes } from '@/hooks/useRegioes';
import { adaptLeadFromDatabase, adaptUserFromDatabase } from '@/lib/adapters';
import { setLeadDetailCache } from '@/lib/leads-cache';
import { useEmpresa } from '@/contexts/EmpresaContext';
import { useEmpresaSupabase, useTableName } from '@/hooks/useEmpresaSupabase';
import { resolveChatContatosQueryConfig } from '@/lib/empresa-tables';
import { cn, formatInternationalPhone, getTodaySaoPaulo } from '@/lib/utils';
import { Bell, Copy, Share2, Webhook, Ban, FileText, Sparkles, Star, User as UserIcon, Building2, Users, StickyNote, FolderOpen, X } from 'lucide-react';
import { LeadVendorBanner } from '@/components/leads/LeadVendorBanner';
import { LeadModalHeaderAura } from '@/components/leads/LeadModalHeaderAura';
import { LeadLembreteDialog } from '@/components/agenda/LeadLembreteDialog';
import { LeadLembretesPopover } from '@/components/agenda/LeadLembretesPopover';
import { LeadLembretesSection } from '@/components/leads/LeadLembretesSection';
import { LeadFormResponseSection } from '@/components/leads/LeadFormResponseSection';
import { LeadSinalizacoesSection } from '@/components/leads/LeadSinalizacoesSection';
import { useLeadLembretesCountMap } from '@/hooks/useLeadLembretes';
import { toast } from 'sonner';
import { SaleValueDialog } from './SaleValueDialog';
import { useLeadPontuaGarboSaleInfo } from '@/hooks/useLeadPontuaGarboSaleInfo';
import { useSyncPontuaGarboLiberacaoAposVenda } from '@/hooks/usePontuaGarboComissaoLiberacao';
import type { LeadPontuaGarboSaleInfo } from '@/lib/pontua-garbo';
import { WhatsAppHistoryCard } from './WhatsAppHistoryCard';
import { ScheduleMeetingDialog } from './ScheduleMeetingDialog';
import { LeadCustomFieldsSection } from './LeadCustomFieldsSection';
import { LeadPDFAttachments, type LeadPDFAttachmentsHandle } from './LeadPDFAttachments';
import { LeadContratosSection } from './LeadContratosSection';
import { LeadOrcamentoSlidesSection } from './LeadOrcamentoSlidesSection';
import { MarkupLeadSection } from '@/components/markup/MarkupLeadSection';
import { LeadProjetoPanel } from '@/components/projetos/LeadProjetoPanel';
import { LeadProjetoConclusaoPanel } from '@/components/projetos/LeadProjetoConclusaoPanel';
import { LeadProjetoNotasSection } from '@/components/projetos/LeadProjetoNotasSection';
import { LeadProjetoComposicaoSection } from '@/components/projetos/LeadProjetoComposicaoSection';
import { LeadKnowledgeMemoryCard } from './LeadKnowledgeMemoryCard';
import { AMBIENTE_FULLSCREEN_ATTR, ENVIAR_PROJETO_DIALOG_OPEN_ATTR, shouldPreventDialogOutsideClose } from '@/lib/dialog-outside-guard';
const LeadWhiteboard = lazy(() =>
  import('./LeadWhiteboard').then((m) => ({ default: m.LeadWhiteboard })),
);
import { LeadModalFooter } from './LeadModalFooter';
import { LeadAIAnalysisTab } from './LeadAIAnalysisTab';
import { LeadModalSection, LeadModalScrollBody } from './LeadModalSection';
import { LeadPontuaGarboContactPanel } from './LeadPontuaGarboContactPanel';
import { LeadPontuaGarboPartnerBadge } from './LeadPontuaGarboPartnerBadge';
import { usePontuaGarboPartnerBadge } from '@/hooks/usePontuaGarboPartnerLeads';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { LeadEditableField } from './LeadEditableField';
import {
  LeadNameAutocomplete,
  type LeadContactSuggestion,
} from './LeadNameAutocomplete';
import { LeadDuplicateButton } from './LeadDuplicateButton';
import { useIsMobile } from '@/hooks/use-mobile';
import { supabase } from '@/integrations/supabase/client';
import { useLeadMeeting } from '@/hooks/useLeadMeetings';
import { z } from 'zod';
import { useVendasGanhosConfig } from '@/hooks/useVendasGanhosConfig';
import { buildMarkAsWonUpdates } from '@/lib/vendas-ganhos';
import { buildChangedLeadUpdates, resolveVendorUserIdFromForm } from '@/lib/lead-form-auto-save';

// Schema de validação para leads
const leadSchema = z.object({
  name: z.string().trim().min(2, 'Nome deve ter no mínimo 2 caracteres').max(100, 'Nome muito longo'),
  email: z.string().email('Email inválido').max(255, 'Email muito longo').optional().or(z.literal('')),
  phone: z
    .string()
    .transform((value) => formatInternationalPhone(value))
    .pipe(z.string().min(1, 'Informe o telefone')),
  company: z.string().max(200, 'Nome da empresa muito longo').optional(),
  lossReason: z.string().max(500, 'Motivo de perda muito longo').optional(),
  observations: z.string().max(2000, 'Observações muito longas (máx. 2000 caracteres)').optional()
});
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

export type { LeadModalStatusOption };

interface LeadModalProps {
  isOpen: boolean;
  onClose: () => void;
  leadId?: number | null;
  isEditMode?: boolean;
  /** Colunas da página Kanban atual (ex.: Orçamentos a fazer → status no banco) */
  statusOptions?: LeadModalStatusOption[];
  /**
   * Quando false (página Leads): status só muda ao salvar o formulário — evita gravar ao abrir o card.
   * @default true
   */
  statusChangeOnSelect?: boolean;
  /** Status do pipeline + páginas Kanban (página Leads) */
  allStatusValues?: string[];
  /** Status inicial ao criar lead (ex.: primeira coluna do funil atual) */
  newLeadDefaultStatus?: string;
  /** Aba inicial ao abrir o card (ex.: vinda de notificação de análise IA) */
  initialTab?: 'detalhes' | 'analise-ia';
  /** Subaba dentro de Análise IA (visual ou renderização) */
  initialIaSubtab?: 'visual' | 'render';
  /** Após duplicar, o pai abre o card do novo lead (mesmo modal). */
  onLeadDuplicated?: (newLeadId: number) => void;
  /**
   * Após criar, o pai troca o ID sem fechar o modal — o vendedor continua
   * no card para marcar tarefas, lembretes e usar os demais recursos.
   */
  onLeadCreated?: (newLeadId: number) => void;
  /** Ficha aberta pelo ateliê `/projetos`. */
  contextoProjeto?: boolean;
  /** Projetista-only: esconde contratos e o botão de apagar. */
  modoProjeto?: boolean;
}

const FALLBACK_STATUSES = DEFAULT_PIPELINE_STAGES.map((s) => s.nome);

const LEAD_MODAL_FORM_ID = 'lead-modal-form';

export function LeadModal({
  isOpen,
  onClose,
  leadId,
  isEditMode = true,
  statusOptions,
  statusChangeOnSelect = true,
  allStatusValues,
  newLeadDefaultStatus,
  initialTab = 'detalhes',
  initialIaSubtab = 'visual',
  onLeadDuplicated,
  onLeadCreated,
  contextoProjeto = false,
  modoProjeto = false,
}: LeadModalProps) {
  const isMobile = useIsMobile();
  const { user: authUser, userRole: authUserRole, hasRole, isSuperAdmin: isSuperAdminAuth } = useAuth();
  const { schemaEmpresa, isSuperAdmin: isSuperAdminEmpresa } = useEmpresa();
  const empresaDb = useEmpresaSupabase();
  const table = useTableName();
  const isMasterUser = isSuperAdminAuth || isSuperAdminEmpresa || authUserRole === 'admin';
  const { hasPermission } = usePermissions();
  const { config: vendasGanhosConfig, isLoading: isLoadingVendasGanhosConfig } = useVendasGanhosConfig();
  // Só mutations + cache: não disparar fetch da lista inteira ao abrir o card.
  const { leads: dbLeads, createLead, updateLead: updateLeadMutation, deleteLead: deleteLeadMutation } = useLeads({
    fetchLeads: false,
  });
  const { users: dbUsers, isLoading: isLoadingUsers } = useUsers();
  const { webhooks, isLoading: isLoadingWebhooks } = useWebhooks();
  const { origins, isLoading: isLoadingOrigins } = useLeadOrigins();
  const { activeStages: pipelineStages, isLoading: isLoadingPipelineStages } = usePipelineCustomStages();
  const { regiaoToTabelaMap, regioesDisponiveis, isLoading: isLoadingRegioes } = useRegioes();
  const queryClient = useQueryClient();
  const [showDeleteAlert, setShowDeleteAlert] = useState(false);
  const [showDuplicateAlert, setShowDuplicateAlert] = useState(false);
  const [isDuplicating, setIsDuplicating] = useState(false);
  const [showSaleValueDialog, setShowSaleValueDialog] = useState(false);
  const [showScheduleMeetingDialog, setShowScheduleMeetingDialog] = useState(false);
  const [showLembreteDialog, setShowLembreteDialog] = useState(false);
  const [leadModalTab, setLeadModalTab] = useState('detalhes');
  const lembretesCountMap = useLeadLembretesCountMap();
  const lembretesAbertosCount = leadId ? lembretesCountMap.get(leadId) ?? 0 : 0;
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [initialized, setInitialized] = useState(false);
  const [formDirty, setFormDirty] = useState(false);
  const [editingFields, setEditingFields] = useState<Set<string>>(new Set());
  const [autoSaveState, setAutoSaveState] = useState<'idle' | 'pending' | 'saving' | 'saved' | 'error'>('idle');
  const lastSavedSnapshotRef = useRef<string | null>(null);
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout>>();
  /** Evita auto-save / flush ao fechar depois de excluir o lead (corrida com update). */
  const skipPersistOnCloseRef = useRef(false);
  /** Usuário editou o orçamento à mão — o markup não deve apagar esse valor nesta sessão. */
  const budgetManualOverrideRef = useRef(false);
  const isNewLead = !leadId;
  const [selectedWebhookId, setSelectedWebhookId] = useState<string>('');
  const [isNegativado, setIsNegativado] = useState(false);
  const pdfAttachmentsRef = useRef<LeadPDFAttachmentsHandle>(null);
  const [filePickerActive, setFilePickerActive] = useState(false);
  const syncComissaoLiberacao = useSyncPontuaGarboLiberacaoAposVenda();
  const { data: pontuaGarboSale } = useLeadPontuaGarboSaleInfo(leadId ?? undefined);
  const pontuaGarboPartnerBadge = usePontuaGarboPartnerBadge(leadId ?? undefined);
  const [pontuaGarboLive, setPontuaGarboLive] = useState<LeadPontuaGarboSaleInfo | null>(null);

  useEffect(() => {
    setPontuaGarboLive(null);
  }, [leadId]);

  // Buscar reunião vinculada ao lead
  const { data: leadMeeting, refetch: refetchLeadMeeting } = useLeadMeeting(leadId || undefined);

  // Memoize adapted data to prevent unnecessary re-renders
  const adaptedLeads = useMemo(() => (dbLeads || []).map(adaptLeadFromDatabase), [dbLeads]);
  const adaptedUsers: User[] = useMemo(() => (dbUsers || []).map(adaptUserFromDatabase), [dbUsers]);
  
  const currentUserData = useMemo(() => 
    adaptedUsers.find(u => u.email === authUser?.email),
    [adaptedUsers, authUser?.email]
  );
  const currentUserRole = currentUserData?.role || 'NENHUM';

  const [formData, setFormData] = useState<Partial<Lead>>({
    name: '',
    email: '',
    phone: '',
    origin: 'Formulário',
    vendor: currentUserData?.name || '',
    status: 'Novo Lead',
    dateArrived: getTodaySaoPaulo(),
    dealValue: 0,
    budgetValue: 0,
    company: '',
    observations: '',
  });

  const [budgetDisplay, setBudgetDisplay] = useState('');
  const formDataRef = useRef(formData);
  const formDirtyRef = useRef(formDirty);

  formDataRef.current = formData;
  formDirtyRef.current = formDirty;

  const formatBudgetDisplay = (val: string) => {
    const numbers = val.replace(/\D/g, '');
    if (!numbers) return '';
    const numValue = parseInt(numbers, 10) / 100;
    return numValue.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const parseBudgetValue = (display: string) => {
    const numbers = display.replace(/\D/g, '');
    if (!numbers) return 0;
    return parseInt(numbers, 10) / 100;
  };

  const budgetToDisplay = (value: number) =>
    value > 0
      ? value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
      : '';

  /**
   * Sincroniza o campo Orçamentos a partir do markup.
   * @returns false quando o usuário editou o valor à mão e o sync automático deve ser ignorado.
   */
  const handleMarkupOrcamentoSync = useCallback(
    (valor: number, options?: { force?: boolean }): boolean => {
      if (options?.force) {
        budgetManualOverrideRef.current = false;
      } else {
        // Edição manual nesta sessão, ou lead já tem orçamento diferente do markup.
        if (budgetManualOverrideRef.current) return false;
        const atual = Number(formDataRef.current.budgetValue ?? 0);
        if (atual > 0 && Math.abs(atual - valor) >= 0.005) return false;
      }

      let mudou = false;
      setFormData((prev) => {
        if (Math.abs((prev.budgetValue ?? 0) - valor) < 0.005) return prev;
        mudou = true;
        return { ...prev, budgetValue: valor };
      });
      if (!mudou) return true;
      // Evita o efeito de hidratação sobrescrever com valor_orcamento antigo do lead.
      setFormDirty(true);
      setBudgetDisplay(
        valor > 0
          ? valor.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
          : '',
      );
      return true;
    },
    [],
  );

  const usesKanbanPageStatuses = Boolean(statusOptions && statusOptions.length > 0);

  const resolvedNewLeadDefaultStatus = useMemo(() => {
    if (newLeadDefaultStatus?.trim()) return newLeadDefaultStatus.trim();
    if (statusOptions?.[0]?.value) return statusOptions[0].value;
    const inbox = getPipelineInboxStageName(
      pipelineStages.length > 0
        ? pipelineStages.map((s) => s.nome)
        : FALLBACK_STATUSES,
    );
    return inbox;
  }, [newLeadDefaultStatus, statusOptions, pipelineStages]);

  const statusSelectGroups = useMemo(() => {
    if (!usesKanbanPageStatuses || !statusOptions?.length) return null;
    if (!statusOptions.some((opt) => opt.group)) return null;
    return groupLeadModalStatusOptions(statusOptions);
  }, [usesKanbanPageStatuses, statusOptions]);

  const statusDisplayInfo = useMemo(
    () => resolveLeadStatusDisplay(formData.status, statusOptions),
    [formData.status, statusOptions],
  );

  /** Fallback quando não há statusOptions (só lista de nomes do pipeline). */
  const statusDisplayFallback = useMemo(() => {
    if (statusOptions?.length) return statusDisplayInfo;
    const value = formData.status?.trim() || '';
    if (!value) return statusDisplayInfo;
    return {
      value,
      columnLabel: value,
      pageLabel: 'Pipeline principal',
    };
  }, [statusOptions, statusDisplayInfo, formData.status]);

  /** Pipeline padrão ou colunas da página Kanban configurável (ex.: Orçamentos) */
  const STATUSES = useMemo<string[]>(() => {
    if (usesKanbanPageStatuses && statusOptions) {
      const values = statusOptions.map((opt) => opt.value);
      const current = formData.status?.trim();
      if (current && !values.includes(current)) {
        return [...values, current];
      }
      return values;
    }
    const baseNames =
      allStatusValues && allStatusValues.length > 0
        ? allStatusValues
        : pipelineStages.length > 0
          ? pipelineStages.map((stage) => stage.nome)
          : [...FALLBACK_STATUSES];
    const names = [...new Set(baseNames)];
    const current = formData.status?.trim();
    if (current && !names.includes(current)) {
      return [...names, current];
    }
    return names;
  }, [usesKanbanPageStatuses, statusOptions, pipelineStages, formData.status, allStatusValues]);

  const isConfiguredPipelineStatus = (status: string) => STATUSES.includes(status);

  const { data: leadDetail, isError: leadDetailError, isLoading: isLoadingLeadDetail } = useLeadDetail(
    isOpen && leadId ? leadId : null,
  );

  const dbLead = leadDetail ?? (leadId && dbLeads ? dbLeads.find((l) => l.id === leadId) : null) ?? null;
  const dbLeadRef = useRef(dbLead);
  dbLeadRef.current = dbLead;

  const leadFromList = useMemo(
    () => (leadId ? adaptedLeads.find((l) => l.id === leadId) : null),
    [adaptedLeads, leadId]
  );

  const lead = useMemo(() => {
    if (leadFromList) return leadFromList;
    if (dbLead) return adaptLeadFromDatabase(dbLead);
    return null;
  }, [leadFromList, dbLead]);

  const canEditLead =
    isMasterUser ||
    hasRole('admin') ||
    hasRole('vendedor') ||
    hasRole('projetista') ||
    hasRole('projetista_admin') ||
    currentUserRole === 'ADMIN' ||
    currentUserRole === 'VENDEDOR' ||
    currentUserRole === 'PROJETISTA' ||
    currentUserRole === 'PROJETISTA_ADMIN';

  const isEditable = !leadId || (isEditMode && canEditLead);

  /** Na página Leads em modo visualização: só exibe o status, sem select que grava no banco. */
  const showStatusAsReadOnly =
    Boolean(leadId) && !statusChangeOnSelect && !isEditable;

  const canManageCustomFields = currentUserRole === 'ADMIN' || isMasterUser;
  /** Vendedor/admin controlam o que o prestador vê, mesmo se o restante do card estiver só leitura. */
  const canManagePrestadorVisibilidade = canEditLead;

  // Troca de lead com modal aberto → permite nova hidratação (sem apagar por refetch)
  const prevLeadIdRef = useRef(leadId);
  useEffect(() => {
    if (prevLeadIdRef.current === leadId) return;
    prevLeadIdRef.current = leadId;
    if (!isOpen) return;
    setInitialized(false);
    setFormDirty(false);
    setEditingFields(new Set());
    lastSavedSnapshotRef.current = null;
    budgetManualOverrideRef.current = false;
  }, [leadId, isOpen]);

  // Hidrata o formulário só ao abrir / mudar lead — não a cada novo objeto do cache
  useEffect(() => {
    if (!isOpen) {
      setInitialized(false);
      setFormDirty(false);
      setEditingFields(new Set());
      setSelectedWebhookId('');
      setAutoSaveState('idle');
      setLeadModalTab('detalhes');
      lastSavedSnapshotRef.current = null;
      budgetManualOverrideRef.current = false;
      skipPersistOnCloseRef.current = false;
      if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
      setFormData({
        name: '',
        email: '',
        phone: '',
        origin: 'Formulário',
        vendor: '',
        status: resolvedNewLeadDefaultStatus,
        dateArrived: getTodaySaoPaulo(),
        dealValue: 0,
        budgetValue: 0,
        company: '',
        observations: '',
      });
      setBudgetDisplay('');
      return;
    }

    if (leadId && initialTab === 'analise-ia') {
      setLeadModalTab('analise-ia');
    }

    if (initialized) return;

    if (lead && dbLead) {
      const vendorName = dbLead.vendedor?.nome || lead.vendor || '';
      budgetManualOverrideRef.current = false;
      setFormData({
        ...lead,
        vendor: vendorName,
        observations: lead.observations || '',
        budgetValue: lead.budgetValue ?? 0,
      });
      setBudgetDisplay(budgetToDisplay(lead.budgetValue ?? 0));
      setInitialized(true);
    } else if (!leadId) {
      budgetManualOverrideRef.current = false;
      setFormData({
        name: '',
        email: '',
        phone: '',
        origin: 'Formulário',
        vendor: currentUserData?.name || '',
        status: resolvedNewLeadDefaultStatus,
        dateArrived: getTodaySaoPaulo(),
        dealValue: 0,
        budgetValue: 0,
        company: '',
        observations: '',
      });
      setBudgetDisplay('');
      setInitialized(true);
    }
  }, [isOpen, initialized, leadId, lead, dbLead, currentUserData?.name, resolvedNewLeadDefaultStatus, initialTab]);

  useEffect(() => {
    if (!isOpen || !leadId) return;
    if (initialTab === 'analise-ia') {
      setLeadModalTab('analise-ia');
    }
  }, [isOpen, leadId, initialTab]);

  const markFormDirty = () => {
    formDirtyRef.current = true;
    if (!formDirty) setFormDirty(true);
  };

  /** Preenche nome + contato a partir de um lead já cadastrado (autocomplete do campo Nome). */
  const handleSelectLeadContact = useCallback((suggestion: LeadContactSuggestion) => {
    formDirtyRef.current = true;
    setFormDirty(true);
    setFormData((prev) => ({
      ...prev,
      name: suggestion.name,
      email: suggestion.email,
      phone: formatInternationalPhone(suggestion.phone),
      company: suggestion.company ?? prev.company ?? '',
    }));
    // Em lead existente, abre email/telefone/empresa para o usuário ver o preenchimento.
    if (!isNewLead) {
      setEditingFields((prev) => {
        const next = new Set(prev);
        next.add('name');
        next.add('email');
        next.add('phone');
        if (suggestion.company) next.add('company');
        return next;
      });
    }
    toast.success('Dados de contato preenchidos', {
      description: suggestion.email || suggestion.phone
        ? [suggestion.phone, suggestion.email].filter(Boolean).join(' · ')
        : 'Lead encontrado — complete o que faltar',
    });
  }, [isNewLead]);

  const isFieldEditing = (fieldId: string) => isNewLead || editingFields.has(fieldId);

  const savedPhone = dbLead?.telefone?.trim() ?? '';
  const draftPhone = formData.phone?.trim() ?? '';
  const isEditingPhone = isFieldEditing('phone');

  /** Histórico WhatsApp usa o número já salvo enquanto o telefone está em edição (evita refetch + scroll a cada tecla). */
  const whatsappTelefone = useMemo(() => {
    if (isNewLead) return draftPhone;
    if (!isEditingPhone) return draftPhone || savedPhone;
    return savedPhone || draftPhone;
  }, [isNewLead, isEditingPhone, draftPhone, savedPhone]);

  const showSaveButton = isNewLead;

  const autoSaveEnabled = Boolean(leadId && isEditable && isEditMode && initialized && dbLead);

  const buildFormSnapshot = useCallback(
    (data: Partial<Lead>, leadRow: NonNullable<typeof dbLead>) => {
      const vendorId = resolveVendorUserIdFromForm(
        data.vendor,
        dbUsers,
        leadRow.vendedor_responsavel_id ?? null,
      );
      return JSON.stringify({
        name: data.name ?? '',
        email: data.email ?? '',
        phone: data.phone ?? '',
        company: data.company ?? '',
        origin: data.origin ?? '',
        regiao: data.regiao ?? null,
        vendor: data.vendor ?? '',
        vendorId,
        status: data.status ?? '',
        budgetValue: data.budgetValue ?? 0,
        lossReason: data.lossReason ?? '',
        observations: data.observations ?? '',
      });
    },
    [dbUsers],
  );

  const getFormSnapshot = useCallback(() => {
    if (!dbLead) return '';
    return buildFormSnapshot(formData, dbLead);
  }, [buildFormSnapshot, dbLead, formData]);

  /** Grava alterações pendentes imediatamente (usado no debounce, ao fechar campo e ao fechar o card). */
  const persistLeadChanges = useCallback(async (): Promise<boolean> => {
    const currentLead = dbLeadRef.current;
    const currentForm = formDataRef.current;
    if (skipPersistOnCloseRef.current) return false;
    if (!leadId || !currentLead || !autoSaveEnabled || isSubmitting) return false;

    const vendorUserId = resolveVendorUserIdFromForm(
      currentForm.vendor,
      dbUsers,
      currentLead.vendedor_responsavel_id ?? null,
    );
    const updates = buildChangedLeadUpdates(currentForm, currentLead, {
      regiaoToTabelaMap,
      vendorUserId,
      includeStatus: !statusChangeOnSelect,
    });

    if (!updates) {
      setFormDirty(false);
      setAutoSaveState('idle');
      return true;
    }

    const snapshot = buildFormSnapshot(currentForm, currentLead);
    if (snapshot === lastSavedSnapshotRef.current) {
      setFormDirty(false);
      setAutoSaveState('idle');
      return true;
    }

    setAutoSaveState('saving');
    try {
      const saved = await updateLeadMutation.mutateAsync({
        id: leadId,
        updates,
        silent: true,
      });
      if (saved) {
        setLeadDetailCache(queryClient, saved, schemaEmpresa);
      }
      lastSavedSnapshotRef.current = snapshot;
      setFormDirty(false);
      setAutoSaveState('saved');
      window.setTimeout(() => setAutoSaveState('idle'), 2000);
      return true;
    } catch {
      setAutoSaveState('error');
      return false;
    }
  }, [
    autoSaveEnabled,
    buildFormSnapshot,
    dbUsers,
    isSubmitting,
    leadId,
    queryClient,
    regiaoToTabelaMap,
    schemaEmpresa,
    statusChangeOnSelect,
    updateLeadMutation,
  ]);

  const flushAutoSave = useCallback(async () => {
    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
      autoSaveTimerRef.current = undefined;
    }
    if (!formDirtyRef.current || !autoSaveEnabled) return;
    await persistLeadChanges();
  }, [autoSaveEnabled, persistLeadChanges]);

  const toggleFieldEdit = (fieldId: string) => {
    let closing = false;
    setEditingFields((prev) => {
      const next = new Set(prev);
      if (next.has(fieldId)) {
        next.delete(fieldId);
        closing = true;
      } else {
        next.add(fieldId);
      }
      return next;
    });
    // Ao fechar o lápis, grava na hora — evita perder o orçamento se o card fechar em seguida.
    if (closing && formDirtyRef.current) {
      void flushAutoSave();
    }
  };

  const requestClose = useCallback(() => {
    // Dispara o save com os refs atuais e fecha na hora — evita overlay preso
    // (Radix tenta fechar enquanto isOpen ainda está true durante o await).
    if (!skipPersistOnCloseRef.current) {
      void flushAutoSave();
    }
    onClose();
  }, [flushAutoSave, onClose]);

  useEffect(() => {
    if (!initialized || !leadId || !dbLead) return;
    if (lastSavedSnapshotRef.current !== null) return;
    lastSavedSnapshotRef.current = getFormSnapshot();
  }, [initialized, leadId, dbLead, getFormSnapshot]);

  useEffect(() => {
    if (!autoSaveEnabled || !dbLeadRef.current || isSubmitting || !formDirty) return;

    setAutoSaveState((s) => (s === 'saving' ? s : 'pending'));
    if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);

    autoSaveTimerRef.current = setTimeout(() => {
      void persistLeadChanges();
    }, 700);

    return () => {
      if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    };
  }, [
    autoSaveEnabled,
    formData,
    formDirty,
    isSubmitting,
    persistLeadChanges,
  ]);

  useEffect(() => {
    if (!leadDetailError || !isOpen || !leadId) return;
    toast.error('Não foi possível carregar este lead.', {
      description: 'Verifique permissões ou se o lead ainda existe.',
    });
    onClose();
  }, [leadDetailError, isOpen, leadId, onClose]);

  // Histórico WhatsApp: só atualiza quando o número exibido no card muda (não a cada tecla no input).
  useEffect(() => {
    if (!isOpen || !leadId || !whatsappTelefone) return;
    const t = window.setTimeout(() => {
      queryClient.invalidateQueries({
        queryKey: ['lead-whatsapp-history', whatsappTelefone],
      });
      queryClient.refetchQueries({
        queryKey: ['lead-whatsapp-history', whatsappTelefone],
        type: 'active',
      });
    }, 450);
    return () => clearTimeout(t);
  }, [isOpen, leadId, whatsappTelefone, queryClient]);

  // Verificar se o número está negativado
  useEffect(() => {
    const checkNegativado = async () => {
      if (!isOpen || !formData.phone) {
        setIsNegativado(false);
        return;
      }

      try {
        const { data, error } = await supabase
          .from('CRM-multi-empresas>negativacao_numeros<')
          .select('id')
          .eq('numeroTelefone', parseInt(formData.phone.trim()))
          .maybeSingle();

        if (error) {
          console.error('Erro ao verificar negativação:', error);
          return;
        }

        setIsNegativado(!!data);
      } catch (err) {
        console.error('Erro ao verificar negativação:', err);
      }
    };

    checkNegativado();
  }, [isOpen, formData.phone]);

  // Get vendor users directly from dbUsers with unique keys
  const vendorUsers = useMemo(() => 
    (dbUsers || []).filter(u => u.role === 'admin' || u.role === 'vendedor'),
    [dbUsers]
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validar dados antes de enviar
    const validation = leadSchema.safeParse({
      name: formData.name,
      email: formData.email || '',
      phone: formData.phone,
      company: formData.company,
      lossReason: formData.lossReason,
      observations: formData.observations
    });
    
    if (!validation.success) {
      toast.error(validation.error.errors[0].message);
      return;
    }

    if (!formData.status || !isConfiguredPipelineStatus(formData.status)) {
      toast.error('Selecione uma coluna válida do Pipeline');
      return;
    }

    setIsSubmitting(true);

    try {
      if (leadId) {
        const vendorDbUser = dbUsers?.find((u) => u.nome === formData.vendor);
        const saved = await updateLeadMutation.mutateAsync({
          id: leadId,
          updates: {
            nome: formData.name!,
            email: formData.email || null,
            telefone: formatInternationalPhone(formData.phone || '') || null,
            empresa: formData.company || null,
            origem: formData.origin || null,
            status: formData.status!,
            valor_negocio: formData.dealValue || 0,
            valor_orcamento: formData.budgetValue || 0,
            vendedor_responsavel_id:
              vendorDbUser?.id || dbLead?.vendedor_responsavel_id || authUser?.id || null,
            motivo_perda: formData.lossReason || null,
            observacoes: formData.observations || null,
            regiao: formData.regiao || null,
            regiao_tabela: formData.regiao ? (regiaoToTabelaMap[formData.regiao] || null) : null,
          },
        });
        if (saved) {
          setLeadDetailCache(queryClient, saved, schemaEmpresa);
        }
        setFormDirty(false);
        setEditingFields(new Set());

        if (pdfAttachmentsRef.current?.hasPendingPdfs) {
          await pdfAttachmentsRef.current.flushPendingPdfs(leadId);
        }
      } else {
        const vendorDbUser = formData.vendor ? dbUsers?.find(u => u.nome === formData.vendor) : null;
        
        const newLead = await createLead.mutateAsync({
          nome: formData.name!,
          email: formData.email || null,
          telefone: formatInternationalPhone(formData.phone || '') || null,
          empresa: formData.company || null,
          origem: formData.origin || null,
          status: formData.status!,
          valor_negocio: formData.dealValue || 0,
          valor_orcamento: formData.budgetValue || 0,
          data_chegada: formData.dateArrived || getTodaySaoPaulo(),
          vendedor_responsavel_id: vendorDbUser?.id || null,
          motivo_perda: null,
          observacoes: formData.observations || null,
          regiao: formData.regiao || null,
          regiao_tabela: formData.regiao ? (regiaoToTabelaMap[formData.regiao] || null) : null,
          silent: true,
        });

        // Se selecionou webhook e tem telefone, cria contato vinculado
        if (selectedWebhookId && formData.phone && newLead?.id) {
          const chatConfig = resolveChatContatosQueryConfig(schemaEmpresa);
          const { error: contatoError } = await empresaDb
            .from(chatConfig.contatosTable)
            .insert({
              lead_id: newLead.id,
              webhook_id: selectedWebhookId,
              telefone: formatInternationalPhone(formData.phone),
              nome: formData.name || null,
            });
          if (contatoError) {
            console.error('Erro ao vincular contato do chat ao lead:', contatoError);
            toast.error('Lead criado, mas o contato do WhatsApp não foi vinculado', {
              description: contatoError.message,
            });
          }
        }

        if (newLead?.id && pdfAttachmentsRef.current?.hasPendingPdfs) {
          await pdfAttachmentsRef.current.flushPendingPdfs(newLead.id);
        }

        if (newLead?.id) {
          const cachedLead: LeadWithVendor = {
            ...newLead,
            vendedor: vendorDbUser
              ? {
                  id: vendorDbUser.id,
                  nome: vendorDbUser.nome,
                  email: vendorDbUser.email ?? null,
                }
              : undefined,
          };
          setLeadDetailCache(queryClient, cachedLead, schemaEmpresa);
          setFormDirty(false);
          setEditingFields(new Set());

          const keepCardOpen = onLeadCreated ?? onLeadDuplicated;
          if (keepCardOpen) {
            toast.success('Lead criado', {
              description: 'O card permanece aberto para marcar tarefas e usar os recursos.',
            });
            keepCardOpen(newLead.id);
            return;
          }
        }
      }

      onClose();
    } catch (error) {
      console.error('Erro ao salvar lead:', error);
      // Toast já exibido pelas mutations; garante feedback se algo escapar
      if (error instanceof Error && error.message) {
        toast.error('Não foi possível salvar o lead', { description: error.message });
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCopyPhone = async () => {
    const digits = formData.phone?.replace(/\D/g, '') ?? '';
    if (!digits) {
      toast.error('Nenhum número para copiar');
      return;
    }
    try {
      await navigator.clipboard.writeText(digits);
      toast.success('Número copiado!');
    } catch {
      toast.error('Não foi possível copiar o número');
    }
  };

  const handleShareLead = () => {
    if (!leadId) {
      toast.error('Lead não encontrado');
      return;
    }
    
    // Construir URL compartilhável
    const baseUrl = window.location.origin;
    const shareUrl = `${baseUrl}/leads?id=${leadId}`;
    
    // Copiar para clipboard
    navigator.clipboard.writeText(shareUrl).then(() => {
      toast.success('Link copiado! Compartilhe com outros usuários do sistema.', {
        description: shareUrl,
      });
    }).catch(() => {
      toast.error('Não foi possível copiar o link');
    });
  };

  /** Cria um novo lead com os mesmos dados do card atual e abre a cópia. */
  const handleDuplicateLead = async () => {
    if (!leadId) {
      toast.error('Salve o lead antes de duplicar');
      return;
    }
    if (!isEditable) {
      toast.error('Sem permissão para duplicar este lead');
      return;
    }

    const parsed = leadSchema.safeParse({
      name: formData.name ?? '',
      email: formData.email ?? '',
      phone: formData.phone ?? '',
      company: formData.company ?? '',
      lossReason: formData.lossReason ?? '',
      observations: formData.observations ?? '',
    });
    if (!parsed.success) {
      toast.error('Complete nome e telefone válidos antes de duplicar', {
        description: parsed.error.errors[0]?.message,
      });
      setShowDuplicateAlert(false);
      return;
    }

    setIsDuplicating(true);
    try {
      // Garante que edições recentes já estejam no banco antes de copiar.
      await flushAutoSave();

      const vendorDbUser = formData.vendor
        ? dbUsers?.find((u) => u.nome === formData.vendor)
        : null;

      const newLead = await createLead.mutateAsync({
        nome: formData.name!,
        email: formData.email || null,
        telefone: formatInternationalPhone(formData.phone || '') || null,
        empresa: formData.company || null,
        origem: formData.origin || null,
        status: formData.status || resolvedNewLeadDefaultStatus || 'Novo Lead',
        valor_negocio: formData.dealValue || 0,
        valor_orcamento: formData.budgetValue || 0,
        data_chegada: getTodaySaoPaulo(),
        vendedor_responsavel_id:
          vendorDbUser?.id || dbLead?.vendedor_responsavel_id || authUser?.id || null,
        motivo_perda: null,
        observacoes: formData.observations || null,
        regiao: formData.regiao || null,
        regiao_tabela: formData.regiao
          ? regiaoToTabelaMap[formData.regiao] || null
          : null,
      });

      if (!newLead?.id) {
        throw new Error('Lead duplicado sem ID retornado');
      }

      // Copia campos personalizados (ex.: Pontua Garbo) para o novo card.
      const valsTable = table(
        'lead_custom_field_values',
        'CRM-multi-empresas>lead_custom_field_values<',
      );
      const { data: customValues, error: customReadError } = await empresaDb
        .from(valsTable)
        .select('field_id, valor, pontua_garbo_percentual')
        .eq('lead_id', leadId);

      if (customReadError) {
        console.error('Erro ao ler campos personalizados para duplicar:', customReadError);
      } else if (customValues && customValues.length > 0) {
        const rows = customValues.map((row) => ({
          lead_id: newLead.id,
          field_id: row.field_id,
          valor: row.valor,
          pontua_garbo_percentual: row.pontua_garbo_percentual,
        }));
        const { error: customWriteError } = await empresaDb.from(valsTable).insert(rows);
        if (customWriteError) {
          console.error('Erro ao copiar campos personalizados:', customWriteError);
          toast.error('Lead duplicado, mas campos personalizados não foram copiados', {
            description: customWriteError.message,
          });
        }
      }

      setShowDuplicateAlert(false);
      toast.success('Lead duplicado', {
        description: 'Abrindo a cópia com os mesmos dados de contato e negócio.',
      });

      if (onLeadDuplicated) {
        onLeadDuplicated(newLead.id);
      } else {
        // Fallback: fecha o card atual (pai sem callback).
        onClose();
      }
    } catch (error) {
      console.error('Erro ao duplicar lead:', error);
      if (error instanceof Error && error.message) {
        toast.error('Não foi possível duplicar o lead', { description: error.message });
      }
    } finally {
      setIsDuplicating(false);
    }
  };

  const handleMarkAsWon = () => {
    setShowSaleValueDialog(true);
  };

  const handleConfirmSale = async (value: number) => {
    if (leadId) {
      const statusDestino = vendasGanhosConfig.statusDestinoAoGanhar?.trim();
      if (isLoadingVendasGanhosConfig) {
        toast.error('Aguarde: carregando configuração de Negócios Ganhos…');
        return;
      }
      if (!statusDestino) {
        toast.error('Configure a coluna destino em Negócios Ganhos antes de registrar a venda.');
        return;
      }

      setIsSubmitting(true);
      try {
        const vendorId = dbLead?.vendedor_responsavel_id || authUser?.id;
        
        await updateLeadMutation.mutateAsync({
          id: leadId,
          updates: buildMarkAsWonUpdates(value, statusDestino, vendorId ?? authUser?.id ?? ''),
        });
        await syncComissaoLiberacao.mutateAsync(leadId);
        void queryClient.invalidateQueries({ queryKey: ['minha-pontua-garbo'] });
        void queryClient.invalidateQueries({ queryKey: ['pontua-garbo-financeiro'] });
        void queryClient.invalidateQueries({ queryKey: ['pontua-garbo-comissao-liberacao'] });
        setShowSaleValueDialog(false);
        onClose();
      } finally {
        setIsSubmitting(false);
      }
    }
  };

  const handleMarkAsLost = async () => {
    if (leadId) {
      setIsSubmitting(true);
      try {
        const vendorId = dbLead?.vendedor_responsavel_id || authUser?.id;
        
        await updateLeadMutation.mutateAsync({
          id: leadId,
          updates: { 
            status: 'Venda Perdida (Não Matriculado)',
            motivo_perda: formData.lossReason || null,
            vendedor_responsavel_id: vendorId
          }
        });
        onClose();
      } finally {
        setIsSubmitting(false);
      }
    }
  };

  const handleDelete = async () => {
    if (!leadId) return;

    // Cancela salvamento pendente — senão o auto-save tenta UPDATE num lead já apagado.
    skipPersistOnCloseRef.current = true;
    setFormDirty(false);
    formDirtyRef.current = false;
    setAutoSaveState('idle');
    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
      autoSaveTimerRef.current = undefined;
    }

    setIsSubmitting(true);
    try {
      await deleteLeadMutation.mutateAsync(leadId);
      setShowDeleteAlert(false);
      onClose();
    } catch {
      // Se a exclusão falhar, volta a permitir auto-save no card.
      skipPersistOnCloseRef.current = false;
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open && filePickerActive) return;
        if (!open) requestClose();
      }}
    >
      <DialogContent
        data-lead-card=""
        className="lead-modal-shell max-w-2xl w-full flex flex-col overflow-hidden p-0 gap-0 rounded-none sm:rounded-xl border-gold-border-subtle/30 shadow-2xl shadow-black/40 [&>button.absolute]:hidden"
        onOpenAutoFocus={(e) => {
          const body = document.querySelector<HTMLElement>('[data-lead-modal-scroll="true"]');
          if (!body) return;
          e.preventDefault();
          body.focus({ preventScroll: true });
        }}
        onPointerDownOutside={(e) => {
          if (shouldPreventDialogOutsideClose(e, { filePickerActive })) e.preventDefault();
        }}
        onInteractOutside={(e) => {
          if (shouldPreventDialogOutsideClose(e, { filePickerActive })) e.preventDefault();
        }}
        onFocusOutside={(e) => {
          if (shouldPreventDialogOutsideClose(e, { filePickerActive })) e.preventDefault();
        }}
        onEscapeKeyDown={(e) => {
          if (
            typeof document !== 'undefined' &&
            (document.documentElement.hasAttribute(AMBIENTE_FULLSCREEN_ATTR) ||
              document.documentElement.hasAttribute(ENVIAR_PROJETO_DIALOG_OPEN_ATTR))
          ) {
            e.preventDefault();
          }
        }}
      >
        <DialogHeader className="lead-modal-header relative z-[1] shrink-0 overflow-hidden border-b border-[color:var(--lead-line)] px-0 pt-0 pb-0 text-left">
          <LeadModalHeaderAura />
          <div className="pointer-events-none absolute inset-x-0 top-0 z-[1] h-px bg-gradient-to-r from-transparent via-gold/55 to-transparent" />
          <div className="relative z-[2]">
            {hasPermission('lead_vendor', 'view') && (
              <LeadVendorBanner
                vendor={formData.vendor}
                variant="header"
                canEdit={
                  Boolean(leadId) &&
                  isEditable &&
                  (isMasterUser || hasPermission('lead_vendor', 'edit'))
                }
                vendors={vendorUsers.map((u) => ({ id: u.id, nome: u.nome }))}
                isLoadingVendors={isLoadingUsers}
                isSaving={false}
                onVendorChange={
                  leadId && isEditable
                    ? (vendorName) => {
                        const nextForm = {
                          ...formDataRef.current,
                          vendor: vendorName ?? '',
                        };
                        formDataRef.current = nextForm;
                        markFormDirty();
                        setFormData(nextForm);
                        void flushAutoSave();
                      }
                    : undefined
                }
              />
            )}
            <div className="flex items-start justify-between gap-3 px-3 sm:px-4 pt-2.5 sm:pt-3 pb-3">
              <div className="min-w-0 flex-1">
                <DialogTitle className="lead-modal-title font-serif text-[1.35rem] sm:text-[1.7rem] font-semibold leading-snug tracking-tight line-clamp-2 pr-1">
                  <span className="inline-flex max-w-full items-start gap-2">
                    {pontuaGarboPartnerBadge && (
                      <Star className="mt-1 h-4 w-4 sm:h-5 sm:w-5 shrink-0 fill-gold text-gold drop-shadow-[0_0_8px_rgba(242,216,146,0.75)]" aria-hidden />
                    )}
                    <span className="min-w-0">
                      {leadId ? (formData.name || 'Detalhes do Lead') : 'Novo Lead'}
                    </span>
                  </span>
                </DialogTitle>
                {pontuaGarboPartnerBadge && (
                  <div className="mt-2">
                    <LeadPontuaGarboPartnerBadge badge={pontuaGarboPartnerBadge} variant="inline" />
                  </div>
                )}
                {leadId && formData.status && (
                  <div className="lead-modal-stage mt-2 inline-flex max-w-full flex-col gap-0.5 rounded-md border px-2 py-1">
                    {statusDisplayFallback.pageLabel && (
                      <span className="truncate text-[9px] font-semibold uppercase tracking-[0.14em] text-[#f2d892]/75">
                        {statusDisplayFallback.pageLabel}
                      </span>
                    )}
                    <span className="truncate text-[11px] font-medium text-[#f2d892]">
                      {statusDisplayFallback.columnLabel}
                    </span>
                  </div>
                )}
                {autoSaveEnabled && autoSaveState !== 'idle' && (
                  <p
                    className={cn(
                      'text-[11px] mt-1.5',
                      autoSaveState === 'error' && 'text-destructive',
                      autoSaveState === 'saved' && 'text-[#8fc9a8]',
                      (autoSaveState === 'pending' || autoSaveState === 'saving') &&
                        'text-[#d4bc9f]',
                    )}
                  >
                    {autoSaveState === 'pending' && 'Preparando salvamento...'}
                    {autoSaveState === 'saving' && 'Salvando automaticamente...'}
                    {autoSaveState === 'saved' && 'Alterações salvas'}
                    {autoSaveState === 'error' && 'Não foi possível salvar. Tente de novo.'}
                  </p>
                )}
                {autoSaveEnabled && autoSaveState === 'idle' && isEditMode && editingFields.size > 0 && (
                  <p className="text-[11px] text-[#d4bc9f] mt-1.5">
                    Clique no campo para editar — as alterações são salvas automaticamente.
                  </p>
                )}
              </div>
              <DialogDescription className="sr-only">
                {leadId ? 'Formulário para visualizar e editar os dados do lead.' : 'Formulário para cadastrar um novo lead.'}
              </DialogDescription>
              <div className="flex items-center gap-1 shrink-0 rounded-lg border border-gold-border-subtle/30 bg-[#120c09]/40 p-1">
                {leadId && (
                  <>
                    <LeadLembretesPopover
                      leadId={leadId}
                      leadName={formData.name || 'Lead'}
                    >
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        className={cn(
                          'h-8 w-8 relative border-[#c4a05a]/35 text-[#f2d892] hover:bg-gold/10 bg-transparent',
                          lembretesAbertosCount > 0 && 'ring-2 ring-amber-400/45',
                        )}
                        title={
                          lembretesAbertosCount > 0
                            ? `${lembretesAbertosCount} lembrete(s) em aberto`
                            : 'Ver lembretes deste lead'
                        }
                      >
                        <Bell className="h-4 w-4" />
                        {lembretesAbertosCount > 0 && (
                          <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-0.5 rounded-full bg-destructive text-destructive-foreground text-[9px] font-bold flex items-center justify-center border border-background">
                            {lembretesAbertosCount > 9 ? '9+' : lembretesAbertosCount}
                          </span>
                        )}
                      </Button>
                    </LeadLembretesPopover>
                    {isEditable && (
                      <LeadDuplicateButton
                        iconOnly={isMobile}
                        isLoading={isDuplicating}
                        disabled={isSubmitting || isDuplicating || !initialized}
                        onClick={() => setShowDuplicateAlert(true)}
                      />
                    )}
                    {!isMobile && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={handleShareLead}
                        className="flex h-8 items-center gap-2 border-[#c4a05a]/30 bg-transparent px-2.5 text-[#f2d892] hover:bg-gold/10 hover:text-[#fff6ea]"
                        title="Compartilhar lead com outro usuário"
                      >
                        <Share2 className="h-4 w-4" />
                        <span className="hidden sm:inline">Compartilhar</span>
                      </Button>
                    )}
                  </>
                )}
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="h-8 w-8 shrink-0 border-[#c4a05a]/30 bg-transparent text-[#d4bc9f] shadow-none transition-colors hover:border-destructive/50 hover:bg-destructive/10 hover:text-destructive"
                  title="Fechar card do lead"
                  aria-label="Fechar card do lead"
                  onClick={() => requestClose()}
                >
                  <X className="h-4 w-4" strokeWidth={2.25} />
                </Button>
              </div>
            </div>
          </div>
        </DialogHeader>

        <form
          id={LEAD_MODAL_FORM_ID}
          onSubmit={(e) => {
            e.preventDefault();
            if (isNewLead) void handleSubmit(e);
          }}
          className="relative z-[1] flex-1 min-h-0 flex flex-col"
        >
          {leadId && (
            <Tabs
              value={leadModalTab}
              onValueChange={setLeadModalTab}
              className="lead-modal-chrome relative z-[1] shrink-0 border-b px-3 sm:px-4 py-1.5"
            >
              <TabsList className="grid h-10 w-full max-w-md grid-cols-2 bg-mahogany-muted/50 p-1 border border-gold-border-subtle/20">
                <TabsTrigger
                  value="detalhes"
              className="flex items-center gap-2 text-cream-muted data-[state=active]:bg-gold/20 data-[state=active]:text-gold data-[state=active]:shadow-sm"
                >
                  <FileText className="h-4 w-4" />
                  Detalhes
                </TabsTrigger>
                <TabsTrigger
                  value="analise-ia"
              className="flex items-center gap-2 text-cream-muted data-[state=active]:bg-gold/20 data-[state=active]:text-gold data-[state=active]:shadow-sm"
                >
                  <Sparkles className="h-4 w-4" />
                  Análise IA
                </TabsTrigger>
              </TabsList>
            </Tabs>
          )}

          {(!leadId || leadModalTab === 'detalhes') && (
            <LeadModalScrollBody>
            <LeadModalSection title="Contato" icon={UserIcon}>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 w-full min-w-0">
            <LeadEditableField
              fieldId="name"
              label="Nome *"
              htmlFor="name"
              isNewLead={isNewLead}
              canView={hasPermission('lead_name', 'view')}
              canEdit={isEditable && hasPermission('lead_name', 'edit')}
              isEditing={isFieldEditing('name')}
              onToggleEdit={toggleFieldEdit}
              displayValue={formData.name || '—'}
              maskedView={
                <div className="min-h-10 flex items-center px-3 border rounded-md bg-muted overflow-hidden">
                  <span className="text-sm text-muted-foreground">•••••</span>
                </div>
              }
            >
              <LeadNameAutocomplete
                id="name"
                value={formData.name || ''}
                excludeLeadId={leadId}
                required
                onChange={(name) => {
                  markFormDirty();
                  setFormData((prev) => ({ ...prev, name }));
                }}
                onSelectLead={handleSelectLeadContact}
              />
            </LeadEditableField>

            <LeadEditableField
              fieldId="email"
              label="Email"
              htmlFor="email"
              isNewLead={isNewLead}
              canView={hasPermission('lead_email', 'view')}
              canEdit={isEditable && hasPermission('lead_email', 'edit')}
              isEditing={isFieldEditing('email')}
              onToggleEdit={toggleFieldEdit}
              displayValue={formData.email || '—'}
              maskedView={
                <div className="min-h-10 flex items-center px-3 border rounded-md bg-muted overflow-hidden">
                  <span className="text-sm text-muted-foreground">•••@•••.com</span>
                </div>
              }
            >
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => {
                  markFormDirty();
                  setFormData((prev) => ({ ...prev, email: e.target.value }));
                }}
                className="w-full max-w-full"
              />
            </LeadEditableField>

            <LeadEditableField
              fieldId="phone"
              label={
                <span className="flex flex-wrap items-center gap-2">
                  Telefone *
                  {isNegativado && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-destructive/10 text-destructive">
                      <Ban className="h-3 w-3" />
                      Número negativado
                    </span>
                  )}
                </span>
              }
              htmlFor="phone"
              isNewLead={isNewLead}
              canView={hasPermission('lead_phone', 'view')}
              canEdit={isEditable && (hasPermission('lead_phone', 'edit') || isMasterUser)}
              isEditing={isFieldEditing('phone')}
              onToggleEdit={toggleFieldEdit}
              displayValue={formData.phone || '—'}
              maskedView={
                <div className="min-h-10 flex items-center px-3 border rounded-md bg-muted overflow-hidden">
                  <span className="text-sm text-muted-foreground">••• •••• ••••</span>
                </div>
              }
              viewActions={
                formData.phone?.replace(/\D/g, '') ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={handleCopyPhone}
                    className="shrink-0"
                    title="Copiar número"
                    aria-label="Copiar número de telefone"
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                ) : undefined
              }
            >
              <div className="flex items-center gap-2 w-full min-w-0">
                <Input
                  id="phone"
                  type="tel"
                  inputMode="numeric"
                  autoComplete="tel"
                  placeholder="553199999999"
                  value={formData.phone}
                  onChange={(e) => {
                    markFormDirty();
                    setFormData((prev) => ({
                      ...prev,
                      phone: formatInternationalPhone(e.target.value),
                    }));
                  }}
                  onPaste={(e) => {
                    e.preventDefault();
                    const input = e.currentTarget;
                    const current = formData.phone ?? '';
                    const start = input.selectionStart ?? current.length;
                    const end = input.selectionEnd ?? current.length;
                    const pasted = formatInternationalPhone(e.clipboardData.getData('text'));
                    markFormDirty();
                    setFormData((prev) => ({
                      ...prev,
                      phone: formatInternationalPhone(
                        `${current.slice(0, start)}${pasted}${current.slice(end)}`,
                      ),
                    }));
                  }}
                  required
                  className="min-w-0 flex-1"
                />
                {formData.phone?.replace(/\D/g, '') && (
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={handleCopyPhone}
                    className="shrink-0"
                    title="Copiar número"
                    aria-label="Copiar número de telefone"
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </LeadEditableField>
                </div>
            <LeadPontuaGarboContactPanel
              leadId={leadId}
              nome={formData.name ?? ''}
              email={formData.email ?? ''}
              telefone={formData.phone ?? ''}
            />
            </LeadModalSection>

            {contextoProjeto && leadId ? (
              <div className="space-y-3">
                <LeadProjetoConclusaoPanel leadId={leadId} />
                <LeadProjetoComposicaoSection
                  leadId={leadId}
                  leadNome={formData.name || ''}
                  onOrcamentoSync={handleMarkupOrcamentoSync}
                />
                <LeadProjetoNotasSection leadId={leadId} />
              </div>
            ) : null}

            {leadId && (
              <div className="space-y-3">
                {!contextoProjeto && <LeadProjetoPanel leadId={leadId} />}
                <LeadSinalizacoesSection leadId={leadId} />
                <LeadLembretesSection
                  leadId={leadId}
                  leadName={formData.name || 'Lead'}
                />
                <LeadFormResponseSection leadId={leadId} readOnly={!isEditable} />
              </div>
            )}

            <LeadModalSection title="Negócio" icon={Building2}>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 w-full min-w-0">

            <LeadEditableField
              fieldId="company"
              label="Empresa"
              htmlFor="company"
              isNewLead={isNewLead}
              canView={hasPermission('lead_company', 'view')}
              canEdit={isEditable && hasPermission('lead_company', 'edit')}
              isEditing={isFieldEditing('company')}
              onToggleEdit={toggleFieldEdit}
              displayValue={formData.company || '—'}
              maskedView={
                <div className="min-h-10 flex items-center px-3 border rounded-md bg-muted overflow-hidden">
                  <span className="text-sm text-muted-foreground">•••</span>
                </div>
              }
            >
              <Input
                id="company"
                value={formData.company || ''}
                onChange={(e) => {
                  markFormDirty();
                  setFormData((prev) => ({ ...prev, company: e.target.value }));
                }}
                className="w-full max-w-full"
              />
            </LeadEditableField>

            <LeadEditableField
              fieldId="origin"
              label="Origem *"
              isNewLead={isNewLead}
              canView={hasPermission('lead_origin', 'view')}
              canEdit={isEditable && hasPermission('lead_origin', 'edit')}
              isEditing={isFieldEditing('origin')}
              onToggleEdit={toggleFieldEdit}
              displayValue={formData.origin || '—'}
              maskedView={
                <div className="min-h-10 flex items-center px-3 border rounded-md bg-muted overflow-hidden">
                  <span className="text-sm text-muted-foreground">•••</span>
                </div>
              }
            >
              {isLoadingOrigins ? (
                <div className="min-h-10 flex items-center px-3 border rounded-md bg-muted overflow-hidden">
                  <span className="text-sm text-muted-foreground">Carregando origens...</span>
                </div>
              ) : (
                <Select
                  value={formData.origin}
                  onValueChange={(v) => {
                    markFormDirty();
                    setFormData((prev) => ({ ...prev, origin: v as LeadOrigin }));
                  }}
                >
                  <SelectTrigger className="w-full min-w-0 max-w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {origins.map((origin) => (
                      <SelectItem key={origin.id} value={origin.nome}>
                        {origin.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </LeadEditableField>

            <LeadEditableField
              fieldId="regiao"
              label="Região"
              isNewLead={isNewLead}
              canView
              canEdit={isEditable}
              isEditing={isFieldEditing('regiao')}
              onToggleEdit={toggleFieldEdit}
              displayValue={formData.regiao || 'Sem região definida'}
            >
              {isLoadingRegioes ? (
                <div className="min-h-10 flex items-center px-3 border rounded-md bg-muted overflow-hidden">
                  <span className="text-sm text-muted-foreground">Carregando regiões...</span>
                </div>
              ) : (
                <Select
                  value={formData.regiao || 'NONE'}
                  onValueChange={(v) => {
                    markFormDirty();
                    setFormData((prev) => ({ ...prev, regiao: v === 'NONE' ? undefined : v }));
                  }}
                >
                  <SelectTrigger className="w-full min-w-0 max-w-full glass-input text-foreground">
                    <SelectValue placeholder="Selecione a região" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="NONE">Sem região definida</SelectItem>
                    {regioesDisponiveis.map((regiao) => (
                      <SelectItem key={regiao} value={regiao}>
                        {regiao}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </LeadEditableField>

            <LeadEditableField
              fieldId="budget"
              label={
                <span className="flex items-center gap-2 normal-case tracking-normal">
                  <FileText className="h-4 w-4" />
                  Orçamentos
                </span>
              }
              htmlFor="budgetValue"
              isNewLead={isNewLead}
              canView
              canEdit={isEditable}
              isEditing={isFieldEditing('budget')}
              onToggleEdit={toggleFieldEdit}
              displayValue={budgetDisplay ? `R$ ${budgetDisplay}` : 'R$ 0,00'}
            >
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">
                  R$
                </span>
                <Input
                  id="budgetValue"
                  value={budgetDisplay}
                  onChange={(e) => {
                    const formatted = formatBudgetDisplay(e.target.value);
                    const nextBudget = parseBudgetValue(formatted);
                    budgetManualOverrideRef.current = true;
                    setBudgetDisplay(formatted);
                    markFormDirty();
                    setFormData((prev) => {
                      const next = { ...prev, budgetValue: nextBudget };
                      formDataRef.current = next;
                      return next;
                    });
                  }}
                  onBlur={() => {
                    if (formDirtyRef.current) void flushAutoSave();
                  }}
                  placeholder="0,00"
                  className="pl-10 w-full max-w-full"
                />
              </div>
              <p className="text-xs text-cream-muted mt-1">
                Aparece no card Orçamentos do Pipeline. O preço final do markup e o investimento de
                orçamentos em slides são sincronizados aqui automaticamente — você ainda pode alterar
                manualmente se precisar.
              </p>
            </LeadEditableField>

            {!leadId && (
              <div className="space-y-2 min-w-0 max-w-full sm:col-span-2">
                <Label htmlFor="webhook" className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-cream-muted">
                  <Webhook className="h-4 w-4" />
                  Fonte de Mensagem
                </Label>
                {isLoadingWebhooks ? (
                  <div className="h-10 flex items-center px-3 border rounded-lg border-gold-border-subtle/20 bg-mahogany-muted/25 overflow-hidden">
                    <span className="text-sm text-cream-muted">Carregando webhooks...</span>
                  </div>
                ) : (
                  <Select
                    value={selectedWebhookId || "NONE"}
                    onValueChange={(v) => setSelectedWebhookId(v === "NONE" ? "" : v)}
                  >
                    <SelectTrigger className="w-full min-w-0 max-w-full">
                      <SelectValue placeholder="Selecione a fonte de mensagem">
                        {selectedWebhookId 
                          ? webhooks.find(w => w.id === selectedWebhookId)?.nome 
                          : "Nenhum (sem envio de mensagem)"}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="NONE">Nenhum (sem envio de mensagem)</SelectItem>
                      {webhooks.filter(w => w.ativo).map(webhook => (
                        <SelectItem key={webhook.id} value={webhook.id}>
                          {webhook.nome}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
            )}

                </div>
            </LeadModalSection>

            <LeadModalSection title="Equipe & status" icon={Users}>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 w-full min-w-0">

            <LeadEditableField
              fieldId="vendor"
              label="Vendedor"
              isNewLead={isNewLead}
              canView={hasPermission('lead_vendor', 'view')}
              canEdit={isEditable && hasPermission('lead_vendor', 'edit')}
              isEditing={isFieldEditing('vendor')}
              onToggleEdit={toggleFieldEdit}
              displayValue={formData.vendor || 'Sem vendedor atribuído'}
              maskedView={
                <div className="min-h-10 flex items-center px-3 border rounded-md bg-muted overflow-hidden">
                  <span className="text-sm text-muted-foreground">•••</span>
                </div>
              }
            >
              {isLoadingUsers ? (
                <div className="min-h-10 flex items-center px-3 border rounded-md bg-muted overflow-hidden">
                  <span className="text-sm text-muted-foreground">Carregando vendedores...</span>
                </div>
              ) : (
                <Select
                  value={formData.vendor || 'NONE'}
                  onValueChange={(v) => {
                    const nextVendor = v === 'NONE' ? '' : v;
                    const nextForm = { ...formDataRef.current, vendor: nextVendor };
                    // Atualiza o ref na hora — o flush não pode esperar o re-render do React.
                    formDataRef.current = nextForm;
                    markFormDirty();
                    setFormData(nextForm);
                    // Select não tem blur confiável — grava na hora, como a coluna do funil.
                    void flushAutoSave();
                  }}
                >
                  <SelectTrigger className="w-full min-w-0 max-w-full">
                    <SelectValue placeholder="Selecione um vendedor" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="NONE">Sem vendedor atribuído</SelectItem>
                    {vendorUsers.map((u) => (
                      <SelectItem key={u.id} value={u.nome}>
                        {u.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </LeadEditableField>

            {showStatusAsReadOnly ? (
              <div className="space-y-1.5 min-w-0 max-w-full sm:col-span-2">
                <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-cream-muted leading-none">
                  Coluna no funil
                </span>
                <div className="min-h-10 rounded-lg border border-gold-border-subtle/20 bg-mahogany-muted/25 px-3 py-2 shadow-inner shadow-black/5">
                  <LeadStatusColumnDisplay info={statusDisplayFallback} />
                </div>
              </div>
            ) : (
              <LeadEditableField
                fieldId="status"
                label="Coluna no funil"
                isNewLead={isNewLead}
                canView={hasPermission('lead_status', 'view')}
                canEdit={!leadId || (hasPermission('lead_status', 'edit') && isEditable)}
                isEditing={isFieldEditing('status')}
                onToggleEdit={toggleFieldEdit}
                className="sm:col-span-2"
                displayValue={<LeadStatusColumnDisplay info={statusDisplayFallback} />}
                maskedView={
                  <div className="min-h-10 flex items-center px-3 border rounded-md bg-muted overflow-hidden">
                    <span className="text-sm text-muted-foreground">•••</span>
                  </div>
                }
              >
                {leadId && (!initialized || isLoadingLeadDetail) ? (
                  <div className="min-h-10 flex items-center px-3 border rounded-md bg-muted overflow-hidden">
                    <span className="text-sm text-muted-foreground">Carregando coluna...</span>
                  </div>
                ) : !usesKanbanPageStatuses && isLoadingPipelineStages ? (
                  <div className="min-h-10 flex items-center px-3 border rounded-md bg-muted overflow-hidden">
                    <span className="text-sm text-muted-foreground">Carregando colunas...</span>
                  </div>
                ) : (
                  <Select
                    value={formData.status || undefined}
                    onValueChange={(newStatus) => {
                      markFormDirty();
                      setFormData((prev) => ({ ...prev, status: newStatus as LeadStatus }));
                      if (statusChangeOnSelect && leadId && initialized) {
                        updateLeadMutation.mutate({
                          id: leadId,
                          updates: { status: newStatus },
                        });
                      }
                    }}
                  >
                    <SelectTrigger
                      className={cn(
                        'h-auto min-h-12 w-full min-w-0 max-w-full py-2',
                        'border-gold-border-subtle/30 bg-mahogany-muted/20',
                        'hover:border-gold-border-subtle/50 focus:ring-gold/30',
                      )}
                    >
                      <SelectValue
                        placeholder={
                          usesKanbanPageStatuses
                            ? 'Escolha a página e a coluna'
                            : 'Escolha a coluna do Pipeline'
                        }
                      >
                        {formData.status ? (
                          <LeadStatusColumnDisplay info={statusDisplayFallback} compact />
                        ) : null}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent className="max-h-[min(24rem,70vh)] min-w-[min(100%,22rem)]">
                      {usesKanbanPageStatuses && statusOptions
                        ? statusSelectGroups
                          ? [...statusSelectGroups.entries()].map(([group, opts]) => (
                              <SelectGroup key={group}>
                                <SelectLabel
                                  className={cn(
                                    'sticky top-0 z-[1] pl-2 pr-2 py-2',
                                    'border-b border-gold-border-subtle/20 bg-mahogany-elevated/95',
                                    'text-[10px] font-semibold uppercase tracking-[0.14em] text-gold/90',
                                  )}
                                >
                                  {group}
                                </SelectLabel>
                                {opts.map((opt, index) => (
                                  <SelectItem
                                    key={`${group}:${opt.value}`}
                                    value={opt.value}
                                    className="py-2 pl-8"
                                  >
                                    <LeadStatusColumnOptionRow
                                      columnLabel={opt.label}
                                      step={index + 1}
                                    />
                                  </SelectItem>
                                ))}
                              </SelectGroup>
                            ))
                          : statusOptions.map((opt, index) => (
                              <SelectItem key={opt.value} value={opt.value} className="py-2 pl-8">
                                <LeadStatusColumnOptionRow
                                  columnLabel={opt.label}
                                  step={index + 1}
                                />
                              </SelectItem>
                            ))
                        : STATUSES.map((status, index) => (
                            <SelectItem key={status} value={status} className="py-2 pl-8">
                              <LeadStatusColumnOptionRow columnLabel={status} step={index + 1} />
                            </SelectItem>
                          ))}
                    </SelectContent>
                  </Select>
                )}
              </LeadEditableField>
            )}

                </div>
            </LeadModalSection>


          <LeadModalSection title="Observações" icon={StickyNote} className="[&>div:last-child]:pt-3">
          <LeadEditableField
            fieldId="observations"
            label="Notas internas"
            htmlFor="observations"
            isNewLead={isNewLead}
            canView={hasPermission('lead_observations', 'view')}
            canEdit={isEditable && hasPermission('lead_observations', 'edit')}
            isEditing={isFieldEditing('observations')}
            onToggleEdit={toggleFieldEdit}
            multilineView
            viewHeight={180}
            viewMinHeight={120}
            viewMaxHeight={360}
            displayValue={
              formData.observations?.trim() ? formData.observations : '—'
            }
            maskedView={
              <div
                className="flex items-start px-3 py-2 border rounded-md bg-muted overflow-auto resize-y"
                style={{ height: 180, minHeight: 120, maxHeight: 360 }}
              >
                <span className="text-sm text-muted-foreground break-words">•••••</span>
              </div>
            }
            className="w-full"
          >
            <Textarea
              id="observations"
              value={formData.observations || ''}
              onChange={(e) => {
                markFormDirty();
                setFormData((prev) => ({ ...prev, observations: e.target.value }));
              }}
              placeholder="Digite observações sobre este lead..."
              className="h-[180px] min-h-[120px] max-h-[360px] resize-y overflow-y-auto break-words w-full max-w-full"
              maxLength={2000}
            />
            {formData.observations && (
              <p className="text-xs text-muted-foreground text-right mt-1">
                {formData.observations.length}/2000 caracteres
              </p>
            )}
          </LeadEditableField>
          </LeadModalSection>

          <LeadModalSection
            title="Materiais do lead"
            icon={FolderOpen}
            description="Contratos, orçamentos, anexos, WhatsApp e fotos da lousa."
            className="[&>div:last-child]:space-y-4"
          >

          {/* Contratos vinculados */}
          {leadId && !modoProjeto && <LeadContratosSection leadId={leadId} />}

          {/* Orçamentos em slides — no ateliê já sobem no topo */}
          {leadId && !contextoProjeto && <LeadOrcamentoSlidesSection leadId={leadId} />}

          {leadId && !contextoProjeto && (
            <MarkupLeadSection
              leadId={leadId}
              leadNome={formData.name}
              onOrcamentoSync={handleMarkupOrcamentoSync}
              readOnly={authUserRole === 'vendedor'}
            />
          )}


          {/* Anexar PDFs */}
          <LeadPDFAttachments
            ref={pdfAttachmentsRef}
            leadId={leadId}
            leadName={formData.name}
            onFilePickerActiveChange={setFilePickerActive}
          />

          {leadId && (
            <LeadKnowledgeMemoryCard
              leadId={leadId}
              leadRevision={lead?.updatedAt ?? dbLead?.atualizado_em}
              indexingActive={isOpen && !isNewLead}
            />
          )}

          {/* Campos Personalizados */}
          <LeadCustomFieldsSection
            leadId={leadId}
            isEditable={isEditable}
            isAdmin={canManageCustomFields}
            canManagePrestadorVisibilidade={canManagePrestadorVisibilidade}
            budgetValue={formData.budgetValue}
            onPontuaGarboSaleInfoChange={setPontuaGarboLive}
          />

          {/* Histórico de Conversas WhatsApp com Input integrado */}
          {hasPermission('lead_whatsapp_history', 'view') && leadId && whatsappTelefone && (
            <div className="w-full min-w-0 max-w-full">
              <WhatsAppHistoryCard
                telefone={whatsappTelefone}
                leadName={formData.name || 'Lead Sem Nome'}
                vendorName={formData.vendor}
                showInput={hasPermission('send_whatsapp', 'edit')}
              />
            </div>
          )}

          {/* Lousa — carrega sob demanda para não pesar ao abrir o lead */}
          <Suspense
            fallback={
              <div className="flex h-40 items-center justify-center rounded-xl border border-dashed border-border/60 bg-muted/20">
                <p className="text-sm text-muted-foreground">Carregando fotos...</p>
              </div>
            }
          >
            <LeadWhiteboard leadId={leadId} disabled={!isEditable} />
          </Suspense>
          </LeadModalSection>
            </LeadModalScrollBody>
          )}

          {leadId && leadModalTab === 'analise-ia' && (
            <LeadModalScrollBody className="pb-4">
              <LeadAIAnalysisTab
                leadId={leadId}
                leadName={formData.name}
                leadOrigin={formData.origin}
                defaultSubtab={initialIaSubtab}
              />
            </LeadModalScrollBody>
          )}

            <div className="lead-modal-chrome relative z-[1] shrink-0 border-t px-3 sm:px-4 py-3">
            <LeadModalFooter
              formId={LEAD_MODAL_FORM_ID}
              leadId={leadId}
              leadName={formData.name}
              leadStatus={formData.status}
              isEditable={isEditable}
              isSubmitting={isSubmitting || Boolean(leadId && !initialized)}
              currentUserRole={currentUserRole}
              leadMeeting={leadMeeting}
              onClose={requestClose}
              onMarkAsWon={handleMarkAsWon}
              onMarkAsLost={handleMarkAsLost}
              onDelete={() => setShowDeleteAlert(true)}
              onScheduleMeeting={() => setShowScheduleMeetingDialog(true)}
              onLembrete={() => setShowLembreteDialog(true)}
              onShare={handleShareLead}
              isNewLead={isNewLead}
              showSaveButton={showSaveButton}
              hideDelete={modoProjeto}
            />
            </div>
          </form>
      </DialogContent>

      <SaleValueDialog
        isOpen={showSaleValueDialog}
        onClose={() => setShowSaleValueDialog(false)}
        onConfirm={handleConfirmSale}
        leadName={formData.name || ''}
        budgetValue={formData.budgetValue || Number(dbLead?.valor_orcamento ?? 0)}
        pontuaGarbo={pontuaGarboLive ?? pontuaGarboSale ?? null}
      />

      <AlertDialog
        open={showDuplicateAlert}
        onOpenChange={(open) => {
          if (!isDuplicating) setShowDuplicateAlert(open);
        }}
      >
        <AlertDialogContent className="border-gold-border-subtle/30 bg-mahogany-panel">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-display tracking-wide text-gold">
              Duplicar lead
            </AlertDialogTitle>
            <AlertDialogDescription className="text-cream-muted space-y-2">
              <span className="block">
                Criar uma cópia de{' '}
                <span className="font-medium text-cream-secondary">
                  "{formData.name || 'este lead'}"
                </span>
                ?
              </span>
              <span className="block text-xs leading-relaxed">
                Serão copiados nome, e-mail, telefone, empresa, origem, região, status,
                valores, observações, vendedor e campos personalizados. Anexos, contratos,
                lousa e histórico do WhatsApp ficam só no lead original.
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDuplicating}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={isDuplicating}
              onClick={(e) => {
                e.preventDefault();
                void handleDuplicateLead();
              }}
              className="bg-gold text-mahogany-panel hover:bg-gold/90 font-semibold"
            >
              {isDuplicating ? 'Duplicando…' : 'Duplicar agora'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={showDeleteAlert} onOpenChange={setShowDeleteAlert}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Lead</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir o lead "{formData.name}"? 
              Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Dialog para agendar reunião */}
      {leadId && (
        <ScheduleMeetingDialog
          open={showScheduleMeetingDialog}
          onOpenChange={setShowScheduleMeetingDialog}
          leadId={leadId}
          leadName={formData.name || 'Lead'}
          leadPhone={formData.phone || ''}
          onSuccess={() => {
            refetchLeadMeeting();
            queryClient.invalidateQueries({ queryKey: ['leads-meetings'] });
          }}
        />
      )}

      {/* Dialog para criar lembrete de lead */}
      {leadId && (
        <LeadLembreteDialog
          open={showLembreteDialog}
          onOpenChange={setShowLembreteDialog}
          leadId={leadId}
          leadName={formData.name || 'Lead'}
        />
      )}
    </Dialog>
  );
}
