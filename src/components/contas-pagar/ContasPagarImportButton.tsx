import { useMemo, useRef, useState, type ChangeEvent } from 'react'
import { Upload } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { ModalFormFooter } from '@/components/ui/ModalFormFooter'
import { Badge } from '@/components/ui/Badge'
import {
  buildContasPagarImportPreview,
  type ContaPagarImportPreview,
} from '@/lib/contas-pagar-import'
import { parseSpreadsheetFile } from '@/lib/parse-spreadsheet'
import { showToast } from '@/lib/toast'
import { fmtCur, fmtDate } from '@/lib/utils'
import type { CobrancaImportItem } from '@/hooks/useContasPagar'
import type { ContaPagar, Fornecedor } from '@/types'

const IMPORT_TIMEOUT_MS = 60_000

interface ContasPagarImportButtonProps {
  fornecedores: Fornecedor[]
  contasExistentes: ContaPagar[]
  readOnly?: boolean
  onImport: (items: CobrancaImportItem[]) => Promise<number>
}

async function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
  message: string,
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => reject(new Error(message)), ms)
      }),
    ])
  } finally {
    if (timer) clearTimeout(timer)
  }
}

export function ContasPagarImportButton({
  fornecedores,
  contasExistentes,
  readOnly = false,
  onImport,
}: ContasPagarImportButtonProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [previewOpen, setPreviewOpen] = useState(false)
  const [preview, setPreview] = useState<ContaPagarImportPreview | null>(null)
  const [fileName, setFileName] = useState('')
  const [loadingFile, setLoadingFile] = useState(false)
  const [importing, setImporting] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [mostrarIgnoradas, setMostrarIgnoradas] = useState(false)

  const totalImportar = useMemo(
    () => preview?.prontas.reduce((sum, row) => sum + row.valor, 0) ?? 0,
    [preview],
  )

  if (readOnly) return null

  const clearInput = () => {
    if (inputRef.current) inputRef.current.value = ''
  }

  const reset = () => {
    setPreview(null)
    setFileName('')
    setErro(null)
    setMostrarIgnoradas(false)
    setLoadingFile(false)
    setImporting(false)
    clearInput()
  }

  const closePreview = () => {
    setPreviewOpen(false)
    reset()
  }

  const openFilePicker = () => {
    if (loadingFile || importing) return
    clearInput()
    inputRef.current?.click()
  }

  const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    setLoadingFile(true)
    setErro(null)
    setPreview(null)
    setMostrarIgnoradas(false)
    setFileName(file.name)

    try {
      const matrix = await parseSpreadsheetFile(file)
      const nextPreview = buildContasPagarImportPreview(matrix, fornecedores, contasExistentes)
      setPreview(nextPreview)
      setPreviewOpen(true)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Não foi possível ler a planilha.'
      setErro(message)
      setPreviewOpen(true)
      showToast(message, 'error')
    } finally {
      setLoadingFile(false)
      clearInput()
    }
  }

  const confirmImport = async () => {
    if (!preview || preview.prontas.length === 0 || importing) return

    setImporting(true)
    setErro(null)

    try {
      const items: CobrancaImportItem[] = preview.prontas.map(row => ({
        fornecedor_id: row.fornecedorId,
        fornecedor_nome: row.fornecedor,
        descricao: row.descricao,
        observacao: row.observacao || undefined,
        valor: row.valor,
        vencimento: row.vencimento,
      }))

      const total = await withTimeout(
        onImport(items),
        IMPORT_TIMEOUT_MS,
        'A importação demorou demais. Verifique sua conexão e tente novamente.',
      )

      const ignoradas = preview.duplicadas.length + preview.erros.length
      const msg = ignoradas > 0
        ? `${total} cobrança(s) importada(s). ${ignoradas} linha(s) ignorada(s) na prévia. Se não aparecer na lista, altere o filtro de período para "Todas".`
        : `${total} cobrança(s) importada(s). Se não aparecer na lista, altere o filtro de período para "Todas".`
      showToast(msg)
      closePreview()
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Erro ao importar planilha.'
      setErro(message)
      showToast(message, 'error')
    } finally {
      setImporting(false)
    }
  }

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept=".csv,.txt,.xls,.xlsx,.xlsm,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        className="sr-only"
        onChange={event => void handleFileChange(event)}
      />

      <button
        type="button"
        className="btn btn-outline btn-sm flex items-center gap-1.5"
        onClick={openFilePicker}
        disabled={loadingFile}
        aria-busy={loadingFile}
        style={{ whiteSpace: 'nowrap' }}
      >
        <Upload className="h-3.5 w-3.5" />
        <span>{loadingFile ? 'Lendo planilha...' : 'Importar'}</span>
      </button>

      <Modal
        open={previewOpen}
        onClose={closePreview}
        title="PRÉVIA DA IMPORTAÇÃO — CONTAS A PAGAR"
        wide
        closeOnBackdrop={!importing}
      >
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm text-[#edd9c4]">
            Arquivo: <strong style={{ color: '#fffaf4' }}>{fileName || '—'}</strong>
          </p>
          <button
            type="button"
            className="btn btn-outline btn-sm"
            onClick={openFilePicker}
            disabled={loadingFile || importing}
          >
            {loadingFile ? 'Lendo...' : 'Escolher outro arquivo'}
          </button>
        </div>

        <p className="mb-4 text-sm text-[#edd9c4]">
          Confira abaixo <strong style={{ color: '#fffaf4' }}>todas as cobranças</strong> que serão criadas no sistema.
          Só depois de confirmar os dados são salvos. Cada linha vira uma cobrança única (1/1).
        </p>

        {preview && (
          <div className="mb-4 grid gap-2 sm:grid-cols-3">
            <div className="rounded-lg border border-[rgba(74,222,128,.25)] bg-[rgba(74,222,128,.08)] px-3 py-2">
              <div className="text-xs uppercase tracking-wide text-[#4ade80]">Serão adicionadas</div>
              <div className="text-lg font-bold text-[#fffaf4]">{preview.prontas.length}</div>
            </div>
            <div className="rounded-lg border border-[rgba(251,191,36,.25)] bg-[rgba(251,191,36,.08)] px-3 py-2">
              <div className="text-xs uppercase tracking-wide text-[#fbbf24]">Duplicadas (ignoradas)</div>
              <div className="text-lg font-bold text-[#fffaf4]">{preview.duplicadas.length}</div>
            </div>
            <div className="rounded-lg border border-[rgba(248,113,113,.25)] bg-[rgba(248,113,113,.08)] px-3 py-2">
              <div className="text-xs uppercase tracking-wide text-[#f87171]">Com erro (ignoradas)</div>
              <div className="text-lg font-bold text-[#fffaf4]">{preview.erros.length}</div>
            </div>
          </div>
        )}

        {erro && (
          <div className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3">
            <p className="text-sm font-semibold text-red-300">Não foi possível concluir esta etapa</p>
            <p className="mt-1 text-sm text-red-200">{erro}</p>
            <p className="mt-2 text-xs text-[#edd9c4]">
              Formatos aceitos: <strong>.xls</strong>, <strong>.xlsx</strong> e <strong>.csv</strong>.
              Se falhar, salve no Excel como CSV (separado por ponto e vírgula).
            </p>
          </div>
        )}

        {preview && preview.prontas.length > 0 && (
          <div className="mb-4">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <h3 className="section-label" style={{ fontSize: '.78rem', color: '#f2d892' }}>
                Cobranças que serão adicionadas ({preview.prontas.length})
              </h3>
              <span className="text-sm font-semibold text-[#f2d892]">
                Total: {fmtCur(totalImportar)}
              </span>
            </div>

            <div className="glass-card overflow-hidden">
              <div className="overflow-auto" style={{ maxHeight: 'min(52vh, 520px)' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid rgba(240,210,140,.18)' }}>
                      {['Linha', 'Fornecedor', 'Descrição / Referência', 'Observação', 'Vencimento', 'Parcela', 'Valor', 'Status'].map(header => (
                        <th key={header} className="section-label whitespace-nowrap px-4 py-3 text-left">
                          {header}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {preview.prontas.map(row => (
                      <tr key={`add-${row.linha}`} className="trow">
                        <td className="px-4 py-3 text-[#edd9c4]" style={{ fontSize: '.82rem' }}>
                          {row.linha}
                        </td>
                        <td className="px-4 py-3" style={{ color: '#fffaf4', maxWidth: 200 }}>
                          <div>{row.fornecedor}</div>
                          {row.fornecedorId ? (
                            <div className="mt-0.5 text-[0.72rem] text-[#4ade80]">Fornecedor cadastrado</div>
                          ) : (
                            <div className="mt-0.5 text-[0.72rem] text-[#fbbf24]">Nome livre (sem cadastro)</div>
                          )}
                        </td>
                        <td className="px-4 py-3 text-[#edd9c4]" style={{ maxWidth: 220 }}>
                          {row.descricao}
                        </td>
                        <td className="px-4 py-3 text-[#edd9c4]" style={{ maxWidth: 160 }}>
                          {row.observacao || '—'}
                        </td>
                        <td className="px-4 py-3 text-[#edd9c4]" style={{ fontSize: '.85rem' }}>
                          {fmtDate(row.vencimento)}
                        </td>
                        <td className="px-4 py-3 text-[#edd9c4]" style={{ fontSize: '.85rem' }}>
                          1/1
                        </td>
                        <td className="px-4 py-3 font-semibold text-[#f2d892]">
                          {fmtCur(row.valor)}
                        </td>
                        <td className="px-4 py-3">
                          <Badge status="pendente" />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr style={{ borderTop: '1px solid rgba(240,210,140,.18)', background: 'rgba(240,210,140,.04)' }}>
                      <td colSpan={6} className="px-4 py-3 text-right text-sm font-bold text-[#f2d892]">
                        Total a importar
                      </td>
                      <td className="px-4 py-3 font-bold text-[#f2d892]">
                        {fmtCur(totalImportar)}
                      </td>
                      <td />
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          </div>
        )}

        {preview && preview.prontas.length === 0 && !erro && (
          <div className="mb-4 rounded-lg border border-[rgba(248,113,113,.25)] bg-[rgba(248,113,113,.08)] px-4 py-3 text-sm text-[#f87171]">
            Nenhuma cobrança nova para adicionar. Todas as linhas estão duplicadas ou com erro.
            Use o botão <strong>Escolher outro arquivo</strong> para tentar outra planilha.
          </div>
        )}

        {preview && (preview.duplicadas.length > 0 || preview.erros.length > 0) && (
          <div className="mb-2">
            <button
              type="button"
              className="btn btn-outline btn-sm"
              onClick={() => setMostrarIgnoradas(prev => !prev)}
            >
              {mostrarIgnoradas ? 'Ocultar' : 'Ver'} linhas ignoradas ({preview.duplicadas.length + preview.erros.length})
            </button>
          </div>
        )}

        {preview && mostrarIgnoradas && (preview.duplicadas.length > 0 || preview.erros.length > 0) && (
          <div
            className="overflow-auto rounded-lg border border-[rgba(240,210,140,.18)]"
            style={{ maxHeight: 220 }}
          >
            <table className="w-full text-sm">
              <thead>
                <tr style={{ background: 'rgba(240,210,140,.08)' }}>
                  <th className="px-3 py-2 text-left text-[#f2d892]">Linha</th>
                  <th className="px-3 py-2 text-left text-[#f2d892]">Motivo</th>
                  <th className="px-3 py-2 text-left text-[#f2d892]">Fornecedor</th>
                  <th className="px-3 py-2 text-left text-[#f2d892]">Descrição</th>
                  <th className="px-3 py-2 text-left text-[#f2d892]">Vencimento</th>
                  <th className="px-3 py-2 text-right text-[#f2d892]">Valor</th>
                </tr>
              </thead>
              <tbody>
                {[...preview.duplicadas, ...preview.erros].map(row => (
                  <tr key={`skip-${row.linha}-${row.status}`} className="border-t border-[rgba(240,210,140,.08)]">
                    <td className="px-3 py-2 text-[#edd9c4]">{row.linha}</td>
                    <td className="px-3 py-2">
                      <span style={{
                        color: row.status === 'duplicada' ? '#fbbf24' : '#f87171',
                        fontWeight: 700,
                        fontSize: '.75rem',
                      }}>
                        {row.status === 'duplicada' ? 'Duplicada' : 'Erro'}
                      </span>
                      {row.mensagem && (
                        <div className="text-xs text-[#edd9c4]">{row.mensagem}</div>
                      )}
                    </td>
                    <td className="px-3 py-2 text-[#fffaf4]">{row.fornecedor || '—'}</td>
                    <td className="px-3 py-2 text-[#edd9c4]">{row.descricao || '—'}</td>
                    <td className="px-3 py-2 text-[#edd9c4]">
                      {row.vencimento ? fmtDate(row.vencimento) : '—'}
                    </td>
                    <td className="px-3 py-2 text-right text-[#fffaf4]">
                      {row.valor > 0 ? fmtCur(row.valor) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <ModalFormFooter
          onCancel={closePreview}
          onSubmit={() => void confirmImport()}
          submitLabel={`Confirmar e adicionar ${preview?.prontas.length ?? 0} cobrança(s)`}
          submittingLabel="Importando..."
          submitting={importing}
          submitDisabled={importing || !preview || preview.prontas.length === 0}
        />
      </Modal>
    </>
  )
}
