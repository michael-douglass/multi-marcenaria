import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Trash2, Plus, GripVertical, Sparkles, Save, Loader2, ChevronDown } from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  useMarketingColumns,
  useMarketingTrafficSources,
  useMarketingFunnelStages,
  useMarketingProducts,
} from '@/hooks/useMarketingConteudo';
import { useMarketingAIWebhookConfig } from '@/hooks/useMarketingAIWebhook';
import { MarketingAIStudioPanel } from './ai-studio/MarketingAIStudioPanel';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';

export function MarketingSettingsTab() {
  const { columns, createColumn, updateColumn, deleteColumn } = useMarketingColumns();
  const { sources, createSource, deleteSource } = useMarketingTrafficSources();
  const { stages, createStage, deleteStage } = useMarketingFunnelStages();
  const { products, createProduct, deleteProduct } = useMarketingProducts();
  const { config: aiWebhookConfig, saveConfig: saveAIWebhook, toggleActive: toggleAIWebhook, webhooks, selectedWebhook } = useMarketingAIWebhookConfig();

  const [newColumnName, setNewColumnName] = useState('');
  const [newSourceName, setNewSourceName] = useState('');
  const [newStageName, setNewStageName] = useState('');
  const [newProductName, setNewProductName] = useState('');
  const [selectedWebhookId, setSelectedWebhookId] = useState<string>('');
  const [isSavingAIWebhook, setIsSavingAIWebhook] = useState(false);
  const [legacyWebhookOpen, setLegacyWebhookOpen] = useState(false);

  const [editColumnDialog, setEditColumnDialog] = useState(false);
  const [editingColumn, setEditingColumn] = useState<{ id: string; nome: string } | null>(null);

  // Sync selected webhook from config
  useEffect(() => {
    if (aiWebhookConfig?.webhook_id) {
      setSelectedWebhookId(aiWebhookConfig.webhook_id);
    }
  }, [aiWebhookConfig]);

  const handleAddColumn = () => {
    if (newColumnName.trim()) {
      createColumn(newColumnName.trim());
      setNewColumnName('');
    }
  };

  const handleAddSource = () => {
    if (newSourceName.trim()) {
      createSource(newSourceName.trim());
      setNewSourceName('');
    }
  };

  const handleAddStage = () => {
    if (newStageName.trim()) {
      createStage(newStageName.trim());
      setNewStageName('');
    }
  };

  const handleAddProduct = () => {
    if (newProductName.trim()) {
      createProduct(newProductName.trim());
      setNewProductName('');
    }
  };

  const handleEditColumn = (col: { id: string; nome: string }) => {
    setEditingColumn(col);
    setEditColumnDialog(true);
  };

  const handleSaveColumn = () => {
    if (editingColumn && editingColumn.nome.trim()) {
      updateColumn({ id: editingColumn.id, nome: editingColumn.nome.trim() });
      setEditColumnDialog(false);
      setEditingColumn(null);
    }
  };

  const handleSaveAIWebhook = async () => {
    if (!selectedWebhookId) return;
    setIsSavingAIWebhook(true);
    try {
      await saveAIWebhook.mutateAsync(selectedWebhookId);
    } finally {
      setIsSavingAIWebhook(false);
    }
  };

  return (
    <div className="space-y-6 p-4">
      {/* Colunas do Kanban */}
      <Card>
        <CardHeader>
          <CardTitle>Colunas do Kanban</CardTitle>
          <CardDescription>Gerencie as colunas do quadro de conteúdos</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2 mb-4">
            <Input
              placeholder="Nome da nova coluna"
              value={newColumnName}
              onChange={(e) => setNewColumnName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAddColumn()}
            />
            <Button onClick={handleAddColumn}>
              <Plus className="h-4 w-4 mr-2" />
              Adicionar
            </Button>
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12"></TableHead>
                <TableHead>Nome</TableHead>
                <TableHead>Ordem</TableHead>
                <TableHead className="w-24">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {columns.map((col) => (
                <TableRow key={col.id}>
                  <TableCell>
                    <GripVertical className="h-4 w-4 text-muted-foreground" />
                  </TableCell>
                  <TableCell 
                    className="cursor-pointer hover:text-primary"
                    onClick={() => handleEditColumn(col)}
                  >
                    {col.nome}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{col.ordem + 1}</Badge>
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => deleteColumn(col.id)}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Origens de Tráfego */}
      <Card>
        <CardHeader>
          <CardTitle>Origens de Tráfego</CardTitle>
          <CardDescription>Plataformas onde o conteúdo será publicado</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2 mb-4">
            <Input
              placeholder="Nome da origem"
              value={newSourceName}
              onChange={(e) => setNewSourceName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAddSource()}
            />
            <Button onClick={handleAddSource}>
              <Plus className="h-4 w-4 mr-2" />
              Adicionar
            </Button>
          </div>

          <div className="flex flex-wrap gap-2">
            {sources.map((source) => (
              <Badge key={source.id} variant="secondary" className="px-3 py-1.5 text-sm">
                {source.nome}
                <button
                  onClick={() => deleteSource(source.id)}
                  className="ml-2 hover:text-destructive"
                >
                  ×
                </button>
              </Badge>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Etapas do Funil */}
      <Card>
        <CardHeader>
          <CardTitle>Etapas do Funil</CardTitle>
          <CardDescription>Classificação do conteúdo por etapa do funil</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2 mb-4">
            <Input
              placeholder="Nome da etapa"
              value={newStageName}
              onChange={(e) => setNewStageName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAddStage()}
            />
            <Button onClick={handleAddStage}>
              <Plus className="h-4 w-4 mr-2" />
              Adicionar
            </Button>
          </div>

          <div className="flex flex-wrap gap-2">
            {stages.map((stage) => (
              <Badge key={stage.id} variant="outline" className="px-3 py-1.5 text-sm">
                {stage.nome}
                <button
                  onClick={() => deleteStage(stage.id)}
                  className="ml-2 hover:text-destructive"
                >
                  ×
                </button>
              </Badge>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Produtos */}
      <Card>
        <CardHeader>
          <CardTitle>Produtos</CardTitle>
          <CardDescription>Classificação do conteúdo por produto ou serviço</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2 mb-4">
            <Input
              placeholder="Nome do produto"
              value={newProductName}
              onChange={(e) => setNewProductName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAddProduct()}
            />
            <Button onClick={handleAddProduct}>
              <Plus className="h-4 w-4 mr-2" />
              Adicionar
            </Button>
          </div>

          <div className="flex flex-wrap gap-2">
            {products.map((product) => (
              <Badge key={product.id} variant="default" className="px-3 py-1.5 text-sm bg-primary/80">
                {product.nome}
                <button
                  onClick={() => deleteProduct(product.id)}
                  className="ml-2 hover:text-destructive"
                >
                  ×
                </button>
              </Badge>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Studio de Copy (principal) */}
      <MarketingAIStudioPanel />

      {/* Webhook legado (n8n) */}
      <Collapsible open={legacyWebhookOpen} onOpenChange={setLegacyWebhookOpen}>
        <Card className="border-dashed border-muted-foreground/30">
          <CardHeader className="py-3">
            <CollapsibleTrigger asChild>
              <button
                type="button"
                className="flex w-full items-center justify-between gap-2 text-left"
              >
                <div>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Sparkles className="h-4 w-4 text-muted-foreground" />
                    Webhook legado (n8n)
                  </CardTitle>
                  <CardDescription className="mt-1">
                    Opcional. O Studio acima já gera e preenche o Script no card.
                  </CardDescription>
                </div>
                <ChevronDown
                  className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${
                    legacyWebhookOpen ? 'rotate-180' : ''
                  }`}
                />
              </button>
            </CollapsibleTrigger>
          </CardHeader>
          <CollapsibleContent>
            <CardContent className="space-y-4 pt-0">
              <div className="flex gap-2">
                <Select value={selectedWebhookId} onValueChange={setSelectedWebhookId}>
                  <SelectTrigger className="flex-1">
                    <SelectValue placeholder="Selecione um webhook" />
                  </SelectTrigger>
                  <SelectContent>
                    {webhooks.map((webhook) => (
                      <SelectItem key={webhook.id} value={webhook.id}>
                        <div className="flex flex-col">
                          <span>{webhook.nome}</span>
                          <span className="text-xs text-muted-foreground">{webhook.tipo}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  onClick={handleSaveAIWebhook}
                  disabled={isSavingAIWebhook || !selectedWebhookId}
                >
                  {isSavingAIWebhook ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4 mr-2" />
                  )}
                  Salvar
                </Button>
              </div>

              {selectedWebhook && (
                <div className="bg-muted/50 rounded-lg p-3 text-sm">
                  <strong>URL:</strong>{' '}
                  <span className="text-muted-foreground break-all">{selectedWebhook.url}</span>
                </div>
              )}

              {aiWebhookConfig && (
                <div className="flex items-center justify-between bg-muted/50 rounded-lg p-3">
                  <Label htmlFor="ai-webhook-active" className="text-sm">
                    Webhook ativo
                  </Label>
                  <Switch
                    id="ai-webhook-active"
                    checked={aiWebhookConfig.ativo}
                    onCheckedChange={(checked) => toggleAIWebhook.mutate(checked)}
                  />
                </div>
              )}
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      <Dialog open={editColumnDialog} onOpenChange={setEditColumnDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Coluna</DialogTitle>
          </DialogHeader>
          <Input
            value={editingColumn?.nome || ''}
            onChange={(e) => setEditingColumn(prev => prev ? { ...prev, nome: e.target.value } : null)}
            placeholder="Nome da coluna"
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditColumnDialog(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSaveColumn}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
