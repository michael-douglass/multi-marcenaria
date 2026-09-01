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
    | 'quarto'
    | 'guarda_roupa'
    | 'cozinha'
    | 'aereo'
    | 'armario'
    | 'lavanderia';
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

  // —— Banheiro: armário aéreo, de bancada, com e sem vidro ——
  { type: 'armario_banheiro_aereo', label: 'Aéreo banheiro', description: 'Armário de parede, portas de madeira', family: 'banheiro', aspectWidth: 1.15, depthRatio: 0.26, keywords: ['armário', 'armario', 'banheiro', 'aéreo', 'aereo', 'parede'] },
  { type: 'armario_banheiro_aereo_vidro', label: 'Aéreo banheiro vidro', description: 'Aéreo com portas de vidro', family: 'banheiro', aspectWidth: 1.15, depthRatio: 0.26, keywords: ['armário', 'banheiro', 'aéreo', 'vidro', 'vitrine'] },
  { type: 'armario_banheiro_bancada', label: 'Bancada banheiro', description: 'Gabinete de piso com tampo', family: 'banheiro', aspectWidth: 1.2, depthRatio: 0.42, keywords: ['armário', 'banheiro', 'bancada', 'gabinete', 'pia'] },
  { type: 'armario_banheiro_bancada_vidro', label: 'Bancada banheiro vidro', description: 'Gabinete de piso com portas de vidro', family: 'banheiro', aspectWidth: 1.2, depthRatio: 0.42, keywords: ['armário', 'banheiro', 'bancada', 'vidro', 'gabinete'] },
  { type: 'armario_banheiro_coluna', label: 'Coluna banheiro', description: 'Armário alto de lavabo', family: 'banheiro', aspectWidth: 0.55, depthRatio: 0.32, keywords: ['armário', 'coluna', 'banheiro', 'alto'] },
  { type: 'gabinete_banheiro_gavetas', label: 'Gabinete gavetas', description: 'Gabinete com bloco de gavetas', family: 'banheiro', aspectWidth: 1.15, depthRatio: 0.42, keywords: ['gabinete', 'gaveta', 'banheiro', 'pia'] },
  { type: 'nicho_box', label: 'Nicho de box', description: 'Nicho embutido no box', family: 'banheiro', aspectWidth: 0.7, depthRatio: 0.18, keywords: ['nicho', 'box', 'banheiro', 'shampoo'] },
  { type: 'box_vidro', label: 'Box de vidro', description: 'Box com portas de vidro', family: 'banheiro', aspectWidth: 0.85, depthRatio: 0.45, keywords: ['box', 'vidro', 'banheiro', 'blindex'] },
  { type: 'ducha', label: 'Ducha', description: 'Coluna de ducha', family: 'banheiro', aspectWidth: 0.38, depthRatio: 0.28, keywords: ['ducha', 'chuveiro', 'banheiro'] },
  { type: 'vaso_sanitario', label: 'Vaso sanitário', description: 'Bacia sanitária', family: 'banheiro', aspectWidth: 0.55, depthRatio: 0.55, keywords: ['vaso', 'sanitário', 'bacia', 'banheiro'] },
  { type: 'lixeira_banheiro', label: 'Lixeira', description: 'Lixeira de banheiro', family: 'banheiro', aspectWidth: 0.38, depthRatio: 0.38, keywords: ['lixeira', 'banheiro'] },
  { type: 'papeleira', label: 'Papeleira', description: 'Suporte de papel higiênico', family: 'banheiro', aspectWidth: 0.32, depthRatio: 0.18, keywords: ['papeleira', 'papel', 'banheiro'] },

  // —— Cozinha: mesas e marcenaria extra ——
  { type: 'mesa_cozinha', label: 'Mesa de cozinha', description: 'Mesa retangular 4 lugares', family: 'cozinha', aspectWidth: 1.45, depthRatio: 0.68, keywords: ['mesa', 'cozinha', 'jantar', '4 lugares'] },
  { type: 'mesa_cozinha_redonda', label: 'Mesa cozinha redonda', description: 'Mesa circular de cozinha', family: 'cozinha', aspectWidth: 1.15, depthRatio: 0.7, keywords: ['mesa', 'cozinha', 'redonda'] },
  { type: 'mesa_cozinha_quadrada', label: 'Mesa cozinha quadrada', description: 'Mesa quadrada compacta', family: 'cozinha', aspectWidth: 1.1, depthRatio: 0.7, keywords: ['mesa', 'cozinha', 'quadrada'] },
  { type: 'mesa_cozinha_extensivel', label: 'Mesa extensível', description: 'Mesa com tampo que abre', family: 'cozinha', aspectWidth: 1.7, depthRatio: 0.68, keywords: ['mesa', 'cozinha', 'extensível', 'extensivel'] },
  { type: 'mesa_cozinha_vidro', label: 'Mesa cozinha vidro', description: 'Tampo de vidro na cozinha', family: 'cozinha', aspectWidth: 1.45, depthRatio: 0.68, keywords: ['mesa', 'cozinha', 'vidro'] },
  { type: 'mesa_cozinha_6lugares', label: 'Mesa cozinha 6 lugares', description: 'Mesa alongada para 6', family: 'cozinha', aspectWidth: 1.85, depthRatio: 0.7, keywords: ['mesa', 'cozinha', '6 lugares'] },
  { type: 'mesa_bistro', label: 'Mesa bistrô', description: 'Mesa alta de cozinha', family: 'cozinha', aspectWidth: 0.72, depthRatio: 0.55, keywords: ['mesa', 'bistrô', 'bistro', 'alta', 'cozinha'] },
  { type: 'paneleiro', label: 'Paneleiro', description: 'Coluna para panelas', family: 'cozinha', aspectWidth: 0.62, depthRatio: 0.36, keywords: ['paneleiro', 'cozinha', 'armário'] },
  { type: 'adega', label: 'Adega', description: 'Adega climatizada / nicho de vinhos', family: 'cozinha', aspectWidth: 0.55, depthRatio: 0.32, keywords: ['adega', 'vinho', 'cozinha'] },
  { type: 'canto_cafe', label: 'Cantinho do café', description: 'Nicho com tampo para cafeteira', family: 'cozinha', aspectWidth: 0.95, depthRatio: 0.36, keywords: ['café', 'cafe', 'cantinho', 'cozinha'] },
  { type: 'aereo_canto', label: 'Aéreo de canto', description: 'Aéreo em L', family: 'aereo', aspectWidth: 1.15, depthRatio: 0.32, keywords: ['aéreo', 'canto', 'cozinha'] },
  { type: 'aereo_vidro', label: 'Aéreo com vidro', description: 'Aéreo com portas de vidro', family: 'aereo', aspectWidth: 1.3, depthRatio: 0.28, keywords: ['aéreo', 'vidro', 'cozinha', 'vitrine'] },
  { type: 'torre_geladeira', label: 'Torre da geladeira', description: 'Painel e nichos ao lado da geladeira', family: 'cozinha', aspectWidth: 0.72, depthRatio: 0.4, keywords: ['torre', 'geladeira', 'cozinha', 'painel'] },

  // —— Guarda-roupas e closet ——
  { type: 'guarda_roupa_2portas', label: 'Guarda-roupa 2 portas', description: 'Roupeiro compacto de 2 portas', family: 'guarda_roupa', aspectWidth: 0.72, depthRatio: 0.34, keywords: ['guarda-roupa', '2 portas', 'quarto'] },
  { type: 'guarda_roupa_4portas', label: 'Guarda-roupa 4 portas', description: 'Roupeiro largo de 4 portas', family: 'guarda_roupa', aspectWidth: 1.25, depthRatio: 0.34, keywords: ['guarda-roupa', '4 portas', 'casal'] },
  { type: 'guarda_roupa_espelho', label: 'Guarda-roupa com espelho', description: 'Portas com espelho', family: 'guarda_roupa', aspectWidth: 0.95, depthRatio: 0.34, keywords: ['guarda-roupa', 'espelho', 'quarto'] },
  { type: 'guarda_roupa_canto', label: 'Guarda-roupa de canto', description: 'Módulo em L no canto', family: 'guarda_roupa', aspectWidth: 1.05, depthRatio: 0.42, keywords: ['guarda-roupa', 'canto', 'L'] },
  { type: 'guarda_roupa_solteiro', label: 'Guarda-roupa solteiro', description: 'Estreito para quarto de solteiro', family: 'guarda_roupa', aspectWidth: 0.58, depthRatio: 0.32, keywords: ['guarda-roupa', 'solteiro', 'compacto'] },
  { type: 'guarda_roupa_vidro', label: 'Guarda-roupa vidro', description: 'Portas de vidro fosco', family: 'guarda_roupa', aspectWidth: 0.95, depthRatio: 0.34, keywords: ['guarda-roupa', 'vidro', 'vitrine'] },
  { type: 'guarda_roupa_aberto', label: 'Guarda-roupa aberto', description: 'Closet aberto com cabideiro', family: 'guarda_roupa', aspectWidth: 0.95, depthRatio: 0.32, keywords: ['guarda-roupa', 'aberto', 'cabideiro'] },
  { type: 'closet', label: 'Closet', description: 'Closet com nichos e cabideiro', family: 'guarda_roupa', aspectWidth: 1.35, depthRatio: 0.36, keywords: ['closet', 'guarda-roupa', 'quarto'] },
  { type: 'closet_ilha', label: 'Ilha de closet', description: 'Ilha central com gavetas', family: 'guarda_roupa', aspectWidth: 1.2, depthRatio: 0.55, keywords: ['closet', 'ilha', 'gaveta'] },

  // —— Mesas da casa ——
  { type: 'mesa_jantar_oval', label: 'Mesa jantar oval', description: 'Tampo oval para 6', family: 'mesa', aspectWidth: 1.75, depthRatio: 0.68, keywords: ['mesa', 'jantar', 'oval', 'sala'] },
  { type: 'mesa_jantar_quadrada', label: 'Mesa jantar quadrada', description: 'Mesa quadrada de jantar', family: 'mesa', aspectWidth: 1.2, depthRatio: 0.7, keywords: ['mesa', 'jantar', 'quadrada'] },
  { type: 'mesa_jantar_6lugares', label: 'Mesa jantar 6 lugares', description: 'Retangular para 6 cadeiras', family: 'mesa', aspectWidth: 1.85, depthRatio: 0.7, keywords: ['mesa', 'jantar', '6 lugares'] },
  { type: 'mesa_jantar_8lugares', label: 'Mesa jantar 8 lugares', description: 'Mesa longa para 8', family: 'mesa', aspectWidth: 2.05, depthRatio: 0.7, keywords: ['mesa', 'jantar', '8 lugares'] },
  { type: 'mesa_jantar_vidro', label: 'Mesa jantar vidro', description: 'Tampo de vidro na sala', family: 'mesa', aspectWidth: 1.7, depthRatio: 0.7, keywords: ['mesa', 'jantar', 'vidro'] },
  { type: 'mesa_jantar_pedestal', label: 'Mesa pedestal', description: 'Pé central único', family: 'mesa', aspectWidth: 1.25, depthRatio: 0.7, keywords: ['mesa', 'pedestal', 'jantar'] },
  { type: 'mesa_centro_redonda', label: 'Mesa centro redonda', description: 'Mesa baixa circular', family: 'mesa', aspectWidth: 1.15, depthRatio: 0.55, keywords: ['mesa', 'centro', 'redonda', 'sala'] },
  { type: 'mesa_centro_vidro', label: 'Mesa centro vidro', description: 'Mesa de centro com vidro', family: 'mesa', aspectWidth: 1.35, depthRatio: 0.55, keywords: ['mesa', 'centro', 'vidro'] },
  { type: 'mesa_canto', label: 'Mesa de canto', description: 'Apoio triangular / canto', family: 'mesa', aspectWidth: 0.62, depthRatio: 0.5, keywords: ['mesa', 'canto', 'sala'] },
  { type: 'mesa_apoio', label: 'Mesa de apoio', description: 'Mesa baixa compacta', family: 'mesa', aspectWidth: 0.7, depthRatio: 0.48, keywords: ['mesa', 'apoio', 'sala'] },
  { type: 'mesa_bar', label: 'Mesa bar', description: 'Bancada alta de bar', family: 'mesa', aspectWidth: 1.4, depthRatio: 0.4, keywords: ['mesa', 'bar', 'bistrô', 'alta'] },
  { type: 'mesa_industrial', label: 'Mesa industrial', description: 'Tampo madeira e pés de metal', family: 'mesa', aspectWidth: 1.6, depthRatio: 0.68, keywords: ['mesa', 'industrial', 'metal'] },
  { type: 'mesa_dobravel', label: 'Mesa dobrável', description: 'Mesa que fecha na parede', family: 'mesa', aspectWidth: 1.2, depthRatio: 0.4, keywords: ['mesa', 'dobrável', 'dobravel', 'compacta'] },

  // —— Sofás e poltronas ——
  { type: 'sofa_4lugares', label: 'Sofá 4 lugares', description: 'Sofá longo de estar', family: 'sala', aspectWidth: 2.05, depthRatio: 0.55, keywords: ['sofá', 'sofa', '4 lugares', 'sala'] },
  { type: 'sofa_reclinavel', label: 'Sofá reclinável', description: 'Assento que reclina', family: 'sala', aspectWidth: 1.85, depthRatio: 0.62, keywords: ['sofá', 'reclinável', 'reclinavel'] },
  { type: 'sofa_cama', label: 'Sofá-cama', description: 'Sofá que vira cama', family: 'sala', aspectWidth: 1.8, depthRatio: 0.58, keywords: ['sofá', 'cama', 'hospede'] },
  { type: 'sofa_modular', label: 'Sofá modular', description: 'Módulos que se juntam', family: 'sala', aspectWidth: 1.95, depthRatio: 0.7, keywords: ['sofá', 'modular', 'sala'] },
  { type: 'sofa_namoradeira', label: 'Namoradeira', description: 'Sofá de 2 lugares estreito', family: 'sala', aspectWidth: 1.25, depthRatio: 0.52, keywords: ['namoradeira', 'sofá', '2 lugares'] },
  { type: 'sofa_canto_chaise', label: 'Sofá com chaise', description: 'Canto com chaise alongada', family: 'sala', aspectWidth: 1.85, depthRatio: 0.78, keywords: ['sofá', 'chaise', 'canto', 'L'] },
  { type: 'sofa_capitone', label: 'Sofá capitonê', description: 'Estofado com botões', family: 'sala', aspectWidth: 1.8, depthRatio: 0.55, keywords: ['sofá', 'capitonê', 'capitone', 'chesterfield'] },
  { type: 'poltrona_giro', label: 'Poltrona giratória', description: 'Poltrona que gira', family: 'sala', aspectWidth: 0.82, depthRatio: 0.7, keywords: ['poltrona', 'giro', 'sala'] },
  { type: 'poltrona_leitura', label: 'Poltrona de leitura', description: 'Poltrona alta com orelhas', family: 'sala', aspectWidth: 0.78, depthRatio: 0.72, keywords: ['poltrona', 'leitura', 'bergère'] },

  // —— Quarto: camas e cômodas ——
  { type: 'cama_solteiro', label: 'Cama de solteiro', description: 'Cama estreita 1 lugar', family: 'quarto', aspectWidth: 0.95, depthRatio: 0.55, keywords: ['cama', 'solteiro', 'quarto'] },
  { type: 'cama_casal', label: 'Cama de casal', description: 'Cama casal padrão', family: 'quarto', aspectWidth: 1.35, depthRatio: 0.58, keywords: ['cama', 'casal', 'quarto'] },
  { type: 'cama_queen', label: 'Cama queen', description: 'Cama queen size', family: 'quarto', aspectWidth: 1.5, depthRatio: 0.6, keywords: ['cama', 'queen', 'quarto'] },
  { type: 'cama_king', label: 'Cama king', description: 'Cama king size', family: 'quarto', aspectWidth: 1.7, depthRatio: 0.62, keywords: ['cama', 'king', 'quarto'] },
  { type: 'cama_beliche', label: 'Beliche', description: 'Duas camas empilhadas', family: 'quarto', aspectWidth: 1.05, depthRatio: 0.5, keywords: ['beliche', 'cama', 'infantil'] },
  { type: 'cama_bicama', label: 'Bicama', description: 'Cama com cama extra', family: 'quarto', aspectWidth: 1.15, depthRatio: 0.55, keywords: ['bicama', 'cama', 'hóspede'] },
  { type: 'cabeceira_estofada', label: 'Cabeceira estofada', description: 'Painel estofado', family: 'quarto', aspectWidth: 1.65, depthRatio: 0.12, keywords: ['cabeceira', 'estofada', 'quarto'] },
  { type: 'cabeceira_capitone', label: 'Cabeceira capitonê', description: 'Cabeceira com botões', family: 'quarto', aspectWidth: 1.65, depthRatio: 0.14, keywords: ['cabeceira', 'capitonê', 'quarto'] },
  { type: 'comoda_6gav', label: 'Cômoda 6 gavetas', description: 'Cômoda larga com 6 gavetas', family: 'quarto', aspectWidth: 1.45, depthRatio: 0.34, keywords: ['cômoda', 'comoda', 'gaveta', 'quarto'] },
  { type: 'berco', label: 'Berço', description: 'Berço infantil', family: 'quarto', aspectWidth: 1.15, depthRatio: 0.5, keywords: ['berço', 'berco', 'bebê', 'infantil'] },

  // —— Área de serviço e escritório ——
  { type: 'tanque', label: 'Tanque', description: 'Tanque de lavar', family: 'lavanderia', aspectWidth: 1.05, depthRatio: 0.42, keywords: ['tanque', 'lavanderia', 'serviço'] },
  { type: 'armario_lavanderia', label: 'Armário lavanderia', description: 'Armário aéreo/baixo de serviço', family: 'lavanderia', aspectWidth: 1.15, depthRatio: 0.32, keywords: ['armário', 'lavanderia', 'serviço'] },
  { type: 'cesto_roupa', label: 'Cesto de roupa', description: 'Cesto para roupa suja', family: 'lavanderia', aspectWidth: 0.55, depthRatio: 0.45, keywords: ['cesto', 'roupa', 'lavanderia'] },
  { type: 'tabua_passar', label: 'Tábua de passar', description: 'Tábua de passar roupa', family: 'lavanderia', aspectWidth: 1.35, depthRatio: 0.22, keywords: ['tábua', 'tabua', 'passar', 'lavanderia'] },
  { type: 'cadeira_escritorio', label: 'Cadeira de escritório', description: 'Cadeira com rodízio', family: 'sala', aspectWidth: 0.68, depthRatio: 0.62, keywords: ['cadeira', 'escritório', 'escritorio', 'home office'] },
  { type: 'arquivo', label: 'Arquivo', description: 'Gaveteiro de pasta', family: 'sala', aspectWidth: 0.55, depthRatio: 0.42, keywords: ['arquivo', 'gaveteiro', 'escritório'] },
];
