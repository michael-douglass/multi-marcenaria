import type {
  FurnitureModuleType,
  WhiteboardFurnitureModulePayload,
  WhiteboardPoint,
} from '@/lib/whiteboard-annotations';

export interface FurnitureModuleMeta {
  type: FurnitureModuleType;
  label: string;
  description: string;
  /** Família (grupo no seletor). */
  family: FurnitureFamilyId;
  /** Largura do frontal = altura × aspectWidth (colocação cima→baixo). */
  aspectWidth: number;
  /** Profundidade 3D relativa à largura. */
  depthRatio: number;
  /** Palavras extras para a busca (fogão, cooktop…). */
  keywords?: string[];
}

export type FurnitureFamilyId =
  | 'nicho'
  | 'armario'
  | 'guarda_roupa'
  | 'cozinha'
  | 'gaveta'
  | 'sapateira'
  | 'aereo'
  | 'painel_tv'
  | 'mesa_cabeceira'
  | 'bancada'
  | 'cristaleira'
  | 'rack'
  | 'eletro'
  | 'espelho'
  | 'quarto'
  | 'sala';

export interface FurnitureFamilyMeta {
  id: FurnitureFamilyId;
  label: string;
  description: string;
  defaultType: FurnitureModuleType;
}

/**
 * Catálogo de pré-desenhos 3D para marcenaria.
 * Colocação: 1º clique no topo, 2º embaixo (puxar para baixo).
 */
