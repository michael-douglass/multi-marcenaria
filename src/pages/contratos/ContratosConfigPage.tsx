import { useRef, useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Settings, Tag, Plus, Pencil, Trash2, AlertTriangle,
  Save, Loader2, ArrowLeft, Star, StarOff, FileText, Building2, Link2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Tooltip, TooltipContent, TooltipTrigger,
} from '@/components/ui/tooltip';
import { useContratosModelos } from '@/hooks/useContratosModelo';
import { useContratosVariaveis, type ContratoVariavel } from '@/hooks/useContratosVariaveis';
import { useContratosEmpresaConfig } from '@/hooks/useContratosEmpresaConfig';
import { extrairVariaveis, VARIAVEL_CPF_FIXO } from '@/lib/contratos-print';

const TIPO_LABELS: Record<ContratoVariavel['tipo'], string> = {
  texto: 'Texto',
  data: 'Data',
  valor: 'Valor monetário',
  cpf: 'CPF',
};

function gerarNomeTecnico(label: string): string {
  return label
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s]/g, '')
    .trim()
    .replace(/\s+/g, '_');
}

const VAZIO_VAR: Omit<ContratoVariavel, 'id'> = {
  nome: '', label: '', tipo: 'texto', obrigatorio: true, ordem: 0, mostrar_no_link_publico: false,
};

