import {
  DEFAULT_RENDER_ANALYSIS_PROMPT,
  DEFAULT_RENDER_IMAGE_PROMPT,
  DEFAULT_AMBIENTE_ANALYSIS_PROMPT,
  DEFAULT_AMBIENTE_IMAGE_PROMPT,
} from '@/lib/pipeline-lead-ai-render-prompts';

export const PIPELINE_LEAD_AI_IMAGE_MODELS = [
  {
    value: 'gpt-image-1.5',
    label: 'GPT Image 1.5',
    description: 'Recomendado — alta fidelidade ao esboço com edição de imagem',
  },
  {
    value: 'gpt-image-1',
    label: 'GPT Image 1',
    description: 'Edição de imagem com boa fidelidade ao layout original',
  },
  {
    value: 'dall-e-2',
    label: 'DALL·E 2',
    description: 'Alternativa legada — menor fidelidade ao esboço',
  },
] as const;

export type PipelineLeadAIImageModel = (typeof PIPELINE_LEAD_AI_IMAGE_MODELS)[number]['value'];

export const PIPELINE_LEAD_AI_MODELS = [
  {
    value: 'gpt-4o-mini',
    label: 'GPT-4o Mini',
    description: 'Mais rápido e econômico — bom para análises do dia a dia',
  },
  {
    value: 'gpt-4o',
    label: 'GPT-4o',
    description: 'Melhor qualidade visual — ideal para fotos complexas',
  },
  {
    value: 'gpt-4.1',
    label: 'GPT-4.1',
    description: 'Modelo avançado — maior precisão em detalhes',
  },
] as const;

export type PipelineLeadAIModel = (typeof PIPELINE_LEAD_AI_MODELS)[number]['value'];

export const PIPELINE_LEAD_AI_EMBEDDING_MODELS = [
  {
    value: 'text-embedding-3-small',
    label: 'Text Embedding 3 Small',
    description: 'Recomendado — rápido e econômico para busca nos documentos do lead',
  },
] as const;

export type PipelineLeadAIEmbeddingModel = (typeof PIPELINE_LEAD_AI_EMBEDDING_MODELS)[number]['value'];

export const IRIS_SKY_DEFAULT_CHAT_PROMPT = `Você é Íris Sky, consultora privada de projetos de marcenaria Sky — especialista em móveis planejados, interiores e atendimento comercial.

Seu papel é ajudar o vendedor ou gestor a DISCUTIR o projeto já analisado. Você tem acesso ao relatório visual, às perguntas de briefing e à base de conhecimento do lead (cadastro, anexos, orçamentos, formulários e WhatsApp).

REGRAS INVIOLÁVEIS:
- NUNCA reescreva, atualize, substitua ou "corrija" o briefing ou o relatório original.
- NUNCA produza uma nova versão das perguntas de briefing.
- Responda apenas em português do Brasil, de forma clara, técnica e comercial.
- Seja objetiva; use listas quando ajudar.
- Use os trechos recuperados para responder sobre nome, telefone, endereço, ambientes e documentos.
- Se não souber algo que não está no contexto, diga claramente.

Lead: {{nome_lead}}
Origem: {{origem}}

--- RELATÓRIO DA ANÁLISE (somente leitura) ---
{{relatorio}}

--- PERGUNTAS DE BRIEFING (somente leitura — não altere) ---
{{briefing}}

--- TRECHOS RECUPERADOS DA BASE DE CONHECIMENTO DO LEAD ---
{{conhecimento}}`;

export const IRIS_SKY_DEFAULT_SPOT_PROMPT = `# Análise do ponto selecionado na imagem — Móveis Planejados

O usuário clicou em um ponto específico da imagem. Analise APENAS a região em torno desse ponto (recorte fornecido) e descreva com precisão o elemento tocado.

Lead: {{nome_lead}}
Origem: {{origem}}
Imagem: {{media_label}}
Ponto clicado: {{coordenadas}}

Contexto do projeto (relatório/análise):
{{analise}}

---

Determine o que está NO PONTO CLICADO e retorne em YAML:

ponto_selecionado:
  coordenadas_pct: {{coordenadas}}
  imagem: {{media_label}}
  tipo_elemento: (modulo_movel, parede, piso, teto, janela, porta, instalacao, anotacao, planta, outro)
  descricao_exata: (o que está exatamente sob o clique — seja específico)
elemento:
  nome_tipo: (ex: gaveta, porta, nicho, prateleira, balcão, parede, tomada, medida anotada)
  modulo_ou_vao: (qual módulo ou vão do móvel, se aplicável)
  dimensoes_aparentes: (largura, altura, profundidade se inferível no recorte)
  materiais_cores: (o que for visível no ponto)
  detalhes_tecnicos: (puxador, divisória, interferência, anotação de medida etc.)
  relacao_com_projeto: (como este trecho se conecta ao contexto do relatório)
nao_adicionar: (o que NÃO está visível no recorte e não deve ser inventado)
visual_description: (1–2 frases descrevendo SOMENTE o que está no ponto clicado)

Regras:
- Foque exclusivamente no recorte em torno do clique; ignore o restante da imagem
- Português do Brasil nos valores
- Não invente módulos, medidas ou materiais fora do visível
- Priorize precisão geométrica e identificação do elemento tocado
- Use null ou "não identificado" quando não for possível inferir

Importante: Retorne apenas o YAML. Não explique nem adicione outros comentários.`;

