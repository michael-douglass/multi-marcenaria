import { useEffect, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { ApresentacaoEmpresa } from '@/components/marketing/apresentacao-empresa/ApresentacaoEmpresa';
import { resolverConteudo } from '@/components/marketing/apresentacao-empresa/apresentacao-conteudo';
import type { ApresentacaoConteudoValor } from '@/components/marketing/apresentacao-empresa/ApresentacaoConteudoContext';
import { BrandLoader } from '@/components/ui/brand-loader';
import { useApresentacaoPublica } from '@/hooks/useApresentacaoConteudo';
import { nomePrograma } from '@/lib/empresa-identidade';

/**
 * Link público — sem login. URLs: /apresentacao/:slug (completa + Pontua da empresa) e
 * /apresentacao/:slug/pontua (só o programa de pontuação).
 * O conteúdo e o cadastro de parceria são da empresa do slug (`apresentacao_publica`).
 */
export default function ApresentacaoEmpresaPublicaPage({ somentePontua = false }: { somentePontua?: boolean }) {
  const { slug } = useParams<{ slug: string }>();
  const { data, isLoading, isError } = useApresentacaoPublica(slug);

  const valor = useMemo<ApresentacaoConteudoValor | null>(() => {
    if (!data) return null;
    return {
      ...resolverConteudo(data, data.nome),
      empresaId: data.empresa_id,
      publicPath: `/apresentacao/${data.slug}${somentePontua ? '/pontua' : ''}`,
      logoUrl: data.logo_url,
      nomeEmpresa: data.nome,
      nomePrograma: nomePrograma(data.nome),
    };
  }, [data, somentePontua]);

  useEffect(() => {
    if (!data) return;
    document.title = somentePontua ? `${data.nome} — Programa de pontuação` : `${data.nome} — Apresentação`;
    const meta = document.querySelector('meta[name="description"]');
    if (meta) meta.setAttribute('content', `${data.nome} — parceria para arquitetos e ${nomePrograma(data.nome)}.`);
  }, [data, somentePontua]);

  if (isLoading) return <BrandLoader variant="fullscreen" />;
  if (isError || !valor) {
    return (
      <main className="flex min-h-[100dvh] items-center justify-center bg-[#0e0b09] px-6 text-center text-[#f5efe6]">
        <div>
          <h1 className="text-2xl font-light">Apresentação não encontrada</h1>
          <p className="mt-2 text-sm text-[#f5efe6]/70">Confira o link com quem o enviou.</p>
        </div>
      </main>
    );
  }
  return <ApresentacaoEmpresa includePontua={!somentePontua} somentePontua={somentePontua} conteudo={valor} />;
}
