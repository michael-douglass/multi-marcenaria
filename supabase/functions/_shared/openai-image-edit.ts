export interface OpenAIImageEditOptions {
  /** Quando true, não tenta editar sem máscara se a chamada com máscara falhar. */
  requireMask?: boolean;
  /** Fotos extras de referência (gpt-image-1 / 1.5 — até 16 no total com a cena). */
  extraImages?: Array<{ bytes: Uint8Array; mime: string; filename?: string }>;
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
  const attempt = async (withMask: boolean): Promise<Uint8Array> => {
    const form = new FormData();
    form.append('model', model);
    form.append('prompt', prompt);
    const inputMime = mime.includes('jpeg') || mime.includes('jpg') ? 'image/jpeg' : 'image/png';
    const inputExt = inputMime === 'image/jpeg' ? 'jpg' : 'png';
    const blob = new Blob([imageBytes], { type: inputMime });
    form.append('image', blob, `input.${inputExt}`);

    const extraImages = options?.extraImages ?? [];
    if ((model === 'gpt-image-1' || model === 'gpt-image-1.5') && extraImages.length > 0) {
      extraImages.slice(0, 15).forEach((extra, index) => {
        const extraMime =
          extra.mime.includes('png') ? 'image/png' : extra.mime.includes('webp') ? 'image/webp' : 'image/jpeg';
        const extraExt = extraMime === 'image/png' ? 'png' : extraMime === 'image/webp' ? 'webp' : 'jpg';
        const extraBlob = new Blob([extra.bytes], { type: extraMime });
        form.append('image', extraBlob, extra.filename || `furniture-${index + 1}.${extraExt}`);
      });
    }

    if (withMask && maskBytes?.length) {
      const maskBlob = new Blob([maskBytes], { type: 'image/png' });
      form.append('mask', maskBlob, 'mask.png');
    }

    const isGptImage = model === 'gpt-image-1' || model === 'gpt-image-1.5';
    form.append('n', '1');
    if (isGptImage) {
      // /images/edits não aceita size=auto — usar dimensão explícita
      form.append('size', '1024x1024');
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

  if (maskBytes?.length) {
    try {
      return await attempt(true);
    } catch (err) {
      if (options?.requireMask) {
        throw err instanceof Error
          ? err
          : new Error('Falha na edição local com máscara — tente reposicionar o ponto');
      }
      console.warn('OpenAI edit com máscara falhou, tentando sem máscara:', err);
      return await attempt(false);
    }
  }

  return await attempt(false);
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
