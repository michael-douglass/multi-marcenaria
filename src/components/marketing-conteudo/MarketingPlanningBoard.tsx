import { useState, useCallback, useRef, useEffect } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  Node,
  Edge,
  Connection,
  addEdge,
  useNodesState,
  useEdgesState,
  NodeTypes,
  Panel,
  BackgroundVariant,
  ReactFlowProvider,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Plus, X } from 'lucide-react';
import {
  useMarketingPlanningNodes,
  useMarketingContentCards,
  useMarketingColumns,
  MarketingPlanningNode,
} from '@/hooks/useMarketingConteudo';
import {
  useMarketingPlanningShapes,
  useMarketingPlanningEdges,
  useMarketingPlanningDrawings,
  useMarketingPlanningFiles,
} from '@/hooks/useMarketingPlanningAdvanced';
import { useMarketingBoardTemplates, BoardData, MarketingBoardTemplate } from '@/hooks/useMarketingBoardTemplates';
import { useToast } from '@/hooks/use-toast';
import { PlanningNodeComponent } from './planning-board/PlanningNode';
import { ShapeNode } from './planning-board/ShapeNode';
import { TextNode } from './planning-board/TextNode';
import { ImageNode } from './planning-board/ImageNode';
import { PDFNode } from './planning-board/PDFNode';
import { PlanningToolbar, ToolType } from './planning-board/PlanningToolbar';
import { DrawingCanvas } from './planning-board/DrawingCanvas';
import { SaveTemplateDialog } from './planning-board/SaveTemplateDialog';
import { TemplatesList } from './planning-board/TemplatesList';
import { cn } from '@/lib/utils';

const nodeTypes: NodeTypes = {
  planning: PlanningNodeComponent,
  shape: ShapeNode,
  text: TextNode,
  image: ImageNode,
  pdf: PDFNode,
};

