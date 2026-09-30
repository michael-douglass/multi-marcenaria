import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, it } from 'node:test'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

function readSrc(rel) {
  return readFileSync(path.join(root, rel), 'utf8')
}

function chaveConsolidacao(linha, categoria) {
  if (linha.produto_id) return `id:${linha.produto_id}`
  return [
    'txt',
    categoria,
    linha.descricao.trim().toLowerCase(),
    (linha.variacao ?? '').trim().toLowerCase(),
    (linha.unidade ?? '').trim().toLowerCase(),
  ].join('|')
}

function extrairListaMateriais(modulos) {
  const mapa = new Map()
  for (const linha of modulos.materiais?.linhas ?? []) {
    if (linha.ativo === false) continue
    const quantidade = Number(linha.quantidade) || 0
    if (quantidade <= 0) continue
    const categoria = linha.categoria?.trim() || 'Outros'
    const chave = chaveConsolidacao(linha, categoria)
    const existente = mapa.get(chave)
    if (existente) {
      existente.quantidade += quantidade
      continue
    }
    mapa.set(chave, {
      categoria,
      descricao: linha.descricao.trim() || 'Item',
      variacao: linha.variacao?.trim() || null,
      unidade: linha.unidade?.trim() || null,
      quantidade,
    })
  }
  const porCategoria = new Map()
  for (const item of mapa.values()) {
    const lista = porCategoria.get(item.categoria) ?? []
    lista.push(item)
    porCategoria.set(item.categoria, lista)
  }
  return Array.from(porCategoria.entries()).map(([categoria, itens]) => ({ categoria, itens }))
}

describe('Lista de materiais do markup', () => {
  it('consolida o mesmo produto e agrupa por categoria', () => {
    const grupos = extrairListaMateriais({
      materiais: {
        linhas: [
          {
            produto_id: 'dob-1',
            descricao: 'Dobradiça',
            variacao: 'RETA',
            unidade: 'un',
            categoria: 'Ferragens',
            quantidade: 20,
            ativo: true,
          },
          {
            produto_id: 'dob-1',
            descricao: 'Dobradiça',
            variacao: 'RETA',
            unidade: 'un',
            categoria: 'Ferragens',
            quantidade: 10,
            ativo: true,
          },
          {
            produto_id: 'mdf-1',
            descricao: 'MDF Branco',
            variacao: '15mm',
            unidade: 'chapa',
            categoria: 'Chapas de MDF',
            quantidade: 4,
            ativo: true,
          },
          {
            produto_id: 'ignorar',
            descricao: 'Zerado',
            quantidade: 0,
            categoria: 'Outros',
            ativo: true,
          },
        ],
      },
    })

    assert.equal(grupos.length, 2)
    const ferragens = grupos.find((g) => g.categoria === 'Ferragens')
    const mdf = grupos.find((g) => g.categoria === 'Chapas de MDF')
    assert.equal(ferragens.itens[0].quantidade, 30)
    assert.equal(mdf.itens[0].quantidade, 4)
  })

  it('está ligado na calculadora e no helper', () => {
    const helper = readSrc('src/lib/markup-lista-materiais.ts')
    const sheet = readSrc('src/components/markup/MarkupCalculatorSheet.tsx')
    assert.match(helper, /export function extrairListaMateriais/)
    assert.match(helper, /export async function exportarListaMateriaisPdf/)
    assert.match(helper, /export async function copiarListaMateriaisTexto/)
    assert.match(sheet, /Materiais/)
    assert.match(sheet, /Baixar PDF da lista/)
    assert.match(sheet, /Copiar texto/)
    assert.match(sheet, /exportarListaMateriaisPdf/)
  })
})
