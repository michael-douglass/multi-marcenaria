/**
 * Tela cheia → card: a foto editada precisa ficar no mesmo lugar da foto do cômodo.
 * Rode: node --test scripts/test-ambiente-photo-plane.mjs
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const zoomLib = readFileSync(join(root, 'src/lib/lead-ai-ambiente-zoom.ts'), 'utf8');
const composer = readFileSync(join(root, 'src/components/leads/LeadAIAmbienteComposer.tsx'), 'utf8');
const draftLib = readFileSync(join(root, 'src/lib/lead-ai-ambiente-draft.ts'), 'utf8');
const exportLib = readFileSync(join(root, 'src/lib/lead-ai-ambiente-export.ts'), 'utf8');

function planeFromContainFit(nw, nh) {
  return {
    left: (1 - nw) / 2,
    top: (1 - nh) / 2,
    width: Math.max(0.08, nw),
    height: Math.max(0.08, nh),
  };
}

function planeToViewportBox(box, plane) {
  return {
    x: plane.left + box.x * plane.width,
    y: plane.top + box.y * plane.height,
    width: box.width * plane.width,
    height: box.height * plane.height,
  };
}

function remapAlong(value, fromStart, fromSize, toStart, toSize) {
  const t = fromSize === 0 ? 0 : (value - fromStart) / fromSize;
  return toStart + t * toSize;
}

describe('lousa — tela cheia e card colados na foto', () => {
  it('guarda a peça na foto, não na janela larga', () => {
    assert.match(zoomLib, /export const PHOTO_PLANE/);
    assert.match(zoomLib, /planeToViewportBox/);
    assert.match(composer, /data-ambiente-photo-plane/);
    assert.match(composer, /coordSpaceRef/);
    assert.match(draftLib, /coordSpace\?: AmbienteCoordSpace/);
    assert.match(exportLib, /coordSpace === 'photo'/);
  });

  it('não recalcula a posição a cada mudança de tamanho da janela', () => {
    assert.doesNotMatch(composer, /if \(!planesDiffer\(prev, scenePlane\)\) return/);
    assert.match(composer, /coordSpaceRef\.current === 'viewport'/);
    assert.match(composer, /remapSceneToPlane\(scene, scenePlane, PHOTO_PLANE\)/);
  });

  it('ao minimizar, o recorte fica no mesmo ponto da foto', () => {
    const overlay = { x: 0.22, y: 0.61, width: 0.31, height: 0.42 };
    const fullscreen = planeFromContainFit(0.394079, 0.96);
    const card = planeFromContainFit(0.72, 0.96);
    const visFs = planeToViewportBox(overlay, fullscreen);
    const visCard = planeToViewportBox(overlay, card);

    const photoXFs = remapAlong(visFs.x, fullscreen.left, fullscreen.width, 0, 1);
    const photoXCard = remapAlong(visCard.x, card.left, card.width, 0, 1);
    assert.equal(Number(photoXFs.toFixed(6)), overlay.x);
    assert.equal(Number(photoXCard.toFixed(6)), overlay.x);
    assert.equal(Number(photoXFs.toFixed(6)), Number(photoXCard.toFixed(6)));

    const photoWFs = visFs.width / fullscreen.width;
    const photoWCard = visCard.width / card.width;
    assert.equal(Number(photoWFs.toFixed(6)), overlay.width);
    assert.equal(Number(photoWCard.toFixed(6)), overlay.width);
  });

  it('não aplica o encaixe da tela cheia na lousa pequena', () => {
    assert.match(composer, /const layoutHost = isFullscreen \? 'fullscreen' : 'card'/);
    assert.match(composer, /fittedHost === layoutHost/);
    assert.match(composer, /if \(fittedHost !== layoutHost\) return/);
    assert.match(composer, /setFittedHost\(null\)/);
    assert.doesNotMatch(
      composer,
      /absolute left-1\/2 top-1\/2 max-w-none origin-center object-contain transition-\[transform\]/,
    );

    const photoW = 800;
    const photoH = 600;
    const fs = { w: 1418, h: 470 };
    const card = { w: 700, h: 320 };
    const fsContain = Math.min(fs.w / photoW, fs.h / photoH) * 0.96;
    const staleBoxW = ((photoW * fsContain) / fs.w) * card.w;
    const staleBoxH = ((photoH * fsContain) / fs.h) * card.h;
    const staleAspect = staleBoxW / staleBoxH;
    const liveContain = Math.min(card.w / photoW, card.h / photoH) * 0.96;
    const liveBoxW = photoW * liveContain;
    const liveBoxH = photoH * liveContain;
    const liveAspect = liveBoxW / liveBoxH;
    assert.ok(
      Math.abs(staleAspect - liveAspect) > 0.2,
      'o tamanho antigo da tela cheia estica a foto no card',
    );
    assert.equal(Number(liveAspect.toFixed(4)), Number((photoW / photoH).toFixed(4)));
  });
});
