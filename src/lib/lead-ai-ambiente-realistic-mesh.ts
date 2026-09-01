import * as THREE from 'three';
import { getFurnitureModuleMeta, type FurnitureModuleMeta } from '@/lib/furniture-modules';
import {
  GARBO_WOOD_TEXTURE_URL,
  clampOrbitPitch,
  quantizeOrbitDeg,
  wrapOrbitYaw,
} from '@/lib/furniture-catalog-banks';
import { isCustomFurnitureColor } from '@/lib/furniture-finish-colors';
import { tryCreateWebGLRenderer } from '@/lib/webgl-support';
import type { FurnitureModuleType } from '@/lib/whiteboard-annotations';

export const REALISTIC_MAHOGANY = 0x3a241c;
export const REALISTIC_GOLD = 0xf2d892;

const SNAPSHOT_SIZE = 320;
const dataUrlCache = new Map<string, string>();
const inflight = new Map<string, Promise<string | null>>();
let renderChain: Promise<void> = Promise.resolve();

export interface RealisticOrbit {
  yaw?: number;
  pitch?: number;
}

interface Kit {
  wood: THREE.MeshStandardMaterial;
  glass: THREE.MeshStandardMaterial;
  metal: THREE.MeshStandardMaterial;
  cream: THREE.MeshStandardMaterial;
  stone: THREE.ShaderMaterial;
}

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
  const geo = new THREE.BoxGeometry(Math.max(0.04, w), Math.max(0.04, h), Math.max(0.04, d));
  geometries.push(geo);
  const mesh = new THREE.Mesh(geo, material);
  mesh.position.set(x, y, z);
  group.add(mesh);
}

function addCyl(
  group: THREE.Group,
  geometries: THREE.BufferGeometry[],
  material: THREE.Material,
  radiusTop: number,
  radiusBottom: number,
  height: number,
  x: number,
  y: number,
  z: number,
  radial = 16,
) {
  const geo = new THREE.CylinderGeometry(radiusTop, radiusBottom, height, radial);
  geometries.push(geo);
  const mesh = new THREE.Mesh(geo, material);
  mesh.position.set(x, y, z);
  group.add(mesh);
}

const STONE_LOOKS: Record<string, { base: number; vein: number; scale: number }> = {
  pedra_marmore: { base: 0xe8e2d6, vein: 0x8a7a6a, scale: 9 },
  pedra_calacatta: { base: 0xf4efe6, vein: 0x6b5a4a, scale: 7 },
  pedra_carrara: { base: 0xeeeae3, vein: 0x9a9aa0, scale: 10 },
  pedra_granito: { base: 0x3a3a3a, vein: 0x8a8a88, scale: 14 },
  pedra_preto_sao_gabriel: { base: 0x161616, vein: 0x4a4a4a, scale: 16 },
  pedra_quartzito: { base: 0xc4b8a8, vein: 0x7a6a58, scale: 8 },
  pedra_travertino: { base: 0xd4c4a8, vein: 0xb89870, scale: 6 },
  pedra_sao_tome: { base: 0xc9b896, vein: 0x8a7050, scale: 5 },
  pedra_onyx: { base: 0xe8d4a8, vein: 0xc4a060, scale: 11 },
  revest_porcelanato: { base: 0xd8d0c4, vein: 0xb0a898, scale: 4 },
  revest_cimento: { base: 0x9a958c, vein: 0x6a6660, scale: 5 },
  revest_tijolinho: { base: 0xa85a3a, vein: 0x6a3828, scale: 8 },
  revest_papel: { base: 0xe8dcc8, vein: 0xc4b090, scale: 12 },
  revest_3d: { base: 0xddd4c6, vein: 0x8a8070, scale: 7 },
  revest_canjiquinha: { base: 0xc4b496, vein: 0x8a7a60, scale: 9 },
  revest_pastilha: { base: 0x8ab4c4, vein: 0x5a8090, scale: 18 },
  bancada_granito: { base: 0x3a3a3a, vein: 0x8a8a88, scale: 14 },
  bancada_marmore: { base: 0xe8e2d6, vein: 0x8a7a6a, scale: 9 },
  bancada_quartzo: { base: 0xc4b8a8, vein: 0x9a8a78, scale: 11 },
  bancada_silestone: { base: 0xd8cfc4, vein: 0xa09080, scale: 12 },
  bancada_dekton: { base: 0xb8aea2, vein: 0x7a7068, scale: 8 },
  bancada_corian: { base: 0xf0ebe4, vein: 0xd0c8bc, scale: 6 },
};

function createStoneVeinMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      uBase: { value: new THREE.Color(0xe8e2d6) },
      uVein: { value: new THREE.Color(0x8a7a6a) },
      uScale: { value: 8 },
    },
    vertexShader: `
      varying vec2 vUv;
      varying vec3 vNormal;
      varying vec3 vViewPosition;
      void main() {
        vUv = uv;
        vNormal = normalize(normalMatrix * normal);
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vViewPosition = mv.xyz;
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: `
      uniform vec3 uBase;
      uniform vec3 uVein;
      uniform float uScale;
      varying vec2 vUv;
      varying vec3 vNormal;
      varying vec3 vViewPosition;
      float random(vec2 st) {
        return fract(sin(dot(st.xy, vec2(12.9898, 78.233))) * 43758.5453);
      }
      float noise(vec2 st) {
        vec2 i = floor(st);
        vec2 f = fract(st);
        float a = random(i);
        float b = random(i + vec2(1.0, 0.0));
        float c = random(i + vec2(0.0, 1.0));
        float d = random(i + vec2(1.0, 1.0));
        vec2 u = f * f * (3.0 - 2.0 * f);
        return mix(a, b, u.x) + (c - a) * u.y * (1.0 - u.x) + (d - b) * u.x * u.y;
      }
      void main() {
        vec2 st = vUv * uScale;
        float n = noise(st + vec2(noise(st * 0.35) * 2.0));
        float veins = smoothstep(0.42, 0.56, n) * (1.0 - smoothstep(0.56, 0.74, n));
        vec3 color = mix(uBase, uVein, veins * 0.88);
        vec3 viewDir = normalize(-vViewPosition);
        float rim = pow(1.0 - max(0.0, dot(viewDir, normalize(vNormal))), 3.0);
        color += vec3(0.16, 0.14, 0.1) * rim;
        gl_FragColor = vec4(color, 1.0);
      }
    `,
  });
}

function applyStoneLook(stone: THREE.ShaderMaterial, type: FurnitureModuleType, colorHex?: string) {
  const look = STONE_LOOKS[type] ?? { base: 0xe8e2d6, vein: 0x8a7a6a, scale: 8 };
  if (colorHex && isCustomFurnitureColor(colorHex)) {
    stone.uniforms.uBase.value.set(colorHex);
  } else {
    stone.uniforms.uBase.value.setHex(look.base);
  }
  stone.uniforms.uVein.value.setHex(look.vein);
  stone.uniforms.uScale.value = look.scale;
}

function buildCatalogExtraPiece(
  type: FurnitureModuleType,
  meta: FurnitureModuleMeta,
  kit: Kit,
  group: THREE.Group,
  geometries: THREE.BufferGeometry[],
  w: number,
  d: number,
  colorHex?: string,
): boolean {
  const { wood, glass, metal, cream, stone } = kit;
  const fam = meta.family;

  if (fam === 'pedra' || fam === 'revestimento') {
    applyStoneLook(stone, type, colorHex);
    if (type === 'revest_ripado' || type === 'revest_lambris') {
      const slats = 7;
      const slatW = w / slats;
      for (let i = 0; i < slats; i += 1) {
        addBox(group, geometries, wood, slatW * 0.82, 1.05, 0.06, -w / 2 + slatW * (i + 0.5), 0.52, 0);
      }
      return true;
    }
    if (type === 'revest_3d') {
      for (let i = 0; i < 3; i += 1) {
        for (let j = 0; j < 3; j += 1) {
          addBox(
            group,
            geometries,
            stone,
            w * 0.28,
            0.32,
            0.08 + (i + j) * 0.02,
            -w * 0.32 + i * w * 0.32,
            0.22 + j * 0.34,
            0,
          );
        }
      }
      return true;
    }
    addBox(group, geometries, stone, w, 0.08, d * 1.35, 0, 0.06, 0);
    return true;
  }

  if (fam === 'bancada' && type !== 'bancada' && type !== 'bancada_ilha') {
    addBox(group, geometries, wood, w, 0.62, d, 0, 0.31, 0);
    if (type === 'bancada_madeira') {
      addBox(group, geometries, wood, w * 1.06, 0.06, d * 1.08, 0, 0.66, 0);
    } else {
      applyStoneLook(stone, type, colorHex);
      addBox(group, geometries, stone, w * 1.06, 0.06, d * 1.08, 0, 0.66, 0);
    }
    return true;
  }

  if (type.startsWith('tapete')) {
    const isRound = type.includes('redondo');
    if (isRound) {
      addCyl(group, geometries, cream, 0.55, 0.55, 0.04, 0, 0.02, 0, 28);
    } else {
      addBox(group, geometries, cream, w * 1.15, 0.04, d * 1.6, 0, 0.02, 0);
    }
    return true;
  }

  if (type.startsWith('vaso') || type === 'cachepot') {
    addCyl(group, geometries, wood, 0.14, 0.18, type === 'vaso_alto' ? 0.55 : 0.28, 0, type === 'vaso_alto' ? 0.28 : 0.16, 0, 14);
    addCyl(group, geometries, cream, 0.08, 0.12, 0.06, 0, type === 'vaso_alto' ? 0.58 : 0.32, 0, 10);
    return true;
  }

  if (type.startsWith('planta')) {
    addCyl(group, geometries, wood, 0.12, 0.16, 0.22, 0, 0.12, 0, 12);
    addCyl(group, geometries, cream, 0.22, 0.08, type === 'planta_chao' || type === 'planta_costela' ? 0.72 : 0.38, 0, type === 'planta_chao' || type === 'planta_costela' ? 0.58 : 0.42, 0, 10);
    return true;
  }

  if (type === 'cortina' || type === 'persiana' || type === 'biombo') {
    addBox(group, geometries, wood, w, 0.06, 0.06, 0, 1.05, 0);
    for (let i = 0; i < 5; i += 1) {
      addBox(group, geometries, cream, w * 0.16, 0.95, 0.04, -w * 0.36 + i * w * 0.18, 0.55, 0);
    }
    return true;
  }

  if (type === 'quadro' || type === 'galeria_quadros') {
    addBox(group, geometries, wood, w, 0.72, 0.05, 0, 0.7, 0);
    addBox(group, geometries, cream, w * 0.82, 0.55, 0.02, 0, 0.7, 0.03);
    if (type === 'galeria_quadros') {
      addBox(group, geometries, wood, w * 0.42, 0.38, 0.05, -w * 0.35, 0.28, 0);
      addBox(group, geometries, wood, w * 0.42, 0.38, 0.05, w * 0.35, 0.28, 0);
    }
    return true;
  }

  if (type === 'almofada' || type === 'manta') {
    addBox(group, geometries, cream, type === 'manta' ? 0.7 : 0.42, type === 'manta' ? 0.1 : 0.22, type === 'manta' ? 0.42 : 0.38, 0, type === 'manta' ? 0.08 : 0.16, 0);
    return true;
  }

  if (type === 'relogio_parede') {
    addCyl(group, geometries, wood, 0.28, 0.28, 0.05, 0, 0.7, 0, 24);
    addCyl(group, geometries, cream, 0.22, 0.22, 0.03, 0, 0.7, 0.03, 24);
    addBox(group, geometries, metal, 0.02, 0.16, 0.02, 0, 0.76, 0.05);
    return true;
  }

  if (type === 'livros') {
    addBox(group, geometries, wood, 0.28, 0.08, 0.2, 0, 0.08, 0);
    addBox(group, geometries, cream, 0.26, 0.08, 0.18, 0.02, 0.16, 0);
    addBox(group, geometries, wood, 0.24, 0.08, 0.16, -0.02, 0.24, 0);
    return true;
  }

  if (type === 'escultura') {
    addCyl(group, geometries, wood, 0.14, 0.16, 0.06, 0, 0.04, 0, 10);
    addCyl(group, geometries, cream, 0.08, 0.05, 0.42, 0, 0.28, 0, 8);
    return true;
  }

  if (type === 'lareira') {
    addBox(group, geometries, wood, w, 0.85, d, 0, 0.42, 0);
    addBox(group, geometries, metal, w * 0.55, 0.38, 0.04, 0, 0.38, d * 0.48);
    return true;
  }

  if (fam === 'iluminacao') {
    if (type === 'trilha_spots' || type === 'fita_led') {
      addBox(group, geometries, metal, w * 1.2, 0.04, 0.06, 0, 1.15, 0);
      if (type === 'trilha_spots') {
        addCyl(group, geometries, cream, 0.06, 0.06, 0.08, -0.35, 1.08, 0, 10);
        addCyl(group, geometries, cream, 0.06, 0.06, 0.08, 0, 1.08, 0, 10);
        addCyl(group, geometries, cream, 0.06, 0.06, 0.08, 0.35, 1.08, 0, 10);
      }
      return true;
    }
    addCyl(group, geometries, metal, 0.02, 0.02, type === 'arandela' ? 0.18 : 0.35, 0, type === 'arandela' ? 0.85 : 1.05, 0, 8);
    addCyl(group, geometries, cream, type === 'pendente_triplo' ? 0.12 : 0.16, 0.2, 0.18, 0, type === 'arandela' ? 0.72 : 0.82, 0, 12);
    if (type === 'pendente_triplo' || type === 'candelabro') {
      addCyl(group, geometries, cream, 0.12, 0.16, 0.16, -0.22, 0.78, 0, 12);
      addCyl(group, geometries, cream, 0.12, 0.16, 0.16, 0.22, 0.78, 0, 12);
    }
    return true;
  }

  if (fam === 'mesa') {
    const topH = type === 'mesa_centro' || type === 'mesa_lateral' ? 0.38 : 0.72;
    const topT = 0.05;
    if (type === 'mesa_jantar_redonda') {
      addCyl(group, geometries, wood, w * 0.42, w * 0.42, topT, 0, topH, 0, 24);
      addCyl(group, geometries, wood, 0.08, 0.12, topH, 0, topH / 2, 0, 10);
    } else {
      addBox(group, geometries, wood, w, topT, d, 0, topH, 0);
      addBox(group, geometries, wood, 0.07, topH, 0.07, -w * 0.42, topH / 2, -d * 0.38);
      addBox(group, geometries, wood, 0.07, topH, 0.07, w * 0.42, topH / 2, -d * 0.38);
      addBox(group, geometries, wood, 0.07, topH, 0.07, -w * 0.42, topH / 2, d * 0.38);
      addBox(group, geometries, wood, 0.07, topH, 0.07, w * 0.42, topH / 2, d * 0.38);
    }
    return true;
  }

  if (type === 'estante') {
    addBox(group, geometries, wood, w * 0.7, 1.25, d * 0.7, 0, 0.62, 0);
    for (const y of [0.28, 0.55, 0.82, 1.08]) {
      addBox(group, geometries, wood, w * 0.62, 0.03, d * 0.55, 0, y, 0);
    }
    return true;
  }

  if (type === 'buffet' || type === 'aparador') {
    addBox(group, geometries, wood, w, 0.55, d, 0, 0.32, 0);
    addBox(group, geometries, wood, w * 0.96, 0.04, d * 0.96, 0, 0.6, 0);
    return true;
  }

  if (type === 'chaise' || type === 'banco') {
    addBox(group, geometries, wood, w, 0.22, d, 0, 0.22, 0);
    addBox(group, geometries, wood, type === 'chaise' ? w * 0.35 : w, 0.42, 0.1, type === 'chaise' ? -w * 0.28 : 0, 0.48, -d / 2 + 0.05);
    return true;
  }

  if (type === 'banqueta') {
    addCyl(group, geometries, wood, 0.16, 0.16, 0.06, 0, 0.62, 0, 12);
    addCyl(group, geometries, metal, 0.03, 0.03, 0.58, 0, 0.3, 0, 8);
    addCyl(group, geometries, wood, 0.18, 0.18, 0.04, 0, 0.02, 0, 12);
    return true;
  }

  if (fam === 'banheiro') {
    if (type === 'toalheiro') {
      addBox(group, geometries, metal, 0.42, 0.04, 0.04, 0, 0.85, 0);
      addBox(group, geometries, metal, 0.42, 0.04, 0.04, 0, 0.62, 0);
      return true;
    }
    addBox(group, geometries, wood, w * 0.75, 0.48, d, 0, 0.28, 0);
    addCyl(group, geometries, cream, 0.18, 0.2, 0.1, 0, 0.58, 0, 16);
    if (type === 'gabinete_banheiro') {
      addBox(group, geometries, glass, w * 0.45, 0.42, 0.03, 0, 0.95, -d * 0.2);
    }
    return true;
  }

  return false;
}

function cabinetBody(
  group: THREE.Group,
  geometries: THREE.BufferGeometry[],
  kit: Kit,
  w: number,
  h: number,
  d: number,
  doors = 2,
) {
  addBox(group, geometries, kit.wood, w, h, d, 0, h / 2, 0);
  const doorW = (w * 0.92) / Math.max(1, doors);
  for (let i = 0; i < doors; i += 1) {
    const x = -w / 2 + w * 0.04 + doorW / 2 + i * doorW;
    addBox(group, geometries, kit.wood, doorW * 0.92, h * 0.88, 0.02, x, h / 2, d / 2 + 0.01);
    addBox(group, geometries, kit.metal, 0.03, 0.1, 0.03, x + doorW * 0.28, h / 2, d / 2 + 0.04);
  }
}

/** Peça 3D do catálogo Realistas — cada tipo tem um volume próprio. */
export function buildRealisticFurniturePiece(
  type: FurnitureModuleType,
  kit: Kit,
  group: THREE.Group,
  geometries: THREE.BufferGeometry[],
  colorHex?: string,
) {
  clearRealisticGroup(group, geometries);
  const meta = getFurnitureModuleMeta(type);
  const w = Math.max(0.42, Math.min(2.1, meta.aspectWidth));
  const d = Math.max(0.22, Math.min(1.05, meta.depthRatio + 0.18));
  const { wood, glass, metal, cream } = kit;

  if (buildCatalogExtraPiece(type, meta, kit, group, geometries, w, d, colorHex)) {
    return;
  }

  if (type === 'sofa' || type === 'sofa_2lugares' || type === 'sofa_canto') {
    const seatH = 0.28;
    addBox(group, geometries, wood, w, seatH, d, 0, seatH / 2, 0);
    addBox(group, geometries, wood, w, 0.48, 0.12, 0, 0.28 + 0.24, -d / 2 + 0.06);
    addBox(group, geometries, wood, 0.1, 0.36, d * 0.92, -w / 2 + 0.05, 0.36, 0);
    addBox(group, geometries, wood, 0.1, 0.36, d * 0.92, w / 2 - 0.05, 0.36, 0);
    if (type === 'sofa_canto') {
      addBox(group, geometries, wood, w * 0.42, seatH, d * 0.85, w / 2 - w * 0.18, seatH / 2, d * 0.22);
    }
    return;
  }

  if (type === 'cadeira' || type === 'cadeira_poltrona') {
    const seatW = type === 'cadeira_poltrona' ? 0.72 : 0.52;
    const seatD = type === 'cadeira_poltrona' ? 0.62 : 0.48;
    addBox(group, geometries, wood, seatW, 0.1, seatD, 0, 0.38, 0);
    addBox(group, geometries, wood, seatW, 0.52, 0.08, 0, 0.68, -seatD / 2 + 0.04);
    addBox(group, geometries, wood, 0.07, 0.38, 0.07, -seatW / 2 + 0.06, 0.19, -seatD / 2 + 0.06);
    addBox(group, geometries, wood, 0.07, 0.38, 0.07, seatW / 2 - 0.06, 0.19, -seatD / 2 + 0.06);
    addBox(group, geometries, wood, 0.07, 0.38, 0.07, -seatW / 2 + 0.06, 0.19, seatD / 2 - 0.06);
    addBox(group, geometries, wood, 0.07, 0.38, 0.07, seatW / 2 - 0.06, 0.19, seatD / 2 - 0.06);
    return;
  }

  if (type === 'puff') {
    addBox(group, geometries, wood, 0.58, 0.32, 0.58, 0, 0.16, 0);
    return;
  }

  if (type.startsWith('espelho') || type === 'espelheira') {
    const frameW = type === 'espelho_corpo' ? 0.55 : type === 'espelho_adnet' || type === 'espelho_redondo' ? 0.62 : 0.72;
    const frameH = type === 'espelho_corpo' ? 1.55 : type === 'espelheira' ? 1.05 : 0.95;
    const thick = 0.06;
    if (type === 'espelho_redondo' || type === 'espelho_adnet' || type === 'espelho_oval') {
      addCyl(group, geometries, wood, frameW / 2, frameW / 2, thick, 0, frameH / 2, 0, 24);
      addCyl(group, geometries, glass, frameW / 2 - 0.04, frameW / 2 - 0.04, 0.03, 0, frameH / 2, thick * 0.4, 24);
      if (type === 'espelho_adnet') {
        addBox(group, geometries, metal, 0.42, 0.03, 0.03, 0, frameH + 0.08, 0);
      }
    } else {
      addBox(group, geometries, wood, frameW, frameH, thick, 0, frameH / 2, 0);
      addBox(group, geometries, glass, frameW * 0.82, frameH * 0.82, 0.02, 0, frameH / 2, thick * 0.45);
      if (type === 'espelheira') {
        addBox(group, geometries, wood, frameW * 1.05, 0.08, d, 0, 0.04, d * 0.2);
      }
    }
    return;
  }

  if (type === 'cama') {
    addBox(group, geometries, wood, w, 0.22, d * 1.35, 0, 0.22, 0);
    addBox(group, geometries, cream, w * 0.92, 0.14, d * 1.2, 0, 0.36, 0.04);
    addBox(group, geometries, wood, w, 0.55, 0.1, 0, 0.5, -d * 0.62);
    return;
  }

  if (type === 'cabeceira') {
    addBox(group, geometries, wood, w * 1.15, 0.7, 0.08, 0, 0.45, 0);
    return;
  }

  if (type === 'penteadeira') {
    addBox(group, geometries, wood, w, 0.42, d, 0, 0.32, 0);
    addBox(group, geometries, wood, w * 0.08, 0.55, 0.06, 0, 0.8, -d * 0.2);
    addBox(group, geometries, glass, w * 0.55, 0.5, 0.02, 0, 0.82, -d * 0.12);
    return;
  }

  if (type === 'abajur') {
    addCyl(group, geometries, wood, 0.12, 0.16, 0.08, 0, 0.04, 0);
    addCyl(group, geometries, metal, 0.025, 0.025, 0.38, 0, 0.26, 0, 10);
    addCyl(group, geometries, cream, 0.16, 0.22, 0.22, 0, 0.52, 0, 12);
    return;
  }

  if (type === 'luminaria_chao') {
    addCyl(group, geometries, metal, 0.14, 0.16, 0.04, 0, 0.02, 0);
    addCyl(group, geometries, metal, 0.02, 0.02, 1.15, 0, 0.6, 0, 8);
    addCyl(group, geometries, cream, 0.14, 0.2, 0.28, 0, 1.22, 0, 12);
    return;
  }

  if (type === 'comoda' || type.startsWith('gaveta') || type.startsWith('mesa_cabeceira')) {
    const h = type.startsWith('mesa_cabeceira') ? 0.55 : type === 'gaveta_5' ? 0.95 : 0.72;
    addBox(group, geometries, wood, w * 0.7, h, d, 0, h / 2, 0);
    const rows = type === 'gaveta_5' ? 5 : type === 'gaveta_3' ? 3 : 3;
    for (let i = 0; i < rows; i += 1) {
      const y = 0.1 + (i + 0.5) * ((h - 0.12) / rows);
      addBox(group, geometries, wood, w * 0.62, (h - 0.14) / rows - 0.04, 0.02, 0, y, d / 2 + 0.01);
      addBox(group, geometries, metal, 0.08, 0.02, 0.03, 0, y, d / 2 + 0.04);
    }
    return;
  }

  if (type.startsWith('guarda_roupa')) {
    cabinetBody(group, geometries, kit, w * 0.72, 1.48, d * 0.88, type === 'guarda_roupa_casal' ? 3 : 2);
    if (type === 'guarda_roupa_gavetas') {
      addBox(group, geometries, wood, w * 0.62, 0.18, 0.03, 0, 0.22, d * 0.46);
    }
    return;
  }

  if (type.startsWith('armario') && !type.includes('cozinha') && !type.includes('aereo')) {
    cabinetBody(
      group,
      geometries,
      kit,
      w * 0.62,
      type === 'armario_4_portas' ? 1.25 : 1.15,
      d * 0.82,
      type === 'armario_4_portas' ? 4 : type === 'armario_2_portas' ? 2 : 0,
    );
    if (type === 'armario_prateleiras' || type === 'armario_vazio') {
      addBox(group, geometries, wood, w * 0.5, 0.03, d * 0.6, 0, 0.4, 0);
      addBox(group, geometries, wood, w * 0.5, 0.03, d * 0.6, 0, 0.7, 0);
    }
    return;
  }

  if (type.includes('nicho') || type === 'modulo_cubo') {
    const size = type === 'modulo_cubo' ? 0.7 : 0.72;
    addBox(group, geometries, wood, size, size, size * 0.55, 0, size / 2, 0);
    addBox(group, geometries, wood, size * 0.86, 0.03, size * 0.42, 0, size / 2, 0);
    addBox(group, geometries, wood, 0.03, size * 0.86, size * 0.42, 0, size / 2, 0);
    return;
  }

  if (type.startsWith('rack') || type.startsWith('painel_tv')) {
    if (type.includes('painel')) {
      addBox(group, geometries, wood, w * 1.05, 0.72, 0.08, 0, 0.85, -0.12);
    }
    addBox(group, geometries, wood, w * 0.95, 0.12, d, 0, 0.38, 0);
    addBox(group, geometries, wood, 0.08, 0.38, d * 0.9, -w * 0.4, 0.19, 0);
    addBox(group, geometries, wood, 0.08, 0.38, d * 0.9, w * 0.4, 0.19, 0);
    addBox(group, geometries, wood, w * 0.88, 0.08, d * 0.92, 0, 0.04, 0);
    return;
  }

  if (type.startsWith('cristaleira')) {
    cabinetBody(group, geometries, kit, w * 0.55, type === 'cristaleira_alta' ? 1.45 : 1.05, d * 0.7, 2);
    addBox(group, geometries, glass, w * 0.42, type === 'cristaleira_alta' ? 1.1 : 0.72, 0.02, 0, type === 'cristaleira_alta' ? 0.8 : 0.58, d * 0.38);
    return;
  }

  if (type.startsWith('sapateira')) {
    addBox(group, geometries, wood, w * 0.55, 1.05, d, 0, 0.52, 0);
    for (let i = 0; i < 4; i += 1) {
      addBox(group, geometries, wood, w * 0.46, 0.03, d * 0.8, 0, 0.18 + i * 0.22, 0);
    }
    return;
  }

  if (type.includes('aereo')) {
    addBox(group, geometries, wood, w * 0.7, 0.42, d * 0.7, 0, 1.05, 0);
    return;
  }

  if (type.startsWith('bancada') || type.includes('cozinha')) {
    addBox(group, geometries, wood, w, 0.72, d, 0, 0.36, 0);
    addBox(group, geometries, cream, w * 1.04, 0.05, d * 1.06, 0, 0.75, 0);
    if (type === 'bancada_ilha') {
      addBox(group, geometries, wood, w * 0.55, 0.08, d * 0.4, 0, 0.9, 0);
    }
    return;
  }

  if (type.startsWith('fogao') || type === 'cooktop') {
    addBox(group, geometries, metal, w * 0.7, type === 'cooktop' ? 0.08 : 0.72, d, 0, type === 'cooktop' ? 0.78 : 0.36, 0);
    addCyl(group, geometries, metal, 0.08, 0.08, 0.03, -0.16, type === 'cooktop' ? 0.84 : 0.76, 0.08, 12);
    addCyl(group, geometries, metal, 0.08, 0.08, 0.03, 0.16, type === 'cooktop' ? 0.84 : 0.76, 0.08, 12);
    return;
  }

  if (type.startsWith('forno') || type === 'microondas') {
    addBox(group, geometries, metal, w * 0.55, type === 'forno_torre' ? 1.35 : 0.48, d * 0.7, 0, type === 'forno_torre' ? 0.68 : 0.7, 0);
    addBox(group, geometries, glass, w * 0.4, 0.28, 0.02, 0, type === 'forno_torre' ? 0.55 : 0.7, d * 0.38);
    return;
  }

  if (type.startsWith('coifa') || type === 'depurador') {
    addBox(group, geometries, metal, w * 0.7, 0.12, d, 0, 1.15, 0);
    addBox(group, geometries, metal, 0.18, 0.45, 0.18, 0, 1.42, 0);
    return;
  }

  if (type === 'geladeira') {
    addBox(group, geometries, metal, 0.62, 1.55, 0.62, 0, 0.78, 0);
    addBox(group, geometries, metal, 0.58, 0.72, 0.03, 0, 1.12, 0.33);
    addBox(group, geometries, metal, 0.58, 0.62, 0.03, 0, 0.42, 0.33);
    return;
  }

  if (type === 'lava_loucas' || type === 'cuba_pia') {
    addBox(group, geometries, metal, w * 0.55, 0.55, d, 0, 0.4, 0);
    if (type === 'cuba_pia') addCyl(group, geometries, metal, 0.16, 0.18, 0.08, 0, 0.7, 0, 16);
    return;
  }

  if (type === 'air_fryer' || type === 'liquidificador' || type === 'cafeteira' || type === 'chaleira' || type === 'torradeira' || type === 'panela') {
    addCyl(group, geometries, metal, 0.16, 0.18, 0.28, 0, 0.18, 0, 14);
    if (type === 'liquidificador') addCyl(group, geometries, glass, 0.12, 0.14, 0.22, 0, 0.42, 0, 12);
    if (type === 'torradeira') addBox(group, geometries, metal, 0.32, 0.22, 0.18, 0, 0.16, 0);
    return;
  }

  addBox(group, geometries, wood, w * 0.55, 0.95, d, 0, 0.48, 0);
}

export function createRealisticWoodMaterial(): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    color: REALISTIC_MAHOGANY,
    roughness: 0.62,
    metalness: 0.06,
  });
}

function createKit(wood: THREE.MeshStandardMaterial): Kit {
  return {
    wood,
    glass: new THREE.MeshStandardMaterial({
      color: 0xc9dcea,
      roughness: 0.08,
      metalness: 0.72,
      transparent: true,
      opacity: 0.72,
    }),
    metal: new THREE.MeshStandardMaterial({
      color: 0x8d8d8d,
      roughness: 0.32,
      metalness: 0.78,
    }),
    cream: new THREE.MeshStandardMaterial({
      color: 0xf3ead8,
      roughness: 0.78,
      metalness: 0.02,
    }),
    stone: createStoneVeinMaterial(),
  };
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
  kit: Kit;
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

  const wood = createRealisticWoodMaterial();
  const kit = createKit(wood);
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
    let settled = false;
    const done = () => {
      if (settled) return;
      settled = true;
      resolve();
    };
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
        wood.map = tex;
        wood.needsUpdate = true;
        dataUrlCache.clear();
        done();
      },
      undefined,
      () => done(),
    );
    window.setTimeout(done, 2200);
  });

  sharedStudio = { renderer, scene, camera, piece, geometries, kit, woodReady };
  return sharedStudio;
}

function orbitKey(orbit?: RealisticOrbit): string {
  const yaw = quantizeOrbitDeg(wrapOrbitYaw(orbit?.yaw ?? 0));
  const pitch = quantizeOrbitDeg(clampOrbitPitch(orbit?.pitch ?? 0));
  return `${yaw}:${pitch}`;
}

function colorCacheKey(colorHex?: string): string {
  return isCustomFurnitureColor(colorHex) ? (colorHex ?? '').toLowerCase() : 'default';
}

function renderSharedSnapshot(
  type: FurnitureModuleType,
  size: number,
  orbit?: RealisticOrbit,
  colorHex?: string,
): string | null {
  const studio = getSharedStudio();
  if (!studio) return null;
  const woodColor = studio.kit.wood.color.clone();
  const creamColor = studio.kit.cream.color.clone();
  if (colorHex && isCustomFurnitureColor(colorHex)) {
    studio.kit.wood.color.set(colorHex);
    studio.kit.cream.color.set(colorHex);
  }
  try {
    buildRealisticFurniturePiece(type, studio.kit, studio.piece, studio.geometries, colorHex);
    studio.piece.rotation.set(
      THREE.MathUtils.degToRad(clampOrbitPitch(orbit?.pitch ?? 0)),
      THREE.MathUtils.degToRad(wrapOrbitYaw(orbit?.yaw ?? 0)),
      0,
    );
    studio.piece.updateMatrixWorld(true);
    studio.renderer.setSize(size, size, false);
    fitRealisticCamera(studio.camera, studio.piece, 1);
    studio.renderer.render(studio.scene, studio.camera);
    studio.piece.rotation.set(0, 0, 0);
    return studio.renderer.domElement.toDataURL('image/png');
  } finally {
    studio.kit.wood.color.copy(woodColor);
    studio.kit.cream.color.copy(creamColor);
  }
}

function withSharedRender<T>(fn: () => T | Promise<T>): Promise<T> {
  const next = renderChain.then(fn, fn);
  renderChain = next.then(
    () => undefined,
    () => undefined,
  );
  return next;
}

/** Uma foto da peça 3D — um único WebGL compartilhado, reutilizado na lousa e no catálogo. */
export function getRealisticFurnitureDataUrl(
  moduleType: FurnitureModuleType,
  size = SNAPSHOT_SIZE,
  orbit?: RealisticOrbit,
  colorHex?: string,
): Promise<string | null> {
  const key = `${moduleType}:${size}:${orbitKey(orbit)}:${colorCacheKey(colorHex)}`;
  const cached = dataUrlCache.get(key);
  if (cached) return Promise.resolve(cached);

  const running = inflight.get(key);
  if (running) return running;

  const task = (async () => {
    const studio = getSharedStudio();
    if (!studio) return null;
    await studio.woodReady;
    const url = await withSharedRender(() => renderSharedSnapshot(moduleType, size, orbit, colorHex));
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
  orbit?: RealisticOrbit,
  colorHex?: string,
): Promise<HTMLCanvasElement> {
  const url = await getRealisticFurnitureDataUrl(moduleType, size, orbit, colorHex);
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
