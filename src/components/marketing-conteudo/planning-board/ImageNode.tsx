import { memo, useState } from 'react';
import { Handle, Position, NodeProps } from '@xyflow/react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogTrigger } from '@/components/ui/dialog';
import { Trash2, Maximize2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ImageNodeData {
  file_url: string;
  file_name: string;
  dbId: string;
  onDelete: (id: string) => void;
}

function ImageNodeComponent({ data, selected }: NodeProps & { data: ImageNodeData }) {
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

      <div
        className={cn(
          'relative bg-white rounded-lg shadow-md overflow-hidden border-2',
          selected ? 'border-primary' : 'border-muted'
        )}
      >
        <Dialog open={isPreviewOpen} onOpenChange={setIsPreviewOpen}>
          <DialogTrigger asChild>
            <img
              src={data.file_url}
              alt={data.file_name}
              className="max-w-[300px] max-h-[200px] object-contain cursor-pointer hover:opacity-90 transition-opacity"
            />
          </DialogTrigger>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-auto">
            <img
              src={data.file_url}
              alt={data.file_name}
              className="w-full h-auto"
            />
            <p className="text-sm text-muted-foreground text-center mt-2">{data.file_name}</p>
          </DialogContent>
        </Dialog>

        {/* File name */}
        <div className="px-2 py-1 text-xs text-muted-foreground truncate max-w-[300px] bg-muted/50">
          {data.file_name}
        </div>

        {/* Action buttons */}
        {selected && (
          <div className="absolute top-1 right-1 flex gap-1">
            <Button
              size="icon"
              variant="secondary"
              className="h-6 w-6"
              onClick={() => setIsPreviewOpen(true)}
              title="Ampliar"
            >
              <Maximize2 className="h-3 w-3" />
            </Button>
            <Button
              size="icon"
              variant="destructive"
              className="h-6 w-6"
              onClick={() => data.onDelete(data.dbId)}
              title="Excluir"
            >
              <Trash2 className="h-3 w-3" />
            </Button>
          </div>
        )}
      </div>
    </>
  );
}

export const ImageNode = memo(ImageNodeComponent);
