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
