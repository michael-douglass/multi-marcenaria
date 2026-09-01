export const DEFAULT_RENDER_ANALYSIS_PROMPT = `# Instruções de Análise de Imagem — Móveis Planejados

Analise a imagem fornecida e determine se ela retrata principalmente:
- esboco_projeto (desenho à mão, lousa, planta técnica ou croqui)
- movel_fotografado (foto real do móvel pronto ou em produção)
- referencia_ambiente (ambiente decorado onde o móvel não é o foco principal)
- AMBOS (esboço e móvel/referência relevantes na mesma imagem)

Lead: {{nome_lead}}
Origem: {{origem}}

---

## Se for esboco_projeto, retorne em YAML:

tipo_imagem: esboco_projeto
movel:
  nome_tipo: (ex: armário aéreo, balcão, guarda-roupa, estante)
  comodo_provavel: (cozinha, quarto, sala, banheiro, escritório ou não identificado)
  vista: (frontal, perspectiva, lateral, superior ou mista)
layout:
  silhueta: (formato externo e proporção largura × altura × profundidade aparente)
  angulo_camera: (descreva o ângulo exato da imagem)
  modulos:
    - posicao: 1
      tipo: (gaveta, porta, nicho, prateleira, vão aberto)
      largura_relativa_pct: (número)
      detalhes: (puxador, divisória, vidro etc., se visível)
  elementos_fixos: (rodapé, tampo, tamponamento, sanca, puxadores)
color_scheme:
  - hex: (código hex se identificável no traço; senão null)
    name: (nome descritivo da cor)
    uso: (corpo, frente, tamponamento, tampo)
materiais_aparentes: (apenas se indicados no desenho; senão "não indicado")
nao_adicionar: (lista explícita do que NÃO está no desenho e não deve ser inventado)
visual_description: (1–2 frases do móvel desenhado, ignorando o plano de fundo)

---

## Se for movel_fotografado, retorne em YAML:

tipo_imagem: movel_fotografado
movel:
  nome_tipo: (tipo do móvel)
  estilo: (moderno, clássico, minimalista, industrial etc.)
  vista: (frontal, perspectiva, lateral)
layout:
  silhueta: (formato e proporções gerais)
  modulos:
    - posicao: 1
      tipo: (gaveta, porta, nicho, prateleira)
      largura_relativa_pct: (número)
      detalhes: (acabamentos visíveis)
color_scheme:
  - hex: (código hex de cada cor predominante no móvel)
    name: (nome descritivo da cor)
    superficie: (frente, lateral, tamponamento, tampo)
materiais_acabamento: (madeira, laca, MDF, vidro, espelho etc.)
hardware: (puxadores, dobradiças, perfis — se visíveis)
visual_description: (1–2 frases do móvel, ignorando o plano de fundo)

---

## Se for referencia_ambiente, retorne em YAML:

tipo_imagem: referencia_ambiente
ambiente:
  comodo: (tipo de cômodo)
  estilo_decoracao: (descrição breve do ambiente)
movel_destaque:
  nome_tipo: (móvel principal visível, se houver)
  posicao_no_ambiente: (onde está na foto)
color_scheme:
  - hex: (cor predominante no ambiente ou móvel)
    name: (nome descritivo)
    elemento: (parede, piso, móvel, tecido)
visual_description: (1–2 frases do ambiente e do móvel em destaque)

---

## Se for AMBOS:

Retorne um único YAML com as seções aplicáveis (esboco_projeto e/ou movel_fotografado), cada uma preenchida conforme os modelos acima.

---

Regras gerais:
- Português do Brasil nos valores descritivos
- Conte módulos com precisão; não invente gavetas, portas ou prateleiras extras
- Priorize precisão geométrica sobre estética
- Use null ou "não identificado" quando não for possível inferir com segurança

Importante: Retorne apenas o YAML. Não explique nem adicione outros comentários.`;

