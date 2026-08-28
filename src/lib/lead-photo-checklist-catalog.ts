/** Gabarito reutilizável: o que medir e fotografar na visita (estilo briefing pré-obra). */

export interface PhotoChecklistCatalogItem {
  id: string;
  label: string;
}

export interface PhotoChecklistCatalogGroup {
  key: string;
  label: string;
  hint: string;
  items: PhotoChecklistCatalogItem[];
}

export const PHOTO_CHECKLIST_FOTOS_GROUP = 'fotos' as const;

export const PHOTO_CHECKLIST_GROUPS: PhotoChecklistCatalogGroup[] = [
  {
    key: 'cozinha',
    label: 'Cozinha',
    hint: '23 pontos de medição e foto',
    items: [
      { id: 'foto-geral', label: 'Foto geral do ambiente' },
      { id: 'foto-parede-trabalho', label: 'Foto da parede de trabalho' },
      { id: 'foto-cantos', label: 'Foto dos cantos e encontros' },
      { id: 'largura-parede', label: 'Largura total da parede de trabalho' },
      { id: 'profundidade', label: 'Profundidade disponível (parede × ilha)' },
      { id: 'pe-direito', label: 'Pé-direito (piso ao teto)' },
      { id: 'janela', label: 'Altura e largura da janela' },
      { id: 'peitoril', label: 'Peitoril da janela' },
      { id: 'vao-porta', label: 'Vão da porta e sentido de abertura' },
      { id: 'agua', label: 'Pontos de água fria e quente' },
      { id: 'esgoto', label: 'Esgoto / posição do sifão' },
      { id: 'gas', label: 'Ponto de gás' },
      { id: 'eletrica', label: 'Tomadas e pontos elétricos' },
      { id: 'coifa', label: 'Duto / previsão de coifa' },
      { id: 'geladeira', label: 'Nicho da geladeira (L × P × A)' },
      { id: 'cooktop', label: 'Recorte de cooktop ou fogão' },
      { id: 'lava-louca', label: 'Máquina de lavar louça' },
      { id: 'rodape', label: 'Altura do rodapé existente' },
      { id: 'esquadro', label: 'Esquadro e desnível do piso' },
      { id: 'pilares', label: 'Pilares, vigas e shafts' },
      { id: 'pia', label: 'Medida da pia / cubas' },
      { id: 'armarios', label: 'Armários existentes a manter' },
      { id: 'sanca', label: 'Sanca, iluminação e gesso' },
    ],
  },
  {
    key: 'banheiro',
    label: 'Banheiro',
    hint: 'Hidráulica, box e marcenaria',
    items: [
      { id: 'foto-geral', label: 'Foto geral do banheiro' },
      { id: 'rodape', label: 'Rodapé / soleira' },
      { id: 'canos', label: 'Canos aparentes' },
      { id: 'pia', label: 'Pia / cubas' },
      { id: 'armario-flutuante', label: 'Armário flutuante' },
      { id: 'espelheira', label: 'Espelheira' },
      { id: 'nicho-box', label: 'Nicho de box' },
      { id: 'box', label: 'Box / portas de vidro' },
      { id: 'vaso', label: 'Posição do vaso' },
      { id: 'hidraulica', label: 'Pontos hidráulicos (quente e fria)' },
      { id: 'ralo', label: 'Ralo e caimento do piso' },
      { id: 'pe-direito', label: 'Pé-direito' },
      { id: 'vao-porta', label: 'Vão da porta' },
      { id: 'ventilacao', label: 'Extração / ventilação' },
      { id: 'tomadas', label: 'Tomadas (secador / barbeador)' },
    ],
  },
  {
    key: 'lavabo',
    label: 'Lavabo',
    hint: 'Pia, espelho e pontos',
    items: [
      { id: 'foto-geral', label: 'Foto geral do lavabo' },
      { id: 'pia', label: 'Pia / cuba' },
      { id: 'armario', label: 'Gabinete ou armário' },
      { id: 'espelho', label: 'Espelho' },
      { id: 'hidraulica', label: 'Pontos de água e esgoto' },
      { id: 'largura-parede', label: 'Largura da parede da pia' },
    ],
  },
  {
    key: 'quarto',
    label: 'Quarto',
    hint: 'Guarda-roupa, cabeceira e vãos',
    items: [
      { id: 'foto-geral', label: 'Foto geral do quarto' },
      { id: 'guarda-roupa', label: 'Parede do guarda-roupa (L × A)' },
      { id: 'cabeceira', label: 'Parede da cabeceira' },
      { id: 'vao-porta', label: 'Vão da porta e abertura' },
      { id: 'janela', label: 'Janela e peitoril' },
      { id: 'pe-direito', label: 'Pé-direito' },
      { id: 'tomadas', label: 'Tomadas e interruptores' },
      { id: 'ar', label: 'Ar-condicionado / evaporadora' },
      { id: 'rodape', label: 'Rodapé existente' },
    ],
  },
  {
    key: 'closet',
    label: 'Closet',
    hint: 'Módulos, cabideiro e gavetas',
    items: [
      { id: 'foto-geral', label: 'Foto geral do closet' },
      { id: 'largura', label: 'Largura e profundidade' },
      { id: 'pe-direito', label: 'Pé-direito' },
      { id: 'portas', label: 'Portas de correr ou abrir' },
      { id: 'cabideiro', label: 'Altura de cabideiro' },
      { id: 'gavetas', label: 'Gavetas e sapateira' },
      { id: 'iluminacao', label: 'Iluminação interna' },
    ],
  },
  {
    key: 'sala',
    label: 'Sala',
    hint: 'Painel, rack e home',
    items: [
      { id: 'foto-geral', label: 'Foto geral da sala' },
      { id: 'painel-tv', label: 'Parede do painel / TV' },
      { id: 'rack', label: 'Rack e nichos' },
      { id: 'pontos-tv', label: 'Pontos de TV e internet' },
      { id: 'pe-direito', label: 'Pé-direito' },
      { id: 'janelas', label: 'Janelas e cortineiro' },
      { id: 'rodape', label: 'Rodapé' },
    ],
  },
  {
    key: 'area_servico',
    label: 'Área de serviço',
    hint: 'Tanque, máquina e armários',
    items: [
      { id: 'foto-geral', label: 'Foto geral da área' },
      { id: 'tanque', label: 'Tanque e pontos de água' },
      { id: 'maquina', label: 'Nicho da máquina (lavar/secar)' },
      { id: 'armarios', label: 'Armários aéreos e baixos' },
      { id: 'esgoto', label: 'Esgoto e ralo' },
      { id: 'eletrica', label: 'Tomada 20A da máquina' },
    ],
  },
  {
    key: 'gourmet',
    label: 'Área gourmet',
    hint: 'Churrasqueira, bancada e ilha',
    items: [
      { id: 'foto-geral', label: 'Foto geral da gourmet' },
      { id: 'churrasqueira', label: 'Churrasqueira / cooktop' },
      { id: 'bancada', label: 'Bancada e ilha' },
      { id: 'agua-gas', label: 'Água, esgoto e gás' },
      { id: 'coifa', label: 'Coifa / exaustão' },
      { id: 'pe-direito', label: 'Pé-direito e cobertura' },
    ],
  },
  {
    key: 'escritorio',
    label: 'Escritório',
    hint: 'Bancada, nichos e pontos',
    items: [
      { id: 'foto-geral', label: 'Foto geral do escritório' },
      { id: 'bancada', label: 'Bancada de trabalho (L × P)' },
      { id: 'nichos', label: 'Nichos e prateleiras' },
      { id: 'tomadas', label: 'Tomadas e dados' },
      { id: 'pe-direito', label: 'Pé-direito' },
    ],
  },
  {
    key: 'instalacoes',
    label: 'Instalações gerais',
    hint: 'O que vale para qualquer ambiente',
    items: [
      { id: 'esquadro', label: 'Esquadro das paredes' },
      { id: 'desnivel', label: 'Desnível de piso' },
      { id: 'umidade', label: 'Umidade ou infiltração' },
      { id: 'shafts', label: 'Shafts, prumadas e lajes' },
      { id: 'gesso', label: 'Rebaixo de gesso / sanca' },
      { id: 'marcacoes', label: 'Marcações e cotas na foto' },
    ],
  },
];