export const FURNITURE_MODULES: FurnitureModuleMeta[] = [
  // —— Nichos ——
  {
    type: 'nicho',
    label: 'Nicho simples',
    description: 'Nicho com prateleira',
    family: 'nicho',
    aspectWidth: 1.1,
    depthRatio: 0.22,
  },
  {
    type: 'nicho_colmeia',
    label: 'Nicho colmeia',
    description: 'Grade de células tipo colmeia',
    family: 'nicho',
    aspectWidth: 1.05,
    depthRatio: 0.2,
  },
  {
    type: 'nicho_losango',
    label: 'Nicho losango',
    description: 'Divisões em losango',
    family: 'nicho',
    aspectWidth: 1.1,
    depthRatio: 0.2,
  },
  {
    type: 'nicho_goulart',
    label: 'Nicho Goulart',
    description: 'Nichos escalonados (estilo Goulart)',
    family: 'nicho',
    aspectWidth: 1.15,
    depthRatio: 0.22,
  },
  {
    type: 'nicho_vazio',
    label: 'Nicho vazio',
    description: 'Caixa aberta sem divisórias',
    family: 'nicho',
    aspectWidth: 1.1,
    depthRatio: 0.22,
  },
  {
    type: 'nicho_cruz',
    label: 'Nicho cruz',
    description: 'Cruz central (4 compartimentos)',
    family: 'nicho',
    aspectWidth: 1.05,
    depthRatio: 0.2,
  },
  {
    type: 'nicho_hex',
    label: 'Nicho hex',
    description: 'Células hexagonais',
    family: 'nicho',
    aspectWidth: 1.2,
    depthRatio: 0.2,
  },
  // —— Armários ——
  {
    type: 'armario_vazio',
    label: 'Armário vazio',
    description: 'Módulo alto com prateleiras',
    family: 'armario',
    aspectWidth: 0.72,
    depthRatio: 0.32,
  },
  {
    type: 'armario_2_portas',
    label: '2 portas',
    description: 'Armário com duas portas',
    family: 'armario',
    aspectWidth: 0.78,
    depthRatio: 0.32,
  },
  {
    type: 'armario_4_portas',
    label: '4 portas',
    description: 'Armário com quatro portas',
    family: 'armario',
    aspectWidth: 0.95,
    depthRatio: 0.32,
  },
  {
    type: 'armario_prateleiras',
    label: 'Só prateleiras',
    description: 'Aberto com várias prateleiras',
    family: 'armario',
    aspectWidth: 0.7,
    depthRatio: 0.3,
  },
  {
    type: 'armario_canto',
    label: 'Armário canto',
    description: 'Sugestão de módulo de canto',
    family: 'armario',
    aspectWidth: 0.85,
    depthRatio: 0.36,
  },
  // —— Guarda-roupas ——
  {
    type: 'guarda_roupa',
    label: 'Guarda-roupa',
    description: 'Alto com portas e cabideiro',
    family: 'guarda_roupa',
    aspectWidth: 0.85,
    depthRatio: 0.34,
  },
  {
    type: 'guarda_roupa_casal',
    label: 'Casal',
    description: '3 portas / módulo casal',
    family: 'guarda_roupa',
    aspectWidth: 1.05,
    depthRatio: 0.34,
  },
  {
    type: 'guarda_roupa_correr',
    label: 'De correr',
    description: 'Portas de correr',
    family: 'guarda_roupa',
    aspectWidth: 1.1,
    depthRatio: 0.32,
  },
  {
    type: 'guarda_roupa_gavetas',
    label: 'Com gavetas',
    description: 'Portas + bloco de gavetas',
    family: 'guarda_roupa',
    aspectWidth: 0.9,
    depthRatio: 0.34,
  },
  // —— Cozinha ——
  {
    type: 'armario_cozinha',
    label: 'Balcão cozinha',
    description: 'Balcão baixo com tampo',
    family: 'cozinha',
    aspectWidth: 1.15,
    depthRatio: 0.38,
  },
  {
    type: 'armario_cozinha_2gav',
    label: '2 gavetas',
    description: 'Balcão com duas gavetas',
    family: 'cozinha',
    aspectWidth: 1.1,
    depthRatio: 0.38,
  },
  {
    type: 'armario_cozinha_canto',
    label: 'Canto cozinha',
    description: 'Módulo de canto baixo',
    family: 'cozinha',
    aspectWidth: 1.0,
    depthRatio: 0.4,
  },
  // —— Gaveteiros ——
  {
    type: 'gaveta',
    label: 'Gaveteiro',
    description: 'Bloco de gavetas',
    family: 'gaveta',
    aspectWidth: 0.78,
    depthRatio: 0.36,
  },
  {
    type: 'gaveta_3',
    label: '3 gavetas',
    description: 'Gaveteiro com 3 gavetas',
    family: 'gaveta',
    aspectWidth: 0.75,
    depthRatio: 0.36,
  },
  {
    type: 'gaveta_5',
    label: '5 gavetas',
    description: 'Gaveteiro alto com 5 gavetas',
    family: 'gaveta',
    aspectWidth: 0.7,
    depthRatio: 0.36,
  },
  // —— Sapateiras ——
  {
    type: 'sapateira',
    label: 'Sapateira',
    description: 'Portas basculantes / prateleiras',
    family: 'sapateira',
    aspectWidth: 0.7,
    depthRatio: 0.3,
  },
  {
    type: 'sapateira_basculante',
    label: 'Basculante',
    description: 'Só basculantes',
    family: 'sapateira',
    aspectWidth: 0.72,
    depthRatio: 0.3,
  },
  {
    type: 'sapateira_prateleiras',
    label: 'Prateleiras',
    description: 'Sapateira aberta',
    family: 'sapateira',
    aspectWidth: 0.68,
    depthRatio: 0.28,
  },
  // —— Aéreos ——
  {
    type: 'armario_aereo',
    label: 'Aéreo',
    description: 'Armário de parede',
    family: 'aereo',
    aspectWidth: 1.25,
    depthRatio: 0.28,
  },
  {
    type: 'aereo_2portas',
    label: 'Aéreo 2 portas',
    description: 'Aéreo com duas portas',
    family: 'aereo',
    aspectWidth: 1.3,
    depthRatio: 0.28,
  },
  {
    type: 'aereo_prateleira',
    label: 'Aéreo aberto',
    description: 'Prateleira aérea',
    family: 'aereo',
    aspectWidth: 1.35,
    depthRatio: 0.24,
  },
  // —— Painéis TV ——
  {
    type: 'painel_tv',
    label: 'Painel TV',
    description: 'Painel com nichos',
    family: 'painel_tv',
    aspectWidth: 1.35,
    depthRatio: 0.18,
  },
  {
    type: 'painel_tv_nichos',
    label: 'Painel nichos',
    description: 'Vários nichos laterais',
    family: 'painel_tv',
    aspectWidth: 1.4,
    depthRatio: 0.18,
  },
  {
    type: 'painel_tv_rack',
    label: 'Painel + rack',
    description: 'Painel com rack inferior',
    family: 'painel_tv',
    aspectWidth: 1.45,
    depthRatio: 0.22,
  },
  // —— Criados ——
  {
    type: 'mesa_cabeceira',
    label: 'Criado-mudo',
    description: 'Mesa de cabeceira',
    family: 'mesa_cabeceira',
    aspectWidth: 0.85,
    depthRatio: 0.4,
  },
  {
    type: 'mesa_cabeceira_2gav',
    label: '2 gavetas',
    description: 'Criado com duas gavetas',
    family: 'mesa_cabeceira',
    aspectWidth: 0.85,
    depthRatio: 0.4,
  },
  // —— Bancadas ——
  {
    type: 'bancada',
    label: 'Bancada',
    description: 'Bancada / ilha',
    family: 'bancada',
    aspectWidth: 1.6,
    depthRatio: 0.42,
  },
  {
    type: 'bancada_ilha',
    label: 'Ilha',
    description: 'Ilha com divisórias',
    family: 'bancada',
    aspectWidth: 1.7,
    depthRatio: 0.45,
  },
  // —— Cristaleiras ——
  {
    type: 'cristaleira',
    label: 'Cristaleira',
    description: 'Vitrine com portas de vidro',
    family: 'cristaleira',
    aspectWidth: 0.65,
    depthRatio: 0.3,
  },
  {
    type: 'cristaleira_alta',
    label: 'Cristaleira alta',
    description: 'Vitrine alta com mais prateleiras',
    family: 'cristaleira',
    aspectWidth: 0.6,
    depthRatio: 0.3,
  },
  // —— Racks ——
  {
    type: 'rack',
    label: 'Rack',
    description: 'Rack / home theater',
    family: 'rack',
    aspectWidth: 1.5,
    depthRatio: 0.35,
  },
  {
    type: 'rack_2nichos',
    label: 'Rack 2 nichos',
    description: 'Rack com dois nichos laterais',
    family: 'rack',
    aspectWidth: 1.55,
    depthRatio: 0.35,
  },
  // —— Eletros e pia ——
  {
    type: 'forno_embutido',
    label: 'Forno embutido',
    description: 'Forno de coluna com visor',
    family: 'eletro',
    aspectWidth: 0.78,
    depthRatio: 0.36,
    keywords: ['forno', 'eletro', 'cozinha', 'embutir'],
  },
  {
    type: 'forno_torre',
    label: 'Torre de fornos',
    description: 'Dois fornos empilhados',
    family: 'eletro',
    aspectWidth: 0.72,
    depthRatio: 0.36,
    keywords: ['forno', 'torre', 'micro-ondas', 'coluna'],
  },
  {
    type: 'fogao_4bocas',
    label: 'Fogão 4 bocas',
    description: 'Fogão com forno embaixo',
    family: 'eletro',
    aspectWidth: 0.95,
    depthRatio: 0.4,
    keywords: ['fogao', 'fogão', 'cooktop', 'cozinha'],
  },
  {
    type: 'fogao_5bocas',
    label: 'Fogão 5 bocas',
    description: 'Cinco queimadores + forno',
    family: 'eletro',
    aspectWidth: 1.05,
    depthRatio: 0.4,
    keywords: ['fogao', 'fogão', '5 bocas'],
  },
  {
    type: 'fogao_6bocas',
    label: 'Fogão 6 bocas',
    description: 'Fogão largo, seis queimadores',
    family: 'eletro',
    aspectWidth: 1.18,
    depthRatio: 0.42,
    keywords: ['fogao', 'fogão', '6 bocas', 'industrial'],
  },
  {
    type: 'cooktop',
    label: 'Cooktop',
    description: 'Cooktop de bancada',
    family: 'eletro',
    aspectWidth: 1.35,
    depthRatio: 0.22,
    keywords: ['cooktop', 'fogao', 'indução', 'vitrocerâmico'],
  },
  {
    type: 'coifa_parede',
    label: 'Coifa de parede',
    description: 'Coifa com chaminé',
    family: 'eletro',
    aspectWidth: 1.2,
    depthRatio: 0.28,
    keywords: ['coifa', 'depurador', 'exaustor', 'capela'],
  },
  {
    type: 'coifa_ilha',
    label: 'Coifa de ilha',
    description: 'Coifa suspensa para ilha',
    family: 'eletro',
    aspectWidth: 1.35,
    depthRatio: 0.3,
    keywords: ['coifa', 'ilha', 'exaustor'],
  },
  {
    type: 'depurador',
    label: 'Depurador',
    description: 'Depurador slim de parede',
    family: 'eletro',
    aspectWidth: 1.45,
    depthRatio: 0.22,
    keywords: ['depurador', 'coifa', 'exaustor', 'filtro'],
  },
  {
    type: 'microondas',
    label: 'Micro-ondas',
    description: 'Micro-ondas de embutir',
    family: 'eletro',
    aspectWidth: 1.05,
    depthRatio: 0.32,
    keywords: ['microondas', 'micro-ondas', 'forno'],
  },
  {
    type: 'geladeira',
    label: 'Geladeira',
    description: 'Refrigerador duas portas',
    family: 'eletro',
    aspectWidth: 0.62,
    depthRatio: 0.42,
    keywords: ['geladeira', 'refrigerador', 'freezer', 'frigobar'],
  },
  {
    type: 'lava_loucas',
    label: 'Lava-louças',
    description: 'Máquina de lavar louça',
    family: 'eletro',
    aspectWidth: 0.72,
    depthRatio: 0.38,
    keywords: ['lava louça', 'lava-louças', 'dishwasher'],
  },
  {
    type: 'cuba_pia',
    label: 'Cuba / pia',
    description: 'Cuba oval na bancada',
    family: 'eletro',
    aspectWidth: 1.4,
    depthRatio: 0.34,
    keywords: ['pia', 'cuba', 'tanque', 'torneira', 'sink'],
  },
  {
    type: 'air_fryer',
    label: 'Air fryer',
    description: 'Fritadeira elétrica',
    family: 'eletro',
    aspectWidth: 0.85,
    depthRatio: 0.38,
    keywords: ['airfryer', 'fritadeira', 'air fryer', 'cozinha'],
  },
  {
    type: 'liquidificador',
    label: 'Liquidificador',
    description: 'Jarra com base',
    family: 'eletro',
    aspectWidth: 0.48,
    depthRatio: 0.32,
    keywords: ['liquidificador', 'mixer', 'copo', 'cozinha'],
  },
  {
    type: 'cafeteira',
    label: 'Cafeteira',
    description: 'Cafeteira de bancada',
    family: 'eletro',
    aspectWidth: 0.72,
    depthRatio: 0.34,
    keywords: ['café', 'cafe', 'cafeteira', 'expresso'],
  },
  {
    type: 'chaleira',
    label: 'Chaleira',
    description: 'Chaleira elétrica',
    family: 'eletro',
    aspectWidth: 0.7,
    depthRatio: 0.36,
    keywords: ['chaleira', 'água', 'agua', 'chá', 'cha'],
  },
  {
    type: 'torradeira',
    label: 'Torradeira',
    description: 'Torradeira de pão',
    family: 'eletro',
    aspectWidth: 1.15,
    depthRatio: 0.28,
    keywords: ['torradeira', 'pão', 'pao', 'toast'],
  },
  {
    type: 'panela',
    label: 'Panela',
    description: 'Panela com tampa',
    family: 'eletro',
    aspectWidth: 1.05,
    depthRatio: 0.42,
    keywords: ['panela', 'caçarola', 'cacarola', 'cozinha', 'utensílio'],
  },
  // —— Espelhos ——
  {
    type: 'espelho_retangular',
    label: 'Espelho retangular',
    description: 'Moldura reta para parede',
    family: 'espelho',
    aspectWidth: 0.72,
    depthRatio: 0.08,
    keywords: ['espelho', 'mirror', 'banheiro'],
  },
  {
    type: 'espelho_oval',
    label: 'Espelho oval',
    description: 'Moldura oval clássica',
    family: 'espelho',
    aspectWidth: 0.7,
    depthRatio: 0.08,
    keywords: ['espelho', 'oval'],
  },
  {
    type: 'espelho_redondo',
    label: 'Espelho redondo',
    description: 'Espelho circular',
    family: 'espelho',
    aspectWidth: 1,
    depthRatio: 0.08,
    keywords: ['espelho', 'redondo', 'adnet'],
  },
  {
    type: 'espelho_corpo',
    label: 'Espelho de corpo',
    description: 'Espelho alto de quarto',
    family: 'espelho',
    aspectWidth: 0.42,
    depthRatio: 0.08,
    keywords: ['espelho', 'corpo', 'inteiro', 'quarto'],
  },
  {
    type: 'espelheira',
    label: 'Espelheira',
    description: 'Espelho com prateleira',
    family: 'espelho',
    aspectWidth: 0.85,
    depthRatio: 0.16,
    keywords: ['espelho', 'espelheira', 'banheiro', 'lavabo'],
  },
  {
    type: 'espelho_adnet',
    label: 'Espelho Adnet',
    description: 'Redondo com alças',
    family: 'espelho',
    aspectWidth: 1,
    depthRatio: 0.08,
    keywords: ['espelho', 'adnet', 'alça', 'redondo'],
  },
  // —— Quarto ——
  {
    type: 'cama',
    label: 'Cama',
    description: 'Cama com cabeceira',
    family: 'quarto',
    aspectWidth: 1.35,
    depthRatio: 0.55,
    keywords: ['cama', 'colchão', 'quarto', 'box'],
  },
  {
    type: 'cabeceira',
    label: 'Cabeceira',
    description: 'Painel de cabeceira',
    family: 'quarto',
    aspectWidth: 1.6,
    depthRatio: 0.12,
    keywords: ['cabeceira', 'cama', 'quarto'],
  },
  {
    type: 'penteadeira',
    label: 'Penteadeira',
    description: 'Penteadeira com espelho',
    family: 'quarto',
    aspectWidth: 1.15,
    depthRatio: 0.32,
    keywords: ['penteadeira', 'espelho', 'quarto', 'make'],
  },
  {
    type: 'abajur',
    label: 'Abajur',
    description: 'Luminária de mesa',
    family: 'quarto',
    aspectWidth: 0.55,
    depthRatio: 0.28,
    keywords: ['abajur', 'luminária', 'luminaria', 'luz', 'quarto'],
  },
  {
    type: 'puff',
    label: 'Puff',
    description: 'Puff / banqueta',
    family: 'quarto',
    aspectWidth: 1.05,
    depthRatio: 0.5,
    keywords: ['puff', 'banqueta', 'banco', 'quarto', 'sala'],
  },
  {
    type: 'comoda',
    label: 'Cômoda',
    description: 'Cômoda com gavetas',
    family: 'quarto',
    aspectWidth: 1.25,
    depthRatio: 0.34,
    keywords: ['cômoda', 'comoda', 'gaveta', 'quarto'],
  },
  {
    type: 'luminaria_chao',
    label: 'Luminária de chão',
    description: 'Abajur alto de quarto',
    family: 'quarto',
    aspectWidth: 0.42,
    depthRatio: 0.28,
    keywords: ['luminária', 'luminaria', 'abajur', 'luz', 'chão', 'chao'],
  },
  {
    type: 'cadeira',
    label: 'Cadeira',
    description: 'Cadeira de jantar / estar',
    family: 'sala',
    aspectWidth: 0.62,
    depthRatio: 0.55,
    keywords: ['cadeira', 'assento', 'jantar', 'sala'],
  },
  {
    type: 'cadeira_poltrona',
    label: 'Poltrona',
    description: 'Poltrona estofada',
    family: 'sala',
    aspectWidth: 0.85,
    depthRatio: 0.7,
    keywords: ['poltrona', 'cadeira', 'sala', 'estar'],
  },
  {
    type: 'sofa',
    label: 'Sofá 3 lugares',
    description: 'Sofá reto de estar',
    family: 'sala',
    aspectWidth: 1.85,
    depthRatio: 0.55,
    keywords: ['sofá', 'sofa', 'sala', 'estar'],
  },
  {
    type: 'sofa_2lugares',
    label: 'Sofá 2 lugares',
    description: 'Sofá compacto',
    family: 'sala',
    aspectWidth: 1.45,
    depthRatio: 0.55,
    keywords: ['sofá', 'sofa', 'namoradeira', 'sala'],
  },
  {
    type: 'sofa_canto',
    label: 'Sofá de canto',
    description: 'Canto em L',
    family: 'sala',
    aspectWidth: 1.7,
    depthRatio: 0.72,
    keywords: ['sofá', 'sofa', 'canto', 'L', 'sala'],
  },
  {
    type: 'modulo_cubo',
    label: 'Módulo cubo',
    description: 'Cubo de marcenaria ajustável',
    family: 'nicho',
    aspectWidth: 1,
    depthRatio: 0.45,
    keywords: ['módulo', 'modulo', 'cubo', 'caixa', 'nichos'],
  },
];

