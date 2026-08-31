import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { cn } from '@/lib/utils';
import { getFurnitureModuleMeta } from '@/lib/furniture-modules';
import { GARBO_WOOD_TEXTURE_URL } from '@/lib/furniture-catalog-banks';
import type { FurnitureModuleType } from '@/lib/whiteboard-annotations';

interface RealisticFurniturePreviewProps {
  moduleType: FurnitureModuleType;
  className?: string;
}

const MAHOGANY = 0x3a241c;
const GOLD = 0xf2d892;

function clearGroup(group: THREE.Group, geometries: THREE.BufferGeometry[]) {
  while (group.children.length > 0) {
    const child = group.children[0];
    group.remove(child);
    if (child instanceof THREE.Mesh) {
      child.geometry.dispose();
    }
  }
  geometries.length = 0;
}

function addBox(
  group: THREE.Group,
  geometries: THREE.BufferGeometry[],
  material: THREE.Material,
  w: number,
  h: number,
  d: number,
  x: number,
  y: number,
  z: number,
) {
  const geo = new THREE.BoxGeometry(w, h, d);
  geometries.push(geo);
  const mesh = new THREE.Mesh(geo, material);
  mesh.castShadow = false;
  mesh.receiveShadow = false;
  mesh.position.set(x, y, z);
  group.add(mesh);
}

/** Peça de marcenaria em caixas — um único material com textura de madeira. */
function buildPiece(
  type: FurnitureModuleType,
  material: THREE.Material,
  group: THREE.Group,
  geometries: THREE.BufferGeometry[],
) {
  clearGroup(group, geometries);
  const meta = getFurnitureModuleMeta(type);
  const w = Math.max(0.5, Math.min(1.8, meta.aspectWidth));
  const d = Math.max(0.32, Math.min(0.85, meta.depthRatio + 0.2));

  if (type === 'sofa' || type === 'sofa_2lugares' || type === 'sofa_canto') {
    const seatH = 0.28;
    addBox(group, geometries, material, w, seatH, d, 0, seatH / 2, 0);
    addBox(group, geometries, material, w, 0.48, 0.12, 0, 0.28 + 0.24, -d / 2 + 0.06);
    addBox(group, geometries, material, 0.1, 0.36, d * 0.92, -w / 2 + 0.05, 0.36, 0);
    addBox(group, geometries, material, 0.1, 0.36, d * 0.92, w / 2 - 0.05, 0.36, 0);
    if (type === 'sofa_canto') {
      addBox(group, geometries, material, w * 0.42, seatH, d * 0.85, w / 2 - w * 0.18, seatH / 2, d * 0.22);
    }
    return;
  }

  if (type === 'cadeira' || type === 'cadeira_poltrona') {
    const seatW = type === 'cadeira_poltrona' ? 0.72 : 0.52;
    const seatD = type === 'cadeira_poltrona' ? 0.62 : 0.48;
    addBox(group, geometries, material, seatW, 0.1, seatD, 0, 0.38, 0);
    addBox(group, geometries, material, seatW, 0.52, 0.08, 0, 0.68, -seatD / 2 + 0.04);
    addBox(group, geometries, material, 0.07, 0.38, 0.07, -seatW / 2 + 0.06, 0.19, -seatD / 2 + 0.06);
    addBox(group, geometries, material, 0.07, 0.38, 0.07, seatW / 2 - 0.06, 0.19, -seatD / 2 + 0.06);
    addBox(group, geometries, material, 0.07, 0.38, 0.07, -seatW / 2 + 0.06, 0.19, seatD / 2 - 0.06);
    addBox(group, geometries, material, 0.07, 0.38, 0.07, seatW / 2 - 0.06, 0.19, seatD / 2 - 0.06);
    return;
  }

  if (type === 'puff') {
    addBox(group, geometries, material, 0.58, 0.32, 0.58, 0, 0.16, 0);
    return;
  }

  if (type.startsWith('guarda_roupa')) {
    addBox(group, geometries, material, w * 0.62, 1.45, d * 0.85, 0, 0.72, 0);
    addBox(group, geometries, material, 0.02, 1.32, 0.02, 0, 0.72, d * 0.42);
    return;
  }

  if (type === 'modulo_cubo' || type === 'nicho' || type === 'nicho_vazio') {
    addBox(group, geometries, material, 0.7, 0.7, 0.7, 0, 0.35, 0);
    return;
  }

  addBox(group, geometries, material, w * 0.55, 0.95, d, 0, 0.48, 0);
}