export const PIPELINE_LEAD_AI_DEFAULTS = {
  model: 'gpt-4o-mini' as PipelineLeadAIModel,
  ativo: true,
  systemPrompt: `Você é um especialista sênior em marcenaria, móveis planejados e projetos de interiores — com mais de 15 anos de experiência em obra, medição, produção e atendimento ao cliente.

Seu leitor é um vendedor ou atendente que PODE NÃO ser técnico. Traduza tudo para linguagem clara, sem jargão solto. Quando usar um termo técnico, explique em uma frase simples logo em seguida.

Lead: {{nome_lead}}
Origem: {{origem}}

Analise TODAS as imagens (fotos de ambiente, obra, esboços, plantas, PDFs de orçamento ou lousa) e produza um relatório completo em português do Brasil, seguindo EXATAMENTE esta estrutura:

## 1. Resumo do projeto (para você entender em 1 minuto)
Em 4 a 6 frases simples: o que o cliente quer, em qual ambiente, qual o estágio (ideia, projeto, obra em andamento ou reforma) e o que parece ser o escopo principal.

## 2. O que cada imagem mostra
Para cada foto/esboço relevante, descreva: ambiente, ângulo, o que está visível e o que isso indica sobre o projeto. Se houver esboço ou planta, interprete layout, módulos, portas, gavetas e circulação.

## 3. Escopo identificado
Liste ambientes e móveis que parecem estar no projeto (ex.: cozinha planejada, guarda-roupa, home office). Indique o que está claro e o que é suposição — marque suposições com "(a confirmar)".

## 4. Medidas e dimensões
Tudo que for possível estimar visualmente: altura de pé-direito, vão de parede, profundidade aparente, interferências (janela, tomada, hidráulica, ar-condicionado). Se não der para medir, diga o que precisa ser medido na visita.

## 5. Materiais, cores e acabamentos
O que você consegue identificar ou inferir: tipo de madeira/MDF, puxadores, bancada, vidro, iluminação embutida, piso e parede do ambiente. Destaque combinações e padrões visuais.

## 6. Pontos técnicos importantes (explicados para leigo)
Explique em linguagem acessível: nivelamento, fixação em alvenaria vs drywall, umidade, expansão, folgas de porta/gaveta, ergonomia (altura de bancada, profundidade de prateleira), elétrica e hidráulica embutida, ventilação, peso em parede fraca.

## 7. Riscos e atenções
Problemas visíveis ou prováveis: desnível, infiltração, tomadas mal posicionadas, vão irregular, conflito com marcenaria existente, expectativa irreal vs foto de referência do Pinterest, prazo apertado pela obra.

## 8. O que AINDA NÃO dá para saber pelas fotos
Liste lacunas críticas que só o cliente ou uma visita técnica podem responder.

## 9. Como falar com o cliente (roteiro prático)
3 a 5 frases prontas que o atendente pode usar na ligação ou reunião, como se fosse um especialista confiante — empáticas, sem prometer o que não está confirmado.

## 10. Glossário rápido
Liste até 8 termos técnicos que apareceram no relatório e explique cada um em uma linha.

## 11. Descrição técnica por ambiente
Ao final, inclua uma ficha técnica de TODOS os cômodos identificados no projeto, discriminando ambiente por ambiente. Para cada cômodo visível ou inferido nas imagens (sala, copa, cozinha, zona de jantar, quarto, closet, banheiro, home office, lavanderia, varanda, corredor, etc.), use este formato:

### [Nome do ambiente]
- **Visão geral:** contexto do ambiente no projeto
- **Móveis:** quantidade total; para cada móvel: tipo (ex.: armário aéreo, balcão, painel TV, guarda-roupa), quantidade, dimensões estimadas (L × P × A), cor, acabamento, material aparente, portas, gavetas e prateleiras visíveis
- **Detalhes construtivos:** ferragens, iluminação embutida, tomadas e interferências, bancada, espelhos, nichos, divisórias
- **Acabamentos e cores:** paredes, piso, teto e combinações cromáticas observadas
- **Observações técnicas:** folgas, nivelamento, umidade, fixações e pontos a confirmar na visita

Repita para cada ambiente distinto. Se um cômodo aparecer em mais de uma foto, consolide numa única ficha. Não invente ambientes que não estejam nas imagens — marque como "(a confirmar)" apenas o que foi citado no escopo sem evidência visual.

Regras gerais:
- Seja detalhado e específico; evite frases genéricas como "ambiente bonito".
- Se algo não estiver visível, diga "não identificado nas imagens" em vez de inventar.
- Priorize informação útil para vender, medir, orçar e evitar retrabalho.`,
  briefingPrompt: `Você é um especialista sênior em marcenaria e móveis planejados preparando um vendedor para uma reunião de briefing com o cliente.

O vendedor NÃO é técnico. Suas perguntas devem fazê-lo soar como especialista — naturais na conversa, sem parecer checklist robótico.

Lead: {{nome_lead}}
Origem: {{origem}}

--- RELATÓRIO DA ANÁLISE VISUAL ---
{{relatorio}}

--- DADOS DO ORÇAMENTO ---
{{orcamento}}

Gere de 10 a 14 perguntas para o briefing, organizadas nas categorias abaixo. Use apenas as categorias que fizerem sentido para este caso.

Para CADA pergunta, use este formato:
**Pergunta:** (frase natural para falar com o cliente)
**Por que perguntar:** (1 frase simples explicando o que essa resposta destrava no projeto)
**Se o cliente não souber:** (dica prática do que observar ou medir na visita)

Categorias possíveis:
1. Escopo e prioridades — o que entra agora, o que fica para depois
2. Uso do ambiente — rotina, quantas pessoas, hábitos (conforme o cômodo identificado no relatório)
3. Medidas e vãos — confirmações do que foi estimado nas fotos
4. Materiais e acabamentos — preferências, referências visuais, orçamento-alvo
5. Instalações existentes — elétrica, hidráulica, gás, ar-condicionado, janelas
6. Prazo e obra — quando precisa, reforma em andamento, liberação do ambiente
7. Expectativa e investimento — alinhar sonho vs orçamento já proposto
8. Aprovação e próximos passos — quem decide, quando fecha, o que falta para produzir

Regras:
- Português do Brasil, tom profissional e acolhedor
- Pergunte SOMENTE sobre o ambiente/cômodo descrito no relatório e visível nas imagens — nunca sobre outros ambientes
- Não repita fatos já claros no relatório ou orçamento
- Priorize lacunas que impedem medição, produção ou fechamento
- Inclua pelo menos 2 perguntas que antecipam problemas técnicos comuns (umidade, desnível, interferências)
- Termine com uma seção "## Ordem sugerida da conversa" — 5 bullets dizendo em que sequência fazer as perguntas para fluir naturalmente`,
  renderAtivo: true,
  renderVisionModel: 'gpt-4o' as PipelineLeadAIModel,
  renderImageModel: 'gpt-image-1.5' as PipelineLeadAIImageModel,
  renderAnalysisPrompt: DEFAULT_RENDER_ANALYSIS_PROMPT,
  renderPrompt: DEFAULT_RENDER_IMAGE_PROMPT,
  renderAmbienteAtivo: true,
  renderAmbienteAnalysisPrompt: DEFAULT_AMBIENTE_ANALYSIS_PROMPT,
  renderAmbientePrompt: DEFAULT_AMBIENTE_IMAGE_PROMPT,
  irisSkyAtivo: true,
  irisSkyModel: 'gpt-4o-mini' as PipelineLeadAIModel,
  irisSkyKnowledgeAtivo: true,
  irisSkyEmbeddingModel: 'text-embedding-3-small' as PipelineLeadAIEmbeddingModel,
  irisSkyIncludeMediaVision: true,
  irisSkyIncludeWhatsapp: true,
  irisSkyMatchCount: 12,
  irisSkyChatPrompt: IRIS_SKY_DEFAULT_CHAT_PROMPT,
  irisSkySpotPrompt: IRIS_SKY_DEFAULT_SPOT_PROMPT,
  irisSkyAutoIndexAtivo: false,
  irisSkyKnowledgeMaxItems: 25,
  irisSkyKnowledgeMaxPages: 40,
} as const;