export interface PhotoChecklistCustomItem {
  id: string;
  groupKey: string;
  label: string;
}

export interface PhotoChecklistImageRef {
  id: string;
  fileName: string;
}

export type PhotoChecklistRowItem = {
  key: string;
  label: string;
  custom?: boolean;
  /** Cadastrada no cabeçalho — aparece em todas as listas. */
  global?: boolean;
  /** Fotos reais do lead — não se apaga da lista (só da galeria). */
  locked?: boolean;
};

export type PhotoChecklistRowGroup = {
  key: string;
  label: string;
  hint: string;
  items: PhotoChecklistRowItem[];
  /** Lista criada nesta visita. */
  customGroup?: boolean;
  /** Grupo de fotos do lead — não se apaga a lista inteira. */
  locked?: boolean;
};

export interface PhotoChecklistCustomGroup {
  key: string;
  label: string;
}

export interface PhotoChecklistGlobalItem {
  id: string;
  label: string;
}

export interface PhotoChecklistLayout {
  customGroups: PhotoChecklistCustomGroup[];
  globalItems: PhotoChecklistGlobalItem[];
  hiddenItemKeys: string[];
  hiddenGroupKeys: string[];
  itemOrderByGroup: Record<string, string[]>;
  /** Pontos relevantes ditos pelo cliente — por lista ou da visita inteira. */
  notes: PhotoChecklistNote[];
}

