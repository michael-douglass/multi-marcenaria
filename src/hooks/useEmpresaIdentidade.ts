import { useMemo } from 'react'
import { useAppOptional } from '@/context/AppContext'
import { montarEmpresaIdentidade, type EmpresaIdentidade } from '@/lib/empresa-identidade'

export {
  montarEmpresaIdentidade,
  type EmpresaIdentidade,
  type EmpresaIdentidadeFonte,
} from '@/lib/empresa-identidade'

/**
 * Fonte única da identidade da empresa ativa. Lê do núcleo (`useApp().empresa`), que existe em
 * todas as telas autenticadas — inclusive as do núcleo, fora do `EmpresaProvider` do CRM.
 * Fora do `AppProvider` devolve os fallbacks.
 */
export function useEmpresaIdentidade(): EmpresaIdentidade {
  const empresa = useAppOptional()?.empresa ?? null
  return useMemo(() => montarEmpresaIdentidade(empresa), [empresa])
}
