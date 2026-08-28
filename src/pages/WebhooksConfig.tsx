import { useState } from 'react';
import { Plus, Pencil, Trash2, Webhook as WebhookIcon, Info, Copy, Check, PlusCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useWebhooks, type Webhook, type WebhookInsert, REGIAO_TABELA_MAP, TABELA_REGIAO_MAP } from '@/hooks/useWebhooks';
import { toast } from 'sonner';

const TIPOS_WEBHOOK_DEFAULT = [
  { value: 'whatsapp', label: 'WhatsApp' },
  { value: 'relatorio_reunioes', label: 'Relatório de reuniões' },
  { value: 'geral', label: 'Geral' },
];
const REGIOES = Object.keys(REGIAO_TABELA_MAP);
const SUPABASE_URL = 'https://zzqgtclvuetemzhqzhbq.supabase.co';
export default function WebhooksConfig() {
  const {
    webhooks,
    isLoading,
    createWebhook,
    updateWebhook,
    deleteWebhook
  } = useWebhooks();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [editingWebhook, setEditingWebhook] = useState<Webhook | null>(null);
  const [webhookToDelete, setWebhookToDelete] = useState<Webhook | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  
  // Custom tipos state
  const [tiposWebhook, setTiposWebhook] = useState(TIPOS_WEBHOOK_DEFAULT);
  const [novoTipo, setNovoTipo] = useState('');
  const [isAddTipoOpen, setIsAddTipoOpen] = useState(false);

  // Form state
  const [nome, setNome] = useState('');
  const [tipo, setTipo] = useState('');
  const [regiao, setRegiao] = useState('');
  const [url, setUrl] = useState('');
  const [descricao, setDescricao] = useState('');
  const [ativo, setAtivo] = useState(true);
  
  const handleAddTipo = () => {
    const tipoTrimmed = novoTipo.trim();
    if (!tipoTrimmed) {
      toast.error('Digite um nome para o tipo');
      return;
    }
    if (tiposWebhook.some(t => t.value.toLowerCase() === tipoTrimmed.toLowerCase())) {
      toast.error('Este tipo já existe');
      return;
    }
    setTiposWebhook([...tiposWebhook, { value: tipoTrimmed.toLowerCase(), label: tipoTrimmed }]);
    setTipo(tipoTrimmed.toLowerCase());
    setNovoTipo('');
    setIsAddTipoOpen(false);
    toast.success(`Tipo "${tipoTrimmed}" adicionado!`);
  };
  const resetForm = () => {
    setNome('');
    setTipo('');
    setRegiao('');
    setUrl('');
    setDescricao('');
    setAtivo(true);
    setEditingWebhook(null);
  };
  const openCreateDialog = () => {
    resetForm();
    setIsDialogOpen(true);
  };
  const openEditDialog = (webhook: Webhook) => {
    setEditingWebhook(webhook);
    setNome(webhook.nome);
    setTipo(webhook.tipo);
    setRegiao(webhook.tabela_origem ? TABELA_REGIAO_MAP[webhook.tabela_origem] || '' : '');
    setUrl(webhook.url);
    setDescricao(webhook.descricao || '');
    setAtivo(webhook.ativo ?? true);
    setIsDialogOpen(true);
  };
  const openDeleteDialog = (webhook: Webhook) => {
    setWebhookToDelete(webhook);
    setIsDeleteDialogOpen(true);
  };
  const handleSave = async () => {
    if (!nome.trim() || !url.trim()) {
      return;
    }
    const webhookData: WebhookInsert = {
      nome: nome.trim(),
      tipo: tipo.trim() || 'geral',
      tabela_origem: regiao ? REGIAO_TABELA_MAP[regiao] : null,
      url: url.trim(),
      descricao: descricao.trim() || null,
      ativo
    };
    if (editingWebhook) {
      await updateWebhook.mutateAsync({
        id: editingWebhook.id,
        updates: webhookData
      });
    } else {
      await createWebhook.mutateAsync(webhookData);
    }
    setIsDialogOpen(false);
    resetForm();
  };
  const handleDelete = async () => {
    if (webhookToDelete) {
      await deleteWebhook.mutateAsync(webhookToDelete.id);
      setIsDeleteDialogOpen(false);
      setWebhookToDelete(null);
    }
  };
  const getRegiaoFromTabela = (tabela: string | null): string => {
    if (!tabela) return '-';
    return TABELA_REGIAO_MAP[tabela] || tabela;
  };
  const truncateUrl = (url: string, maxLength: number = 50): string => {
    if (url.length <= maxLength) return url;
    return url.substring(0, maxLength) + '...';
  };
  const getReceiveWebhookUrl = (webhookId: string): string => {
    return `${SUPABASE_URL}/functions/v1/crm-selletos-receber-webhook?webhook_id=${webhookId}`;
  };
  const copyToClipboard = async (text: string, webhookId: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(webhookId);
      toast.success('URL copiada para a área de transferência!');
      setTimeout(() => setCopiedId(null), 2000);
    } catch (err) {
      toast.error('Erro ao copiar URL');
    }
  };
  const isFormValid = nome.trim() && url.trim() && url.startsWith('https://');
  return <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-bold tracking-tight text-2xl">Configuração de Webhooks</h1>
          <p className="text-muted-foreground">
            Gerencie os webhooks de integração do sistema
          </p>
        </div>
        <Button onClick={openCreateDialog}>
          <Plus className="h-4 w-4 mr-2" />
          Adicionar Webhook
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <WebhookIcon className="h-5 w-5" />
            Webhooks Configurados
          </CardTitle>
          <CardDescription>
            Lista de todos os webhooks ativos e inativos do sistema
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div> : webhooks.length === 0 ? <div className="text-center py-8 text-muted-foreground">
              Nenhum webhook configurado ainda.
            </div> : <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Região</TableHead>
                  <TableHead>URL Envio</TableHead>
                  <TableHead>URL Recebimento</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {webhooks.map(webhook => <TableRow key={webhook.id}>
                    <TableCell className="font-medium">{webhook.nome}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="capitalize">
                        {webhook.tipo}
                      </Badge>
                    </TableCell>
                    <TableCell>{getRegiaoFromTabela(webhook.tabela_origem)}</TableCell>
                    <TableCell>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="text-sm text-muted-foreground cursor-help">
                            {truncateUrl(webhook.url, 30)}
                          </span>
                        </TooltipTrigger>
                        <TooltipContent side="top" className="max-w-md break-all">
                          {webhook.url}
                        </TooltipContent>
                      </Tooltip>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className="text-xs text-muted-foreground cursor-help max-w-[120px] truncate block">
                              {truncateUrl(getReceiveWebhookUrl(webhook.id), 25)}
                            </span>
                          </TooltipTrigger>
                          <TooltipContent side="top" className="max-w-md break-all">
                            <p className="font-semibold mb-1">URL para n8n enviar respostas:</p>
                            <p className="font-mono text-xs">{getReceiveWebhookUrl(webhook.id)}</p>
                          </TooltipContent>
                        </Tooltip>
                        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => copyToClipboard(getReceiveWebhookUrl(webhook.id), webhook.id)}>
                          {copiedId === webhook.id ? <Check className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3" />}
                        </Button>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={webhook.ativo ? 'default' : 'secondary'}>
                        {webhook.ativo ? 'Ativo' : 'Inativo'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button variant="ghost" size="icon" onClick={() => openEditDialog(webhook)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => openDeleteDialog(webhook)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>)}
              </TableBody>
            </Table>}
        </CardContent>
      </Card>

      <Alert>
        <Info className="h-4 w-4" />
        <AlertTitle>Como funciona o roteamento de webhooks</AlertTitle>
        <AlertDescription className="mt-2 space-y-2">
          <p>
            O sistema detecta automaticamente a região do lead baseado em:
          </p>
          <ol className="list-decimal list-inside space-y-1 ml-2">
            <li>Histórico de conversas existente</li>
            <li>DDD do telefone (fallback)</li>
          </ol>
          <p className="text-sm text-muted-foreground mt-2">
            <strong>DDDs de São Paulo:</strong> 11-19 | <strong>Demais DDDs:</strong> Minas Gerais
          </p>
        </AlertDescription>
      </Alert>

      <Alert variant="default" className="border-blue-200 bg-blue-50 dark:border-blue-900 dark:bg-blue-950/30">
        <WebhookIcon className="h-4 w-4 text-blue-600" />
        <AlertTitle className="text-blue-800 dark:text-blue-300">Configurar recebimento de respostas</AlertTitle>
        <AlertDescription className="mt-2 space-y-2 text-blue-700 dark:text-blue-400">
          <p>
            Para receber respostas dos leads no chat do CRM, configure seu n8n para enviar uma requisição POST para a <strong>URL de Recebimento</strong> do webhook correspondente.
          </p>
          <div className="bg-white dark:bg-slate-900 rounded p-3 mt-2 font-mono text-xs">
            <p className="font-semibold mb-2">Payload esperado:</p>
            <pre className="whitespace-pre-wrap">{`{
  "telefone": "5531999999999",
  "tipo": "texto",  // ou "audio", "imagem", "pdf"
  "conteudo": "Mensagem do lead",
  "url_midia": "https://...",  // opcional
  "nome_contato": "Nome do Lead"  // opcional
}`}</pre>
          </div>
        </AlertDescription>
      </Alert>

      {/* Dialog de Criar/Editar */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>
              {editingWebhook ? 'Editar Webhook' : 'Adicionar Webhook'}
            </DialogTitle>
            <DialogDescription>
              {editingWebhook ? 'Altere as informações do webhook abaixo.' : 'Preencha as informações para criar um novo webhook.'}
            </DialogDescription>
          </DialogHeader>
          
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="nome">Nome *</Label>
              <Input id="nome" placeholder="Ex: Envio WhatsApp São Paulo" value={nome} onChange={e => setNome(e.target.value)} />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="tipo">Tipo</Label>
              <div className="flex gap-2">
                <Select value={tipo} onValueChange={setTipo}>
                  <SelectTrigger className="flex-1">
                    <SelectValue placeholder="Selecione o tipo (padrão: Geral)" />
                  </SelectTrigger>
                  <SelectContent>
                    {tiposWebhook.map(t => <SelectItem key={t.value} value={t.value}>
                        {t.label}
                      </SelectItem>)}
                  </SelectContent>
                </Select>
                <Popover open={isAddTipoOpen} onOpenChange={setIsAddTipoOpen}>
                  <PopoverTrigger asChild>
                    <Button type="button" variant="outline" size="icon" className="shrink-0">
                      <PlusCircle className="h-4 w-4" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-64 bg-background" align="end">
                    <div className="grid gap-3">
                      <Label htmlFor="novoTipo">Adicionar novo tipo</Label>
                      <Input 
                        id="novoTipo" 
                        placeholder="Ex: Email, SMS..." 
                        value={novoTipo} 
                        onChange={e => setNovoTipo(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && handleAddTipo()}
                      />
                      <Button size="sm" onClick={handleAddTipo}>
                        Adicionar
                      </Button>
                    </div>
                  </PopoverContent>
                </Popover>
              </div>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="regiao">Região</Label>
              <Select value={regiao} onValueChange={setRegiao}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a região (opcional)" />
                </SelectTrigger>
                <SelectContent>
                  {REGIOES.map(r => <SelectItem key={r} value={r}>
                      {r}
                    </SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="url">URL do Webhook (Envio) *</Label>
              <Input id="url" placeholder="https://..." value={url} onChange={e => setUrl(e.target.value)} />
              {url && !url.startsWith('https://') && <p className="text-sm text-destructive">A URL deve começar com https://</p>}
              <p className="text-xs text-muted-foreground">
                URL do n8n para onde as mensagens serão enviadas
              </p>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="descricao">Descrição</Label>
              <Textarea id="descricao" placeholder="Descrição opcional do webhook..." value={descricao} onChange={e => setDescricao(e.target.value)} rows={2} />
            </div>

            <div className="flex items-center justify-between">
              <Label htmlFor="ativo">Status</Label>
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">
                  {ativo ? 'Ativo' : 'Inativo'}
                </span>
                <Switch id="ativo" checked={ativo} onCheckedChange={setAtivo} />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={!isFormValid || createWebhook.isPending || updateWebhook.isPending}>
              {createWebhook.isPending || updateWebhook.isPending ? 'Salvando...' : 'Salvar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* AlertDialog de Exclusão */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir webhook?</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir o webhook "{webhookToDelete?.nome}"? 
              Esta ação não pode ser desfeita e o envio de mensagens para esta região será interrompido.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {deleteWebhook.isPending ? 'Excluindo...' : 'Excluir'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>;
}