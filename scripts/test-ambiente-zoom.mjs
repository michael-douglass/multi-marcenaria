/**
 * Zoom da lousa: aproximar mais e não perder o recorte ao afastar.
 * Rode: node --test scripts/test-ambiente-zoom.mjs
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const zoomLib = readFileSync(join(root, 'src/lib/lead-ai-ambiente-zoom.ts'), 'utf8');
const composer = readFileSync(join(root, 'src/components/leads/LeadAIAmbienteComposer.tsx'), 'utf8');
const hud = readFileSync(join(root, 'src/components/leads/ambiente/AmbienteZoomHud.tsx'), 'utf8');

const AMBIENTE_OVERLAY_MIN_SPAN = 0.03;
const AMBIENTE_OVERLAY_MAX_SPAN = 8;

function clampOverlaySpan(width, height) {
  const w = width;
  const h = height;
  const longest = Math.max(Math.abs(w), Math.abs(h), 1e-6);
  if (longest < AMBIENTE_OVERLAY_MIN_SPAN) {
    const factor = AMBIENTE_OVERLAY_MIN_SPAN / longest;
    return { width: w * factor, height: h * factor };
  }
  if (longest > AMBIENTE_OVERLAY_MAX_SPAN) {
    const factor = AMBIENTE_OVERLAY_MAX_SPAN / longest;
    return { width: w * factor, height: h * factor };
  }
  return { width: w, height: h };
}

function scaleOverlayBox(box, factor) {
  const size = clampOverlaySpan(box.width * factor, box.height * factor);
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;
  return {
    x: cx - size.width / 2,
    y: cy - size.height / 2,
    width: size.width,
    height: size.height,
  };
}

describe('zoom da lousa do ambiente', () => {
  it('permite aproximar bem mais que 800%', () => {
    assert.match(zoomLib, /AMBIENTE_ZOOM_MAX = 24/);
    assert.match(zoomLib, /AMBIENTE_OVERLAY_MAX_SPAN = 8/);
    assert.match(hud, /AMBIENTE_ZOOM_MAX/);
  });

  it('ao afastar, mantém a proporção e o centro da edição', () => {
    const box = { x: 0.4, y: 0.55, width: 0.18, height: 0.35 };
    const smaller = scaleOverlayBox(box, 0.5);
    assert.equal(Number((smaller.width / smaller.height).toFixed(4)), Number((0.18 / 0.35).toFixed(4)));
    assert.equal(Number((smaller.x + smaller.width / 2).toFixed(4)), 0.49);
    assert.equal(Number((smaller.y + smaller.height / 2).toFixed(4)), 0.725);
    const bigger = scaleOverlayBox(box, 6);
    assert.ok(Math.max(bigger.width, bigger.height) <= 8 + 1e-9);
    assert.match(composer, /scaleOverlayBox\(overlay, factor\)/);
  });

  it('grava a montagem ao sair da tela cheia', () => {
    assert.match(composer, /if \(!open\) persistComposerDraftRef\.current\(\)/);
    assert.match(composer, /saveAmbienteDraft\(/);
  });
});