export interface PhotoChecklistNote {
  id: string;
  text: string;
  /** Lista da checklist. `null` = observação da visita (cabeçalho). */
  groupKey: string | null;
}

export const EMPTY_CHECKLIST_LAYOUT: PhotoChecklistLayout = {
  customGroups: [],
  globalItems: [],
  hiddenItemKeys: [],
  hiddenGroupKeys: [],
  itemOrderByGroup: {},
  notes: [],
};

export function globalItemKey(globalId: string, groupKey: string): string {
  return `global:${globalId}::${groupKey}`;
}

export function parseGlobalItemKey(key: string): { id: string; groupKey: string } | null {
  if (!key.startsWith('global:')) return null;
  const rest = key.slice('global:'.length);
  const sep = rest.indexOf('::');
  if (sep <= 0) return null;
  return { id: rest.slice(0, sep), groupKey: rest.slice(sep + 2) };
}

function attachGlobalItems(
  groupKey: string,
  items: PhotoChecklistRowItem[],
  globalItems: PhotoChecklistGlobalItem[],
): PhotoChecklistRowItem[] {
  if (!globalItems.length) return items;
  const extras: PhotoChecklistRowItem[] = globalItems.map((item) => ({
    key: globalItemKey(item.id, groupKey),
    label: item.label,
    global: true,
  }));
  return [...extras, ...items];
}

export function slugifyChecklistGroupKey(label: string): string {
  const slug = normalizeChecklistQuery(label)
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40);
  const stamp =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID().slice(0, 8)
      : Date.now().toString(36);
  return `lista:${slug || 'nova'}-${stamp}`;
}

export function applyItemOrder(
  items: PhotoChecklistRowItem[],
  order: string[] | undefined,
): PhotoChecklistRowItem[] {
  if (!order?.length) return items;
  const byKey = new Map(items.map((item) => [item.key, item]));
  const seen = new Set<string>();
  const next: PhotoChecklistRowItem[] = [];
  for (const key of order) {
    const item = byKey.get(key);
    if (!item || seen.has(key)) continue;
    next.push(item);
    seen.add(key);
  }
  for (const item of items) {
    if (!seen.has(item.key)) next.push(item);
  }
  return next;
}

export function resolveItemOrder(items: PhotoChecklistRowItem[], order: string[] | undefined): string[] {
  return applyItemOrder(items, order).map((item) => item.key);
}

export function moveItemKey(order: string[], key: string, direction: -1 | 1): string[] {
  const idx = order.indexOf(key);
  if (idx < 0) return order;
  const nextIdx = idx + direction;
  if (nextIdx < 0 || nextIdx >= order.length) return order;
  const copy = [...order];
  const [moved] = copy.splice(idx, 1);
  if (!moved) return order;
  copy.splice(nextIdx, 0, moved);
  return copy;
}

