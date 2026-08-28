import { Link } from 'react-router-dom';
import React, { useState, useEffect, useMemo } from 'react';
import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import {
  ArrowLeft,
  Palette,
  LayoutGrid,
  MessageSquare,
  Package,
  FileText,
  Plus,
  Trash2,
  Save,
  Loader2,
  Image as ImageIcon,
  CreditCard,
} from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useOrcamentoSlideTemplate } from '@/hooks/useOrcamentoSlideTemplate';
import { useOrcamentoSlideBlocos } from '@/hooks/useOrcamentoSlideBlocos';
import { PerguntasConfigEditor } from '@/components/orcamento-slides/PerguntasConfigEditor';
import { FormasPagamentoConfig } from '@/components/orcamento-slides/FormasPagamentoConfig';
import { useOrcamentoSlideCatalogo } from '@/hooks/useOrcamentoSlideCatalogo';
import { useOrcamentoSlideScripts } from '@/hooks/useOrcamentoSlideScripts';
import type { BlocoTipo, CatalogCategoria, OrcamentoSlideBloco } from '@/lib/orcamento-slide-types';
import type { BlocoLayoutConfig } from '@/lib/orcamento-slide-types';
import { BLOCO_LABELS } from '@/lib/orcamento-slide-types';
import { OrcamentoSlideLivePreview } from '@/components/orcamento-slides/OrcamentoSlideLivePreview';
import { BlocoLayoutEditor } from '@/components/orcamento-slides/BlocoLayoutEditor';
import { BlocoImagensEditor } from '@/components/orcamento-slides/BlocoImagensEditor';
import { BlocoTextosEditor } from '@/components/orcamento-slides/BlocoTextosEditor';
import { BlocoSortableItem } from '@/components/orcamento-slides/BlocoSortableItem';
import { ImagemUploadZona } from '@/components/orcamento-slides/ImagemUploadZona';
import { processarImagemSlide } from '@/lib/orcamento-slide-imagem-spec';
import { toast } from 'sonner';

type FormPaleta = {
  nome: string;
  cor_primaria: string;
  cor_secundaria: string;
  cor_fundo: string;
  cor_texto: string;
  fonte_titulo: string;
  fonte_corpo: string;
  logo_url: string;
  fundo_url: string;
};