export const DEFAULT_RENDER_IMAGE_PROMPT = `Você está EDITANDO o esboço fornecido — não criando um móvel novo.

Transforme APENAS os traços do desenho em acabamento fotorrealista (madeira, laca ou MDF), mantendo geometria idêntica à imagem de entrada.

REGRAS INVIOLÁVEIS (prioridade máxima):
- Siga o layout, módulos e proporções descritos no inventário YAML abaixo
- Mesma quantidade de módulos, portas, gavetas e prateleiras do esboço
- Mesmas proporções, alinhamentos e espaçamentos entre módulos
- Mesmo ângulo de câmera e perspectiva da imagem original
- Respeite as cores e materiais do color_scheme quando definidos; caso contrário use acabamento neutro e elegante
- NÃO adicionar móveis, pessoas, plantas, decoração ou ambientes
- NÃO remover, mover ou fundir módulos existentes
- NÃO alterar larguras relativas entre elementos
- NÃO adicionar itens listados em nao_adicionar
- Fundo neutro de estúdio (cinza claro ou branco) apenas atrás do móvel
- Texturas realistas, iluminação de catálogo, alta nitidez

Se houver dúvida entre ficar fiel ao esboço ou ficar bonito, escolha FIDELIDADE.

Inventário YAML do esboço:
{{analise}}

{{caracteristicas}}`;

export const DEFAULT_AMBIENTE_ANALYSIS_PROMPT = `# Análise de ambiente — composição de cena

Desmembre a descrição do vendedor e, se houver imagem, o que ela mostra. A imagem pode ser a lousa montada (desenhos + fotos de móveis posicionados + foto do cômodo). Monte um inventário YAML para COMPOR o ambiente (não um móvel isolado em estúdio).

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
moveis_na_cena:
  - id: (slug curto)
    fonte: (foto_projeto | icone_catalogo | desenho | marcador)
    nome: (rótulo da peça visível na lousa)
    posicao: (onde está na imagem)
    geometria: (módulos, portas, gavetas, silhueta e proporções — copiar o que está visível)
    materiais: (madeira, laca, tecido etc. se identificáveis)
    regra: reproduzir_identico
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
- Se a imagem mostrar a lousa, preencha moveis_na_cena com TODAS as peças já posicionadas ou desenhadas — sem inventar variação
- Liste 4 a 10 objetos_sugeridos úteis extras; eles NÃO substituem as peças já na cena
- Não invente cômodos, janelas ou móveis que a descrição/foto não sustentem
- Se só houver texto, extraia o máximo da descrição; se houver imagem, priorize o que está visível e complete com o texto
- Use null ou "não identificado" quando não der para inferir
- Retorne apenas o YAML`;

