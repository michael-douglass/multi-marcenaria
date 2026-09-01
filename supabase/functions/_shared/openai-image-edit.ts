export interface OpenAIImageEditOptions {
  /** Quando true, não tenta editar sem máscara se a chamada com máscara falhar. */
  requireMask?: boolean;
  /** Fotos extras de referência (gpt-image-1 / 1.5 — até 16 no total com a cena). */
  extraImages?: Array<{ bytes: Uint8Array; mime: string; filename?: string }>;
  /** Tamanho da saída. Se omitido, escolhe o mais próximo da foto de entrada. */
  size?: '1024x1024' | '1536x1024' | '1024x1536';
}

export function pickGptImageEditSize(
  width: number,
  height: number,
): '1024x1024' | '1536x1024' | '1024x1536' {
  const ratio = width / Math.max(height, 1);
  if (ratio >= 1.25) return '1536x1024';
  if (ratio <= 0.8) return '1024x1536';
  return '1024x1024';
}

export function readImageDimensions(
  bytes: Uint8Array,
  mime = '',
): { width: number; height: number } | null {
  const looksPng =
    mime.includes('png') ||
    (bytes.length >= 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47);
  if (looksPng && bytes.length >= 24) {
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const width = view.getUint32(16);
    const height = view.getUint32(20);
    if (width > 0 && height > 0) return { width, height };
  }

  const looksJpeg =
    mime.includes('jpeg') ||
    mime.includes('jpg') ||
    (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff);
  if (!looksJpeg) return null;

  let i = 2;
  while (i + 8 < bytes.length) {
    if (bytes[i] !== 0xff) {
      i += 1;
      continue;
    }
    const marker = bytes[i + 1]!;
    if (marker === 0xc0 || marker === 0xc1 || marker === 0xc2) {
      const height = (bytes[i + 5]! << 8) | bytes[i + 6]!;
      const width = (bytes[i + 7]! << 8) | bytes[i + 8]!;
      if (width > 0 && height > 0) return { width, height };
      return null;
    }
    if (marker === 0xd8 || marker === 0xd9 || (marker >= 0xd0 && marker <= 0xd7) || marker === 0x01) {
      i += 2;
      continue;
    }
    const length = (bytes[i + 2]! << 8) | bytes[i + 3]!;
    if (length < 2) break;
    i += 2 + length;
  }
  return null;
}