export function catalogItemKey(groupKey: string, itemId: string): string {
  return `catalog:${groupKey}:${itemId}`;
}

export function imageItemKey(imageId: string): string {
  return `image:${imageId}`;
}

export function customItemKey(customId: string): string {
  return `custom:${customId}`;
}

export function normalizeChecklistQuery(value: string): string {
  return value
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .trim();
}

function matchesQuery(label: string, query: string): boolean {
  if (!query) return true;
  return normalizeChecklistQuery(label).includes(query);
}

export function briefingModeloGroupKey(modeloId: string): string {
  return `briefing:${modeloId}`;
}

export function briefingGroupsFromRows(
  modelos: Array<{ id: string; nome: string; descricao?: string | null; ordem?: number | null }>,
  perguntas: Array<{ id: string; modelo_id: string; enunciado: string; ordem?: number | null }>,
): PhotoChecklistCatalogGroup[] {
  const byModelo = new Map<string, PhotoChecklistCatalogItem[]>();
  const sortedPerguntas = [...perguntas].sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0));
  for (const pergunta of sortedPerguntas) {
    const label = pergunta.enunciado.trim();
    if (!label) continue;
    const list = byModelo.get(pergunta.modelo_id) ?? [];
    list.push({ id: pergunta.id, label });
    byModelo.set(pergunta.modelo_id, list);
  }

  return [...modelos]
    .sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0))
    .map((modelo) => {
      const items = byModelo.get(modelo.id) ?? [];
      return {
        key: briefingModeloGroupKey(modelo.id),
        label: modelo.nome,
        hint: items.length ? `${items.length} perguntas · briefing` : modelo.descricao?.trim() || 'Briefing pré-obra',
        items,
      };
    })
    .filter((group) => group.items.length > 0);
}

export function buildPhotoChecklistRows(input: {
  images: PhotoChecklistImageRef[];
  customItems: PhotoChecklistCustomItem[];
  query?: string;
  catalogGroups?: PhotoChecklistCatalogGroup[];
  layout?: PhotoChecklistLayout;
}): PhotoChecklistRowGroup[] {
  const query = normalizeChecklistQuery(input.query ?? '');
  const catalogGroups = input.catalogGroups?.length ? input.catalogGroups : PHOTO_CHECKLIST_GROUPS;
  const layout = input.layout ?? EMPTY_CHECKLIST_LAYOUT;
  const hiddenItems = new Set(layout.hiddenItemKeys);
  const hiddenGroups = new Set(layout.hiddenGroupKeys);
  const catalogKeys = new Set(catalogGroups.map((group) => group.key));
  const customGroupKeys = new Set(layout.customGroups.map((group) => group.key));
  const groups: PhotoChecklistRowGroup[] = [];

  const pushGroup = (group: PhotoChecklistRowGroup) => {
    if (hiddenGroups.has(group.key)) return;
    const visible = group.items.filter((item) => !hiddenItems.has(item.key));
    const ordered = applyItemOrder(visible, layout.itemOrderByGroup[group.key]);
    const filtered = query
      ? ordered.filter((item) => matchesQuery(item.label, query) || matchesQuery(group.label, query))
      : ordered;
    if (query && !filtered.length && !matchesQuery(group.label, query)) return;
    groups.push({ ...group, items: filtered });
  };

  pushGroup({
    key: PHOTO_CHECKLIST_FOTOS_GROUP,
    label: 'Fotos deste lead',
    hint: input.images.length ? `${input.images.length} foto(s)` : 'Nenhuma foto ainda',
    locked: true,
    items: input.images.map((image) => ({
      key: imageItemKey(image.id),
      label: image.fileName.trim() || 'Foto sem nome',
      locked: true,
    })),
  });

  for (const group of catalogGroups) {
    const catalogItems: PhotoChecklistRowItem[] = group.items.map((item) => ({
      key: catalogItemKey(group.key, item.id),
      label: item.label,
    }));
    const customInGroup: PhotoChecklistRowItem[] = input.customItems
      .filter((item) => item.groupKey === group.key)
      .map((item) => ({
        key: customItemKey(item.id),
        label: item.label,
        custom: true,
      }));
    pushGroup({
      key: group.key,
      label: group.label,
      hint: group.hint,
      items: attachGlobalItems(group.key, [...catalogItems, ...customInGroup], layout.globalItems ?? []),
    });
  }

  for (const group of layout.customGroups) {
    if (catalogKeys.has(group.key)) continue;
    const items: PhotoChecklistRowItem[] = input.customItems
      .filter((item) => item.groupKey === group.key)
      .map((item) => ({
        key: customItemKey(item.id),
        label: item.label,
        custom: true,
      }));
    pushGroup({
      key: group.key,
      label: group.label,
      hint: items.length ? `${items.length} item(ns)` : 'Lista desta visita',
      items: attachGlobalItems(group.key, items, layout.globalItems ?? []),
      customGroup: true,
    });
  }

  const orphanCustom = input.customItems.filter(
    (item) =>
      !catalogKeys.has(item.groupKey) &&
      !customGroupKeys.has(item.groupKey) &&
      item.groupKey !== PHOTO_CHECKLIST_FOTOS_GROUP,
  );
  if (orphanCustom.length) {
    pushGroup({
      key: 'outros',
      label: 'Outros',
      hint: 'Itens extras desta visita',
      items: attachGlobalItems(
        'outros',
        orphanCustom.map((item) => ({
          key: customItemKey(item.id),
          label: item.label,
          custom: true,
        })),
        layout.globalItems ?? [],
      ),
    });
  }

  return groups;
}

