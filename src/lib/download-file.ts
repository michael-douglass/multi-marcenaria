function triggerBlobDownload(blob: Blob, downloadName: string): void {
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = objectUrl;
  link.download = downloadName;
  link.rel = 'noopener';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(objectUrl);
}

async function downloadBlobFromUrl(fileUrl: string, downloadName: string): Promise<void> {
  const response = await fetch(fileUrl);
  if (!response.ok) {
    throw new Error(`Falha ao baixar (${response.status})`);
  }
  const blob = await response.blob();
  triggerBlobDownload(blob, downloadName);
}

/** Se o fetch for bloqueado (CORS), redesenha a imagem e baixa o arquivo gerado. */
async function downloadImageViaCanvas(fileUrl: string, downloadName: string): Promise<void> {
  const blob = await new Promise<Blob>((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Não foi possível preparar a imagem.'));
          return;
        }
        ctx.drawImage(img, 0, 0);
        canvas.toBlob((result) => {
          if (!result) {
            reject(new Error('Não foi possível gerar o arquivo.'));
            return;
          }
          resolve(result);
        }, 'image/png');
      } catch {
        reject(new Error('Não foi possível gerar o arquivo.'));
      }
    };
    img.onerror = () => reject(new Error('Não foi possível carregar a imagem para baixar.'));
    img.src = fileUrl;
  });

  triggerBlobDownload(blob, downloadName);
}

/** Baixa um arquivo remoto (ex.: PDF no Storage) com nome amigável. */
export async function downloadFileFromUrl(fileUrl: string, fileName: string): Promise<void> {
  const safeName = fileName.trim() || 'arquivo';
  const withExtension = safeName.toLowerCase().endsWith('.pdf') ? safeName : `${safeName}.pdf`;

  try {
    await downloadBlobFromUrl(fileUrl, withExtension);
  } catch {
    const link = document.createElement('a');
    link.href = fileUrl;
    link.download = withExtension;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
}

/** Baixa uma imagem remota (ex.: render no Storage) com nome amigável. */
export async function downloadImageFromUrl(fileUrl: string, fileName: string): Promise<void> {
  const safeName = fileName.trim() || 'imagem';
  const withExtension = /\.(png|jpe?g|webp|gif)$/i.test(safeName) ? safeName : `${safeName}.png`;

  try {
    await downloadBlobFromUrl(fileUrl, withExtension);
  } catch {
    await downloadImageViaCanvas(fileUrl, withExtension);
  }
}