export async function callOpenAIImageEdit(
  apiKey: string,
  model: string,
  imageBytes: Uint8Array,
  mime: string,
  prompt: string,
  maskBytes?: Uint8Array,
  options?: OpenAIImageEditOptions,
): Promise<Uint8Array> {
  const attempt = async (withMask: boolean, includeExtras: boolean): Promise<Uint8Array> => {
    const form = new FormData();
    form.append('model', model);
    form.append('prompt', prompt);
    const inputMime = mime.includes('jpeg') || mime.includes('jpg') ? 'image/jpeg' : 'image/png';
    const inputExt = inputMime === 'image/jpeg' ? 'jpg' : 'png';
    const blob = new File([imageBytes], `input.${inputExt}`, { type: inputMime });
    const extraImages = options?.extraImages ?? [];
    const extras =
      includeExtras &&
      (model === 'gpt-image-1' || model === 'gpt-image-1.5') &&
      extraImages.length > 0
        ? extraImages.slice(0, 15)
        : [];
    // Várias fotos: a API exige image[] (como o SDK). Repetir "image" gera Duplicate parameter.
    const imageField = extras.length > 0 ? 'image[]' : 'image';
    form.append(imageField, blob, `input.${inputExt}`);
    extras.forEach((extra, index) => {
      const extraMime =
        extra.mime.includes('png') ? 'image/png' : extra.mime.includes('webp') ? 'image/webp' : 'image/jpeg';
      const extraExt = extraMime === 'image/png' ? 'png' : extraMime === 'image/webp' ? 'webp' : 'jpg';
      const filename = extra.filename || `furniture-${index + 1}.${extraExt}`;
      const extraFile = new File([extra.bytes], filename, { type: extraMime });
      form.append(imageField, extraFile, filename);
    });

    if (withMask && maskBytes?.length) {
      const maskBlob = new Blob([maskBytes], { type: 'image/png' });
      form.append('mask', maskBlob, 'mask.png');
    }

    const isGptImage = model === 'gpt-image-1' || model === 'gpt-image-1.5';
    form.append('n', '1');
    if (isGptImage) {
      const dims = readImageDimensions(imageBytes, mime);
      const size =
        options?.size ||
        (dims ? pickGptImageEditSize(dims.width, dims.height) : '1024x1024');
      form.append('size', size);
      form.append('output_format', 'png');
      form.append('quality', 'high');
      form.append('input_fidelity', 'high');
    } else {
      form.append('size', '1024x1024');
    }

    const openAiRes = await fetch('https://api.openai.com/v1/images/edits', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}` },
      body: form,
    });

    if (!openAiRes.ok) {
      const errText = await openAiRes.text();
      console.error('OpenAI image edit error:', openAiRes.status, errText);
      let message = 'Erro ao gerar renderização';
      try {
        const parsed = JSON.parse(errText);
        message = parsed?.error?.message || message;
      } catch {
        // ignore
      }
      throw new Error(message);
    }

    const openAiData = await openAiRes.json();
    const b64 = openAiData?.data?.[0]?.b64_json as string | undefined;
    if (b64) {
      const binary = atob(b64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      return bytes;
    }

    const imageUrl = openAiData?.data?.[0]?.url as string | undefined;
    if (imageUrl) {
      const imgRes = await fetch(imageUrl);
      if (!imgRes.ok) throw new Error('Não foi possível baixar a imagem gerada');
      return new Uint8Array(await imgRes.arrayBuffer());
    }

    throw new Error('A IA não retornou imagem de renderização');
  };

  const run = async (includeExtras: boolean): Promise<Uint8Array> => {
    if (maskBytes?.length) {
      try {
        return await attempt(true, includeExtras);
      } catch (err) {
        if (options?.requireMask) {
          throw err instanceof Error
            ? err
            : new Error('Falha na edição local com máscara — tente reposicionar o ponto');
        }
        console.warn('OpenAI edit com máscara falhou, tentando sem máscara:', err);
        return await attempt(false, includeExtras);
      }
    }

    return await attempt(false, includeExtras);
  };

  const hasExtras = (options?.extraImages?.length ?? 0) > 0;
  try {
    return await run(hasExtras);
  } catch (err) {
    const message = err instanceof Error ? err.message : '';
    if (hasExtras && /duplicate parameter/i.test(message)) {
      console.warn('OpenAI recusou várias fotos (image[]); gerando só com a cena montada.');
      return await run(false);
    }
    throw err;
  }
}

function decodeImagePayload(openAiData: { data?: Array<{ b64_json?: string; url?: string }> }): Promise<Uint8Array> {
  const b64 = openAiData?.data?.[0]?.b64_json;
  if (b64) {
    const binary = atob(b64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return Promise.resolve(bytes);
  }

  const imageUrl = openAiData?.data?.[0]?.url;
  if (!imageUrl) {
    return Promise.reject(new Error('A IA não retornou imagem de renderização'));
  }

  return fetch(imageUrl).then(async (imgRes) => {
    if (!imgRes.ok) throw new Error('Não foi possível baixar a imagem gerada');
    return new Uint8Array(await imgRes.arrayBuffer());
  });
}

/** Gera imagem a partir de texto (quando não há foto de fundo nem montagem). */
export async function callOpenAIImageGenerate(
  apiKey: string,
  model: string,
  prompt: string,
): Promise<Uint8Array> {
  const isGptImage = model === 'gpt-image-1' || model === 'gpt-image-1.5';
  const body: Record<string, unknown> = {
    model,
    prompt,
    size: '1024x1024',
    n: 1,
  };
  if (isGptImage) {
    body.quality = 'high';
    body.output_format = 'png';
  } else {
    body.response_format = 'b64_json';
  }

  const openAiRes = await fetch('https://api.openai.com/v1/images/generations', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!openAiRes.ok) {
    const errText = await openAiRes.text();
    console.error('OpenAI image generate error:', openAiRes.status, errText);
    let message = 'Erro ao gerar renderização do ambiente';
    try {
      const parsed = JSON.parse(errText);
      message = parsed?.error?.message || message;
    } catch {
      // ignore
    }
    throw new Error(message);
  }

  const openAiData = await openAiRes.json();
  return decodeImagePayload(openAiData);
}
