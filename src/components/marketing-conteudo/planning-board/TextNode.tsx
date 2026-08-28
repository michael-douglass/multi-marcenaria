import { memo, useState, useRef, useEffect } from 'react';
import { Handle, Position, NodeProps } from '@xyflow/react';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Send, Trash2, GripVertical } from 'lucide-react';
import { cn } from '@/lib/utils';

interface TextNodeData {
  texto: string;
  cor: string;
  enviado_producao: boolean;
  dbId: string;
  onUpdate: (id: string, updates: { texto?: string; cor?: string }) => void;
  onDelete: (id: string) => void;
  onSendToProduction: (id: string, texto: string) => void;
}

function TextNodeComponent({ data, selected }: NodeProps & { data: TextNodeData }) {
  const [isEditing, setIsEditing] = useState(false);
  const [texto, setTexto] = useState(data.texto || '');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    setTexto(data.texto || '');
  }, [data.texto]);

  useEffect(() => {
    if (isEditing && textareaRef.current) {
      textareaRef.current.focus();
      textareaRef.current.setSelectionRange(texto.length, texto.length);
    }
  }, [isEditing]);

  const handleSave = () => {
    data.onUpdate(data.dbId, { texto });
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setTexto(data.texto || '');
      setIsEditing(false);
    }
    // Ctrl+Enter para salvar (permite Enter normal para quebra de linha)
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      handleSave();
    }
  };

  const handleStyle = 'w-3 h-3 !bg-primary border-2 border-background';

  // Formata o texto para exibição com quebras de linha
  const formatTextForDisplay = (text: string) => {
    if (!text) return null;
    return text.split('\n').map((line, index, array) => (
      <span key={index}>
        {line}
        {index < array.length - 1 && <br />}
      </span>
    ));
  };

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
        className={cn(
          'relative bg-background border-2 rounded-lg shadow-md transition-all min-w-[200px] max-w-[400px]',
          selected && 'ring-2 ring-primary ring-offset-2',
          data.enviado_producao && 'opacity-60'
        )}
        style={{ borderColor: data.cor || '#6366f1' }}
        onDoubleClick={() => !data.enviado_producao && setIsEditing(true)}
      >
        {/* Header com drag handle */}
        <div
          className="flex items-center gap-2 px-3 py-2 border-b cursor-move"
          style={{ backgroundColor: `${data.cor || '#6366f1'}20` }}
        >
          <GripVertical className="h-4 w-4 text-muted-foreground" />
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            Texto
          </span>
        </div>

        {/* Conteúdo */}
        <div className="p-3">
          {isEditing ? (
            <div className="space-y-2">
              <Textarea
                ref={textareaRef}
                value={texto}
                onChange={(e) => setTexto(e.target.value)}
                onBlur={handleSave}
                onKeyDown={handleKeyDown}
                placeholder="Digite seu texto aqui..."
                className="min-h-[100px] resize-y text-sm leading-relaxed"
                rows={4}
              />
              <p className="text-[10px] text-muted-foreground">
                Ctrl+Enter para salvar • Esc para cancelar
              </p>
            </div>
          ) : (
            <div
              className={cn(
                'text-sm leading-relaxed whitespace-pre-wrap break-words min-h-[60px]',
                !texto && 'text-muted-foreground italic'
              )}
            >
              {texto ? formatTextForDisplay(texto) : 'Clique duplo para editar...'}
            </div>
          )}
        </div>

        {/* Botões de ação */}
        {selected && !data.enviado_producao && (
          <div className="absolute -bottom-10 left-1/2 -translate-x-1/2 flex gap-1">
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
          <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 text-xs text-green-600 font-medium whitespace-nowrap">
            ✓ Convertido
          </div>
        )}
      </div>
    </>
  );
}

export const TextNode = memo(TextNodeComponent);