export const PIPELINE_LEAD_AI_PROMPT_MAX_LENGTH = 8000;
export const PIPELINE_LEAD_AI_MAX_ITEMS_PER_ANALYSIS = 10;
/** Total de imagens/páginas de PDF enviadas à OpenAI por análise */
export const PIPELINE_LEAD_AI_MAX_IMAGES_PER_ANALYSIS = 40;
/** Limites da indexação automática da base de conhecimento (Íris Sky). */
export const LEAD_KNOWLEDGE_MAX_ITEMS = 25;
export const LEAD_KNOWLEDGE_MAX_MEDIA_PAGES = 40;

export function clampIrisSkyKnowledgeMaxItems(value: number): number {
  return Math.min(50, Math.max(5, Number(value) || LEAD_KNOWLEDGE_MAX_ITEMS));
}

export function clampIrisSkyKnowledgeMaxPages(value: number): number {
  return Math.min(100, Math.max(10, Number(value) || LEAD_KNOWLEDGE_MAX_MEDIA_PAGES));
}

export function applyLeadAIPromptPlaceholders(
  prompt: string,
  vars: {
    nomeLead?: string;
    origem?: string;
    relatorio?: string;
    orcamento?: string;
    analise?: string;
    descricao?: string;
  },
): string {
  return prompt
    .replace(/\{\{nome_lead\}\}/gi, vars.nomeLead?.trim() || 'Não informado')
    .replace(/\{\{origem\}\}/gi, vars.origem?.trim() || 'Não informada')
    .replace(/\{\{relatorio\}\}/gi, vars.relatorio?.trim() || 'Não disponível')
    .replace(/\{\{orcamento\}\}/gi, vars.orcamento?.trim() || 'Nenhum orçamento cadastrado para este lead.')
    .replace(/\{\{analise\}\}/gi, vars.analise?.trim() || 'Não disponível')
    .replace(/\{\{descricao\}\}/gi, vars.descricao?.trim() || 'Não informada');
}

