import type { BriefingPerguntaTipo } from '@/types'

export interface BriefingSeedPergunta {
  enunciado: string
  tipo: BriefingPerguntaTipo
  opcoes?: { id: string; label: string }[]
  obrigatoria?: boolean
  texto_ajuda?: string
  unidade_padrao?: string
}

export interface BriefingSeedModelo {
  nome: string
  descricao?: string
  ordem: number
  perguntas: BriefingSeedPergunta[]
}

function opts(...labels: string[]) {
  return labels.map(label => ({ id: label.toLowerCase().replace(/\s+/g, '_'), label }))
}

export const BRIEFING_SEED_MODELOS: BriefingSeedModelo[] = [
  {
    nome: 'Cozinha',
    descricao: 'Briefing para montagem de cozinha planejada',
    ordem: 1,
    perguntas: [
      { enunciado: 'Medidas gerais do ambiente (L x A x P)', tipo: 'numero', unidade_padrao: 'cm' },
      { enunciado: 'Tipo de layout', tipo: 'multipla_escolha', opcoes: opts('Em L', 'Reta', 'Paralela', 'Ilha', 'Península') },
      { enunciado: 'Possui forno embutido?', tipo: 'multipla_escolha', opcoes: opts('Sim', 'Não', 'Não se aplica') },
      { enunciado: 'Marca e modelo do forno', tipo: 'texto', texto_ajuda: 'Preencher se houver forno embutido' },
      { enunciado: 'Dimensões do nicho do forno (A x L x P)', tipo: 'numero', unidade_padrao: 'cm' },
      { enunciado: 'Possui cooktop ou fogão?', tipo: 'multipla_escolha', opcoes: opts('Sim cooktop', 'Sim fogão convencional', 'Não') },
      { enunciado: 'Medidas do cooktop/fogão', tipo: 'numero', unidade_padrao: 'cm' },
      { enunciado: 'Possui coifa? Descreva o tipo', tipo: 'texto', texto_ajuda: 'Parede, ilha, depurador...' },
      { enunciado: 'Tipo de coifa', tipo: 'multipla_escolha', opcoes: opts('Parede', 'Ilha', 'Depurador', 'Não possui') },
      { enunciado: 'Possui lava-louças?', tipo: 'multipla_escolha', opcoes: opts('Sim', 'Não') },
      { enunciado: 'Medidas do nicho lava-louças', tipo: 'numero', unidade_padrao: 'cm' },
      { enunciado: 'Possui micro-ondas embutido?', tipo: 'texto' },
      { enunciado: 'Medidas do nicho micro-ondas', tipo: 'numero', unidade_padrao: 'cm' },
      { enunciado: 'Tipo de geladeira', tipo: 'multipla_escolha', opcoes: opts('Duplex', 'French door', 'Side by side', 'Embutida', 'Não se aplica') },
      { enunciado: 'Medidas da geladeira (A x L x P)', tipo: 'numero', unidade_padrao: 'cm' },
      { enunciado: 'Tomadas e pontos de água/esgoto nos locais corretos?', tipo: 'multipla_escolha', opcoes: opts('Sim', 'Não', 'Parcialmente') },
      { enunciado: 'Observações sobre instalações', tipo: 'texto' },
      { enunciado: 'Tipo de piso e estado (nivelado?)', tipo: 'texto' },
      { enunciado: 'Fotos gerais do ambiente', tipo: 'fotos' },
      { enunciado: 'Planta ou croqui do ambiente', tipo: 'pdf' },
      { enunciado: 'Croqui desenhado', tipo: 'desenho' },
      { enunciado: 'Vídeo walkthrough do ambiente', tipo: 'videos' },
    ],
  },
  {
    nome: 'Sala',
    ordem: 2,
    perguntas: [
      { enunciado: 'Medidas do ambiente', tipo: 'numero', unidade_padrao: 'cm' },
      { enunciado: 'Possui TV?', tipo: 'multipla_escolha', opcoes: opts('Sim', 'Não') },
      { enunciado: 'Tamanho da TV (polegadas)', tipo: 'numero', unidade_padrao: 'pol' },
      { enunciado: 'Tipo de fixação da TV', tipo: 'multipla_escolha', opcoes: opts('Painel', 'Suporte articulado', 'Rack', 'Embutida') },
      { enunciado: 'Altura desejada do centro da TV', tipo: 'numero', unidade_padrao: 'cm' },
      { enunciado: 'Pontos de tomada e passagem de cabos', tipo: 'texto' },
      { enunciado: 'Possui home theater / soundbar?', tipo: 'texto' },
      { enunciado: 'Possui lareira ou painel decorativo?', tipo: 'texto' },
      { enunciado: 'Tipo de piso', tipo: 'texto' },
      { enunciado: 'Tipo de parede', tipo: 'multipla_escolha', opcoes: opts('Drywall', 'Alvenaria', 'Ripado', 'Mista') },
      { enunciado: 'Fotos do ambiente', tipo: 'fotos' },
      { enunciado: 'Croqui com posição dos móveis', tipo: 'desenho' },
      { enunciado: 'Observações gerais', tipo: 'texto' },
    ],
  },
  {
    nome: 'Copa',
    ordem: 3,
    perguntas: [
      { enunciado: 'Medidas do ambiente', tipo: 'numero', unidade_padrao: 'cm' },
      { enunciado: 'Mesa fixa ou extensível? Descreva', tipo: 'texto' },
      { enunciado: 'Dimensões da mesa', tipo: 'numero', unidade_padrao: 'cm' },
      { enunciado: 'Quantidade de cadeiras', tipo: 'numero' },
      { enunciado: 'Possui cristaleira ou buffet?', tipo: 'texto' },
      { enunciado: 'Pontos de tomada', tipo: 'texto' },
      { enunciado: 'Tipo de piso', tipo: 'texto' },
      { enunciado: 'Iluminação (pendente, spot, trilho)', tipo: 'texto' },
      { enunciado: 'Fotos', tipo: 'fotos' },
      { enunciado: 'Croqui', tipo: 'desenho' },
      { enunciado: 'Observações', tipo: 'texto' },
    ],
  },
  {
    nome: 'Lavanderia',
    ordem: 4,
    perguntas: [
      { enunciado: 'Medidas do ambiente', tipo: 'numero', unidade_padrao: 'cm' },
      { enunciado: 'Máquina de lavar: tipo', tipo: 'multipla_escolha', opcoes: opts('Frontal', 'Top', 'Não possui') },
      { enunciado: 'Medidas máquina de lavar', tipo: 'numero', unidade_padrao: 'cm' },
      { enunciado: 'Possui secadora?', tipo: 'multipla_escolha', opcoes: opts('Sim', 'Não') },
      { enunciado: 'Medidas secadora', tipo: 'numero', unidade_padrao: 'cm' },
      { enunciado: 'Tanque: material e medidas', tipo: 'texto' },
      { enunciado: 'Medidas do tanque', tipo: 'numero', unidade_padrao: 'cm' },
      { enunciado: 'Local de passar roupa', tipo: 'texto' },
      { enunciado: 'Pontos de água, esgoto e tomada', tipo: 'texto' },
      { enunciado: 'Ventilação / exaustão', tipo: 'texto' },
      { enunciado: 'Altura do pé-direito (armários altos)', tipo: 'numero', unidade_padrao: 'cm' },
      { enunciado: 'Tipo de piso (nivelado, impermeável)', tipo: 'texto' },
      { enunciado: 'Fotos', tipo: 'fotos' },
      { enunciado: 'Vídeo', tipo: 'videos' },
      { enunciado: 'Croqui com posição dos eletrodomésticos', tipo: 'desenho' },
      { enunciado: 'Observações', tipo: 'texto' },
    ],
  },
  {
    nome: 'Quarto / Suíte',
    ordem: 5,
    perguntas: [
      { enunciado: 'Medidas do ambiente', tipo: 'numero', unidade_padrao: 'cm' },
      { enunciado: 'Tamanho da cama', tipo: 'multipla_escolha', opcoes: opts('Solteiro', 'Casal', 'Queen', 'King') },
      { enunciado: 'Cabeceira: fixa ou modular?', tipo: 'texto' },
      { enunciado: 'Possui TV? Tamanho e posição', tipo: 'texto' },
      { enunciado: 'Tamanho da TV (polegadas)', tipo: 'numero', unidade_padrao: 'pol' },
      { enunciado: 'Ar-condicionado: posição da evaporadora', tipo: 'texto' },
      { enunciado: 'Tomadas e interruptores', tipo: 'texto' },
      { enunciado: 'Tipo de piso e rodapé', tipo: 'texto' },
      { enunciado: 'Janela: tipo e interfere na montagem?', tipo: 'texto' },
      { enunciado: 'Closet integrado ou separado?', tipo: 'multipla_escolha', opcoes: opts('Integrado', 'Separado', 'Não possui') },
      { enunciado: 'Fotos', tipo: 'fotos' },
      { enunciado: 'Croqui', tipo: 'desenho' },
      { enunciado: 'Observações', tipo: 'texto' },
    ],
  },
  {
    nome: 'Banheiro',
    ordem: 6,
    perguntas: [
      { enunciado: 'Medidas do ambiente', tipo: 'numero', unidade_padrao: 'cm' },
      { enunciado: 'Box: tipo e medidas', tipo: 'texto' },
      { enunciado: 'Medidas do box', tipo: 'numero', unidade_padrao: 'cm' },
      { enunciado: 'Nicho ou prateleiras?', tipo: 'texto' },
      { enunciado: 'Espelho: dimensões e iluminação', tipo: 'texto' },
      { enunciado: 'Medidas do espelho', tipo: 'numero', unidade_padrao: 'cm' },
      { enunciado: 'Torneiras e pontos hidráulicos', tipo: 'texto' },
      { enunciado: 'Ventilação', tipo: 'texto' },
      { enunciado: 'Piso e umidade', tipo: 'texto' },
      { enunciado: 'Fotos', tipo: 'fotos' },
      { enunciado: 'Croqui', tipo: 'desenho' },
      { enunciado: 'Observações', tipo: 'texto' },
    ],
  },
  {
    nome: 'Escritório / Home Office',
    ordem: 7,
    perguntas: [
      { enunciado: 'Medidas do ambiente', tipo: 'numero', unidade_padrao: 'cm' },
      { enunciado: 'Mesa: largura', tipo: 'numero', unidade_padrao: 'cm' },
      { enunciado: 'Mesa: altura', tipo: 'numero', unidade_padrao: 'cm' },
      { enunciado: 'Gavetas e passagem de cabos', tipo: 'texto' },
      { enunciado: 'Prateleiras e nichos', tipo: 'texto' },
      { enunciado: 'Tomadas e rede', tipo: 'texto' },
      { enunciado: 'Iluminação', tipo: 'texto' },
      { enunciado: 'Fotos', tipo: 'fotos' },
      { enunciado: 'Croqui', tipo: 'desenho' },
      { enunciado: 'Observações', tipo: 'texto' },
    ],
  },
  {
    nome: 'Closet',
    ordem: 8,
    perguntas: [
      { enunciado: 'Medidas internas', tipo: 'numero', unidade_padrao: 'cm' },
      { enunciado: 'Tipo de portas', tipo: 'multipla_escolha', opcoes: opts('Correr', 'Abrir', 'Ripada', 'Mista') },
      { enunciado: 'Altura do pé-direito', tipo: 'numero', unidade_padrao: 'cm' },
      { enunciado: 'Iluminação interna', tipo: 'texto' },
      { enunciado: 'Itens desejados', tipo: 'multipla_escolha', opcoes: opts('Cabideiros', 'Prateleiras', 'Gaveteiros', 'Sapateira', 'Espelho') },
      { enunciado: 'Espelho? Dimensões', tipo: 'texto' },
      { enunciado: 'Medidas do espelho', tipo: 'numero', unidade_padrao: 'cm' },
      { enunciado: 'Fotos', tipo: 'fotos' },
      { enunciado: 'Croqui com medidas', tipo: 'desenho' },
      { enunciado: 'Observações', tipo: 'texto' },
    ],
  },
  {
    nome: 'Varanda / Área Gourmet',
    ordem: 9,
    perguntas: [
      { enunciado: 'Medidas do ambiente', tipo: 'numero', unidade_padrao: 'cm' },
      { enunciado: 'Exposição ao sol e chuva', tipo: 'texto' },
      { enunciado: 'Churrasqueira / fogão cooktop externo?', tipo: 'texto' },
      { enunciado: 'Pia e ponto de água', tipo: 'texto' },
      { enunciado: 'Material dos móveis (MDF, MDP, freijó)', tipo: 'texto' },
      { enunciado: 'Tomadas', tipo: 'texto' },
      { enunciado: 'Fotos', tipo: 'fotos' },
      { enunciado: 'Vídeo', tipo: 'videos' },
      { enunciado: 'Croqui', tipo: 'desenho' },
      { enunciado: 'Observações', tipo: 'texto' },
    ],
  },
  {
    nome: 'Despensa',
    ordem: 10,
    perguntas: [
      { enunciado: 'Medidas do ambiente', tipo: 'numero', unidade_padrao: 'cm' },
      { enunciado: 'Quantidade de prateleiras', tipo: 'numero' },
      { enunciado: 'Altura entre níveis das prateleiras', tipo: 'numero', unidade_padrao: 'cm' },
      { enunciado: 'Porta: abertura e interferência', tipo: 'texto' },
      { enunciado: 'Ventilação', tipo: 'texto' },
      { enunciado: 'Fotos', tipo: 'fotos' },
      { enunciado: 'Croqui', tipo: 'desenho' },
      { enunciado: 'Observações', tipo: 'texto' },
    ],
  },
  {
    nome: 'Hall / Corredor',
    ordem: 11,
    perguntas: [
      { enunciado: 'Medidas do ambiente', tipo: 'numero', unidade_padrao: 'cm' },
      { enunciado: 'Armário embutido ou sapateira?', tipo: 'texto' },
      { enunciado: 'Espelho?', tipo: 'texto' },
      { enunciado: 'Interferência de portas', tipo: 'texto' },
      { enunciado: 'Fotos', tipo: 'fotos' },
      { enunciado: 'Croqui', tipo: 'desenho' },
      { enunciado: 'Observações', tipo: 'texto' },
    ],
  },
  {
    nome: 'Garagem / Depósito',
    ordem: 12,
    perguntas: [
      { enunciado: 'Medidas do ambiente', tipo: 'numero', unidade_padrao: 'cm' },
      { enunciado: 'Umidade e ventilação', tipo: 'texto' },
      { enunciado: 'Fixação em parede de alvenaria ou drywall', tipo: 'texto' },
      { enunciado: 'Fotos', tipo: 'fotos' },
      { enunciado: 'Croqui', tipo: 'desenho' },
      { enunciado: 'Observações', tipo: 'texto' },
    ],
  },
]
