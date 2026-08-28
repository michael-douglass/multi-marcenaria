/**
 * Polyfills usados pelo pdfjs-dist 5.x em runtime principal e no worker.
 */

export function installMathPolyfills(): void {
  if (typeof Math.sumPrecise === 'function') return;

  Math.sumPrecise = function sumPrecise(numbers: Iterable<number>): number {
    let sum = 0;
    for (const n of numbers) {
      sum += Number(n) || 0;
    }
    return sum;
  };
}

/** Map.prototype.getOrInsertComputed (ES2024+) — evita crash no pdfjs-dist 5.x */
export function installMapPolyfills(): void {
  if (typeof Map.prototype.getOrInsertComputed === 'function') return;

  Map.prototype.getOrInsertComputed = function <K, V>(
    this: Map<K, V>,
    key: K,
    callback: () => V
  ): V {
    if (this.has(key)) {
      return this.get(key) as V;
    }
    const value = callback();
    this.set(key, value);
    return value;
  };
}

export function installPdfJsPolyfills(): void {
  installMathPolyfills();
  installMapPolyfills();
}

/** Código mínimo injetado no início do pdf.worker (contexto isolado do bundle principal). */
export const PDF_WORKER_POLYFILL_SCRIPT = `
if (typeof Math.sumPrecise !== "function") {
  Math.sumPrecise = function (numbers) {
    var sum = 0;
    if (numbers && typeof numbers[Symbol.iterator] === "function") {
      var it = numbers[Symbol.iterator]();
      var step = it.next();
      while (!step.done) {
        sum += +step.value || 0;
        step = it.next();
      }
    }
    return sum;
  };
}
if (typeof Map.prototype.getOrInsertComputed !== "function") {
  Map.prototype.getOrInsertComputed = function (key, callback) {
    if (this.has(key)) return this.get(key);
    var value = callback();
    this.set(key, value);
    return value;
  };
}
`;