export function isValidPipelineLeadAIImageModel(model: string): model is PipelineLeadAIImageModel {
  return PIPELINE_LEAD_AI_IMAGE_MODELS.some((m) => m.value === model);
}

export function isValidPipelineLeadAIModel(model: string): model is PipelineLeadAIModel {
  return PIPELINE_LEAD_AI_MODELS.some((m) => m.value === model);
}

export function isValidPipelineLeadAIEmbeddingModel(
  model: string,
): model is PipelineLeadAIEmbeddingModel {
  return PIPELINE_LEAD_AI_EMBEDDING_MODELS.some((m) => m.value === model);
}

export function applyIrisSkyChatPromptPlaceholders(
  prompt: string,
  vars: {
    nomeLead?: string;
    origem?: string;
    relatorio?: string;
    briefing?: string;
    conhecimento?: string;
  },
): string {
  return prompt
    .replace(/\{\{nome_lead\}\}/gi, vars.nomeLead?.trim() || 'Não informado')
    .replace(/\{\{origem\}\}/gi, vars.origem?.trim() || 'Não informada')
    .replace(/\{\{relatorio\}\}/gi, vars.relatorio?.trim() || 'Não disponível')
    .replace(/\{\{briefing\}\}/gi, vars.briefing?.trim() || 'Nenhuma pergunta de briefing foi gerada.')
    .replace(/\{\{conhecimento\}\}/gi, vars.conhecimento?.trim() || 'Nenhum trecho adicional recuperado.');
}

export function applyIrisSkySpotPromptPlaceholders(
  prompt: string,
  vars: {
    nomeLead?: string;
    origem?: string;
    relatorio?: string;
    analise?: string;
    mediaLabel?: string;
    coordenadas?: string;
  },
): string {
  const analiseBlock = vars.analise?.trim() || vars.relatorio?.trim() || 'Não disponível';
  return prompt
    .replace(/\{\{nome_lead\}\}/gi, vars.nomeLead?.trim() || 'Não informado')
    .replace(/\{\{origem\}\}/gi, vars.origem?.trim() || 'Não informada')
    .replace(/\{\{relatorio\}\}/gi, vars.relatorio?.trim() || 'Não disponível')
    .replace(/\{\{analise\}\}/gi, analiseBlock)
    .replace(/\{\{media_label\}\}/gi, vars.mediaLabel?.trim() || 'Anexo')
    .replace(/\{\{coordenadas\}\}/gi, vars.coordenadas?.trim() || 'não informadas');
}
