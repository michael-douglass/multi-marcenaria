import { useState, useRef, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { ZoomIn, ZoomOut, Move, RotateCcw, GripVertical } from 'lucide-react';
import { cn } from '@/lib/utils';

interface BoardNode {
  id: string;
  titulo: string;
  conteudo?: string;
  classificacao?: string;
  position_x: number;
  position_y: number;
  enviado_producao?: boolean;
}

interface BoardShape {
  id: string;
  tipo: string;
  texto?: string;
  cor?: string;
  position_x: number;
  position_y: number;
  width: number;
  height: number;
}

interface BoardEdge {
  id: string;
  source_id: string;
  target_id: string;
  source_type: string;
  target_type: string;
  label?: string;
}

interface BoardDrawing {
  id: string;
  path_data: string;
  cor: string;
  stroke_width: number;
}

interface BoardFile {
  id: string;
  file_url: string;
  file_name: string;
  file_type: string;
  position_x: number;
  position_y: number;
  width: number;
  height: number;
}

interface BoardPreviewProps {
  nodes: BoardNode[];
  shapes: BoardShape[];
  edges: BoardEdge[];
  drawings: BoardDrawing[];
  files: BoardFile[];
  className?: string;
}

export function BoardPreview({ 
  nodes = [], 
  shapes = [], 
  edges = [], 
  drawings = [],
  files = [],
  className 
}: BoardPreviewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [transform, setTransform] = useState({ x: 0, y: 0, scale: 0.5 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  // Calculate bounding box of all elements
  const calculateBounds = useCallback(() => {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

    nodes.forEach(node => {
      minX = Math.min(minX, node.position_x);
      minY = Math.min(minY, node.position_y);
      maxX = Math.max(maxX, node.position_x + 280);
      maxY = Math.max(maxY, node.position_y + 150);
    });

    shapes.forEach(shape => {
      minX = Math.min(minX, shape.position_x);
      minY = Math.min(minY, shape.position_y);
      maxX = Math.max(maxX, shape.position_x + (shape.width || 120));
      maxY = Math.max(maxY, shape.position_y + (shape.height || 60));
    });

    files.forEach(file => {
      minX = Math.min(minX, file.position_x);
      minY = Math.min(minY, file.position_y);
      maxX = Math.max(maxX, file.position_x + (file.width || 200));
      maxY = Math.max(maxY, file.position_y + (file.height || 150));
    });

    if (minX === Infinity) {
      return { minX: 0, minY: 0, maxX: 800, maxY: 600 };
    }

    return { minX: minX - 50, minY: minY - 50, maxX: maxX + 50, maxY: maxY + 50 };
  }, [nodes, shapes, files]);

  // Center view on content
  const centerView = useCallback(() => {
    if (!containerRef.current) return;
    
    const bounds = calculateBounds();
    const containerRect = containerRef.current.getBoundingClientRect();
    
    const contentWidth = bounds.maxX - bounds.minX;
    const contentHeight = bounds.maxY - bounds.minY;
    
    // Calculate scale to fit content
    const scaleX = (containerRect.width - 40) / contentWidth;
    const scaleY = (containerRect.height - 40) / contentHeight;
    const scale = Math.min(scaleX, scaleY, 1);
    
    // Calculate offset to center
    const scaledWidth = contentWidth * scale;
    const scaledHeight = contentHeight * scale;
    const offsetX = (containerRect.width - scaledWidth) / 2 - bounds.minX * scale;
    const offsetY = (containerRect.height - scaledHeight) / 2 - bounds.minY * scale;
    
    setTransform({ x: offsetX, y: offsetY, scale: Math.max(0.2, scale) });
  }, [calculateBounds]);

  useEffect(() => {
    centerView();
  }, [centerView, nodes, shapes, files]);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    setTransform(prev => ({
      ...prev,
      scale: Math.max(0.1, Math.min(3, prev.scale * delta))
    }));
  }, []);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button === 0) {
      setIsDragging(true);
      setDragStart({ x: e.clientX - transform.x, y: e.clientY - transform.y });
    }
  }, [transform]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (isDragging) {
      setTransform(prev => ({
        ...prev,
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y
      }));
    }
  }, [isDragging, dragStart]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  const zoom = (factor: number) => {
    setTransform(prev => ({
      ...prev,
      scale: Math.max(0.1, Math.min(3, prev.scale * factor))
    }));
  };

  // Find element position for edge connections
  const getElementCenter = (id: string, type: string): { x: number; y: number } | null => {
    if (type === 'node' || type === 'planning') {
      const node = nodes.find(n => n.id === id);
      if (node) return { x: node.position_x + 140, y: node.position_y + 75 };
    } else if (type === 'shape' || type === 'text') {
      const shape = shapes.find(s => s.id === id);
      if (shape) return { x: shape.position_x + (shape.width || 60), y: shape.position_y + (shape.height || 30) };
    }
    return null;
  };

  // Format text with line breaks - matching TextNode component
  const formatTextForDisplay = (text: string) => {
    if (!text) return null;
    return text.split('\n').map((line, index, array) => (
      <span key={index}>
        {line}
        {index < array.length - 1 && <br />}
      </span>
    ));
  };

  // Get classification label - matching PlanningNode component
  const getClassificacaoLabel = (classificacao: string) => {
    const labels: Record<string, string> = {
      planejamento_central: 'Planejamento Central',
      plano_postagem: 'Plano de Postagem',
      plano_trafego: 'Plano de Tráfego',
    };
    return labels[classificacao] || classificacao;
  };

  const hasContent = nodes.length > 0 || shapes.length > 0 || drawings.length > 0 || files.length > 0;

  if (!hasContent) {
    return (
      <div className={cn("flex items-center justify-center h-64 bg-muted/30 rounded-lg border", className)}>
        <p className="text-muted-foreground text-sm">Lousa vazia</p>
      </div>
    );
  }

  return (
    <div className={cn("relative overflow-hidden rounded-lg border bg-orange-50/30", className)}>
      {/* Toolbar */}
      <div className="absolute top-2 right-2 z-10 flex gap-1 bg-background/90 rounded-md p-1 shadow-sm">
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={() => zoom(1.2)}
          title="Zoom In"
        >
          <ZoomIn className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={() => zoom(0.8)}
          title="Zoom Out"
        >
          <ZoomOut className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={centerView}
          title="Centralizar"
        >
          <RotateCcw className="h-4 w-4" />
        </Button>
      </div>

      {/* Zoom indicator */}
      <div className="absolute bottom-2 left-2 z-10 text-xs text-muted-foreground bg-background/80 px-2 py-1 rounded">
        {Math.round(transform.scale * 100)}%
      </div>

      {/* Canvas */}
      <div
        ref={containerRef}
        className={cn(
          "h-80 cursor-grab overflow-hidden",
          isDragging && "cursor-grabbing"
        )}
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        <div
          style={{
            transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.scale})`,
            transformOrigin: '0 0',
            transition: isDragging ? 'none' : 'transform 0.1s ease-out'
          }}
        >
          {/* SVG layer for drawings and edges */}
          <svg 
            className="absolute pointer-events-none"
            style={{ 
              width: 5000, 
              height: 5000,
              left: -2500,
              top: -2500
            }}
          >
            <g transform="translate(2500, 2500)">
              {/* Edges (connections) */}
              {edges.map(edge => {
                const source = getElementCenter(edge.source_id, edge.source_type);
                const target = getElementCenter(edge.target_id, edge.target_type);
                
                if (!source || !target) return null;
                
                return (
                  <g key={edge.id}>
                    <line
                      x1={source.x}
                      y1={source.y}
                      x2={target.x}
                      y2={target.y}
                      stroke="hsl(var(--primary))"
                      strokeWidth={2}
                      markerEnd="url(#arrowhead)"
                    />
                    {edge.label && (
                      <text
                        x={(source.x + target.x) / 2}
                        y={(source.y + target.y) / 2}
                        textAnchor="middle"
                        fontSize={10}
                        fill="hsl(var(--foreground))"
                        className="pointer-events-none"
                      >
                        {edge.label}
                      </text>
                    )}
                  </g>
                );
              })}

              {/* Drawings */}
              {drawings.map(drawing => (
                <path
                  key={drawing.id}
                  d={drawing.path_data}
                  stroke={drawing.cor}
                  strokeWidth={drawing.stroke_width}
                  fill="none"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              ))}

              <defs>
                <marker
                  id="arrowhead"
                  markerWidth="10"
                  markerHeight="7"
                  refX="9"
                  refY="3.5"
                  orient="auto"
                >
                  <polygon points="0 0, 10 3.5, 0 7" fill="hsl(var(--primary))" />
                </marker>
              </defs>
            </g>
          </svg>

          {/* Files (images/PDFs) - Matching ImageNode style */}
          {files.map(file => (
            <div
              key={file.id}
              className="absolute bg-white rounded-lg shadow-md border-2 border-muted overflow-hidden"
              style={{
                left: file.position_x,
                top: file.position_y,
                width: file.width || 200,
              }}
            >
              {file.file_type.startsWith('image') ? (
                <img 
                  src={file.file_url} 
                  alt={file.file_name}
                  className="w-full object-contain"
                  style={{ maxHeight: file.height || 150 }}
                />
              ) : (
                <div 
                  className="w-full flex items-center justify-center bg-muted/50"
                  style={{ height: file.height || 150 }}
                >
                  <span className="text-xs text-muted-foreground">{file.file_type}</span>
                </div>
              )}
              {/* File name - matching ImageNode */}
              <div className="px-2 py-1 text-xs text-muted-foreground truncate bg-muted/50">
                {file.file_name}
              </div>
            </div>
          ))}

          {/* Shapes (rectangles, circles, diamonds) - Matching ShapeNode style */}
          {shapes.filter(s => s.tipo !== 'text').map(shape => {
            const shapeWidth = shape.width || 120;
            const shapeHeight = shape.height || 60;
            
            const getShapeClass = () => {
              switch (shape.tipo) {
                case 'circle':
                  return 'rounded-full';
                case 'diamond':
                  return 'rotate-45';
                default:
                  return 'rounded-lg';
              }
            };

            return (
              <div
                key={shape.id}
                className={cn(
                  "absolute flex items-center justify-center shadow-md transition-all",
                  getShapeClass()
                )}
                style={{
                  left: shape.position_x,
                  top: shape.position_y,
                  width: shapeWidth,
                  height: shapeHeight,
                  backgroundColor: shape.cor || '#3B82F6',
                  minWidth: 120,
                  minHeight: 60,
                  padding: 16
                }}
              >
                {shape.texto && (
                  <span 
                    className={cn(
                      "text-sm font-medium text-white text-center drop-shadow",
                      shape.tipo === 'diamond' && '-rotate-45'
                    )}
                  >
                    {shape.texto}
                  </span>
                )}
              </div>
            );
          })}

          {/* Text nodes - Matching TextNode style exactly */}
          {shapes.filter(s => s.tipo === 'text').map(shape => (
            <div
              key={shape.id}
              className="absolute bg-background rounded-lg shadow-md border-2 overflow-hidden"
              style={{
                left: shape.position_x,
                top: shape.position_y,
                width: shape.width || 250,
                minHeight: shape.height || 120,
                borderColor: shape.cor || '#6366f1',
                minWidth: 200,
                maxWidth: 400
              }}
            >
              {/* Header - matching TextNode header exactly */}
              <div
                className="flex items-center gap-2 px-3 py-2 border-b"
                style={{ backgroundColor: `${shape.cor || '#6366f1'}20` }}
              >
                <GripVertical className="h-4 w-4 text-muted-foreground" />
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Texto
                </span>
              </div>
              {/* Content - matching TextNode content exactly */}
              <div className="p-3">
                <div className={cn(
                  "text-sm leading-relaxed whitespace-pre-wrap break-words min-h-[60px]",
                  !shape.texto && 'text-muted-foreground italic'
                )}>
                  {shape.texto ? formatTextForDisplay(shape.texto) : 'Sem texto'}
                </div>
              </div>
            </div>
          ))}

          {/* Planning Nodes - Matching PlanningNode style exactly */}
          {nodes.map(node => (
            <div
              key={node.id}
              className={cn(
                "absolute bg-background rounded-lg shadow-lg border-2 p-4",
                node.enviado_producao ? "border-green-500 opacity-60" : "border-muted",
              )}
              style={{
                left: node.position_x,
                top: node.position_y,
                minWidth: 250,
                maxWidth: 350
              }}
            >
              {/* Title row - matching PlanningNode */}
              <div className="flex items-start justify-between gap-2">
                <h4 className="font-medium text-sm">{node.titulo || 'Sem título'}</h4>
              </div>
              
              {/* Classification badge - matching PlanningNode */}
              {node.classificacao && (
                <span className="inline-block mt-2 text-xs bg-secondary px-2 py-0.5 rounded">
                  {getClassificacaoLabel(node.classificacao)}
                </span>
              )}
              
              {/* Content - matching PlanningNode with line-clamp-3 */}
              {node.conteudo && (
                <p className="text-xs text-muted-foreground mt-2 line-clamp-3">
                  {node.conteudo}
                </p>
              )}

              {/* Sent to production badge - matching PlanningNode */}
              {node.enviado_producao && (
                <span className="inline-block mt-2 text-xs bg-green-600 text-white px-2 py-0.5 rounded w-full text-center">
                  ✓ Enviado para Produção
                </span>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Drag hint */}
      <div className="absolute bottom-2 right-2 z-10 text-xs text-muted-foreground bg-background/80 px-2 py-1 rounded flex items-center gap-1">
        <Move className="h-3 w-3" />
        Arraste para navegar
      </div>
    </div>
  );
}
