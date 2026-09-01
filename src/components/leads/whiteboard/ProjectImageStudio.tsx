import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  type MouseEvent,
  type ReactNode,
} from 'react';
import {
  Contrast,
  Crop,
  Crosshair,
  Eraser,
  FlipHorizontal2,
  FlipVertical2,
  Loader2,
  MapPin,
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
  computeStudioAlphaMask,
  containRotatedPlane,
  cropToShaderRect,
  DEFAULT_IMAGE_STUDIO_EDITS,
  FULL_IMAGE_CROP,
  getCanvasSourceSize,
  imageStudioHasEdits,
  maxCropForPixelAspect,
  normalizeStudioRotation,
  PREVIEW_CUTOUT_MAX_EDGE,
  studioCropIsActive,
  studioHostPointToUv,
  studioUvToHostPercent,
  STUDIO_CROP_ASPECTS,
  type ImageStudioEdits,
  type ImageStudioSeed,
  type StudioPreviewFit,
} from '@/lib/lead-image-studio';
import { ImageStudioCropFrame } from '@/components/leads/whiteboard/ImageStudioCropFrame';
import { WhiteboardWoodFoil } from '@/components/leads/whiteboard/WhiteboardWoodFoil';

export interface ProjectImageStudioHandle {
  bake: () => Promise<string>;
  hasEdits: () => boolean;
}

interface ProjectImageStudioProps {
  sourceUrl: string;
  disabled?: boolean;
  /** Abre já no modo recorte — atalho da lousa. */
  initialCropMode?: boolean;
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
  function ProjectImageStudio({ sourceUrl, disabled = false, initialCropMode = false }, ref) {
    const hostRef = useRef<HTMLDivElement>(null);
    const uniformsRef = useRef<{
      uBrightness: { value: number };
      uContrast: { value: number };
      uSaturation: { value: number };
      uWarmth: { value: number };
      uCropRect: { value: THREE.Vector4 };
      uCropPreview: { value: number };
    } | null>(null);
    const meshRef = useRef<THREE.Mesh | null>(null);
    const previewFitRef = useRef<StudioPreviewFit>({ nw: 1, nh: 1 });
    const sourcePixelsRef = useRef<{ image: CanvasImageSource; width: number; height: number } | null>(
      null,
    );
    const applyMaskRef = useRef<(tex: THREE.DataTexture | null) => void>(() => {});
    const maskJobRef = useRef(0);

    const [edits, setEdits] = useState<ImageStudioEdits>(DEFAULT_IMAGE_STUDIO_EDITS);
    const [isLoading, setIsLoading] = useState(true);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [webglOk, setWebglOk] = useState(true);
    const [sourceReady, setSourceReady] = useState(0);
    const [pointing, setPointing] = useState(false);
    const [cropping, setCropping] = useState(initialCropMode);
    const [cropAspectId, setCropAspectId] = useState('livre');
    const [fitTick, setFitTick] = useState(0);

    const editsRef = useRef(edits);
    editsRef.current = edits;
    const croppingRef = useRef(cropping);
    croppingRef.current = cropping;

    useImperativeHandle(
      ref,
      () => ({
        bake: () => bakeImageStudio(sourceUrl, editsRef.current),
        hasEdits: () => imageStudioHasEdits(editsRef.current),
      }),
      [sourceUrl],
    );

    useEffect(() => {
      setEdits({ ...DEFAULT_IMAGE_STUDIO_EDITS, bgSeeds: [], crop: { ...FULL_IMAGE_CROP } });
      setPointing(false);
      setCropping(initialCropMode);
      setCropAspectId('livre');
      sourcePixelsRef.current = null;
    }, [sourceUrl, initialCropMode]);

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
      let maskTexture: THREE.DataTexture | null = null;

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
      renderer.debug.checkShaderErrors = true;
      renderer.domElement.style.display = 'block';
      renderer.domElement.style.width = '100%';
      renderer.domElement.style.height = '100%';
      renderer.domElement.style.pointerEvents = 'none';
      host.appendChild(renderer.domElement);

      const dummyMask = new THREE.DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1);
      dummyMask.needsUpdate = true;

      THREE.Cache.enabled = true;
      const manager = new THREE.LoadingManager();
      const loader = new THREE.TextureLoader(manager);
      loader.crossOrigin = 'anonymous';

