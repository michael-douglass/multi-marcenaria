export type LeadModalTabId = 'detalhes' | 'analise-ia';
export type LeadIaSubtab = 'visual' | 'render';
export type LeadNavMenu = 'detalhes' | 'ia';

export interface LeadNavJumpItem {
  id: string;
  label: string;
  hint?: string;
  tab: LeadModalTabId;
  iaSubtab?: LeadIaSubtab;
  /** Palavras extras para o buscador do card (ex.: "IA" → estúdio). */
  keywords?: string[];
}

export const LEAD_DETAILS_NAV: LeadNavJumpItem[] = [
  {
    id: 'contato',
    label: 'Contato',
    hint: 'Nome, telefone e e-mail',
    tab: 'detalhes',
    keywords: ['nome', 'telefone', 'email', 'e-mail', 'fone', 'whats'],
  },
  {
    id: 'negocio',
    label: 'Negócio',
    hint: 'Empresa, origem e valor',
    tab: 'detalhes',
    keywords: ['empresa', 'origem', 'valor', 'orcamento', 'orçamento', 'regiao', 'região'],
  },
  {
    id: 'equipe',
    label: 'Equipe e status',
    hint: 'Vendedor e coluna do funil',
    tab: 'detalhes',
    keywords: ['vendedor', 'status', 'coluna', 'funil', 'equipe'],
  },
  {
    id: 'observacoes',
    label: 'Observações',
    hint: 'Notas internas',
    tab: 'detalhes',
    keywords: ['obs', 'notas', 'anotacao', 'anotação'],
  },
  {
    id: 'contratos',
    label: 'Contratos',
    hint: 'Documentos assinados',
    tab: 'detalhes',
    keywords: ['contrato', 'assinatura'],
  },
  {
    id: 'orcamentos',
    label: 'Orçamentos',
    hint: 'Slides e propostas',
    tab: 'detalhes',
    keywords: ['orcamento', 'orçamento', 'proposta', 'slide'],
  },
  {
    id: 'markup',
    label: 'Markup',
    hint: 'Composição de preço',
    tab: 'detalhes',
    keywords: ['custo', 'calculadora', 'preco', 'preço', 'iris'],
  },
  {
    id: 'fotos',
    label: 'Fotos e anexos',
    hint: 'Pastas, PDFs e imagens',
    tab: 'detalhes',
    keywords: ['pdf', 'anexo', 'pasta', 'imagem', 'foto'],
  },
  {
    id: 'whatsapp',
    label: 'WhatsApp',
    hint: 'Histórico da conversa',
    tab: 'detalhes',
    keywords: ['zap', 'conversa', 'chat', 'wpp'],
  },
  {
    id: 'lousa',
    label: 'Lousa',
    hint: 'Fotos da visita',
    tab: 'detalhes',
    keywords: ['visita', 'quadro'],
  },
];

export const LEAD_IA_NAV: LeadNavJumpItem[] = [
  {
    id: 'ia-visual',
    label: 'Análise visual',
    hint: 'Leitura das fotos do ambiente',
    tab: 'analise-ia',
    iaSubtab: 'visual',
    keywords: ['ia', 'ai', 'iris', 'analise', 'análise', 'visual', 'inteligencia', 'inteligência'],
  },
  {
    id: 'ia-render',
    label: 'Renderizar projetos',
    hint: 'Imagens do móvel no ambiente',
    tab: 'analise-ia',
    iaSubtab: 'render',
    keywords: ['ia', 'ai', 'iris', 'render', 'renderizar', 'projeto'],
  },
];

export interface LeadNavVisibility {
  showIa?: boolean;
  hideContratos?: boolean;
  hideOrcamentos?: boolean;
  hideMarkup?: boolean;
  hideWhatsapp?: boolean;
}

export function filterLeadDetailsNav(visibility: LeadNavVisibility): LeadNavJumpItem[] {
  return LEAD_DETAILS_NAV.filter((item) => {
    if (item.id === 'contratos' && visibility.hideContratos) return false;
    if (item.id === 'orcamentos' && visibility.hideOrcamentos) return false;
    if (item.id === 'markup' && visibility.hideMarkup) return false;
    if (item.id === 'whatsapp' && visibility.hideWhatsapp) return false;
    return true;
  });
}
