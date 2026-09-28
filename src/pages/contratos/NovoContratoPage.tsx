import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {   Link, useSearchParams } from 'react-router-dom';
import {
  FileText, Eye, CheckCircle2, ChevronRight, ArrowLeft,
  Download, Loader2, AlertCircle, BookOpen, Cloud, Link2, Sparkles, Pencil, Check,
} from 'lucide-react';
import { toast } from 'sonner';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent } from '@/components/ui/card';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  useContratos,
  useContratoPorId,
  useContratoRascunhoPorId,
  podeGerenciarContratos,
} from '@/hooks/useContratos';
import { useContratoRascunhoPorLead } from '@/hooks/useContratosLead';
import { useLeadDetail } from '@/hooks/useLeads';
import { useAuth } from '@/contexts/AuthContext';
import { useContratosModelos } from '@/hooks/useContratosModelo';
import { useContratosVariaveis, type ContratoVariavel } from '@/hooks/useContratosVariaveis';
import { useEmpresa } from '@/contexts/EmpresaContext';
import { useOrcamentosPorLead } from '@/hooks/useOrcamentoSlides';
import { extrairCamposContratoDoOrcamentoLead } from '@/lib/orcamento-contrato-prefill';
import {
  buildAssinaturasCompletas,
  gerarIdentificador,
  imprimirContrato,
  VARIAVEL_CPF_FIXO,
} from '@/lib/contratos-print';
import { ContratoDocumento } from '@/components/contratos/ContratoDocumento';
import { DataBrInput } from '@/components/contratos/DataBrInput';
import { VincularContratoLeadDialog } from '@/components/contratos/VincularContratoLeadDialog';
import { ContratoAnexosSection } from '@/components/contratos/ContratoAnexosSection';
import { ContratoIAAssistPanel } from '@/components/contratos/ContratoIAAssistPanel';
import { LeadOrcamentoSlidesSection } from '@/components/leads/LeadOrcamentoSlidesSection';
import { OrcamentoLeadCardDock } from '@/components/orcamento-slides/OrcamentoLeadCardDock';
import { useContratoAnexos } from '@/hooks/useContratoAnexos';
import { getContratosEmpresaFromContext } from '@/hooks/useContratosEmpresaConfig';
import {
  buildConteudoContrato,
  chaveVariavelNomeCliente,
  deveRestaurarTextoEditado,
  embedMetaCamposValores,
  identificadorRascunho,
  parseRascunhoCampos,
  resolverClienteNome,
  snapshotContratoForm,
  type ContratoEtapaRascunho,
} from '@/lib/contrato-rascunho';
import { filtrarFieldPatches, aplicarEdicoesNoDocumento, type ContratoIAPendingPatch } from '@/lib/contrato-ia';
import { flushSync } from 'react-dom';

type Etapa = 1 | 2 | 3;

const ETAPAS = [
  { num: 1 as Etapa, label: 'Preencher', icon: FileText },
  { num: 2 as Etapa, label: 'Preview',   icon: Eye },
  { num: 3 as Etapa, label: 'Concluído', icon: CheckCircle2 },
];

function formatCPF(value: string): string {
  const d = value.replace(/\D/g, '').slice(0, 11);
  return d
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/(\d{3})\.(\d{3})\.(\d{3})(\d)/, '$1.$2-$3');
}

function CampoInput({
  variavel,
  valor,
  onChange,
}: {
  variavel: ContratoVariavel;
  valor: string;
  onChange: (v: string) => void;
}) {
  if (variavel.tipo === 'cpf') {
    return (
      <Input
        value={valor}
        onChange={(e) => onChange(formatCPF(e.target.value))}
        placeholder="000.000.000-00"
        maxLength={14}
      />
    );
  }
  if (variavel.tipo === 'data') {
    return <DataBrInput value={valor} onChange={onChange} />;
  }
  if (variavel.tipo === 'valor') {
    return (
      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm font-medium">R$</span>
        <Input
          value={valor}
          onChange={(e) => onChange(e.target.value)}
          className="pl-9"
          placeholder="0,00"
        />
      </div>
    );
  }
  return (
    <Input
      value={valor}
      onChange={(e) => onChange(e.target.value)}
      placeholder={`Digite ${variavel.label.toLowerCase()}`}
    />
  );
}

