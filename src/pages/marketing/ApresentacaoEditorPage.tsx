/**
 * Editor da apresentação para arquitetos (por empresa), com prévia ao vivo. O Pontua tem editor próprio
 * em /marketing/pontua/editar. Rota: /marketing/apresentacao-interna/editar. Grava `conteudo` em `crm.apresentacao_conteudo`
 * (docs/modelos-padrao/DESIGN.md §4). `{empresa}` nos textos vira o nome fantasia na tela.
 */
import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ArrowLeft, ExternalLink, Loader2, Plus, RotateCcw, Save, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAppOptional } from '@/context/AppContext';
import { useEmpresaIdentidade } from '@/hooks/useEmpresaIdentidade';
import { useApresentacaoConteudo, useSalvarApresentacaoConteudo } from '@/hooks/useApresentacaoConteudo';
import { ApresentacaoEmpresa } from '@/components/marketing/apresentacao-empresa/ApresentacaoEmpresa';
import {
  CONTEUDO_NEUTRO,
  PONTUA_NEUTRO,
  aplicarNome,
  mesclar,
  resolverPontua,
  type ApresentacaoConteudo,
} from '@/components/marketing/apresentacao-empresa/apresentacao-conteudo';
import { Imagem, Texto, TextoLongo, deParagrafos, paragrafos } from '@/components/marketing/apresentacao-empresa/editor-campos';

const ABAS = ['marca', 'secoes', 'fechamento', 'projetos', 'contato'] as const;
type Aba = (typeof ABAS)[number];

