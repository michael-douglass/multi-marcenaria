/**
 * Fase K — modelo de contrato padrão. Determinístico, sem banco.
 *   1. O texto/campos de src/lib/contrato-padrao.ts são iguais aos do SQL (crm_seed_contrato_padrao).
 *   2. Gerado com uma empresa fictícia: nada de Garbo, nenhum {{…}} sobrando.
 *   3. Entrada/saldo, por extenso, padrões com {{empresa_*}} e a cláusula de imagem condicional.
 *
 * Uso: npx tsx --tsconfig tsconfig.app.json scripts/test-contrato-padrao.mjs
 */
import { readFileSync } from 'node:fs'
import { CONTRATO_PADRAO_CAMPOS, CONTRATO_PADRAO_NOME, CONTRATO_PADRAO_TEXTO } from '../src/lib/contrato-padrao.ts'
import { montarTextoContrato, resolverValoresPadrao, valoresCalculados, nomesUsadosNoModelo, nomeReservadoContrato } from '../src/lib/contrato-variaveis.ts'
import { valoresVariaveisEmpresa, VARIAVEIS_EMPRESA } from '../src/lib/contratos-print.ts'
import { montarEmpresaIdentidade } from '../src/lib/empresa-identidade.ts'
import { numeroPorExtenso } from '../src/lib/valor-monetario-extenso.ts'

let falhas = 0
let n = 0
const ok = (cond, msg) => {
  n++
  if (!cond) {
    falhas++
    console.log(`  ✗ ${msg}`)
  }
}

// 1. Par TS ↔ SQL
const sql = readFileSync(new URL('../supabase/migrations/20261118130000_contrato_padrao.sql', import.meta.url), 'utf8')
const textoSql = sql.match(/\$modelo\$([\s\S]*?)\$modelo\$/)?.[1]
ok(textoSql === CONTRATO_PADRAO_TEXTO, 'texto do modelo difere entre contrato-padrao.ts e a migration')
ok(sql.includes(`'${CONTRATO_PADRAO_NOME}'`), 'nome do modelo difere do SQL')
for (const c of CONTRATO_PADRAO_CAMPOS) {
  const padrao = c.valor_padrao == null ? 'null' : `'${c.valor_padrao}'`
  const linha = `(p_empresa, '${c.nome}', '${c.label}', '${c.tipo}', ${padrao}, ${c.obrigatorio}, ${c.mostrar_no_link_publico}, ${c.ordem})`
  ok(sql.includes(linha), `campo ${c.nome} difere do SQL (esperado: ${linha})`)
}
ok(CONTRATO_PADRAO_CAMPOS.length === 17, `esperado 17 campos, há ${CONTRATO_PADRAO_CAMPOS.length}`)

// todo nome usado no texto é campo, variável de empresa ou calculada
const campos = new Set(CONTRATO_PADRAO_CAMPOS.map((c) => c.nome))
const empresaNomes = new Set(VARIAVEIS_EMPRESA.map((v) => v.nome))
for (const nome of nomesUsadosNoModelo(CONTRATO_PADRAO_TEXTO)) {
  ok(campos.has(nome) || empresaNomes.has(nome) || nomeReservadoContrato(nome), `{{${nome}}} no texto não é campo nem automática`)
}
for (const c of CONTRATO_PADRAO_CAMPOS) ok(!nomeReservadoContrato(c.nome), `campo ${c.nome} usa nome reservado`)

// 2. Empresa fictícia
const empresa = valoresVariaveisEmpresa(
  montarEmpresaIdentidade({
    nome: 'Marcenaria Exemplo',
    razaoSocial: 'Exemplo Móveis Ltda',
    cnpj: '11222333000181',
    logradouro: 'Rua das Tábuas', numero: '10', bairro: 'Centro', cidade: 'Lavras', uf: 'MG', cep: '37200000',
    telefone: '35999990000',
    email: 'contato@exemplo.com.br',
    representanteNome: 'Maria Exemplo',
    representanteCpf: '52998224725',
    representanteQualificacao: 'brasileira, solteira, empresária',
  }),
)
const padroes = resolverValoresPadrao(CONTRATO_PADRAO_CAMPOS, empresa)
ok(padroes.chave_pix === '11.222.333/0001-81', `chave PIX padrão = CNPJ (veio ${padroes.chave_pix})`)
ok(padroes.foro_cidade === 'Lavras/MG', `foro padrão = cidade/UF (veio ${padroes.foro_cidade})`)
ok(padroes.percentual_entrada === '60' && padroes.incluir_clausula_imagem === 'sim', 'padrões 60% e cláusula de imagem')

