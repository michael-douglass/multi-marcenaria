import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { tryCreateWebGLRenderer } from '@/lib/webgl-support';

const VERTEX = `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`;

const FRAGMENT = `
uniform float uTime;
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
  vec2 uv = vUv;
  vec3 ink = vec3(0.086, 0.047, 0.031);
  vec3 mahogany = vec3(0.165, 0.094, 0.071);
  vec3 gold = vec3(0.949, 0.847, 0.573);
  float grain = noise(uv * vec2(22.0, 48.0) + vec2(0.0, uTime * 0.04));
  float vein = sin((uv.y * 11.0 + grain * 2.2 + uTime * 0.06) * 3.14159) * 0.5 + 0.5;
  float wash = exp(-length((uv - vec2(0.78, 0.12)) * vec2(1.3, 1.8)) * 1.7);
  float rim = pow(1.0 - min(min(uv.x, 1.0 - uv.x), min(uv.y, 1.0 - uv.y)) * 3.4, 2.2);
  vec3 color = mix(ink, mahogany, uv.y * 0.7 + 0.15);
  color += gold * (wash * 0.16 + vein * 0.05 + grain * 0.035 + rim * 0.38);
  gl_FragColor = vec4(color, 1.0);
}
`;

/** Véu de mogno e ouro atrás do estúdio de impressão. */
export function LeadAIRenderExportFoil() {
  const hostRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const renderer = tryCreateWebGLRenderer(
      () =>
        new THREE.WebGLRenderer({
          alpha: false,
          antialias: false,
          powerPreference: 'low-power',
          failIfMajorPerformanceCaveat: true,
        }),
    );
    if (!renderer) return;

    renderer.setClearColor(0x160c08, 1);
    renderer.domElement.style.display = 'block';
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
    host.appendChild(renderer.domElement);

    const uniforms = { uTime: { value: 0 } };
    const material = new THREE.ShaderMaterial({
      uniforms,
      vertexShader: VERTEX,
      fragmentShader: FRAGMENT,
      depthTest: false,
      depthWrite: false,
    });
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material);
    const scene = new THREE.Scene();
    scene.add(mesh);
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    const clock = new THREE.Clock();
    let frame = 0;
    let running = true;

    const resize = () => {
      const w = Math.max(1, host.clientWidth);
      const h = Math.max(1, host.clientHeight);
      renderer.setSize(w, h, false);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    };
    const ro = new ResizeObserver(resize);
    ro.observe(host);
    resize();

    const tick = () => {
      if (!running) return;
      uniforms.uTime.value = prefersReduced ? 0 : clock.getElapsedTime();
      renderer.render(scene, camera);
      frame = requestAnimationFrame(tick);
    };
    tick();

    return () => {
      running = false;
      cancelAnimationFrame(frame);
      ro.disconnect();
      material.dispose();
      mesh.geometry.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, []);

  return (
    <div
      ref={hostRef}
      aria-hidden
      className="pointer-events-none absolute inset-0 overflow-hidden bg-[#160c08]"
    />
  );
}
