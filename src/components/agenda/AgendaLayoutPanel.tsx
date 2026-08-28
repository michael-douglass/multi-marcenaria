import { useRef, useState } from 'react';
import {
  ImagePlus,
  Loader2,
  Monitor,
  Smartphone,
  Trash2,
  LayoutTemplate,
  ExternalLink,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { AgendaConfig } from '@/hooks/useAgenda';
import { useAgendaBannerUpload } from '@/hooks/useAgendaBannerUpload';
import {
  formatMaxMb,
  MAX_EMPRESA_BANNER_BYTES,
  validateEmpresaBannerFile,
} from '@/lib/empresa-branding-upload';
import { hasAgendaCustomBanner, resolveAgendaBannerUrl } from '@/lib/agenda-layout';
import { resolveAgendaPublicSubtitle } from '@/lib/agenda-public-text';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface AgendaLayoutPanelProps {
  config: AgendaConfig;
  onUpdateConfig: (updates: Partial<AgendaConfig>) => void;
  publicUrl?: string;
}

interface BannerSlotProps {
  slot: 'desktop' | 'mobile';
  label: string;
  hint: string;
  aspectClass: string;
  frameClass: string;
  imageUrl: string | null;
  isUploading: boolean;
  onUpload: (file: File) => void;
  onRemove: () => void;
}

function BannerSlotEditor({
  slot,
  label,
  hint,
  aspectClass,
  frameClass,
  imageUrl,
  isUploading,
  onUpload,
  onRemove,
}: BannerSlotProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const Icon = slot === 'desktop' ? Monitor : Smartphone;

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const error = validateEmpresaBannerFile(file);
    if (error) {
      toast.error(error);
      return;
    }

    if (file.size > 1.5 * 1024 * 1024) {
      toast.info('Otimizando imagem…', {
        description: 'Reduzimos automaticamente fotos grandes para carregar mais rápido.',
      });
    }

    onUpload(file);
    event.target.value = '';
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Icon className="h-4 w-4 text-amber-600" />
        <Label className="text-sm font-medium">{label}</Label>
      </div>
      <p className="text-xs text-muted-foreground">{hint}</p>

      <div
        className={cn(
          'relative overflow-hidden rounded-xl border-2 border-dashed transition-colors',
          frameClass,
          imageUrl ? 'border-transparent' : 'border-muted-foreground/25 bg-muted/30',
        )}
      >
        {imageUrl ? (
          <>
            <img src={imageUrl} alt="" className={cn('w-full object-cover', aspectClass)} />
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
            <div className="absolute bottom-2 left-2 right-2 flex gap-2">
              <Button
                type="button"
                size="sm"
                variant="secondary"
                className="flex-1 h-8 text-xs bg-white/90 hover:bg-white"
                onClick={() => inputRef.current?.click()}
                disabled={isUploading}
              >
                Trocar
              </Button>
              <Button
                type="button"
                size="sm"
                variant="destructive"
                className="h-8 px-2"
                onClick={onRemove}
                disabled={isUploading}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          </>
        ) : (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={isUploading}
            className={cn(
              'flex w-full flex-col items-center justify-center gap-2 p-6 text-center transition-colors hover:bg-muted/50',
              aspectClass,
            )}
          >
            {isUploading ? (
              <Loader2 className="h-8 w-8 animate-spin text-amber-600" />
            ) : (
              <ImagePlus className="h-8 w-8 text-muted-foreground/60" />
            )}
            <span className="text-xs font-medium text-muted-foreground">
              {isUploading ? 'Enviando…' : 'Clique para enviar imagem'}
            </span>
          </button>
        )}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        className="hidden"
        onChange={handleChange}
      />
    </div>
  );
}

