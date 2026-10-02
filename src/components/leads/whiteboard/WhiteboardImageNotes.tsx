import { useEffect, useState } from 'react';
import { Loader2, MessageSquareText, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface WhiteboardImageNotesProps {
  imageId: string | null;
  initialNote: string | null | undefined;
  disabled?: boolean;
  /** Layout encaixado ao lado do quadro (desktop) ou abaixo (mobile). */
  compact?: boolean;
  className?: string;
  onSave: (imageId: string, note: string) => Promise<void>;
  /** Espelha o texto digitado para o pai (ex.: salvar foto + nota juntos). */
  onDraftChange?: (imageId: string, note: string) => void;
}

/**
 * Painel de notas da foto ativa da lousa.
 * Fica ao lado da imagem no desktop e abaixo no celular.
 */
export function WhiteboardImageNotes({
  imageId,
  initialNote,
  disabled = false,
  compact = false,
  className,
  onSave,
  onDraftChange,
}: WhiteboardImageNotesProps) {
  const [draft, setDraft] = useState(initialNote ?? '');
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    setDraft(initialNote ?? '');
    setDirty(false);
    if (imageId) onDraftChange?.(imageId, initialNote ?? '');
  }, [imageId, initialNote, onDraftChange]);

  if (!imageId) return null;

  const handleSave = async () => {
    if (disabled || saving) return;
    setSaving(true);
    try {
      await onSave(imageId, draft);
      setDirty(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <aside
      data-whiteboard-image-notes
      className={cn(
        'flex min-h-0 flex-col gap-2.5 rounded-xl border border-gold/35 bg-[#1a100c]/90 p-3 shadow-[0_8px_24px_rgba(0,0,0,0.28)]',
        compact ? 'w-full lg:w-72 xl:w-80' : 'w-full',
        className,
      )}
      onPointerDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex items-center gap-2 text-gold">
        <span className="flex h-7 w-7 items-center justify-center rounded-lg border border-gold/30 bg-gold/15">
          <MessageSquareText className="h-3.5 w-3.5" />
        </span>
        <div className="min-w-0 leading-tight">
          <p className="font-display text-[10px] uppercase tracking-[0.18em] text-gold/80">
            Notas da foto
          </p>
          <p className="truncate text-xs text-[#d4bc9f]">
            Vai junto na pasta ao salvar a foto (arquivo separado com miniatura)
          </p>
        </div>
      </div>

      {disabled ? (
        <p className="min-h-[6rem] whitespace-pre-wrap rounded-lg border border-gold/20 bg-black/30 px-3 py-2.5 text-sm leading-relaxed text-[#fff6ea]">
          {draft.trim() || 'Sem nota nesta foto.'}
        </p>
      ) : (
        <>
          <textarea
            value={draft}
            onChange={(e) => {
              const next = e.target.value;
              setDraft(next);
              setDirty(true);
              onDraftChange?.(imageId, next);
            }}
            rows={compact ? 8 : 4}
            placeholder="Ex.: porta de correr · 2,40 m · lado esquerdo · cliente pediu puxador preto"
            className={cn(
              'w-full resize-y rounded-lg border-2 border-gold/35 bg-[#0c0a08] px-3 py-2.5',
              'text-sm font-medium leading-relaxed text-[#fff6ea]',
              'placeholder:text-[#d4bc9f]/60',
              'outline-none focus:border-gold/70 focus:ring-2 focus:ring-gold/25',
              compact ? 'min-h-[10rem] flex-1' : 'min-h-[6rem]',
            )}
          />
          <Button
            type="button"
            size="sm"
            className="h-9 gap-1.5 self-stretch sm:self-end bg-gold text-[#1a120b] hover:bg-[#ffe6a8]"
            disabled={saving || (!dirty && draft === (initialNote ?? ''))}
            onClick={() => void handleSave()}
          >
            {saving ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Save className="h-3.5 w-3.5" />
            )}
            Salvar nota
          </Button>
        </>
      )}
    </aside>
  );
}