const cliente = {
  ...padroes,
  nome_do_cliente: 'João Cliente', cpf: '111.444.777-35', endereco: 'Rua A, 1', telefone: '(35) 98888-7777',
  valor_total: '10.000,00', ambientes_contemplados: 'Cozinha e quarto', prazo_entrega_dias: '45',
  data_inicio_obra: '01 de dezembro de 2026', data_assinatura: '18 de novembro de 2026',
}
const texto = montarTextoContrato(CONTRATO_PADRAO_TEXTO, CONTRATO_PADRAO_CAMPOS, cliente, empresa)
ok(!/\{\{|\}\}/.test(texto), `sobrou variável: ${(texto.match(/\{\{[^}]*\}\}/g) ?? []).join(', ')}`)
for (const proibido of [/garbo/i, /58\.838\.942/, /f[áa]bio/i, /boa esperan[çc]a/i, /99140/]) ok(!proibido.test(texto), `texto contém ${proibido}`)
ok(texto.includes('CONTRATADO: Exemplo Móveis Ltda, inscrita no CNPJ sob o nº 11.222.333/0001-81'), 'contratada com razão social e CNPJ do perfil')
ok(texto.includes('representada por Maria Exemplo, brasileira, solteira, empresária, inscrito no CPF sob o nº 529.982.247-25'), 'representante do perfil')
ok(texto.includes('é de R$ 10.000,00 (dez mil reais)'), 'valor total por extenso')
ok(texto.includes('Entrada (60%): O valor de R$ 6.000,00 (seis mil reais)'), 'entrada 60%')
ok(texto.includes('Entrega (40%): O valor restante de R$ 4.000,00 (quatro mil reais)'), 'saldo 40%')
ok(texto.includes('garantia de 2 (dois) anos'), 'garantia por extenso')
ok(texto.includes('prazo de 45 (quarenta e cinco) dias corridos'), 'prazo por extenso')
ok(texto.includes('10 (dez) dias de tolerância'), 'tolerância por extenso')
ok(texto.includes('Chave PIX: 11.222.333/0001-81 - Marcenaria Exemplo'), 'chave PIX = CNPJ')
ok(texto.includes('Comarca de Lavras/MG') && texto.includes('Lavras/MG, 18 de novembro de 2026.'), 'foro e fecho com a cidade')
ok(texto.includes('4.4 A CONTRATANTE autoriza a captação de imagens'), 'cláusula de imagem presente por padrão')
ok(!texto.includes('{{#se') && !texto.includes('{{/se}}'), 'marcadores do bloco removidos')

// 3. Variações
const t50 = montarTextoContrato(CONTRATO_PADRAO_TEXTO, CONTRATO_PADRAO_CAMPOS, { ...cliente, percentual_entrada: '50' }, empresa)
ok(t50.includes('Entrada (50%): O valor de R$ 5.000,00 (cinco mil reais)') && t50.includes('Entrega (50%): O valor restante de R$ 5.000,00'), '50/50')
const calc = valoresCalculados(CONTRATO_PADRAO_CAMPOS, { valor_total: '1.000,01', percentual_entrada: '33,3' })
ok(calc.valor_entrada === '333,00' && calc.valor_saldo === '667,01' && calc.percentual_saldo === '66,7', `arredondamento fecha o total (${calc.valor_entrada} + ${calc.valor_saldo}, ${calc.percentual_saldo}%)`)
const semImg = montarTextoContrato(CONTRATO_PADRAO_TEXTO, CONTRATO_PADRAO_CAMPOS, { ...cliente, incluir_clausula_imagem: 'nao' }, empresa)
ok(!semImg.includes('4.4') && !semImg.includes('captação de imagens'), 'cláusula de imagem removida')
ok(semImg.includes('encerra-se com a efetiva entrega dos serviços.\n\n5. DESCRITIVO'), 'sem linha sobrando onde estava o 4.4')
ok(numeroPorExtenso('12,5') === 'doze vírgula cinco' && numeroPorExtenso(1) === 'um', 'numeroPorExtenso')

// empresa sem representante: o {{…}} continua visível (não some em branco)
const semRep = montarTextoContrato(CONTRATO_PADRAO_TEXTO, CONTRATO_PADRAO_CAMPOS, cliente, { ...empresa, empresa_representante_nome: '' })
ok(semRep.includes('{{empresa_representante_nome}}'), 'dado da empresa vazio fica visível na prévia')

console.log(`\n${n} checagens, ${falhas} falha(s).`)
if (falhas) process.exit(1)
console.log('OK: modelo padrão sem Garbo, com dados do perfil, cálculos e cláusula condicional.')
