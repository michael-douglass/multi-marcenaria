import type { FurnitureModuleType } from '@/lib/whiteboard-annotations';

/**
 * Peças extras do catálogo — nomes alinhados a bibliotecas de arquitetura
 * (Promob, Revit Furniture/Casework, Archicad Library, SketchUp 3D Warehouse).
 */
export interface ExtraFurnitureModule {
  type: FurnitureModuleType;
  label: string;
  description: string;
  family:
    | 'decoracao'
    | 'iluminacao'
    | 'mesa'
    | 'bancada'
    | 'pedra'
    | 'revestimento'
    | 'banheiro'
    | 'sala'
    | 'quarto';
  aspectWidth: number;
  depthRatio: number;
  keywords?: string[];
}

export const EXTRA_FURNITURE_MODULES: ExtraFurnitureModule[] = [
  { type: 'tapete', label: 'Tapete retangular', description: 'Tapete de estar', family: 'decoracao', aspectWidth: 1.6, depthRatio: 0.08, keywords: ['tapete', 'rug', 'sala', 'decoração'] },
  { type: 'tapete_redondo', label: 'Tapete redondo', description: 'Tapete circular', family: 'decoracao', aspectWidth: 1.15, depthRatio: 0.08, keywords: ['tapete', 'redondo', 'sala'] },
  { type: 'cortina', label: 'Cortina', description: 'Cortina de janela', family: 'decoracao', aspectWidth: 0.85, depthRatio: 0.12, keywords: ['cortina', 'tecido', 'janela'] },
  { type: 'persiana', label: 'Persiana', description: 'Persiana horizontal', family: 'decoracao', aspectWidth: 0.9, depthRatio: 0.08, keywords: ['persiana', 'janela', 'sombra'] },
  { type: 'vaso', label: 'Vaso', description: 'Vaso de mesa', family: 'decoracao', aspectWidth: 0.45, depthRatio: 0.4, keywords: ['vaso', 'cerâmica', 'decoração'] },
  { type: 'vaso_alto', label: 'Vaso alto', description: 'Vaso de chão', family: 'decoracao', aspectWidth: 0.42, depthRatio: 0.38, keywords: ['vaso', 'chão', 'decoração'] },
  { type: 'planta', label: 'Planta', description: 'Planta de mesa', family: 'decoracao', aspectWidth: 0.5, depthRatio: 0.4, keywords: ['planta', 'verde', 'folha'] },
  { type: 'planta_chao', label: 'Planta de chão', description: 'Vaso com folhagem alta', family: 'decoracao', aspectWidth: 0.48, depthRatio: 0.42, keywords: ['planta', 'árvore', 'indoor'] },
  { type: 'quadro', label: 'Quadro', description: 'Quadro na parede', family: 'decoracao', aspectWidth: 0.85, depthRatio: 0.06, keywords: ['quadro', 'arte', 'parede'] },
  { type: 'galeria_quadros', label: 'Galeria de quadros', description: 'Composição de quadros', family: 'decoracao', aspectWidth: 1.4, depthRatio: 0.06, keywords: ['galeria', 'quadros', 'parede'] },
  { type: 'almofada', label: 'Almofada', description: 'Almofada de sofá', family: 'decoracao', aspectWidth: 0.7, depthRatio: 0.35, keywords: ['almofada', 'sofá', 'tecido'] },
  { type: 'manta', label: 'Manta', description: 'Manta dobrada', family: 'decoracao', aspectWidth: 0.85, depthRatio: 0.22, keywords: ['manta', 'sofá', 'tecido'] },
  { type: 'cachepot', label: 'Cachepô', description: 'Cachepô de madeira', family: 'decoracao', aspectWidth: 0.5, depthRatio: 0.45, keywords: ['cachepô', 'vaso', 'madeira'] },
  { type: 'escultura', label: 'Escultura', description: 'Peça decorativa', family: 'decoracao', aspectWidth: 0.4, depthRatio: 0.35, keywords: ['escultura', 'arte', 'objeto'] },
  { type: 'relogio_parede', label: 'Relógio de parede', description: 'Relógio circular', family: 'decoracao', aspectWidth: 0.7, depthRatio: 0.08, keywords: ['relógio', 'parede'] },
  { type: 'livros', label: 'Livros', description: 'Pilha de livros', family: 'decoracao', aspectWidth: 0.55, depthRatio: 0.28, keywords: ['livro', 'estante', 'decoração'] },
  { type: 'lareira', label: 'Lareira', description: 'Lareira de sala', family: 'decoracao', aspectWidth: 1.15, depthRatio: 0.35, keywords: ['lareira', 'fogo', 'sala'] },
  { type: 'biombo', label: 'Biombo', description: 'Divisória leve', family: 'decoracao', aspectWidth: 1.1, depthRatio: 0.12, keywords: ['biombo', 'divisória', 'painel'] },

  { type: 'pendente', label: 'Pendente', description: 'Luminária pendente', family: 'iluminacao', aspectWidth: 0.45, depthRatio: 0.4, keywords: ['pendente', 'luz', 'luminária'] },
  { type: 'pendente_triplo', label: 'Pendente triplo', description: 'Três pendentes', family: 'iluminacao', aspectWidth: 1.1, depthRatio: 0.35, keywords: ['pendente', 'jantar', 'luz'] },
  { type: 'arandela', label: 'Arandela', description: 'Luz de parede', family: 'iluminacao', aspectWidth: 0.4, depthRatio: 0.22, keywords: ['arandela', 'parede', 'luz'] },
  { type: 'spot', label: 'Spot', description: 'Spot direcionável', family: 'iluminacao', aspectWidth: 0.35, depthRatio: 0.28, keywords: ['spot', 'foco', 'luz'] },
  { type: 'trilha_spots', label: 'Trilho de spots', description: 'Trilho com spots', family: 'iluminacao', aspectWidth: 1.5, depthRatio: 0.18, keywords: ['trilho', 'spot', 'luz'] },
  { type: 'fita_led', label: 'Fita LED', description: 'Iluminação linear', family: 'iluminacao', aspectWidth: 1.6, depthRatio: 0.06, keywords: ['led', 'fita', 'sanca'] },
  { type: 'plafon', label: 'Plafón', description: 'Plafón de teto', family: 'iluminacao', aspectWidth: 0.7, depthRatio: 0.15, keywords: ['plafon', 'teto', 'luz'] },

  { type: 'mesa_jantar', label: 'Mesa de jantar', description: 'Mesa retangular', family: 'mesa', aspectWidth: 1.7, depthRatio: 0.7, keywords: ['mesa', 'jantar', 'sala'] },
  { type: 'mesa_jantar_redonda', label: 'Mesa redonda', description: 'Mesa de jantar circular', family: 'mesa', aspectWidth: 1.2, depthRatio: 0.7, keywords: ['mesa', 'redonda', 'jantar'] },
  { type: 'mesa_centro', label: 'Mesa de centro', description: 'Mesa baixa de estar', family: 'mesa', aspectWidth: 1.35, depthRatio: 0.55, keywords: ['mesa', 'centro', 'sala'] },
  { type: 'mesa_lateral', label: 'Mesa lateral', description: 'Apoio ao lado do sofá', family: 'mesa', aspectWidth: 0.55, depthRatio: 0.5, keywords: ['mesa', 'lateral', 'canto'] },
  { type: 'aparador', label: 'Aparador', description: 'Aparador alongado', family: 'mesa', aspectWidth: 1.8, depthRatio: 0.32, keywords: ['aparador', 'buffet', 'sala'] },
  { type: 'escrivaninha', label: 'Escrivaninha', description: 'Mesa de trabalho', family: 'mesa', aspectWidth: 1.45, depthRatio: 0.5, keywords: ['escrivaninha', 'home office', 'mesa'] },
  { type: 'estante', label: 'Estante', description: 'Estante aberta', family: 'sala', aspectWidth: 0.85, depthRatio: 0.32, keywords: ['estante', 'livros', 'nicho'] },
  { type: 'buffet', label: 'Buffet', description: 'Buffet baixo', family: 'sala', aspectWidth: 1.55, depthRatio: 0.38, keywords: ['buffet', 'sala', 'jantar'] },
  { type: 'chaise', label: 'Chaise', description: 'Chaise longue', family: 'sala', aspectWidth: 1.5, depthRatio: 0.55, keywords: ['chaise', 'divã', 'sofá'] },

  { type: 'bancada_granito', label: 'Bancada granito', description: 'Tampo granito', family: 'bancada', aspectWidth: 1.8, depthRatio: 0.45, keywords: ['bancada', 'granito', 'cozinha', 'pedra'] },
  { type: 'bancada_marmore', label: 'Bancada mármore', description: 'Tampo mármore', family: 'bancada', aspectWidth: 1.8, depthRatio: 0.45, keywords: ['bancada', 'mármore', 'marmore', 'cozinha'] },
  { type: 'bancada_quartzo', label: 'Bancada quartzo', description: 'Tampo de quartzo', family: 'bancada', aspectWidth: 1.8, depthRatio: 0.45, keywords: ['bancada', 'quartzo', 'cozinha'] },
  { type: 'bancada_silestone', label: 'Bancada Silestone', description: 'Superfície Silestone', family: 'bancada', aspectWidth: 1.8, depthRatio: 0.45, keywords: ['bancada', 'silestone', 'dekton', 'cozinha'] },
  { type: 'bancada_madeira', label: 'Bancada madeira', description: 'Tampo de madeira', family: 'bancada', aspectWidth: 1.8, depthRatio: 0.45, keywords: ['bancada', 'madeira', 'butcher'] },
  { type: 'bancada_corian', label: 'Bancada Corian', description: 'Superfície Corian', family: 'bancada', aspectWidth: 1.8, depthRatio: 0.45, keywords: ['bancada', 'corian', 'solid surface'] },

  { type: 'pedra_marmore', label: 'Mármore', description: 'Amostra de mármore', family: 'pedra', aspectWidth: 1.2, depthRatio: 0.08, keywords: ['pedra', 'mármore', 'marmore', 'amostra'] },
  { type: 'pedra_calacatta', label: 'Calacatta', description: 'Mármore Calacatta', family: 'pedra', aspectWidth: 1.2, depthRatio: 0.08, keywords: ['pedra', 'calacatta', 'mármore'] },
  { type: 'pedra_granito', label: 'Granito', description: 'Amostra de granito', family: 'pedra', aspectWidth: 1.2, depthRatio: 0.08, keywords: ['pedra', 'granito'] },
  { type: 'pedra_preto_sao_gabriel', label: 'Preto São Gabriel', description: 'Granito preto', family: 'pedra', aspectWidth: 1.2, depthRatio: 0.08, keywords: ['pedra', 'granito', 'preto', 'são gabriel'] },
  { type: 'pedra_quartzito', label: 'Quartzito', description: 'Amostra de quartzito', family: 'pedra', aspectWidth: 1.2, depthRatio: 0.08, keywords: ['pedra', 'quartzito'] },
  { type: 'pedra_travertino', label: 'Travertino', description: 'Amostra de travertino', family: 'pedra', aspectWidth: 1.2, depthRatio: 0.08, keywords: ['pedra', 'travertino'] },
  { type: 'pedra_sao_tome', label: 'São Tomé', description: 'Pedra São Tomé', family: 'pedra', aspectWidth: 1.2, depthRatio: 0.08, keywords: ['pedra', 'são tomé', 'piso'] },

  { type: 'revest_ripado', label: 'Ripado', description: 'Painel ripado', family: 'revestimento', aspectWidth: 1.15, depthRatio: 0.1, keywords: ['revestimento', 'ripado', 'madeira', 'parede'] },
  { type: 'revest_3d', label: 'Revestimento 3D', description: 'Painel 3D', family: 'revestimento', aspectWidth: 1.15, depthRatio: 0.12, keywords: ['revestimento', '3d', 'parede'] },
  { type: 'revest_porcelanato', label: 'Porcelanato', description: 'Placa de porcelanato', family: 'revestimento', aspectWidth: 1.15, depthRatio: 0.06, keywords: ['revestimento', 'porcelanato', 'piso'] },
  { type: 'revest_tijolinho', label: 'Tijolinho', description: 'Tijolo aparente', family: 'revestimento', aspectWidth: 1.15, depthRatio: 0.08, keywords: ['revestimento', 'tijolo', 'tijolinho'] },
  { type: 'revest_cimento', label: 'Cimento queimado', description: 'Cimento queimado', family: 'revestimento', aspectWidth: 1.15, depthRatio: 0.05, keywords: ['revestimento', 'cimento', 'queimado'] },
  { type: 'revest_papel', label: 'Papel de parede', description: 'Papel de parede', family: 'revestimento', aspectWidth: 1.15, depthRatio: 0.04, keywords: ['revestimento', 'papel', 'parede'] },
  { type: 'revest_lambris', label: 'Lambris', description: 'Lambris de madeira', family: 'revestimento', aspectWidth: 1.15, depthRatio: 0.08, keywords: ['revestimento', 'lambris', 'boiserie'] },

  { type: 'cuba_apoiada', label: 'Cuba apoiada', description: 'Cuba de sobrepor', family: 'banheiro', aspectWidth: 0.7, depthRatio: 0.45, keywords: ['cuba', 'pia', 'banheiro'] },
  { type: 'gabinete_banheiro', label: 'Gabinete banheiro', description: 'Gabinete com cuba', family: 'banheiro', aspectWidth: 1.1, depthRatio: 0.42, keywords: ['gabinete', 'banheiro', 'pia'] },
  { type: 'toalheiro', label: 'Toalheiro', description: 'Toalheiro de parede', family: 'banheiro', aspectWidth: 0.55, depthRatio: 0.12, keywords: ['toalheiro', 'banheiro'] },
  { type: 'banco', label: 'Banco', description: 'Banco de estar', family: 'sala', aspectWidth: 1.35, depthRatio: 0.42, keywords: ['banco', 'bench', 'sala'] },
  { type: 'banqueta', label: 'Banqueta', description: 'Banqueta alta', family: 'sala', aspectWidth: 0.42, depthRatio: 0.4, keywords: ['banqueta', 'banquinho', 'bar'] },
  { type: 'candelabro', label: 'Candelabro', description: 'Candelabro de teto', family: 'iluminacao', aspectWidth: 0.7, depthRatio: 0.4, keywords: ['candelabro', 'lustre', 'luz'] },
  { type: 'tapete_pele', label: 'Tapete pele', description: 'Tapete orgânico', family: 'decoracao', aspectWidth: 1.35, depthRatio: 0.08, keywords: ['tapete', 'pele', 'sala'] },
  { type: 'planta_costela', label: 'Costela-de-adão', description: 'Planta tropical', family: 'decoracao', aspectWidth: 0.52, depthRatio: 0.4, keywords: ['planta', 'costela', 'adam'] },
  { type: 'bancada_dekton', label: 'Bancada Dekton', description: 'Superfície Dekton', family: 'bancada', aspectWidth: 1.8, depthRatio: 0.45, keywords: ['bancada', 'dekton', 'cozinha'] },
  { type: 'pedra_carrara', label: 'Carrara', description: 'Mármore Carrara', family: 'pedra', aspectWidth: 1.2, depthRatio: 0.08, keywords: ['pedra', 'carrara', 'mármore'] },
  { type: 'pedra_onyx', label: 'Ônix', description: 'Pedra ônix', family: 'pedra', aspectWidth: 1.2, depthRatio: 0.08, keywords: ['pedra', 'ônix', 'onyx'] },
  { type: 'revest_canjiquinha', label: 'Canjiquinha', description: 'Pedra canjiquinha', family: 'revestimento', aspectWidth: 1.15, depthRatio: 0.1, keywords: ['revestimento', 'canjiquinha', 'pedra'] },
  { type: 'revest_pastilha', label: 'Pastilha', description: 'Pastilha de vidro', family: 'revestimento', aspectWidth: 1.15, depthRatio: 0.05, keywords: ['revestimento', 'pastilha', 'box'] },
];