/** Inventário na hora de gerar: lê a lousa + descrição e trava cada móvel. */
export const DEFAULT_AMBIENTE_SCENE_INVENTORY_PROMPT = `# Inventário da cena montada — fidelidade do móvel

Você está LENDO a montagem que o vendedor fez na lousa (desenhos + fotos de móveis posicionados + foto do cômodo) e a descrição do ambiente. Não crie um móvel novo.

Lead: {{nome_lead}}
Origem: {{origem}}

Descrição do vendedor (define o CÔMODO, não o desenho do móvel):
{{descricao}}

Inventário objetivo da lousa (fonte da verdade das peças):
{{cena_inventario}}

TAREFA 1 — DESENHOS E MÓVEIS DA LOUSA:
Liste CADA móvel visível (foto posicionada, ícone de catálogo ou desenho à mão). Copie geometria, módulos, materiais e posição. É proibido “melhorar” ou variar o produto.

TAREFA 2 — AMBIENTE DESCRITO:
Use a descrição para cômodo, luz, piso, paredes e clima. Isso NÃO autoriza redesenhar os móveis.

Retorne APENAS este YAML:

tipo: inventario_cena_ambiente
ambiente:
  comodo: (sala, cozinha, quarto, banheiro, home office, varanda, hall ou outro)
  estilo: (contemporâneo, minimalista, clássico, industrial, rústico, escandinavo etc.)
  clima: (acolhedor, sofisticado, claro, íntimo etc.)
  iluminacao: (natural, pendentes, spots, abajur, mista — origem e temperatura)
  revestimentos:
    piso: (material e tom)
    parede: (cor, textura, painel, revestimento)
    teto: (simples, sanca, madeira)
paleta:
  - hex: (código se identificável; senão null)
    name: (nome descritivo)
    elemento: (parede, piso, móvel, tecido, metal)
moveis_na_cena:
  - id: (slug curto)
    fonte: (foto_projeto | icone_catalogo | desenho | marcador)
    nome: (rótulo)
    posicao_na_imagem: (esquerda, centro, parede direita…)
    geometria: (silhueta, módulos, portas, gavetas, proporções — COPIAR o visível)
    materiais_acabamento: (se visíveis)
    cores: (se visíveis)
    regra_fidelidade: reproduzir_identico
nao_variar: (lista explícita: não mudar layout, não trocar madeira, não adicionar/remover portas ou gavetas)
nao_adicionar: (o que NÃO está na lousa nem na descrição)
visual_description: (2–3 frases da cena: cômodo descrito + móveis da lousa sem alteração)

Regras:
- Português do Brasil
- Fidelidade do móvel acima de estética
- Não invente cômodos, janelas ou peças que a lousa/descrição não sustentem
- Use null ou "não identificado" quando não der para inferir
- Retorne apenas o YAML`;

export const DEFAULT_AMBIENTE_IMAGE_PROMPT = `Você está EDITANDO a montagem da lousa para virar uma FOTO de ambiente realista — não está criando móveis novos.

Lead: {{nome_lead}}
Origem: {{origem}}

Descrição do vendedor (cômodo, luz, piso, paredes, clima):
{{descricao}}

Inventário YAML da cena (móveis + ambiente):
{{analise}}

Inventário da lousa montada pelo vendedor:
{{cena_inventario}}

A PRIMEIRA imagem é a montagem EXATA da lousa (foto do cômodo + fotos de móveis já recortadas e posicionadas). Preserve layout, proporção e cores pixel a pixel. Se houver imagens seguintes, cada uma é a FOTO FIEL de um móvel — use só para detalhe, sem recolorir o que já está na montagem.

FIDELIDADE DOS MÓVEIS (prioridade máxima — acima de estética):
- Cada móvel da montagem é o MESMO produto: mesmos módulos, portas, gavetas, puxadores, proporções, materiais e cores
- NÃO redesenhe, restilize, modernize, simplifique, recolorir ou “melhore” o móvel
- NÃO troque madeira, laca, vidro, tecido ou ferragens
- NÃO invente variação do projeto
- NÃO estique, esmague ou mude a posição das peças já encaixadas na foto
- Se a peça já está como foto na montagem, COPIE essa peça nas cores e no recorte visíveis — só integre luz e sombra no cômodo
- Se a peça está como desenho/ícone, transforme o traço em acabamento realista SEM alterar a geometria

AMBIENTE (da descrição + foto de fundo):
- Cômodo, piso, paredes, iluminação e clima vêm da descrição e da foto de fundo
- Transforme a montagem em uma FOTO de interiores (não um móvel isolado em estúdio)
- Preserve o ângulo de câmera e a perspectiva da imagem de entrada

REGRAS INVIOLÁVEIS:
- NÃO ignore objetos que o vendedor posicionou na montagem
- NÃO adicione pessoas, marcas, texto, logotipo ou itens listados em nao_adicionar
- NÃO esvazie o ambiente nem volte a um fundo de estúdio neutro
- Materiais de marcenaria com textura realista; alta nitidez; profundidade de campo suave

Se houver dúvida entre ficar bonito ou ficar fiel ao móvel da lousa, escolha FIDELIDADE AO MÓVEL.`;