function MarketingPlanningBoardInner() {
  const { nodes: dbNodes, createNode, updateNode, deleteNode } = useMarketingPlanningNodes();
  const { columns } = useMarketingColumns();
  const { createCard } = useMarketingContentCards();
  const { shapes, createShape, updateShape, deleteShape } = useMarketingPlanningShapes();
  const { edges: dbEdges, createEdge, deleteEdge } = useMarketingPlanningEdges();
  const { drawings, createDrawing, deleteDrawing, clearAllDrawings } = useMarketingPlanningDrawings();
  const { files, uploadFile, createFileFromTemplate, updateFile, deleteFile } = useMarketingPlanningFiles();
  const { templates, createTemplate, updateTemplate, deleteTemplate } = useMarketingBoardTemplates();
  const { toast } = useToast();

  const [activeTool, setActiveTool] = useState<ToolType>('select');
  const [drawingColor, setDrawingColor] = useState('#000000');
  const [viewportTransform, setViewportTransform] = useState({ x: 0, y: 0, zoom: 1 });
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<MarketingBoardTemplate | null>(null);
  const reactFlowWrapper = useRef<HTMLDivElement>(null);

  // Handler functions
  const handleNodeUpdate = useCallback((id: string, updates: Partial<MarketingPlanningNode>) => {
    updateNode({ id, ...updates });
  }, [updateNode]);

  const handleNodeDelete = useCallback((id: string) => {
    deleteNode(id);
  }, [deleteNode]);

  const handleShapeUpdate = useCallback((id: string, updates: { texto?: string; cor?: string }) => {
    updateShape({ id, ...updates });
  }, [updateShape]);

  const handleShapeDelete = useCallback((id: string) => {
    deleteShape(id);
  }, [deleteShape]);

  const handleFileDelete = useCallback((id: string) => {
    deleteFile(id);
  }, [deleteFile]);

  const handleSendToProduction = useCallback(async (node: MarketingPlanningNode) => {
    const firstColumn = columns[0];
    if (!firstColumn) {
      toast({
        title: 'Erro',
        description: 'Nenhuma coluna disponível no Kanban',
        variant: 'destructive',
      });
      return;
    }

    try {
      const card = await createCard({
        titulo: node.titulo,
        script_copy: node.conteudo,
        column_id: firstColumn.id,
        planning_node_id: node.id,
        traffic_sources: [],
        ordem: 0,
      });

      updateNode({
        id: node.id,
        enviado_producao: true,
        card_id: card.id,
      });

      toast({ title: 'Card enviado para produção!' });
    } catch (error) {
      toast({
        title: 'Erro ao enviar para produção',
        description: (error as Error).message,
        variant: 'destructive',
      });
    }
  }, [columns, createCard, updateNode, toast]);

  const handleShapeSendToProduction = useCallback(async (id: string, texto: string) => {
    const firstColumn = columns[0];
    if (!firstColumn) {
      toast({
        title: 'Erro',
        description: 'Nenhuma coluna disponível no Kanban',
        variant: 'destructive',
      });
      return;
    }

    try {
      const card = await createCard({
        titulo: texto || 'Sem título',
        script_copy: null,
        column_id: firstColumn.id,
        traffic_sources: [],
        ordem: 0,
      });

      updateShape({
        id,
        enviado_producao: true,
        card_id: card.id,
      });

      toast({ title: 'Forma convertida em card!' });
    } catch (error) {
      toast({
        title: 'Erro ao converter',
        description: (error as Error).message,
        variant: 'destructive',
      });
    }
  }, [columns, createCard, updateShape, toast]);

  // Build nodes from all sources
  const allNodes: Node[] = [
    // Planning nodes
    ...dbNodes.map((node) => ({
      id: `planning-${node.id}`,
      type: 'planning' as const,
      position: { x: node.position_x, y: node.position_y },
      data: {
        titulo: node.titulo,
        conteudo: node.conteudo,
        classificacao: node.classificacao,
        enviado_producao: node.enviado_producao,
        dbId: node.id,
        onUpdate: handleNodeUpdate,
        onDelete: handleNodeDelete,
        onSendToProduction: handleSendToProduction,
      },
    })),
    // Shape nodes (rectangles, circles, diamonds)
    ...shapes.filter((s) => s.tipo !== 'text').map((shape) => ({
      id: `shape-${shape.id}`,
      type: 'shape' as const,
      position: { x: shape.position_x, y: shape.position_y },
      data: {
        tipo: shape.tipo,
        texto: shape.texto || '',
        cor: shape.cor,
        enviado_producao: shape.enviado_producao,
        dbId: shape.id,
        onUpdate: handleShapeUpdate,
        onDelete: handleShapeDelete,
        onSendToProduction: handleShapeSendToProduction,
      },
    })),
    // Text nodes
    ...shapes.filter((s) => s.tipo === 'text').map((shape) => ({
      id: `text-${shape.id}`,
      type: 'text' as const,
      position: { x: shape.position_x, y: shape.position_y },
      data: {
        texto: shape.texto || '',
        cor: shape.cor,
        enviado_producao: shape.enviado_producao,
        dbId: shape.id,
        onUpdate: handleShapeUpdate,
        onDelete: handleShapeDelete,
        onSendToProduction: handleShapeSendToProduction,
      },
    })),
    // Image nodes
    ...files
      .filter((f) => f.file_type === 'image')
      .map((file) => ({
        id: `image-${file.id}`,
        type: 'image' as const,
        position: { x: file.position_x, y: file.position_y },
        data: {
          file_url: file.file_url,
          file_name: file.file_name,
          dbId: file.id,
          onDelete: handleFileDelete,
        },
      })),
    // PDF nodes
    ...files
      .filter((f) => f.file_type === 'pdf')
      .map((file) => ({
        id: `pdf-${file.id}`,
        type: 'pdf' as const,
        position: { x: file.position_x, y: file.position_y },
        data: {
          file_url: file.file_url,
          file_name: file.file_name,
          dbId: file.id,
          onDelete: handleFileDelete,
        },
      })),
  ];

  // Build edges from database
  const allEdges: Edge[] = dbEdges.map((edge) => ({
    id: edge.id,
    source: `${edge.source_type}-${edge.source_id}`,
    target: `${edge.target_type}-${edge.target_id}`,
    label: edge.label || undefined,
    type: 'smoothstep',
    animated: true,
  }));

  const [nodes, setNodes, onNodesChange] = useNodesState(allNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(allEdges);

  // Sync nodes when DB updates
  useEffect(() => {
    setNodes(allNodes);
  }, [dbNodes, shapes, files, handleNodeUpdate, handleNodeDelete, handleSendToProduction, handleShapeUpdate, handleShapeDelete, handleFileDelete, handleShapeSendToProduction]);

  // Sync edges when DB updates - use allEdges in dependency to properly reconstruct
  useEffect(() => {
    setEdges(allEdges);
  }, [dbEdges, setEdges]);

  const onConnect = useCallback(
    async (connection: Connection) => {
      if (!connection.source || !connection.target) return;

      // Parse source and target - handle UUIDs with hyphens correctly
      const sourceFirstHyphen = connection.source.indexOf('-');
      const targetFirstHyphen = connection.target.indexOf('-');
      
      const sourceType = connection.source.substring(0, sourceFirstHyphen);
      const sourceId = connection.source.substring(sourceFirstHyphen + 1);
      const targetType = connection.target.substring(0, targetFirstHyphen);
      const targetId = connection.target.substring(targetFirstHyphen + 1);

      // Save to database
      await createEdge({
        source_id: sourceId,
        source_type: sourceType,
        target_id: targetId,
        target_type: targetType,
      });

      setEdges((eds) => addEdge({ ...connection, type: 'smoothstep', animated: true }, eds));
    },
    [createEdge, setEdges]
  );

  const onEdgesDelete = useCallback(
    (edgesToDelete: Edge[]) => {
      edgesToDelete.forEach((edge) => {
        deleteEdge(edge.id);
      });
    },
    [deleteEdge]
  );

  const onNodeDragStop = useCallback(
    (_: React.MouseEvent, node: Node) => {
      // Parse node ID - handle UUIDs with hyphens correctly
      const firstHyphen = node.id.indexOf('-');
      const type = node.id.substring(0, firstHyphen);
      const id = node.id.substring(firstHyphen + 1);

      if (type === 'planning') {
        updateNode({
          id,
          position_x: node.position.x,
          position_y: node.position.y,
        });
      } else if (type === 'shape' || type === 'text') {
        updateShape({
          id,
          position_x: node.position.x,
          position_y: node.position.y,
        });
      } else if (type === 'image' || type === 'pdf') {
        updateFile({
          id,
          position_x: node.position.x,
          position_y: node.position.y,
        });
      }
    },
    [updateNode, updateShape, updateFile]
  );

  const handleAddNode = async () => {
    await createNode({
      titulo: 'Novo Planejamento',
      conteudo: '',
      position_x: Math.random() * 400 + 100,
      position_y: Math.random() * 300 + 100,
    });
  };

  const handleAddShape = async (tipo: 'rectangle' | 'circle' | 'diamond' | 'text') => {
    const colorMap = {
      rectangle: '#3b82f6',
      circle: '#22c55e',
      diamond: '#f59e0b',
      text: '#6366f1',
    };
    await createShape({
      tipo,
      position_x: Math.random() * 400 + 100,
      position_y: Math.random() * 300 + 100,
      cor: colorMap[tipo],
      width: tipo === 'text' ? 250 : 150,
      height: tipo === 'text' ? 120 : 80,
    });
    setActiveTool('select');
  };

  const handleToolChange = (tool: ToolType) => {
    setActiveTool(tool);
    if (tool === 'rectangle' || tool === 'circle' || tool === 'diamond' || tool === 'text') {
      handleAddShape(tool);
    }
  };

  const handleFileUpload = async (file: File) => {
    await uploadFile({
      file,
      position_x: Math.random() * 300 + 100,
      position_y: Math.random() * 200 + 100,
    });
  };

  const handleDrawingComplete = async (pathData: string, color: string, strokeWidth: number) => {
    await createDrawing({
      path_data: pathData,
      cor: color,
      stroke_width: strokeWidth,
    });
  };

  const onMoveEnd = useCallback((_: unknown, viewport: { x: number; y: number; zoom: number }) => {
    setViewportTransform(viewport);
  }, []);

  // Collect current board state
  const collectBoardData = useCallback((): BoardData => {
    return {
      nodes: dbNodes.map(n => ({
        id: n.id,
        titulo: n.titulo,
        conteudo: n.conteudo,
        classificacao: n.classificacao,
        position_x: n.position_x,
        position_y: n.position_y,
        enviado_producao: n.enviado_producao,
      })),
      shapes: shapes.map(s => ({
        id: s.id,
        tipo: s.tipo,
        texto: s.texto,
        position_x: s.position_x,
        position_y: s.position_y,
        width: s.width,
        height: s.height,
        cor: s.cor,
        enviado_producao: s.enviado_producao,
      })),
      edges: dbEdges.map(e => ({
        id: e.id,
        source_id: e.source_id,
        source_type: e.source_type,
        target_id: e.target_id,
        target_type: e.target_type,
        label: e.label,
        estilo: e.estilo,
      })),
      drawings: drawings.map(d => ({
        id: d.id,
        path_data: d.path_data,
        cor: d.cor,
        stroke_width: d.stroke_width,
      })),
      files: files.map(f => ({
        id: f.id,
        file_url: f.file_url,
        file_name: f.file_name,
        file_type: f.file_type,
        position_x: f.position_x,
        position_y: f.position_y,
        width: f.width,
        height: f.height,
      })),
    };
  }, [dbNodes, shapes, dbEdges, drawings, files]);

  // Clear board
  const clearBoard = useCallback(async () => {
    // Delete all nodes
    for (const node of dbNodes) {
      deleteNode(node.id);
    }
    // Delete all shapes
    for (const shape of shapes) {
      deleteShape(shape.id);
    }
    // Delete all edges
    for (const edge of dbEdges) {
      deleteEdge(edge.id);
    }
    // Clear all drawings
    clearAllDrawings();
    // Delete all files
    for (const file of files) {
      deleteFile(file.id);
    }
  }, [dbNodes, shapes, dbEdges, files, deleteNode, deleteShape, deleteEdge, clearAllDrawings, deleteFile]);

  // Open save dialog
  const handleSaveTemplate = useCallback(() => {
    setSaveDialogOpen(true);
  }, []);

  // Save template and clear board
  const handleSaveTemplateConfirm = useCallback(async (nome: string, tipo: 'comum' | 'central') => {
    setIsSaving(true);
    try {
      const boardData = collectBoardData();
      
      if (editingTemplate) {
        // Update existing template
        updateTemplate({ id: editingTemplate.id, nome, tipo, board_data: boardData });
        setEditingTemplate(null);
      } else {
        // Create new template
        await createTemplate({ nome, tipo, board_data: boardData });
        // Clear the board after saving
        await clearBoard();
      }
    } catch (error) {
      toast({
        title: 'Erro ao salvar template',
        description: (error as Error).message,
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  }, [collectBoardData, editingTemplate, updateTemplate, createTemplate, clearBoard, toast]);

  // Load template into board
  const handleSelectTemplate = useCallback(async (template: MarketingBoardTemplate) => {
    setEditingTemplate(template);
    
    // Clear current board first
    await clearBoard();
    
    // Load template data
    const data = template.board_data;
    
    // Create nodes
    for (const node of data.nodes || []) {
      await createNode({
        titulo: node.titulo,
        conteudo: node.conteudo,
        classificacao: node.classificacao as 'planejamento_central' | 'plano_postagem' | 'plano_trafego' | null,
        position_x: node.position_x,
        position_y: node.position_y,
      });
    }
    
    // Create shapes (includes text type)
    for (const shape of data.shapes || []) {
      await createShape({
        tipo: shape.tipo as 'rectangle' | 'circle' | 'diamond' | 'text',
        texto: shape.texto || undefined,
        position_x: shape.position_x,
        position_y: shape.position_y,
        width: shape.width,
        height: shape.height,
        cor: shape.cor,
      });
    }
    
    // Create drawings
    for (const drawing of data.drawings || []) {
      await createDrawing({
        path_data: drawing.path_data,
        cor: drawing.cor,
        stroke_width: drawing.stroke_width,
      });
    }

    // Create files (images/PDFs)
    for (const file of data.files || []) {
      await createFileFromTemplate({
        file_url: file.file_url,
        file_name: file.file_name,
        file_type: file.file_type,
        position_x: file.position_x,
        position_y: file.position_y,
        width: file.width,
        height: file.height,
      });
    }
    
    toast({ title: `Template "${template.nome}" carregado!` });
  }, [clearBoard, createNode, createShape, createDrawing, createFileFromTemplate, toast]);

  // Toggle template central status
  const handleToggleCentral = useCallback((template: MarketingBoardTemplate) => {
    updateTemplate({
      id: template.id,
      tipo: template.tipo === 'central' ? 'comum' : 'central',
    });
  }, [updateTemplate]);

  // Fullscreen toggle
  const handleToggleFullscreen = useCallback(() => {
    setIsFullscreen((prev) => !prev);
  }, []);

  // Handle paste events for images
  useEffect(() => {
    const handlePaste = async (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;

      for (const item of items) {
        if (item.type.startsWith('image/')) {
          const file = item.getAsFile();
          if (file) {
            e.preventDefault();
            await uploadFile({
              file,
              position_x: Math.random() * 300 + 200,
              position_y: Math.random() * 200 + 100,
            });
          }
        }
      }
    };

    document.addEventListener('paste', handlePaste);
    return () => document.removeEventListener('paste', handlePaste);
  }, [uploadFile]);

  // Handle escape key to exit fullscreen
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isFullscreen) {
        setIsFullscreen(false);
      }
    };
    
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isFullscreen]);

  const isDrawingMode = activeTool === 'pencil';
  const isErasingMode = activeTool === 'eraser';

  return (
    <div 
      className={cn(
        'flex flex-col gap-4',
        isFullscreen 
          ? 'fixed inset-0 z-50 bg-background p-4' 
          : 'h-[calc(100vh-220px)] p-4'
      )}
    >
      {/* Header - only show in fullscreen */}
      {isFullscreen && (
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold">Lousa de Planejamento</h2>
          <Button variant="outline" size="sm" onClick={handleToggleFullscreen}>
            <X className="h-4 w-4 mr-2" />
            Fechar Tela Cheia (ESC)
          </Button>
        </div>
      )}

      {/* Templates Section - hide in fullscreen */}
      {!isFullscreen && (
        <Card className="p-4">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="font-semibold">Templates de Lousa</h3>
              <p className="text-sm text-muted-foreground">
                Salve e carregue templates de planejamento
              </p>
            </div>
            {editingTemplate && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setEditingTemplate(null);
                  clearBoard();
                }}
              >
                <X className="h-4 w-4 mr-2" />
                Novo Template
              </Button>
            )}
          </div>
          <TemplatesList
            templates={templates}
            onSelect={handleSelectTemplate}
            onDelete={deleteTemplate}
            onToggleCentral={handleToggleCentral}
          />
        </Card>
      )}

      {/* Planning Board */}
      <div ref={reactFlowWrapper} className="flex-1 bg-muted/30 rounded-lg border relative">
        <PlanningToolbar
          activeTool={activeTool}
          onToolChange={handleToolChange}
          drawingColor={drawingColor}
          onDrawingColorChange={setDrawingColor}
          onFileUpload={handleFileUpload}
          onClearDrawings={clearAllDrawings}
          onSaveTemplate={handleSaveTemplate}
          onToggleFullscreen={handleToggleFullscreen}
          isFullscreen={isFullscreen}
          isSaving={isSaving}
        />

        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onEdgesDelete={onEdgesDelete}
          onNodeDragStop={onNodeDragStop}
          onMoveEnd={onMoveEnd}
          nodeTypes={nodeTypes}
          fitView
          className="bg-dots"
          panOnDrag={!isDrawingMode && !isErasingMode}
          zoomOnScroll={!isDrawingMode && !isErasingMode}
          nodesDraggable={!isDrawingMode && !isErasingMode}
          nodesConnectable={!isDrawingMode && !isErasingMode}
          elementsSelectable={!isDrawingMode && !isErasingMode}
        >
          <Background variant={BackgroundVariant.Dots} gap={20} size={1} />
          <Controls />
          <MiniMap />
          <Panel position="top-left" className="ml-16">
            <Button onClick={handleAddNode}>
              <Plus className="h-4 w-4 mr-2" />
              Novo Nó de Planejamento
            </Button>
          </Panel>
        </ReactFlow>

        {/* Drawing Canvas Overlay */}
        <DrawingCanvas
          isDrawing={isDrawingMode}
          isErasing={isErasingMode}
          color={drawingColor}
          strokeWidth={2}
          drawings={drawings}
          onDrawingComplete={handleDrawingComplete}
          onDrawingErase={deleteDrawing}
          viewportTransform={viewportTransform}
        />
      </div>

      {/* Save Template Dialog */}
      <SaveTemplateDialog
        open={saveDialogOpen}
        onOpenChange={setSaveDialogOpen}
        onSave={handleSaveTemplateConfirm}
        isSaving={isSaving}
      />
    </div>
  );
}

export function MarketingPlanningBoard() {
  return (
    <ReactFlowProvider>
      <MarketingPlanningBoardInner />
    </ReactFlowProvider>
  );
}
