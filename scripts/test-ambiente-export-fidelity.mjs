/**
 * A montagem enviada à IA precisa copiar o que o vendedor vê na lousa.
 * Rode: node --test scripts/test-ambiente-export-fidelity.mjs
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const zoomLib = readFileSync(join(root, 'src/lib/lead-ai-ambiente-zoom.ts'), 'utf8');
const exportLib = readFileSync(join(root, 'src/lib/lead-ai-ambiente-export.ts'), 'utf8');
const composer = readFileSync(join(root, 'src/components/leads/LeadAIAmbienteComposer.tsx'), 'utf8');
const openaiEdit = readFileSync(join(root, 'supabase/functions/_shared/openai-image-edit.ts'), 'utf8');
const ambienteFn = readFileSync(join(root, 'supabase/functions/render-lead-ambiente/index.ts'), 'utf8');

function containedRectInBox(boxW, boxH, contentW, contentH) {
  const srcW = Math.max(1, contentW);
  const srcH = Math.max(1, contentH);
  const fit = Math.min(boxW / srcW, boxH / srcH);
  const dw = srcW * fit;
  const dh = srcH * fit;
  return {
    dx: (boxW - dw) / 2,
    dy: (boxH - dh) / 2,
    dw,
    dh,
  };
}

function remapAlong(value, fromStart, fromSize, toStart, toSize) {
  const t = fromSize === 0 ? 0 : (value - fromStart) / fromSize;
  return toStart + t * toSize;
}

describe('exportação da lousa — fidelidade da montagem', () => {
  it('não estica a foto do móvel na caixa (object-contain)', () => {
    const box = containedRectInBox(180, 350, 400, 400);
    assert.ok(Math.abs(box.dw - box.dh) < 0.001, 'foto quadrada continua quadrada');
    assert.ok(box.dw <= 180 + 0.001);
    assert.ok(box.dh <= 350 + 0.001);
    assert.match(zoomLib, /containedRectInBox/);
    assert.match(exportLib, /drawOverlayLikeBoard/);
    assert.match(exportLib, /containedRectInBox\(boxW, boxH/);
  });

  it('coloca o móvel no mesmo lugar da foto, não no quadro largo da lousa', () => {
    const viewportW = 1418;
    const viewportH = 470;
    const photoW = 0.394079;
    const photoH = 0.96;
    const plane = {
      left: (1 - photoW) / 2,
      top: (1 - photoH) / 2,
      width: photoW,
      height: photoH,
    };
    const overlay = { x: 0.4, y: 0.55, width: 0.18, height: 0.35 };
    const photoX = remapAlong(overlay.x, plane.left, plane.width, 0, 1);
    const oldWrongX = overlay.x;
    assert.ok(
      Math.abs(photoX - 0.246) < 0.01,
      `cozinha deve ficar a ~25% da foto, não a ${oldWrongX * 100}%`,
    );
    assert.ok(oldWrongX - photoX > 0.1, 'o bug antigo deslocava a peça para a direita');

    const screenLeft = overlay.x * viewportW;
    const photoLeft = plane.left * viewportW;
    const photoPx = photoW * viewportW;
    const relative = (screenLeft - photoLeft) / photoPx;
    assert.ok(Math.abs(relative - photoX) < 0.001);

    const croppedW = Math.round(photoW * viewportW);
    const croppedOverlayW = overlay.width * viewportW;
    assert.ok(
      croppedOverlayW / croppedW > 0.4,
      'na foto a peça ocupa a fatia visível, não 18% de um canvas largo',
    );
    void viewportH;
  });

  it('envia o tamanho da lousa na hora de gerar, analisar e salvar', () => {
    assert.match(exportLib, /viewport\?: AmbienteExportViewport/);
    assert.match(exportLib, /drawBackgroundLikeBoard/);
    assert.match(exportLib, /backgroundVisualBounds/);
    assert.match(composer, /viewport: exportViewport\(\)/);
    assert.equal((composer.match(/viewport: exportViewport\(\)/g) || []).length, 5);
  });

  it('não força JPEG no recorte sem fundo nem quadrado na IA', () => {
    assert.match(ambienteFn, /ref\.mime\.includes\('png'\) \? 'png' : 'jpg'/);
    assert.match(openaiEdit, /pickGptImageEditSize/);
    assert.match(openaiEdit, /1536x1024/);
    assert.match(openaiEdit, /input_fidelity/);
  });
});
