import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import type { MarkupIAFidelidadeInventario } from '@/lib/markup-ia-fidelidade';
import { cn } from '@/lib/utils';

interface MarkupIAKitSceneProps {
  fidelidade: MarkupIAFidelidadeInventario | null;
  scanning?: boolean;
  className?: string;
}

const GOLD = '#f2d892';
const MAHOGANY = '#2a1812';
const CREAM = '#fff6ea';

function hexToColor(hex: string | null | undefined, fallback: string): THREE.Color {
  const raw = hex?.trim();
  if (raw && /^#?[0-9a-f]{6}$/i.test(raw)) {
    return new THREE.Color(raw.startsWith('#') ? raw : `#${raw}`);
  }
  return new THREE.Color(fallback);
}

function makeGrainDataUrl(hex: string): string {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';
  ctx.fillStyle = hex;
  ctx.fillRect(0, 0, 128, 128);
  ctx.strokeStyle = 'rgba(0,0,0,0.08)';
  for (let y = 4; y < 128; y += 7) {
    ctx.beginPath();
    ctx.moveTo(0, y + Math.sin(y) * 2);
    ctx.lineTo(128, y);
    ctx.stroke();
  }
  return canvas.toDataURL('image/png');
}

/**
 * Kit 3D do projeto: módulos viram caixas. O que não está no YAML não aparece.
 */
export function MarkupIAKitScene({ fidelidade, scanning, className }: MarkupIAKitSceneProps) {
  const hostRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    THREE.Cache.enabled = true;

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: 'low-power',
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    renderer.setClearColor(0x000000, 0);
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
    renderer.domElement.style.display = 'block';
    host.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 40);
    camera.position.set(0, 1.35, 6.2);

    const group = new THREE.Group();
    scene.add(group);

    scene.add(new THREE.AmbientLight(0xfff5e6, 0.7));
    const key = new THREE.PointLight(0xf2d892, 2.1, 18);
    key.position.set(2.4, 3.2, 4);
    scene.add(key);
    const rim = new THREE.PointLight(0xc4a882, 1.1, 14);
    rim.position.set(-3, 1.5, -2);
    scene.add(rim);

    const meshes: THREE.Mesh[] = [];
    const textures: THREE.Texture[] = [];
    const manager = new THREE.LoadingManager();
    const textureLoader = new THREE.TextureLoader(manager);

    const moveis = fidelidade?.moveis ?? [];
    const todosModulos = moveis.flatMap((m) =>
      m.modulos.map((mod, i) => ({
        ...mod,
        cor: m.color_scheme[0],
        nome: m.nome_tipo,
        key: `${m.nome_tipo}-${mod.posicao}-${i}`,
      })),
    );

    const pecas =
      todosModulos.length > 0
        ? todosModulos
        : scanning
          ? [{ tipo: 'leitura', largura_relativa_pct: 40, cor: undefined, nome: '…', posicao: 1, detalhes: null, key: 'placeholder' }]
          : [];

    const n = Math.max(pecas.length, 1);
    pecas.slice(0, 12).forEach((peca, index) => {
      const w = Math.max(0.35, (peca.largura_relativa_pct ?? 28) / 55);
      const isPorta = peca.tipo.toLowerCase().includes('porta');
      const isGaveta = peca.tipo.toLowerCase().includes('gaveta');
      const h = isGaveta ? 0.45 : isPorta ? 1.7 : 1.15;
      const depth = 0.42;
      const geo = new THREE.BoxGeometry(w, h, depth);
      const fallback = isGaveta ? GOLD : isPorta ? CREAM : MAHOGANY;
      const hex = peca.cor?.hex ?? fallback;
      const color = hexToColor(typeof hex === 'string' ? hex : peca.cor?.hex, fallback);
      const mat = new THREE.MeshStandardMaterial({
        color,
        roughness: 0.55,
        metalness: 0.08,
      });
      const mesh = new THREE.Mesh(geo, mat);
      const span = Math.min(n, 12);
      mesh.position.x = (index - (span - 1) / 2) * 0.95;
      mesh.position.y = h / 2 - 0.2;
      group.add(mesh);
      meshes.push(mesh);

      const grainUrl = makeGrainDataUrl(`#${color.getHexString()}`);
      if (grainUrl) {
        textureLoader.load(grainUrl, (tex) => {
          tex.colorSpace = THREE.SRGBColorSpace;
          tex.wrapS = THREE.RepeatWrapping;
          tex.wrapT = THREE.RepeatWrapping;
          tex.repeat.set(2, 2);
          mat.map = tex;
          mat.needsUpdate = true;
          textures.push(tex);
        });
      }
    });

    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(8, 4),
      new THREE.MeshStandardMaterial({
        color: new THREE.Color('#1a100c'),
        roughness: 0.9,
        transparent: true,
        opacity: 0.35,
      }),
    );
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -0.22;
    scene.add(floor);

    const resize = () => {
      const w = host.clientWidth || 1;
      const h = host.clientHeight || 1;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(host);

    let raf = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      if (!prefersReducedMotion) {
        group.rotation.y += dt * (scanning ? 0.55 : 0.18);
      }
      renderer.render(scene, camera);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      meshes.forEach((m) => {
        m.geometry.dispose();
        (m.material as THREE.Material).dispose();
      });
      textures.forEach((t) => t.dispose());
      floor.geometry.dispose();
      (floor.material as THREE.Material).dispose();
      renderer.dispose();
      host.removeChild(renderer.domElement);
    };
  }, [fidelidade, scanning]);

  const vazio = !fidelidade?.moveis.length && !scanning;

  return (
    <div className={cn('relative overflow-hidden rounded-xl border border-amber-500/20 bg-[#120c0a]', className)}>
      <div ref={hostRef} className="h-full min-h-[180px] w-full" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-[#120c0a] to-transparent px-3 pb-2 pt-8">
        <p
          className="text-[11px] uppercase tracking-[0.18em] text-amber-400/90"
          style={{ fontFamily: "'Bebas Neue', sans-serif" }}
        >
          {scanning ? 'Montando o kit…' : vazio ? 'Aguardando leitura' : 'Kit do projeto — só o que está no papel'}
        </p>
      </div>
    </div>
  );
}
