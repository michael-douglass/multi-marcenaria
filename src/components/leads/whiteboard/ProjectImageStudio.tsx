import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import {
  Contrast,
  Eraser,
  FlipHorizontal2,
  FlipVertical2,
  Loader2,
  RotateCcw,
  RotateCw,
  SunMedium,
  Thermometer,
  Undo2,
} from 'lucide-react';
import * as THREE from 'three';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';
import { tryCreateWebGLRenderer } from '@/lib/webgl-support';
import {
  bakeImageStudio,
  DEFAULT_IMAGE_STUDIO_EDITS,
  imageStudioHasEdits,
  type ImageStudioEdits,
} from '@/lib/lead-image-studio';
import { WhiteboardWoodFoil } from '@/components/leads/whiteboard/WhiteboardWoodFoil';

export interface ProjectImageStudioHandle {
  bake: () => Promise<string>;
  hasEdits: () => boolean;
}

interface ProjectImageStudioProps {
  sourceUrl: string;
  disabled?: boolean;
}

const sliderClass =
  '[&>span]:h-1 [&>span]:bg-[#2a1812]/90 [&>span>span]:bg-gold [&_[role=slider]]:h-3.5 [&_[role=slider]]:w-3.5 [&_[role=slider]]:border-gold [&_[role=slider]]:bg-[#fff6ea]';

function StudioField({
  label,
  value,
  children,
}: {
  label: string;
  value: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between gap-2">
        <Label className="text-[10px] font-semibold uppercase tracking-[0.16em] text-gold/85">
          {label}
        </Label>
        <span className="font-mono text-[10px] tabular-nums text-cream-faint">{value}</span>
      </div>
      {children}
    </div>
  );
}