export function applyAmbientePromptPlaceholders(
  prompt: string,
  vars: {
    nomeLead?: string;
    origem?: string;
    analise?: string;
    descricao?: string;
    cenaInventario?: string;
  },
): string {
  return prompt
    .replace(/\{\{nome_lead\}\}/gi, vars.nomeLead?.trim() || 'Não informado')
    .replace(/\{\{origem\}\}/gi, vars.origem?.trim() || 'Não informada')
    .replace(/\{\{analise\}\}/gi, vars.analise?.trim() || 'Não disponível')
    .replace(/\{\{descricao\}\}/gi, vars.descricao?.trim() || 'Não informada')
    .replace(/\{\{cena_inventario\}\}/gi, vars.cenaInventario?.trim() || 'Não informado');
}

/** Trava o móvel mesmo se o prompt customizado nas configurações for antigo. */
export function appendAmbienteFurnitureFidelity(
  renderPrompt: string,
  vars: { cenaInventario?: string; furnitureRefCount?: number },
): string {
  const inventario =
    vars.cenaInventario?.trim() ||
    'Não informado — use apenas o que estiver visível na montagem.';
  const refCount = vars.furnitureRefCount ?? 0;
  const refHint =
    refCount > 0
      ? `A primeira imagem é a montagem EXATA da lousa. As ${refCount} imagens seguintes são recortes fiéis dos móveis — copie cor, material e silhueta da montagem; as extras só reforçam detalhe.`
      : 'A imagem de entrada é a montagem EXATA da lousa (foto do cômodo + peças posicionadas). Transforme em foto sem redesenhar, recolorir ou reposicionar os móveis.';

  const alreadyHasInventario = renderPrompt.includes(inventario);
  const inventarioBlock = alreadyHasInventario
    ? ''
    : `\nInventário da cena montada pelo vendedor:\n${inventario}\n`;

  return `${renderPrompt.trim()}

---
FIDELIDADE DOS MÓVEIS (prioridade máxima — acima de estética):
${refHint}
${inventarioBlock}
- Cada móvel da montagem é o MESMO produto (módulos, portas, gavetas, puxadores, proporções, materiais e cores)
- É PROIBIDO criar variação, restilizar, modernizar, simplificar ou “melhorar” o móvel
- Integre no ambiente (luz, sombra, perspectiva) SEM alterar o desenho da peça
- O cômodo (piso, paredes, iluminação, clima) vem da descrição e da foto de fundo
---`;
}

export function appendCaracteristicasToRenderPrompt(
  renderPrompt: string,
  caracteristicas?: string | null,
): string {
  const extra = caracteristicas?.trim();
  if (!extra) {
    return renderPrompt.replace(/\{\{caracteristicas\}\}/gi, '').trimEnd();
  }

  const block = `---
CARACTERÍSTICAS SOLICITADAS PELO VENDEDOR:
${extra}

Aplique essas características SOMENTE em cores, materiais, texturas e detalhes de acabamento.
NÃO altere layout, quantidade de módulos, proporções nem ângulo da imagem original.`;

  if (/\{\{caracteristicas\}\}/i.test(renderPrompt)) {
    return renderPrompt.replace(/\{\{caracteristicas\}\}/gi, block);
  }

  return `${renderPrompt}\n\n${block}`;
}

export interface EditPonto {
  id: number;
  x: number;
  y: number;
}

function detectRemovalIntent(notas: string): boolean {
  return /\b(remov(a|er|e|endo)|tir(a|ar|e|ando)|exclu(a|ir|indo)|apag(a|ar|ue|ando)|delete|remove)\b/i.test(
    notas,
  );
}

