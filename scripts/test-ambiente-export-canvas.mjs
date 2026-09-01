/**
 * Simula a montagem da lousa no Chromium e confere pixels.
 * Rode: node scripts/test-ambiente-export-canvas.mjs
 */
import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const result = await (async () => {
  const browser = await chromium.launch({ headless: true, channel: 'chrome' });
  const page = await browser.newPage();
  await page.setContent('<canvas id="c"></canvas>');

  const metrics = await page.evaluate(() => {
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

    const room = document.createElement('canvas');
    room.width = 800;
    room.height = 646;
    const roomCtx = room.getContext('2d');
    if (!roomCtx) throw new Error('room ctx');
    roomCtx.fillStyle = '#c4a574';
    roomCtx.fillRect(0, 0, 800, 646);
    roomCtx.fillStyle = '#5b4636';
    roomCtx.fillRect(0, 420, 800, 226);

    const kitchen = document.createElement('canvas');
    kitchen.width = 400;
    kitchen.height = 400;
    const kCtx = kitchen.getContext('2d');
    if (!kCtx) throw new Error('kitchen ctx');
    kCtx.clearRect(0, 0, 400, 400);
    kCtx.fillStyle = '#2ecc71';
    kCtx.fillRect(80, 40, 240, 320);

    function containedRectInBox(boxW, boxH, contentW, contentH) {
      const fit = Math.min(boxW / contentW, boxH / contentH);
      const dw = contentW * fit;
      const dh = contentH * fit;
      return { dx: (boxW - dw) / 2, dy: (boxH - dh) / 2, dw, dh };
    }

    const board = document.createElement('canvas');
    board.width = viewportW;
    board.height = viewportH;
    const boardCtx = board.getContext('2d');
    if (!boardCtx) throw new Error('board ctx');
    boardCtx.fillStyle = '#1a100c';
    boardCtx.fillRect(0, 0, viewportW, viewportH);
    const elemW = photoW * viewportW;
    const elemH = photoH * viewportH;
    boardCtx.drawImage(room, (viewportW - elemW) / 2, (viewportH - elemH) / 2, elemW, elemH);

    const boxW = overlay.width * viewportW;
    const boxH = overlay.height * viewportH;
    const contained = containedRectInBox(boxW, boxH, kitchen.width, kitchen.height);
    boardCtx.drawImage(
      kitchen,
      overlay.x * viewportW + contained.dx,
      overlay.y * viewportH + contained.dy,
      contained.dw,
      contained.dh,
    );

    const cropX = Math.round(plane.left * viewportW);
    const cropY = Math.round(plane.top * viewportH);
    const cropW = Math.round(plane.width * viewportW);
    const cropH = Math.round(plane.height * viewportH);
    const cropped = document.createElement('canvas');
    cropped.width = cropW;
    cropped.height = cropH;
    const cropCtx = cropped.getContext('2d');
    if (!cropCtx) throw new Error('crop ctx');
    cropCtx.drawImage(board, cropX, cropY, cropW, cropH, 0, 0, cropW, cropH);

    const old = document.createElement('canvas');
    old.width = 1024;
    old.height = Math.round(1024 / (800 / 646));
    const oldCtx = old.getContext('2d');
    if (!oldCtx) throw new Error('old ctx');
    oldCtx.fillStyle = '#1a100c';
    oldCtx.fillRect(0, 0, old.width, old.height);
    oldCtx.drawImage(room, 0, 0, old.width, old.height);
    oldCtx.drawImage(
      kitchen,
      overlay.x * old.width,
      overlay.y * old.height,
      overlay.width * old.width,
      overlay.height * old.height,
    );

    function sample(canvas, nx, ny) {
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('sample ctx');
      const x = Math.min(canvas.width - 1, Math.max(0, Math.round(nx * canvas.width)));
      const y = Math.min(canvas.height - 1, Math.max(0, Math.round(ny * canvas.height)));
      const p = ctx.getImageData(x, y, 1, 1).data;
      return { r: p[0], g: p[1], b: p[2] };
    }

    const isGreen = (c) => c.g > 150 && c.g > c.r + 40 && c.g > c.b + 40;
    const isWood = (c) => c.r > 140 && c.g > 100 && c.b < 140;
    const isDark = (c) => c.r < 50 && c.g < 40 && c.b < 40;

    function scanGreen(canvas) {
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('scan ctx');
      const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
      let count = 0;
      let minX = canvas.width;
      let maxX = 0;
      let minY = canvas.height;
      let maxY = 0;
      for (let y = 0; y < canvas.height; y += 4) {
        for (let x = 0; x < canvas.width; x += 4) {
          const i = (y * canvas.width + x) * 4;
          const r = data[i];
          const g = data[i + 1];
          const b = data[i + 2];
          if (g > 150 && g > r + 40 && g > b + 40) {
            count += 1;
            minX = Math.min(minX, x);
            maxX = Math.max(maxX, x);
            minY = Math.min(minY, y);
            maxY = Math.max(maxY, y);
          }
        }
      }
      return {
        count,
        nx0: minX / canvas.width,
        nx1: maxX / canvas.width,
        ny0: minY / canvas.height,
        ny1: maxY / canvas.height,
      };
    }

    const newGreen = scanGreen(cropped);
    const oldGreen = scanGreen(old);

    const newAtKitchen = sample(cropped, 0.38, 0.734);
    const newAtRoom = sample(cropped, 0.08, 0.2);
    const oldAtSamePhotoSpot = sample(old, 0.38, 0.734);
    const oldStretched = sample(old, 0.49, 0.72);

    return {
      cropW,
      cropH,
      contained,
      newAtKitchen,
      newAtRoom,
      oldAtSamePhotoSpot,
      oldStretched,
      newGreen,
      oldGreen,
      newKitchenGreen: isGreen(newAtKitchen),
      newRoomWood: isWood(newAtRoom),
      oldMissedKitchen: !isGreen(oldAtSamePhotoSpot),
      oldHasStretchOrDark: isDark(oldStretched) || isGreen(oldStretched),
    };
  });

  await browser.close();
  return metrics;
})();

console.log(JSON.stringify({
  crop: `${result.cropW}x${result.cropH}`,
  newGreen: result.newGreen,
  oldGreen: result.oldGreen,
  contained: result.contained,
}, null, 2));

assert.ok(result.newGreen.count > 50, 'a cozinha recortada precisa aparecer no recorte da foto');
assert.ok(
  result.newGreen.nx0 < result.oldGreen.nx0 - 0.03,
  'a peça precisa ficar mais à esquerda, colada na foto como na lousa',
);
assert.ok(
  result.newGreen.nx1 - result.newGreen.nx0 > result.oldGreen.nx1 - result.oldGreen.nx0,
  'a peça não pode encolher no canvas da foto',
);
assert.equal(result.newRoomWood, true, 'o cômodo ao lado não pode ser pintado de verde');
assert.ok(Math.abs(result.contained.dw - result.contained.dh) < 0.01, 'recorte quadrado não estica');
assert.ok(result.cropW > 500 && result.cropH > 400, 'o recorte é a foto, não a lousa larga');

console.log('ok', {
  crop: `${result.cropW}x${result.cropH}`,
  kitchen: result.newAtKitchen,
  room: result.newAtRoom,
});
