import { supabase } from '@/lib/supabase'

export async function toggleComissaoOcultaPrestador(
  obraId: string,
  prestadorId: string,
  oculto: boolean,
): Promise<void> {
  const { error } = await supabase.rpc('movelaria_toggle_comissao_oculta_prestador', {
    p_obra_id: obraId,
    p_prestador_id: prestadorId,
    p_oculto: oculto,
  })
  if (error) throw error
}
