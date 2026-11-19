/**
 * Editor do Pontua (programa de pontuação para parceiros), com prévia ao vivo só do programa.
 * Rota: /marketing/pontua/editar. Grava `pontua` em `crm.apresentacao_conteudo` (docs/marca-neutra).
 * `{empresa}` nos textos vira o nome fantasia na tela.
 */
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, ExternalLink, Loader2, RotateCcw, Save } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
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
  type PontuaConteudo,
} from '@/components/marketing/apresentacao-empresa/apresentacao-conteudo';
import { PontuaPercentualPadrao } from '@/components/marketing/apresentacao-empresa/PontuaPercentualPadrao';
import { Texto, TextoLongo } from '@/components/marketing/apresentacao-empresa/editor-campos';

export default function PontuaEditorPage() {
  const empresa = useAppOptional()?.empresa ?? null;
  const { nomeFantasia, nomePrograma } = useEmpresaIdentidade();
  const salvo = useApresentacaoConteudo();
  const salvar = useSalvarApresentacaoConteudo();

  const [pontua, setPontua] = useState<PontuaConteudo>(PONTUA_NEUTRO);
  const [sujo, setSujo] = useState(false);

  // Carrega o salvo (sem trocar {empresa}: o placeholder fica editável).
  useEffect(() => {
    if (salvo.isLoading || sujo) return;
    setPontua(mesclar(PONTUA_NEUTRO, salvo.data?.pontua));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [salvo.data, salvo.isLoading]);

  const mudar = (f: (p: PontuaConteudo) => PontuaConteudo) => {
    setPontua((p) => f(structuredClone(p)));
    setSujo(true);
  };

  const previa = useMemo(() => ({
    conteudo: aplicarNome(mesclar(CONTEUDO_NEUTRO, salvo.data?.conteudo), nomeFantasia),
    pontua: resolverPontua(pontua, nomeFantasia),
    empresaId: empresa?.id ?? null,
    publicPath: null,
    previa: true,
    nomeEmpresa: nomeFantasia,
    nomePrograma,
  }), [pontua, salvo.data?.conteudo, nomeFantasia, nomePrograma, empresa?.id]);

  const gravar = async () => {
    try {
      await salvar.mutateAsync({ pontua: pontua as unknown as Record<string, unknown> });
      setSujo(false);
      toast.success('Pontua salvo.');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Não foi possível salvar');
    }
  };

  const descartar = () => {
    setPontua(mesclar(PONTUA_NEUTRO, salvo.data?.pontua));
    setSujo(false);
  };

  return (
    <div className="flex h-[100dvh] flex-col bg-background">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3">
        <div className="flex items-center gap-3">
          <Button asChild variant="ghost" size="sm">
            <Link to="/marketing/pontua"><ArrowLeft className="mr-1 h-4 w-4" aria-hidden /> Voltar</Link>
          </Button>
          <div>
            <h1 className="text-lg font-semibold">Editar Pontua</h1>
            <p className="text-xs text-muted-foreground">Use {'{empresa}'} para o nome da empresa. A prévia ao lado atualiza enquanto você digita.</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {empresa?.slug ? (
            <Button asChild variant="ghost" size="sm">
              <a href={`/apresentacao/${empresa.slug}/pontua`} target="_blank" rel="noreferrer">Link público <ExternalLink className="ml-1 h-4 w-4" aria-hidden /></a>
            </Button>
          ) : null}
          <Button variant="outline" size="sm" onClick={descartar} disabled={!sujo || salvar.isPending}>
            <RotateCcw className="mr-1 h-4 w-4" aria-hidden /> Descartar
          </Button>
          <Button size="sm" onClick={() => void gravar()} disabled={!sujo || salvar.isPending}>
            {salvar.isPending ? <Loader2 className="mr-1 h-4 w-4 animate-spin" aria-hidden /> : <Save className="mr-1 h-4 w-4" aria-hidden />}
            Salvar
          </Button>
        </div>
      </header>

      <div className="grid min-h-0 flex-1 lg:grid-cols-[minmax(380px,520px)_1fr]">
        <div className="min-h-0 space-y-4 overflow-y-auto border-r p-4">
          {salvo.isLoading ? (
            <p className="text-sm text-muted-foreground">Carregando…</p>
          ) : (
            <>
              <PontuaPercentualPadrao />
              <Texto id="po-eye" rotulo="Rótulo" valor={pontua.eyebrow} onChange={(v) => mudar((x) => { x.eyebrow = v; return x; })} />
              <Texto id="po-tit" rotulo="Título" valor={pontua.title} onChange={(v) => mudar((x) => { x.title = v; return x; })} />
              <TextoLongo id="po-sub" rotulo="Texto de abertura" linhas={3} valor={pontua.subtitle} onChange={(v) => mudar((x) => { x.subtitle = v; return x; })} />
              <Texto id="po-bad" rotulo="Selo" valor={pontua.badge} onChange={(v) => mudar((x) => { x.badge = v; return x; })} />
              <h2 className="pt-2 text-sm font-semibold">Parceiro de exemplo (demonstração)</h2>
              <Texto id="po-pn" rotulo="Nome" valor={pontua.parceiro.nome} onChange={(v) => mudar((x) => { x.parceiro.nome = v; return x; })} />
              <Texto id="po-pe" rotulo="Escritório" valor={pontua.parceiro.escritorio} onChange={(v) => mudar((x) => { x.parceiro.escritorio = v; return x; })} />
              <Texto id="po-pc" rotulo="Cidade" valor={pontua.parceiro.cidade} onChange={(v) => mudar((x) => { x.parceiro.cidade = v; return x; })} />
              <h2 className="pt-2 text-sm font-semibold">Como funciona</h2>
              {pontua.passos.map((p, i) => (
                <fieldset key={p.step} className="space-y-3 rounded-md border p-3">
                  <legend className="text-xs font-semibold text-muted-foreground">Passo {p.step}</legend>
                  <Texto id={`pp${i}-t`} rotulo="Título" valor={p.title} onChange={(v) => mudar((x) => { x.passos[i].title = v; return x; })} />
                  <TextoLongo id={`pp${i}-x`} rotulo="Texto" linhas={2} valor={p.text} onChange={(v) => mudar((x) => { x.passos[i].text = v; return x; })} />
                </fieldset>
              ))}
            </>
          )}
        </div>

        {/* transform cria o bloco de contenção: os elementos fixed da página ficam dentro da prévia */}
        <div className="hidden min-h-0 bg-black lg:block" style={{ transform: 'translateZ(0)' }} aria-label="Prévia do Pontua">
          <ApresentacaoEmpresa conteudo={previa} semIntro somentePontua />
        </div>
      </div>
    </div>
  );
}