// ── Aba: Visual ──────────────────────────────────────────────────────────────
function AbaVisual() {
  const { template, upsertTemplate, uploadImagem, isLoading } = useOrcamentoSlideTemplate();
  const { blocos } = useOrcamentoSlideBlocos(template?.id);
  const [uploadingField, setUploadingField] = useState<'logo_url' | 'fundo_url' | null>(null);
  const [form, setForm] = useState<FormPaleta>({
    nome: 'Padrão',
    cor_primaria: '#2a1812',
    cor_secundaria: '#f2d892',
    cor_texto: '#FFFFFF',
    cor_fundo: '#2a1812',
    fonte_titulo: 'Playfair Display',
    fonte_corpo: 'Lato',
    logo_url: '',
    fundo_url: '',
  });

  // Sincronizar form quando o template carregar do banco
  useEffect(() => {
    if (!template) return;
    setForm({
      nome: template.nome ?? 'Padrão',
      cor_primaria: template.cor_primaria ?? '#2a1812',
      cor_secundaria: template.cor_secundaria ?? '#f2d892',
      cor_texto: template.cor_texto ?? '#FFFFFF',
      cor_fundo: template.cor_fundo ?? '#2a1812',
      fonte_titulo: template.fonte_titulo ?? 'Playfair Display',
      fonte_corpo: template.fonte_corpo ?? 'Lato',
      logo_url: template.logo_url ?? '',
      fundo_url: template.fundo_url ?? '',
    });
  }, [template?.id]); // roda só quando o template muda (não a cada keystroke)

  const handleSave = () => {
    upsertTemplate.mutate({ ...form, id: template?.id });
  };

  const handleUploadImagem = async (file: File, campo: 'logo_url' | 'fundo_url') => {
    setUploadingField(campo);
    try {
      let arquivo = file;
      if (campo === 'fundo_url') {
        const { file: processado } = await processarImagemSlide(file);
        arquivo = processado;
      }
      const url = await uploadImagem.mutateAsync({ file: arquivo, campo });
      setForm((p) => ({ ...p, [campo]: url }));
      upsertTemplate.mutate({ ...form, [campo]: url, id: template?.id });
      if (campo === 'fundo_url') {
        toast.success('Banner ajustado para o formato de slide (1920×1080 ou 1080×1920)');
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Formato de imagem inválido');
    } finally {
      setUploadingField(null);
    }
  };

  if (isLoading) return <div className="flex justify-center py-12"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-8 xl:items-stretch">
      {/* Formulário */}
      <div className="flex flex-col gap-5">
        {/* Imagens */}
        <div className="rounded-xl border border-border/60 p-4 bg-card flex flex-col gap-4">
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <ImageIcon className="h-4 w-4 text-amber-400" />
            Imagens da marca
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <ImagemUploadZona
              label="Logo da empresa"
              descricao="Aparece no slide capa. PNG com fundo transparente recomendado."
              valor={form.logo_url}
              onUpload={(f) => handleUploadImagem(f, 'logo_url')}
              onRemover={() => { setForm((p) => ({ ...p, logo_url: '' })); upsertTemplate.mutate({ ...form, logo_url: '', id: template?.id }); }}
              isUploading={uploadingField === 'logo_url'}
            />
            <ImagemUploadZona
              label="Banner / fundo da capa"
              descricao="Imagem de fundo do slide inicial."
              formatoSlide
              orientacao="paisagem"
              valor={form.fundo_url}
              onUpload={(f) => handleUploadImagem(f, 'fundo_url')}
              onRemover={() => { setForm((p) => ({ ...p, fundo_url: '' })); upsertTemplate.mutate({ ...form, fundo_url: '', id: template?.id }); }}
              isUploading={uploadingField === 'fundo_url'}
            />
          </div>
        </div>

        {/* Cores */}
        <div className="rounded-xl border border-border/60 p-4 bg-card flex flex-col gap-4">
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <Palette className="h-4 w-4 text-amber-400" />
            Paleta de cores
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <Label>Cor primária</Label>
              <div className="flex gap-2">
                <input type="color" value={form.cor_primaria} onChange={(e) => setForm((p) => ({ ...p, cor_primaria: e.target.value }))} className="h-9 w-12 rounded border border-border cursor-pointer shrink-0" />
                <Input value={form.cor_primaria} onChange={(e) => setForm((p) => ({ ...p, cor_primaria: e.target.value }))} className="font-mono md:text-sm" />
              </div>
              <p className="text-xs text-muted-foreground">Fundo da capa e precificação</p>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label>Cor secundária</Label>
              <div className="flex gap-2">
                <input type="color" value={form.cor_secundaria} onChange={(e) => setForm((p) => ({ ...p, cor_secundaria: e.target.value }))} className="h-9 w-12 rounded border border-border cursor-pointer shrink-0" />
                <Input value={form.cor_secundaria} onChange={(e) => setForm((p) => ({ ...p, cor_secundaria: e.target.value }))} className="font-mono md:text-sm" />
              </div>
              <p className="text-xs text-muted-foreground">Títulos e destaques dourados</p>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label>Cor de fundo</Label>
              <div className="flex gap-2">
                <input type="color" value={form.cor_fundo} onChange={(e) => setForm((p) => ({ ...p, cor_fundo: e.target.value }))} className="h-9 w-12 rounded border border-border cursor-pointer shrink-0" />
                <Input value={form.cor_fundo} onChange={(e) => setForm((p) => ({ ...p, cor_fundo: e.target.value }))} className="font-mono md:text-sm" />
              </div>
              <p className="text-xs text-muted-foreground">Slides de conteúdo</p>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label>Cor de texto</Label>
              <div className="flex gap-2">
                <input type="color" value={form.cor_texto} onChange={(e) => setForm((p) => ({ ...p, cor_texto: e.target.value }))} className="h-9 w-12 rounded border border-border cursor-pointer shrink-0" />
                <Input value={form.cor_texto} onChange={(e) => setForm((p) => ({ ...p, cor_texto: e.target.value }))} className="font-mono md:text-sm" />
              </div>
              <p className="text-xs text-muted-foreground">Texto principal</p>
            </div>
          </div>
        </div>

        {/* Tipografia */}
        <div className="rounded-xl border border-border/60 p-4 bg-card flex flex-col gap-4">
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <FileText className="h-4 w-4 text-amber-400" />
            Tipografia
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <Label>Fonte dos títulos</Label>
              <Input value={form.fonte_titulo} onChange={(e) => setForm((p) => ({ ...p, fonte_titulo: e.target.value }))} placeholder="Playfair Display" />
              <p className="text-xs text-muted-foreground">Google Fonts — ex.: Playfair Display, Cormorant Garamond</p>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Fonte do corpo</Label>
              <Input value={form.fonte_corpo} onChange={(e) => setForm((p) => ({ ...p, fonte_corpo: e.target.value }))} placeholder="Lato" />
              <p className="text-xs text-muted-foreground">Google Fonts — ex.: Lato, Nunito, Open Sans</p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex flex-col gap-1.5 flex-1">
            <Label>Nome do template</Label>
            <Input value={form.nome} onChange={(e) => setForm((p) => ({ ...p, nome: e.target.value }))} />
          </div>
          <Button onClick={handleSave} disabled={upsertTemplate.isPending} className="self-end bg-amber-600 hover:bg-amber-700 text-white shrink-0">
            {upsertTemplate.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
            Salvar
          </Button>
        </div>
      </div>

      <OrcamentoSlideLivePreview
        className="sticky top-4 min-h-[min(70vh,640px)] xl:min-h-0 xl:h-full"
        template={{ ...form, logo_url: form.logo_url || null, fundo_url: form.fundo_url || null }}
        blocos={blocos}
        templateId={template?.id}
      />
    </div>
  );
}

// ── Aba: Blocos ──────────────────────────────────────────────────────────────
function AbaBlocos() {
  const { template } = useOrcamentoSlideTemplate();
  const {
    blocos,
    criarBloco,
    atualizarBloco,
    removerBloco,
    toggleBloco,
    reordenarBlocos,
    uploadImagemBloco,
    isLoading,
  } = useOrcamentoSlideBlocos(template?.id);
  const [novoTipo, setNovoTipo] = useState<BlocoTipo>('capa');
  const [expandidoId, setExpandidoId] = useState<string | null>(null);
  const [ordemLocal, setOrdemLocal] = useState<OrcamentoSlideBloco[]>([]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
  );

  useEffect(() => {
    setOrdemLocal(blocos);
  }, [blocos]);

  const blocoIds = useMemo(() => ordemLocal.map((b) => b.id), [ordemLocal]);

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = ordemLocal.findIndex((b) => b.id === active.id);
    const newIndex = ordemLocal.findIndex((b) => b.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;

    const reordenados = arrayMove(ordemLocal, oldIndex, newIndex);
    setOrdemLocal(reordenados);
    reordenarBlocos.mutate(reordenados.map((b, i) => ({ id: b.id, ordem: i })));
  };

  const salvarConfig = (blocoId: string, patch: Record<string, unknown>) => {
    const bloco = blocos.find((b) => b.id === blocoId);
    if (!bloco) return;
    atualizarBloco.mutate({
      id: blocoId,
      config: { ...bloco.config, ...patch },
    });
  };

  const salvarLayout = (blocoId: string, layout: BlocoLayoutConfig) => {
    salvarConfig(blocoId, { layout });
  };

  if (!template) return <p className="text-muted-foreground text-sm py-4">Configure o template visual primeiro.</p>;

  return (
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-8 xl:items-stretch">
      <div className="flex flex-col gap-5">
      <div className="flex items-center gap-3">
        <Select value={novoTipo} onValueChange={(v) => setNovoTipo(v as BlocoTipo)}>
          <SelectTrigger className="w-52">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {(Object.entries(BLOCO_LABELS) as [BlocoTipo, string][]).map(([key, label]) => (
              <SelectItem key={key} value={key}>{label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          size="sm"
          onClick={() => criarBloco.mutate({ tipo: novoTipo })}
          disabled={criarBloco.isPending}
        >
          <Plus className="h-4 w-4 mr-1.5" />
          Adicionar bloco
        </Button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
      ) : ordemLocal.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhum bloco. Adicione blocos para montar o template.</p>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={blocoIds} strategy={verticalListSortingStrategy}>
            <div className="flex flex-col gap-2">
              {ordemLocal.map((bloco, i) => (
                <BlocoSortableItem
                  key={bloco.id}
                  bloco={bloco}
                  index={i}
                  expandido={expandidoId === bloco.id}
                  onToggleExpand={() => setExpandidoId((id) => (id === bloco.id ? null : bloco.id))}
                  onToggleAtivo={(ativo) => toggleBloco.mutate({ id: bloco.id, ativo })}
                  onRemove={() => removerBloco.mutate(bloco.id)}
                  removendo={removerBloco.isPending}
                >
                  <div className="px-4 pb-4">
                    <BlocoTextosEditor
                      bloco={bloco}
                      onConfigChange={(patch) => salvarConfig(bloco.id, patch)}
                    />
                    <BlocoImagensEditor
                      bloco={bloco}
                      onConfigChange={(patch) => salvarConfig(bloco.id, patch)}
                      onUpload={(file) => uploadImagemBloco.mutateAsync({ file, blocoId: bloco.id })}
                    />
                    <BlocoLayoutEditor
                      bloco={bloco}
                      onChange={(layout) => salvarLayout(bloco.id, layout)}
                    />
                  </div>
                </BlocoSortableItem>
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}
      </div>

      <OrcamentoSlideLivePreview
        className="sticky top-4 min-h-[min(70vh,640px)] xl:min-h-0 xl:h-full"
        template={template}
        blocos={ordemLocal}
        templateId={template.id}
      />
    </div>
  );
}

// ── Aba: Perguntas ───────────────────────────────────────────────────────────
function AbaPerguntas() {
  return <PerguntasConfigEditor />;
}

// ── Aba: Catálogo ────────────────────────────────────────────────────────────
function AbaCatalogo() {
  const { itens, criarItem, removerItem, isLoading } = useOrcamentoSlideCatalogo();
  const [form, setForm] = useState({ titulo: '', descricao: '', categoria: 'ferragem' as CatalogCategoria, destaque: false });

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-3 rounded-xl border border-border/60 p-4 bg-card">
        <h3 className="text-sm font-semibold">Novo item</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Input value={form.titulo} onChange={(e) => setForm((p) => ({ ...p, titulo: e.target.value }))} placeholder="Título do item" />
          <Select value={form.categoria} onValueChange={(v) => setForm((p) => ({ ...p, categoria: v as CatalogCategoria }))}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="ferragem">Ferragem</SelectItem>
              <SelectItem value="mdf">MDF</SelectItem>
              <SelectItem value="usinagem">Usinagem</SelectItem>
            </SelectContent>
          </Select>
          <Textarea
            className="sm:col-span-2"
            value={form.descricao}
            onChange={(e) => setForm((p) => ({ ...p, descricao: e.target.value }))}
            placeholder="Descrição (opcional)"
            rows={2}
          />
        </div>
        <Button
          size="sm"
          className="self-start"
          disabled={!form.titulo.trim() || criarItem.isPending}
          onClick={() => {
            criarItem.mutate({ ...form, ativo: true, ordem: itens.length, imagem_url: null });
            setForm({ titulo: '', descricao: '', categoria: 'ferragem', destaque: false });
          }}
        >
          <Plus className="h-4 w-4 mr-1.5" />
          Adicionar
        </Button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
      ) : (
        <div className="flex flex-col gap-2">
          {itens.map((item) => (
            <div key={item.id} className="flex items-center gap-3 rounded-xl border border-border/60 px-4 py-3 bg-card">
              <div className="flex-1">
                <p className="text-sm font-medium">{item.titulo}</p>
                <div className="flex items-center gap-2 mt-1">
                  <Badge variant="outline" className="text-xs capitalize">{item.categoria}</Badge>
                  {item.destaque && <Badge className="text-xs bg-amber-500/15 text-amber-400 border-amber-500/30">Destaque</Badge>}
                </div>
              </div>
              <Button
                size="icon"
                variant="ghost"
                className="h-8 w-8 text-muted-foreground hover:text-destructive"
                onClick={() => removerItem.mutate(item.id)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Aba: Scripts ─────────────────────────────────────────────────────────────
function AbaScripts() {
  const { scripts, criarScript, removerScript, isLoading } = useOrcamentoSlideScripts();
  const [form, setForm] = useState({ titulo: '', conteudo: '', categoria: 'geral' });

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-3 rounded-xl border border-border/60 p-4 bg-card">
        <h3 className="text-sm font-semibold">Novo script</h3>
        <Input value={form.titulo} onChange={(e) => setForm((p) => ({ ...p, titulo: e.target.value }))} placeholder="Título do script" />
        <Input value={form.categoria} onChange={(e) => setForm((p) => ({ ...p, categoria: e.target.value }))} placeholder="Categoria (ex.: garantia, preço)" />
        <Textarea value={form.conteudo} onChange={(e) => setForm((p) => ({ ...p, conteudo: e.target.value }))} placeholder="Texto do script de argumentação..." rows={4} />
        <Button
          size="sm"
          className="self-start"
          disabled={!form.titulo.trim() || !form.conteudo.trim() || criarScript.isPending}
          onClick={() => {
            criarScript.mutate(form);
            setForm({ titulo: '', conteudo: '', categoria: 'geral' });
          }}
        >
          <Plus className="h-4 w-4 mr-1.5" />
          Adicionar
        </Button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
      ) : (
        <div className="flex flex-col gap-3">
          {scripts.map((s) => (
            <div key={s.id} className="rounded-xl border border-border/60 px-4 py-3 bg-card flex gap-3">
              <div className="flex-1">
                <p className="text-sm font-semibold">{s.titulo}</p>
                <Badge variant="outline" className="text-xs my-1">{s.categoria}</Badge>
                <p className="text-sm text-muted-foreground line-clamp-2">{s.conteudo}</p>
              </div>
              <Button
                size="icon"
                variant="ghost"
                className="h-8 w-8 text-muted-foreground hover:text-destructive shrink-0"
                onClick={() => removerScript.mutate(s.id)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Página principal ─────────────────────────────────────────────────────────
export default function OrcamentoSlidesConfigPage() {
  return (
    <div className="flex flex-col gap-6 p-4 md:p-6 max-w-7xl mx-auto">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" asChild className="gap-1.5">
          <Link to="/orcamento-slides">
            <ArrowLeft className="h-4 w-4" />
            Voltar
          </Link>
        </Button>
        <div>
          <h1 className="text-xl font-bold">Configurações — Slides de Orçamento</h1>
          <p className="text-sm text-muted-foreground">Configure template, blocos, perguntas e catálogo.</p>
        </div>
      </div>

      <Tabs defaultValue="visual">
        <TabsList className="flex-wrap h-auto gap-1">
          <TabsTrigger value="visual" className="gap-1.5">
            <Palette className="h-3.5 w-3.5" />
            Visual
          </TabsTrigger>
          <TabsTrigger value="blocos" className="gap-1.5">
            <LayoutGrid className="h-3.5 w-3.5" />
            Blocos
          </TabsTrigger>
          <TabsTrigger value="perguntas" className="gap-1.5">
            <MessageSquare className="h-3.5 w-3.5" />
            Perguntas
          </TabsTrigger>
          <TabsTrigger value="catalogo" className="gap-1.5">
            <Package className="h-3.5 w-3.5" />
            Catálogo
          </TabsTrigger>
          <TabsTrigger value="scripts" className="gap-1.5">
            <FileText className="h-3.5 w-3.5" />
            Scripts
          </TabsTrigger>
          <TabsTrigger value="pagamentos" className="gap-1.5">
            <CreditCard className="h-3.5 w-3.5" />
            Pagamentos
          </TabsTrigger>
        </TabsList>

        <ScrollArea className="mt-6">
          <TabsContent value="visual"><AbaVisual /></TabsContent>
          <TabsContent value="blocos"><AbaBlocos /></TabsContent>
          <TabsContent value="perguntas"><AbaPerguntas /></TabsContent>
          <TabsContent value="catalogo"><AbaCatalogo /></TabsContent>
          <TabsContent value="scripts"><AbaScripts /></TabsContent>
          <TabsContent value="pagamentos"><FormasPagamentoConfig /></TabsContent>
        </ScrollArea>
      </Tabs>
    </div>
  );
}
