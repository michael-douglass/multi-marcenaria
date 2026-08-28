import type { Assinaturas } from '@/lib/contratos-print';

export interface ContratoDocumentoProps {
  conteudo: string;
  logoUrl?: string | null;
  nomeFantasia?: string | null;
  cnpjCabecalho?: string | null;
  assinaturas: Assinaturas;
  className?: string;
}

const LOCAL_DATA =
  'Local e Data: ____________________________________________, _____ de _____________________ de ________.';

export function ContratoDocumento({
  conteudo,
  logoUrl,
  nomeFantasia,
  cnpjCabecalho,
  assinaturas,
  className = '',
}: ContratoDocumentoProps) {
  const temCabecalho = !!(logoUrl || nomeFantasia || cnpjCabecalho);

  return (
    <div
      className={`contrato-documento w-full max-w-[210mm] shrink-0 bg-white text-gray-900 shadow-2xl rounded-sm ${className}`}
      style={{
        minHeight: '297mm',
        padding: '25mm 20mm',
        fontFamily: '"Times New Roman", Times, serif',
      }}
    >
      {temCabecalho && (
        <>
          <div className="flex items-center gap-4 mb-4 max-w-full">
            {logoUrl && (
              <img
                src={logoUrl}
                alt="Logo"
                className="max-h-16 max-w-[120px] object-contain shrink-0"
              />
            )}
            <div className="min-w-0 flex-1">
              {nomeFantasia && (
                <p className="text-lg font-bold leading-tight break-words">{nomeFantasia}</p>
              )}
              {cnpjCabecalho && (
                <p className="text-sm text-gray-500 break-words">CNPJ: {cnpjCabecalho}</p>
              )}
            </div>
          </div>
          <hr className="border-gray-300 mb-6" />
        </>
      )}

      <div
        className="text-[12pt] leading-[1.8] text-gray-800 text-justify break-words"
        style={{
          whiteSpace: 'pre-wrap',
          overflowWrap: 'break-word',
          wordBreak: 'break-word',
          hyphens: 'auto',
          maxWidth: '100%',
        }}
      >
        {conteudo || (
          <span className="text-gray-400 italic">O conteúdo do contrato aparecerá aqui.</span>
        )}
      </div>

      <div className="mt-12 pt-6 border-t border-gray-300 max-w-full">
          <p
            className="text-[11pt] text-gray-600 mb-12 break-words"
            style={{ overflowWrap: 'break-word' }}
          >
            {LOCAL_DATA}
          </p>
          <div
            className="grid gap-8 w-full max-w-full"
            style={{ gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)' }}
          >
            <div className="min-w-0 text-center">
              <div className="w-full max-w-full border-b border-gray-700 mx-auto mb-2 h-0" />
              {assinaturas.nomeCliente && (
                <p className="text-[11pt] font-bold text-gray-800 break-words">
                  {assinaturas.nomeCliente}
                </p>
              )}
              <p className="text-[10pt] text-gray-500 mt-0.5 break-words">
                CPF: {assinaturas.cpfCliente || '_____________________'}
              </p>
              <p className="text-[10pt] italic text-gray-500 mt-1">Contratante</p>
            </div>
            <div className="min-w-0 text-center">
              <div className="w-full max-w-full border-b border-gray-700 mx-auto mb-2 h-0" />
              {(assinaturas.razaoSocialEmpresa || assinaturas.nomeEmpresa) && (
                <p className="text-[11pt] font-bold text-gray-800 break-words">
                  {assinaturas.razaoSocialEmpresa || assinaturas.nomeEmpresa}
                </p>
              )}
              <p className="text-[10pt] text-gray-500 mt-0.5 break-words">
                CNPJ: {assinaturas.cnpjEmpresa || '_____________________'}
              </p>
              <p className="text-[10pt] italic text-gray-500 mt-1">Contratada</p>
            </div>
          </div>
      </div>
    </div>
  );
}