export const FURNITURE_FAMILIES: FurnitureFamilyMeta[] = [
  { id: 'nicho', label: 'Nicho', description: 'Nichos e prateleiras box', defaultType: 'nicho' },
  { id: 'armario', label: 'Armário', description: 'Armários altos', defaultType: 'armario_vazio' },
  {
    id: 'guarda_roupa',
    label: 'Guarda-roupa',
    description: 'Roupeiros',
    defaultType: 'guarda_roupa',
  },
  { id: 'cozinha', label: 'Cozinha', description: 'Balcões de cozinha', defaultType: 'armario_cozinha' },
  { id: 'gaveta', label: 'Gaveteiro', description: 'Blocos de gavetas', defaultType: 'gaveta' },
  { id: 'sapateira', label: 'Sapateira', description: 'Sapateiras', defaultType: 'sapateira' },
  { id: 'aereo', label: 'Aéreo', description: 'Armários aéreos', defaultType: 'armario_aereo' },
  { id: 'painel_tv', label: 'Painel TV', description: 'Painéis e home', defaultType: 'painel_tv' },
  {
    id: 'mesa_cabeceira',
    label: 'Criado',
    description: 'Mesas de cabeceira',
    defaultType: 'mesa_cabeceira',
  },
  { id: 'bancada', label: 'Bancada', description: 'Bancadas e ilhas', defaultType: 'bancada' },
  {
    id: 'cristaleira',
    label: 'Cristaleira',
    description: 'Vitrines',
    defaultType: 'cristaleira',
  },
  { id: 'rack', label: 'Rack', description: 'Racks', defaultType: 'rack' },
  {
    id: 'eletro',
    label: 'Eletros',
    description: 'Forno, fogão, coifa e pia',
    defaultType: 'fogao_4bocas',
  },
  {
    id: 'espelho',
    label: 'Espelhos',
    description: 'Espelhos e espelheira',
    defaultType: 'espelho_retangular',
  },
  {
    id: 'quarto',
    label: 'Quarto',
    description: 'Cama, penteadeira e luminária',
    defaultType: 'cama',
  },
  {
    id: 'sala',
    label: 'Sala',
    description: 'Sofás, cadeiras e poltronas',
    defaultType: 'sofa',
  },
];

export function getFurnitureModuleMeta(type: FurnitureModuleType): FurnitureModuleMeta {
  return FURNITURE_MODULES.find((m) => m.type === type) ?? FURNITURE_MODULES[0];
}

export function getFurnitureFamily(familyId: FurnitureFamilyId): FurnitureFamilyMeta {
  return FURNITURE_FAMILIES.find((f) => f.id === familyId) ?? FURNITURE_FAMILIES[0];
}

export function getFurnitureVariants(familyId: FurnitureFamilyId): FurnitureModuleMeta[] {
  return FURNITURE_MODULES.filter((m) => m.family === familyId);
}

export function getFamilyForModuleType(type: FurnitureModuleType): FurnitureFamilyId {
  return getFurnitureModuleMeta(type).family;
}

export type FurnitureCatalogGroupId =
  | 'todos'
  | 'cozinha'
  | 'quarto'
  | 'espelho'
  | 'eletro'
  | 'marcenaria'
  | 'sala';

export const FURNITURE_CATALOG_GROUPS: Array<{ id: FurnitureCatalogGroupId; label: string }> = [
  { id: 'todos', label: 'Todos' },
  { id: 'sala', label: 'Sala' },
  { id: 'quarto', label: 'Quarto' },
  { id: 'cozinha', label: 'Cozinha' },
  { id: 'eletro', label: 'Eletros' },
  { id: 'espelho', label: 'Espelhos' },
  { id: 'marcenaria', label: 'Marcenaria' },
];

export function furnitureCatalogGroup(familyId: FurnitureFamilyId): Exclude<FurnitureCatalogGroupId, 'todos'> {
  if (familyId === 'eletro') return 'eletro';
  if (familyId === 'cozinha') return 'cozinha';
  if (familyId === 'espelho') return 'espelho';
  if (familyId === 'sala') return 'sala';
  if (familyId === 'quarto' || familyId === 'mesa_cabeceira' || familyId === 'guarda_roupa') {
    return 'quarto';
  }
  return 'marcenaria';
}

function normalizeFurnitureQuery(value: string): string {
  return value
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .trim();
}