      const uniforms = {
        uMap: { value: new THREE.Texture() },
        uMask: { value: dummyMask },
        uBrightness: { value: 1 },
        uContrast: { value: 1 },
        uSaturation: { value: 1 },
        uWarmth: { value: 0 },
        uCutBg: { value: 0 },
        uUseMask: { value: 0 },
        uCropRect: { value: new THREE.Vector4(0, 0, 1, 1) },
        uCropPreview: { value: 0 },
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
          uniform sampler2D uMask;
          uniform float uBrightness;
          uniform float uContrast;
          uniform float uSaturation;
          uniform float uWarmth;
          uniform float uCutBg;
          uniform float uUseMask;
          uniform vec4 uCropRect;
          uniform float uCropPreview;
          varying vec2 vUv;

          void main() {
            vec4 texel = texture2D(uMap, vUv);
            vec3 color = texel.rgb * uBrightness;
            color = (color - 0.5) * uContrast + 0.5;
            float luma = dot(color, vec3(0.2126, 0.7152, 0.0722));
            color = mix(vec3(luma), color, uSaturation);
            color.r += uWarmth * 0.18;
            color.b -= uWarmth * 0.14;
            float keep = texture2D(uMask, vUv).r;
            float alpha = texel.a * mix(1.0, keep, uCutBg * uUseMask);

            vec2 cropMin = uCropRect.xy;
            vec2 cropMax = uCropRect.xy + uCropRect.zw;
            float inside = step(cropMin.x, vUv.x) * step(vUv.x, cropMax.x)
              * step(cropMin.y, vUv.y) * step(vUv.y, cropMax.y);

            if (uCropPreview < 0.5 && inside < 0.5) {
              discard;
            }

            float veil = mix(0.18, 1.0, inside);
            color *= mix(1.0, veil, uCropPreview);
            alpha *= mix(1.0, mix(0.22, 1.0, inside), uCropPreview);
            gl_FragColor = vec4(clamp(color, 0.0, 1.0), alpha);
          }
        `,
      });

      const scene = new THREE.Scene();
      const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
      mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material);
      scene.add(mesh);
      meshRef.current = mesh;

      applyMaskRef.current = (tex) => {
        if (maskTexture && maskTexture !== dummyMask) {
          maskTexture.dispose();
        }
        maskTexture = tex;
        uniforms.uMask.value = tex ?? dummyMask;
        uniforms.uUseMask.value = tex ? 1 : 0;
      };

      const applyEditsToMesh = () => {
        const current = editsRef.current;
        uniforms.uBrightness.value = current.brightness / 100;
        uniforms.uContrast.value = current.contrast / 100;
        uniforms.uSaturation.value = current.saturation / 100;
        uniforms.uWarmth.value = current.warmth / 100;
        uniforms.uCutBg.value = current.removeBg ? 1 : 0;
        const shaderCrop = cropToShaderRect(current.crop ?? FULL_IMAGE_CROP);
        uniforms.uCropRect.value.set(shaderCrop.x, shaderCrop.y, shaderCrop.z, shaderCrop.w);
        uniforms.uCropPreview.value = croppingRef.current ? 1 : 0;
        if (!mesh) return;
        const src = sourcePixelsRef.current;
        const hostW = Math.max(host.clientWidth, 1);
        const hostH = Math.max(host.clientHeight, 1);
        const iw = src?.width ?? (texture?.image as { width?: number } | undefined)?.width ?? 1;
        const ih = src?.height ?? (texture?.image as { height?: number } | undefined)?.height ?? 1;
        const fit = containRotatedPlane(iw, ih, hostW, hostH, current.rotation);
        previewFitRef.current = fit;
        mesh.rotation.z = -(current.rotation * Math.PI) / 180;
        mesh.scale.set(fit.nw * (current.flipH ? -1 : 1), fit.nh * (current.flipV ? -1 : 1), 1);
      };

      const resize = () => {
        if (!renderer || !texture) return;
        const w = Math.max(host.clientWidth, 1);
        const h = Math.max(host.clientHeight, 1);
        renderer.setPixelRatio(1);
        renderer.setSize(w, h, false);
        applyEditsToMesh();
        setFitTick((n) => n + 1);
      };

      const draw = () => {
        if (!running || !renderer) return;
        frame = requestAnimationFrame(draw);
        applyEditsToMesh();
        renderer.render(scene, camera);
      };

      const attachTexture = (tex: THREE.Texture) => {
        tex.colorSpace = THREE.SRGBColorSpace;
        tex.minFilter = THREE.LinearFilter;
        tex.magFilter = THREE.LinearFilter;
        tex.flipY = true;
        tex.needsUpdate = true;
        texture = tex;
        uniforms.uMap.value = tex;
        if (tex.image) {
          const size = getCanvasSourceSize(tex.image as CanvasImageSource);
          sourcePixelsRef.current = {
            image: tex.image as CanvasImageSource,
            width: size.width,
            height: size.height,
          };
        }
        resize();
        setIsLoading(false);
        setLoadError(null);
        setSourceReady((n) => n + 1);
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
        applyMaskRef.current = () => {};
        uniformsRef.current = null;
        meshRef.current = null;
        sourcePixelsRef.current = null;
        texture?.dispose();
        material?.dispose();
        mesh?.geometry.dispose();
        if (maskTexture && maskTexture !== dummyMask) maskTexture.dispose();
        dummyMask.dispose();
        renderer?.dispose();
        if (renderer?.domElement.parentNode === host) host.removeChild(renderer.domElement);
        if (blobUrl) URL.revokeObjectURL(blobUrl);
      };
    }, [sourceUrl]);

    useEffect(() => {
      if (!edits.removeBg) {
        maskJobRef.current += 1;
        applyMaskRef.current(null);
        return;
      }
      const src = sourcePixelsRef.current;
      if (!src) return;
      const job = ++maskJobRef.current;
      const seeds = edits.bgSeeds;
      const tolerance = edits.bgTolerance;
      const timer = window.setTimeout(() => {
        try {
          const result = computeStudioAlphaMask(
            src.image,
            src.width,
            src.height,
            tolerance,
            seeds,
            PREVIEW_CUTOUT_MAX_EDGE,
          );
          if (job !== maskJobRef.current) return;
          const tex = new THREE.DataTexture(result.rgba, result.width, result.height, THREE.RGBAFormat);
          tex.flipY = true;
          tex.minFilter = THREE.LinearFilter;
          tex.magFilter = THREE.LinearFilter;
          tex.needsUpdate = true;
          applyMaskRef.current(tex);
        } catch {
          if (job === maskJobRef.current) applyMaskRef.current(null);
        }
      }, 70);
      return () => window.clearTimeout(timer);
    }, [edits.removeBg, edits.bgTolerance, edits.bgSeeds, sourceReady, sourceUrl]);

    const patch = useCallback((partial: Partial<ImageStudioEdits>) => {
      setEdits((prev) => ({ ...prev, ...partial }));
    }, []);

    const rotate = (delta: number) => {
      setEdits((prev) => ({
        ...prev,
        rotation: normalizeStudioRotation(prev.rotation + delta),
      }));
    };

    const handlePoint = (event: MouseEvent<HTMLDivElement>) => {
      if (disabled || !pointing || !edits.removeBg) return;
      const host = hostRef.current;
      if (!host) return;
      const seed = studioHostPointToUv(event.clientX, event.clientY, host, previewFitRef.current, edits);
      if (!seed) return;
      setEdits((prev) => ({ ...prev, bgSeeds: [...prev.bgSeeds, seed] }));
    };

    const undoLastSeed = () => {
      setEdits((prev) => ({ ...prev, bgSeeds: prev.bgSeeds.slice(0, -1) }));
    };

    const clearSeeds = () => {
      setEdits((prev) => ({ ...prev, bgSeeds: [] }));
    };

    const removeSeedAt = (index: number) => {
      setEdits((prev) => ({
        ...prev,
        bgSeeds: prev.bgSeeds.filter((_, i) => i !== index),
      }));
    };

    return (
      <div data-image-studio-panel="" className="flex min-h-0 flex-1 flex-col lg:flex-row">
        <div
          className={cn(
            'relative min-h-[min(48dvh,380px)] flex-1 overflow-hidden lg:min-h-[min(58dvh,520px)]',
            edits.removeBg
              ? 'bg-[linear-gradient(45deg,#d7c7a8_25%,transparent_25%,transparent_75%,#d7c7a8_75%),linear-gradient(45deg,#d7c7a8_25%,transparent_25%,transparent_75%,#d7c7a8_75%)] bg-[length:18px_18px] bg-[position:0_0,9px_9px] bg-[#efe4cc]'
              : 'bg-mahogany-base',
          )}
        >
          <div ref={hostRef} data-studio-preview="" className="absolute inset-3 sm:inset-4 lg:inset-5" />
          {!webglOk && (
            <img
              src={sourceUrl}
              alt=""
              className="absolute inset-3 m-auto max-h-[calc(100%-1.5rem)] max-w-[calc(100%-1.5rem)] object-contain sm:inset-4"
              style={{
                filter: `brightness(${edits.brightness}%) contrast(${edits.contrast}%) saturate(${edits.saturation}%)`,
                transform: `rotate(${edits.rotation}deg) scaleX(${edits.flipH ? -1 : 1}) scaleY(${edits.flipV ? -1 : 1})`,
              }}
            />
          )}
          <div className="absolute inset-3 z-[5] sm:inset-4 lg:inset-5">
            {edits.removeBg && pointing && !isLoading && !loadError && (
              <div
                className="absolute inset-0 cursor-crosshair touch-manipulation select-none"
                onClick={handlePoint}
                role="presentation"
                aria-hidden
              />
            )}
            {edits.removeBg &&
              edits.bgSeeds.map((seed, index) => {
                const pos = studioUvToHostPercent(seed, previewFitRef.current, edits);
                return (
                  <button
                    key={`${seed.u.toFixed(4)}-${seed.v.toFixed(4)}-${index}-${fitTick}`}
                    type="button"
                    disabled={disabled}
                    onClick={(event) => {
                      event.stopPropagation();
                      removeSeedAt(index);
                    }}
                    style={{ left: `${pos.left}%`, top: `${pos.top}%` }}
                    className="absolute z-[6] flex h-4 w-4 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-[#1a100c] bg-gold shadow-[0_0_0_3px_rgba(201,162,74,0.28),0_2px_8px_rgba(0,0,0,0.45)] transition-transform hover:scale-110"
                    aria-label={`Remover apontamento ${index + 1}`}
                    title="Toque de novo para tirar este ponto"
                  >
                    <span className="h-1.5 w-1.5 rounded-full bg-[#1a100c]" />
                  </button>
                );
              })}
            {cropping && !isLoading && !loadError && (
              <ImageStudioCropFrame
                crop={edits.crop ?? FULL_IMAGE_CROP}
                fit={previewFitRef.current}
                edits={edits}
                host={hostRef.current}
                disabled={disabled}
                pixelAspect={STUDIO_CROP_ASPECTS.find((item) => item.id === cropAspectId)?.value ?? null}
                imageWidth={sourcePixelsRef.current?.width ?? 1}
                imageHeight={sourcePixelsRef.current?.height ?? 1}
                onChange={(crop) => patch({ crop })}
              />
            )}
          </div>
          {cropping && !isLoading && !loadError && (
            <div className="pointer-events-none absolute inset-x-3 bottom-3 z-[7] flex justify-center">
              <p className="max-w-[22rem] rounded-full border border-gold/35 bg-[#1a100c]/82 px-3 py-1.5 text-center text-[11px] leading-snug text-[#f4e6c8] shadow-[0_8px_24px_rgba(0,0,0,0.35)] backdrop-blur-[2px]">
                Arraste a janela dourada. Os cantos apertam ou alargam o recorte.
              </p>
            </div>
          )}
          {edits.removeBg && !isLoading && !loadError && !cropping && (
            <div className="pointer-events-none absolute inset-x-3 bottom-3 z-[7] flex justify-center">
              <p className="max-w-[22rem] rounded-full border border-gold/35 bg-[#1a100c]/82 px-3 py-1.5 text-center text-[11px] leading-snug text-[#f4e6c8] shadow-[0_8px_24px_rgba(0,0,0,0.35)] backdrop-blur-[2px]">
                {pointing
                  ? 'Toque no resto de parede, chão ou sombra que ainda aparece.'
                  : 'Ligue “Apontar restos” e toque na mancha que sobrou.'}
              </p>
            </div>
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

        <aside className="relative flex w-full shrink-0 flex-col gap-3 overflow-y-auto border-t border-gold-border-subtle/20 bg-[#160e0a] px-4 py-4 lg:w-[19rem] lg:border-l lg:border-t-0">
          <WhiteboardWoodFoil />
          <div className="relative z-[1] space-y-4">
            <div>
              <p className="font-display text-[11px] uppercase tracking-[0.22em] text-gold">
                Bancada de retoque
              </p>
              <p className="mt-1 text-[11px] leading-relaxed text-cream-muted">
                Recorte o que importa, tire o fundo e ajuste a luz. O original do lead não muda.
              </p>
            </div>

            <div className="flex items-center justify-between gap-3 rounded-lg border border-gold-border-subtle/25 bg-black/25 px-3 py-2.5">
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-gold/90">
                  <Crop className="h-3.5 w-3.5" />
                  Recortar
                </div>
                <p className="mt-0.5 text-[10px] text-cream-faint">
                  {studioCropIsActive(edits.crop) ? 'Há um recorte ativo nesta foto.' : 'Escolha só o pedaço que entra na lousa.'}
                </p>
              </div>
              <Switch
                checked={cropping}
                disabled={disabled}
                onCheckedChange={(checked) => {
                  setCropping(checked);
                  if (checked) setPointing(false);
                }}
                aria-label="Recortar a foto"
              />
            </div>

            {cropping && (
              <div className="space-y-3 rounded-lg border border-gold/25 bg-gradient-to-b from-gold/10 to-black/20 p-3">
                <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-gold/90">Proporção</p>
                <div className="flex flex-wrap gap-1.5">
                  {STUDIO_CROP_ASPECTS.map((aspect) => (
                    <Button
                      key={aspect.id}
                      type="button"
                      variant="outline"
                      size="sm"
                      className={cn(
                        'h-7 px-2 text-[10px] border-gold-border-subtle/35 bg-black/20',
                        cropAspectId === aspect.id && 'border-gold/60 bg-gold/15 text-gold',
                      )}
                      disabled={disabled}
                      onClick={() => {
                        setCropAspectId(aspect.id);
                        if (aspect.value) {
                          const src = sourcePixelsRef.current;
                          patch({
                            crop: maxCropForPixelAspect(src?.width ?? 1, src?.height ?? 1, aspect.value),
                          });
                        }
                      }}
                    >
                      {aspect.label}
                    </Button>
                  ))}
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 w-full border-gold-border-subtle/35 bg-black/20 text-[11px]"
                  disabled={disabled || !studioCropIsActive(edits.crop)}
                  onClick={() => patch({ crop: { ...FULL_IMAGE_CROP } })}
                >
                  Foto inteira
                </Button>
              </div>
            )}

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
                onCheckedChange={(checked) => {
                  patch({ removeBg: checked });
                  setPointing(checked);
                  if (checked) setCropping(false);
                }}
                aria-label="Remover fundo da foto"
              />
            </div>

            {edits.removeBg && (
              <div className="space-y-3 rounded-lg border border-gold/25 bg-gradient-to-b from-gold/10 to-black/20 p-3">
                <StudioField label="Sensibilidade" value={`${edits.bgTolerance}`}>
                  <Slider
                    min={12}
                    max={86}
                    step={1}
                    value={[edits.bgTolerance]}
                    disabled={disabled}
                    onValueChange={([value]) => patch({ bgTolerance: value ?? 38 })}
                    aria-label="Sensibilidade da remoção de fundo"
                    className={sliderClass}
                  />
                  <p className="text-[10px] leading-snug text-cream-faint">
                    Mais à direita come mais fundo. Se morder o móvel, volte um pouco.
                  </p>
                </StudioField>

                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-gold/90">
                      <Crosshair className="h-3.5 w-3.5" />
                      Apontar restos
                    </div>
                    <p className="mt-0.5 text-[10px] text-cream-faint">
                      {edits.bgSeeds.length === 0
                        ? 'Toque na foto, na mancha que ficou.'
                        : `${edits.bgSeeds.length} ponto${edits.bgSeeds.length === 1 ? '' : 's'} marcado${edits.bgSeeds.length === 1 ? '' : 's'}.`}
                    </p>
                  </div>
                  <Switch
                    checked={pointing}
                    disabled={disabled}
                    onCheckedChange={(checked) => {
                      setPointing(checked);
                      if (checked) setCropping(false);
                    }}
                    aria-label="Apontar restos de fundo na foto"
                  />
                </div>

                <div className="flex gap-1.5">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-8 flex-1 border-gold-border-subtle/35 bg-black/20 text-[11px]"
                    disabled={disabled || edits.bgSeeds.length === 0}
                    onClick={undoLastSeed}
                  >
                    <Undo2 className="mr-1 h-3.5 w-3.5" />
                    Desfazer
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-8 flex-1 border-gold-border-subtle/35 bg-black/20 text-[11px]"
                    disabled={disabled || edits.bgSeeds.length === 0}
                    onClick={clearSeeds}
                  >
                    <MapPin className="mr-1 h-3.5 w-3.5" />
                    Limpar
                  </Button>
                </div>
              </div>
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

            <StudioField label="Giro" value={`${Math.round(normalizeStudioRotation(edits.rotation))}°`}>
              <Slider
                min={0}
                max={359}
                step={1}
                value={[Math.round(normalizeStudioRotation(edits.rotation))]}
                disabled={disabled}
                onValueChange={([value]) => patch({ rotation: normalizeStudioRotation(value ?? 0) })}
                aria-label="Girar a foto em qualquer direção"
                className={sliderClass}
              />
              <p className="text-[10px] leading-snug text-cream-faint">
                Arraste para virar a foto ao gosto. Os botões abaixo viram 90° de cada vez.
              </p>
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
              onClick={() => {
                setEdits({ ...DEFAULT_IMAGE_STUDIO_EDITS, bgSeeds: [], crop: { ...FULL_IMAGE_CROP } });
                setPointing(false);
                setCropping(false);
                setCropAspectId('livre');
              }}
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
