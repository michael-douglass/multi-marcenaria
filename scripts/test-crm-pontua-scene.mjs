import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, it } from 'node:test'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

function readSrc(rel) {
  return readFileSync(path.join(root, rel), 'utf8')
}

describe('Épico 19 — Pontua cena de pontos', () => {
  it('cena usa canvas 2D, 48 pontos e respeita reduced-motion', () => {
    const scene = readSrc('src/components/crm/GarboPontuaPointsScene.tsx')
    assert.match(scene, /prefers-reduced-motion/)
    assert.match(scene, /const count = 48/)
    assert.match(scene, /getContext\('2d'\)/)
    assert.doesNotMatch(scene, /from 'three'/)
    assert.doesNotMatch(scene, /from "three"/)
  })

  it('página Pontua usa a cena no hero', () => {
    const page = readSrc('src/pages/crm/ApresentacaoArquitetosPage.tsx')
    assert.match(page, /GarboPontuaPointsScene/)
    assert.match(page, /export function PontuaGarboPage/)
  })
})