/**
 * Um único canvas WebGL no catálogo — textura de madeira via TextureLoader.
 * Não usar um renderer por item da lista.
 */
export function RealisticFurniturePreview({ moduleType, className }: RealisticFurniturePreviewProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const rebuildRef = useRef<(type: FurnitureModuleType) => void>(() => undefined);

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
    renderer.domElement.setAttribute('aria-hidden', 'true');
    host.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 20);
    camera.position.set(1.65, 1.15, 2.35);
    camera.lookAt(0, 0.45, 0);

    scene.add(new THREE.AmbientLight(0xfff5e6, 0.72));
    const key = new THREE.DirectionalLight(GOLD, 1.15);
    key.position.set(2.2, 3.2, 2.4);
    scene.add(key);
    const fill = new THREE.PointLight(0xc4a882, 0.7, 12);
    fill.position.set(-2.2, 1.2, 1.4);
    scene.add(fill);

    const material = new THREE.MeshStandardMaterial({
      color: MAHOGANY,
      roughness: 0.62,
      metalness: 0.06,
    });

    const loader = new THREE.TextureLoader();
    const woodTexture = loader.load(
      GARBO_WOOD_TEXTURE_URL,
      (tex) => {
        tex.colorSpace = THREE.SRGBColorSpace;
        tex.wrapS = THREE.RepeatWrapping;
        tex.wrapT = THREE.RepeatWrapping;
        tex.repeat.set(1.4, 1.4);
        tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
        material.map = tex;
        material.needsUpdate = true;
      },
      undefined,
      () => {
        material.color.set(MAHOGANY);
      },
    );

    const piece = new THREE.Group();
    scene.add(piece);
    const geometries: THREE.BufferGeometry[] = [];

    const floor = new THREE.Mesh(
      new THREE.CircleGeometry(1.6, 32),
      new THREE.MeshStandardMaterial({
        color: new THREE.Color('#1a100c'),
        roughness: 0.92,
        transparent: true,
        opacity: 0.45,
      }),
    );
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -0.02;
    scene.add(floor);

    rebuildRef.current = (type) => {
      buildPiece(type, material, piece, geometries);
    };
    rebuildRef.current(moduleType);

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
        piece.rotation.y += dt * 0.35;
      }
      renderer.render(scene, camera);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      rebuildRef.current = () => undefined;
      clearGroup(piece, geometries);
      floor.geometry.dispose();
      (floor.material as THREE.Material).dispose();
      woodTexture.dispose();
      material.dispose();
      renderer.dispose();
      if (renderer.domElement.parentNode === host) {
        host.removeChild(renderer.domElement);
      }
    };
    // Monta o palco uma vez; a peça troca no efeito abaixo.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    rebuildRef.current(moduleType);
  }, [moduleType]);

  const meta = getFurnitureModuleMeta(moduleType);

  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-xl border border-[rgba(240,210,140,0.28)]',
        'bg-[radial-gradient(80%_70%_at_20%_0%,rgba(242,216,146,0.16),transparent_55%),#1a100c]',
        className,
      )}
    >
      <div ref={hostRef} className="h-[5.5rem] w-full" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-[#120c0a] to-transparent px-2.5 pb-1.5 pt-6">
        <p
          className="text-[10px] uppercase tracking-[0.18em] text-[#f2d892]"
          style={{ fontFamily: "'Bebas Neue', sans-serif" }}
        >
          {meta.label} · tamanho na foto
        </p>
      </div>
    </div>
  );
}
