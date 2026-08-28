import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRef } from 'react';
import { useEmpresaSupabase } from '@/hooks/useEmpresaSupabase';
import { useEmpresaTable } from '@/hooks/useEmpresaTable';
import { useEmpresa } from '@/contexts/EmpresaContext';
import {
  WHITEBOARD_TEXT_CONFIG_DEFAULTS,
  WHITEBOARD_FONT_SIZE_MIN,
  WHITEBOARD_FONT_SIZE_MAX,
} from '@/lib/whiteboard-text-config';
import { toast } from 'sonner';

export interface WhiteboardTextConfig {
  id: string;
  fontFamily: string;
  fontSizePx: number;
  textColorHex: string;
  atualizadoEm: string | null;
}

interface DBWhiteboardTextConfig {
  id: string;
  singleton_key: string;
  font_family: string;
  font_size_px: number;
  text_color_hex?: string | null;
  atualizado_em: string | null;
}

function adaptConfig(row: DBWhiteboardTextConfig): WhiteboardTextConfig {
  return {
    id: row.id,
    fontFamily: row.font_family,
    fontSizePx: row.font_size_px,
    textColorHex: row.text_color_hex ?? WHITEBOARD_TEXT_CONFIG_DEFAULTS.textColorHex,
    atualizadoEm: row.atualizado_em,
  };
}

const fallbackConfig = (): WhiteboardTextConfig => ({
  id: 'default',
  fontFamily: WHITEBOARD_TEXT_CONFIG_DEFAULTS.fontFamily,
  fontSizePx: WHITEBOARD_TEXT_CONFIG_DEFAULTS.fontSizePx,
  textColorHex: WHITEBOARD_TEXT_CONFIG_DEFAULTS.textColorHex,
  atualizadoEm: null,
});

export function useWhiteboardTextConfig() {
  const client = useEmpresaSupabase();
  const { lead_whiteboard_text_config: table } = useEmpresaTable();
  const { schemaEmpresa } = useEmpresa();
  const queryClient = useQueryClient();
  const supportsTextColorRef = useRef<boolean>(true);

  const queryKey = ['whiteboard-text-config', schemaEmpresa ?? 'master'] as const;

  const { data: config, isLoading, error, refetch } = useQuery({
    queryKey,
    queryFn: async () => {
      // Compatibilidade: usar `select('*')` evita erro quando a coluna `text_color_hex`
      // ainda não existe (o PostgREST só retorna as colunas existentes).
      const { data, error: fetchError } = await client
        .from(table)
        .select('*')
        .eq('singleton_key', 'default')
        .maybeSingle();

      if (fetchError) throw fetchError;
      // Se o banco já tem a coluna, ela virá no payload; caso não tenha, fica undefined.
      supportsTextColorRef.current = Boolean((data as any)?.text_color_hex);
      if (!data) return fallbackConfig();
      return adaptConfig(data as DBWhiteboardTextConfig);
    },
    staleTime: 60_000,
  });

  const saveConfig = useMutation({
    mutationFn: async (updates: { fontFamily: string; fontSizePx: number; textColorHex: string }) => {
      const size = Math.round(updates.fontSizePx);
      if (size < WHITEBOARD_FONT_SIZE_MIN || size > WHITEBOARD_FONT_SIZE_MAX) {
        throw new Error('Tamanho de fonte inválido');
      }

      const hex = updates.textColorHex.trim();
      if (!/^#[0-9a-fA-F]{6}$/.test(hex)) {
        throw new Error('Cor inválida (use #RRGGBB)');
      }

      const row: Record<string, unknown> = {
        singleton_key: 'default',
        font_family: updates.fontFamily,
        font_size_px: size,
        atualizado_em: new Date().toISOString(),
      };
      if (supportsTextColorRef.current) {
        row.text_color_hex = hex;
      }

      if (config?.id && config.id !== 'default') {
        const { data, error: updateError } = await client
          .from(table)
          .update(row)
          .eq('id', config.id)
          .select('*')
          .single();
        if (updateError) throw updateError;
        return adaptConfig(data as DBWhiteboardTextConfig);
      }

      const { data, error: upsertError } = await client
        .from(table)
        .upsert(row, { onConflict: 'singleton_key' })
        .select('*')
        .single();
      if (upsertError) throw upsertError;
      return adaptConfig(data as DBWhiteboardTextConfig);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      toast.success('Configuração de texto da lousa salva');
    },
    onError: () => {
      toast.error('Não foi possível salvar a configuração da lousa');
    },
  });

  return {
    config: config ?? fallbackConfig(),
    isLoading,
    error,
    refetch,
    saveConfig,
  };
}
