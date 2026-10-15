/**
 * De-Para de ferragens: termos genéricos da IA → SKU canônico de obra.
 * Quantidades NÃO ficam aqui — vêm do explode/consolidação do BOM.
 * Preço continua em createPriceResolver via inventory_aliases / fuzzy.
 */

export type HardwareCanonicalKey =
  | 'puxador_alca'
  | 'dobradica_soft_close'
  | 'dobradica_reta'
  | 'corredica_oculta_45'
  | 'corredica_teles_25'
  | 'cabideiro_oval'
  | 'articulador_uno'
  | 'ro82'
  | 'trilho_superior'
  | 'perfil_led_rm331'
  | 'fita_led'
  | 'unknown'

export interface HardwareAliasRule {
  key: HardwareCanonicalKey
  /** Nome canônico para lista de compras / estoque. */
  canonicalName: string
  category: 'ferragem' | 'puxador' | 'consumivel'
  /** Padrões no nome bruto (já normalizado). */
  patterns: RegExp[]
}

function normalizeHardwareText(value: string): string {
  return String(value || '')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Seeds de obra (Flaviane / lista de materiais típica) — PRD v16 Épico 4. */
export const HARDWARE_ALIAS_RULES: HardwareAliasRule[] = [
  {
    key: 'puxador_alca',
    canonicalName: 'PUXADOR ALÇA',
    category: 'puxador',
    patterns: [
      /puxador.*alc/,
      /\balca\b.*puxador/,
      /handle.*pull/,
      /puxador perfil/,
      /puxador.*concha/,
      /puxador.*cava/,
      /puxador.*embut/,
    ],
  },
  // Soft-close ANTES da reta genérica (ordem importa)
  {
    key: 'dobradica_soft_close',
    canonicalName: 'DOBRADIÇA RETA SOFT-CLOSE',
    category: 'ferragem',
    patterns: [
      /dobradic.*soft/,
      /soft.?close.*dobrad/,
      /dobradic.*amortec/,
      /dobradic.*click/,
      /hinge.*soft/,
    ],
  },
  {
    key: 'dobradica_reta',
    canonicalName: 'DOBRADIÇA RETA',
    category: 'ferragem',
    patterns: [/dobradic/, /hinge/, /dobradica.*reta/, /dobradica.*35/],
  },
  {
    key: 'corredica_oculta_45',
    canonicalName: 'CORREDIÇA OCULTA 45',
    category: 'ferragem',
    patterns: [/corredic.*ocult/, /corredic.*45/, /hidden.*slide/, /slide.*soft/, /corredic.*amortec/],
  },
  {
    key: 'corredica_teles_25',
    canonicalName: 'CORREDIÇA TELES 25',
    category: 'ferragem',
    patterns: [/corredic.*teles/, /corredic.*25/, /telescop/],
  },
  {
    key: 'cabideiro_oval',
    canonicalName: 'CABIDEIRO OVAL',
    category: 'ferragem',
    patterns: [/cabideiro/, /barra cabide/, /hanging.*rod/, /tubo oval/],
  },
  {
    key: 'articulador_uno',
    canonicalName: 'Articulador uno Tavares Forte',
    category: 'ferragem',
    patterns: [
      /articulador.*uno/,
      /uno tavares/,
      /\buno\b.*articul/,
      /articulador/,
      /piston.*gas/,
      /pistao/,
      /piston gas/,
    ],
  },
  {
    key: 'ro82',
    canonicalName: 'RO82',
    category: 'ferragem',
    patterns: [/\bro\s*82\b/, /\bro82\b/],
  },
  {
    key: 'trilho_superior',
    canonicalName: 'TRILHO SUPERIOR/B',
    category: 'ferragem',
    patterns: [/trilho superior/, /trilho.*correr/, /sliding.*rail/, /trilho.*porta/],
  },
  {
    key: 'perfil_led_rm331',
    canonicalName: 'RM-331 PERFIL DE LED EMB',
    category: 'ferragem',
    patterns: [/rm\s*331/, /perfil.*led/, /led emb/, /perfil.*alum.*led/],
  },
  {
    key: 'fita_led',
    canonicalName: 'FITA LED',
    category: 'consumivel',
    patterns: [/fita\s*led/, /\bled\s*strip\b/, /led\s*12v/, /iluminacao\s*led/],
  },
]

export interface MappedHardware {
  key: HardwareCanonicalKey
  canonicalName: string
  category: 'ferragem' | 'puxador' | 'consumivel'
  matched: boolean
}

/**
 * Converte nome genérico da IA no SKU canônico de obra.
 * Se não houver regra, devolve o nome original (matched=false).
 */
export function mapHardwareAlias(rawName: string): MappedHardware {
  const normalized = normalizeHardwareText(rawName)
  if (!normalized) {
    return {
      key: 'unknown',
      canonicalName: rawName?.trim() || 'Ferragem',
      category: 'ferragem',
      matched: false,
    }
  }
  for (const rule of HARDWARE_ALIAS_RULES) {
    if (rule.patterns.some((re) => re.test(normalized))) {
      return {
        key: rule.key,
        canonicalName: rule.canonicalName,
        category: rule.category,
        matched: true,
      }
    }
  }
  return {
    key: 'unknown',
    canonicalName: rawName.trim(),
    category: /puxador|handle|alca/i.test(normalized) ? 'puxador' : 'ferragem',
    matched: false,
  }
}

/** Apelidos sugeridos para gravar em inventory_aliases (admin / seed). */
export function hardwareAliasSeedPairs(): Array<{ alias: string; canonicalName: string }> {
  const pairs: Array<{ alias: string; canonicalName: string }> = []
  for (const rule of HARDWARE_ALIAS_RULES) {
    pairs.push({ alias: rule.canonicalName, canonicalName: rule.canonicalName })
    for (const sample of [
      rule.key.replace(/_/g, ' '),
      ...rule.patterns.slice(0, 1).map(() => rule.canonicalName.toLowerCase()),
    ]) {
      pairs.push({ alias: sample, canonicalName: rule.canonicalName })
    }
  }
  return pairs
}