function formatPontosRegions(pontos: EditPonto[]): string {
  return pontos
    .map((p) => {
      const pos = describePontoPosition(p.x, p.y);
      return `- PONTO ${p.id} (marcador dourado "${p.id}" + círculo vermelho tracejado): ${pos}. Altere SOMENTE o móvel/objeto exatamente SOB este marcador — ignore outros módulos distantes.`;
    })
    .join('\n');
}

function describePontoPosition(x: number, y: number): string {
  const horizontal =
    x < 0.25
      ? 'extrema esquerda'
      : x < 0.42
        ? 'lado esquerdo'
        : x > 0.75
          ? 'extrema direita'
          : x > 0.58
            ? 'lado direito'
            : 'centro horizontal';
  const vertical =
    y < 0.25
      ? 'topo'
      : y < 0.42
        ? 'parte superior'
        : y > 0.75
          ? 'parte inferior / base'
          : y > 0.58
            ? 'parte inferior'
            : 'centro vertical';
  return `${vertical}, ${horizontal} (coordenadas ${Math.round(x * 100)}% × ${Math.round(y * 100)}%)`;
}

/** Prompt dedicado à edição local (não reutiliza o prompt de renderização completa). */
export function buildSurgicalEditPrompt(opts: { notas: string; pontos: EditPonto[] }): string {
  const notas = opts.notas.trim();
  const pontosList = formatPontosRegions(opts.pontos);
  const hasRemoval = detectRemovalIntent(notas);
  const singlePointHint =
    opts.pontos.length === 1
      ? `\nHá apenas UM ponto marcado (Ponto ${opts.pontos[0].id}). Toda a alteração deve ocorrer exclusivamente na superfície do móvel sob esse marcador — não modifique armários, geladeiras ou módulos em outras áreas da imagem.\n`
      : '';

  const removalBlock = hasRemoval
    ? `
ATENÇÃO — PEDIDO DE REMOÇÃO:
- "Remover" significa APAGAR o elemento indicado (puxador, ferragem, detalhe) por completo
- Preencha o vazio com a superfície contígua do móvel (frente lisa, MDF, madeira) com a MESMA cor e textura do entorno
- NÃO coloque outro puxador, ferragem ou objeto novo no lugar, a menos que o vendedor peça explicitamente "trocar por" ou "substituir por"
- NÃO duplique puxadores, portas ou módulos em nenhuma parte da imagem`
    : '';

  return `Edição cirúrgica local em render fotorrealista de móvel planejado JÁ FINALIZADO.

A imagem de entrada contém marcadores dourados numerados (1, 2, 3…) e círculos vermelhos tracejados delimitando EXATAMENTE onde cada alteração deve ocorrer. A máscara PNG reforça as mesmas regiões (transparente = editável).

REFERÊNCIA VISUAL OBRIGATÓRIA — siga os marcadores na imagem:
${pontosList}
${singlePointHint}
INSTRUÇÕES DO VENDEDOR (aplicar somente nos pontos acima):
${notas}
${removalBlock}

REGRAS INVIOLÁVEIS:
1. LOCALIZAÇÃO: Cada alteração ocorre APENAS na superfície do móvel sob o marcador numerado correspondente — NÃO em outros módulos, armários ou eletros distantes
2. PRESERVAÇÃO: Fora das regiões mascaradas, mantenha o render idêntico (cores, módulos, proporções, iluminação, fundo)
3. SEM DUPLICAÇÃO: Não adicionar nichos, puxadores, portas ou módulos extras fora do ponto indicado
4. SEM OVERLAYS: Remova todos os marcadores dourados, círculos vermelhos e números do resultado final
5. RESULTADO: A mesma foto do ambiente, com alteração mínima e localizada somente onde o vendedor marcou`;
}

/** @deprecated Prefer buildSurgicalEditPrompt para edições pontuais */
export function appendEditPontosToRenderPrompt(
  parentPrompt: string,
  opts: { notas: string; pontos: EditPonto[] },
): string {
  return `${parentPrompt.trim()}\n\n${buildSurgicalEditPrompt(opts)}`;
}
