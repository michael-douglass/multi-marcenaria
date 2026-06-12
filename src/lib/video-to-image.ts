/** Captura o primeiro frame do vídeo e retorna como JPEG blob para pré-visualização. */
export async function videoFirstFrameToJpegBlob(file: File): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const video = document.createElement('video')
    video.preload = 'metadata'
    video.muted = true
    video.playsInline = true

    const cleanup = () => URL.revokeObjectURL(url)

    video.addEventListener('error', () => {
      video.removeAttribute('src')
      video.load()
      cleanup()
      reject(new Error('Não foi possível carregar o vídeo para gerar miniatura.'))
    }, { once: true })

    video.addEventListener('seeked', () => {
      const w = video.videoWidth || 320
      const h = video.videoHeight || 240
      const tw = Math.min(w, 640)
      const th = Math.round(h * tw / w) || 360
      const canvas = document.createElement('canvas')
      canvas.width = tw
      canvas.height = th
      canvas.getContext('2d')!.drawImage(video, 0, 0, tw, th)
      // limpa o src antes de revogar para o browser parar de tentar recarregar
      video.pause()
      video.removeAttribute('src')
      video.load()
      cleanup()
      canvas.toBlob(
        b => b ? resolve(b) : reject(new Error('Falha ao gerar miniatura do vídeo.')),
        'image/jpeg',
        0.7,
      )
    }, { once: true })

    video.addEventListener('loadedmetadata', () => {
      video.currentTime = Math.min(0.1, video.duration || 0)
    }, { once: true })

    video.src = url
  })
}
