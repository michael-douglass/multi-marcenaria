import * as THREE from 'three';
import { getFurnitureModuleMeta } from '@/lib/furniture-modules';
import { GARBO_WOOD_TEXTURE_URL } from '@/lib/furniture-catalog-banks';
import { tryCreateWebGLRenderer } from '@/lib/webgl-support';
import type { FurnitureModuleType } from '@/lib/whiteboard-annotations';

export const REALISTIC_MAHOGANY = 0x3a241c;
export const REALISTIC_GOLD = 0xf2d892;

const SNAPSHOT_SIZE = 320;
const dataUrlCache = new Map<string, string>();
const inflight = new Map<string, Promise<string | null>>();

export function clearRealisticGroup(group: THREE.Group, geometries: THREE.BufferGeometry[]) {
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
  mesh.position.set(x, y, z);
  group.add(mesh);
}

/** A mesma peça 3D do catálogo Realistas — caixas de marcenaria com um material. */
export function buildRealisticFurniturePiece(
  type: FurnitureModuleType,
  material: THREE.Material,
  group: THREE.Group,
  geometries: THREE.BufferGeometry[],
) {
  clearRealisticGroup(group, geometries);
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

  if (type === 'rack') {
    addBox(group, geometries, material, w * 0.95, 0.12, d, 0, 0.38, 0);
    addBox(group, geometries, material, 0.08, 0.38, d * 0.9, -w * 0.4, 0.19, 0);
    addBox(group, geometries, material, 0.08, 0.38, d * 0.9, w * 0.4, 0.19, 0);
    addBox(group, geometries, material, w * 0.88, 0.08, d * 0.92, 0, 0.04, 0);
    return;
  }

  if (type === 'armario_2_portas' || type === 'armario_vazio') {
    addBox(group, geometries, material, w * 0.58, 1.2, d * 0.8, 0, 0.6, 0);
    return;
  }

  addBox(group, geometries, material, w * 0.55, 0.95, d, 0, 0.48, 0);
}

export function createRealisticWoodMaterial(): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    color: REALISTIC_MAHOGANY,
    roughness: 0.62,
    metalness: 0.06,
  });
}

export function fitRealisticCamera(camera: THREE.PerspectiveCamera, piece: THREE.Group, aspect: number) {
  const box = new THREE.Box3().setFromObject(piece);
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  const maxDim = Math.max(size.x, size.y, size.z, 0.4);
  const dist = maxDim * 2.05;
  camera.position.set(center.x + dist * 0.62, center.y + dist * 0.42, center.z + dist * 0.82);
  camera.near = 0.05;
  camera.far = dist * 8;
  camera.lookAt(center);
  camera.aspect = Math.max(aspect, 0.2);
  camera.updateProjectionMatrix();
}

interface SharedStudio {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  piece: THREE.Group;
  geometries: THREE.BufferGeometry[];
  material: THREE.MeshStandardMaterial;
  woodReady: Promise<void>;
}

let sharedStudio: SharedStudio | null | undefined;

