import type { ProducaoStageKind } from '@/lib/projetos-producao'

/**
 * Paleta das colunas do quadro de Produção. O valor salvo em `producao_stages.cor`
 * é a chave (ex.: 'warning'). As classes ficam literais para o Tailwind gerar o CSS.
 * As três primeiras repetem o visual antigo (fila/oficina/pronto), então colunas
 * existentes não mudam de cara.
 */
export const PRODUCAO_STAGE_CORES = {
  warning: {
    label: 'Âmbar',
    swatch: 'bg-[#c9a35a]',
    shell:
      'border-[#e8d5a8]/90 bg-[linear-gradient(180deg,#fffdf8_0%,#f7f1e6_100%)] shadow-[0_18px_40px_rgba(90,70,40,0.08)]',
    accent: 'bg-[#c9a35a]',
    icon: 'text-[#a67c2d]',
  },
  primary: {
    label: 'Verde-água',
    swatch: 'bg-[#2d8c78]',
    shell:
      'border-[#9fd5c8]/90 bg-[linear-gradient(180deg,#f7fffc_0%,#e8f6f1_100%)] shadow-[0_18px_40px_rgba(40,90,80,0.08)] [background-image:repeating-linear-gradient(135deg,rgba(45,140,120,0.06)_0_1px,transparent_1px_8px)]',
    accent: 'bg-[#2d8c78]',
    icon: 'text-[#2d8c78]',
  },
  success: {
    label: 'Esmeralda',
    swatch: 'bg-[#3f9a68]',
    shell:
      'border-[#b7dfc4]/90 bg-[linear-gradient(180deg,#f6fff8_0%,#eaf6ee_100%)] shadow-[0_18px_40px_rgba(40,90,60,0.08)]',
    accent: 'bg-[#3f9a68]',
    icon: 'text-[#3f9a68]',
  },
  carvalho: {
    label: 'Carvalho',
    swatch: 'bg-[#8d5e22]',
    shell:
      'border-[#dcc3a0]/90 bg-[linear-gradient(180deg,#fffaf3_0%,#f3e8d8_100%)] shadow-[0_18px_40px_rgba(110,70,30,0.09)]',
    accent: 'bg-[#8d5e22]',
    icon: 'text-[#8d5e22]',
  },
  ceu: {
    label: 'Céu',
    swatch: 'bg-[#3b82c4]',
    shell:
      'border-[#bcd6ef]/90 bg-[linear-gradient(180deg,#f8fbff_0%,#e9f1fa_100%)] shadow-[0_18px_40px_rgba(40,70,110,0.08)]',
    accent: 'bg-[#3b82c4]',
    icon: 'text-[#3b82c4]',
  },
  lavanda: {
    label: 'Lavanda',
    swatch: 'bg-[#7c6bc4]',
    shell:
      'border-[#d3cbef]/90 bg-[linear-gradient(180deg,#fbfaff_0%,#efecfa_100%)] shadow-[0_18px_40px_rgba(70,55,120,0.08)]',
    accent: 'bg-[#7c6bc4]',
    icon: 'text-[#6d5cb8]',
  },
  vinho: {
    label: 'Vinho',
    swatch: 'bg-[#b04a5a]',
    shell:
      'border-[#ecc4ca]/90 bg-[linear-gradient(180deg,#fffafa_0%,#f8eaec_100%)] shadow-[0_18px_40px_rgba(110,40,50,0.08)]',
    accent: 'bg-[#b04a5a]',
    icon: 'text-[#a33f4f]',
  },
  secondary: {
    label: 'Grafite',
    swatch: 'bg-[#4a5653]',
    shell:
      'border-[#c9d1ce]/90 bg-[linear-gradient(180deg,#fbfcfc_0%,#eceff0_100%)] shadow-[0_18px_40px_rgba(40,50,48,0.08)]',
    accent: 'bg-[#4a5653]',
    icon: 'text-[#4a5653]',
  },
  muted: {
    label: 'Neutro',
    swatch: 'bg-[#a3b0ac]',
    shell:
      'border-[#d7e0dc]/90 bg-[linear-gradient(180deg,#ffffff_0%,#f3f6f5_100%)] shadow-[0_18px_40px_rgba(50,60,58,0.07)]',
    accent: 'bg-[#6b7c76]',
    icon: 'text-[#5a6b66]',
  },
} as const satisfies Record<string, ProducaoStageCor>

export type ProducaoStageCorKey = keyof typeof PRODUCAO_STAGE_CORES

export const PRODUCAO_STAGE_COR_KEYS = Object.keys(PRODUCAO_STAGE_CORES) as ProducaoStageCorKey[]

const KIND_FALLBACK: Record<ProducaoStageKind, ProducaoStageCorKey> = {
  pendente: 'warning',
  iniciado: 'primary',
  feito: 'success',
  other: 'muted',
}

export function isProducaoStageCorKey(value: string | null | undefined): value is ProducaoStageCorKey {
  return value != null && value in PRODUCAO_STAGE_CORES
}

/** Cor salva na coluna; se vazia ou desconhecida, usa a cor padrão do tipo da coluna. */
export function resolveProducaoStageCor(cor: string | null | undefined, kind: ProducaoStageKind): ProducaoStageCor {
  return PRODUCAO_STAGE_CORES[isProducaoStageCorKey(cor) ? cor : KIND_FALLBACK[kind]]
}

export interface ProducaoStageCor {
  label: string
  swatch: string
  shell: string
  accent: string
  icon: string
}
