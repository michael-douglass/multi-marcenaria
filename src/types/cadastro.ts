/** Cadastro de aluno (formulário público) */
export interface CadastroAluno {
  id: string;
  user_id: string;
  nome: string;
  email: string;
  telefone: string | null;
  /** Nome completo do aluno */
  nome_aluno: string | null;
  /** Ano escolar (ex.: 1º ano, 2º ano) */
  ano_escolar: string | null;
  /** Idade do aluno */
  idade: number | null;
  /** CPF do responsável */
  cpf_responsavel: string | null;
  melhores_dias: string[];
  melhor_horario: string[];
  plano_id: string | null;
  dia_pagamento: number | null;
  /** Data em que o aluno pretende começar (formulário) */
  data_inicio_prevista: string | null;
  /** Disciplinas de interesse (nomes configurados) */
  disciplinas: string[];
  /** Matéria desejada (uma única, da lista de disciplinas) */
  materia_desejada: string | null;
  criado_em: string;
  atualizado_em: string;
}

/** Configuração do formulário de cadastro (planos e disciplinas) */
export interface CadastroConfig {
  id: string;
  planos_visiveis: string[];
  /** Lista de disciplinas oferecidas no formulário */
  disciplinas: string[];
  atualizado_em: string;
}

/** Plano financeiro (view da tabela fin_planos) */
export interface PlanoFin {
  id: string;
  nome: string;
  valor: number;
  categoria: string;
  aulas_por_semana: number;
  aulas_por_mes: number;
  duracao_minutos: number;
  ativo: boolean | null;
}

export const DIAS_SEMANA = [
  { value: 'segunda', label: 'Segunda' },
  { value: 'terca', label: 'Terça' },
  { value: 'quarta', label: 'Quarta' },
  { value: 'quinta', label: 'Quinta' },
  { value: 'sexta', label: 'Sexta' },
  { value: 'sabado', label: 'Sábado' },
  { value: 'domingo', label: 'Domingo' },
] as const;

export const HORARIOS = [
  { value: 'manha', label: 'Manhã' },
  { value: 'tarde', label: 'Tarde' },
  { value: 'noite', label: 'Noite' },
] as const;