export const ProjectImageStudio = forwardRef<ProjectImageStudioHandle, ProjectImageStudioProps>(
  function ProjectImageStudio({ sourceUrl, disabled = false }, ref) {
    const hostRef = useRef<HTMLDivElement>(null);
    const uniformsRef = useRef<{
      uBrightness: { value: number };
      uContrast: { value: number };
      uSaturation: { value: number };
      uWarmth: { value: number };
    } | null>(null);
    const meshRef = useRef<THREE.Mesh | null>(null);
    const [edits, setEdits] = useState<ImageStudioEdits>(DEFAULT_IMAGE_STUDIO_EDITS);
    const [isLoading, setIsLoading] = useState(true);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [webglOk, setWebglOk] = useState(true);

    const editsRef = useRef(edits);
    editsRef.current = edits;

    useImperativeHandle(
      ref,
      () => ({
        bake: () => bakeImageStudio(sourceUrl, editsRef.current),
        hasEdits: () => imageStudioHasEdits(editsRef.current),
      }),
      [sourceUrl],
    );

    useEffect(() => {
      setEdits(DEFAULT_IMAGE_STUDIO_EDITS);
    }, [sourceUrl]);

    useEffect(() => {
      const host = hostRef.current;
      if (!host || !sourceUrl) return;

      let cancelled = false;
      let blobUrl: string | null = null;
      let frame = 0;
      let running = true;
      let texture: THREE.Texture | null = null;
      let renderer: THREE.WebGLRenderer | null = null;
      let material: THREE.ShaderMaterial | null = null;
      let mesh: THREE.Mesh | null = null;
      let ro: ResizeObserver | null = null;

      const rendererOrNull = tryCreateWebGLRenderer(
        () =>
          new THREE.WebGLRenderer({
            alpha: true,
            antialias: true,
            powerPreference: 'low-power',
            preserveDrawingBuffer: true,
          }),
      );

      if (!rendererOrNull) {
        setWebglOk(false);
        setIsLoading(false);
        return;
      }

      renderer = rendererOrNull;
      setWebglOk(true);
      renderer.setClearColor(0x000000, 0);
      renderer.domElement.style.display = 'block';
      renderer.domElement.style.width = '100%';
      renderer.domElement.style.height = '100%';
      renderer.domElement.style.pointerEvents = 'none';
      host.appendChild(renderer.domElement);

      THREE.Cache.enabled = true;
      const manager = new THREE.LoadingManager();
      const loader = new THREE.TextureLoader(manager);
      loader.crossOrigin = 'anonymous';

      const uniforms = {
        uMap: { value: new THREE.Texture() },
        uBrightness: { value: 1 },
        uContrast: { value: 1 },
        uSaturation: { value: 1 },
        uWarmth: { value: 0 },
        uCutBg: { value: 0 },
        uCutTol: { value: 0.28 },
        uCutColor: { value: new THREE.Vector3(0.92, 0.9, 0.86) },
      };
      uniformsRef.current = uniforms;

      material = new THREE.ShaderMaterial({
        transparent: true,
        depthTest: false,
        uniforms,
        vertexShader: `
          varying vec2 vUv;
          void main() {
            vUv = uv;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `,
        fragmentShader: `
          uniform sampler2D uMap;
          uniform float uBrightness;
          uniform float uContrast;
          uniform float uSaturation;
          uniform float uWarmth;
          uniform float uCutBg;
          uniform float uCutTol;
          uniform vec3 uCutColor;
          varying vec2 vUv;

          void main() {
            vec4 texel = texture2D(uMap, vUv);
            vec3 color = texel.rgb * uBrightness;
            color = (color - 0.5) * uContrast + 0.5;
            float luma = dot(color, vec3(0.2126, 0.7152, 0.0722));
            color = mix(vec3(luma), color, uSaturation);
            color.r += uWarmth * 0.18;
            color.b -= uWarmth * 0.14;
            float cut = smoothstep(uCutTol * 0.7, uCutTol * 1.18, distance(texel.rgb, uCutColor));
            float alpha = texel.a * mix(1.0, cut, uCutBg);
            gl_FragColor = vec4(clamp(color, 0.0, 1.0), alpha);
          }
        `,
      });

      const scene = new THREE.Scene();
      const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
      mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material);
      scene.add(mesh);
      meshRef.current = mesh;

      const fitMesh = (tex: THREE.Texture) => {
        const img = tex.image as { width?: number; height?: number } | undefined;
        const iw = Math.max(1, img?.width ?? 1);
        const ih = Math.max(1, img?.height ?? 1);
        const hostW = Math.max(host.clientWidth, 1);
        const hostH = Math.max(host.clientHeight, 1);
        const contain = Math.min(hostW / iw, hostH / ih);
        const nw = (iw * contain) / hostW;
        const nh = (ih * contain) / hostH;
        mesh!.scale.set(nw, nh, 1);
      };

      const applyEditsToMesh = () => {
        const current = editsRef.current;
        uniforms.uBrightness.value = current.brightness / 100;
        uniforms.uContrast.value = current.contrast / 100;
        uniforms.uSaturation.value = current.saturation / 100;
        uniforms.uWarmth.value = current.warmth / 100;
        uniforms.uCutBg.value = current.removeBg ? 1 : 0;
        uniforms.uCutTol.value = current.bgTolerance / 120;
        if (!mesh) return;
        mesh.rotation.z = -(current.rotation * Math.PI) / 180;
        mesh.scale.x = Math.abs(mesh.scale.x) * (current.flipH ? -1 : 1);
        mesh.scale.y = Math.abs(mesh.scale.y) * (current.flipV ? -1 : 1);
      };

      const resize = () => {
        if (!renderer || !texture) return;
        const w = Math.max(host.clientWidth, 1);
        const h = Math.max(host.clientHeight, 1);
        renderer.setPixelRatio(1);
        renderer.setSize(w, h, false);
        fitMesh(texture);
        applyEditsToMesh();
      };

      const draw = () => {
        if (!running || !renderer) return;
        frame = requestAnimationFrame(draw);
        applyEditsToMesh();
        renderer.render(scene, camera);
      };

      const sampleCorners = (image: CanvasImageSource) => {
        const probe = document.createElement('canvas');
        probe.width = 4;
        probe.height = 4;
        const ctx = probe.getContext('2d');
        if (!ctx) return;
        ctx.drawImage(image, 0, 0, 4, 4);
        const px = ctx.getImageData(0, 0, 4, 4).data;
        const corners = [0, 3, 12, 15];
        let r = 0;
        let g = 0;
        let b = 0;
        for (const index of corners) {
          r += px[index * 4];
          g += px[index * 4 + 1];
          b += px[index * 4 + 2];
        }
        uniforms.uCutColor.value.set(r / 1020, g / 1020, b / 1020);
      };

      const attachTexture = (tex: THREE.Texture) => {
        tex.colorSpace = THREE.SRGBColorSpace;
        tex.minFilter = THREE.LinearFilter;
        tex.magFilter = THREE.LinearFilter;
        tex.flipY = true;
        tex.needsUpdate = true;
        texture = tex;
        uniforms.uMap.value = tex;
        if (tex.image) sampleCorners(tex.image as CanvasImageSource);
        resize();
        setIsLoading(false);
        setLoadError(null);
        draw();
      };

      const loadViaLoader = (url: string) => {
        loader.load(
          url,
          (tex) => {
            if (cancelled) {
              tex.dispose();
              return;
            }
            attachTexture(tex);
          },
          undefined,
          () => {
            if (!cancelled) {
              setLoadError('Não foi possível carregar a foto para edição.');
              setIsLoading(false);
            }
          },
        );
      };

      setIsLoading(true);
      setLoadError(null);

      void (async () => {
        try {
          if (sourceUrl.startsWith('http://') || sourceUrl.startsWith('https://')) {
            const response = await fetch(sourceUrl);
            if (!response.ok) throw new Error('Falha ao baixar a foto');
            const blob = await response.blob();
            blobUrl = URL.createObjectURL(blob);
            if (cancelled) {
              URL.revokeObjectURL(blobUrl);
              return;
            }
            loadViaLoader(blobUrl);
            return;
          }
          loadViaLoader(sourceUrl);
        } catch {
          if (!cancelled) {
            setLoadError('Não foi possível carregar a foto para edição.');
            setIsLoading(false);
          }
        }
      })();

      ro = new ResizeObserver(resize);
      ro.observe(host);

      return () => {
        cancelled = true;
        running = false;
        cancelAnimationFrame(frame);
        ro?.disconnect();
        uniformsRef.current = null;
        meshRef.current = null;
        texture?.dispose();
        material?.dispose();
        mesh?.geometry.dispose();
        renderer?.dispose();
        if (renderer?.domElement.parentNode === host) host.removeChild(renderer.domElement);
        if (blobUrl) URL.revokeObjectURL(blobUrl);
      };
    }, [sourceUrl]);

    const patch = useCallback((partial: Partial<ImageStudioEdits>) => {
      setEdits((prev) => ({ ...prev, ...partial }));
    }, []);

    const rotate = (delta: 90 | -90) => {
      setEdits((prev) => ({
        ...prev,
        rotation: ((((prev.rotation + delta) % 360) + 360) % 360) as ImageStudioEdits['rotation'],
      }));
    };

    return (
      <div data-image-studio-panel="" className="flex min-h-0 flex-1 flex-col lg:flex-row">
        <div
          className={cn(
            'relative min-h-[240px] flex-1 overflow-hidden',
            edits.removeBg
              ? 'bg-[linear-gradient(45deg,#3a241c_25%,transparent_25%,transparent_75%,#3a241c_75%),linear-gradient(45deg,#3a241c_25%,transparent_25%,transparent_75%,#3a241c_75%)] bg-[length:18px_18px] bg-[position:0_0,9px_9px] bg-[#1a100c]'
              : 'bg-mahogany-base',
          )}
        >
          <div ref={hostRef} className="absolute inset-0" />
          {!webglOk && (
            <img
              src={sourceUrl}
              alt=""
              className="absolute inset-0 m-auto max-h-full max-w-full object-contain"
              style={{
                filter: `brightness(${edits.brightness}%) contrast(${edits.contrast}%) saturate(${edits.saturation}%)`,
                transform: `rotate(${edits.rotation}deg) scaleX(${edits.flipH ? -1 : 1}) scaleY(${edits.flipV ? -1 : 1})`,
              }}
            />
          )}
          {isLoading && (
            <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 bg-[#1a100c]/55 text-cream-muted">
              <Loader2 className="h-6 w-6 animate-spin text-gold" />
              <p className="text-xs">Abrindo a foto na bancada…</p>
            </div>
          )}
          {loadError && (
            <p className="absolute inset-x-4 top-1/2 z-10 -translate-y-1/2 text-center text-sm text-red-400">
              {loadError}
            </p>
          )}
        </div>

        <aside className="relative flex w-full shrink-0 flex-col gap-3 overflow-y-auto border-t border-gold-border-subtle/20 bg-[#160e0a] px-4 py-4 lg:w-[17.5rem] lg:border-l lg:border-t-0">
          <WhiteboardWoodFoil />
          <div className="relative z-[1] space-y-4">
            <div>
              <p className="font-display text-[11px] uppercase tracking-[0.22em] text-gold">
                Bancada de retoque
              </p>
              <p className="mt-1 text-[11px] leading-relaxed text-cream-muted">
                Ajuste a foto do projeto antes de colocar no ambiente. O original do lead não muda.
              </p>
            </div>

            <div className="flex items-center justify-between gap-3 rounded-lg border border-gold-border-subtle/25 bg-black/25 px-3 py-2.5">
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-gold/90">
                  <Eraser className="h-3.5 w-3.5" />
                  Remover fundo
                </div>
                <p className="mt-0.5 text-[10px] text-cream-faint">Tira a parede clara atrás do móvel.</p>
              </div>
              <Switch
                checked={edits.removeBg}
                disabled={disabled}
                onCheckedChange={(checked) => patch({ removeBg: checked })}
                aria-label="Remover fundo da foto"
              />
            </div>

            {edits.removeBg && (
              <StudioField label="Sensibilidade" value={`${edits.bgTolerance}`}>
                <Slider
                  min={12}
                  max={72}
                  step={1}
                  value={[edits.bgTolerance]}
                  disabled={disabled}
                  onValueChange={([value]) => patch({ bgTolerance: value ?? 34 })}
                  aria-label="Sensibilidade da remoção de fundo"
                  className={sliderClass}
                />
              </StudioField>
            )}

            <StudioField label="Brilho" value={`${edits.brightness}%`}>
              <div className="flex items-center gap-2">
                <SunMedium className="h-3.5 w-3.5 shrink-0 text-gold/70" aria-hidden />
                <Slider
                  min={60}
                  max={150}
                  step={1}
                  value={[edits.brightness]}
                  disabled={disabled}
                  onValueChange={([value]) => patch({ brightness: value ?? 100 })}
                  aria-label="Brilho"
                  className={sliderClass}
                />
              </div>
            </StudioField>

            <StudioField label="Contraste" value={`${edits.contrast}%`}>
              <div className="flex items-center gap-2">
                <Contrast className="h-3.5 w-3.5 shrink-0 text-gold/70" aria-hidden />
                <Slider
                  min={60}
                  max={150}
                  step={1}
                  value={[edits.contrast]}
                  disabled={disabled}
                  onValueChange={([value]) => patch({ contrast: value ?? 100 })}
                  aria-label="Contraste"
                  className={sliderClass}
                />
              </div>
            </StudioField>

            <StudioField label="Cor" value={`${edits.saturation}%`}>
              <Slider
                min={0}
                max={180}
                step={1}
                value={[edits.saturation]}
                disabled={disabled}
                onValueChange={([value]) => patch({ saturation: value ?? 100 })}
                aria-label="Saturação de cor"
                className={sliderClass}
              />
            </StudioField>

            <StudioField
              label="Temperatura"
              value={edits.warmth === 0 ? 'neutra' : edits.warmth > 0 ? `quente ${edits.warmth}` : `fria ${edits.warmth}`}
            >
              <div className="flex items-center gap-2">
                <Thermometer className="h-3.5 w-3.5 shrink-0 text-gold/70" aria-hidden />
                <Slider
                  min={-40}
                  max={40}
                  step={1}
                  value={[edits.warmth]}
                  disabled={disabled}
                  onValueChange={([value]) => patch({ warmth: value ?? 0 })}
                  aria-label="Temperatura da cor"
                  className={sliderClass}
                />
              </div>
            </StudioField>

            <div className="grid grid-cols-4 gap-1.5">
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="h-9 border-gold-border-subtle/35 bg-black/20"
                disabled={disabled}
                onClick={() => rotate(-90)}
                aria-label="Girar para a esquerda"
              >
                <RotateCcw className="h-4 w-4" />
              </Button>
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="h-9 border-gold-border-subtle/35 bg-black/20"
                disabled={disabled}
                onClick={() => rotate(90)}
                aria-label="Girar para a direita"
              >
                <RotateCw className="h-4 w-4" />
              </Button>
              <Button
                type="button"
                variant="outline"
                size="icon"
                className={cn(
                  'h-9 border-gold-border-subtle/35 bg-black/20',
                  edits.flipH && 'border-gold/60 bg-gold/15',
                )}
                disabled={disabled}
                onClick={() => patch({ flipH: !edits.flipH })}
                aria-label="Espelhar na horizontal"
              >
                <FlipHorizontal2 className="h-4 w-4" />
              </Button>
              <Button
                type="button"
                variant="outline"
                size="icon"
                className={cn(
                  'h-9 border-gold-border-subtle/35 bg-black/20',
                  edits.flipV && 'border-gold/60 bg-gold/15',
                )}
                disabled={disabled}
                onClick={() => patch({ flipV: !edits.flipV })}
                aria-label="Espelhar na vertical"
              >
                <FlipVertical2 className="h-4 w-4" />
              </Button>
            </div>

            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-8 justify-start gap-1.5 px-1 text-cream-muted hover:text-gold"
              disabled={disabled || !imageStudioHasEdits(edits)}
              onClick={() => setEdits(DEFAULT_IMAGE_STUDIO_EDITS)}
            >
              <Undo2 className="h-3.5 w-3.5" />
              Restaurar original
            </Button>
          </div>
        </aside>
      </div>
    );
  },
);