export default function ContratosConfigPage() {
  const {
    modelos, modeloAtivo, isLoading: loadingModelos,
    criarModelo, salvarModelo, ativarModelo, excluirModelo,
  } = useContratosModelos();
  const {
    variaveis, isLoading: loadingVar,
    criarVariavel, atualizarVariavel, excluirVariavel,
  } = useContratosVariaveis();
  const { config: empresaConfig, isLoading: loadingEmpresa, salvar: salvarEmpresa, formatCNPJ } =
    useContratosEmpresaConfig();
  const [razaoSocial, setRazaoSocial] = useState('');
  const [cnpjContratada, setCnpjContratada] = useState('');

  useEffect(() => {
    if (empresaConfig) {
      setRazaoSocial(empresaConfig.razaoSocial);
      setCnpjContratada(formatCNPJ(empresaConfig.cnpj));
    }
  }, [empresaConfig]);

  // ── Estado editor de modelo ───────────────────────────────
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [modeloSelecionadoId, setModeloSelecionadoId] = useState<string | null>(null);
  const [conteudoEditado, setConteudoEditado] = useState<Record<string, string>>({});
  const [nomeEditado, setNomeEditado] = useState<Record<string, string>>({});

  const modeloSelecionado = modelos.find((m) => m.id === modeloSelecionadoId)
    ?? modeloAtivo
    ?? modelos[0]
    ?? null;

  const conteudoAtual = conteudoEditado[modeloSelecionado?.id ?? '']
    ?? modeloSelecionado?.conteudo ?? '';
  const nomeAtual = nomeEditado[modeloSelecionado?.id ?? '']
    ?? modeloSelecionado?.nome ?? '';

  // ── Novo modelo ───────────────────────────────────────────
  const [novoModeloDialog, setNovoModeloDialog] = useState(false);
  const [novoModeloNome, setNovoModeloNome] = useState('');

  // ── Excluir modelo ────────────────────────────────────────
  const [deleteModeloId, setDeleteModeloId] = useState<string | null>(null);

  // ── Variáveis ─────────────────────────────────────────────
  const [varDialog, setVarDialog] = useState(false);
  const [editandoVarId, setEditandoVarId] = useState<string | null>(null);
  const [formVar, setFormVar] = useState<Omit<ContratoVariavel, 'id'>>(VAZIO_VAR);
  const [deleteVarId, setDeleteVarId] = useState<string | null>(null);

  // ── Helpers ───────────────────────────────────────────────
  const varUsadas = extrairVariaveis(conteudoAtual);
  const nomesCadastrados = variaveis.map((v) => v.nome);
  const varNaoCadastradas = varUsadas.filter((v) => !nomesCadastrados.includes(v));

  const inserirVariavel = (nome: string) => {
    const el = textareaRef.current;
    const id = modeloSelecionado?.id ?? '';
    if (!el || !id) return;
    const ini = el.selectionStart ?? conteudoAtual.length;
    const fim = el.selectionEnd ?? conteudoAtual.length;
    const novo = conteudoAtual.slice(0, ini) + `{{${nome}}}` + conteudoAtual.slice(fim);
    setConteudoEditado((p) => ({ ...p, [id]: novo }));
    requestAnimationFrame(() => {
      el.focus();
      const pos = ini + nome.length + 4;
      el.setSelectionRange(pos, pos);
    });
  };

  const handleSalvarModelo = async () => {
    if (!modeloSelecionado) return;
    await salvarModelo.mutateAsync({
      id: modeloSelecionado.id,
      dados: { nome: nomeAtual, conteudo: conteudoAtual },
    });
    setConteudoEditado((p) => { const c = { ...p }; delete c[modeloSelecionado.id]; return c; });
    setNomeEditado((p) => { const c = { ...p }; delete c[modeloSelecionado.id]; return c; });
  };

  const handleCriarModelo = async () => {
    if (!novoModeloNome.trim()) return;
    const novo = await criarModelo.mutateAsync({ nome: novoModeloNome });
    setModeloSelecionadoId(novo.id);
    setNovoModeloNome('');
    setNovoModeloDialog(false);
  };

  const handleExcluirModelo = () => {
    if (!deleteModeloId) return;
    excluirModelo.mutate(deleteModeloId);
    if (modeloSelecionadoId === deleteModeloId) setModeloSelecionadoId(null);
    setDeleteModeloId(null);
  };

  // ── Variável handlers ─────────────────────────────────────
  const abrirCriarVar = () => {
    setEditandoVarId(null);
    setFormVar({ ...VAZIO_VAR, ordem: variaveis.length });
    setVarDialog(true);
  };
  const abrirEditarVar = (v: ContratoVariavel) => {
    setEditandoVarId(v.id);
    setFormVar({ nome: v.nome, label: v.label, tipo: v.tipo, obrigatorio: v.obrigatorio, ordem: v.ordem });
    setVarDialog(true);
  };
  const handleSalvarVar = async () => {
    if (!formVar.label.trim() || !formVar.nome.trim()) return;
    if (editandoVarId) await atualizarVariavel.mutateAsync({ id: editandoVarId, updates: formVar });
    else await criarVariavel.mutateAsync(formVar);
    setVarDialog(false);
  };

  const isMutatingVar = criarVariavel.isPending || atualizarVariavel.isPending;

  return (
    <div className="p-6 md:p-8 space-y-6 max-w-5xl">
      {/* ── Header com seta de volta ────────────────────── */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" asChild>
          <Link to="/contratos">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-500/15 border border-amber-500/30">
              <Settings className="h-4 w-4 text-amber-400" />
            </div>
            Configurações de Contratos
          </h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            Modelos de contrato e campos variáveis
          </p>
        </div>
      </div>

      <Tabs defaultValue="modelo">
        <TabsList className="w-full sm:w-auto flex-wrap h-auto gap-1">
          <TabsTrigger value="modelo">Modelos de Contrato</TabsTrigger>
          <TabsTrigger value="variaveis">Campos Variáveis</TabsTrigger>
          <TabsTrigger value="contratada">Contratada (assinatura)</TabsTrigger>
        </TabsList>

        {/* ══ Aba Modelos ════════════════════════════════════ */}
        <TabsContent value="modelo" className="mt-6 space-y-4">
          {loadingModelos ? (
            <Skeleton className="h-[500px] w-full rounded-lg" />
          ) : (
            <>
              {/* Seletor de modelos + botão novo */}
              <div className="flex items-center gap-2 flex-wrap">
                <div className="flex-1 min-w-[200px]">
                  <Select
                    value={modeloSelecionado?.id ?? ''}
                    onValueChange={setModeloSelecionadoId}
                  >
                    <SelectTrigger className="w-full max-w-xs">
                      <SelectValue placeholder="Selecionar modelo…" />
                    </SelectTrigger>
                    <SelectContent>
                      {modelos.map((m) => (
                        <SelectItem key={m.id} value={m.id}>
                          <span className="flex items-center gap-2">
                            {m.ativo && <Star className="h-3 w-3 text-amber-400 fill-amber-400" />}
                            {m.nome}
                            {m.ativo && (
                              <span className="text-xs text-amber-400 ml-1">(ativo)</span>
                            )}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Ativar modelo selecionado */}
                {modeloSelecionado && !modeloSelecionado.ativo && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-2"
                        onClick={() => ativarModelo.mutate(modeloSelecionado.id)}
                        disabled={ativarModelo.isPending}
                      >
                        <Star className="h-3.5 w-3.5" />
                        Definir como ativo
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Modelo usado por padrão ao criar contratos</TooltipContent>
                  </Tooltip>
                )}

                {/* Excluir modelo (não pode excluir o ativo) */}
                {modeloSelecionado && !modeloSelecionado.ativo && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="gap-2 text-red-400 hover:text-red-400"
                    onClick={() => setDeleteModeloId(modeloSelecionado.id)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Excluir
                  </Button>
                )}

                <Button
                  size="sm"
                  variant="outline"
                  className="gap-2 ml-auto"
                  onClick={() => setNovoModeloDialog(true)}
                >
                  <Plus className="h-4 w-4" />
                  Novo modelo
                </Button>
              </div>

              {modelos.length === 0 ? (
                <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-16 gap-3 text-muted-foreground">
                  <FileText className="h-10 w-10 opacity-30" />
                  <p className="text-sm">Nenhum modelo criado ainda.</p>
                  <Button variant="outline" size="sm" onClick={() => setNovoModeloDialog(true)}>
                    Criar primeiro modelo
                  </Button>
                </div>
              ) : modeloSelecionado && (
                <div className="flex gap-4 flex-col lg:flex-row">
                  {/* Editor */}
                  <div className="flex-1 space-y-3">
                    {/* Nome do modelo */}
                    <div className="flex items-center gap-2">
                      <Input
                        value={nomeAtual}
                        onChange={(e) =>
                          setNomeEditado((p) => ({ ...p, [modeloSelecionado.id]: e.target.value }))
                        }
                        className="max-w-xs font-medium"
                        placeholder="Nome do modelo"
                      />
                      {modeloSelecionado.ativo && (
                        <Badge variant="outline" className="gap-1 border-amber-500/30 text-amber-400">
                          <Star className="h-3 w-3 fill-amber-400" />
                          Ativo
                        </Badge>
                      )}
                    </div>

                    <div className="flex items-center justify-between">
                      <Label>Texto do contrato</Label>
                      <Button
                        size="sm"
                        className="gap-2 bg-amber-500 hover:bg-amber-600 text-black font-semibold"
                        onClick={handleSalvarModelo}
                        disabled={salvarModelo.isPending}
                      >
                        {salvarModelo.isPending
                          ? <Loader2 className="h-4 w-4 animate-spin" />
                          : <Save className="h-4 w-4" />}
                        Salvar modelo
                      </Button>
                    </div>

                    <Textarea
                      ref={textareaRef}
                      value={conteudoAtual}
                      onChange={(e) =>
                        setConteudoEditado((p) => ({ ...p, [modeloSelecionado.id]: e.target.value }))
                      }
                      placeholder={`Escreva o texto do contrato aqui.\nUse {{nome_variavel}} para campos dinâmicos.\n\nExemplo: Este contrato é celebrado entre {{nome_cliente}}, CPF {{cpf_cliente}}...`}
                      className="min-h-[500px] font-mono text-sm resize-y"
                    />

                    {varNaoCadastradas.length > 0 && (
                      <div className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3">
                        <AlertTriangle className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
                        <div className="text-sm text-amber-300">
                          <p className="font-medium">Variáveis no modelo não cadastradas:</p>
                          <p className="mt-1 flex flex-wrap gap-1">
                            {varNaoCadastradas.map((v) => (
                              <code key={v} className="bg-amber-500/20 rounded px-1">{`{{${v}}}`}</code>
                            ))}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Painel variáveis */}
                  <div className="w-full lg:w-64 shrink-0">
                    <Card>
                      <CardHeader className="pb-3">
                        <CardTitle className="text-sm flex items-center gap-2">
                          <Tag className="h-4 w-4 text-amber-400" />
                          Variáveis disponíveis
                        </CardTitle>
                        <CardDescription className="text-xs">
                          Clique para inserir no cursor
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="flex flex-wrap gap-2">
                        {variaveis.length === 0 ? (
                          <p className="text-xs text-muted-foreground">
                            Nenhuma variável cadastrada.
                          </p>
                        ) : (
                          variaveis.map((v) => (
                            <button
                              key={v.id}
                              onClick={() => inserirVariavel(v.nome)}
                              className="inline-flex items-center rounded border border-amber-500/30 bg-amber-500/10 px-2 py-1 text-xs font-mono text-amber-300 hover:bg-amber-500/20 transition-colors"
                              title={v.label}
                            >
                              {`{{${v.nome}}}`}
                            </button>
                          ))
                        )}
                      </CardContent>
                    </Card>
                  </div>
                </div>
              )}
            </>
          )}
        </TabsContent>

        {/* ══ Aba Variáveis ══════════════════════════════════ */}
        <TabsContent value="variaveis" className="mt-6">
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm text-muted-foreground">
              {variaveis.length} campo{variaveis.length !== 1 ? 's' : ''} cadastrado{variaveis.length !== 1 ? 's' : ''}
            </p>
            <Button
              size="sm"
              className="gap-2 bg-amber-500 hover:bg-amber-600 text-black font-semibold"
              onClick={abrirCriarVar}
            >
              <Plus className="h-4 w-4" />
              Adicionar campo
            </Button>
          </div>

          {loadingVar ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => <Skeleton key={i} className="h-16 w-full rounded-lg" />)}
            </div>
          ) : variaveis.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3 text-muted-foreground rounded-lg border border-dashed">
              <Tag className="h-10 w-10 opacity-30" />
              <p className="text-sm">Nenhum campo variável cadastrado.</p>
              <Button variant="outline" size="sm" onClick={abrirCriarVar}>
                Criar primeiro campo
              </Button>
            </div>
          ) : (
            <div className="space-y-2">
              {variaveis.map((v) => (
                <div
                  key={v.id}
                  className="flex items-center gap-3 rounded-lg border border-border bg-card p-4 group hover:border-amber-500/30 transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-sm">{v.label}</span>
                      <code className="text-xs bg-muted px-1.5 py-0.5 rounded text-amber-400">
                        {`{{${v.nome}}}`}
                      </code>
                      {v.nome === VARIAVEL_CPF_FIXO && (
                        <Badge className="text-[10px] h-5 bg-amber-500/20 text-amber-300 border-amber-500/40">
                          Fixo — assinatura
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                      <Badge variant="outline" className="text-xs h-5">{TIPO_LABELS[v.tipo]}</Badge>
                      <Badge
                        variant="outline"
                        className={`text-xs h-5 ${v.obrigatorio
                          ? 'border-red-500/30 text-red-400'
                          : 'border-muted text-muted-foreground'}`}
                      >
                        {v.obrigatorio ? 'Obrigatório' : 'Opcional'}
                      </Badge>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => abrirEditarVar(v)}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    {v.nome !== VARIAVEL_CPF_FIXO && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-red-400 hover:text-red-400"
                        onClick={() => setDeleteVarId(v.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        {/* ══ Aba Contratada ═══════════════════════════════════ */}
        <TabsContent value="contratada" className="mt-6 space-y-4">
          <Card className="border-amber-500/25 bg-gradient-to-br from-amber-950/20 to-transparent">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Building2 className="h-4 w-4 text-amber-400" />
                Dados da Contratada na assinatura
              </CardTitle>
              <CardDescription>
                Razão social e CNPJ exibidos no rodapé do contrato, ao lado da assinatura da empresa.
                O logo e o nome fantasia no topo vêm da identidade visual (Logo e Nome).
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5 max-w-lg">
              {loadingEmpresa ? (
                <Skeleton className="h-24 w-full" />
              ) : (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="razao-social">Razão social</Label>
                    <Input
                      id="razao-social"
                      value={razaoSocial}
                      onChange={(e) => setRazaoSocial(e.target.value)}
                      placeholder="Ex: Garbo Móveis e Decorações Ltda"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="cnpj-contratada">CNPJ</Label>
                    <Input
                      id="cnpj-contratada"
                      value={cnpjContratada}
                      onChange={(e) => setCnpjContratada(formatCNPJ(e.target.value))}
                      placeholder="00.000.000/0000-00"
                      maxLength={18}
                    />
                  </div>
                  <div className="rounded-lg border border-dashed border-amber-500/30 bg-muted/30 p-4 text-sm space-y-2">
                    <p className="font-medium text-foreground">Prévia da assinatura — Contratada</p>
                    <div className="text-center pt-2 border-t border-border/60 max-w-xs mx-auto">
                      <div className="border-b border-gray-600 w-full mb-2" />
                      <p className="font-semibold text-xs">
                        {razaoSocial.trim() || empresaConfig?.nomeFantasia || 'Razão social'}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        CNPJ: {cnpjContratada.trim() || '00.000.000/0000-00'}
                      </p>
                      <p className="text-xs italic text-muted-foreground mt-1">Contratada</p>
                    </div>
                  </div>
                  <div className="flex justify-end">
                    <Button
                      onClick={() =>
                        salvarEmpresa.mutate({
                          razaoSocial,
                          cnpj: cnpjContratada,
                        })
                      }
                      disabled={salvarEmpresa.isPending}
                      className="bg-amber-500 hover:bg-amber-600 text-black font-semibold"
                    >
                      {salvarEmpresa.isPending && (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      )}
                      Salvar dados da contratada
                    </Button>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          <Card className="border-border/60">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Link2 className="h-4 w-4 text-amber-400" />
                Formulário público do contrato
              </CardTitle>
              <CardDescription>
                Marque quais campos o cliente vê no link do card do lead. O link é público
                (sem cadastro). Ao enviar, o CRM cria um contrato em rascunho já vinculado a
                esse lead.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {loadingVar ? (
                <Skeleton className="h-24 w-full" />
              ) : variaveis.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Cadastre campos na aba &quot;Campos Variáveis&quot; para liberá-los neste formulário.
                </p>
              ) : (
                <ul className="space-y-2 max-w-xl">
                  {variaveis.map((v) => (
                    <li
                      key={v.id}
                      className="flex items-center justify-between gap-3 rounded-md border border-border/50 px-3 py-2"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{v.label}</p>
                        <p className="text-xs text-muted-foreground">
                          {`{{${v.nome}}}`} · {TIPO_LABELS[v.tipo]}
                          {v.obrigatorio ? ' · obrigatório' : ''}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <Label htmlFor={`pub-${v.id}`} className="text-xs text-muted-foreground">
                          No link
                        </Label>
                        <Switch
                          id={`pub-${v.id}`}
                          checked={!!v.mostrar_no_link_publico}
                          disabled={atualizarVariavel.isPending}
                          onCheckedChange={(checked) =>
                            atualizarVariavel.mutate({
                              id: v.id,
                              updates: { mostrar_no_link_publico: checked },
                            })
                          }
                        />
                      </div>
                    </li>
                  ))}
                </ul>
              )}
              <p className="text-xs text-muted-foreground max-w-xl">
                No card do lead, em Contratos, use &quot;Copiar link do formulário&quot;: é um
                endereço único por cliente (
                <code className="text-[11px]">/iniciar-orcamento/sua-empresa/token</code>
                ). Qualquer pessoa com o link preenche sem login; o contrato aparece no card.
              </p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* ── Dialog novo modelo ──────────────────────────────── */}
      <Dialog open={novoModeloDialog} onOpenChange={(o) => { if (!o) { setNovoModeloDialog(false); setNovoModeloNome(''); } }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Novo modelo de contrato</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <Label>Nome do modelo</Label>
            <Input
              value={novoModeloNome}
              onChange={(e) => setNovoModeloNome(e.target.value)}
              placeholder="Ex: Contrato de Prestação de Serviços"
              onKeyDown={(e) => e.key === 'Enter' && handleCriarModelo()}
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setNovoModeloDialog(false); setNovoModeloNome(''); }}>
              Cancelar
            </Button>
            <Button
              onClick={handleCriarModelo}
              disabled={!novoModeloNome.trim() || criarModelo.isPending}
              className="bg-amber-500 hover:bg-amber-600 text-black font-semibold"
            >
              {criarModelo.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Criar modelo
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── AlertDialog excluir modelo ──────────────────────── */}
      <AlertDialog open={!!deleteModeloId} onOpenChange={(o) => { if (!o) setDeleteModeloId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir modelo?</AlertDialogTitle>
            <AlertDialogDescription>
              O modelo será excluído permanentemente. Contratos já gerados não são afetados.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction className="bg-red-500 hover:bg-red-600" onClick={handleExcluirModelo}>
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ── Dialog criar/editar variável ────────────────────── */}
      <Dialog open={varDialog} onOpenChange={(o) => { if (!o) setVarDialog(false); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editandoVarId ? 'Editar campo' : 'Novo campo variável'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Label (exibido no formulário)</Label>
              <Input
                value={formVar.label}
                onChange={(e) => {
                  const label = e.target.value;
                  setFormVar((p) => ({
                    ...p,
                    label,
                    nome: editandoVarId ? p.nome : gerarNomeTecnico(label),
                  }));
                }}
                placeholder="Ex: Nome do Cliente"
              />
            </div>
            <div className="space-y-2">
              <Label>Nome técnico</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm font-mono">{'{{'}</span>
                <Input
                  value={formVar.nome}
                  onChange={(e) => setFormVar((p) => ({ ...p, nome: e.target.value }))}
                  className="pl-8 pr-8 font-mono text-sm"
                  placeholder="nome_cliente"
                  disabled={formVar.nome === VARIAVEL_CPF_FIXO}
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm font-mono">{'}}'}</span>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Tipo do campo</Label>
              <Select
                value={formVar.tipo}
                onValueChange={(v) => setFormVar((p) => ({ ...p, tipo: v as ContratoVariavel['tipo'] }))}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="texto">Texto</SelectItem>
                  <SelectItem value="data">Data</SelectItem>
                  <SelectItem value="valor">Valor monetário</SelectItem>
                  <SelectItem value="cpf">CPF</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center justify-between rounded-lg border border-border p-3">
              <div>
                <p className="text-sm font-medium">Obrigatório</p>
                <p className="text-xs text-muted-foreground">Deve ser preenchido para gerar o contrato</p>
              </div>
              <Switch
                checked={formVar.obrigatorio}
                onCheckedChange={(v) => setFormVar((p) => ({ ...p, obrigatorio: v }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setVarDialog(false)}>Cancelar</Button>
            <Button
              onClick={handleSalvarVar}
              disabled={!formVar.label.trim() || !formVar.nome.trim() || isMutatingVar}
              className="bg-amber-500 hover:bg-amber-600 text-black font-semibold"
            >
              {isMutatingVar && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Salvar campo
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── AlertDialog excluir variável ────────────────────── */}
      <AlertDialog open={!!deleteVarId} onOpenChange={(o) => { if (!o) setDeleteVarId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir campo variável?</AlertDialogTitle>
            <AlertDialogDescription>
              O campo será removido. Se estiver no modelo, a variável ficará sem substituição.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-500 hover:bg-red-600"
              onClick={() => { if (deleteVarId) { excluirVariavel.mutate(deleteVarId); setDeleteVarId(null); } }}
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
