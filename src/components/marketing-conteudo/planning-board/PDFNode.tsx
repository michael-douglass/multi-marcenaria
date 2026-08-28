import { memo, useState } from 'react';
import { Handle, Position, NodeProps } from '@xyflow/react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogTrigger } from '@/components/ui/dialog';
import { Trash2, FileText, ExternalLink } from 'lucide-react';
import { cn } from '@/lib/utils';

interface PDFNodeData {
  file_url: string;
  file_name: string;
  dbId: string;
  onDelete: (id: string) => void;
}

function PDFNodeComponent({ data, selected }: NodeProps & { data: PDFNodeData }) {
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);

  const handleStyle = 'w-3 h-3 !bg-primary border-2 border-background';

  return (
    <>
      <Handle type="target" position={Position.Top} className={handleStyle} />
      <Handle type="source" position={Position.Top} id="top" className={handleStyle} />
      <Handle type="target" position={Position.Bottom} className={handleStyle} />
      <Handle type="source" position={Position.Bottom} id="bottom" className={handleStyle} />
      <Handle type="target" position={Position.Left} className={handleStyle} />
      <Handle type="source" position={Position.Left} id="left" className={handleStyle} />
      <Handle type="target" position={Position.Right} className={handleStyle} />
      <Handle type="source" position={Position.Right} id="right" className={handleStyle} />

      <Dialog open={isPreviewOpen} onOpenChange={setIsPreviewOpen}>
        <div
          className={cn(
            'relative bg-white rounded-lg shadow-md overflow-hidden border-2 p-4 min-w-[180px]',
            selected ? 'border-primary' : 'border-muted'
          )}
        >
          <DialogTrigger asChild>
            <div className="flex flex-col items-center gap-2 cursor-pointer hover:opacity-80 transition-opacity">
              <FileText className="h-12 w-12 text-red-500" />
              <span className="text-xs text-muted-foreground truncate max-w-[160px] text-center">
                {data.file_name}
              </span>
              <span className="text-xs text-primary">Clique para visualizar</span>
            </div>
          </DialogTrigger>

          {/* Action buttons */}
          {selected && (
            <div className="absolute top-1 right-1 flex gap-1">
              <Button
                size="icon"
                variant="secondary"
                className="h-6 w-6"
                onClick={(e) => {
                  e.stopPropagation();
                  window.open(data.file_url, '_blank');
                }}
                title="Abrir em nova aba"
              >
                <ExternalLink className="h-3 w-3" />
              </Button>
              <Button
                size="icon"
                variant="destructive"
                className="h-6 w-6"
                onClick={(e) => {
                  e.stopPropagation();
                  data.onDelete(data.dbId);
                }}
                title="Excluir"
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
          )}
        </div>

        <DialogContent className="max-w-5xl h-[85vh]">
          <div className="flex flex-col h-full">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium">{data.file_name}</span>
              <Button
                size="sm"
                variant="outline"
                onClick={() => window.open(data.file_url, '_blank')}
              >
                <ExternalLink className="h-4 w-4 mr-2" />
                Abrir em nova aba
              </Button>
            </div>
            <iframe
              src={data.file_url}
              className="flex-1 w-full border rounded"
              title={data.file_name}
            />
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

export const PDFNode = memo(PDFNodeComponent);
