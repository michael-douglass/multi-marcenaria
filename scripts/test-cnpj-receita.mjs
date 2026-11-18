// Teste ad-hoc da consulta de CNPJ na Receita (src/lib/cnpj-receita.ts). Usa a rede.
// Uso: npx tsx --tsconfig tsconfig.app.json scripts/test-cnpj-receita.mjs [cnpj]
import { consultarCnpjReceita, mapBrasilApi, mapCnpjWs } from '../src/lib/cnpj-receita.ts'

const cnpj = process.argv[2] ?? '00.000.000/0001-91' // Banco do Brasil
let falhas = 0
const ok = (cond, msg) => {
  console.log(`${cond ? '  ✅' : '  ❌'} ${msg}`)
  if (!cond) falhas++
}

console.log('1. Sem rede')
ok((await consultarCnpjReceita('00.000.000/0001-92')) === null, 'CNPJ inválido devolve null')
const ws = mapCnpjWs({
  razao_social: 'X LTDA',
  estabelecimento: {
    cnpj: '00000000000191', nome_fantasia: 'X', tipo_logradouro: 'Rua', logradouro: 'A', numero: '1',
    cep: '01001-000', bairro: 'Centro', cidade: { nome: 'São Paulo' }, estado: { sigla: 'sp' },
    ddd1: '11', telefone1: '3333-4444', email: 'A@B.COM', situacao_cadastral: 'Ativa',
  },
})
ok(ws.logradouro === 'Rua A' && ws.telefone === '1133334444' && ws.uf === 'SP' && ws.situacao === 'ATIVA', 'mapCnpjWs normaliza')
const ba = mapBrasilApi({ cnpj: '00000000000191', descricao_tipo_de_logradouro: 'AVENIDA', logradouro: 'AVENIDA X', ddd_telefone_1: '(61) 3493-9002' })
ok(ba.logradouro === 'AVENIDA X' && ba.telefone === '6134939002', 'mapBrasilApi não duplica o tipo e limpa o telefone')

console.log(`2. Rede (${cnpj})`)
try {
  const d = await consultarCnpjReceita(cnpj)
  console.log(d)
  ok(!!d && d.razaoSocial.length > 0, 'devolve razão social')
  ok(!!d && d.uf.length === 2 && d.cidade.length > 0, 'devolve cidade/UF')
} catch (e) {
  ok(false, `consulta falhou: ${e.message}`)
}

console.log(falhas ? `\n${falhas} falha(s)` : '\nTudo ok')
process.exit(falhas ? 1 : 0)
