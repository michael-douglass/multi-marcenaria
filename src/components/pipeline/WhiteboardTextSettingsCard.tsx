import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Type, Loader2 } from 'lucide-react';
import { useWhiteboardTextConfig } from '@/hooks/useWhiteboardTextConfig';
import {
  WHITEBOARD_FONT_OPTIONS,
  WHITEBOARD_FONT_SIZE_MIN,
  WHITEBOARD_FONT_SIZE_MAX,
} from '@/lib/whiteboard-text-config';

export function WhiteboardTextSettingsCard() {
  const { config, isLoading, saveConfig } = useWhiteboardTextConfig();
  const [fontFamily, setFontFamily] = useState(config.fontFamily);
  const [fontSizePx, setFontSizePx] = useState(config.fontSizePx);

  useEffect(() => {
    setFontFamily(config.fontFamily);
    setFontSizePx(config.fontSizePx);
  }, [config.fontFamily, config.fontSizePx]);

  const handleSave = () => {
    void saveConfig.mutateAsync({ fontFamily, fontSizePx });
  };

  const previewStyle = {
    fontFamily,
    fontSize: fontSizePx,
  } as const;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Type className="h-5 w-5" />
          Texto na lousa
        </CardTitle>
        <CardDescription>
          Define a fonte e o tamanho usados por todos na lousa dos leads. Somente administradores podem alterar.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {isLoading ? (
          <div className="flex items-center gap-2 text-muted-foreground text-sm">
            <Loader2 className="h-4 w-4 animate-spin" />
            Carregando…
          </div>
        ) : (
          <>
            <div className="space-y-2">
              <Label htmlFor="wb-font-family">Família da fonte</Label>
              <Select value={fontFamily} onValueChange={setFontFamily}>
                <SelectTrigger id="wb-font-family">
                  <SelectValue placeholder="Escolha a fonte" />
                </SelectTrigger>
                <SelectContent>
                  {WHITEBOARD_FONT_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>Tamanho da fonte</Label>
                <span className="text-sm font-mono tabular-nums text-muted-foreground">{fontSizePx}px</span>
              </div>
              <Slider
                value={[fontSizePx]}
                min={WHITEBOARD_FONT_SIZE_MIN}
                max={WHITEBOARD_FONT_SIZE_MAX}
                step={1}
                onValueChange={([v]) => setFontSizePx(v)}
              />
              <p className="text-xs text-muted-foreground">
                Entre {WHITEBOARD_FONT_SIZE_MIN}px e {WHITEBOARD_FONT_SIZE_MAX}px. Vale para textos novos e para os já existentes na lousa.
              </p>
            </div>

            <div className="rounded-lg border border-border/80 bg-muted/30 p-4">
              <p className="text-xs text-muted-foreground mb-2">Pré-visualização</p>
              <p style={previewStyle} className="text-foreground">
                Exemplo de texto na lousa do lead
              </p>
            </div>

            <Button onClick={handleSave} disabled={saveConfig.isPending}>
              {saveConfig.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Salvando…
                </>
              ) : (
                'Salvar configuração da lousa'
              )}
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}
