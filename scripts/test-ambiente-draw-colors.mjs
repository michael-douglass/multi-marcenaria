/**
 * Cores da lousa do ambiente e preenchimento derivado do traço.
 * Rode: node --test scripts/test-ambiente-draw-colors.mjs
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const drawLib = readFileSync(join(root, 'src/lib/lead-ai-ambiente-draw.ts'), 'utf8');
const toolbar = readFileSync(
  join(root, 'src/components/leads/ambiente/AmbienteDrawToolbar.tsx'),
  'utf8',
);
const popup = readFileSync(
  join(root, 'src/components/layout/LeadAIAnalysisBackgroundPopup.tsx'),
  'utf8',
);
const composer = readFileSync(join(root, 'src/components/leads/LeadAIAmbienteComposer.tsx'), 'utf8');
const renderTab = readFileSync(join(root, 'src/components/leads/LeadAIRenderTab.tsx'), 'utf8');

function inkFillFromStroke(stroke, alpha = 0.18) {
  const raw = stroke.trim().replace('#', '');
  const hex =
    raw.length === 3
      ? raw
          .split('')
          .map((char) => char + char)
          .join('')
      : raw;
  if (hex.length !== 6 || !/^[0-9a-fA-F]+$/.test(hex)) return 'rgba(255, 246, 234, 0.16)';
  const n = Number.parseInt(hex, 16);
  if (!Number.isFinite(n)) return 'rgba(255, 246, 234, 0.16)';
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

describe('lousa do ambiente — cores de desenho', () => {
  it('expõe paleta com várias cores', () => {
    assert.match(drawLib, /AMBIENTE_INK_PRESETS/);
    assert.match(drawLib, /#e85d4c/);
    assert.match(drawLib, /#4aa3ff/);
    assert.match(drawLib, /#7dce7a/);
    assert.match(toolbar, /Cor do desenho/);
    assert.match(toolbar, /onStrokeChange/);
  });

  it('converte o traço em preenchimento transparente da mesma cor', () => {
    assert.equal(inkFillFromStroke('#e85d4c'), 'rgba(232, 93, 76, 0.18)');
    assert.equal(inkFillFromStroke('#4aa3ff', 0.35), 'rgba(74, 163, 255, 0.35)');
    assert.equal(inkFillFromStroke('not-a-color'), 'rgba(255, 246, 234, 0.16)');
  });

  it('grava a cor escolhida no traço novo', () => {
    assert.match(composer, /stroke: drawColorRef\.current/);
    assert.match(composer, /handleDrawStrokeChange/);
  });
});

describe('renderização de ambiente em segundo plano', () => {
  it('mostra a tarefa no painel flutuante de IA', () => {
    assert.match(popup, /ambienteJobs/);
    assert.match(popup, /kind: 'ambiente'/);
    assert.match(popup, /dismissAmbienteJob/);
    assert.match(popup, /IA criando ambiente/);
  });

  it('não espera a IA terminar para liberar a lousa', () => {
    assert.match(composer, /void onRender\(/);
    assert.match(composer, /setIsFullscreen\(false\)/);
    assert.match(renderTab, /void startBackgroundAmbienteRender/);
    assert.doesNotMatch(composer, /disabled \|\| isBusy \|\| isAnalyzing/);
  });
});
