import { ApresentacaoEmpresa } from '@/components/marketing/apresentacao-empresa/ApresentacaoEmpresa';

/**
 * Página do Pontua (interna): só o programa de pontuação para parceiros.
 * Link público: /apresentacao/:slug/pontua. Editor: /marketing/pontua/editar.
 */
export default function PontuaPage() {
  return <ApresentacaoEmpresa showToolbar somentePontua showCopyLink />;
}