export default function NovoContratoPage() {
  const [searchParams] = useSearchParams();
  const rascunhoParamId = searchParams.get('rascunho');
  const editarParamId = searchParams.get('editar');
  const leadIdParam = searchParams.get('leadId');
  const leadIdVinculo = leadIdParam ? Number(leadIdParam) : null;
  const leadIdValido = Number.isFinite(leadIdVinculo) && (leadIdVinculo as number) > 0
    ? (leadIdVinculo as number)
    : null;
  const { user, userRole, isSuperAdmin } = useAuth();
  const podeGerenciar = podeGerenciarContratos(userRole, isSuperAdmin);
  const { empresa } = useEmpresa();
  const { modelos, modeloAtivo, isLoading: loadingModelo } = useContratosModelos();
  const { variaveis, isLoading: loadingVar } = useContratosVariaveis();
  const {
    criarContrato,
    finalizarContrato,
    atualizarContrato,
    salvarRascunhoContrato,
    rascunhoAtual,
    isLoadingRascunho: isLoadingRascunhoProprio,
  } = useContratos();
  const { data: contratoEditar, isLoading: isLoadingEditar } = useContratoPorId(editarParamId, {
    enabled: !!editarParamId,
  });
  const { data: rascunhoPorId, isLoading: isLoadingRascunhoId } = useContratoRascunhoPorId(
    rascunhoParamId,
    { enabled: !!rascunhoParamId && !editarParamId },
  );
  const { data: rascunhoDoLead, isLoading: isLoadingRascunhoLead } = useContratoRascunhoPorLead(
    !editarParamId && !rascunhoParamId ? leadIdValido : null,
  );
  const [leadIdAposVincular, setLeadIdAposVincular] = useState<number | null>(null);
  const leadIdVinculado = useMemo(() => {
    const bruto =
      leadIdAposVincular ??
      leadIdValido ??
      contratoEditar?.lead_id ??
      rascunhoPorId?.lead_id ??
      rascunhoAtual?.lead_id ??
      null;
    return typeof bruto === 'number' && Number.isFinite(bruto) && bruto > 0 ? bruto : null;
  }, [
    leadIdAposVincular,
    leadIdValido,
    contratoEditar?.lead_id,
    rascunhoPorId?.lead_id,
    rascunhoAtual?.lead_id,
  ]);
  const { data: orcamentosLead = [] } = useOrcamentosPorLead(leadIdVinculado);
  const { data: leadOrigem } = useLeadDetail(leadIdVinculado);
  const camposDoOrcamento = useMemo(
    () => extrairCamposContratoDoOrcamentoLead(orcamentosLead),
    [orcamentosLead],
  );

  const rascunhoRestaurar = editarParamId
    ? contratoEditar?.status === 'rascunho'
      ? contratoEditar
      : null
    : rascunhoParamId
      ? rascunhoPorId
      : leadIdValido && rascunhoDoLead
        ? rascunhoDoLead
        : rascunhoAtual;
  const contratoParaRestaurar =
    editarParamId && contratoEditar && contratoEditar.status !== 'rascunho'
      ? contratoEditar
      : rascunhoRestaurar;
  const isModoEdicao = Boolean(
    editarParamId && contratoEditar && contratoEditar.status !== 'rascunho',
  );
  const isLoadingRascunho = editarParamId
    ? isLoadingEditar
    : rascunhoParamId
      ? isLoadingRascunhoId
      : leadIdValido
        ? isLoadingRascunhoLead
        : isLoadingRascunhoProprio;
  const editandoRascunhoDeOutro = Boolean(
    rascunhoParamId &&
      rascunhoPorId &&
      podeGerenciar &&
      rascunhoPorId.criado_por &&
      rascunhoPorId.criado_por !== user?.id,
  );

  const [etapa, setEtapa] = useState<Etapa>(1);
  const [valores, setValores] = useState<Record<string, string>>({});
  const [contratoSalvo, setContratoSalvo] = useState<{ id: string; identificador: string } | null>(null);
  const [vincularLeadOpen, setVincularLeadOpen] = useState(false);
  const [modeloSelecionadoId, setModeloSelecionadoId] = useState<string | undefined>(undefined);
  const [rascunhoId, setRascunhoId] = useState<string | null>(null);
  const [contratoEdicaoId, setContratoEdicaoId] = useState<string | null>(null);
  const [formHydrated, setFormHydrated] = useState(false);
  const [formDirty, setFormDirty] = useState(false);
  const [orcamentoPrefillAplicado, setOrcamentoPrefillAplicado] = useState(false);
  const [leadNomePrefillAplicado, setLeadNomePrefillAplicado] = useState(false);
  const [autoSaveState, setAutoSaveState] = useState<
    'idle' | 'pending' | 'saving' | 'saved' | 'error'
  >('idle');
  // conteúdo editável livremente na etapa 2
  const [conteudoEditavel, setConteudoEditavel] = useState('');
  const [textoDetachadoModelo, setTextoDetachadoModelo] = useState(false);
  /** Modo dedicado para editar o corpo inteiro na pré-visualização */
  const [editandoCorpoPreview, setEditandoCorpoPreview] = useState(false);
  const previewTextareaRef = useRef<HTMLTextAreaElement>(null);
  const lastSnapshotRef = useRef<string | null>(null);
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout>>();

  const empresaContrato = getContratosEmpresaFromContext(empresa);

  const aplicarCamposOrcamento = useCallback((campos: Record<string, string>) => {
    setValores((prev) => ({ ...prev, ...campos }));
    setFormDirty(true);
    setOrcamentoPrefillAplicado(true);
    toast.success('Dados do orçamento aplicados no contrato');
  }, []);

  useEffect(() => {
    if (modeloAtivo && !modeloSelecionadoId) {
      setModeloSelecionadoId(modeloAtivo.id);
    }
  }, [modeloAtivo, modeloSelecionadoId]);

  const modelo = modelos.find((m) => m.id === modeloSelecionadoId) ?? modeloAtivo;

  const isLoading = loadingModelo || loadingVar || isLoadingRascunho;

  const camposObrigatorios = variaveis.filter((v) => v.obrigatorio);
  const todosPreenchidos = camposObrigatorios.every((v) => !!valores[v.nome]?.trim());

  const clienteNome = resolverClienteNome(valores, variaveis);
  const identificador = gerarIdentificador(clienteNome);
  const conteudoSubstituido = buildConteudoContrato(
    modelo?.conteudo ?? '',
    valores,
    variaveis,
  );

  const getFormSnapshot = useCallback(
    () =>
      snapshotContratoForm(valores, modeloSelecionadoId, etapa, {
        textoEditado: textoDetachadoModelo,
        conteudo: textoDetachadoModelo ? conteudoEditavel : '',
      }),
    [valores, modeloSelecionadoId, etapa, textoDetachadoModelo, conteudoEditavel],
  );

  const marcarAlteracao = useCallback(() => {
    setFormDirty(true);
  }, []);

  const atualizarValor = useCallback((nome: string, val: string) => {
    setValores((prev) => ({ ...prev, [nome]: val }));
    setFormDirty(true);
  }, []);

  const aplicarPatchesIA = useCallback(
    (patch: ContratoIAPendingPatch) => {
      const nomes = variaveis.map((v) => v.nome);
      const fields = filtrarFieldPatches(patch.fieldPatches, nomes);
      const baseTexto = (conteudoEditavel || conteudoSubstituido || '').trim()
        ? (conteudoEditavel || conteudoSubstituido)
        : conteudoSubstituido;
      const docEdit = aplicarEdicoesNoDocumento(baseTexto, patch);

      flushSync(() => {
        if (Object.keys(fields).length > 0) {
          setValores((prev) => ({ ...prev, ...fields }));
        }
        if (docEdit.alterou) {
          setTextoDetachadoModelo(true);
          setConteudoEditavel(docEdit.texto);
        }
      });

      if (Object.keys(fields).length > 0 || docEdit.alterou) {
        setFormDirty(true);
      }

      return docEdit;
    },
    [variaveis, conteudoEditavel, conteudoSubstituido],
  );

  const irParaEtapa = useCallback((nova: Etapa) => {
    setEtapa(nova);
    setFormDirty(true);
    if (nova !== 2) setEditandoCorpoPreview(false);
  }, []);

  // Sincroniza o conteúdo editável com o template enquanto o usuário não editar manualmente
  useEffect(() => {
    if (!textoDetachadoModelo) {
      setConteudoEditavel(conteudoSubstituido);
    }
  }, [conteudoSubstituido, textoDetachadoModelo]);

  const handleEditarTextoLivre = useCallback((val: string) => {
    setConteudoEditavel(val);
    setTextoDetachadoModelo(true);
    setFormDirty(true);
  }, []);

  const iniciarEdicaoCorpoPreview = useCallback(() => {
    setEditandoCorpoPreview(true);
    // Garante que o texto atual está no estado editável
    setConteudoEditavel((prev) => prev || conteudoSubstituido);
    window.setTimeout(() => {
      const el = previewTextareaRef.current;
      if (!el) return;
      el.focus();
      el.setSelectionRange(el.value.length, el.value.length);
    }, 60);
  }, [conteudoSubstituido]);

  const concluirEdicaoCorpoPreview = useCallback(() => {
    setEditandoCorpoPreview(false);
    toast.success('Edição do corpo salva na pré-visualização');
  }, []);

  const restaurarDoModelo = useCallback(() => {
    setConteudoEditavel(conteudoSubstituido);
    setTextoDetachadoModelo(false);
    setFormDirty(true);
  }, [conteudoSubstituido]);

  const handleVoltar = useCallback(() => {
    // Mantém edição livre se já existir: ao voltar, o usuário pode ajustar campos
    // sem perder o texto. Para regenerar do modelo, use "Restaurar do modelo".
    irParaEtapa(1);
  }, [irParaEtapa]);

  // Restaura rascunho/contrato salvo no servidor (ex.: após recarregar a página)
  useEffect(() => {
    if (isLoading || formHydrated) return;

    let valoresRestaurados: Record<string, string> = {};
    let modeloRestaurado: string | undefined = modeloAtivo?.id;
    let etapaRestaurada: Etapa = 1;
    let textoEditadoRestaurado = false;
    let conteudoRestaurado = '';

    if (contratoParaRestaurar) {
      const parsed = parseRascunhoCampos(contratoParaRestaurar.campos_valores ?? {});
      valoresRestaurados = parsed.valores;
      modeloRestaurado = parsed.modeloId ?? modeloAtivo?.id;
      etapaRestaurada = isModoEdicao ? 1 : parsed.etapa === 2 ? 2 : 1;
      if (contratoParaRestaurar.status === 'rascunho') {
        setRascunhoId(contratoParaRestaurar.id);
      } else {
        setContratoEdicaoId(contratoParaRestaurar.id);
      }
      setValores(valoresRestaurados);
      if (parsed.modeloId) setModeloSelecionadoId(parsed.modeloId);
      setEtapa(etapaRestaurada);

      const modeloConteudo =
        (modelos.find((m) => m.id === modeloRestaurado) ?? modeloAtivo)?.conteudo ?? '';
      const conteudoGerado = modeloConteudo
        ? buildConteudoContrato(modeloConteudo, valoresRestaurados, variaveis)
        : '';
      const conteudoSalvo = contratoParaRestaurar.conteudo_final ?? '';

      if (
        deveRestaurarTextoEditado({
          textoEditadoFlag: parsed.textoEditado,
          conteudoSalvo,
          conteudoGeradoDoModelo: conteudoGerado,
          isModoEdicao,
        })
      ) {
        setConteudoEditavel(conteudoSalvo);
        setTextoDetachadoModelo(true);
        textoEditadoRestaurado = true;
        conteudoRestaurado = conteudoSalvo;
      }
    }

    lastSnapshotRef.current = snapshotContratoForm(
      valoresRestaurados,
      modeloRestaurado,
      etapaRestaurada,
      {
        textoEditado: textoEditadoRestaurado,
        conteudo: textoEditadoRestaurado ? conteudoRestaurado : '',
      },
    );
    setFormHydrated(true);
  }, [
    isLoading,
    formHydrated,
    contratoParaRestaurar,
    modeloAtivo,
    modelos,
    variaveis,
    isModoEdicao,
  ]);

  // Pré-preenche com dados do orçamento do lead (quando não há rascunho com valores)
  useEffect(() => {
    if (!formHydrated || orcamentoPrefillAplicado || !camposDoOrcamento || isModoEdicao) return;
    const temValor = Object.values(valores).some((v) => !!v?.trim());
    if (temValor) {
      setOrcamentoPrefillAplicado(true);
      return;
    }
    setValores((prev) => ({ ...prev, ...camposDoOrcamento }));
    setFormDirty(true);
    setOrcamentoPrefillAplicado(true);
  }, [formHydrated, orcamentoPrefillAplicado, camposDoOrcamento, valores, isModoEdicao]);

  // Se veio do card do lead e o nome do cliente ainda está vazio, usa o nome do lead
  useEffect(() => {
    if (!formHydrated || leadNomePrefillAplicado || isModoEdicao || !leadIdValido) return;
    const nomeLead = leadOrigem?.nome?.trim();
    if (!nomeLead) return;
    const chaveNome = chaveVariavelNomeCliente(variaveis);
    if (!chaveNome) {
      setLeadNomePrefillAplicado(true);
      return;
    }
    const nomeAtual = (valores[chaveNome] ?? '').trim();
    if (nomeAtual) {
      setLeadNomePrefillAplicado(true);
      return;
    }
    setValores((prev) => ({ ...prev, [chaveNome]: nomeLead }));
    setFormDirty(true);
    setLeadNomePrefillAplicado(true);
  }, [
    formHydrated,
    leadNomePrefillAplicado,
    isModoEdicao,
    leadIdValido,
    leadOrigem?.nome,
    variaveis,
    valores,
  ]);

  // Salvamento automático enquanto digita (debounce 700ms)
  useEffect(() => {
    if (!formHydrated || etapa === 3 || !modelo?.conteudo || !formDirty || isModoEdicao) return;

    setAutoSaveState((s) => (s === 'saving' ? s : 'pending'));
    if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);

    autoSaveTimerRef.current = setTimeout(() => {
      void (async () => {
        const snapshot = getFormSnapshot();
        if (snapshot === lastSnapshotRef.current) {
          setFormDirty(false);
          setAutoSaveState('idle');
          return;
        }

        const nome = resolverClienteNome(valores, variaveis);
        const campos = embedMetaCamposValores(valores, {
          modeloId: modeloSelecionadoId,
          etapa: etapa as ContratoEtapaRascunho,
          textoEditado: textoDetachadoModelo,
        });
        const conteudo = textoDetachadoModelo
          ? conteudoEditavel
          : buildConteudoContrato(modelo.conteudo, valores, variaveis);
        const payload = {
          identificador: identificadorRascunho(nome),
          cliente_nome: nome,
          campos_valores: campos,
          conteudo_final: conteudo,
          ...(leadIdVinculado ? { lead_id: leadIdVinculado } : {}),
        };

        setAutoSaveState('saving');
        try {
          const salvo = await salvarRascunhoContrato.mutateAsync({
            id: rascunhoId,
            ...payload,
          });
          setRascunhoId(salvo.id);
          lastSnapshotRef.current = snapshot;
          setFormDirty(false);
          setAutoSaveState('saved');
          window.setTimeout(() => setAutoSaveState('idle'), 2000);
        } catch {
          setAutoSaveState('error');
        }
      })();
    }, 700);

    return () => {
      if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    };
  }, [
    formHydrated,
    etapa,
    modelo,
    formDirty,
    valores,
    modeloSelecionadoId,
    variaveis,
    rascunhoId,
    isModoEdicao,
    textoDetachadoModelo,
    conteudoEditavel,
    leadIdVinculado,
    getFormSnapshot,
    salvarRascunhoContrato,
  ]);

  const handleConfirmar = async () => {
    const campos = embedMetaCamposValores(valores, {
      modeloId: modeloSelecionadoId,
      textoEditado: textoDetachadoModelo,
    });
    const payload = {
      identificador,
      cliente_nome: clienteNome,
      campos_valores: campos,
      conteudo_final: conteudoEditavel || conteudoSubstituido,
      ...(leadIdVinculado ? { lead_id: leadIdVinculado } : {}),
    };

    let contrato;
    if (isModoEdicao && contratoEdicaoId) {
      contrato = await atualizarContrato.mutateAsync({ id: contratoEdicaoId, ...payload });
    } else if (rascunhoId) {
      contrato = await finalizarContrato.mutateAsync({ id: rascunhoId, ...payload });
    } else {
      contrato = await criarContrato.mutateAsync(payload);
    }

    await flushPendingAnexos(contrato.id);

    setContratoSalvo({ id: contrato.id, identificador: contrato.identificador });
    setRascunhoId(null);
    setContratoEdicaoId(null);
    setEtapa(3);
  };

  const isSalvando =
    salvarRascunhoContrato.isPending ||
    finalizarContrato.isPending ||
    criarContrato.isPending ||
    atualizarContrato.isPending;

  const assinaturas = buildAssinaturasCompletas(valores, variaveis, empresaContrato);

  const contratoIdAtivo =
    contratoSalvo?.id ?? rascunhoId ?? contratoEdicaoId ?? null;
  const { anexos: anexosContrato, flushPendingAnexos } = useContratoAnexos(contratoIdAtivo);

  const handleBaixarPDF = () => {
    imprimirContrato({
      conteudo: conteudoEditavel || conteudoSubstituido,
      logoUrl: empresa?.logo_url,
      nomeEmpresa: empresaContrato.nomeFantasia,
      razaoSocial: empresaContrato.razaoSocial || empresaContrato.nomeFantasia,
      cnpj: empresaContrato.cnpj,
      assinaturas,
      anexos: anexosContrato,
    });
  };

  return (
    <div className={`p-6 md:p-8 space-y-8 transition-all duration-200 ${etapa === 2 ? 'max-w-6xl' : 'max-w-4xl'}`}>
      {/* Breadcrumb / back */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Link to="/contratos" className="hover:text-foreground transition-colors flex items-center gap-1">
          <ArrowLeft className="h-3.5 w-3.5" />
          Contratos
        </Link>
        <ChevronRight className="h-3.5 w-3.5" />
        <span className="text-foreground font-medium">
          {isModoEdicao ? 'Editar contrato' : 'Novo contrato'}
        </span>
      </div>

      {/* Stepper */}
      <div className="flex items-center gap-0">
        {ETAPAS.map((e, i) => {
          const ativo = etapa === e.num;
          const concluido = etapa > e.num;
          return (
            <div key={e.num} className="flex items-center">
              <div className="flex items-center gap-2">
                <div
                  className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold transition-all ${
                    concluido
                      ? 'bg-green-500 text-white'
                      : ativo
                      ? 'bg-amber-500 text-black'
                      : 'bg-muted text-muted-foreground'
                  }`}
                >
                  {concluido ? <CheckCircle2 className="h-4 w-4" /> : e.num}
                </div>
                <span
                  className={`text-sm font-medium hidden sm:block ${
                    ativo ? 'text-foreground' : 'text-muted-foreground'
                  }`}
                >
                  {e.label}
                </span>
              </div>
              {i < ETAPAS.length - 1 && (
                <div
                  className={`mx-3 h-px flex-1 min-w-[40px] sm:min-w-[80px] transition-all ${
                    etapa > e.num ? 'bg-green-500' : 'bg-border'
                  }`}
                />
              )}
            </div>
          );
        })}
      </div>

      {/* ── Etapa 1: Preencher ─────────────────────────── */}
      {etapa === 1 && (
        <div className="space-y-6">
          <div>
            <h2 className="text-xl font-bold">
              {isModoEdicao ? 'Editar campos do contrato' : 'Preencher campos do contrato'}
            </h2>
            <p className="text-sm text-muted-foreground mt-1">
              {isModoEdicao
                ? 'Altere os campos e o modelo do contrato. Ao confirmar, as mudanças substituem o contrato atual.'
                : 'Preencha os campos abaixo para gerar o contrato. O sistema salva automaticamente enquanto você digita. Use o ícone dourado no canto para a assistente IA.'}
            </p>
            {formHydrated && autoSaveState !== 'idle' && (
              <p
                className={`text-xs mt-2 flex items-center gap-1.5 ${
                  autoSaveState === 'error'
                    ? 'text-destructive'
                    : autoSaveState === 'saved'
                    ? 'text-emerald-600'
                    : 'text-muted-foreground'
                }`}
              >
                <Cloud className="h-3.5 w-3.5 shrink-0" />
                {autoSaveState === 'pending' && 'Preparando salvamento...'}
                {autoSaveState === 'saving' && 'Salvando rascunho...'}
                {autoSaveState === 'saved' && 'Rascunho salvo — pode recarregar a página sem perder os dados'}
                {autoSaveState === 'error' && 'Não foi possível salvar. Verifique a conexão.'}
              </p>
            )}
            {formHydrated && rascunhoId && autoSaveState === 'idle' && (
              <p className="text-xs mt-2 text-amber-700/90 flex items-center gap-1.5">
                <Cloud className="h-3.5 w-3.5" />
                {editandoRascunhoDeOutro
                  ? 'Visualizando contrato em produção de outro usuário — você pode editar e finalizar'
                  : 'Continuando rascunho salvo anteriormente'}
              </p>
            )}
            {editarParamId && !isLoadingRascunho && !contratoEditar && (
              <p className="text-xs mt-2 text-destructive">
                Contrato não encontrado ou sem permissão para editar.
              </p>
            )}
            {rascunhoParamId && !editarParamId && !isLoadingRascunho && !rascunhoPorId && (
              <p className="text-xs mt-2 text-destructive">
                Rascunho não encontrado ou sem permissão para abrir.
              </p>
            )}
            {camposDoOrcamento && !isModoEdicao && (
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 gap-1.5 text-xs border-amber-500/40 text-amber-200 hover:bg-amber-500/10"
                  onClick={() => aplicarCamposOrcamento(camposDoOrcamento)}
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  Usar dados do orçamento
                </Button>
                <span className="text-xs text-muted-foreground">
                  Preenche os campos com o que o cliente enviou no formulário público.
                </span>
              </div>
            )}
          </div>

          {/* Orçamentos do lead — visualizar a apresentação sem sair do contrato */}
          {leadIdVinculado != null && (
            <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-4">
              <LeadOrcamentoSlidesSection
                leadId={leadIdVinculado}
                persistVisualizarAcrossRemount={false}
              />
            </div>
          )}

          {/* Seletor de modelo (quando há múltiplos) */}
          {!isLoading && (modelos.length > 1 || isModoEdicao) && modelos.length > 0 && (
            <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/40 border">
              <BookOpen className="h-4 w-4 text-amber-400 shrink-0" />
              <div className="flex-1 min-w-0">
                <Label className="text-xs text-muted-foreground mb-1 block">Modelo de contrato</Label>
                <Select
                  value={modeloSelecionadoId ?? ''}
                  onValueChange={(v) => {
                    setModeloSelecionadoId(v);
                    marcarAlteracao();
                  }}
                >
                  <SelectTrigger className="h-8 text-sm">
                    <SelectValue placeholder="Selecione um modelo" />
                  </SelectTrigger>
                  <SelectContent>
                    {modelos.map((m) => (
                      <SelectItem key={m.id} value={m.id}>
                        {m.nome}
                        {m.ativo && <span className="ml-2 text-amber-400 text-xs">(ativo)</span>}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          {isLoading ? (
            <div className="space-y-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="space-y-2">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-10 w-full" />
                </div>
              ))}
            </div>
          ) : !modelo?.conteudo ? (
            <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-16 gap-3 text-muted-foreground">
              <AlertCircle className="h-10 w-10 opacity-40" />
              <p className="text-sm font-medium">Nenhum modelo de contrato configurado.</p>
              <Button variant="outline" size="sm" asChild>
                <Link to="/contratos/configuracoes">Configurar modelo</Link>
              </Button>
            </div>
          ) : variaveis.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-16 gap-3 text-muted-foreground">
              <AlertCircle className="h-10 w-10 opacity-40" />
              <p className="text-sm font-medium">Nenhum campo variável configurado.</p>
              <Button variant="outline" size="sm" asChild>
                <Link to="/contratos/configuracoes">Adicionar campos</Link>
              </Button>
            </div>
          ) : (
            <div className="grid gap-5 sm:grid-cols-2">
              {variaveis.map((v) => (
                <div key={v.id} className="space-y-2">
                  <Label>
                    {v.label}
                    {v.nome === VARIAVEL_CPF_FIXO && (
                      <span className="text-amber-500/90 ml-1 text-xs font-normal">
                        (fixo — assinatura)
                      </span>
                    )}
                    {v.obrigatorio && (
                      <span className="text-red-400 ml-1">*</span>
                    )}
                  </Label>
                  <CampoInput
                    variavel={v}
                    valor={valores[v.nome] ?? ''}
                    onChange={(val) => atualizarValor(v.nome, val)}
                  />
                </div>
              ))}
            </div>
          )}

          <ContratoAnexosSection contratoId={contratoIdAtivo} />

          <div className="flex justify-end pt-2">
            <Button
              className="gap-2 bg-amber-500 hover:bg-amber-600 text-black font-semibold"
              disabled={!todosPreenchidos || !modelo?.conteudo || variaveis.length === 0}
              onClick={() => irParaEtapa(2)}
            >
              <Eye className="h-4 w-4" />
              Pré-visualizar contrato
            </Button>
          </div>
        </div>
      )}

      {/* ── Etapa 2: Edição completa + preview ────────── */}
      {etapa === 2 && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-xl font-bold">Revisar e editar contrato</h2>
              <p className="text-sm text-muted-foreground mt-1">
                {editandoCorpoPreview
                  ? 'Modo edição do corpo ativo. Use a IA (ícone dourado) para adaptar o texto, ou edite manualmente abaixo.'
                  : 'Revise os campos e o texto. Para a IA editar o corpo inteiro, abra o ícone dourado e toque em “Editar pré-visualização”.'}
              </p>
            </div>
            {editandoCorpoPreview && (
              <Button
                type="button"
                size="sm"
                className="h-9 gap-1.5 bg-amber-500 text-black hover:bg-amber-600 font-semibold shrink-0"
                onClick={concluirEdicaoCorpoPreview}
              >
                <Check className="h-3.5 w-3.5" />
                Concluir edição
              </Button>
            )}
          </div>

          {/* Banner: texto desvinculado do modelo */}
          {textoDetachadoModelo && (
            <div className="flex items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2">
              <AlertCircle className="h-4 w-4 shrink-0 text-amber-400" />
              <span className="flex-1 text-sm text-amber-200">
                Texto editado manualmente — alterações nos campos não atualizam o conteúdo automaticamente.
              </span>
              <Button
                size="sm"
                variant="ghost"
                className="h-7 text-xs gap-1 text-amber-300 hover:text-amber-100 hover:bg-amber-500/20 shrink-0"
                onClick={restaurarDoModelo}
                disabled={editandoCorpoPreview}
              >
                Restaurar do modelo
              </Button>
            </div>
          )}

          {editandoCorpoPreview && (
            <div className="flex items-center gap-2 rounded-lg border border-sky-500/30 bg-sky-500/10 px-3 py-2">
              <Pencil className="h-4 w-4 shrink-0 text-sky-300" />
              <span className="flex-1 text-sm text-sky-100">
                Editando o corpo completo do contrato. Digite livremente no documento à direita.
              </span>
            </div>
          )}

          {/* Layout split: campos | textarea editável */}
          <div className="flex gap-4" style={{ minHeight: '640px' }}>
            {/* Painel de campos — oculto no modo edição do corpo para dar foco ao texto */}
            {!editandoCorpoPreview && (
              <div className="w-72 shrink-0 flex flex-col rounded-lg border bg-card overflow-hidden">
                <div className="px-4 py-3 border-b bg-muted/20">
                  <p className="text-sm font-semibold">Campos do contrato</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {textoDetachadoModelo
                      ? 'Valores salvos com o contrato'
                      : 'Alterações refletem no texto ao lado'}
                  </p>
                </div>
                <ScrollArea className="flex-1">
                  <div className="px-4 py-4 space-y-4">
                    {variaveis.map((v) => (
                      <div key={v.id} className="space-y-1.5">
                        <Label className="text-xs font-medium">
                          {v.label}
                          {v.nome === VARIAVEL_CPF_FIXO && (
                            <span className="text-amber-500/90 ml-1 text-xs font-normal">
                              (fixo)
                            </span>
                          )}
                          {v.obrigatorio && (
                            <span className="text-red-400 ml-0.5">*</span>
                          )}
                        </Label>
                        <CampoInput
                          variavel={v}
                          valor={valores[v.nome] ?? ''}
                          onChange={(val) => atualizarValor(v.nome, val)}
                        />
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </div>
            )}

            {/* Texto do contrato */}
            <div className="flex-1 overflow-auto rounded-xl bg-muted/20 flex justify-center p-4 md:p-6">
              <textarea
                ref={previewTextareaRef}
                value={conteudoEditavel}
                readOnly={!editandoCorpoPreview}
                onChange={(e) => handleEditarTextoLivre(e.target.value)}
                onFocus={() => {
                  if (!editandoCorpoPreview) {
                    // Clique no documento também entra no modo edição
                    iniciarEdicaoCorpoPreview();
                  }
                }}
                aria-label={
                  editandoCorpoPreview
                    ? 'Editando corpo do contrato'
                    : 'Pré-visualização do contrato — clique ou use Editar pré-visualização'
                }
                className={`w-full bg-white text-black shadow-md rounded-sm outline-none resize-none ${
                  editandoCorpoPreview
                    ? 'ring-2 ring-amber-400/60 cursor-text'
                    : 'cursor-pointer hover:ring-1 hover:ring-amber-400/30'
                }`}
                style={{
                  fontFamily: '"Times New Roman", Times, serif',
                  fontSize: '12pt',
                  lineHeight: '1.8',
                  padding: '25mm 20mm',
                  minHeight: '297mm',
                  maxWidth: editandoCorpoPreview ? '210mm' : '210mm',
                  width: '100%',
                }}
                spellCheck={editandoCorpoPreview}
              />
            </div>
          </div>

          <ContratoAnexosSection contratoId={contratoIdAtivo} />

          <div className="flex items-center justify-between pt-2">
            <Button
              variant="outline"
              className="gap-2"
              onClick={() => {
                setEditandoCorpoPreview(false);
                handleVoltar();
              }}
            >
              <ArrowLeft className="h-4 w-4" />
              Voltar
            </Button>
            <div className="flex items-center gap-2">
              {editandoCorpoPreview && (
                <Button
                  type="button"
                  variant="outline"
                  className="gap-2"
                  onClick={concluirEdicaoCorpoPreview}
                >
                  <Check className="h-4 w-4" />
                  Concluir edição
                </Button>
              )}
              <Button
                className="gap-2 bg-amber-500 hover:bg-amber-600 text-black font-semibold"
                onClick={handleConfirmar}
                disabled={isSalvando || !todosPreenchidos || editandoCorpoPreview}
                title={
                  editandoCorpoPreview
                    ? 'Conclua a edição do corpo antes de salvar'
                    : undefined
                }
              >
                {isSalvando ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <CheckCircle2 className="h-4 w-4" />
                )}
                {isModoEdicao ? 'Salvar alterações' : 'Confirmar e salvar'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ── Etapa 3: Concluído ─────────────────────────── */}
      {etapa === 3 && (
        <div className="flex flex-col items-center justify-center py-12 gap-6 text-center">
          <div className="flex h-20 w-20 items-center justify-center rounded-full bg-green-500/15 border border-green-500/30">
            <CheckCircle2 className="h-10 w-10 text-green-400" />
          </div>

          <div>
            <h2 className="text-2xl font-bold">
              {isModoEdicao ? 'Contrato atualizado!' : 'Contrato salvo com sucesso!'}
            </h2>
            {contratoSalvo && (
              <p className="mt-2 text-muted-foreground">
                Identificador:{' '}
                <code className="bg-muted px-2 py-0.5 rounded text-sm font-mono text-amber-400">
                  {contratoSalvo.identificador}
                </code>
              </p>
            )}
          </div>

          <Card className="w-full max-w-sm">
            <CardContent className="flex flex-col gap-3 pt-5">
              <Button
                className="w-full gap-2 bg-amber-500 hover:bg-amber-600 text-black font-semibold"
                onClick={handleBaixarPDF}
              >
                <Download className="h-4 w-4" />
                Baixar PDF
              </Button>
              <Button
                variant="outline"
                className="w-full gap-2 border-amber-500/40"
                onClick={() => setVincularLeadOpen(true)}
              >
                <Link2 className="h-4 w-4" />
                Vincular a um lead
              </Button>
              <Button variant="outline" className="w-full gap-2" asChild>
                <Link to="/contratos">
                  <FileText className="h-4 w-4" />
                  Ver histórico
                </Link>
              </Button>
            </CardContent>
          </Card>

          {contratoSalvo && (
            <div className="w-full max-w-2xl text-left mt-4">
              <ContratoAnexosSection contratoId={contratoSalvo.id} />
            </div>
          )}

          {contratoSalvo && (
            <VincularContratoLeadDialog
              open={vincularLeadOpen}
              onOpenChange={setVincularLeadOpen}
              contratoId={contratoSalvo.id}
              contratoLabel={contratoSalvo.identificador}
              onVinculado={(leadId) => setLeadIdAposVincular(leadId)}
            />
          )}
        </div>
      )}

      {leadIdVinculado != null && (
        <OrcamentoLeadCardDock
          leadId={leadIdVinculado}
          leadNome={leadOrigem?.nome ?? clienteNome}
          position="fixed"
        />
      )}

      {(etapa === 1 || etapa === 2) && (
        <ContratoIAAssistPanel
          etapa={etapa}
          variaveis={variaveis.map((v) => ({
            nome: v.nome,
            label: v.label,
            tipo: v.tipo,
            obrigatorio: v.obrigatorio,
          }))}
          valores={valores}
          conteudoContrato={conteudoEditavel || conteudoSubstituido}
          modeloConteudo={modelo?.conteudo ?? ''}
          onApplyPatches={aplicarPatchesIA}
          onEnterCorpoEditMode={iniciarEdicaoCorpoPreview}
          disabled={variaveis.length === 0 || !modelo?.conteudo}
        />
      )}
    </div>
  );
}
