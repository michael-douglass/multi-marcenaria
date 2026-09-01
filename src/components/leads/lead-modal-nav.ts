export type LeadModalTabId = 'detalhes' | 'analise-ia';
export type LeadIaSubtab = 'visual' | 'render';
export type LeadNavMenu = 'detalhes' | 'ia';

export interface LeadNavJumpItem {
  id: string;
  label: string;
  hint?: string;
  tab: LeadModalTabId;
  iaSubtab?: LeadIaSubtab;
}

export const LEAD_DETAILS_NAV: LeadNavJumpItem[] = [
  { id: 'contato', label: 'Contato', hint: 'Nome, telefone e e-mail', tab: 'detalhes' },
  { id: 'negocio', label: 'Negócio', hint: 'Empresa, origem e valor', tab: 'detalhes' },
  { id: 'equipe', label: 'Equipe e status', hint: 'Vendedor e coluna do funil', tab: 'detalhes' },
  { id: 'observacoes', label: 'Observações', hint: 'Notas internas', tab: 'detalhes' },
  { id: 'contratos', label: 'Contratos', hint: 'Documentos assinados', tab: 'detalhes' },
  { id: 'orcamentos', label: 'Orçamentos', hint: 'Slides e propostas', tab: 'detalhes' },
  { id: 'markup', label: 'Markup', hint: 'Composição de preço', tab: 'detalhes' },
  { id: 'fotos', label: 'Fotos e anexos', hint: 'Pastas, PDFs e imagens', tab: 'detalhes' },
  { id: 'whatsapp', label: 'WhatsApp', hint: 'Histórico da conversa', tab: 'detalhes' },
  { id: 'lousa', label: 'Lousa', hint: 'Fotos da visita', tab: 'detalhes' },
];

export const LEAD_IA_NAV: LeadNavJumpItem[] = [
  {
    id: 'ia-visual',
    label: 'Análise visual',
    hint: 'Leitura das fotos do ambiente',
    tab: 'analise-ia',
    iaSubtab: 'visual',
  },
  {
    id: 'ia-render',
    label: 'Renderizar projetos',
    hint: 'Imagens do móvel no ambiente',
    tab: 'analise-ia',
    iaSubtab: 'render',
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