export function AgendaLayoutPanel({ config, onUpdateConfig, publicUrl }: AgendaLayoutPanelProps) {
  const { uploadBanner } = useAgendaBannerUpload(config.id);
  const [activeSlot, setActiveSlot] = useState<'desktop' | 'mobile' | null>(null);

  const handleUpload = async (slot: 'desktop' | 'mobile', file: File) => {
    setActiveSlot(slot);
    try {
      const url = await uploadBanner.mutateAsync({ slot, file });
      onUpdateConfig(
        slot === 'desktop' ? { banner_desktop_url: url } : { banner_mobile_url: url },
      );
      toast.success(slot === 'desktop' ? 'Banner para computador salvo!' : 'Banner para celular salvo!');
    } finally {
      setActiveSlot(null);
    }
  };

  const previewDesktop = resolveAgendaBannerUrl(config, 'desktop');
  const previewMobile = resolveAgendaBannerUrl(config, 'mobile');
  const subtitle = resolveAgendaPublicSubtitle(
    config.texto_pagina_agendamento,
    config.duracao_minutos,
  );

  return (
    <Card className="border-amber-200/60 dark:border-amber-900/40 overflow-hidden">
      <div className="h-1 bg-gradient-to-r from-amber-500 via-orange-400 to-amber-600" />
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <LayoutTemplate className="h-4 w-4 text-amber-600" />
          Layout da página de agendamento
        </CardTitle>
        <CardDescription className="text-xs">
          Defina o banner de fundo que o cliente verá ao abrir o link. Use imagens diferentes
          para celular (vertical) e computador (horizontal). Máx. {formatMaxMb(MAX_EMPRESA_BANNER_BYTES)}.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid gap-5 sm:grid-cols-2">
          <BannerSlotEditor
            slot="desktop"
            label="Computador"
            hint="Recomendado: 1920×600 px ou proporção larga (paisagem)"
            aspectClass="aspect-[16/7] min-h-[120px]"
            frameClass="ring-1 ring-black/5"
            imageUrl={config.banner_desktop_url ?? null}
            isUploading={activeSlot === 'desktop' && uploadBanner.isPending}
            onUpload={(file) => void handleUpload('desktop', file)}
            onRemove={() => onUpdateConfig({ banner_desktop_url: null })}
          />
          <BannerSlotEditor
            slot="mobile"
            label="Celular"
            hint="Recomendado: 1080×1440 px ou proporção alta (retrato)"
            aspectClass="aspect-[9/16] max-h-[220px] mx-auto"
            frameClass="max-w-[140px] mx-auto ring-1 ring-black/5"
            imageUrl={config.banner_mobile_url ?? null}
            isUploading={activeSlot === 'mobile' && uploadBanner.isPending}
            onUpload={(file) => void handleUpload('mobile', file)}
            onRemove={() => onUpdateConfig({ banner_mobile_url: null })}
          />
        </div>

        {/* Prévia combinada */}
        <div className="rounded-xl border bg-[#1a100c] p-4 space-y-3">
          <p className="text-[11px] uppercase tracking-widest text-white/45 font-semibold">
            Prévia do cliente
          </p>
          <div className="grid gap-3 sm:grid-cols-[1fr_120px]">
            <div className="relative overflow-hidden rounded-lg h-24 sm:h-28">
              {hasAgendaCustomBanner(config) ? (
                <div
                  className="absolute inset-0 bg-cover bg-center"
                  style={{
                    backgroundImage: previewDesktop ? `url("${previewDesktop}")` : undefined,
                  }}
                />
              ) : (
                <div className="absolute inset-0 bg-gradient-to-br from-amber-700/40 to-[#1a100c]" />
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-[#1a100c] to-transparent" />
              <div className="absolute bottom-2 left-3 right-3">
                <p className="font-['Bebas_Neue'] text-lg text-white leading-none">
                  {config.nome_agenda}
                </p>
                <p className="text-[10px] text-white/70 truncate">{subtitle}</p>
              </div>
            </div>
            <div className="relative mx-auto w-[72px] overflow-hidden rounded-lg border border-white/10 h-24">
              {previewMobile ? (
                <div
                  className="absolute inset-0 bg-cover bg-center"
                  style={{ backgroundImage: `url("${previewMobile}")` }}
                />
              ) : previewDesktop ? (
                <div
                  className="absolute inset-0 bg-cover bg-center"
                  style={{ backgroundImage: `url("${previewDesktop}")` }}
                />
              ) : (
                <div className="absolute inset-0 bg-gradient-to-b from-amber-700/50 to-[#1a100c]" />
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-[#1a100c]/90 to-transparent" />
            </div>
          </div>
        </div>

        {publicUrl && (
          <Button variant="outline" size="sm" className="w-full" asChild>
            <a href={publicUrl} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="h-4 w-4 mr-2" />
              Abrir página pública para testar
            </a>
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
