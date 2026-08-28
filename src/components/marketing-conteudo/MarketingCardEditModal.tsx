import { useState, useEffect, useRef } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { Trash2, ChevronDown, FileText, Star, Eye, ArrowLeft, Square, Circle, Triangle, StickyNote, Layout, Send, CheckCircle2, Maximize2, Minimize2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  MarketingContentCard,
  MarketingColumn,
  MarketingTrafficSource,
  MarketingFunnelStage,
  MarketingProduct,
} from '@/hooks/useMarketingConteudo';
import { MarketingBoardTemplate } from '@/hooks/useMarketingBoardTemplates';
import { MediaInsertButton } from './MediaInsertButton';
import { ScriptMediaPreview } from './ScriptMediaPreview';
import { CardTasksSection } from './CardTasksSection';
import { BoardPreview } from './planning-board/BoardPreview';
import { AIGenerateButton } from './AIGenerateButton';
import { ScriptEditor, ScriptEditorRef } from './ScriptEditor';

interface MarketingCardEditModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  card: MarketingContentCard | null;
  columns: MarketingColumn[];
  trafficSources: MarketingTrafficSource[];
  funnelStages: MarketingFunnelStage[];
  products: MarketingProduct[];
  centralTemplates: MarketingBoardTemplate[];
  onSave: (updates: Partial<MarketingContentCard> & { id?: string }) => void;
  onDelete?: (id: string) => void;
  onSendForApproval?: (cardId: string, cardTitulo: string) => void;
  onApprove?: (cardId: string) => void;
  isNew?: boolean;
  defaultColumnId?: string;
}

