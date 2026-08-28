/**
 * Entrada do Web Worker do PDF.js — polyfills ES2024 antes do bundle do pdfjs-dist.
 * O worker roda em contexto isolado; installPdfJsPolyfills() no main não alcança aqui.
 */
import { installPdfJsPolyfills } from './map-polyfills';

installPdfJsPolyfills();

import 'pdfjs-dist/build/pdf.worker.min.mjs';
