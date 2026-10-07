import { useMemo } from 'react'
import {
  buildQuotePresentationBodyHtml,
  QUOTE_PRESENTATION_CSS,
} from '@/lib/orcamentos-ia/quote-presentation-print'
import type { QuotePresentationLayout } from '@/lib/orcamentos-ia/quote-presentation'

interface QuotePresentationPreviewProps {
  layout: QuotePresentationLayout
  className?: string
}

/** Preview A4 WYSIWYG — mesmo HTML/CSS da impressão. */
export function QuotePresentationPreview({ layout, className }: QuotePresentationPreviewProps) {
  const srcDoc = useMemo(() => {
    const body = buildQuotePresentationBodyHtml(layout)
    return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Raleway:wght@500;600;700&display=swap" rel="stylesheet" />
  <style>
    ${QUOTE_PRESENTATION_CSS}
    html, body { background: #f4f1ec; }
    body { padding: 12px 0 24px; }
  </style>
</head>
<body>${body}</body>
</html>`
  }, [layout])

  return (
    <iframe
      title="Pré-visualização da proposta"
      className={className}
      srcDoc={srcDoc}
      sandbox="allow-same-origin"
      style={{
        width: '100%',
        minHeight: '70vh',
        border: 'none',
        borderRadius: 12,
        background: '#f4f1ec',
      }}
    />
  )
}
