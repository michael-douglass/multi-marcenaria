import { useEffect, useRef, useState } from 'react'

const VERT = `
attribute vec2 aPosition;
void main() {
  gl_Position = vec4(aPosition, 0.0, 1.0);
}
`

const FRAG = `
precision highp float;
uniform float uTime;
uniform vec2 uResolution;

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
}

float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  float a = hash(i);
  float b = hash(i + vec2(1.0, 0.0));
  float c = hash(i + vec2(0.0, 1.0));
  float d = hash(i + vec2(1.0, 1.0));
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(a, b, u.x) + (c - a) * u.y * (1.0 - u.x) + (d - b) * u.x * u.y;
}

float fbm(vec2 p) {
  float v = 0.0;
  float a = 0.5;
  for (int i = 0; i < 5; i++) {
    v += a * noise(p);
    p *= 2.11;
    a *= 0.5;
  }
  return v;
}

void main() {
  vec2 uv = gl_FragCoord.xy / uResolution;
  // Cockpit CNC: tinta carvão + grade blueprint #0066FF + veio MDF sutil
  vec3 ink = vec3(0.06, 0.08, 0.10);
  vec3 slate = vec3(0.12, 0.15, 0.18);
  vec3 paper = vec3(0.93, 0.945, 0.96);
  vec3 woodTint = vec3(0.42, 0.32, 0.24);
  vec3 accent = vec3(0.0, 0.4, 1.0);

  float grain = fbm(uv * vec2(18.0, 32.0) + vec2(uTime * 0.012, uTime * 0.018));
  float vein = sin((uv.x * 6.0 + grain * 3.0 + uTime * 0.02) * 3.14159) * 0.5 + 0.5;
  float gridX = abs(fract(uv.x * 28.0 + uTime * 0.02) - 0.5);
  float gridY = abs(fract(uv.y * 18.0) - 0.5);
  float blueprint = 1.0 - smoothstep(0.0, 0.028, min(gridX, gridY));
  float majorX = abs(fract(uv.x * 7.0) - 0.5);
  float majorY = abs(fract(uv.y * 5.0) - 0.5);
  float majorGrid = 1.0 - smoothstep(0.0, 0.02, min(majorX, majorY));

  // Hero escuro no topo → papel técnico embaixo
  vec3 base = mix(ink, slate, uv.y * 0.35 + grain * 0.08);
  base = mix(base, paper, smoothstep(0.28, 0.92, uv.y));
  base = mix(base, woodTint * 0.35 + paper * 0.65, vein * 0.08 * (1.0 - uv.y));

  float scan = sin(uv.y * 120.0 - uTime * 1.4) * 0.5 + 0.5;
  base += accent * blueprint * 0.09;
  base += accent * majorGrid * 0.05;
  base += accent * scan * 0.015 * (1.0 - uv.y);

  float edge = min(min(uv.x, 1.0 - uv.x), min(uv.y, 1.0 - uv.y));
  float rim = pow(1.0 - clamp(edge * 2.2, 0.0, 1.0), 2.2);
  base += accent * rim * 0.1;

  gl_FragColor = vec4(base, 1.0);
}
`

function compile(gl: WebGLRenderingContext, type: number, source: string): WebGLShader | null {
  const shader = gl.createShader(type)
  if (!shader) return null
  gl.shaderSource(shader, source)
  gl.compileShader(shader)
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    gl.deleteShader(shader)
    return null
  }
  return shader
}

function prefersReducedMotion(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

/** Fundo WebGL — veios de MDF + grade blueprint + accent #0066FF. */
export function OrcamentosIaShaderBackdrop() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [fallback, setFallback] = useState(false)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    if (prefersReducedMotion()) {
      setFallback(true)
      return
    }

    const gl = canvas.getContext('webgl', {
      alpha: false,
      antialias: false,
      powerPreference: 'low-power',
    })
    if (!gl) {
      setFallback(true)
      return
    }

    const vs = compile(gl, gl.VERTEX_SHADER, VERT)
    const fs = compile(gl, gl.FRAGMENT_SHADER, FRAG)
    if (!vs || !fs) {
      setFallback(true)
      return
    }

    const program = gl.createProgram()
    if (!program) {
      setFallback(true)
      return
    }
    gl.attachShader(program, vs)
    gl.attachShader(program, fs)
    gl.linkProgram(program)
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      setFallback(true)
      return
    }

    const buffer = gl.createBuffer()
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer)
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW)
    const loc = gl.getAttribLocation(program, 'aPosition')
    gl.enableVertexAttribArray(loc)
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0)

    const uTime = gl.getUniformLocation(program, 'uTime')
    const uResolution = gl.getUniformLocation(program, 'uResolution')

    let raf = 0
    let running = true
    let visible = true
    let pageVisible = !document.hidden
    const start = performance.now()

    const resize = () => {
      const parent = canvas.parentElement
      const w = Math.max(1, parent?.clientWidth ?? canvas.clientWidth)
      const h = Math.max(1, parent?.clientHeight ?? canvas.clientHeight)
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5)
      canvas.width = Math.round(w * dpr)
      canvas.height = Math.round(h * dpr)
      gl.viewport(0, 0, canvas.width, canvas.height)
    }

    const tick = (now: number) => {
      if (!running) return
      if (visible && pageVisible) {
        gl.useProgram(program)
        gl.uniform1f(uTime, (now - start) / 1000)
        gl.uniform2f(uResolution, canvas.width, canvas.height)
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)
      }
      raf = requestAnimationFrame(tick)
    }

    resize()
    const ro = new ResizeObserver(resize)
    if (canvas.parentElement) ro.observe(canvas.parentElement)

    const io = new IntersectionObserver((entries) => {
      visible = entries.some((entry) => entry.isIntersecting)
    })
    io.observe(canvas)

    const onVis = () => {
      pageVisible = !document.hidden
    }
    document.addEventListener('visibilitychange', onVis)

    raf = requestAnimationFrame(tick)

    return () => {
      running = false
      cancelAnimationFrame(raf)
      ro.disconnect()
      io.disconnect()
      document.removeEventListener('visibilitychange', onVis)
      gl.deleteProgram(program)
      gl.deleteShader(vs)
      gl.deleteShader(fs)
      gl.deleteBuffer(buffer)
    }
  }, [])

  if (fallback) {
    return (
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse 80% 55% at 15% 0%, rgba(0,102,255,0.12), transparent 50%), linear-gradient(165deg, #f8f4ee 0%, #efe8dc 55%, #e4eefc 100%)',
        }}
      />
    )
  }

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      className="pointer-events-none absolute inset-0 h-full w-full opacity-90"
    />
  )
}