/** Busca móvel ou utensílio pelo nome, família ou palavra-chave. */
export function searchFurnitureModules(
  query: string,
  group: FurnitureCatalogGroupId = 'todos',
): FurnitureModuleMeta[] {
  const needle = normalizeFurnitureQuery(query);
  return FURNITURE_MODULES.filter((mod) => {
    if (group !== 'todos' && furnitureCatalogGroup(mod.family) !== group) return false;
    if (!needle) return true;
    const haystack = [
      mod.label,
      mod.description,
      mod.type,
      mod.family,
      getFurnitureFamily(mod.family).label,
      ...(mod.keywords ?? []),
    ]
      .map(normalizeFurnitureQuery)
      .join(' ');
    return haystack.includes(needle);
  });
}

export interface FurnitureFrame {
  /** Frente: canto inferior esquerdo */
  bl: WhiteboardPoint;
  br: WhiteboardPoint;
  tr: WhiteboardPoint;
  tl: WhiteboardPoint;
  /** Topo 3D (face superior) */
  tlBack: WhiteboardPoint;
  trBack: WhiteboardPoint;
  blBack: WhiteboardPoint;
  brBack: WhiteboardPoint;
  width: number;
  height: number;
  depth: number;
  /** Direção da largura (direita no frontal) */
  ux: number;
  uy: number;
  /** Direção da altura (de cima para baixo = a→b) */
  dx: number;
  dy: number;
  lines: Array<[WhiteboardPoint, WhiteboardPoint]>;
  paths: string[];
  /** Faces para preenchimento leve (3D) */
  fillFaces: Array<WhiteboardPoint[]>;
}

function add(p: WhiteboardPoint, ox: number, oy: number): WhiteboardPoint {
  return { x: p.x + ox, y: p.y + oy };
}

function along(
  origin: WhiteboardPoint,
  ux: number,
  uy: number,
  dx: number,
  dy: number,
  u: number,
  v: number,
): WhiteboardPoint {
  return {
    x: origin.x + ux * u + dx * v,
    y: origin.y + uy * u + dy * v,
  };
}

function seg(
  lines: Array<[WhiteboardPoint, WhiteboardPoint]>,
  p: WhiteboardPoint,
  q: WhiteboardPoint,
) {
  lines.push([p, q]);
}

function rotatePoint(
  p: WhiteboardPoint,
  cx: number,
  cy: number,
  deg: number,
): WhiteboardPoint {
  const r = (deg * Math.PI) / 180;
  const cos = Math.cos(r);
  const sin = Math.sin(r);
  const dx = p.x - cx;
  const dy = p.y - cy;
  return {
    x: cx + dx * cos - dy * sin,
    y: cy + dx * sin + dy * cos,
  };
}

/** Gira o móvel em torno do centro do frontal (ex.: ±15° ou ±90°). */
export function rotateFurniturePayload(
  payload: WhiteboardFurnitureModulePayload,
  deltaDeg: number,
): WhiteboardFurnitureModulePayload {
  if (!Number.isFinite(deltaDeg) || deltaDeg === 0) return payload;
  const frame = furnitureFrame(
    payload.a,
    payload.b,
    payload.moduleType,
    payload.heightOverride,
    payload.widthOverride,
    true,
  );
  const cx = (frame.tl.x + frame.tr.x + frame.bl.x + frame.br.x) / 4;
  const cy = (frame.tl.y + frame.tr.y + frame.bl.y + frame.br.y) / 4;
  return {
    ...payload,
    a: rotatePoint(payload.a, cx, cy, deltaDeg),
    b: rotatePoint(payload.b, cx, cy, deltaDeg),
    topDown: true,
    // Traços ocultos deixam de bater com a geometria rotacionada
    hiddenLineIndices: [],
  };
}

/**
 * Aumenta/diminui o móvel em torno do centro do frontal.
 * factor > 1 aumenta; factor < 1 diminui (ex.: 1.15 / 0.85).
 */
export function scaleFurniturePayload(
  payload: WhiteboardFurnitureModulePayload,
  factor: number,
): WhiteboardFurnitureModulePayload {
  if (!Number.isFinite(factor) || factor <= 0 || Math.abs(factor - 1) < 1e-6) return payload;

  const frame = furnitureFrame(
    payload.a,
    payload.b,
    payload.moduleType,
    payload.heightOverride,
    payload.widthOverride,
    payload.topDown === true,
  );
  const cx = (frame.tl.x + frame.tr.x + frame.bl.x + frame.br.x) / 4;
  const cy = (frame.tl.y + frame.tr.y + frame.bl.y + frame.br.y) / 4;

  const scalePoint = (p: WhiteboardPoint): WhiteboardPoint => ({
    x: cx + (p.x - cx) * factor,
    y: cy + (p.y - cy) * factor,
  });

  const nextA = scalePoint(payload.a);
  const nextB = scalePoint(payload.b);
  const nextHeight = Math.hypot(nextB.x - nextA.x, nextB.y - nextA.y);
  if (nextHeight < FURNITURE_MIN_HEIGHT && factor < 1) {
    // Já no tamanho mínimo — não encolhe mais
    return payload;
  }

  const nextWidth = Math.max(FURNITURE_MIN_WIDTH, frame.width * factor);

  return {
    ...payload,
    a: nextA,
    b: nextB,
    widthOverride: nextWidth,
    heightOverride:
      typeof payload.heightOverride === 'number' && Number.isFinite(payload.heightOverride)
        ? Math.max(FURNITURE_MIN_HEIGHT, payload.heightOverride * factor)
        : undefined,
    topDown: true,
  };
}

/** Largura mínima bem baixa para permitir móveis bem estreitos na foto. */
export const FURNITURE_MIN_WIDTH = 8;
export const FURNITURE_MIN_HEIGHT = 20;

/**
 * Ângulo do eixo altura (a→b) em relação à vertical para baixo (0° = reto).
 * Positivo = horário na tela.
 */
export function furnitureRotationDeg(a: WhiteboardPoint, b: WhiteboardPoint): number {
  return (Math.atan2(b.x - a.x, b.y - a.y) * 180) / Math.PI;
}

/**
 * Ajusta só a largura (mantém altura e centro).
 * factor > 1 alarga; factor < 1 estreita.
 */
export function scaleFurnitureWidth(
  payload: WhiteboardFurnitureModulePayload,
  factor: number,
): WhiteboardFurnitureModulePayload {
  if (!Number.isFinite(factor) || factor <= 0 || Math.abs(factor - 1) < 1e-6) return payload;
  const frame = furnitureFrame(
    payload.a,
    payload.b,
    payload.moduleType,
    payload.heightOverride,
    payload.widthOverride,
    payload.topDown === true,
  );
  const nextWidth = Math.max(FURNITURE_MIN_WIDTH, frame.width * factor);
  if (Math.abs(nextWidth - frame.width) < 0.5 && factor < 1) return payload;
  return {
    ...payload,
    widthOverride: nextWidth,
    topDown: true,
  };
}

/**
 * Detecta anotações antigas (a/b eram a base horizontal).
 * Novas: a=topo, b=base (eixo mais vertical).
 */
export function isLegacyFurnitureBase(a: WhiteboardPoint, b: WhiteboardPoint): boolean {
  return Math.abs(b.x - a.x) > Math.abs(b.y - a.y) * 1.15;
}

export function resolveFurnitureHeight(
  a: WhiteboardPoint,
  b: WhiteboardPoint,
  _moduleType: FurnitureModuleType,
  heightOverride?: number,
): number {
  if (typeof heightOverride === 'number' && Number.isFinite(heightOverride) && heightOverride > 0) {
    return Math.max(heightOverride, FURNITURE_MIN_HEIGHT);
  }
  return Math.max(Math.hypot(b.x - a.x, b.y - a.y), FURNITURE_MIN_HEIGHT);
}

export function resolveFurnitureWidth(
  a: WhiteboardPoint,
  b: WhiteboardPoint,
  moduleType: FurnitureModuleType,
  widthOverride?: number,
  heightOverride?: number,
): number {
  if (typeof widthOverride === 'number' && Number.isFinite(widthOverride) && widthOverride > 0) {
    return Math.max(widthOverride, FURNITURE_MIN_WIDTH);
  }
  const height = resolveFurnitureHeight(a, b, moduleType, heightOverride);
  const meta = getFurnitureModuleMeta(moduleType);
  return Math.max(height * meta.aspectWidth, FURNITURE_MIN_WIDTH);
}

/**
 * Quadro 3D do móvel.
 * Novo: a = topo, b = base (puxar de cima para baixo).
 * Legacy: a/b = base esquerda/direita.
 */
