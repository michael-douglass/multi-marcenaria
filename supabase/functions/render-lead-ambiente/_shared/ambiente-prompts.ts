export const DEFAULT_AMBIENTE_ANALYSIS_PROMPT = `# Análise de ambiente — composição de cena

Desmembre a descrição do vendedor e, se houver foto, o que ela mostra. Monte um inventário YAML para COMPOR o ambiente (não um móvel isolado em estúdio).

Lead: {{nome_lead}}
Origem: {{origem}}

Descrição do vendedor:
{{descricao}}

Retorne APENAS este YAML:

tipo: composicao_ambiente
ambiente:
  comodo: (sala, cozinha, quarto, banheiro, home office, varanda, hall ou outro)
  estilo: (contemporâneo, minimalista, clássico, industrial, rústico, escandinavo etc.)
  clima: (acolhedor, sofisticado, claro, íntimo etc.)
  iluminacao: (natural, pendentes, spots, abajur, mista — descreva origem e temperatura)
  revestimentos:
    piso: (material e tom)
    parede: (cor, textura, painel, revestimento)
    teto: (simples, sanca, madeira)
paleta:
  - hex: (código se identificável; senão null)
    name: (nome descritivo)
    elemento: (parede, piso, móvel, tecido, metal)
objetos_sugeridos:
  - id: (slug curto, ex: sofa-linho)
    nome: (rótulo curto para o vendedor clicar)
    categoria: (movel | iluminacao | decoracao | revestimento | outro)
    tipo_modulo: (id do catálogo se houver correspondência clara: cama, puff, comoda, rack, painel_tv, bancada, luminaria_chao, abajur, cristaleira, guarda_roupa, armario_cozinha, geladeira, espelho_retangular; senão null)
    posicao_sugerida: (primeiro plano, parede esquerda, centro, canto direito etc.)
    justificativa: (1 frase do porquê entra nesta cena)
nao_adicionar: (o que NÃO foi pedido nem aparece na foto — não inventar)
visual_description: (2–3 frases da cena completa, como um diretor de arte)

Regras:
- Português do Brasil
- Liste 4 a 10 objetos úteis para o vendedor posicionar na composição
- Não invente cômodos, janelas ou móveis que a descrição/foto não sustentem
- Se só houver texto, extraia o máximo da descrição; se houver foto, priorize o que está visível e complete com o texto
- Use null ou "não identificado" quando não der para inferir
- Retorne apenas o YAML`;

export const DEFAULT_AMBIENTE_IMAGE_PROMPT = `Você está COMPONDO um ambiente de interiores fotorrealista a partir da montagem fornecida (foto de fundo + objetos/imagens posicionados) e do inventário YAML.

Lead: {{nome_lead}}
Origem: {{origem}}

Descrição do vendedor:
{{descricao}}

Inventário YAML do ambiente:
{{analise}}

REGRAS INVIOLÁVEIS:
- Transforme a montagem em uma FOTO de ambiente realista (não um móvel isolado em estúdio)
- Preserve o ângulo de câmera e a perspectiva da imagem de entrada
- Integre os objetos e imagens posicionados na cena com escala, luz e sombra coerentes
- Use a paleta, o estilo e a iluminação do YAML
- Materiais de marcenaria com textura realista (madeira, laca, MDF, vidro, tecido)
- NÃO ignore objetos que o vendedor posicionou na montagem
- NÃO adicione pessoas, marcas, texto, logotipo ou itens listados em nao_adicionar
- NÃO esvazie o ambiente nem volte a um fundo de estúdio neutro
- Alta nitidez, iluminação de interiores, profundidade de campo suave

Se houver dúvida entre inventar decoração extra ou ficar fiel à montagem, escolha FIDELIDADE À MONTAGEM.`;

export function applyAmbientePromptPlaceholders(
  prompt: string,
  vars: {
    nomeLead?: string;
    origem?: string;
    analise?: string;
    descricao?: string;
  },
): string {
  return prompt
    .replace(/\{\{nome_lead\}\}/gi, vars.nomeLead?.trim() || 'Não informado')
    .replace(/\{\{origem\}\}/gi, vars.origem?.trim() || 'Não informada')
    .replace(/\{\{analise\}\}/gi, vars.analise?.trim() || 'Não disponível')
    .replace(/\{\{descricao\}\}/gi, vars.descricao?.trim() || 'Não informada');
}
