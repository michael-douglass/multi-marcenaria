import { useEffect, useRef, useState } from 'react';
import { Pencil, RotateCcw } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  usePipelineDashboardLabels,
  usePipelineDashboardLabelsOptional,
} from '@/contexts/PipelineDashboardLabelsContext';
import type { PipelineDashboardLabelKey } from '@/lib/pipeline-dashboard-labels';
import { PIPELINE_DASHBOARD_LABEL_DEFAULTS } from '@/lib/pipeline-dashboard-labels';
import { cn } from '@/lib/utils';

type EditableCardTitleVariant = 'metric' | 'section' | 'heading';

interface EditableCardTitleProps {
  labelKey: PipelineDashboardLabelKey;
  fallback?: string;
  variant?: EditableCardTitleVariant;
  className?: string;
  as?: 'p' | 'h2' | 'h3' | 'span';
}

const variantClasses: Record<EditableCardTitleVariant, string> = {
  metric: 'text-xs font-medium text-muted-foreground uppercase tracking-wide',
  section: 'text-sm font-semibold text-foreground',
  heading: 'text-base font-semibold text-foreground',
};

export function EditableCardTitle({
  labelKey,
  fallback,
  variant = 'metric',
  className,
  as: Tag = 'p',
}: EditableCardTitleProps) {
  const ctx = usePipelineDashboardLabelsOptional();
  const defaultText = fallback ?? PIPELINE_DASHBOARD_LABEL_DEFAULTS[labelKey];

  if (!ctx) {
    return <Tag className={cn(variantClasses[variant], className)}>{defaultText}</Tag>;
  }

  return (
    <EditableCardTitleInner
      labelKey={labelKey}
      defaultText={defaultText}
      variant={variant}
      className={className}
      Tag={Tag}
    />
  );
}

function EditableCardTitleInner({
  labelKey,
  defaultText,
  variant,
  className,
  Tag,
}: {
  labelKey: PipelineDashboardLabelKey;
  defaultText: string;
  variant: EditableCardTitleVariant;
  className?: string;
  Tag: 'p' | 'h2' | 'h3' | 'span';
}) {
  const { canEdit, editMode, getLabel, setLabel, resetLabel } = usePipelineDashboardLabels();
  const displayText = getLabel(labelKey, defaultText);
  const [draft, setDraft] = useState(displayText);
  const [isEditing, setIsEditing] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isEditing) setDraft(displayText);
  }, [displayText, isEditing]);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const commit = () => {
    setLabel(labelKey, draft);
    setIsEditing(false);
  };

  const showInlineEdit = canEdit && (editMode || isEditing);

  if (showInlineEdit) {
    return (
      <div className={cn('flex items-center gap-1 min-w-0 flex-1', className)}>
        <Input
          ref={inputRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              commit();
            }
            if (e.key === 'Escape') {
              setDraft(displayText);
              setIsEditing(false);
            }
          }}
          className={cn(
            'h-7 text-xs px-2',
            variant === 'metric' && 'uppercase tracking-wide',
            variant === 'section' && 'text-sm font-semibold',
            variant === 'heading' && 'text-base font-semibold'
          )}
          aria-label={`Nome do card: ${defaultText}`}
        />
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-6 w-6 shrink-0"
          title="Restaurar nome padrão"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => {
            resetLabel(labelKey);
            setDraft(defaultText);
            setIsEditing(false);
          }}
        >
          <RotateCcw className="h-3 w-3" />
        </Button>
      </div>
    );
  }

  return (
    <Tag
      className={cn(
        variantClasses[variant],
        'truncate',
        canEdit && 'cursor-pointer hover:text-foreground transition-colors',
        className
      )}
      onClick={() => canEdit && setIsEditing(true)}
      title={canEdit ? 'Clique para renomear' : undefined}
    >
      <span className="inline-flex items-center gap-1 min-w-0">
        <span className="truncate">{displayText}</span>
        {canEdit && <Pencil className="h-3 w-3 shrink-0 opacity-0 group-hover:opacity-60" />}
      </span>
    </Tag>
  );
}
