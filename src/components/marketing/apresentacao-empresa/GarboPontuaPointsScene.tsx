import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { GARBO_LOGO_SRC } from '@/lib/garbo-brand';
import { tryCreateWebGLRenderer } from '@/lib/webgl-support';
import { GARBO_APRESENTACAO_THEME } from './garbo-apresentacao-theme';

interface GarboPontuaPointsSceneProps {
  className?: string;
  /** Quando false, pausa o loop de animação (economia de CPU fora da tela). */
  active?: boolean;
  /** Logo Garbo no centro do globo. No portal do prestador fica off — só o núcleo 3D. */
  showCenterLogo?: boolean;
}

/**
 * Campo de pontos dourados orbitando — metáfora do programa de pontuação.
 * Núcleo em arame com shader Fresnel; logo opcional via TextureLoader.
 */
export function GarboPontuaPointsScene({
  className,
  active = true,
  showCenterLogo = true,
}: GarboPontuaPointsSceneProps) {
  const hostRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const renderer = tryCreateWebGLRenderer(
      () =>
        new THREE.WebGLRenderer({
          antialias: true,
          alpha: true,
          powerPreference: 'low-power',
          failIfMajorPerformanceCaveat: true,
        }),
    );
    if (!renderer) return;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100);
    camera.position.set(0, 0.35, 6.2);

    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0x000000, 0);
    renderer.domElement.style.display = 'block';
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
    host.appendChild(renderer.domElement);

    const group = new THREE.Group();
    scene.add(group);

    const gold = new THREE.Color(GARBO_APRESENTACAO_THEME.gold);
    const wood = new THREE.Color(GARBO_APRESENTACAO_THEME.wood);

    /** Sem logo no centro, o núcleo fica um pouco maior e mais luminoso. */
    const coreRadius = showCenterLogo ? 0.55 : 0.72;
    const coreAlpha = showCenterLogo ? 0.42 : 0.52;

    const sphereGeo = new THREE.SphereGeometry(0.055, 16, 16);
    const coreGeo = new THREE.IcosahedronGeometry(coreRadius, 1);
    const coreMat = new THREE.ShaderMaterial({
      uniforms: {
        time: { value: 0 },
        goldColor: { value: gold },
        woodColor: { value: wood },
        baseAlpha: { value: coreAlpha },
      },
      transparent: true,
      wireframe: true,
      vertexShader: `
        varying vec3 vNormal;
        varying vec3 vWorldPosition;
        void main() {
          vNormal = normalize(normalMatrix * normal);
          vWorldPosition = (modelMatrix * vec4(position, 1.0)).xyz;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform float time;
        uniform float baseAlpha;
        uniform vec3 goldColor;
        uniform vec3 woodColor;
        varying vec3 vNormal;
        varying vec3 vWorldPosition;
        void main() {
          vec3 viewDirection = normalize(cameraPosition - vWorldPosition);
          float fresnel = pow(1.0 - max(0.0, dot(viewDirection, vNormal)), 2.6);
          float pulse = 0.55 + 0.45 * sin(time * 1.15);
          vec3 color = mix(woodColor, goldColor, fresnel * pulse);
          gl_FragColor = vec4(color, baseAlpha + fresnel * 0.45);
        }
      `,
    });
    const core = new THREE.Mesh(coreGeo, coreMat);
    group.add(core);

    let logoTexture: THREE.Texture | null = null;
    let logoSprite: THREE.Sprite | null = null;

    if (showCenterLogo) {
      THREE.Cache.enabled = true;
      const manager = new THREE.LoadingManager();
      const textureLoader = new THREE.TextureLoader(manager);

      textureLoader.load(
        GARBO_LOGO_SRC,
        (texture) => {
          texture.colorSpace = THREE.SRGBColorSpace;
          texture.minFilter = THREE.LinearFilter;
          texture.magFilter = THREE.LinearFilter;
          texture.needsUpdate = true;
          logoTexture = texture;
          const spriteMat = new THREE.SpriteMaterial({
            map: texture,
            transparent: true,
            depthWrite: false,
            opacity: 0.92,
          });
          logoSprite = new THREE.Sprite(spriteMat);
          logoSprite.scale.set(1.35, 1.35, 1);
          logoSprite.position.set(0, 0.05, 0.15);
          group.add(logoSprite);
        },
        undefined,
        () => {
          /* Sem logo o núcleo de arame continua sozinho. */
        },
      );
    }

    const ambient = new THREE.AmbientLight(0xfff5e6, 0.55);
    const key = new THREE.PointLight(0xf2d892, 2.2, 18);
    key.position.set(2.5, 2.2, 3.5);
    const rim = new THREE.PointLight(0xc4a882, 1.1, 14);
    rim.position.set(-3, -1.5, -2);
    scene.add(ambient, key, rim);

    const count = 48;
    const meshes: THREE.Mesh[] = [];
    const bases: { radius: number; speed: number; phase: number; yAmp: number; tilt: number }[] = [];

    for (let i = 0; i < count; i += 1) {
      const t = i / count;
      const mat = new THREE.MeshStandardMaterial({
        color: t > 0.65 ? wood : gold,
        emissive: gold,
        emissiveIntensity: 0.18 + t * 0.2,
        metalness: 0.7,
        roughness: 0.35,
      });
      const mesh = new THREE.Mesh(sphereGeo, mat);
      const scale = 0.55 + Math.random() * 1.35;
      mesh.scale.setScalar(scale);
      group.add(mesh);
      meshes.push(mesh);
      bases.push({
        radius: 1.15 + Math.random() * 2.35,
        speed: 0.18 + Math.random() * 0.35,
        phase: Math.random() * Math.PI * 2,
        yAmp: 0.35 + Math.random() * 0.9,
        tilt: (Math.random() - 0.5) * 0.55,
      });
    }

    const clock = new THREE.Clock();
    let frameId = 0;
    let running = true;

    const resize = () => {
      const w = host.clientWidth || 1;
      const h = host.clientHeight || 1;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h, false);
    };

    const ro = new ResizeObserver(resize);
    ro.observe(host);
    resize();

    const renderFrame = () => {
      if (!running) return;
      frameId = requestAnimationFrame(renderFrame);
      if (!active) {
        renderer.render(scene, camera);
        return;
      }

      const t = clock.getElapsedTime();
      coreMat.uniforms.time.value = t;
      if (!prefersReducedMotion) {
        core.rotation.y = t * 0.22;
        core.rotation.x = Math.sin(t * 0.35) * 0.18;
        group.rotation.y = t * 0.08;

        meshes.forEach((mesh, i) => {
          const b = bases[i];
          const a = t * b.speed + b.phase;
          mesh.position.set(
            Math.cos(a) * b.radius,
            Math.sin(a * 1.35) * b.yAmp + b.tilt,
            Math.sin(a) * b.radius * 0.85,
          );
        });
      }

      renderer.render(scene, camera);
    };

    renderFrame();

    return () => {
      running = false;
      cancelAnimationFrame(frameId);
      ro.disconnect();
      meshes.forEach((m) => {
        (m.material as THREE.Material).dispose();
      });
      if (logoSprite) {
        (logoSprite.material as THREE.Material).dispose();
      }
      logoTexture?.dispose();
      sphereGeo.dispose();
      coreGeo.dispose();
      coreMat.dispose();
      renderer.dispose();
      if (renderer.domElement.parentElement === host) {
        host.removeChild(renderer.domElement);
      }
    };
  }, [active, showCenterLogo]);

  return (
    <div
      ref={hostRef}
      className={className}
      aria-hidden
      style={{ touchAction: 'none' }}
    />
  );
}
