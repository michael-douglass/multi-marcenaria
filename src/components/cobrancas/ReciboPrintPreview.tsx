import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react'
import { ReciboFoilBand, type ReciboFoilBandHandle } from '@/components/cobrancas/ReciboFoilBand'
import {
  RECIBO_SHEET_CSS,
  type ReciboPrintLayout,
} from '@/lib/recibo-print'

const A4_WIDTH_PX = 794

export interface ReciboPrintPreviewHandle {
  snapshotFoil: () => string | null
}

interface ReciboPrintPreviewProps {
  layout: ReciboPrintLayout
}

export const ReciboPrintPreview = forwardRef<ReciboPrintPreviewHandle, ReciboPrintPreviewProps>(
  function ReciboPrintPreview({ layout }, ref) {
    const foilRef = useRef<ReciboFoilBandHandle>(null)
    const stageRef = useRef<HTMLDivElement>(null)
    const sheetRef = useRef<HTMLDivElement>(null)
    const [scale, setScale] = useState(0.52)
    const [sheetHeight, setSheetHeight] = useState(520)
    const [offsetX, setOffsetX] = useState(0)

    useImperativeHandle(ref, () => ({
      snapshotFoil: () => foilRef.current?.snapshot() ?? null,
    }))

    useEffect(() => {
      const stage = stageRef.current
      const sheet = sheetRef.current
      if (!stage || !sheet) return

      const apply = () => {
        const nextScale = Math.min(Math.max(stage.clientWidth / A4_WIDTH_PX, 0.28), 1)
        setScale(nextScale)
        setSheetHeight(sheet.scrollHeight)
        setOffsetX(Math.max((stage.clientWidth - A4_WIDTH_PX * nextScale) / 2, 0))
      }
      apply()
      const ro = new ResizeObserver(apply)
      ro.observe(stage)
      ro.observe(sheet)
      return () => ro.disconnect()
    }, [layout.texto, layout.clienteNome, layout.valorLabel])

    return (
      <div
        ref={stageRef}
        className="recibo-preview-stage w-full overflow-hidden"
        style={{ height: sheetHeight * scale }}
      >
        <style>{RECIBO_SHEET_CSS}</style>
        <div
          ref={sheetRef}
          style={{
            width: A4_WIDTH_PX,
            transform: `scale(${scale})`,
            transformOrigin: 'top left',
            marginLeft: offsetX,
          }}
        >
          <div className="recibo-frame">
            <article className="recibo-sheet">
              <header className="recibo-masthead">
                <div className="recibo-foil-strip">
                  <div className="recibo-foil-slot">
                    <ReciboFoilBand ref={foilRef} />
                  </div>
                </div>
                <div className="recibo-masthead-inner">
                  <img className="recibo-logo" src={layout.logoUrl} alt="GARBO Movelaria" />
                  <p className="recibo-eyebrow">Comprovante de recebimento</p>
                  <h1 className="recibo-title">Recibo</h1>
                  <p className="recibo-tag">Móveis planejados de alta qualidade</p>
                </div>
              </header>
              <section className="recibo-meta">
                <div className="recibo-meta-cell">
                  <span className="recibo-label">Recebemos de</span>
                  <div className="recibo-value">{layout.clienteNome}</div>
                </div>
                <div className="recibo-meta-cell">
                  <span className="recibo-label">Valor</span>
                  <div className="recibo-value recibo-value-gold">{layout.valorLabel}</div>
                </div>
                <div className="recibo-meta-cell">
                  <span className="recibo-label">Referente</span>
                  <div className="recibo-value">{layout.parcelaLabel}</div>
                </div>
                <div className="recibo-meta-cell">
                  <span className="recibo-label">Data e forma</span>
                  <div className="recibo-value">
                    {layout.dataPagamentoLabel} · {layout.formaPagamentoLabel}
                  </div>
                </div>
              </section>
              <div className="recibo-body">{layout.texto}</div>
              <footer className="recibo-sign">
                <div className="recibo-sign-line" />
                <p className="recibo-sign-name">Garbo Movelaria</p>
                {layout.cnpj ? <p className="recibo-sign-meta">CNPJ {layout.cnpj}</p> : null}
              </footer>
              <div className="recibo-foot-edge" aria-hidden />
            </article>
          </div>
        </div>
      </div>
    )
  },
)