export function countChecklistProgress(
  groups: PhotoChecklistRowGroup[],
  checkedKeys: Iterable<string>,
): { done: number; total: number } {
  const checked = checkedKeys instanceof Set ? checkedKeys : new Set(checkedKeys);
  let done = 0;
  let total = 0;
  for (const group of groups) {
    for (const item of group.items) {
      total += 1;
      if (checked.has(item.key)) done += 1;
    }
  }
  return { done, total };
}

export function toggleCheckedKey(keys: string[], key: string, checked: boolean): string[] {
  const set = new Set(keys);
  if (checked) set.add(key);
  else set.delete(key);
  return [...set];
}

export interface VisitNoteExportSection {
  title: string;
  text: string;
}

export function notesForGroup(
  notes: PhotoChecklistNote[] | undefined,
  groupKey: string | null,
): PhotoChecklistNote[] {
  return (notes ?? []).filter((note) => note.groupKey === groupKey);
}

export function collectVisitNotesForExport(
  notes: PhotoChecklistNote[] | undefined,
  groups: Array<{ key: string; label: string }>,
): VisitNoteExportSection[] {
  const list = notes ?? [];
  if (!list.length) return [];
  const labelByKey = new Map(groups.map((group) => [group.key, group.label]));
  const sections: VisitNoteExportSection[] = [];
  const visitNotes = list.filter((note) => note.groupKey == null);
  if (visitNotes.length) {
    sections.push({
      title: 'Visita',
      text: visitNotes.map((note) => note.text).join('\n\n'),
    });
  }
  const seen = new Set<string>();
  for (const note of list) {
    if (note.groupKey == null || seen.has(note.groupKey)) continue;
    seen.add(note.groupKey);
    const groupNotes = list.filter((item) => item.groupKey === note.groupKey);
    sections.push({
      title: labelByKey.get(note.groupKey) ?? note.groupKey,
      text: groupNotes.map((item) => item.text).join('\n\n'),
    });
  }
  return sections;
}

export function visitNoteGroupLabels(
  catalogGroups: Array<{ key: string; label: string }>,
  customGroups: PhotoChecklistCustomGroup[] | undefined,
): Array<{ key: string; label: string }> {
  return [
    ...catalogGroups.map((group) => ({ key: group.key, label: group.label })),
    ...(customGroups ?? []),
  ];
}

/** Nome seguro para gravar foto e PDF na mesma pasta. */
export function sanitizeVisitFileBaseName(value: string, fallback = 'foto-visita'): string {
  const cleaned = value
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\.+$/g, '')
    .slice(0, 80);
  return cleaned || fallback;
}
