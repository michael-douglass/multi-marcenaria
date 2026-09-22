import path from 'path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: [
        'garbo-logo.png',
        'apple-touch-icon.png',
        'pwa-192x192.png',
        'pwa-512x512.png',
      ],
      manifest: {
        name: 'GARBO Movelaria — Sistema Financeiro',
        short_name: 'GARBO',
        description: 'Gestão financeira, obras e operação — GARBO Movelaria',
        theme_color: '#f2d892',
        background_color: '#2a1812',
        display: 'standalone',
        orientation: 'any',
        scope: '/',
        // Marca abertura pelo ícone do PWA para podermos retomar a última tela
        // (ex.: bater ponto), em vez de cair sempre na home.
        start_url: '/?src=pwa',
        lang: 'pt-BR',
        categories: ['business', 'finance'],
        icons: [
          {
            src: 'pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        // O CRM deixou o JS principal acima de 5 MB; o padrão do Workbox é 2 MiB e derruba o build.
        maximumFileSizeToCacheInBytes: 8 * 1024 * 1024,
        cleanupOutdatedCaches: true,
        skipWaiting: true,
        clientsClaim: true,
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2,webmanifest}'],
        navigateFallback: 'index.html',
        navigateFallbackDenylist: [/^\/api\//],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'garbo-google-fonts-stylesheets',
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 365,
              },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'garbo-google-fonts-webfonts',
              expiration: {
                maxEntries: 30,
                maxAgeSeconds: 60 * 60 * 24 * 365,
              },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          // Não interceptar supabase.co: no celular o cache do app
          // (service worker) quebra o login com “Failed to fetch”.
        ],
      },
      // Em desenvolvimento o service worker mistura arquivos antigos com novos
      // e quebra telas que dependem de "provedor" (ex.: calendário de obras).
      devOptions: {
        enabled: false,
      },
    }),
  ],
  resolve: {
    dedupe: ['react', 'react-dom'],
    alias: [
      { find: '@', replacement: path.resolve(__dirname, './src') },
      // Força o unzip do navegador (o do Node ignora arrayBuffer e quebra no Vite).
      {
        find: path.resolve(__dirname, 'node_modules/mammoth/lib/unzip.js'),
        replacement: path.resolve(__dirname, 'node_modules/mammoth/browser/unzip.js'),
      },
      {
        find: path.resolve(__dirname, 'node_modules/mammoth/lib/docx/files.js'),
        replacement: path.resolve(__dirname, 'node_modules/mammoth/browser/docx/files.js'),
      },
    ],
  },
  server: {
    port: 3000,
    strictPort: true,
    host: true,
    // Túnel Cloudflare (trycloudflare.com) para testar no celular / outro lugar.
    allowedHosts: ['.trycloudflare.com'],
    headers: {
      'Permissions-Policy': 'geolocation=(self), camera=(self)',
    },
    // Docs/PDF da Planilha 4.0 no Windows às vezes travam o file watcher (EBUSY).
    watch: {
      ignored: ['**/orcamento-com-IA/**', '**/dist/**'],
    },
  },
  preview: {
    port: 3000,
    strictPort: true,
    host: true,
    headers: {
      'Permissions-Policy': 'geolocation=(self), camera=(self)',
    },
  },
  build: {
    chunkSizeWarningLimit: 1600,
    rollupOptions: {
      output: {
        manualChunks(id) {
          const file = id.replace(/\\/g, '/')
          if (!file.includes('/node_modules/')) return
          // 3D e PDF saem do pacote principal; o resto das libs fica junto
          // para não criar ciclo React ↔ vendor (isso quebra o app no navegador).
          if (file.includes('/node_modules/three/') || file.includes('/node_modules/@react-three/')) {
            return 'vendor-three'
          }
          if (
            file.includes('/node_modules/jspdf') ||
            file.includes('/node_modules/pdfjs') ||
            file.includes('/node_modules/html2canvas')
          ) {
            return 'vendor-pdf'
          }
          return 'vendor'
        },
      },
    },
  },
})
