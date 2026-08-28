import { useEffect } from 'react';
import { GarboApresentacaoEmpresa } from '@/components/marketing/apresentacao-empresa/GarboApresentacaoEmpresa';

/** Link público — sem login. URL: /apresentacao/garbo (completa + Pontua Garbo) */
export default function ApresentacaoEmpresaPublicaPage() {
  useEffect(() => {
    document.title = 'Garbo Movelaria — Apresentação';
    const meta = document.querySelector('meta[name="description"]');
    if (meta) {
      meta.setAttribute(
        'content',
        'Garbo Movelaria — parceria de precisão e Programa de Pontuação Garbo para parceiros.',
      );
    }
  }, []);

  return <GarboApresentacaoEmpresa includePontua />;
}
