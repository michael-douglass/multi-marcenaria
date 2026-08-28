import { GripVertical } from 'lucide-react';
import {
  Group,
  Panel,
  Separator,
  type GroupProps,
  type PanelProps,
  type SeparatorProps,
} from 'react-resizable-panels';

import { cn } from '@/lib/utils';

/** v3 usava números como %; v4 interpreta número como pixels. */
function toPanelSize(value?: number | string) {
  if (value == null) return undefined;
  if (typeof value === 'number') return `${value}%`;
  return value;
}

interface ResizablePanelGroupProps extends Omit<GroupProps, 'orientation'> {
  /** Compatível com a API antiga (react-resizable-panels v3). */
  direction?: GroupProps['orientation'];
  orientation?: GroupProps['orientation'];
}

const ResizablePanelGroup = ({
  className,
  direction,
  orientation,
  ...props
}: ResizablePanelGroupProps) => (
  <Group
    orientation={orientation ?? direction ?? 'horizontal'}
    className={cn('flex h-full w-full aria-[orientation=vertical]:flex-col', className)}
    {...props}
  />
);

const ResizablePanel = ({
  defaultSize,
  minSize,
  maxSize,
  ...props
}: PanelProps) => (
  <Panel
    defaultSize={toPanelSize(defaultSize)}
    minSize={toPanelSize(minSize)}
    maxSize={toPanelSize(maxSize)}
    {...props}
  />
);

const ResizableHandle = ({
  withHandle,
  className,
  ...props
}: SeparatorProps & {
  withHandle?: boolean;
}) => (
  <Separator
    className={cn(
      'relative flex w-px items-center justify-center bg-border after:absolute after:inset-y-0 after:left-1/2 after:w-1 after:-translate-x-1/2 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring focus-visible:ring-offset-1 aria-[orientation=horizontal]:h-px aria-[orientation=horizontal]:w-full aria-[orientation=horizontal]:after:left-0 aria-[orientation=horizontal]:after:h-1 aria-[orientation=horizontal]:after:w-full aria-[orientation=horizontal]:after:translate-x-0 aria-[orientation=horizontal]:after:-translate-y-1/2 [&[aria-orientation=horizontal]>div]:rotate-90',
      className,
    )}
    {...props}
  >
    {withHandle ? (
      <div className="z-10 flex h-4 w-3 items-center justify-center rounded-sm border bg-border">
        <GripVertical className="h-2.5 w-2.5" />
      </div>
    ) : null}
  </Separator>
);

export { ResizablePanelGroup, ResizablePanel, ResizableHandle };
