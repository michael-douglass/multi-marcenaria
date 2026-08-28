import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useEmpresaBranding, type EmpresaBrandingInput } from '@/hooks/useEmpresaBranding';
import type { Empresa } from '@/contexts/EmpresaContext';
import { GARBO_LOGO_SRC } from '@/lib/garbo-brand';
import { ImagePlus, Loader2, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

interface EmpresaBrandingFormProps {
  empresa?: Empresa | null;
  onSalvo?: () => void;
}

export function EmpresaBrandingForm({ empresa, onSalvo }: EmpresaBrandingFormProps) {
  const { salvarBranding, removerLogo } = useEmpresaBranding(empresa);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [form, setForm] = useState<EmpresaBrandingInput>({
    nome: empresa?.nome ?? '',
    cor_primaria: empresa?.cor_primaria ?? '#f97316',
    logo_url: empresa?.logo_url ?? null,
  });
  const [logoPreview, setLogoPreview] = useState<string | null>(empresa?.logo_url ?? null);
  const [logoFile, setLogoFile] = useState<File | null>(null);

  useEffect(() => {
    setForm({
      nome: empresa?.nome ?? '',
      cor_primaria: empresa?.cor_primaria ?? '#f97316',
      logo_url: empresa?.logo_url ?? null,
    });
    setLogoPreview(empresa?.logo_url ?? null);
    setLogoFile(null);
  }, [empresa?.id, empresa?.nome, empresa?.cor_primaria, empresa?.logo_url]);

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Selecione um arquivo de imagem válido');
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      toast.error('Imagem muito grande. Máximo: 2 MB');
      return;
    }

    setLogoFile(file);
    setLogoPreview(URL.createObjectURL(file));
  };

  const handleSubmit = async () => {
    await salvarBranding.mutateAsync({ dados: form, logoFile });
    onSalvo?.();
  };

  const handleRemoverLogo = async () => {
    await removerLogo.mutateAsync();
    setLogoPreview(null);
    setLogoFile(null);
    setForm((prev) => ({ ...prev, logo_url: null }));
  };

  if (!empresa) {
    return (
      <p className="text-sm text-muted-foreground">
        Selecione ou vincule uma empresa para configurar logo e nome exibidos no menu lateral.
      </p>
    );
  }

  const logoSrc = logoPreview || GARBO_LOGO_SRC;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-6 sm:flex-row sm:items-start">
        <div
          className="flex h-24 w-24 shrink-0 items-center justify-center rounded-lg border bg-muted/40 p-2"
          style={{ borderColor: form.cor_primaria }}
        >
          <img
            src={logoSrc}
            alt={form.nome || 'Logo da empresa'}
            className="max-h-full max-w-full object-contain"
          />
        </div>

        <div className="flex-1 space-y-3">
          <div className="space-y-2">
            <Label>Logo da empresa</Label>
            <p className="text-xs text-muted-foreground">
              Aparece no topo do menu lateral. PNG, JPG ou WebP — máximo 2 MB.
            </p>
            <div className="flex flex-wrap gap-2">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleLogoChange}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-2"
                onClick={() => fileInputRef.current?.click()}
              >
                <ImagePlus className="h-4 w-4" />
                Enviar logo
              </Button>
              {(logoPreview || empresa.logo_url) && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="gap-2"
                  onClick={handleRemoverLogo}
                  disabled={removerLogo.isPending}
                >
                  <Trash2 className="h-4 w-4" />
                  Remover logo
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="empresa-nome">Nome exibido no menu</Label>
        <Input
          id="empresa-nome"
          value={form.nome}
          onChange={(e) => setForm((prev) => ({ ...prev, nome: e.target.value }))}
          placeholder="Nome da sua empresa"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="empresa-cor">Cor de destaque</Label>
        <div className="flex gap-2 items-center">
          <input
            type="color"
            id="empresa-cor"
            value={form.cor_primaria}
            onChange={(e) => setForm((prev) => ({ ...prev, cor_primaria: e.target.value }))}
            className="h-10 w-14 rounded border cursor-pointer"
          />
          <Input
            value={form.cor_primaria}
            onChange={(e) => setForm((prev) => ({ ...prev, cor_primaria: e.target.value }))}
            className="flex-1"
          />
        </div>
      </div>

      <div
        className="rounded-lg border p-4"
        style={{ borderLeftWidth: 4, borderLeftColor: form.cor_primaria }}
      >
        <p className="text-xs text-muted-foreground mb-1">Pré-visualização do cabeçalho do menu</p>
        <div className="flex items-center gap-3">
          <img src={logoSrc} alt="" className="h-10 w-10 object-contain" />
          <span className="font-display text-lg truncate" style={{ color: form.cor_primaria }}>
            {form.nome || 'Nome da empresa'}
          </span>
        </div>
      </div>

      <div className="flex justify-end">
        <Button onClick={handleSubmit} disabled={!form.nome.trim() || salvarBranding.isPending}>
          {salvarBranding.isPending ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Salvando...
            </>
          ) : (
            'Salvar identidade visual'
          )}
        </Button>
      </div>
    </div>
  );
}