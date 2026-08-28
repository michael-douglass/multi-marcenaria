/** Baixa um arquivo remoto (ex.: PDF no Storage) com nome amigável. */
export async function downloadFileFromUrl(fileUrl: string, fileName: string): Promise<void> {
  const safeName = fileName.trim() || 'arquivo';
  const withExtension = safeName.toLowerCase().endsWith('.pdf') ? safeName : `${safeName}.pdf`;

  await downloadBlobFromUrl(fileUrl, withExtension);
}

/** Baixa uma imagem remota (ex.: render no Storage) com nome amigável. */
export async function downloadImageFromUrl(fileUrl: string, fileName: string): Promise<void> {
  const safeName = fileName.trim() || 'imagem';
  const withExtension = /\.(png|jpe?g|webp|gif)$/i.test(safeName) ? safeName : `${safeName}.png`;

  await downloadBlobFromUrl(fileUrl, withExtension);
}

async function downloadBlobFromUrl(fileUrl: string, downloadName: string): Promise<void> {
  try {
    const response = await fetch(fileUrl);
    if (!response.ok) {
      throw new Error(`Falha ao baixar (${response.status})`);
    }
    const blob = await response.blob();
    const objectUrl = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = objectUrl;
    link.download = downloadName;
    link.rel = 'noopener';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(objectUrl);
  } catch {
    const link = document.createElement('a');
    link.href = fileUrl;
    link.download = downloadName;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
}
