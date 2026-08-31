import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import * as THREE from 'three';
import { cn } from '@/lib/utils';
import { GARBO_WOOD_TEXTURE_URL } from '@/lib/furniture-catalog-banks';
import { tryCreateWebGLRenderer } from '@/lib/webgl-support';

const LOGO_SRC = '/garbo-logo.png';

interface LoginLogoMarkProps {
  onActivate?: () => void;
}

/**
 * Placa da marca: madeira (TextureLoader) + inclinação que segue o mouse.
 * Clique foca o e-mail — a porta do ateliê convida a entrar.
 */
export function LoginLogoMark({ onActivate }: LoginLogoMarkProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const plateRef = useRef<HTMLButtonElement>(null);
  const [pressed, setPressed] = useState(false);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const renderer = tryCreateWebGLRenderer(
      () =>
        new THREE.WebGLRenderer({
          alpha: true,
          antialias: true,
          powerPreference: 'low-power',
          failIfMajorPerformanceCaveat: true,
        }),
    );
    if (!renderer) return;

    renderer.setClearColor(0x000000, 0);
    renderer.domElement.style.display = 'block';
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
    renderer.domElement.style.pointerEvents = 'none';
    host.appendChild(renderer.domElement);

    THREE.Cache.enabled = true;
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 20);
    camera.position.set(0, 0.05, 2.35);

    const material = new THREE.MeshStandardMaterial({
      color: 0xc4a882,
      roughness: 0.72,
      metalness: 0.08,
    });

    const loader = new THREE.TextureLoader();
    const woodTex = loader.load(GARBO_WOOD_TEXTURE_URL, (tex) => {
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.wrapS = THREE.RepeatWrapping;
      tex.wrapT = THREE.RepeatWrapping;
      tex.repeat.set(1.15, 1.15);
      tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
      material.map = tex;
      material.needsUpdate = true;
    });

    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 1.55), material);
    scene.add(mesh);
    scene.add(new THREE.AmbientLight(0xfff5e6, 0.85));
    const key = new THREE.PointLight(0xf2d892, 1.35, 8);
    key.position.set(0.6, 0.8, 2.2);
    scene.add(key);
    const fill = new THREE.PointLight(0x3a241c, 0.55, 8);
    fill.position.set(-1.2, -0.4, 1.4);
    scene.add(fill);

    const clock = new THREE.Clock();
    let frame = 0;
    let running = true;

    const resize = () => {
      const w = Math.max(host.clientWidth, 1);
      const h = Math.max(host.clientHeight, 1);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    };
    const ro = new ResizeObserver(resize);
    ro.observe(host);
    resize();

    const draw = () => {
      if (!running) return;
      if (!prefersReduced) frame = requestAnimationFrame(draw);
      const t = prefersReduced ? 0 : clock.getElapsedTime();
      mesh.rotation.z = Math.sin(t * 0.35) * 0.012;
      key.intensity = 1.2 + Math.sin(t * 1.1) * 0.12;
      renderer.render(scene, camera);
    };
    if (prefersReduced) renderer.render(scene, camera);
    else draw();

    return () => {
      running = false;
      cancelAnimationFrame(frame);
      ro.disconnect();
      woodTex.dispose();
      material.dispose();
      mesh.geometry.dispose();
      renderer.dispose();
      if (renderer.domElement.parentNode === host) host.removeChild(renderer.domElement);
    };
  }, []);

  const resetTilt = useCallback(() => {
    const plate = plateRef.current;
    if (!plate) return;
    plate.style.setProperty('--tilt-x', '0deg');
    plate.style.setProperty('--tilt-y', '0deg');
  }, []);

  const onPointerMove = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const plate = plateRef.current;
    if (!plate) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const rect = plate.getBoundingClientRect();
    const px = (event.clientX - rect.left) / rect.width;
    const py = (event.clientY - rect.top) / rect.height;
    const tiltY = (px - 0.5) * 14;
    const tiltX = (0.5 - py) * 10;
    plate.style.setProperty('--tilt-x', `${tiltX.toFixed(2)}deg`);
    plate.style.setProperty('--tilt-y', `${tiltY.toFixed(2)}deg`);
  };

  return (
    <button
      ref={plateRef}
      type="button"
      className={cn('login-logo-mark', pressed && 'login-logo-mark--pressed')}
      aria-label="Marca GARBO Movelaria — clicar foca o e-mail"
      onPointerMove={onPointerMove}
      onPointerLeave={() => {
        resetTilt();
        setPressed(false);
      }}
      onPointerDown={() => setPressed(true)}
      onPointerUp={() => setPressed(false)}
      onClick={() => onActivate?.()}
    >
      <span ref={hostRef} className="login-logo-mark__wood" aria-hidden />
      <span className="login-logo-mark__frame" aria-hidden />
      <span className="login-logo-mark__sheen" aria-hidden />
      <img src={LOGO_SRC} alt="GARBO Movelaria" className="login-logo-mark__img" draggable={false} />
    </button>
  );
}
