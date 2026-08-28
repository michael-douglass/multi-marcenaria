import { useRef } from 'react';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Square,
  Circle,
  Diamond,
  Pencil,
  Eraser,
  Image,
  Trash2,
  MousePointer,
  Save,
  Maximize2,
  Type,
} from 'lucide-react';
import { cn } from '@/lib/utils';

export type ToolType = 'select' | 'rectangle' | 'circle' | 'diamond' | 'text' | 'pencil' | 'eraser';

interface PlanningToolbarProps {
  activeTool: ToolType;
  onToolChange: (tool: ToolType) => void;
  drawingColor: string;
  onDrawingColorChange: (color: string) => void;
  onFileUpload: (file: File) => void;
  onClearDrawings: () => void;
  onSaveTemplate: () => void;
  onToggleFullscreen: () => void;
  isFullscreen: boolean;
  isSaving: boolean;
}

export function PlanningToolbar({
  activeTool,
  onToolChange,
  drawingColor,
  onDrawingColorChange,
  onFileUpload,
  onClearDrawings,
  onSaveTemplate,
  onToggleFullscreen,
  isFullscreen,
  isSaving,
}: PlanningToolbarProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onFileUpload(file);
      e.target.value = '';
    }
  };

  const tools: { type: ToolType; icon: typeof MousePointer; label: string }[] = [
    { type: 'select', icon: MousePointer, label: 'Selecionar' },
    { type: 'rectangle', icon: Square, label: 'Retângulo' },
    { type: 'circle', icon: Circle, label: 'Círculo' },
    { type: 'diamond', icon: Diamond, label: 'Losango' },
    { type: 'text', icon: Type, label: 'Caixa de Texto' },
    { type: 'pencil', icon: Pencil, label: 'Desenho Livre' },
    { type: 'eraser', icon: Eraser, label: 'Borracha' },
  ];

  return (
    <TooltipProvider delayDuration={200}>
      <div className="absolute left-4 top-1/2 -translate-y-1/2 z-10 flex flex-col gap-2 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 rounded-lg shadow-lg border p-2">
        {/* Tool buttons */}
        {tools.map(({ type, icon: Icon, label }) => (
          <Tooltip key={type}>
            <TooltipTrigger asChild>
              <Button
                variant={activeTool === type ? 'default' : 'ghost'}
                size="icon"
                className={cn(
                  'h-9 w-9',
                  activeTool === type && 'bg-primary text-primary-foreground'
                )}
                onClick={() => onToolChange(type)}
              >
                <Icon className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="right">
              <p>{label}</p>
            </TooltipContent>
          </Tooltip>
        ))}

        <div className="w-full h-px bg-border my-1" />

        {/* Color picker for pencil */}
        {(activeTool === 'pencil' || activeTool === 'eraser') && (
          <div className="flex flex-col gap-2 p-1">
            <Label className="text-xs">Cor</Label>
            <Input
              type="color"
              value={drawingColor}
              onChange={(e) => onDrawingColorChange(e.target.value)}
              className="h-8 w-full p-0 border-0 cursor-pointer"
              disabled={activeTool === 'eraser'}
            />
          </div>
        )}

        {/* Upload buttons */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9"
              onClick={() => fileInputRef.current?.click()}
            >
              <Image className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="right">
            <p>Adicionar Imagem/PDF</p>
          </TooltipContent>
        </Tooltip>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,application/pdf"
          onChange={handleFileChange}
          className="hidden"
        />

        <div className="w-full h-px bg-border my-1" />

        {/* Save Template button */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 text-green-600 hover:text-green-700 hover:bg-green-50"
              onClick={onSaveTemplate}
              disabled={isSaving}
            >
              <Save className={cn("h-4 w-4", isSaving && "animate-pulse")} />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="right">
            <p>Salvar como Template</p>
          </TooltipContent>
        </Tooltip>

        {/* Fullscreen toggle */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant={isFullscreen ? 'default' : 'ghost'}
              size="icon"
              className="h-9 w-9"
              onClick={onToggleFullscreen}
            >
              <Maximize2 className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="right">
            <p>{isFullscreen ? 'Sair da Tela Cheia' : 'Tela Cheia'}</p>
          </TooltipContent>
        </Tooltip>

        <div className="w-full h-px bg-border my-1" />

        {/* Clear drawings */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 text-destructive hover:text-destructive"
              onClick={onClearDrawings}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="right">
            <p>Limpar Desenhos</p>
          </TooltipContent>
        </Tooltip>
      </div>
    </TooltipProvider>
  );
}
