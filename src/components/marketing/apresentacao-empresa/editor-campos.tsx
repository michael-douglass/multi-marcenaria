/**
 * Campos dos editores da apresentação e do Pontua (rótulo + input, textos longos e imagem com envio
 * para o storage `marketing-medias/apresentacao/<empresa>/`).
 */
import { useState, type ReactNode } from 'react';
import { ImagePlus, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/lib/supabase';

export const paragrafos = (v: string[]) => v.join('\n\n');
export const deParagrafos = (v: string) => v.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);

export function Campo({ id, rotulo, dica, children }: { id: string; rotulo: string; dica?: string; children: ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{rotulo}</Label>
      {children}
      {dica ? <p className="text-[0.75rem] text-muted-foreground">{dica}</p> : null}
    </div>
  );
}

export function Texto({ id, rotulo, valor, onChange, dica }: { id: string; rotulo: string; valor: string; onChange: (v: string) => void; dica?: string }) {
  return (
    <Campo id={id} rotulo={rotulo} dica={dica}>
      <Input id={id} value={valor} onChange={(e) => onChange(e.target.value)} />
    </Campo>
  );
}

export function TextoLongo({ id, rotulo, valor, onChange, dica, linhas = 4 }: { id: string; rotulo: string; valor: string; onChange: (v: string) => void; dica?: string; linhas?: number }) {
  return (
    <Campo id={id} rotulo={rotulo} dica={dica}>
      <Textarea id={id} rows={linhas} value={valor} onChange={(e) => onChange(e.target.value)} />
    </Campo>
  );
}

/** URL da imagem + envio de arquivo para o storage (bucket marketing-medias, pasta da empresa). */
export function Imagem({ id, rotulo, valor, onChange, empresaId }: { id: string; rotulo: string; valor: string; onChange: (v: string) => void; empresaId: string | undefined }) {
  const [enviando, setEnviando] = useState(false);
  const enviar = async (arquivo: File | undefined) => {
    if (!arquivo || !empresaId) return;
    setEnviando(true);
    try {
      const ext = (arquivo.name.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '');
      const caminho = `apresentacao/${empresaId}/${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from('marketing-medias').upload(caminho, arquivo, { upsert: false, contentType: arquivo.type });
      if (error) throw error;
      onChange(supabase.storage.from('marketing-medias').getPublicUrl(caminho).data.publicUrl);
      toast.success('Imagem enviada.');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Não foi possível enviar a imagem');
    } finally {
      setEnviando(false);
    }
  };
  return (
    <Campo id={id} rotulo={rotulo}>
      <div className="flex items-center gap-2">
        {valor ? <img src={valor} alt="" className="h-10 w-10 shrink-0 rounded object-cover" /> : null}
        <Input id={id} value={valor} onChange={(e) => onChange(e.target.value)} placeholder="https://… ou /imagens/…" />
        <label className="inline-flex h-10 shrink-0 cursor-pointer items-center gap-1.5 rounded-md border px-3 text-sm hover:bg-muted">
          {enviando ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <ImagePlus className="h-4 w-4" aria-hidden />}
          <span className="sr-only sm:not-sr-only">Enviar</span>
          <input type="file" accept="image/*" className="sr-only" disabled={enviando} onChange={(e) => void enviar(e.target.files?.[0])} />
        </label>
      </div>
    </Campo>
  );
}
