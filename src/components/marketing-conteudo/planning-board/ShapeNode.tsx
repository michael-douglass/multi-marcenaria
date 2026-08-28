import { memo, useState } from 'react';
import { Handle, Position, NodeProps } from '@xyflow/react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Send, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ShapeNodeData {
  tipo: 'rectangle' | 'circle' | 'diamond';
  texto: string;
  cor: string;
  enviado_producao: boolean;
  dbId: string;
  onUpdate: (id: string, updates: { texto?: string; cor?: string }) => void;
  onDelete: (id: string) => void;
  onSendToProduction: (id: string, texto: string) => void;
}

function ShapeNodeComponent({ data, selected }: NodeProps & { data: ShapeNodeData }) {
  const [isEditing, setIsEditing] = useState(false);
  const [texto, setTexto] = useState(data.texto || '');

  const handleSave = () => {
    data.onUpdate(data.dbId, { texto });
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSave();
    }
    if (e.key === 'Escape') {
      setTexto(data.texto);
      setIsEditing(false);
    }
  };

  const getShapeClasses = () => {
    const base = 'relative flex items-center justify-center transition-all';
    const size = 'min-w-[120px] min-h-[60px] p-4';
    const border = selected ? 'ring-2 ring-primary ring-offset-2' : '';
    const converted = data.enviado_producao ? 'opacity-60' : '';

    switch (data.tipo) {
      case 'circle':
        return cn(base, size, border, converted, 'rounded-full');
      case 'diamond':
        return cn(base, size, border, converted, 'rotate-45');
      default:
        return cn(base, size, border, converted, 'rounded-lg');
    }
  };

  const handleStyle = 'w-3 h-3 !bg-primary border-2 border-background';

  return (
    <>
      {/* Handles nos 4 lados */}
      <Handle type="target" position={Position.Top} className={handleStyle} />
      <Handle type="source" position={Position.Top} id="top" className={handleStyle} />
      <Handle type="target" position={Position.Bottom} className={handleStyle} />
      <Handle type="source" position={Position.Bottom} id="bottom" className={handleStyle} />
      <Handle type="target" position={Position.Left} className={handleStyle} />
      <Handle type="source" position={Position.Left} id="left" className={handleStyle} />
      <Handle type="target" position={Position.Right} className={handleStyle} />
      <Handle type="source" position={Position.Right} id="right" className={handleStyle} />

      <div
        className={getShapeClasses()}
        style={{ backgroundColor: data.cor }}
        onDoubleClick={() => !data.enviado_producao && setIsEditing(true)}
      >
        <div className={cn(data.tipo === 'diamond' && '-rotate-45', 'w-full text-center')}>
          {isEditing ? (
            <Input
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              onBlur={handleSave}
              onKeyDown={handleKeyDown}
              autoFocus
              className="text-center text-sm bg-white/90"
            />
          ) : (
            <span className="text-sm font-medium text-white drop-shadow">
              {data.texto || 'Clique duplo para editar'}
            </span>
          )}
        </div>

        {/* Botões de ação */}
        {selected && !data.enviado_producao && (
          <div className={cn(
            'absolute -bottom-10 left-1/2 -translate-x-1/2 flex gap-1',
            data.tipo === 'diamond' && '-rotate-45'
          )}>
            <Button
              size="icon"
              variant="default"
              className="h-7 w-7"
              onClick={() => data.onSendToProduction(data.dbId, texto)}
              title="Enviar para Produção"
            >
              <Send className="h-3 w-3" />
            </Button>
            <Button
              size="icon"
              variant="destructive"
              className="h-7 w-7"
              onClick={() => data.onDelete(data.dbId)}
              title="Excluir"
            >
              <Trash2 className="h-3 w-3" />
            </Button>
          </div>
        )}

        {data.enviado_producao && (
          <div className={cn(
            'absolute -bottom-6 left-1/2 -translate-x-1/2 text-xs text-green-600 font-medium whitespace-nowrap',
            data.tipo === 'diamond' && '-rotate-45'
          )}>
            ✓ Convertido
          </div>
        )}
      </div>
    </>
  );
}

export const ShapeNode = memo(ShapeNodeComponent);
