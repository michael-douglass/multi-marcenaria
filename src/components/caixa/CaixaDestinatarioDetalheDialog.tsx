import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { Copy, MapPin, Phone, QrCode, UserRound } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/button'
import { CaixaDestinatarioFoil } from '@/components/caixa/CaixaDestinatarioFoil'
import { CaixaQrTrigger } from '@/components/caixa/CaixaQrTrigger'
import { useCaixaDestinatarioContato } from '@/hooks/useCaixaDestinatarioContato'
import { TIPO_PIX_LABELS, type TipoChavePix } from '@/hooks/usePrestadorPerfil'
import { copyText, stripWhitespace } from '@/lib/qr/copy-text'
import { generateQrDataUrl } from '@/lib/qr/generate-qr'
import { gerarPixPayload } from '@/lib/pixBrcode'
import {
  formatTelefonePrestador,
  telefonePrestadorDigits,
  telefonePrestadorHref,
} from '@/lib/pontua-garbo-arquiteto'
import { LoadingState } from '@/components/ui/EmptyState'
import type { TipoDestinatarioCaixa } from '@/types'

interface CaixaDestinatarioDetalheDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  destinatarioNome: string | null
  destinatarioId: string | null
  tipoDestinatario?: TipoDestinatarioCaixa | string | null
  onAbrirQr: (seed: string) => void
}

