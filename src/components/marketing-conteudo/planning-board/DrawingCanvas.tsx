import { useRef, useState, useEffect, useCallback } from 'react';
import { MarketingPlanningDrawing } from '@/hooks/useMarketingPlanningAdvanced';

interface DrawingCanvasProps {
  isDrawing: boolean;
  isErasing: boolean;
  color: string;
  strokeWidth: number;
  drawings: MarketingPlanningDrawing[];
  onDrawingComplete: (pathData: string, color: string, strokeWidth: number) => void;
  onDrawingErase: (id: string) => void;
  viewportTransform: { x: number; y: number; zoom: number };
}

export function DrawingCanvas({
  isDrawing,
  isErasing,
  color,
  strokeWidth,
  drawings,
  onDrawingComplete,
  onDrawingErase,
  viewportTransform,
}: DrawingCanvasProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [currentPath, setCurrentPath] = useState<string>('');
  const [isMouseDown, setIsMouseDown] = useState(false);

  const getMousePosition = useCallback((e: React.MouseEvent) => {
    if (!svgRef.current) return { x: 0, y: 0 };
    
    const rect = svgRef.current.getBoundingClientRect();
    const x = (e.clientX - rect.left - viewportTransform.x) / viewportTransform.zoom;
    const y = (e.clientY - rect.top - viewportTransform.y) / viewportTransform.zoom;
    
    return { x, y };
  }, [viewportTransform]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (!isDrawing && !isErasing) return;
    
    const pos = getMousePosition(e);
    setIsMouseDown(true);
    
    if (isDrawing) {
      setCurrentPath(`M ${pos.x} ${pos.y}`);
    }
  }, [isDrawing, isErasing, getMousePosition]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isMouseDown) return;
    
    const pos = getMousePosition(e);
    
    if (isDrawing) {
      setCurrentPath(prev => `${prev} L ${pos.x} ${pos.y}`);
    }
    
    if (isErasing) {
      // Check if we're hovering over any drawing path
      const target = e.target as SVGPathElement;
      if (target.dataset.drawingId) {
        onDrawingErase(target.dataset.drawingId);
      }
    }
  }, [isMouseDown, isDrawing, isErasing, getMousePosition, onDrawingErase]);

  const handleMouseUp = useCallback(() => {
    if (isMouseDown && isDrawing && currentPath) {
      onDrawingComplete(currentPath, color, strokeWidth);
    }
    setIsMouseDown(false);
    setCurrentPath('');
  }, [isMouseDown, isDrawing, currentPath, color, strokeWidth, onDrawingComplete]);

  // Always render saved drawings, but only capture events in drawing/erasing mode
  const isInteractive = isDrawing || isErasing;

  return (
    <svg
      ref={svgRef}
      className={`absolute inset-0 w-full h-full ${isInteractive ? 'pointer-events-auto' : 'pointer-events-none'}`}
      style={{
        cursor: isDrawing ? 'crosshair' : isErasing ? 'cell' : 'default',
        zIndex: isInteractive ? 5 : 1,
      }}
      onMouseDown={isInteractive ? handleMouseDown : undefined}
      onMouseMove={isInteractive ? handleMouseMove : undefined}
      onMouseUp={isInteractive ? handleMouseUp : undefined}
      onMouseLeave={isInteractive ? handleMouseUp : undefined}
    >
      <g transform={`translate(${viewportTransform.x}, ${viewportTransform.y}) scale(${viewportTransform.zoom})`}>
        {/* Existing drawings */}
        {drawings.map((drawing) => (
          <path
            key={drawing.id}
            d={drawing.path_data}
            stroke={drawing.cor}
            strokeWidth={drawing.stroke_width}
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
            data-drawing-id={drawing.id}
            className={isErasing ? 'hover:stroke-red-500 cursor-pointer' : ''}
          />
        ))}
        
        {/* Current drawing path */}
        {currentPath && (
          <path
            d={currentPath}
            stroke={color}
            strokeWidth={strokeWidth}
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
            opacity={0.8}
          />
        )}
      </g>
    </svg>
  );
}
