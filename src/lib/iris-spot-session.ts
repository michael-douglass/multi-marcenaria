export interface IrisActiveSpot {
  mediaLabel: string;
  normalizedX: number;
  normalizedY: number;
  cropBase64?: string;
  pdfPageNumber?: number;
  spotDescription: string;
  shortLabel: string;
}

export interface IrisSpotChatMetadata {
  type: 'spot_identify';
  spotDescription: string;
  shortLabel: string;
  mediaLabel: string;
  normalizedX: number;
  normalizedY: number;
  pdfPageNumber?: number;
}

export function spotMetadataToActiveSpot(meta: IrisSpotChatMetadata): IrisActiveSpot {
  return {
    mediaLabel: meta.mediaLabel,
    normalizedX: meta.normalizedX,
    normalizedY: meta.normalizedY,
    pdfPageNumber: meta.pdfPageNumber,
    spotDescription: meta.spotDescription,
    shortLabel: meta.shortLabel,
  };
}

export function findLatestSpotFromMessages(
  messages: Array<{ metadata?: unknown }>,
): IrisActiveSpot | null {
  for (let i = messages.length - 1; i >= 0; i--) {
    const raw = messages[i].metadata;
    if (!raw || typeof raw !== 'object') continue;
    const meta = raw as Partial<IrisSpotChatMetadata>;
    if (meta.type === 'spot_identify' && meta.spotDescription?.trim()) {
      return spotMetadataToActiveSpot({
        type: 'spot_identify',
        spotDescription: meta.spotDescription,
        shortLabel: meta.shortLabel?.trim() || extractSpotShortLabel(meta.spotDescription),
        mediaLabel: meta.mediaLabel ?? 'Imagem',
        normalizedX: meta.normalizedX ?? 0,
        normalizedY: meta.normalizedY ?? 0,
        pdfPageNumber: meta.pdfPageNumber,
      });
    }
  }
  return null;
}

/** Extrai rótulo curto do YAML para exibir ao usuário. */
export function extractSpotShortLabel(yaml: string): string {
  const lines = yaml.split('\n');
  for (const line of lines) {
    const match = line.match(/^\s*(descricao_exata|visual_description)\s*:\s*(.+)$/i);
    if (match?.[2]) {
      const value = match[2].trim().replace(/^["']|["']$/g, '');
      if (value && value !== 'null' && !value.startsWith('(')) return value;
    }
  }
  return '';
}

export function buildSpotIdentifyAssistantMessage(
  shortLabel: string,
  mediaLabel: string,
): string {
  const element = shortLabel || 'um trecho desta imagem';
  return `Identifiquei **${element}** em "${mediaLabel}".\n\nO que você deseja saber ou fazer com este ponto? Por exemplo: cor, material, medida, interferência no projeto…`;
}
