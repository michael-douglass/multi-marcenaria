/** Estilos compartilhados — preview na tela e impressão/PDF idênticos */

export const CONTRATO_PAGINA_PADDING = '25mm 20mm';

export const CONTRATO_DOCUMENT_CSS = `
  * { box-sizing: border-box; margin: 0; padding: 0; }

  body {
    font-family: 'Times New Roman', Times, serif;
    font-size: 12pt;
    color: #000;
    background: #fff;
  }

  .pagina {
    width: 210mm;
    max-width: 100%;
    min-height: 297mm;
    padding: ${CONTRATO_PAGINA_PADDING};
    margin: 0 auto;
    overflow: hidden;
  }

  .cabecalho {
    display: flex;
    align-items: center;
    gap: 16px;
    margin-bottom: 8px;
    max-width: 100%;
  }

  .logo {
    max-height: 60px;
    max-width: 120px;
    object-fit: contain;
    flex-shrink: 0;
  }

  .empresa-info {
    flex: 1;
    min-width: 0;
  }

  .empresa-nome {
    font-size: 14pt;
    font-weight: bold;
    margin-bottom: 2px;
    word-wrap: break-word;
    overflow-wrap: break-word;
  }

  .empresa-cnpj {
    font-size: 10pt;
    color: #444;
  }

  .divisor {
    border: none;
    border-top: 1px solid #333;
    margin: 10px 0 20px 0;
  }

  .conteudo {
    line-height: 1.8;
    text-align: justify;
    word-wrap: break-word;
    overflow-wrap: break-word;
    word-break: break-word;
    hyphens: auto;
    max-width: 100%;
    white-space: pre-wrap;
  }

  .assinaturas {
    margin-top: 48px;
    padding-top: 24px;
    border-top: 1px solid #ccc;
    max-width: 100%;
  }

  .local-data {
    font-size: 11pt;
    margin-bottom: 48px;
    word-wrap: break-word;
    overflow-wrap: break-word;
  }

  .linha-assinatura {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 32px;
    width: 100%;
    max-width: 100%;
  }

  .assinante {
    min-width: 0;
    text-align: center;
  }

  .linha-sign {
    width: 100%;
    max-width: 100%;
    height: 0;
    border-bottom: 1px solid #333;
    margin: 0 auto 8px;
  }

  .sign-nome {
    font-size: 11pt;
    font-weight: bold;
    word-wrap: break-word;
    overflow-wrap: break-word;
  }

  .sign-doc {
    font-size: 10pt;
    color: #444;
    margin-top: 2px;
    word-wrap: break-word;
    overflow-wrap: break-word;
  }

  .sign-papel {
    font-size: 10pt;
    font-style: italic;
    color: #555;
    margin-top: 4px;
  }

  .page-break-before {
    page-break-before: always;
  }

  .anexos-secao {
    margin-top: 48px;
    padding-top: 24px;
    border-top: 1px solid #ccc;
  }

  .anexos-titulo {
    font-size: 13pt;
    font-weight: bold;
    margin-bottom: 20px;
  }

  .anexo-item {
    margin-bottom: 24px;
    page-break-inside: avoid;
  }

  .anexo-titulo {
    font-size: 11pt;
    font-weight: bold;
    margin-bottom: 8px;
  }

  .anexo-link {
    font-size: 10pt;
    color: #333;
  }

  .anexo-img {
    max-width: 100%;
    height: auto;
    margin-top: 8px;
    border: 1px solid #ddd;
  }

  @media print {
    body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .pagina { margin: 0; padding: 15mm 15mm 20mm 25mm; }
  }
`;
