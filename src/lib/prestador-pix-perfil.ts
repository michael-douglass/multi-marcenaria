import type { TipoChavePix } from '@/hooks/usePrestadorPerfil';

/** Verifica se a chave digitada já é a mesma salva no perfil. */
export function chavePixIgualPerfil(
  chave: string,
  tipo: TipoChavePix,
  perfilChave?: string | null,
  perfilTipo?: string | null,
): boolean {
  const normalizada = chave.trim();
  const perfilNormalizada = (perfilChave ?? '').trim();
  const tipoPerfil = (perfilTipo ?? 'cpf') as TipoChavePix;
  return normalizada === perfilNormalizada && tipo === tipoPerfil;
}
