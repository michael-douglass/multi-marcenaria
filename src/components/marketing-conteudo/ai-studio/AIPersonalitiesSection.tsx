import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Loader2, Plus, Star, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  MarketingAIPersonality,
  useMarketingAIStudio,
} from '@/hooks/useMarketingAIStudio';
import { StudioSection } from './StudioMotionStyles';

const EMPTY_FORM = {
  nome: '',
  descricao: '',
  system_prompt: '',
  user_prompt_template: `Briefing / contexto:
{{briefing_pesquisa}}

Sugestão:
{{sugestao}}

Script atual:
{{script_copy}}

Escreva no formato:

Título: <título>

Conteúdo:
<roteiro>`,
  model: '',
};

interface PersonalityEditorFormProps {
  personality: MarketingAIPersonality;
  onSave: (payload: {
    id: string;
    nome: string;
    descricao: string | null;
    system_prompt: string;
    user_prompt_template: string;
    model: string | null;
  }) => Promise<void>;
  isSaving: boolean;
}

/** Remonta ao trocar de voz (key no pai) — evita textarea “preso” na voz anterior. */
function PersonalityEditorForm({
  personality,
  onSave,
  isSaving,
}: PersonalityEditorFormProps) {
  const [nome, setNome] = useState(personality.nome);
  const [descricao, setDescricao] = useState(personality.descricao || '');
  const [systemPrompt, setSystemPrompt] = useState(personality.system_prompt);
  const [userTemplate, setUserTemplate] = useState(
    personality.user_prompt_template,
  );
  const [model, setModel] = useState(personality.model || '');

  useEffect(() => {
    setNome(personality.nome);
    setDescricao(personality.descricao || '');
    setSystemPrompt(personality.system_prompt);
    setUserTemplate(personality.user_prompt_template);
    setModel(personality.model || '');
  }, [personality]);

  return (
    <div className="space-y-3 rounded-lg border border-amber-900/20 bg-background/70 p-3 dark:border-amber-100/15">
      <p className="rounded-md bg-amber-900/10 px-2.5 py-2 text-xs text-amber-950 dark:bg-amber-100/10 dark:text-amber-100">
        Editando esta voz — o Gerar com IA usa exatamente estes prompts.
      </p>

      <div className="space-y-2">
        <Label>Nome</Label>
        <Input value={nome} onChange={(e) => setNome(e.target.value)} />
      </div>
      <div className="space-y-2">
        <Label>Descrição</Label>
        <Input
          value={descricao}
          onChange={(e) => setDescricao(e.target.value)}
          placeholder="Quando usar essa voz"
        />
      </div>
      <div className="space-y-2">
        <Label>Modelo (opcional)</Label>
        <Input
          value={model}
          onChange={(e) => setModel(e.target.value)}
          placeholder="ex: gpt-4o"
        />
      </div>
      <div className="space-y-2">
        <Label>System prompt</Label>
        <Textarea
          value={systemPrompt}
          onChange={(e) => setSystemPrompt(e.target.value)}
          rows={8}
          className="font-mono text-xs"
        />
      </div>
      <div className="space-y-2">
        <Label>User prompt template</Label>
        <Textarea
          value={userTemplate}
          onChange={(e) => setUserTemplate(e.target.value)}
          rows={10}
          className="font-mono text-xs"
        />
      </div>

      <Button
        size="sm"
        className="studio-cta gap-2 bg-amber-900 hover:bg-amber-800"
        disabled={isSaving || !nome.trim() || !systemPrompt.trim()}
        onClick={() =>
          void onSave({
            id: personality.id,
            nome: nome.trim(),
            descricao: descricao.trim() || null,
            system_prompt: systemPrompt,
            user_prompt_template: userTemplate,
            model: model.trim() || null,
          })
        }
      >
        {isSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
        Salvar esta voz
      </Button>
    </div>
  );
}

export function AIPersonalitiesSection() {
  const {
    personalities,
    isLoadingPersonalities,
    createPersonality,
    savePersonality,
    setDefaultPersonality,
    togglePersonalityActive,
    deletePersonality,
  } = useMarketingAIStudio();

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);

  const selected = useMemo(
    () => personalities.find((p) => p.id === selectedId) ?? null,
    [personalities, selectedId],
  );

  useEffect(() => {
    if (!personalities.length) {
      setSelectedId(null);
      return;
    }
    if (!selectedId || !personalities.some((p) => p.id === selectedId)) {
      const def = personalities.find((p) => p.is_default) ?? personalities[0];
      setSelectedId(def.id);
    }
  }, [personalities, selectedId]);

  const openCreate = () => {
    setForm(EMPTY_FORM);
    setDialogOpen(true);
  };

  const handleCreate = async () => {
    if (!form.nome.trim() || !form.system_prompt.trim()) return;
    const created = await createPersonality.mutateAsync({
      nome: form.nome.trim(),
      descricao: form.descricao.trim() || undefined,
      system_prompt: form.system_prompt,
      user_prompt_template: form.user_prompt_template,
      model: form.model.trim() || null,
      is_default: personalities.length === 0,
    });
    setSelectedId(created.id);
    setDialogOpen(false);
  };

  const saving = createPersonality.isPending || savePersonality.isPending;

  return (
    <StudioSection
      title="Personalidades (vozes)"
      description="Escolha a voz no Atelier de Copy. Só as ativas aparecem na geração."
      delayMs={180}
      action={
        <Button size="sm" variant="outline" className="studio-cta gap-1.5" onClick={openCreate}>
          <Plus className="h-3.5 w-3.5" />
          Nova voz
        </Button>
      }
    >
      {isLoadingPersonalities ? (
        <p className="text-sm text-muted-foreground">Carregando vozes…</p>
      ) : personalities.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Nenhuma personalidade ainda. Crie a primeira voz.
        </p>
      ) : (
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            {personalities.map((p) => (
              <div
                key={p.id}
                className={cn(
                  'studio-voice-card rounded-lg border p-3',
                  selectedId === p.id
                    ? 'border-amber-800/50 bg-amber-50/80 dark:border-amber-400/40 dark:bg-amber-950/40'
                    : 'border-border bg-background/70',
                )}
              >
                <div className="mb-2 flex items-start justify-between gap-2">
                  <button
                    type="button"
                    className="text-left"
                    onClick={() => setSelectedId(p.id)}
                  >
                    <p className="font-medium leading-tight">{p.nome}</p>
                    {p.descricao ? (
                      <p className="mt-0.5 text-xs text-muted-foreground line-clamp-2">
                        {p.descricao}
                      </p>
                    ) : null}
                  </button>
                  <div className="flex items-center gap-1">
                    {p.is_default ? (
                      <Badge className="bg-amber-800 text-[10px] hover:bg-amber-800">
                        padrão
                      </Badge>
                    ) : (
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7"
                        title="Definir como padrão"
                        onClick={() => setDefaultPersonality.mutate(p.id)}
                      >
                        <Star className="h-3.5 w-3.5" />
                      </Button>
                    )}
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7 text-destructive"
                      onClick={() => deletePersonality.mutate(p.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <Label htmlFor={`pers-ativo-${p.id}`} className="text-xs">
                    Ativa
                  </Label>
                  <Switch
                    id={`pers-ativo-${p.id}`}
                    checked={p.ativo}
                    onCheckedChange={(checked) =>
                      togglePersonalityActive.mutate({ id: p.id, ativo: checked })
                    }
                  />
                </div>
              </div>
            ))}
          </div>

          {selected ? (
            <PersonalityEditorForm
              key={selected.id}
              personality={selected}
              isSaving={savePersonality.isPending}
              onSave={async (payload) => {
                await savePersonality.mutateAsync(payload);
              }}
            />
          ) : null}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Nova personalidade</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-2">
              <Label>Nome</Label>
              <Input
                value={form.nome}
                onChange={(e) => setForm((f) => ({ ...f, nome: e.target.value }))}
                placeholder="Ex: Urgente e promocional"
              />
            </div>
            <div className="space-y-2">
              <Label>Descrição</Label>
              <Input
                value={form.descricao}
                onChange={(e) =>
                  setForm((f) => ({ ...f, descricao: e.target.value }))
                }
                placeholder="Quando usar essa voz"
              />
            </div>
            <div className="space-y-2">
              <Label>Modelo (opcional)</Label>
              <Input
                value={form.model}
                onChange={(e) => setForm((f) => ({ ...f, model: e.target.value }))}
                placeholder="ex: gpt-4o"
              />
            </div>
            <div className="space-y-2">
              <Label>System prompt</Label>
              <Textarea
                value={form.system_prompt}
                onChange={(e) =>
                  setForm((f) => ({ ...f, system_prompt: e.target.value }))
                }
                rows={4}
                className="font-mono text-xs"
              />
            </div>
            <div className="space-y-2">
              <Label>User prompt template</Label>
              <Textarea
                value={form.user_prompt_template}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    user_prompt_template: e.target.value,
                  }))
                }
                rows={6}
                className="font-mono text-xs"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancelar
            </Button>
            <Button
              className="studio-cta gap-2 bg-amber-900 hover:bg-amber-800"
              onClick={() => void handleCreate()}
              disabled={saving || !form.nome.trim() || !form.system_prompt.trim()}
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Criar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </StudioSection>
  );
}
