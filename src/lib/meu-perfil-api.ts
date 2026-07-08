import { supabase } from '@/lib/supabase'
import type { FuncionarioAdmissaoDados, MeuFuncionarioPayload } from '@/types'

export async function fetchMeuFuncionario(): Promise<MeuFuncionarioPayload | null> {
  const { data, error } = await supabase.rpc('movelaria_funcionario_meu_obter')
  if (error) throw new Error(error.message)
  if (!data) return null
  return data as MeuFuncionarioPayload
}

export async function salvarMeuFuncionario(
  dados: FuncionarioAdmissaoDados,
  finalizar = false,
): Promise<{ admissao_status: string }> {
  const { data, error } = await supabase.rpc('movelaria_funcionario_meu_salvar', {
    p_dados: dados,
    p_finalizar: finalizar,
  })
  if (error) throw new Error(error.message)
  return data as { admissao_status: string }
}

export async function atualizarFotoPerfilPath(fotoPath: string): Promise<void> {
  const { error } = await supabase.rpc('movelaria_funcionario_meu_atualizar_foto', {
    p_foto_path: fotoPath,
  })
  if (error) throw new Error(error.message)
}
