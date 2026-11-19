import { useApp } from '@/context/AppContext'
import { paginaLiberada } from '@/lib/paginas-catalogo'

/**
 * A página/função (id do catálogo, ex.: `orcamentosIa`, `whatsappCrm`) está liberada para a empresa
 * ativa? Considera plano + ajustes da empresa (`app_minha_empresa().paginas_bloqueadas`).
 *
 * Use este hook em vez de `useEmpresa()` de `@/contexts/EmpresaContext` (o do CRM), que descarta
 * `paginasBloqueadas`. Sem empresa, sem plano ou com a lista vazia, devolve `true`.
 *
 * O valor vem de `app_minha_empresa`, lido uma vez: mudanças feitas pelo master só aparecem
 * depois de recarregar a página.
 */
export function usePaginaLiberada(id: string): boolean {
  const { empresa } = useApp()
  return paginaLiberada(id, empresa?.paginasBloqueadas)
}