function getSharedStudio(): SharedStudio | null {
  if (sharedStudio !== undefined) return sharedStudio;
  if (typeof document === 'undefined') {
    sharedStudio = null;
    return null;
  }

  THREE.Cache.enabled = true;
  const renderer = tryCreateWebGLRenderer(
    () =>
      new THREE.WebGLRenderer({
        antialias: true,
        alpha: true,
        preserveDrawingBuffer: true,
        powerPreference: 'low-power',
      }),
  );
  if (!renderer) {
    sharedStudio = null;
    return null;
  }

  renderer.setPixelRatio(1);
  renderer.setSize(SNAPSHOT_SIZE, SNAPSHOT_SIZE, false);
  renderer.setClearColor(0x000000, 0);
  renderer.domElement.style.position = 'fixed';
  renderer.domElement.style.left = '-4000px';
  renderer.domElement.style.top = '0';
  renderer.domElement.style.pointerEvents = 'none';
  renderer.domElement.setAttribute('aria-hidden', 'true');
  document.body.appendChild(renderer.domElement);

  const material = createRealisticWoodMaterial();
  const piece = new THREE.Group();
  const geometries: THREE.BufferGeometry[] = [];
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 20);
  scene.add(new THREE.AmbientLight(0xfff5e6, 0.72));
  const key = new THREE.DirectionalLight(REALISTIC_GOLD, 1.15);
  key.position.set(2.2, 3.2, 2.4);
  scene.add(key);
  const fill = new THREE.PointLight(0xc4a882, 0.7, 12);
  fill.position.set(-2.2, 1.2, 1.4);
  scene.add(fill);
  scene.add(piece);

  const woodReady = new Promise<void>((resolve) => {
    const loader = new THREE.TextureLoader();
    loader.load(
      GARBO_WOOD_TEXTURE_URL,
      (tex) => {
        tex.colorSpace = THREE.SRGBColorSpace;
        tex.wrapS = THREE.RepeatWrapping;
        tex.wrapT = THREE.RepeatWrapping;
        tex.repeat.set(1.4, 1.4);
        tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
        tex.needsUpdate = true;
        material.map = tex;
        material.needsUpdate = true;
        resolve();
      },
      undefined,
      () => resolve(),
    );
    window.setTimeout(resolve, 800);
  });

  sharedStudio = { renderer, scene, camera, piece, geometries, material, woodReady };
  return sharedStudio;
}

function renderSharedSnapshot(type: FurnitureModuleType, size: number): string | null {
  const studio = getSharedStudio();
  if (!studio) return null;
  buildRealisticFurniturePiece(type, studio.material, studio.piece, studio.geometries);
  studio.renderer.setSize(size, size, false);
  fitRealisticCamera(studio.camera, studio.piece, 1);
  studio.renderer.render(studio.scene, studio.camera);
  return studio.renderer.domElement.toDataURL('image/png');
}

/** Uma foto da peça 3D — um único WebGL compartilhado, reutilizado na lousa e no catálogo. */
export function getRealisticFurnitureDataUrl(
  moduleType: FurnitureModuleType,
  size = SNAPSHOT_SIZE,
): Promise<string | null> {
  const key = `${moduleType}:${size}`;
  const cached = dataUrlCache.get(key);
  if (cached) return Promise.resolve(cached);

  const running = inflight.get(key);
  if (running) return running;

  const task = (async () => {
    const studio = getSharedStudio();
    if (!studio) return null;
    await studio.woodReady;
    const url = renderSharedSnapshot(moduleType, size);
    if (url) dataUrlCache.set(key, url);
    inflight.delete(key);
    return url;
  })().catch(() => {
    inflight.delete(key);
    return null;
  });

  inflight.set(key, task);
  return task;
}

/** Compatível com a exportação da composição — desenha a foto compartilhada num canvas. */
export async function snapshotRealisticFurniture(
  moduleType: FurnitureModuleType,
  size = SNAPSHOT_SIZE,
): Promise<HTMLCanvasElement> {
  const url = await getRealisticFurnitureDataUrl(moduleType, size);
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;
  if (!url) return canvas;
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('Falha ao ler o móvel realista'));
    image.src = url;
  });
  ctx.drawImage(img, 0, 0, size, size);
  return canvas;
}

export function setupRealisticScene(piece: THREE.Group) {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 20);
  camera.position.set(1.65, 1.15, 2.35);
  camera.lookAt(0, 0.45, 0);
  scene.add(new THREE.AmbientLight(0xfff5e6, 0.72));
  const key = new THREE.DirectionalLight(REALISTIC_GOLD, 1.15);
  key.position.set(2.2, 3.2, 2.4);
  scene.add(key);
  const fill = new THREE.PointLight(0xc4a882, 0.7, 12);
  fill.position.set(-2.2, 1.2, 1.4);
  scene.add(fill);
  scene.add(piece);
  return { scene, camera };
}