export default function ApresentacaoEditorPage() {
  const [params, setParams] = useSearchParams();
  const abaParam = params.get('aba') as Aba | null;
  const aba: Aba = abaParam && ABAS.includes(abaParam) ? abaParam : 'marca';
  const empresa = useAppOptional()?.empresa ?? null;
  const { nomeFantasia, nomePrograma } = useEmpresaIdentidade();
  const salvo = useApresentacaoConteudo();
  const salvar = useSalvarApresentacaoConteudo();

  const [conteudo, setConteudo] = useState<ApresentacaoConteudo>(CONTEUDO_NEUTRO);
  const [sujo, setSujo] = useState(false);

  // Carrega o salvo (sem trocar {empresa}: o placeholder fica editável).
  useEffect(() => {
    if (salvo.isLoading || sujo) return;
    setConteudo(mesclar(CONTEUDO_NEUTRO, salvo.data?.conteudo));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [salvo.data, salvo.isLoading]);

  const mudarC = (f: (c: ApresentacaoConteudo) => ApresentacaoConteudo) => { setConteudo((c) => f(structuredClone(c))); setSujo(true); };

  const previa = useMemo(() => ({
    conteudo: aplicarNome(conteudo, nomeFantasia),
    pontua: resolverPontua(mesclar(PONTUA_NEUTRO, salvo.data?.pontua), nomeFantasia),
    empresaId: empresa?.id ?? null,
    publicPath: null,
    previa: true,
    nomeEmpresa: nomeFantasia,
    nomePrograma,
  }), [conteudo, salvo.data?.pontua, nomeFantasia, nomePrograma, empresa?.id]);

  const gravar = async () => {
    try {
      await salvar.mutateAsync({ conteudo: conteudo as unknown as Record<string, unknown> });
      setSujo(false);
      toast.success('Apresentação salva.');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Não foi possível salvar');
    }
  };

  const restaurar = () => {
    setConteudo(mesclar(CONTEUDO_NEUTRO, salvo.data?.conteudo));
    setSujo(false);
  };

  const c = conteudo;
  const eid = empresa?.id;

  return (
    <div className="flex h-[100dvh] flex-col bg-background">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3">
        <div className="flex items-center gap-3">
          <Button asChild variant="ghost" size="sm">
            <Link to="/marketing/apresentacao-interna"><ArrowLeft className="mr-1 h-4 w-4" aria-hidden /> Voltar</Link>
          </Button>
          <div>
            <h1 className="text-lg font-semibold">Editar apresentação</h1>
            <p className="text-xs text-muted-foreground">Use {'{empresa}'} para o nome da empresa. A prévia ao lado atualiza enquanto você digita.</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {empresa?.slug ? (
            <Button asChild variant="ghost" size="sm">
              <a href={`/apresentacao/${empresa.slug}`} target="_blank" rel="noreferrer">Link público <ExternalLink className="ml-1 h-4 w-4" aria-hidden /></a>
            </Button>
          ) : null}
          <Button variant="outline" size="sm" onClick={restaurar} disabled={!sujo || salvar.isPending}>
            <RotateCcw className="mr-1 h-4 w-4" aria-hidden /> Descartar
          </Button>
          <Button size="sm" onClick={() => void gravar()} disabled={!sujo || salvar.isPending}>
            {salvar.isPending ? <Loader2 className="mr-1 h-4 w-4 animate-spin" aria-hidden /> : <Save className="mr-1 h-4 w-4" aria-hidden />}
            Salvar
          </Button>
        </div>
      </header>

      <div className="grid min-h-0 flex-1 lg:grid-cols-[minmax(380px,520px)_1fr]">
        <div className="min-h-0 overflow-y-auto border-r p-4">
          {salvo.isLoading ? (
            <p className="text-sm text-muted-foreground">Carregando…</p>
          ) : (
            <Tabs value={aba} onValueChange={(v) => setParams((p) => { p.set('aba', v); return p; }, { replace: true })}>
              <TabsList className="mb-4 flex h-auto flex-wrap">
                <TabsTrigger value="marca">Capa</TabsTrigger>
                <TabsTrigger value="secoes">Seções</TabsTrigger>
                <TabsTrigger value="fechamento">Fechamento</TabsTrigger>
                <TabsTrigger value="projetos">Projetos</TabsTrigger>
                <TabsTrigger value="contato">Contato</TabsTrigger>
              </TabsList>

              <TabsContent value="marca" className="space-y-4">
                <Texto id="m-sob" rotulo="Linha acima do título" valor={c.marca.sobrescrito} onChange={(v) => mudarC((x) => { x.marca.sobrescrito = v; return x; })} />
                <Texto id="m-tit" rotulo="Título" valor={c.marca.titulo} onChange={(v) => mudarC((x) => { x.marca.titulo = v; return x; })} />
                <Texto id="m-sub" rotulo="Subtítulo" dica="Deixe vazio para não mostrar." valor={c.marca.subtitulo} onChange={(v) => mudarC((x) => { x.marca.subtitulo = v; return x; })} />
                <TextoLongo id="m-slo" rotulo="Frase" linhas={2} valor={c.marca.slogan} onChange={(v) => mudarC((x) => { x.marca.slogan = v; return x; })} />
                <Imagem id="i-hero" rotulo="Imagem da capa" empresaId={eid} valor={c.imagens.hero} onChange={(v) => mudarC((x) => { x.imagens.hero = v; return x; })} />
                <Imagem id="i-ori" rotulo="Imagem da origem" empresaId={eid} valor={c.imagens.origem} onChange={(v) => mudarC((x) => { x.imagens.origem = v; return x; })} />
                <Imagem id="i-pro" rotulo="Imagem da proposta" empresaId={eid} valor={c.imagens.proposta} onChange={(v) => mudarC((x) => { x.imagens.proposta = v; return x; })} />
                <Imagem id="i-fec" rotulo="Imagem do fechamento" empresaId={eid} valor={c.imagens.fechamento} onChange={(v) => mudarC((x) => { x.imagens.fechamento = v; return x; })} />
              </TabsContent>

              <TabsContent value="secoes" className="space-y-6">
                {c.secoes.map((s, i) => (
                  <fieldset key={s.id} className="space-y-3 rounded-md border p-3">
                    <legend className="px-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">{s.eyebrow || s.id}</legend>
                    <Texto id={`s${i}-eye`} rotulo="Rótulo" valor={s.eyebrow} onChange={(v) => mudarC((x) => { x.secoes[i].eyebrow = v; return x; })} />
                    <Texto id={`s${i}-tit`} rotulo="Título" valor={s.title} onChange={(v) => mudarC((x) => { x.secoes[i].title = v; return x; })} />
                    <TextoLongo id={`s${i}-par`} rotulo="Texto" dica="Linha em branco separa parágrafos." linhas={6} valor={paragrafos(s.paragraphs)} onChange={(v) => mudarC((x) => { x.secoes[i].paragraphs = deParagrafos(v); return x; })} />
                    <TextoLongo id={`s${i}-des`} rotulo="Destaque" linhas={2} valor={s.highlight ?? ''} onChange={(v) => mudarC((x) => { x.secoes[i].highlight = v || undefined; return x; })} />
                  </fieldset>
                ))}
              </TabsContent>

              <TabsContent value="fechamento" className="space-y-4">
                <Texto id="f-eye" rotulo="Rótulo" valor={c.fechamento.eyebrow} onChange={(v) => mudarC((x) => { x.fechamento.eyebrow = v; return x; })} />
                <Texto id="f-tit" rotulo="Título" valor={c.fechamento.title} onChange={(v) => mudarC((x) => { x.fechamento.title = v; return x; })} />
                <TextoLongo id="f-par" rotulo="Texto" dica="Linha em branco separa parágrafos." linhas={6} valor={paragrafos(c.fechamento.paragraphs)} onChange={(v) => mudarC((x) => { x.fechamento.paragraphs = deParagrafos(v); return x; })} />
                <TextoLongo id="f-clo" rotulo="Frase final" linhas={2} valor={c.fechamento.closing} onChange={(v) => mudarC((x) => { x.fechamento.closing = v; return x; })} />
                <Texto id="f-cta" rotulo="Botão" valor={c.fechamento.ctaLabel} onChange={(v) => mudarC((x) => { x.fechamento.ctaLabel = v; return x; })} />
                <Texto id="f-hin" rotulo="Texto abaixo do botão" valor={c.fechamento.ctaHint} onChange={(v) => mudarC((x) => { x.fechamento.ctaHint = v; return x; })} />
              </TabsContent>

              <TabsContent value="projetos" className="space-y-4">
                <Texto id="p-eye" rotulo="Rótulo" valor={c.projetos.eyebrow} onChange={(v) => mudarC((x) => { x.projetos.eyebrow = v; return x; })} />
                <Texto id="p-tit" rotulo="Título" valor={c.projetos.title} onChange={(v) => mudarC((x) => { x.projetos.title = v; return x; })} />
                <TextoLongo id="p-sub" rotulo="Subtítulo" linhas={2} valor={c.projetos.subtitle} onChange={(v) => mudarC((x) => { x.projetos.subtitle = v; return x; })} />
                <h2 className="pt-2 text-sm font-semibold">Fotos da galeria</h2>
                {c.projetos.items.map((it, i) => (
                  <fieldset key={it.id} className="space-y-3 rounded-md border p-3">
                    <div className="flex items-center justify-between">
                      <legend className="text-xs font-semibold text-muted-foreground">Foto {i + 1}</legend>
                      <Button type="button" variant="ghost" size="sm" aria-label={`Remover foto ${i + 1}`} disabled={c.projetos.items.length <= 1}
                        onClick={() => mudarC((x) => { x.projetos.items.splice(i, 1); return x; })}>
                        <Trash2 className="h-4 w-4" aria-hidden />
                      </Button>
                    </div>
                    <Imagem id={`pi${i}-src`} rotulo="Imagem" empresaId={eid} valor={it.src} onChange={(v) => mudarC((x) => { x.projetos.items[i].src = v; return x; })} />
                    <Texto id={`pi${i}-tit`} rotulo="Título" valor={it.title} onChange={(v) => mudarC((x) => { x.projetos.items[i].title = v; return x; })} />
                    <Texto id={`pi${i}-cap`} rotulo="Legenda" valor={it.caption} onChange={(v) => mudarC((x) => { x.projetos.items[i].caption = v; return x; })} />
                  </fieldset>
                ))}
                <Button type="button" variant="outline" size="sm"
                  onClick={() => mudarC((x) => { x.projetos.items.push({ id: `foto-${Date.now()}`, type: 'image', src: '', title: '', caption: '' }); return x; })}>
                  <Plus className="mr-1 h-4 w-4" aria-hidden /> Adicionar foto
                </Button>
                <h2 className="pt-2 text-sm font-semibold">Fotos do efeito de cubos (seção Proposta)</h2>
                {c.cubo.map((it, i) => (
                  <fieldset key={it.id} className="space-y-3 rounded-md border p-3">
                    <legend className="text-xs font-semibold text-muted-foreground">Cubo {i + 1}</legend>
                    <Imagem id={`cu${i}-src`} rotulo="Imagem" empresaId={eid} valor={it.src} onChange={(v) => mudarC((x) => { x.cubo[i].src = v; return x; })} />
                    <Texto id={`cu${i}-tit`} rotulo="Título" valor={it.title} onChange={(v) => mudarC((x) => { x.cubo[i].title = v; return x; })} />
                  </fieldset>
                ))}
              </TabsContent>

              <TabsContent value="contato" className="space-y-4">
                <Texto id="c-ig" rotulo="Instagram (@)" valor={c.instagram.handle} onChange={(v) => mudarC((x) => { x.instagram.handle = v; return x; })} />
                <Texto id="c-igu" rotulo="Link do perfil" valor={c.instagram.profileUrl} onChange={(v) => mudarC((x) => { x.instagram.profileUrl = v; return x; })} />
                <Texto id="c-ige" rotulo="Link do feed incorporado" dica="Ex.: https://www.instagram.com/seuperfil/embed/ — vazio esconde a seção do Instagram." valor={c.instagram.embedUrl} onChange={(v) => mudarC((x) => { x.instagram.embedUrl = v; return x; })} />
                <Texto id="c-tel" rotulo="Telefone (como aparece)" valor={c.instagram.phoneDisplay} onChange={(v) => mudarC((x) => { x.instagram.phoneDisplay = v; return x; })} />
                <Texto id="c-tl2" rotulo="Telefone para ligar" dica="Com DDI, ex.: +5535999999999" valor={c.instagram.phoneTel} onChange={(v) => mudarC((x) => { x.instagram.phoneTel = v; return x; })} />
                <Texto id="c-wa" rotulo="Link do WhatsApp" dica="Ex.: https://wa.me/5535999999999" valor={c.instagram.phoneWhatsApp} onChange={(v) => mudarC((x) => { x.instagram.phoneWhatsApp = v; return x; })} />
                <Texto id="c-avi" rotulo="Aviso de contato" valor={c.contato.aviso} onChange={(v) => mudarC((x) => { x.contato.aviso = v; return x; })} />
                <TextoLongo id="c-ftx" rotulo="Texto do formulário de parceria" linhas={2} valor={c.contato.formTexto} onChange={(v) => mudarC((x) => { x.contato.formTexto = v; return x; })} />
                <TextoLongo id="c-fsu" rotulo="Mensagem após o cadastro" linhas={2} valor={c.contato.formSucesso} onChange={(v) => mudarC((x) => { x.contato.formSucesso = v; return x; })} />
                <Texto id="c-fro" rotulo="Rodapé do formulário" valor={c.contato.formRodape} onChange={(v) => mudarC((x) => { x.contato.formRodape = v; return x; })} />
                <Texto id="c-rig" rotulo="Nome no rodapé do Instagram" valor={c.contato.rodapeInstagram} onChange={(v) => mudarC((x) => { x.contato.rodapeInstagram = v; return x; })} />
              </TabsContent>

            </Tabs>
          )}
        </div>

        {/* transform cria o bloco de contenção: os elementos fixed da apresentação ficam dentro da prévia */}
        <div className="hidden min-h-0 bg-black lg:block" style={{ transform: 'translateZ(0)' }} aria-label="Prévia da apresentação">
          <ApresentacaoEmpresa conteudo={previa} semIntro />
        </div>
      </div>
    </div>
  );
}
