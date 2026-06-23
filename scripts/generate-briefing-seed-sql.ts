import { writeFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { BRIEFING_SEED_MODELOS } from '../src/lib/briefing-seed-data.ts'

const __dirname = dirname(fileURLToPath(import.meta.url))
const out = join(__dirname, '../supabase/migrations/080_briefing_seed.sql')

function esc(s: string) {
  return s.replace(/'/g, "''")
}

const lines: string[] = [
  '-- Seed dos 12 ambientes de briefing pré-obra',
  'DO $$',
  'DECLARE',
  '  v_modelo_id UUID;',
  'BEGIN',
  '  IF (SELECT COUNT(*) FROM movelaria_briefing_modelos) > 0 THEN',
  "    RAISE NOTICE 'Seed já aplicado, pulando.';",
  '    RETURN;',
  '  END IF;',
]

for (const modelo of BRIEFING_SEED_MODELOS) {
  const desc = modelo.descricao ? `'${esc(modelo.descricao)}'` : 'NULL'
  lines.push(
    `  INSERT INTO movelaria_briefing_modelos (nome, descricao, ordem, ativo) VALUES ('${esc(modelo.nome)}', ${desc}, ${modelo.ordem}, true) RETURNING id INTO v_modelo_id;`,
  )
  modelo.perguntas.forEach((p, idx) => {
    const textoAjuda = p.texto_ajuda ? `'${esc(p.texto_ajuda)}'` : 'NULL'
    const unidade = p.unidade_padrao ? `'${esc(p.unidade_padrao)}'` : 'NULL'
    const opcoes = p.opcoes ? `'${esc(JSON.stringify(p.opcoes))}'::jsonb` : 'NULL'
    const obrigatoria = p.obrigatoria ? 'true' : 'false'
    lines.push(
      `  INSERT INTO movelaria_briefing_perguntas (modelo_id, enunciado, tipo, opcoes, obrigatoria, texto_ajuda, unidade_padrao, ordem, ativo) VALUES (v_modelo_id, '${esc(p.enunciado)}', '${p.tipo}', ${opcoes}, ${obrigatoria}, ${textoAjuda}, ${unidade}, ${idx + 1}, true);`,
    )
  })
}

lines.push('END $$;')
writeFileSync(out, lines.join('\n'))
console.log(`Gerado: ${out} (${lines.length} linhas)`)