export function MarketingCardEditModal({
  open,
  onOpenChange,
  card,
  columns,
  trafficSources,
  funnelStages,
  products,
  centralTemplates,
  onSave,
  onDelete,
  onSendForApproval,
  onApprove,
  isNew = false,
  defaultColumnId,
}: MarketingCardEditModalProps) {
  const [titulo, setTitulo] = useState('');
  const [scriptCopy, setScriptCopy] = useState('');
  const [columnId, setColumnId] = useState('');
  const [selectedSources, setSelectedSources] = useState<string[]>([]);
  const [funnelStageId, setFunnelStageId] = useState<string>('');
  const [productId, setProductId] = useState<string>('');
  const [performando, setPerformando] = useState(false);
  const [urgente, setUrgente] = useState(false);
  const [planningOpen, setPlanningOpen] = useState(false);
  const [viewingTemplate, setViewingTemplate] = useState<MarketingBoardTemplate | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const scriptEditorRef = useRef<ScriptEditorRef>(null);
  const modalFullscreenBeforeEditorRef = useRef<boolean>(false);
  const editorWasFullscreenRef = useRef<boolean>(false);

  const hasPlanningContent = centralTemplates.length > 0;

  // Reset form state when opening modal
  useEffect(() => {
    if (!open) return; // Só executar quando o modal abrir
    
    if (card) {
      // Modo edição: carregar dados do card
      setTitulo(card.titulo);
      setScriptCopy(card.script_copy || '');
      setColumnId(card.column_id);
      setSelectedSources(card.traffic_sources || []);
      setFunnelStageId(card.funnel_stage_id || '');
      setProductId(card.product_id || '');
      setPerformando(card.performando);
      setUrgente(card.urgente);
    } else if (isNew) {
      // Modo criação: limpar todos os campos
      setTitulo('');
      setScriptCopy('');
      setColumnId(defaultColumnId || '');
      setSelectedSources([]);
      setFunnelStageId('');
      setProductId('');
      setPerformando(false);
      setUrgente(false);
    }
  }, [open, card, isNew, defaultColumnId]);

  useEffect(() => {
    if (open) {
      // Reset to normal size when opening
      setIsFullscreen(false);
      setViewingTemplate(null);
      modalFullscreenBeforeEditorRef.current = false;
      editorWasFullscreenRef.current = false;
    }
  }, [open]);

  const handleSave = () => {
    const updates: Partial<MarketingContentCard> & { id?: string } = {
      titulo,
      script_copy: scriptCopy || null,
      column_id: columnId,
      traffic_sources: selectedSources,
      funnel_stage_id: funnelStageId || null,
      product_id: productId || null,
      performando,
      urgente,
    };

    if (card) {
      updates.id = card.id;
    }

    onSave(updates);
    onOpenChange(false);
  };

  const handleSourceToggle = (sourceId: string) => {
    setSelectedSources(prev =>
      prev.includes(sourceId)
        ? prev.filter(id => id !== sourceId)
        : [...prev, sourceId]
    );
  };

  const handleInsertMedia = (tag: string) => {
    if (scriptEditorRef.current) {
      scriptEditorRef.current.insertAtCursor(tag);
    } else {
      setScriptCopy(prev => prev + tag);
    }
  };

  const handleDelete = () => {
    if (card && onDelete) {
      onDelete(card.id);
      onOpenChange(false);
    }
  };

  const getShapeIcon = (tipo: string) => {
    switch (tipo) {
      case 'circle': return <Circle className="h-4 w-4" />;
      case 'triangle': return <Triangle className="h-4 w-4" />;
      default: return <Square className="h-4 w-4" />;
    }
  };

  // Template View Mode
  if (viewingTemplate) {
    const { nodes = [], shapes = [], edges = [], drawings = [], files = [] } = viewingTemplate.board_data;
    
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <div className="flex items-center gap-2">
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={() => setViewingTemplate(null)}
                className="h-8 w-8"
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <DialogTitle className="flex items-center gap-2">
                <Star className="h-4 w-4 text-yellow-500 fill-current" />
                {viewingTemplate.nome}
              </DialogTitle>
            </div>
          </DialogHeader>

          <ScrollArea className="flex-1 pr-4">
            <div className="space-y-6 py-4">
              {/* Summary */}
              <div className="flex flex-wrap gap-2">
                <Badge variant="outline">{nodes.length} nós</Badge>
                <Badge variant="outline">{shapes.length} formas</Badge>
                <Badge variant="outline">{edges.length} conexões</Badge>
                <Badge variant="outline">{drawings.length} desenhos</Badge>
                <Badge variant="outline">{files.length} arquivos</Badge>
              </div>

              {/* Visual Board Preview */}
              <div className="space-y-3">
                <h4 className="font-semibold flex items-center gap-2">
                  <Layout className="h-4 w-4" />
                  Visualização da Lousa
                </h4>
                <BoardPreview
                  nodes={nodes}
                  shapes={shapes}
                  edges={edges}
                  drawings={drawings}
                  files={files}
                  className="h-80"
                />
                <p className="text-xs text-muted-foreground text-center">
                  Use a roda do mouse para zoom • Arraste para navegar
                </p>
              </div>

              {/* Nodes details */}
              {nodes.length > 0 && (
                <Collapsible>
                  <CollapsibleTrigger className="flex items-center gap-2 w-full text-left font-semibold hover:text-primary transition-colors">
                    <ChevronDown className="h-4 w-4" />
                    <StickyNote className="h-4 w-4" />
                    Detalhes dos Nós ({nodes.length})
                  </CollapsibleTrigger>
                  <CollapsibleContent className="mt-3">
                    <div className="grid gap-3">
                      {nodes.map((node: any, index: number) => (
                        <div key={node.id || index} className="bg-muted/50 rounded-lg p-4 border">
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1">
                              <p className="font-medium">{node.titulo || 'Sem título'}</p>
                              {node.conteudo && (
                                <p className="text-sm text-muted-foreground mt-1 whitespace-pre-wrap">
                                  {node.conteudo}
                                </p>
                              )}
                            </div>
                            {node.classificacao && (
                              <Badge variant="secondary" className="shrink-0">
                                {node.classificacao}
                              </Badge>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              )}

              {/* Shapes details */}
              {shapes.length > 0 && (
                <Collapsible>
                  <CollapsibleTrigger className="flex items-center gap-2 w-full text-left font-semibold hover:text-primary transition-colors">
                    <ChevronDown className="h-4 w-4" />
                    <Square className="h-4 w-4" />
                    Detalhes das Formas ({shapes.length})
                  </CollapsibleTrigger>
                  <CollapsibleContent className="mt-3">
                    <div className="grid gap-2">
                      {shapes.map((shape: any, index: number) => (
                        <div key={shape.id || index} className="bg-muted/50 rounded-lg p-3 border flex items-center gap-3">
                          <div 
                            className="w-6 h-6 rounded flex items-center justify-center"
                            style={{ backgroundColor: shape.cor || '#gray' }}
                          >
                            {getShapeIcon(shape.tipo)}
                          </div>
                          <div className="flex-1">
                            <span className="text-sm capitalize">{shape.tipo}</span>
                            {shape.texto && (
                              <p className="text-xs text-muted-foreground">{shape.texto}</p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              )}

              {/* Files details */}
              {files.length > 0 && (
                <Collapsible>
                  <CollapsibleTrigger className="flex items-center gap-2 w-full text-left font-semibold hover:text-primary transition-colors">
                    <ChevronDown className="h-4 w-4" />
                    <FileText className="h-4 w-4" />
                    Arquivos ({files.length})
                  </CollapsibleTrigger>
                  <CollapsibleContent className="mt-3">
                    <div className="grid gap-2">
                      {files.map((file: any, index: number) => (
                        <div key={file.id || index} className="bg-muted/50 rounded-lg p-3 border">
                          <a 
                            href={file.file_url} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="text-sm text-primary hover:underline"
                          >
                            {file.file_name}
                          </a>
                          <p className="text-xs text-muted-foreground">{file.file_type}</p>
                        </div>
                      ))}
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              )}
            </div>
          </ScrollArea>

          <DialogFooter>
            <Button variant="outline" onClick={() => setViewingTemplate(null)}>
              Voltar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent 
        className={cn(
          "overflow-y-auto transition-all duration-300",
          isFullscreen 
            ? "!max-w-[100vw] !w-[100vw] !h-[100vh] !max-h-[100vh] !rounded-none m-0" 
            : "w-[95vw] max-w-2xl max-h-[90vh] md:w-auto"
        )}
      >
        <DialogHeader className="flex flex-row items-center justify-between gap-2 pr-10">
          <DialogTitle className="flex-1">
            {isNew ? 'Novo Card de Conteúdo' : 'Editar Card de Conteúdo'}
          </DialogTitle>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsFullscreen(!isFullscreen)}
            className="h-8 px-3 shrink-0 gap-1.5"
            title={isFullscreen ? 'Minimizar' : 'Expandir'}
          >
            {isFullscreen ? (
              <>
                <Minimize2 className="h-4 w-4" />
                <span className="hidden sm:inline text-xs">Minimizar</span>
              </>
            ) : (
              <>
                <Maximize2 className="h-4 w-4" />
                <span className="hidden sm:inline text-xs">Expandir</span>
              </>
            )}
          </Button>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Planejamento Central - Collapsible Section */}
          {hasPlanningContent && (
            <Collapsible open={planningOpen} onOpenChange={setPlanningOpen}>
              <CollapsibleTrigger asChild>
                <Button 
                  variant="outline" 
                  className="w-full justify-between bg-blue-50 border-blue-200 hover:bg-blue-100 dark:bg-blue-950/30 dark:border-blue-800"
                >
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-blue-600" />
                    <span className="font-medium text-blue-700 dark:text-blue-400">
                      Planejamento Central
                    </span>
                  </div>
                  <ChevronDown className={`h-4 w-4 text-blue-600 transition-transform ${planningOpen ? 'rotate-180' : ''}`} />
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="mt-2">
                <div className="bg-muted/50 rounded-lg p-4 border space-y-3">
                  <div className="flex items-center gap-1 mb-2">
                    <Star className="h-4 w-4 text-yellow-500 fill-current" />
                    <span className="text-sm font-medium">Templates Centrais</span>
                  </div>
                  <ScrollArea className="max-h-64 pr-2">
                    <div className="space-y-2">
                      {centralTemplates.map(template => (
                        <button
                          key={template.id}
                          onClick={() => setViewingTemplate(template)}
                          className="w-full text-left bg-background rounded p-3 border hover:bg-muted/50 transition-colors group"
                        >
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="font-medium text-sm">{template.nome}</p>
                              <p className="text-xs text-muted-foreground mt-1">
                                {template.board_data.nodes?.length || 0} nós, {template.board_data.shapes?.length || 0} formas
                              </p>
                            </div>
                            <Eye className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
                          </div>
                        </button>
                      ))}
                    </div>
                  </ScrollArea>
                </div>
              </CollapsibleContent>
            </Collapsible>
          )}

          {/* Título */}
          <div className="space-y-2">
            <Label htmlFor="titulo">Título</Label>
            <Input
              id="titulo"
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              placeholder="Nome do conteúdo"
            />
          </div>

          {/* Script de Copy */}
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <Label htmlFor="script">Script de Copy</Label>
              <div className="flex items-center gap-2">
                <AIGenerateButton
                  cardId={card?.id}
                  titulo={titulo}
                  scriptCopy={scriptCopy}
                  columnId={columnId}
                  isNewCard={isNew}
                  onGenerated={(result) => {
                    setScriptCopy(result.conteudo);
                    if (result.titulo && !titulo.trim()) {
                      setTitulo(result.titulo);
                    }
                  }}
                />
                <MediaInsertButton onInsert={handleInsertMedia} />
              </div>
            </div>
            <ScriptEditor
              ref={scriptEditorRef}
              value={scriptCopy}
              onChange={setScriptCopy}
              placeholder="Escreva o script do conteúdo aqui. Use o botão 'Inserir Mídia' para adicionar imagens, vídeos ou áudios..."
              onFullscreenChange={(editorFullscreen) => {
                // Important: ScriptEditor fires onFullscreenChange(false) on mount.
                // We must ignore that initial "false" to avoid restoring an old fullscreen state.
                if (editorFullscreen) {
                  editorWasFullscreenRef.current = true;
                  modalFullscreenBeforeEditorRef.current = isFullscreen;
                  setIsFullscreen(true);
                  return;
                }

                if (!editorWasFullscreenRef.current) return;
                editorWasFullscreenRef.current = false;
                setIsFullscreen(modalFullscreenBeforeEditorRef.current);
              }}
            />
            
            {/* Media Preview */}
            <ScriptMediaPreview 
              scriptContent={scriptCopy}
              onRemoveMedia={(mediaId) => {
                // Remove all occurrences of this media tag from the script
                const regex = new RegExp(`\\[media:${mediaId}\\]`, 'gi');
                setScriptCopy(prev => prev.replace(regex, '').trim());
              }}
            />
            
            <p className="text-xs text-muted-foreground">
              As mídias são inseridas como tags [media:id] e serão exibidas ao visualizar o conteúdo.
            </p>
          </div>

          {/* Coluna */}
          <div className="space-y-2">
            <Label>Coluna</Label>
            <Select value={columnId} onValueChange={setColumnId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione a coluna" />
              </SelectTrigger>
              <SelectContent>
                {columns.map(col => (
                  <SelectItem key={col.id} value={col.id}>
                    {col.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Origens de Tráfego */}
          <div className="space-y-2">
            <Label>Origens de Tráfego</Label>
            <div className="flex flex-wrap gap-3">
              {trafficSources.map(source => (
                <label key={source.id} className="flex items-center gap-2 cursor-pointer">
                  <Checkbox
                    checked={selectedSources.includes(source.id)}
                    onCheckedChange={() => handleSourceToggle(source.id)}
                  />
                  <span className="text-sm">{source.nome}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Etapa do Funil */}
          <div className="space-y-2">
            <Label>Etapa do Funil</Label>
            <Select value={funnelStageId || "none"} onValueChange={(val) => setFunnelStageId(val === "none" ? "" : val)}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione a etapa" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Nenhuma</SelectItem>
                {funnelStages.map(stage => (
                  <SelectItem key={stage.id} value={stage.id}>
                    {stage.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Produto */}
          <div className="space-y-2">
            <Label>Produto</Label>
            <Select value={productId || "none"} onValueChange={(val) => setProductId(val === "none" ? "" : val)}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione o produto" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Nenhum</SelectItem>
                {products.map(product => (
                  <SelectItem key={product.id} value={product.id}>
                    {product.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex gap-6">
            <label className="flex items-center gap-2 cursor-pointer">
              <Switch checked={performando} onCheckedChange={setPerformando} />
              <span className="text-sm">Performando</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <Switch checked={urgente} onCheckedChange={setUrgente} />
              <span className="text-sm">Urgente</span>
            </label>
          </div>

          {/* Agendamentos Relacionados - only show when editing existing card */}
          {card && (
            <CardTasksSection card={card} allCards={[]} />
          )}
        </div>

        <DialogFooter className="flex flex-col sm:flex-row gap-2 sm:justify-between">
          <div className="flex gap-2">
            {!isNew && onDelete && (
              <Button variant="destructive" onClick={handleDelete}>
                <Trash2 className="h-4 w-4 mr-2" />
                Excluir
              </Button>
            )}
            
            {/* Botões de aprovação */}
            {!isNew && card && (() => {
              const approvalColumn = columns.find(c => 
                c.nome.toLowerCase().includes('enviados para aprovação')
              );
              const approvedColumn = columns.find(c => 
                c.nome.toLowerCase().includes('aprovados') && 
                !c.nome.toLowerCase().includes('enviados')
              );
              const isInApprovalColumn = approvalColumn && card.column_id === approvalColumn.id;
              const isInApprovedColumn = approvedColumn && card.column_id === approvedColumn.id;
              const canSendForApproval = !isInApprovalColumn && !isInApprovedColumn && onSendForApproval;

              return (
                <>
                  {canSendForApproval && (
                    <Button 
                      variant="outline" 
                      className="text-amber-600 border-amber-300 hover:bg-amber-50"
                      onClick={() => {
                        onSendForApproval(card.id, card.titulo);
                        onOpenChange(false);
                      }}
                    >
                      <Send className="h-4 w-4 mr-2" />
                      Enviar para aprovação
                    </Button>
                  )}
                  {isInApprovalColumn && onApprove && (
                    <Button 
                      className="bg-green-600 hover:bg-green-700"
                      onClick={() => {
                        onApprove(card.id);
                        onOpenChange(false);
                      }}
                    >
                      <CheckCircle2 className="h-4 w-4 mr-2" />
                      Aprovar
                    </Button>
                  )}
                </>
              );
            })()}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={!titulo || !columnId}>
              {isNew ? 'Criar' : 'Salvar'}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}