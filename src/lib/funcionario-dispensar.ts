import { supabase } from '@/lib/supabase'
import type { Funcionario } from '@/types'

export async function dispensarFuncionario(funcionarioId: string): Promise<Funcionario> {
  const { data, error } = await supabase.rpc('movelaria_funcionario_dispensar', {
    p_funcionario_id: funcionarioId,
  })
  if (error) throw new Error(error.message)
  return data as Funcionario
}
