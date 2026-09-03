import {
  filterLeadDetailsNav,
  LEAD_IA_NAV,
  type LeadIaSubtab,
  type LeadModalTabId,
  type LeadNavJumpItem,
  type LeadNavVisibility,
} from '@/components/leads/lead-modal-nav';

export type LeadSearchHitKind = 'section' | 'field' | 'studio';

export interface LeadSearchHit {
  key: string;
  label: string;
  hint?: string;
  kind: LeadSearchHitKind;
  tab: LeadModalTabId;
  iaSubtab?: LeadIaSubtab;
  sectionId?: string;
  fieldId?: string;
  score: number;
}

export function normalizeLeadSearch(text: string): string {
  return text
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/\s+/g, ' ')
    .toLowerCase()
    .trim();
}

function wordStartsWith(haystack: string, query: string): boolean {
  if (!query) return false;
  return haystack.split(/[^a-z0-9]+/).some((word) => word.startsWith(query));
}

export function scoreLeadSearchQuery(query: string, haystack: string, keywords: string[] = []): number {
  const q = normalizeLeadSearch(query);
  if (!q) return 0;
  const hay = normalizeLeadSearch(haystack);
  const keys = keywords.map(normalizeLeadSearch).filter(Boolean);

  if (keys.includes(q)) return 120;
  if (hay === q) return 110;
  if (hay.startsWith(q)) return 95;
  if (wordStartsWith(hay, q)) return 80;
  if (q.length >= 3 && hay.includes(q)) return 55;
  if (q.length >= 3 && keys.some((key) => key.includes(q) || q.includes(key))) return 70;
  return 0;
}

function catalogHit(item: LeadNavJumpItem, query: string): LeadSearchHit | null {
  const haystack = [item.label, item.hint, item.id, ...(item.keywords ?? [])].join(' ');
  const score = scoreLeadSearchQuery(query, haystack, item.keywords);
  if (score <= 0) return null;
  return {
    key: `nav:${item.id}`,
    label: item.label,
    hint: item.hint,
    kind: item.tab === 'analise-ia' ? 'studio' : 'section',
    tab: item.tab,
    iaSubtab: item.iaSubtab,
    sectionId: item.id,
    score,
  };
}

export function searchLeadModalCatalog(
  query: string,
  visibility: LeadNavVisibility = {},
): LeadSearchHit[] {
  const details = filterLeadDetailsNav(visibility);
  const ia = visibility.showIa === false ? [] : LEAD_IA_NAV;
  return [...ia, ...details]
    .map((item) => catalogHit(item, query))
    .filter((hit): hit is LeadSearchHit => hit != null);
}

function nearestSectionId(el: Element): string | undefined {
  return el.closest<HTMLElement>('[data-lead-section]')?.dataset.leadSection;
}

export function collectLeadModalLiveHits(root: ParentNode, query: string): LeadSearchHit[] {
  const hits: LeadSearchHit[] = [];
  const seen = new Set<string>();

  root.querySelectorAll<HTMLElement>('[data-lead-search-field]').forEach((el) => {
    const fieldId = el.dataset.leadSearchField?.trim();
    if (!fieldId || seen.has(`field:${fieldId}`)) return;
    const label = el.querySelector('label, legend')?.textContent?.trim() || fieldId;
    const value = el.innerText.replace(/\s+/g, ' ').trim().slice(0, 280);
    const sectionId = nearestSectionId(el) ?? 'contato';
    const score = scoreLeadSearchQuery(query, `${label} ${value} ${fieldId}`);
    if (score <= 0) return;
    seen.add(`field:${fieldId}`);
    hits.push({
      key: `field:${fieldId}`,
      label,
      hint: value && value !== label ? value.slice(0, 72) : 'Campo do card',
      kind: 'field',
      tab: 'detalhes',
      sectionId,
      fieldId,
      score: score + 8,
    });
  });

  root.querySelectorAll<HTMLElement>('[data-lead-section]').forEach((el) => {
    const sectionId = el.dataset.leadSection?.trim();
    if (!sectionId || seen.has(`nav:${sectionId}`)) return;
    const title = el.querySelector('h3')?.textContent?.trim() || sectionId;
    const score = scoreLeadSearchQuery(query, `${title} ${sectionId}`);
    if (score <= 0) return;
    seen.add(`nav:${sectionId}`);
    hits.push({
      key: `live:${sectionId}`,
      label: title,
      hint: 'Seção do card',
      kind: 'section',
      tab: 'detalhes',
      sectionId,
      score,
    });
  });

  return hits;
}

export function mergeLeadSearchHits(hits: LeadSearchHit[], limit = 8): LeadSearchHit[] {
  const byKey = new Map<string, LeadSearchHit>();
  for (const hit of hits) {
    const current = byKey.get(hit.key);
    if (!current || hit.score > current.score) byKey.set(hit.key, hit);
  }
  return [...byKey.values()].sort((a, b) => b.score - a.score || a.label.localeCompare(b.label, 'pt-BR')).slice(0, limit);
}