export function furnitureFrame(
  a: WhiteboardPoint,
  b: WhiteboardPoint,
  moduleType: FurnitureModuleType,
  heightOverride?: number,
  widthOverride?: number,
  /** Força eixo a→b como altura (necessário após rotação). */
  forceTopDown?: boolean,
  /** Só o frontal — sem profundidade 3D (banco “retos”). */
  flatFront?: boolean,
): FurnitureFrame {
  const meta = getFurnitureModuleMeta(moduleType);
  const legacy = !forceTopDown && isLegacyFurnitureBase(a, b);

  let tl: WhiteboardPoint;
  let tr: WhiteboardPoint;
  let br: WhiteboardPoint;
  let bl: WhiteboardPoint;
  let width: number;
  let height: number;
  let ux: number;
  let uy: number;
  let dx: number;
  let dy: number;

  if (legacy) {
    const baseDx = b.x - a.x;
    const baseDy = b.y - a.y;
    width = Math.max(Math.hypot(baseDx, baseDy), FURNITURE_MIN_WIDTH);
    height = resolveFurnitureHeight(a, b, moduleType, heightOverride);
    if (!heightOverride) {
      height = Math.max(width / Math.max(meta.aspectWidth, 0.2), FURNITURE_MIN_HEIGHT);
    }
    ux = baseDx / width;
    uy = baseDy / width;
    let px = -uy;
    let py = ux;
    if (py > 0) {
      px = -px;
      py = -py;
    }
    dx = -px;
    dy = -py;
    bl = a;
    br = b;
    tl = add(a, px * height, py * height);
    tr = add(b, px * height, py * height);
  } else {
    height = Math.max(Math.hypot(b.x - a.x, b.y - a.y), FURNITURE_MIN_HEIGHT);
    width = resolveFurnitureWidth(a, b, moduleType, widthOverride, heightOverride);
    dx = (b.x - a.x) / height;
    dy = (b.y - a.y) / height;
    ux = -dy;
    uy = dx;
    if (ux < 0) {
      ux = -ux;
      uy = -uy;
    }
    const half = width / 2;
    tl = along(a, ux, uy, dx, dy, -half, 0);
    tr = along(a, ux, uy, dx, dy, half, 0);
    bl = along(a, ux, uy, dx, dy, -half, height);
    br = along(a, ux, uy, dx, dy, half, height);
  }

  const depth = Math.max(width * meta.depthRatio, 8);
  const bx = ux * depth * 0.72 - dx * depth * 0.48;
  const by = uy * depth * 0.72 - dy * depth * 0.48;

  const tlBack = add(tl, bx, by);
  const trBack = add(tr, bx, by);
  const blBack = add(bl, bx, by);
  const brBack = add(br, bx, by);

  const lines: Array<[WhiteboardPoint, WhiteboardPoint]> = [];
  const paths: string[] = [];

  seg(lines, tl, tr);
  seg(lines, tr, br);
  seg(lines, br, bl);
  seg(lines, bl, tl);

  if (!flatFront) {
    seg(lines, tl, tlBack);
    seg(lines, tr, trBack);
    seg(lines, tlBack, trBack);

    seg(lines, tr, br);
    seg(lines, trBack, brBack);
    seg(lines, br, brBack);

    seg(lines, brBack, trBack);
  }

  const fillFaces: Array<WhiteboardPoint[]> = flatFront
    ? [[tl, tr, br, bl]]
    : [
        [tl, tr, trBack, tlBack],
        [tr, br, brBack, trBack],
        [tl, tr, br, bl],
      ];

  const frontOrigin = tl;
  const fu = (u: number, v: number) => along(frontOrigin, ux, uy, dx, dy, u * width, v * height);

  const drawInnerBox = (u0: number, v0: number, u1: number, v1: number) => {
    const p0 = fu(u0, v0);
    const p1 = fu(u1, v0);
    const p2 = fu(u1, v1);
    const p3 = fu(u0, v1);
    seg(lines, p0, p1);
    seg(lines, p1, p2);
    seg(lines, p2, p3);
    seg(lines, p3, p0);
  };

  const drawHandle = (u: number, v: number, len = 0.04) => {
    seg(lines, fu(u - len / 2, v), fu(u + len / 2, v));
  };

  const drawRing = (cu: number, cv: number, ru: number, rv = ru, steps = 12) => {
    const pts: WhiteboardPoint[] = [];
    for (let i = 0; i <= steps; i += 1) {
      const ang = (i / steps) * Math.PI * 2;
      pts.push(fu(cu + Math.cos(ang) * ru, cv + Math.sin(ang) * rv));
    }
    for (let i = 0; i < pts.length - 1; i += 1) {
      seg(lines, pts[i], pts[i + 1]);
    }
  };

  const drawCountertop = () => {
    const topOutL = add(tl, -ux * width * 0.04 - dx * height * 0.02, -uy * width * 0.04 - dy * height * 0.02);
    const topOutR = add(tr, ux * width * 0.04 - dx * height * 0.02, uy * width * 0.04 - dy * height * 0.02);
    const topOutLB = add(topOutL, bx * 1.1, by * 1.1);
    const topOutRB = add(topOutR, bx * 1.1, by * 1.1);
    seg(lines, topOutL, topOutR);
    seg(lines, topOutR, topOutRB);
    seg(lines, topOutRB, topOutLB);
    seg(lines, topOutLB, topOutL);
    seg(lines, tl, topOutL);
    seg(lines, tr, topOutR);
  };

  switch (moduleType) {
    case 'nicho': {
      drawInnerBox(0.1, 0.12, 0.9, 0.88);
      seg(lines, fu(0.1, 0.5), fu(0.9, 0.5));
      break;
    }
    case 'nicho_vazio': {
      drawInnerBox(0.08, 0.1, 0.92, 0.9);
      break;
    }
    case 'nicho_cruz': {
      drawInnerBox(0.08, 0.1, 0.92, 0.9);
      seg(lines, fu(0.5, 0.1), fu(0.5, 0.9));
      seg(lines, fu(0.08, 0.5), fu(0.92, 0.5));
      break;
    }
    case 'nicho_colmeia': {
      drawInnerBox(0.06, 0.08, 0.94, 0.92);
      for (const u of [0.35, 0.65]) {
        seg(lines, fu(u, 0.08), fu(u, 0.92));
      }
      for (const v of [0.35, 0.65]) {
        seg(lines, fu(0.06, v), fu(0.94, v));
      }
      break;
    }
    case 'nicho_losango': {
      drawInnerBox(0.08, 0.1, 0.92, 0.9);
      // Losango central + diagonais
      seg(lines, fu(0.5, 0.14), fu(0.86, 0.5));
      seg(lines, fu(0.86, 0.5), fu(0.5, 0.86));
      seg(lines, fu(0.5, 0.86), fu(0.14, 0.5));
      seg(lines, fu(0.14, 0.5), fu(0.5, 0.14));
      seg(lines, fu(0.32, 0.32), fu(0.68, 0.68));
      seg(lines, fu(0.68, 0.32), fu(0.32, 0.68));
      break;
    }
    case 'nicho_goulart': {
      drawInnerBox(0.06, 0.08, 0.94, 0.92);
      // Escalonado / assimétrico
      seg(lines, fu(0.38, 0.08), fu(0.38, 0.55));
      seg(lines, fu(0.62, 0.45), fu(0.62, 0.92));
      seg(lines, fu(0.06, 0.32), fu(0.38, 0.32));
      seg(lines, fu(0.38, 0.55), fu(0.94, 0.55));
      seg(lines, fu(0.62, 0.72), fu(0.94, 0.72));
      drawInnerBox(0.42, 0.12, 0.9, 0.48);
      break;
    }
    case 'nicho_hex': {
      drawInnerBox(0.06, 0.08, 0.94, 0.92);
      // Hexágono central aproximado
      const hex = [
        fu(0.5, 0.18),
        fu(0.78, 0.32),
        fu(0.78, 0.68),
        fu(0.5, 0.82),
        fu(0.22, 0.68),
        fu(0.22, 0.32),
      ];
      for (let i = 0; i < hex.length; i++) {
        seg(lines, hex[i], hex[(i + 1) % hex.length]);
      }
      seg(lines, fu(0.5, 0.18), fu(0.5, 0.82));
      break;
    }
    case 'armario_vazio':
    case 'armario_prateleiras': {
      for (const t of [0.2, 0.38, 0.56, 0.74, 0.9]) {
        seg(lines, fu(0.06, t), fu(0.94, t));
      }
      if (moduleType === 'armario_vazio') {
        seg(lines, fu(0.5, 0.06), fu(0.5, 0.94));
      }
      break;
    }
    case 'armario_2_portas': {
      seg(lines, fu(0.5, 0.05), fu(0.5, 0.95));
      drawHandle(0.42, 0.5);
      drawHandle(0.58, 0.5);
      break;
    }
    case 'armario_4_portas': {
      seg(lines, fu(0.5, 0.05), fu(0.5, 0.95));
      seg(lines, fu(0.05, 0.5), fu(0.95, 0.5));
      drawHandle(0.25, 0.28);
      drawHandle(0.75, 0.28);
      drawHandle(0.25, 0.72);
      drawHandle(0.75, 0.72);
      break;
    }
    case 'armario_canto': {
      seg(lines, fu(0.55, 0.05), fu(0.55, 0.95));
      seg(lines, fu(0.55, 0.55), fu(0.95, 0.55));
      for (const t of [0.28, 0.5, 0.72]) {
        seg(lines, fu(0.08, t), fu(0.55, t));
      }
      break;
    }
    case 'guarda_roupa': {
      seg(lines, fu(0.5, 0.05), fu(0.5, 0.95));
      seg(lines, fu(0.08, 0.14), fu(0.92, 0.14));
      drawHandle(0.42, 0.48);
      drawHandle(0.58, 0.48);
      seg(lines, fu(0.12, 0.22), fu(0.88, 0.22));
      break;
    }
    case 'guarda_roupa_casal': {
      seg(lines, fu(0.33, 0.05), fu(0.33, 0.95));
      seg(lines, fu(0.67, 0.05), fu(0.67, 0.95));
      seg(lines, fu(0.08, 0.14), fu(0.92, 0.14));
      drawHandle(0.28, 0.5);
      drawHandle(0.5, 0.5);
      drawHandle(0.72, 0.5);
      seg(lines, fu(0.1, 0.22), fu(0.9, 0.22));
      break;
    }
    case 'guarda_roupa_correr': {
      seg(lines, fu(0.08, 0.1), fu(0.92, 0.1));
      // Trilho + portas sobrepostas
      seg(lines, fu(0.12, 0.12), fu(0.12, 0.94));
      seg(lines, fu(0.55, 0.12), fu(0.55, 0.94));
      seg(lines, fu(0.42, 0.12), fu(0.42, 0.94));
      seg(lines, fu(0.88, 0.12), fu(0.88, 0.94));
      drawHandle(0.34, 0.5);
      drawHandle(0.66, 0.5);
      break;
    }
    case 'guarda_roupa_gavetas': {
      seg(lines, fu(0.55, 0.05), fu(0.55, 0.95));
      seg(lines, fu(0.08, 0.14), fu(0.55, 0.14));
      drawHandle(0.42, 0.5);
      for (const t of [0.28, 0.48, 0.68, 0.88]) {
        seg(lines, fu(0.55, t), fu(0.94, t));
        drawHandle(0.75, t - 0.08, 0.06);
      }
      break;
    }
    case 'armario_cozinha': {
      drawCountertop();
      seg(lines, fu(0.06, 0.28), fu(0.94, 0.28));
      seg(lines, fu(0.5, 0.28), fu(0.5, 0.95));
      drawHandle(0.5, 0.14, 0.12);
      drawHandle(0.31, 0.58);
      drawHandle(0.69, 0.58);
      break;
    }
    case 'armario_cozinha_2gav': {
      drawCountertop();
      seg(lines, fu(0.06, 0.38), fu(0.94, 0.38));
      seg(lines, fu(0.06, 0.68), fu(0.94, 0.68));
      drawHandle(0.5, 0.22, 0.1);
      drawHandle(0.5, 0.52, 0.1);
      drawHandle(0.5, 0.82, 0.1);
      break;
    }
    case 'armario_cozinha_canto': {
      drawCountertop();
      seg(lines, fu(0.5, 0.08), fu(0.5, 0.95));
      seg(lines, fu(0.5, 0.5), fu(0.94, 0.5));
      drawHandle(0.28, 0.5);
      drawHandle(0.72, 0.72);
      break;
    }
    case 'gaveta': {
      for (const t of [0.22, 0.42, 0.62, 0.82]) {
        seg(lines, fu(0.07, t), fu(0.93, t));
        drawHandle(0.5, t - 0.08, 0.14);
      }
      break;
    }
    case 'gaveta_3': {
      for (const t of [0.3, 0.55, 0.8]) {
        seg(lines, fu(0.07, t), fu(0.93, t));
        drawHandle(0.5, t - 0.1, 0.14);
      }
      break;
    }
    case 'gaveta_5': {
      for (const t of [0.18, 0.34, 0.5, 0.66, 0.82]) {
        seg(lines, fu(0.07, t), fu(0.93, t));
        drawHandle(0.5, t - 0.06, 0.12);
      }
      break;
    }
    case 'sapateira': {
      for (const t of [0.2, 0.4, 0.6, 0.8]) {
        seg(lines, fu(0.08, t), fu(0.92, t));
      }
      seg(lines, fu(0.15, 0.28), fu(0.85, 0.22));
      seg(lines, fu(0.15, 0.48), fu(0.85, 0.42));
      break;
    }
    case 'sapateira_basculante': {
      for (const t of [0.22, 0.42, 0.62, 0.82]) {
        seg(lines, fu(0.08, t), fu(0.92, t));
        seg(lines, fu(0.12, t - 0.02), fu(0.88, t - 0.1));
      }
      break;
    }
    case 'sapateira_prateleiras': {
      for (const t of [0.18, 0.34, 0.5, 0.66, 0.82]) {
        seg(lines, fu(0.08, t), fu(0.92, t));
      }
      break;
    }
    case 'armario_aereo': {
      seg(lines, fu(0.5, 0.08), fu(0.5, 0.92));
      drawHandle(0.25, 0.5);
      drawHandle(0.75, 0.5);
      break;
    }
    case 'aereo_2portas': {
      seg(lines, fu(0.5, 0.08), fu(0.5, 0.92));
      drawInnerBox(0.08, 0.12, 0.46, 0.88);
      drawInnerBox(0.54, 0.12, 0.92, 0.88);
      drawHandle(0.38, 0.5);
      drawHandle(0.62, 0.5);
      break;
    }
    case 'aereo_prateleira': {
      for (const t of [0.35, 0.65]) {
        seg(lines, fu(0.08, t), fu(0.92, t));
      }
      break;
    }
    case 'painel_tv': {
      drawInnerBox(0.18, 0.12, 0.82, 0.55);
      seg(lines, fu(0.08, 0.68), fu(0.92, 0.68));
      seg(lines, fu(0.33, 0.68), fu(0.33, 0.94));
      seg(lines, fu(0.67, 0.68), fu(0.67, 0.94));
      break;
    }
    case 'painel_tv_nichos': {
      drawInnerBox(0.28, 0.1, 0.72, 0.58);
      drawInnerBox(0.06, 0.1, 0.24, 0.35);
      drawInnerBox(0.06, 0.4, 0.24, 0.65);
      drawInnerBox(0.76, 0.1, 0.94, 0.35);
      drawInnerBox(0.76, 0.4, 0.94, 0.65);
      seg(lines, fu(0.06, 0.75), fu(0.94, 0.75));
      break;
    }
    case 'painel_tv_rack': {
      drawInnerBox(0.2, 0.08, 0.8, 0.48);
      seg(lines, fu(0.08, 0.58), fu(0.92, 0.58));
      seg(lines, fu(0.33, 0.58), fu(0.33, 0.95));
      seg(lines, fu(0.67, 0.58), fu(0.67, 0.95));
      drawHandle(0.2, 0.76);
      drawHandle(0.5, 0.76);
      drawHandle(0.8, 0.76);
      break;
    }
    case 'mesa_cabeceira': {
      seg(lines, fu(0.1, 0.45), fu(0.9, 0.45));
      drawHandle(0.5, 0.28, 0.14);
      drawHandle(0.5, 0.68, 0.14);
      break;
    }
    case 'mesa_cabeceira_2gav': {
      seg(lines, fu(0.08, 0.35), fu(0.92, 0.35));
      seg(lines, fu(0.08, 0.65), fu(0.92, 0.65));
      drawHandle(0.5, 0.2, 0.14);
      drawHandle(0.5, 0.5, 0.14);
      drawHandle(0.5, 0.8, 0.14);
      break;
    }
    case 'bancada': {
      const topOutL = add(tl, -ux * width * 0.03, -uy * width * 0.03);
      const topOutR = add(tr, ux * width * 0.03, uy * width * 0.03);
      seg(lines, topOutL, topOutR);
      seg(lines, fu(0.08, 0.35), fu(0.92, 0.35));
      seg(lines, fu(0.5, 0.35), fu(0.5, 0.95));
      break;
    }
    case 'bancada_ilha': {
      const topOutL = add(tl, -ux * width * 0.04, -uy * width * 0.04);
      const topOutR = add(tr, ux * width * 0.04, uy * width * 0.04);
      seg(lines, topOutL, topOutR);
      seg(lines, fu(0.08, 0.3), fu(0.92, 0.3));
      seg(lines, fu(0.33, 0.3), fu(0.33, 0.95));
      seg(lines, fu(0.67, 0.3), fu(0.67, 0.95));
      break;
    }
    case 'cristaleira': {
      seg(lines, fu(0.5, 0.08), fu(0.5, 0.92));
      for (const t of [0.28, 0.5, 0.72]) {
        seg(lines, fu(0.1, t), fu(0.9, t));
      }
      seg(lines, fu(0.18, 0.18), fu(0.42, 0.42));
      seg(lines, fu(0.58, 0.18), fu(0.82, 0.42));
      break;
    }
    case 'cristaleira_alta': {
      seg(lines, fu(0.5, 0.06), fu(0.5, 0.94));
      for (const t of [0.2, 0.36, 0.52, 0.68, 0.84]) {
        seg(lines, fu(0.1, t), fu(0.9, t));
      }
      seg(lines, fu(0.16, 0.12), fu(0.4, 0.28));
      seg(lines, fu(0.6, 0.12), fu(0.84, 0.28));
      break;
    }
    case 'rack': {
      seg(lines, fu(0.08, 0.4), fu(0.92, 0.4));
      seg(lines, fu(0.08, 0.7), fu(0.92, 0.7));
      seg(lines, fu(0.33, 0.4), fu(0.33, 0.95));
      seg(lines, fu(0.67, 0.4), fu(0.67, 0.95));
      drawInnerBox(0.22, 0.08, 0.78, 0.32);
      break;
    }
    case 'rack_2nichos': {
      drawInnerBox(0.08, 0.1, 0.3, 0.55);
      drawInnerBox(0.7, 0.1, 0.92, 0.55);
      drawInnerBox(0.34, 0.1, 0.66, 0.4);
      seg(lines, fu(0.08, 0.65), fu(0.92, 0.65));
      seg(lines, fu(0.5, 0.65), fu(0.5, 0.95));
      break;
    }
    case 'forno_embutido': {
      drawInnerBox(0.12, 0.28, 0.88, 0.9);
      drawInnerBox(0.2, 0.38, 0.8, 0.82);
      seg(lines, fu(0.12, 0.22), fu(0.88, 0.22));
      drawHandle(0.5, 0.16, 0.22);
      drawRing(0.28, 0.12, 0.04);
      drawRing(0.5, 0.12, 0.04);
      drawRing(0.72, 0.12, 0.04);
      break;
    }
    case 'forno_torre': {
      drawInnerBox(0.14, 0.08, 0.86, 0.48);
      drawInnerBox(0.2, 0.16, 0.8, 0.42);
      drawInnerBox(0.14, 0.52, 0.86, 0.92);
      drawInnerBox(0.2, 0.6, 0.8, 0.86);
      drawHandle(0.5, 0.12, 0.18);
      drawHandle(0.5, 0.56, 0.18);
      break;
    }
    case 'fogao_4bocas': {
      drawRing(0.28, 0.16, 0.12);
      drawRing(0.72, 0.16, 0.12);
      drawRing(0.28, 0.38, 0.12);
      drawRing(0.72, 0.38, 0.12);
      seg(lines, fu(0.08, 0.52), fu(0.92, 0.52));
      drawInnerBox(0.16, 0.6, 0.84, 0.92);
      drawHandle(0.5, 0.56, 0.2);
      break;
    }
    case 'fogao_5bocas': {
      drawRing(0.22, 0.14, 0.1);
      drawRing(0.78, 0.14, 0.1);
      drawRing(0.5, 0.26, 0.11);
      drawRing(0.22, 0.4, 0.1);
      drawRing(0.78, 0.4, 0.1);
      seg(lines, fu(0.08, 0.54), fu(0.92, 0.54));
      drawInnerBox(0.16, 0.62, 0.84, 0.92);
      drawHandle(0.5, 0.58, 0.18);
      break;
    }
    case 'fogao_6bocas': {
      drawRing(0.2, 0.14, 0.1);
      drawRing(0.5, 0.14, 0.1);
      drawRing(0.8, 0.14, 0.1);
      drawRing(0.2, 0.38, 0.1);
      drawRing(0.5, 0.38, 0.1);
      drawRing(0.8, 0.38, 0.1);
      seg(lines, fu(0.08, 0.54), fu(0.92, 0.54));
      drawInnerBox(0.16, 0.62, 0.84, 0.92);
      drawHandle(0.5, 0.58, 0.18);
      break;
    }
    case 'cooktop': {
      drawInnerBox(0.06, 0.18, 0.94, 0.82);
      drawRing(0.28, 0.36, 0.14);
      drawRing(0.72, 0.36, 0.14);
      drawRing(0.28, 0.64, 0.14);
      drawRing(0.72, 0.64, 0.14);
      break;
    }
    case 'coifa_parede': {
      seg(lines, fu(0.38, 0.06), fu(0.62, 0.06));
      seg(lines, fu(0.38, 0.06), fu(0.4, 0.42));
      seg(lines, fu(0.62, 0.06), fu(0.6, 0.42));
      seg(lines, fu(0.08, 0.42), fu(0.92, 0.42));
      seg(lines, fu(0.08, 0.42), fu(0.04, 0.92));
      seg(lines, fu(0.92, 0.42), fu(0.96, 0.92));
      seg(lines, fu(0.04, 0.92), fu(0.96, 0.92));
      break;
    }
    case 'coifa_ilha': {
      seg(lines, fu(0.42, 0.04), fu(0.58, 0.04));
      seg(lines, fu(0.42, 0.04), fu(0.4, 0.32));
      seg(lines, fu(0.58, 0.04), fu(0.6, 0.32));
      seg(lines, fu(0.12, 0.32), fu(0.88, 0.32));
      seg(lines, fu(0.06, 0.9), fu(0.94, 0.9));
      seg(lines, fu(0.12, 0.32), fu(0.06, 0.9));
      seg(lines, fu(0.88, 0.32), fu(0.94, 0.9));
      break;
    }
    case 'depurador': {
      drawInnerBox(0.04, 0.28, 0.96, 0.72);
      seg(lines, fu(0.12, 0.42), fu(0.88, 0.42));
      seg(lines, fu(0.12, 0.58), fu(0.88, 0.58));
      drawRing(0.18, 0.2, 0.04);
      drawRing(0.82, 0.2, 0.04);
      break;
    }
    case 'microondas': {
      drawInnerBox(0.1, 0.18, 0.7, 0.82);
      drawInnerBox(0.74, 0.18, 0.92, 0.82);
      drawHandle(0.82, 0.5, 0.08);
      drawRing(0.82, 0.3, 0.04);
      break;
    }
    case 'geladeira': {
      seg(lines, fu(0.5, 0.06), fu(0.5, 0.94));
      drawInnerBox(0.1, 0.1, 0.46, 0.9);
      drawInnerBox(0.54, 0.1, 0.9, 0.9);
      drawHandle(0.42, 0.45);
      drawHandle(0.58, 0.45);
      break;
    }
    case 'lava_loucas': {
      drawInnerBox(0.12, 0.12, 0.88, 0.88);
      drawInnerBox(0.22, 0.28, 0.78, 0.78);
      drawHandle(0.5, 0.18, 0.22);
      break;
    }
    case 'cuba_pia': {
      drawCountertop();
      drawRing(0.5, 0.55, 0.28, 0.18);
      seg(lines, fu(0.5, 0.18), fu(0.5, 0.38));
      seg(lines, fu(0.42, 0.18), fu(0.58, 0.18));
      break;
    }
    case 'air_fryer': {
      drawInnerBox(0.16, 0.22, 0.84, 0.92);
      drawInnerBox(0.24, 0.38, 0.76, 0.82);
      drawHandle(0.5, 0.28, 0.22);
      drawRing(0.5, 0.14, 0.1, 0.05);
      break;
    }
    case 'liquidificador': {
      drawInnerBox(0.28, 0.62, 0.72, 0.94);
      drawRing(0.5, 0.32, 0.18, 0.28);
      seg(lines, fu(0.32, 0.32), fu(0.36, 0.62));
      seg(lines, fu(0.68, 0.32), fu(0.64, 0.62));
      drawHandle(0.78, 0.36, 0.08);
      break;
    }
    case 'cafeteira': {
      drawInnerBox(0.12, 0.55, 0.88, 0.92);
      drawRing(0.38, 0.28, 0.16, 0.22);
      seg(lines, fu(0.62, 0.18), fu(0.78, 0.18));
      seg(lines, fu(0.78, 0.18), fu(0.78, 0.55));
      drawHandle(0.28, 0.72, 0.1);
      break;
    }
    case 'chaleira': {
      drawRing(0.48, 0.48, 0.28, 0.22);
      drawRing(0.48, 0.22, 0.1, 0.06);
      seg(lines, fu(0.76, 0.42), fu(0.9, 0.28));
      seg(lines, fu(0.9, 0.28), fu(0.82, 0.22));
      break;
    }
    case 'torradeira': {
      drawInnerBox(0.08, 0.38, 0.92, 0.88);
      seg(lines, fu(0.22, 0.22), fu(0.22, 0.38));
      seg(lines, fu(0.4, 0.18), fu(0.4, 0.38));
      seg(lines, fu(0.6, 0.18), fu(0.6, 0.38));
      seg(lines, fu(0.78, 0.22), fu(0.78, 0.38));
      drawHandle(0.5, 0.72, 0.18);
      break;
    }
    case 'panela': {
      drawRing(0.48, 0.52, 0.32, 0.22);
      drawRing(0.48, 0.28, 0.22, 0.1);
      seg(lines, fu(0.8, 0.48), fu(0.96, 0.4));
      break;
    }
    case 'espelho_retangular': {
      drawInnerBox(0.1, 0.08, 0.9, 0.92);
      seg(lines, fu(0.22, 0.2), fu(0.78, 0.78));
      break;
    }
    case 'espelho_oval': {
      drawRing(0.5, 0.5, 0.36, 0.42, 16);
      seg(lines, fu(0.32, 0.28), fu(0.68, 0.72));
      break;
    }
    case 'espelho_redondo': {
      drawRing(0.5, 0.5, 0.4, 0.4, 16);
      seg(lines, fu(0.3, 0.3), fu(0.7, 0.7));
      break;
    }
    case 'espelho_corpo': {
      drawInnerBox(0.18, 0.06, 0.82, 0.94);
      seg(lines, fu(0.28, 0.16), fu(0.72, 0.82));
      break;
    }
    case 'espelheira': {
      drawInnerBox(0.12, 0.08, 0.88, 0.68);
      seg(lines, fu(0.22, 0.18), fu(0.78, 0.58));
      seg(lines, fu(0.08, 0.74), fu(0.92, 0.74));
      seg(lines, fu(0.08, 0.74), fu(0.08, 0.94));
      seg(lines, fu(0.92, 0.74), fu(0.92, 0.94));
      break;
    }
    case 'espelho_adnet': {
      drawRing(0.5, 0.52, 0.36, 0.36, 16);
      seg(lines, fu(0.32, 0.32), fu(0.68, 0.72));
      seg(lines, fu(0.28, 0.18), fu(0.28, 0.08));
      seg(lines, fu(0.72, 0.18), fu(0.72, 0.08));
      seg(lines, fu(0.28, 0.08), fu(0.72, 0.08));
      break;
    }
    case 'cama': {
      seg(lines, fu(0.08, 0.22), fu(0.92, 0.22));
      drawInnerBox(0.1, 0.26, 0.9, 0.92);
      seg(lines, fu(0.18, 0.06), fu(0.82, 0.06));
      seg(lines, fu(0.18, 0.06), fu(0.12, 0.22));
      seg(lines, fu(0.82, 0.06), fu(0.88, 0.22));
      break;
    }
    case 'cabeceira': {
      drawInnerBox(0.06, 0.18, 0.94, 0.86);
      seg(lines, fu(0.5, 0.18), fu(0.5, 0.86));
      seg(lines, fu(0.06, 0.5), fu(0.94, 0.5));
      break;
    }
    case 'penteadeira': {
      drawInnerBox(0.22, 0.06, 0.78, 0.48);
      seg(lines, fu(0.32, 0.14), fu(0.68, 0.4));
      seg(lines, fu(0.08, 0.52), fu(0.92, 0.52));
      seg(lines, fu(0.5, 0.52), fu(0.5, 0.94));
      drawHandle(0.28, 0.72);
      drawHandle(0.72, 0.72);
      break;
    }
    case 'abajur': {
      drawRing(0.5, 0.22, 0.22, 0.1);
      seg(lines, fu(0.32, 0.22), fu(0.44, 0.62));
      seg(lines, fu(0.68, 0.22), fu(0.56, 0.62));
      drawInnerBox(0.38, 0.62, 0.62, 0.92);
      break;
    }
    case 'puff': {
      drawRing(0.5, 0.55, 0.38, 0.22, 14);
      drawRing(0.5, 0.42, 0.38, 0.16, 14);
      break;
    }
    case 'comoda': {
      seg(lines, fu(0.08, 0.34), fu(0.92, 0.34));
      seg(lines, fu(0.08, 0.56), fu(0.92, 0.56));
      seg(lines, fu(0.08, 0.78), fu(0.92, 0.78));
      drawHandle(0.5, 0.22);
      drawHandle(0.5, 0.45);
      drawHandle(0.5, 0.67);
      drawHandle(0.5, 0.88);
      break;
    }
    case 'luminaria_chao': {
      drawRing(0.5, 0.16, 0.18, 0.08);
      seg(lines, fu(0.36, 0.16), fu(0.46, 0.72));
      seg(lines, fu(0.64, 0.16), fu(0.54, 0.72));
      seg(lines, fu(0.5, 0.72), fu(0.5, 0.92));
      drawInnerBox(0.38, 0.88, 0.62, 0.96);
      break;
    }
    case 'cadeira': {
      drawInnerBox(0.18, 0.08, 0.82, 0.42);
      drawInnerBox(0.22, 0.42, 0.78, 0.72);
      seg(lines, fu(0.26, 0.72), fu(0.22, 0.96));
      seg(lines, fu(0.74, 0.72), fu(0.78, 0.96));
      seg(lines, fu(0.22, 0.96), fu(0.34, 0.96));
      seg(lines, fu(0.66, 0.96), fu(0.78, 0.96));
      break;
    }
    case 'cadeira_poltrona': {
      drawInnerBox(0.1, 0.08, 0.9, 0.4);
      drawInnerBox(0.12, 0.4, 0.88, 0.78);
      seg(lines, fu(0.1, 0.18), fu(0.1, 0.78));
      seg(lines, fu(0.9, 0.18), fu(0.9, 0.78));
      seg(lines, fu(0.18, 0.78), fu(0.16, 0.96));
      seg(lines, fu(0.82, 0.78), fu(0.84, 0.96));
      break;
    }
    case 'sofa': {
      drawInnerBox(0.04, 0.12, 0.96, 0.42);
      drawInnerBox(0.08, 0.42, 0.92, 0.82);
      seg(lines, fu(0.36, 0.42), fu(0.36, 0.82));
      seg(lines, fu(0.64, 0.42), fu(0.64, 0.82));
      seg(lines, fu(0.08, 0.82), fu(0.06, 0.96));
      seg(lines, fu(0.92, 0.82), fu(0.94, 0.96));
      break;
    }
    case 'sofa_2lugares': {
      drawInnerBox(0.06, 0.12, 0.94, 0.42);
      drawInnerBox(0.1, 0.42, 0.9, 0.82);
      seg(lines, fu(0.5, 0.42), fu(0.5, 0.82));
      seg(lines, fu(0.1, 0.82), fu(0.08, 0.96));
      seg(lines, fu(0.9, 0.82), fu(0.92, 0.96));
      break;
    }
    case 'sofa_canto': {
      drawInnerBox(0.04, 0.08, 0.62, 0.92);
      drawInnerBox(0.62, 0.42, 0.96, 0.92);
      drawInnerBox(0.08, 0.12, 0.58, 0.38);
      break;
    }
    case 'modulo_cubo': {
      drawInnerBox(0.1, 0.1, 0.9, 0.9);
      seg(lines, fu(0.1, 0.5), fu(0.9, 0.5));
      seg(lines, fu(0.5, 0.1), fu(0.5, 0.9));
      break;
    }
    default:
      break;
  }

  return {
    bl,
    br,
    tr,
    tl,
    tlBack,
    trBack,
    blBack,
    brBack,
    width,
    height,
    depth,
    ux,
    uy,
    dx,
    dy,
    lines,
    paths,
    fillFaces,
  };
}

export function furnitureCorners(
  a: WhiteboardPoint,
  b: WhiteboardPoint,
  moduleType: FurnitureModuleType,
  heightOverride?: number,
  widthOverride?: number,
  forceTopDown?: boolean,
): WhiteboardPoint[] {
  const f = furnitureFrame(a, b, moduleType, heightOverride, widthOverride, forceTopDown);
  return [f.bl, f.br, f.tr, f.tl, f.tlBack, f.trBack, f.brBack, f.blBack];
}

export function furnitureLinesPath(lines: Array<[WhiteboardPoint, WhiteboardPoint]>): string {
  return lines.map(([p, q]) => `M ${p.x} ${p.y} L ${q.x} ${q.y}`).join(' ');
}