export function CaixaDestinatarioDetalheDialog({
  open,
  onOpenChange,
  destinatarioNome,
  destinatarioId,
  tipoDestinatario,
  onAbrirQr,
}: CaixaDestinatarioDetalheDialogProps) {
  const { contato, loading, error } = useCaixaDestinatarioContato(
    open ? destinatarioNome : null,
    open ? destinatarioId : null,
  )

  const [pixQrUrl, setPixQrUrl] = useState<string | null>(null)
  const [pixPayload, setPixPayload] = useState<string | null>(null)

  useEffect(() => {
    if (!open || !contato?.chavePix) {
      setPixQrUrl(null)
      setPixPayload(null)
      return
    }

    const chave = stripWhitespace(contato.chavePix)
    const payload = gerarPixPayload({
      chave,
      nomeBeneficiario: contato.nomePessoa,
    })
    setPixPayload(payload)

    let cancelled = false
    void generateQrDataUrl(payload)
      .then(url => {
        if (!cancelled) setPixQrUrl(url)
      })
      .catch(() => {
        if (!cancelled) setPixQrUrl(null)
      })

    return () => {
      cancelled = true
    }
  }, [open, contato?.chavePix, contato?.nomePessoa])

  const telefoneFormatado = formatTelefonePrestador(contato?.telefone)
  const telefoneHref = telefonePrestadorHref(contato?.telefone)
  const chavePix = contato?.chavePix ? stripWhitespace(contato.chavePix) : null
  const tipoPix =
    contato?.tipoChavePix && contato.tipoChavePix in TIPO_PIX_LABELS
      ? TIPO_PIX_LABELS[contato.tipoChavePix as TipoChavePix]
      : contato?.tipoChavePix

  return (
    <Modal
      open={open}
      onClose={() => onOpenChange(false)}
      title="Ficha do destinatário"
      headerActions={
        <CaixaQrTrigger
          onClick={() => onAbrirQr(chavePix ?? '')}
          title="Sistema de QR Code"
        />
      }
    >
      <div className="relative overflow-hidden rounded-xl border border-[rgba(240,210,140,0.22)] bg-[rgba(18,8,4,0.55)]">
        <CaixaDestinatarioFoil />
        <div className="relative z-10 space-y-5 p-4 sm:p-5">
          {loading ? (
            <LoadingState message="Buscando telefone, endereço e PIX…" />
          ) : error ? (
            <p className="text-sm text-red-300">{error}</p>
          ) : (
            <>
              <div className="flex items-start gap-3">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#f2d892]/15 text-[#f2d892] ring-1 ring-[#f2d892]/30">
                  <UserRound className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <p className="text-[0.65rem] font-bold uppercase tracking-[0.18em] text-[#edd9c4]">
                    {contato?.origem ?? tipoDestinatario ?? 'Destinatário'}
                  </p>
                  <h3 className="font-display text-xl leading-tight text-cream sm:text-2xl">
                    {contato?.nomePessoa ?? destinatarioNome ?? 'Destinatário'}
                  </h3>
                  {contato && contato.nomeExibicao !== contato.nomePessoa ? (
                    <p className="mt-0.5 text-xs text-[#d4bc9f]">{contato.nomeExibicao}</p>
                  ) : null}
                </div>
              </div>

              <CampoContato
                rotulo="Telefone"
                icon={<Phone className="h-3.5 w-3.5" />}
                valorLeitura={telefoneFormatado}
                valorCopia={telefonePrestadorDigits(contato?.telefone) ?? contato?.telefone}
                href={telefoneHref}
                vazio="Telefone não cadastrado"
              />

              <CampoContato
                rotulo="Endereço"
                icon={<MapPin className="h-3.5 w-3.5" />}
                valorLeitura={contato?.endereco}
                valorCopia={contato?.endereco}
                compact={false}
                vazio="Endereço não cadastrado"
              />

              <div className="rounded-lg border border-white/10 bg-black/25 p-3 sm:p-4">
                <div className="mb-3 flex items-center justify-between gap-2">
                  <p className="flex items-center gap-1.5 text-[0.7rem] font-bold uppercase tracking-wider text-[#edd9c4]">
                    <QrCode className="h-3.5 w-3.5 text-[#f2d892]" />
                    PIX {tipoPix ? `· ${tipoPix}` : ''}
                  </p>
                  {chavePix ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-8 border-white/10 text-xs"
                      onClick={() => void copyText(chavePix, 'Chave PIX copiada sem espaços')}
                    >
                      <Copy className="h-3.5 w-3.5" />
                      Copiar chave
                    </Button>
                  ) : null}
                </div>

                {chavePix ? (
                  <p className="mb-3 break-all font-mono text-sm text-cream select-all">
                    {chavePix}
                  </p>
                ) : (
                  <p className="text-sm text-[#6b5244]">Chave PIX não cadastrada</p>
                )}

                {pixQrUrl && pixPayload ? (
                  <div className="space-y-3">
                    <div className="flex justify-center">
                      <img
                        src={pixQrUrl}
                        alt={`QR Code PIX de ${contato?.nomePessoa ?? destinatarioNome ?? 'destinatário'}`}
                        width={220}
                        height={220}
                        className="rounded-md bg-white p-2 shadow-[0_12px_28px_rgba(0,0,0,0.35)]"
                      />
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="w-full border-white/10 text-xs"
                      onClick={() => void copyText(pixPayload, 'PIX copia e cola copiado sem espaços')}
                    >
                      <Copy className="h-3.5 w-3.5" />
                      Copiar PIX (sem espaços)
                    </Button>
                  </div>
                ) : null}

                <button
                  type="button"
                  className="mt-3 w-full text-left text-[0.7rem] text-[#d4bc9f] underline-offset-4 hover:text-[#f2d892] hover:underline"
                  onClick={() => onAbrirQr(chavePix ?? '')}
                >
                  Abrir sistema de QR Code para gerar outro código
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </Modal>
  )
}

function CampoContato({
  rotulo,
  icon,
  valorLeitura,
  valorCopia,
  href,
  vazio,
  compact = true,
}: {
  rotulo: string
  icon: ReactNode
  valorLeitura: string | null | undefined
  valorCopia: string | null | undefined
  href?: string | null
  vazio: string
  compact?: boolean
}) {
  const temValor = Boolean(valorLeitura?.trim())

  return (
    <div className="rounded-lg border border-white/10 bg-black/20 px-3 py-3">
      <p className="mb-1.5 flex items-center gap-1.5 text-[0.7rem] font-bold uppercase tracking-wider text-[#edd9c4]">
        {icon}
        {rotulo}
      </p>
      {temValor ? (
        <div className="flex items-center gap-2">
          {href ? (
            <a
              href={href}
              className="min-w-0 flex-1 break-words font-display text-lg text-cream underline-offset-4 hover:underline"
            >
              {valorLeitura}
            </a>
          ) : (
            <p className="min-w-0 flex-1 break-words text-sm text-cream">{valorLeitura}</p>
          )}
          <Button
            type="button"
            size="icon"
            variant="outline"
            className="h-8 w-8 shrink-0 border-white/10"
            title={`Copiar ${rotulo.toLowerCase()}${compact ? ' sem espaços' : ''}`}
            aria-label={`Copiar ${rotulo.toLowerCase()}`}
            onClick={() =>
              void copyText(valorCopia ?? '', `${rotulo} copiado${compact ? ' sem espaços' : ''}`, {
                compact,
              })
            }
          >
            <Copy className="h-3.5 w-3.5" />
          </Button>
        </div>
      ) : (
        <p className="text-sm text-[#6b5244]">{vazio}</p>
      )}
    </div>
  )
}
