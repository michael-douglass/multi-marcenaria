import { useEffect } from 'react';
import { useEmpresaIdentidade } from '@/hooks/useEmpresaIdentidade';
import { GarboApresentacaoEmpresa } from '@/components/marketing/apresentacao-empresa/GarboApresentacaoEmpresa';

/** Link público — sem login. URL: /apresentacao/garbo (completa + Pontua Garbo) */
export default function ApresentacaoEmpresaPublicaPage() {
  // Com sessão, usa o nome da empresa ativa; o link público sem login mantém o padrão.
  const { nomeFantasia } = useEmpresaIdentidade();
  useEffect(() => {
    document.title = `${nomeFantasia} — Apresentação`;
    const meta = document.querySelector('meta[name="description"]');
    if (meta) {
      meta.setAttribute(
        'content',
        'Garbo Movelaria — parceria de precisão e Programa de Pontuação Garbo para parceiros.',
      );
    }
  }, [nomeFantasia]);

  return <GarboApresentacaoEmpresa includePontua />;
}
