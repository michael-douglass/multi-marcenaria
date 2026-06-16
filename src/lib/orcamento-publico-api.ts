import { supabase } from '@/lib/supabase'
import type {
  OrcamentoPublicoPayload,
  OrcamentoSlide,
  OrcamentoSlideBloco,
  OrcamentoSlideFormaPagamento,
  OrcamentoSlideMidia,
  OrcamentoSlideOpcao,
  OrcamentoSlidePergunta,
  OrcamentoSlideTemplate,
} from '@/types/orcamento-publico'

const SCHEMA_PATTERN = /^emp_[a-z0-9_]+$/

export function isValidOrcamentoSchema(schema: string | undefined): schema is string {
  return !!schema && SCHEMA_PATTERN.test(schema)
}

function empresaDb(schema: string) {
  if (!isValidOrcamentoSchema(schema)) {
    throw new Error('Link de orçamento inválido.')
  }
  return supabase.schema(schema)
}

function firstErrorMessage(errors: Array<{ message: string } | null | undefined>): string | null {
  for (const err of errors) {
    if (err?.message) return err.message
  }
  return null
}

export async function fetchOrcamentoPublico(
  schema: string,
  id: string,
): Promise<OrcamentoPublicoPayload> {
  const db = empresaDb(schema)

  const [
    slideRes,
    templatesRes,
    perguntasRes,
    opcoesRes,
    formasRes,
    midiasRes,
  ] = await Promise.all([
    db.from('orcamento_slides').select('*').eq('id', id).maybeSingle(),
    db
      .from('orcamento_slide_templates')
      .select('*')
      .eq('ativo', true)
      .order('criado_em', { ascending: true })
      .limit(1),
    db.from('orcamento_slide_perguntas').select('*').eq('ativo', true).order('ordem'),
    db.from('orcamento_slide_pergunta_opcoes').select('*').order('ordem'),
    db.from('orcamento_slide_formas_pagamento').select('id, tipo, nome, descricao').eq('ativo', true),
    db.from('orcamento_slide_midias').select('*').eq('orcamento_id', id).order('ordem'),
  ])

  const errorMessage = firstErrorMessage([
    slideRes.error,
    templatesRes.error,
    perguntasRes.error,
    opcoesRes.error,
    formasRes.error,
    midiasRes.error,
  ])
  if (errorMessage) throw new Error(errorMessage)

  const slide = slideRes.data as OrcamentoSlide | null
  if (!slide) throw new Error('Orçamento não encontrado.')

  const template = (templatesRes.data?.[0] ?? null) as OrcamentoSlideTemplate | null
  if (!template) throw new Error('Template de apresentação não configurado.')

  const blocosRes = await db
    .from('orcamento_slide_blocos')
    .select('*')
    .eq('template_id', template.id)
    .eq('ativo', true)
    .order('ordem')

  if (blocosRes.error) throw new Error(blocosRes.error.message)

  return {
    slide,
    template,
    blocos: (blocosRes.data ?? []) as OrcamentoSlideBloco[],
    perguntas: (perguntasRes.data ?? []) as OrcamentoSlidePergunta[],
    opcoes: (opcoesRes.data ?? []) as OrcamentoSlideOpcao[],
    formasPagamento: (formasRes.data ?? []) as OrcamentoSlideFormaPagamento[],
    midias: (midiasRes.data ?? []) as OrcamentoSlideMidia[],
  }
}
