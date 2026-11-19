import { FileSignature, Gift, Presentation, Calculator, GalleryHorizontalEnd, type LucideIcon } from 'lucide-react'
import type { ModeloCatalogo, TipoModelo } from '@/hooks/useMaster'

export const TIPO_MODELO: Record<TipoModelo, { rotulo: string; icon: LucideIcon; rota: string }> = {
  markup: { rotulo: 'Markup (custo)', icon: Calculator, rota: '/markup/configuracoes' },
  slides: { rotulo: 'Slides de orçamento', icon: GalleryHorizontalEnd, rota: '/orcamento-slides/configuracoes' },
  contrato: { rotulo: 'Contrato', icon: FileSignature, rota: '/contratos/configuracoes' },
  apresentacao: { rotulo: 'Apresentação para arquitetos', icon: Presentation, rota: '/marketing/apresentacao-interna/editar' },
  pontua: { rotulo: 'Pontua (programa de pontos)', icon: Gift, rota: '/marketing/pontua/editar' },
}

const ROTULOS: Record<string, [string, string]> = {
  categorias: ['categoria', 'categorias'],
  produtos: ['item', 'itens'],
  servicos: ['serviço', 'serviços'],
  despesas: ['despesa', 'despesas'],
  parametros: ['parâmetros', 'parâmetros'],
  regras: ['regra', 'regras'],
  template: ['visual', 'visual'],
  blocos: ['bloco', 'blocos'],
  perguntas: ['pergunta', 'perguntas'],
  opcoes: ['opção', 'opções'],
  catalogo: ['item de catálogo', 'itens de catálogo'],
  scripts: ['script', 'scripts'],
  formas_pagamento: ['forma de pagamento', 'formas de pagamento'],
  campos: ['campo', 'campos'],
  secoes: ['seção', 'seções'],
}

function contar(chave: string, n: number) {
  const r = ROTULOS[chave]
  return r ? `${n} ${n === 1 ? r[0] : r[1]}` : `${n} ${chave}`
}

/** "244 itens · 5 categorias" a partir da contagem do catálogo. */
export function descreverContagem(m: ModeloCatalogo): string {
  if (m.tipo === 'contrato') {
    const ativo = m.contagem.ativo_no_modelo === true
    return ativo ? 'Contrato ativo na empresa-modelo' : 'Contrato inativo na empresa-modelo'
  }
  if (m.tipo === 'pontua') {
    const conteudo = m.contagem.configurado ? 'Conteúdo configurado' : 'Ainda usa o conteúdo padrão'
    return `${conteudo} · Interface ${m.contagem.interface === 'classica' ? 'clássica (com marca)' : 'sem marca'}`
  }
  if (m.tipo === 'apresentacao') {
    return m.contagem.configurado ? 'Conteúdo configurado' : 'Ainda usa o conteúdo padrão'
  }
  return Object.entries(m.contagem)
    .filter(([, v]) => typeof v === 'number')
    .map(([k, v]) => contar(k, v as number))
    .join(' · ')
}

/** Texto curto do que um envio acrescentou. */
export function descreverResumo(tipo: TipoModelo | undefined, resumo?: Record<string, unknown>): string {
  if (!resumo) return 'Enviado.'
  if (tipo === 'contrato') {
    return `Contrato “${String(resumo.nome ?? '')}” criado${resumo.ativo ? ' (ativo)' : ' (inativo)'}; ${contar('campos', Number(resumo.campos ?? 0))} novos.`
  }
  if (tipo === 'apresentacao' || tipo === 'pontua') {
    if (resumo.copiado) return 'Conteúdo copiado.'
    if (resumo.interface) return 'A empresa manteve o conteúdo próprio; recebeu só a interface.'
    return 'A empresa já tinha conteúdo próprio: nada mudou.'
  }
  const partes = Object.entries(resumo)
    .filter(([, v]) => typeof v === 'number' && (v as number) > 0)
    .map(([k, v]) => contar(k, v as number))
  return partes.length ? `Acrescentado: ${partes.join(', ')}.` : 'Nada novo: a empresa já tinha tudo.'
}
