import { GarboApresentacaoEmpresa } from '@/components/marketing/apresentacao-empresa/GarboApresentacaoEmpresa';

/**
 * Apresentação completa + Programa Pontua Garbo.
 * Link de compartilhamento: /apresentacao/garbo
 */
export default function PontuaGarboApresentacaoPage() {
  return <GarboApresentacaoEmpresa showToolbar includePontua showCopyLink />;
}
