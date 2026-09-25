import { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import gsap from 'gsap';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { Ear, Loader2, Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/contexts/AuthContext';
import { useMarkupConfig } from '@/hooks/useMarkupConfig';
import {
  AUDITOR_LUCRO_PERCENTUAL_PADRAO,
  calcularAuditorLucro,
  formatarIndiceAuditor,
  formatarVezesMaterialAuditor,
  normalizarPercentualAuditorLucro,
  podeVerAuditorLucro,
  resolverPercentualAuditorLucro,
  rotuloAuditorFaixa,
  type AuditorLucroResultado,
  type AuditorLucroStatus,
} from '@/lib/markup-auditor-lucro';
import type { MarkupAuditorLucroFonte, MarkupAuditorLucroMeta } from '@/lib/markup-types';
import { formatarMoedaMarkup } from '@/lib/markup-calculo';
import { tryCreateWebGLRenderer } from '@/lib/webgl-support';
import { cn } from '@/lib/utils';

interface MarkupAuditorLucroProps {
  custoMateriais: number;
  precoFinal: number;
  /** Meta deste orçamento (fonte geral vs específico + %). */
  auditorMeta?: MarkupAuditorLucroMeta | null;
  /** Persiste escolha/percentual específico no `modulos.meta` do orçamento. */
  onAuditorMetaChange?: (meta: MarkupAuditorLucroMeta) => void;
  className?: string;
}

const ICON_SIZE = 36;
const PANEL_WIDTH = 300;

function sortearDestinoNaPista(pista: HTMLElement, icon: number): { x: number; y: number } {
  const maxX = Math.max(0, pista.clientWidth - icon);
  const maxY = Math.max(0, pista.clientHeight - icon);
  return {
    x: Math.random() * maxX,
    y: maxY > 0 ? Math.random() * maxY : 0,
  };
}

const VERTEX = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`;

const FRAGMENT = `
  uniform float uTime;
  uniform float uAlert;
  uniform float uSign;
  varying vec2 vUv;

  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
  }

  float noise(vec2 st) {
    vec2 i = floor(st);
    vec2 f = fract(st);
    float a = hash(i);
    float b = hash(i + vec2(1.0, 0.0));
    float c = hash(i + vec2(0.0, 1.0));
    float d = hash(i + vec2(1.0, 1.0));
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(a, b, u.x) + (c - a) * u.y * (1.0 - u.x) + (d - b) * u.x * u.y;
  }

  void main() {
    vec2 uv = vUv * 2.0 - 1.0;
    float dist = length(uv);
    float t = uTime;
    float n = noise(uv * 3.4 + vec2(t * 0.35, -t * 0.22));
    float rim = pow(1.0 - clamp(dist, 0.0, 1.0), 2.4);
    float core = smoothstep(0.92, 0.12, dist);
    float heat = max(abs(uSign), uAlert);
    float pulse = 0.55 + 0.45 * sin(t * mix(1.6, 4.2, heat));
    float wave = sin(dist * 14.0 - t * mix(2.2, 5.4, heat));
    float ring = smoothstep(0.14, 0.0, abs(wave)) * smoothstep(1.02, 0.18, dist);
    vec3 gold = vec3(0.949, 0.847, 0.573);
    vec3 mahogany = vec3(0.165, 0.094, 0.071);
    vec3 ember = vec3(0.82, 0.28, 0.08);
    vec3 plusCol = vec3(0.38, 0.72, 0.42);
    vec3 calm = mix(mahogany, gold, core * 0.85 + n * 0.18);
    vec3 alertCol = mix(mahogany, ember, core * 0.9 + n * 0.22);
    vec3 aboveCol = mix(mahogany, plusCol, core * 0.88 + n * 0.2);
    vec3 color = mix(calm, alertCol, max(-uSign, 0.0));
    color = mix(color, aboveCol, max(uSign, 0.0));
    color += mix(gold, plusCol, max(uSign, 0.0)) * rim * pulse * mix(0.35, 0.85, heat);
    color += gold * ring * mix(0.16, 0.5, heat);
    float alpha = core * (0.55 + pulse * 0.35) + rim * 0.4;
    alpha *= smoothstep(1.05, 0.62, dist);
    gl_FragColor = vec4(color, clamp(alpha, 0.0, 0.95));
  }
`;

function MarkupAuditorOrb({
  status,
  reducedMotion,
  className,
}: {
  status: AuditorLucroStatus;
  reducedMotion: boolean;
  className?: string;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const alert = status === 'baixo' ? 1 : 0;
  const sign = status === 'acima' ? 1 : status === 'baixo' ? -1 : 0;

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const renderer = tryCreateWebGLRenderer(
      () =>
        new THREE.WebGLRenderer({
          alpha: true,
          antialias: false,
          powerPreference: 'low-power',
          failIfMajorPerformanceCaveat: true,
        }),
    );
    if (!renderer) return;

    renderer.setClearColor(0x000000, 0);
    renderer.domElement.style.display = 'block';
    renderer.domElement.style.position = 'absolute';
    renderer.domElement.style.inset = '0';
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
    renderer.domElement.style.pointerEvents = 'none';
    host.appendChild(renderer.domElement);

    const uniforms = {
      uTime: { value: 0 },
      uAlert: { value: alert },
      uSign: { value: sign },
    };
    const material = new THREE.ShaderMaterial({
      transparent: true,
      depthTest: false,
      uniforms,
      vertexShader: VERTEX,
      fragmentShader: FRAGMENT,
    });
    const scene = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    scene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material));

    const clock = new THREE.Clock();
    let running = true;
    let frame = 0;

    const resize = () => {
      const size = Math.max(host.clientWidth, 1);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
      renderer.setSize(size, size, false);
    };
    const ro = new ResizeObserver(resize);
    ro.observe(host);
    resize();

    const draw = () => {
      if (!running) return;
      if (!reducedMotion) frame = requestAnimationFrame(draw);
      uniforms.uTime.value = reducedMotion ? 0.4 : clock.getElapsedTime();
      uniforms.uAlert.value = alert;
      uniforms.uSign.value = sign;
      renderer.render(scene, camera);
    };

    if (reducedMotion) {
      renderer.render(scene, camera);
    } else {
      draw();
    }

    return () => {
      running = false;
      cancelAnimationFrame(frame);
      ro.disconnect();
      material.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, [alert, sign, reducedMotion]);

  return (
    <div
      ref={hostRef}
      className={cn(
        'absolute inset-0 overflow-hidden rounded-full bg-[#2a1812]',
        className,
      )}
      aria-hidden
    >
      <span
        className={cn(
          'pointer-events-none absolute inset-[18%] rounded-full bg-gradient-to-br from-amber-200/80 to-[#6b3a1a]',
          status === 'baixo' && 'from-orange-300 to-red-800',
          status === 'acima' && 'from-emerald-200 to-[#1f3a18]',
        )}
      />
    </div>
  );
}

function AuditorIndiceMaterial({ auditor }: { auditor: AuditorLucroResultado }) {
  if (auditor.status === 'sem_material' || !(auditor.custoMateriais > 0)) return null;

  const vezes = formatarVezesMaterialAuditor(auditor.percentualAtual);
  const atual = formatarIndiceAuditor(auditor.percentualAtual);
  const alvo = formatarIndiceAuditor(auditor.percentualAlvo);
  const progresso = Math.min(
    1,
    Math.max(0, auditor.percentualAlvo > 0 ? auditor.percentualAtual / auditor.percentualAlvo : 0),
  );

  return (
    <div
      data-markup-auditor-indice=""
      className="relative mt-3 space-y-2 border-t border-amber-200/15 pt-2.5"
      aria-label={`Preço atual é material vezes ${vezes}. Ideal ${alvo}, está em ${atual}.`}
    >
      <p className="text-[11px] leading-relaxed text-amber-100/78">
        Preço atual{' '}
        <strong className="font-semibold tabular-nums text-amber-50">material × {vezes}</strong>
      </p>
      <p className="text-[11px] leading-relaxed text-amber-100/78">
        Ideal <strong className="tabular-nums text-amber-100">{alvo}</strong>
        {' · '}está em{' '}
        <strong
          className={cn(
            'tabular-nums',
            auditor.status === 'baixo' && 'text-orange-200',
            auditor.status === 'acima' && 'text-emerald-200',
            auditor.status === 'ok' && 'text-amber-100',
          )}
        >
          {atual}
        </strong>
      </p>
      <div
        className="h-1 overflow-hidden rounded-full bg-amber-200/10"
        aria-hidden
      >
        <div
          className={cn(
            'h-full rounded-full transition-[width] duration-500',
            auditor.status === 'baixo' && 'bg-gradient-to-r from-[#8a3018] to-orange-300',
            auditor.status === 'acima' && 'bg-gradient-to-r from-[#1f3a18] to-emerald-300',
            auditor.status === 'ok' && 'bg-gradient-to-r from-[#5a3d16] to-amber-200',
          )}
          style={{ width: `${Math.max(progresso * 100, 5)}%` }}
        />
      </div>
    </div>
  );
}

export function MarkupAuditorLucro({
  custoMateriais,
  precoFinal,
  auditorMeta = null,
  onAuditorMetaChange,
  className,
}: MarkupAuditorLucroProps) {
  const { userRole, isSuperAdmin } = useAuth();
  const { config, salvarConfig } = useMarkupConfig();
  const reducedMotion = useReducedMotion() ?? false;
  const pistaRef = useRef<HTMLDivElement>(null);
  const clusterRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const sinalRef = useRef<HTMLSpanElement>(null);
  const textoRef = useRef<HTMLParagraphElement>(null);
  const [painelAberto, setPainelAberto] = useState(false);
  const [ajustesAberto, setAjustesAberto] = useState(false);
  const [pausado, setPausado] = useState(false);
  const [abreEsquerda, setAbreEsquerda] = useState(true);
  const [fonteDraft, setFonteDraft] = useState<MarkupAuditorLucroFonte>(
    auditorMeta?.fonte === 'especifico' ? 'especifico' : 'geral',
  );
  const [percentualDraft, setPercentualDraft] = useState(String(AUDITOR_LUCRO_PERCENTUAL_PADRAO));
  const [salvandoLead, setSalvandoLead] = useState(false);

  const visivel = podeVerAuditorLucro(userRole, isSuperAdmin);
  const percentualGeral = normalizarPercentualAuditorLucro(config.auditor_lucro_percentual);
  const percentualAlvo = resolverPercentualAuditorLucro(config.auditor_lucro_percentual, auditorMeta);
  const auditor = useMemo(
    () =>
      calcularAuditorLucro({
        custoMateriais,
        precoFinal,
        percentualAlvo,
      }),
    [custoMateriais, precoFinal, percentualAlvo],
  );
  const rotuloFaixa = rotuloAuditorFaixa(auditor.status, auditor.percentualDiferenca);
  const sinal = auditor.status === 'acima' ? '+' : auditor.status === 'baixo' ? '−' : null;
  const foraDoAlvo = auditor.status === 'baixo' || auditor.status === 'acima';
  const salvando = salvarConfig.isPending || salvandoLead;

  useEffect(() => {
    const fonte: MarkupAuditorLucroFonte =
      auditorMeta?.fonte === 'especifico' ? 'especifico' : 'geral';
    setFonteDraft(fonte);
    const valorEditavel =
      fonte === 'especifico'
        ? resolverPercentualAuditorLucro(percentualGeral, {
            fonte: 'especifico',
            percentual: auditorMeta?.percentual,
          })
        : percentualGeral;
    setPercentualDraft(String(valorEditavel));
  }, [auditorMeta?.fonte, auditorMeta?.percentual, percentualGeral]);

  useEffect(() => {
    if (!visivel) return;
    const pista = pistaRef.current;
    const el = clusterRef.current;
    if (!pista || !el) return;

    if (reducedMotion || painelAberto || pausado) {
      gsap.killTweensOf(el);
      return;
    }

    const vagar = () => {
      const dest = sortearDestinoNaPista(pista, ICON_SIZE);
      gsap.to(el, {
        x: dest.x,
        y: dest.y,
        duration: 1.8 + Math.random() * 1.6,
        ease: 'sine.inOut',
        onComplete: vagar,
      });
    };
    vagar();

    return () => {
      gsap.killTweensOf(el);
    };
  }, [visivel, painelAberto, pausado, reducedMotion]);

  useEffect(() => {
    const el = triggerRef.current;
    if (!el || reducedMotion) return;
    const ctx = gsap.context(() => {
      gsap.killTweensOf(el);
      if (foraDoAlvo && !painelAberto) {
        gsap.to(el, {
          scale: 1.08,
          duration: 0.68,
          yoyo: true,
          repeat: -1,
          ease: 'sine.inOut',
        });
      } else {
        gsap.to(el, { scale: 1, duration: 0.28, ease: 'power2.out' });
      }
    }, el);
    return () => ctx.revert();
  }, [foraDoAlvo, painelAberto, reducedMotion]);

  useEffect(() => {
    const el = sinalRef.current;
    if (!el) return;
    if (reducedMotion || !sinal || painelAberto) {
      gsap.set(el, { y: 0 });
      return;
    }
    const tween = gsap.to(el, {
      y: -5,
      duration: 1.15,
      yoyo: true,
      repeat: -1,
      ease: 'sine.inOut',
    });
    return () => {
      tween.kill();
      gsap.set(el, { y: 0 });
    };
  }, [sinal, painelAberto, reducedMotion]);

  useEffect(() => {
    const el = textoRef.current;
    if (!el || !rotuloFaixa) return;

    gsap.set(el, { transformOrigin: '50% 100%' });

    if (reducedMotion) {
      gsap.set(el, { scale: 1, y: 0, opacity: 1 });
      return;
    }

    if (painelAberto) {
      gsap.killTweensOf(el);
      gsap.set(el, { scale: 0, y: 10, opacity: 0 });
      return;
    }

    const tl = gsap.timeline({ repeat: -1, repeatDelay: 0.28 });
    tl.fromTo(
      el,
      { scale: 0.06, y: 14, opacity: 0 },
      { scale: 1, y: 0, opacity: 1, duration: 0.9, ease: 'back.out(1.7)' },
    )
      .to(el, { duration: 1.7 })
      .to(el, { scale: 0.06, y: 14, opacity: 0, duration: 0.75, ease: 'back.in(1.5)' });

    return () => {
      tl.kill();
      gsap.set(el, { scale: 0.06, y: 14, opacity: 0 });
    };
  }, [rotuloFaixa, painelAberto, reducedMotion]);

  if (!visivel) return null;

  const aplicarFonte = (proxima: MarkupAuditorLucroFonte) => {
    setFonteDraft(proxima);
    if (proxima === 'geral') {
      setPercentualDraft(String(percentualGeral));
      onAuditorMetaChange?.({
        fonte: 'geral',
        percentual: auditorMeta?.percentual,
      });
      return;
    }
    const seed =
      auditorMeta?.percentual != null && Number(auditorMeta.percentual) > 0
        ? normalizarPercentualAuditorLucro(auditorMeta.percentual)
        : percentualGeral;
    setPercentualDraft(String(seed));
    onAuditorMetaChange?.({
      fonte: 'especifico',
      percentual: seed,
    });
  };

  const handleSalvarMargem = () => {
    const proximo = normalizarPercentualAuditorLucro(
      percentualDraft.replace(',', '.') || AUDITOR_LUCRO_PERCENTUAL_PADRAO,
    );
    if (fonteDraft === 'especifico') {
      setSalvandoLead(true);
      try {
        onAuditorMetaChange?.({
          fonte: 'especifico',
          percentual: proximo,
        });
        setAjustesAberto(false);
      } finally {
        setSalvandoLead(false);
      }
      return;
    }
    salvarConfig.mutate(
      { auditor_lucro_percentual: proximo },
      {
        onSuccess: () => {
          onAuditorMetaChange?.({
            fonte: 'geral',
            percentual: auditorMeta?.percentual,
          });
          setAjustesAberto(false);
        },
      },
    );
  };

  const abrirPainel = () => {
    const pista = pistaRef.current;
    const el = clusterRef.current;
    if (pista && el) {
      const x = Number(gsap.getProperty(el, 'x')) || 0;
      setAbreEsquerda(x > pista.clientWidth * 0.45);
    }
    setPainelAberto(true);
    setPausado(true);
  };

  const fecharPainel = () => {
    setPainelAberto(false);
    setAjustesAberto(false);
    setPausado(false);
  };

  const triggerLabel =
    auditor.status === 'baixo'
      ? 'Abrir auditor de lucro — preço abaixo do ideal'
      : auditor.status === 'acima'
        ? 'Abrir auditor de lucro — preço acima do ideal'
        : 'Abrir auditor de lucro';

  return (
    <div
      ref={pistaRef}
      data-markup-auditor-lucro=""
      data-auditor-status={auditor.status}
      className={cn('relative h-9 w-36 shrink-0 overflow-visible', className)}
      onPointerEnter={() => setPausado(true)}
      onPointerLeave={() => {
        if (!painelAberto) setPausado(false);
      }}
    >
      <div ref={clusterRef} className="absolute left-0 top-0 will-change-transform">
      <button
        ref={triggerRef}
        type="button"
        aria-label={painelAberto ? 'Fechar auditor de lucro' : triggerLabel}
        aria-expanded={painelAberto}
        data-markup-auditor-trigger=""
        className={cn(
          'relative flex h-9 w-9 items-center justify-center rounded-full border outline-none transition-[box-shadow,border-color]',
          'focus-visible:ring-2 focus-visible:ring-amber-200/80 focus-visible:ring-offset-2 focus-visible:ring-offset-[#1c110d]',
          auditor.status === 'baixo'
            ? 'border-orange-400/80 shadow-[0_0_22px_rgba(196,92,42,0.55)]'
            : auditor.status === 'acima'
              ? 'border-emerald-400/70 shadow-[0_0_22px_rgba(74,160,80,0.42)]'
              : 'border-amber-200/35 shadow-[0_0_16px_rgba(242,216,146,0.32)]',
        )}
        onClick={() => (painelAberto ? fecharPainel() : abrirPainel())}
      >
        <MarkupAuditorOrb status={auditor.status} reducedMotion={reducedMotion} />
        <Ear
          className="relative z-[1] h-4 w-4 text-[#fff6ea] drop-shadow-[0_1px_6px_rgba(0,0,0,0.55)]"
          strokeWidth={2.15}
          aria-hidden
        />
        {sinal && (
          <span
            ref={sinalRef}
            data-markup-auditor-sinal=""
            aria-hidden
            className={cn(
              'pointer-events-none absolute -right-2 -top-2.5 z-[2] flex h-6 w-6 items-center justify-center rounded-full border text-[13px] font-black leading-none',
              auditor.status === 'baixo'
                ? 'border-orange-300/80 bg-[#3a140c] text-orange-200 shadow-[0_6px_14px_rgba(196,92,42,0.55)]'
                : 'border-emerald-200/80 bg-[#132414] text-emerald-200 shadow-[0_6px_14px_rgba(74,160,80,0.45)]',
            )}
          >
            {sinal}
            <span
              className={cn(
                'absolute left-1/2 top-full h-1.5 w-1.5 -translate-x-1/2 -translate-y-[3px] rotate-45 border-b border-r',
                auditor.status === 'baixo'
                  ? 'border-orange-300/80 bg-[#3a140c]'
                  : 'border-emerald-200/80 bg-[#132414]',
              )}
            />
          </span>
        )}
      </button>

      {rotuloFaixa && !painelAberto && (
        <div className="pointer-events-none absolute bottom-[calc(100%+10px)] left-1/2 z-[3] -translate-x-1/2">
          <p
            ref={textoRef}
            data-markup-auditor-texto=""
            className={cn(
              'w-max max-w-[240px] origin-bottom rounded-lg border px-2.5 py-1 text-center font-display text-[11px] font-normal uppercase leading-snug tracking-[0.08em] opacity-0',
              auditor.status === 'baixo'
                ? 'border-orange-300/35 bg-[#2a120c]/95 text-orange-50 shadow-[0_12px_28px_rgba(80,24,8,0.45)]'
                : 'border-emerald-300/35 bg-[#102016]/95 text-emerald-50 shadow-[0_12px_28px_rgba(16,40,20,0.45)]',
            )}
          >
            {rotuloFaixa}
          </p>
        </div>
      )}

      <AnimatePresence>
        {painelAberto && (
          <motion.div
            key="auditor-popup"
            role="dialog"
            aria-label="Auditor de lucro"
            initial={reducedMotion ? false : { opacity: 0, y: 8, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={reducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.96 }}
            transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
            className={cn(
              'absolute bottom-full z-20 mb-2 overflow-hidden rounded-xl border border-amber-200/20 bg-[#1c110d] text-[#fff6ea] shadow-[0_28px_70px_rgba(12,6,3,0.62)]',
              abreEsquerda ? 'right-0' : 'left-0',
            )}
            style={{ width: PANEL_WIDTH }}
          >
            <div className="relative overflow-hidden px-3.5 pb-3.5 pt-3">
              <div
                aria-hidden
                className="pointer-events-none absolute inset-0 opacity-40"
                style={{
                  background:
                    'radial-gradient(120% 80% at 100% 0%, rgba(196,92,42,0.28), transparent 55%), radial-gradient(90% 70% at 0% 100%, rgba(242,216,146,0.12), transparent 50%)',
                }}
              />
              <div className="relative flex items-start gap-2">
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-amber-200/85">
                    Auditor de lucro
                  </p>
                  <p className="mt-0.5 text-[10px] text-amber-100/55">
                    {auditorMeta?.fonte === 'especifico' ? 'Meta deste lead' : 'Meta geral'}
                  </p>
                </div>
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7 shrink-0 text-amber-200 hover:bg-amber-100/10 hover:text-amber-50"
                  aria-label="Configurar margem do auditor de lucro"
                  aria-expanded={ajustesAberto}
                  data-markup-auditor-ajustes=""
                  onClick={() => setAjustesAberto((atual) => !atual)}
                >
                  <Settings className="h-3.5 w-3.5" />
                </Button>
              </div>

              {auditor.status === 'baixo' && (
                <div
                  role="status"
                  data-markup-auditor-alerta=""
                  className="relative mt-2.5 space-y-1 text-sm"
                >
                  <p>
                    Ideal{' '}
                    <strong className="tabular-nums text-amber-100">
                      {formatarMoedaMarkup(auditor.precoIdeal)}
                    </strong>
                  </p>
                  <p>
                    Faltam{' '}
                    <strong className="tabular-nums text-orange-200">
                      {formatarMoedaMarkup(auditor.diferenca)}
                    </strong>
                  </p>
                </div>
              )}
              {auditor.status === 'acima' && (
                <div
                  role="status"
                  data-markup-auditor-alerta=""
                  className="relative mt-2.5 space-y-1 text-sm"
                >
                  <p>
                    Ideal{' '}
                    <strong className="tabular-nums text-amber-100">
                      {formatarMoedaMarkup(auditor.precoIdeal)}
                    </strong>
                  </p>
                  <p>
                    Acima{' '}
                    <strong className="tabular-nums text-emerald-200">
                      {formatarMoedaMarkup(Math.abs(auditor.diferenca))}
                    </strong>
                  </p>
                </div>
              )}
              {auditor.status === 'ok' && (
                <p className="relative mt-2.5 text-sm text-amber-100/80">
                  Ideal{' '}
                  <strong className="tabular-nums text-amber-100">
                    {formatarMoedaMarkup(auditor.precoIdeal)}
                  </strong>
                  . No alvo.
                </p>
              )}
              {auditor.status === 'sem_material' && (
                <p className="relative mt-2.5 text-sm text-amber-100/70">Sem material ainda.</p>
              )}

              <AuditorIndiceMaterial auditor={auditor} />

              <AnimatePresence initial={false}>
                {ajustesAberto && (
                  <motion.div
                    key="auditor-ajustes"
                    initial={reducedMotion ? false : { height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={reducedMotion ? { opacity: 0 } : { height: 0, opacity: 0 }}
                    transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
                    className="relative overflow-hidden"
                  >
                    <div className="mt-3 space-y-2.5 border-t border-amber-200/15 pt-3">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-amber-200/75">
                        Qual markup usar?
                      </p>
                      <div
                        role="group"
                        aria-label="Escolher markup geral ou deste lead"
                        className="flex rounded-lg border border-amber-200/20 bg-[#2a1812]/80 p-0.5"
                      >
                        <button
                          type="button"
                          data-markup-auditor-fonte="geral"
                          className={cn(
                            'flex-1 rounded-md px-2 py-1.5 text-[11px] font-medium transition-colors',
                            fonteDraft === 'geral'
                              ? 'bg-amber-200/20 text-amber-50 shadow-[inset_0_1px_0_rgba(242,216,146,0.12)]'
                              : 'text-amber-100/55 hover:text-amber-100/85',
                          )}
                          onClick={() => aplicarFonte('geral')}
                        >
                          Geral
                        </button>
                        <button
                          type="button"
                          data-markup-auditor-fonte="especifico"
                          className={cn(
                            'flex-1 rounded-md px-2 py-1.5 text-[11px] font-medium transition-colors',
                            fonteDraft === 'especifico'
                              ? 'bg-amber-200/20 text-amber-50 shadow-[inset_0_1px_0_rgba(242,216,146,0.12)]'
                              : 'text-amber-100/55 hover:text-amber-100/85',
                          )}
                          onClick={() => aplicarFonte('especifico')}
                        >
                          Este lead
                        </button>
                      </div>
                      <p className="text-[10px] leading-relaxed text-amber-100/50">
                        Geral vale para todos os leads. Este lead só neste orçamento.
                      </p>
                      <Label htmlFor="auditor-lucro-percentual" className="text-amber-100/80">
                        {fonteDraft === 'especifico'
                          ? 'Percentual alvo deste lead (%)'
                          : 'Percentual alvo geral (%)'}
                      </Label>
                      <Input
                        id="auditor-lucro-percentual"
                        type="number"
                        min={1}
                        max={9999}
                        step={1}
                        value={percentualDraft}
                        onChange={(event) => setPercentualDraft(event.target.value)}
                        className="border-amber-200/20 bg-[#2a1812] text-amber-50"
                      />
                      <Button
                        type="button"
                        size="sm"
                        className="w-full"
                        onClick={handleSalvarMargem}
                        disabled={salvando || (fonteDraft === 'especifico' && !onAuditorMetaChange)}
                      >
                        {salvando ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : fonteDraft === 'especifico' ? (
                          'Salvar neste lead'
                        ) : (
                          'Salvar margem geral'
                        )}
                      </Button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      </div>
    </div>
  );
}

export function MarkupAuditorLucroPrecoSelo({
  custoMateriais,
  precoFinal,
}: {
  custoMateriais: number;
  precoFinal: number;
}) {
  const { userRole, isSuperAdmin } = useAuth();
  const { config } = useMarkupConfig();
  const visivel = podeVerAuditorLucro(userRole, isSuperAdmin);
  const auditor = useMemo(
    () =>
      calcularAuditorLucro({
        custoMateriais,
        precoFinal,
        percentualAlvo: config.auditor_lucro_percentual,
      }),
    [custoMateriais, precoFinal, config.auditor_lucro_percentual],
  );

  if (!visivel || auditor.status !== 'baixo') return null;

  return (
    <motion.span
      data-markup-auditor-preco-selo=""
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-full border border-orange-400/40 bg-orange-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-orange-800 dark:bg-orange-950/60 dark:text-orange-100"
    >
      abaixo do alvo
    </motion.span>
  );
}
