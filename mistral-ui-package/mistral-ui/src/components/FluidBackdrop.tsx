/**
 * FluidBackdrop
 * -----------------------------------------------------------------------------
 * Fullscreen atmospheric motion layer for the Mistral dark-glass shell.
 *
 * A single WebGL2 fragment shader paints deep charcoal-violet light that drifts
 * very slowly through a low-frequency noise field. There are no sprites, no
 * particles and no fluid solver: three cheap value-noise fields are domain
 * warped by two more, which is enough for the "light moving under frosted
 * glass" reading at almost no GPU cost. The cursor drives an additional
 * domain shift, so the light bends and stretches around it rather than being
 * lit by a spotlight.
 *
 * Guarantees that matter to the app shell:
 *   - fixed, full-viewport, `pointer-events: none`, `aria-hidden` -> never
 *     intercepts input and never participates in layout (no layout shift).
 *   - z-index: -1 -> paints behind all in-flow content and below the glass
 *     panels, so text/charts/buttons are never distorted (nothing is composited
 *     through it; it is just a backdrop).
 *   - motion is time-scaled, not amplitude-scaled, so toggling intensity never
 *     jumps the composition.
 *
 * Requires a transparent root background: give the page (html/body) no opaque
 * background, or the layer will sit behind it. Without WebGL2 the component
 * renders an equivalent static CSS gradient instead.
 */
import { useEffect, useRef, useState, type CSSProperties } from "react";

export type FluidBackdropProps = {
  /** Ambient drift intensity, 0..1. 1 = default, 0 = frozen composition. */
  motion?: number;
  /** Stop the render loop; the last frame (or a fresh still) stays visible. */
  paused?: boolean;
  /**
   * Honor the OS "reduce motion" preference by rendering one static frame.
   * Set false only from development tooling that needs to inspect the motion.
   */
  respectReducedMotion?: boolean;
  /** Let the cursor bend the flow field. */
  interactive?: boolean;
  /**
   * Cursor influence radius, in domain units (the viewport spans +/-0.89
   * vertically). Larger values move more of the surrounding field.
   */
  cursorRadius?: number;
  /** Peak domain displacement at the cursor, in the same domain units. */
  cursorStrength?: number;
  /** How strongly cursor speed maps to displacement (1 = tuned default). */
  cursorSensitivity?: number;
  /**
   * Release time constant in seconds. Higher values keep the field deforming
   * for longer after the cursor stops before settling back to ambient drift.
   */
  cursorInertia?: number;
  /** Upper bound for device pixel ratio (the field is smooth, so 1.5 is ample). */
  maxDpr?: number;
  /** Frame-pacing ceiling. The motion is slow enough that 30 is indistinguishable. */
  fps?: number;
  className?: string;
  style?: CSSProperties;
};

const VERTEX_SOURCE = `#version 300 es
in vec2 aPosition;
out vec2 vUv;
void main() {
  vUv = aPosition * 0.5 + 0.5;
  gl_Position = vec4(aPosition, 0.0, 1.0);
}`;

const FRAGMENT_SOURCE = `#version 300 es
precision highp float;

uniform vec2  uResolution;
uniform float uTime;
uniform vec2  uPointer;
uniform vec2  uPointerVelocity;
uniform float uPointerStrength;
uniform float uPointerRadius;
uniform float uPointerDisplacement;
uniform float uPointerSensitivity;
uniform float uMotion;

in  vec2 vUv;
out vec4 fragColor;

// Deep charcoal base with muted lavender / slate-violet atmosphere.
const vec3 BASE     = vec3(0.047, 0.043, 0.058);
const vec3 SLATE    = vec3(0.196, 0.176, 0.243);
const vec3 LAVENDER = vec3(0.462, 0.404, 0.573);
const vec3 WARM     = vec3(0.286, 0.243, 0.243);

// Hash without sine, so there are no precision artefacts on low-end GPUs.
float hash12(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  float a = hash12(i);
  float b = hash12(i + vec2(1.0, 0.0));
  float c = hash12(i + vec2(0.0, 1.0));
  float d = hash12(i + vec2(1.0, 1.0));
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}

// Three octaves is the point of diminishing returns once the field is this soft.
float fbm(vec2 p) {
  float value = 0.0;
  float amplitude = 0.5;
  for (int i = 0; i < 3; i++) {
    value += amplitude * noise(p);
    p = p * 2.03 + vec2(11.7, -7.3);
    amplitude *= 0.5;
  }
  return value;
}

void main() {
  vec2 uv = vec2(vUv.x, 1.0 - vUv.y);
  float aspect = uResolution.x / max(uResolution.y, 1.0);
  vec2 p = (uv - 0.5) * vec2(aspect, 1.0);

  float t = uTime;

  // Cursor mask: a wide gaussian whose radius is a uniform. This only decides
  // WHERE the field reacts - the movement itself comes from the domain shift
  // below, so there is no circle, halo or spotlight to see.
  vec2 pointer = (uPointer - 0.5) * vec2(aspect, 1.0);
  vec2 delta = p - pointer;
  float radius = max(uPointerRadius, 0.05);
  float falloff = exp(-dot(delta, delta) / (radius * radius));
  float influence = falloff * uPointerStrength;

  // True domain displacement: the sampled field is shifted along the cursor's
  // direction of travel. Because the mask above is spatially non-uniform, the
  // mapping is non-affine - gradients stretch ahead of the motion and compress
  // behind it instead of simply sliding.
  vec2 flowDir = uPointerVelocity * uPointerSensitivity;
  float flowSpeed = length(flowDir);
  if (flowSpeed > 1.6) {
    flowDir *= 1.6 / flowSpeed;
  }
  // A little cross-flow removes the "pure push" reading and makes the light
  // appear to flow around the cursor.
  vec2 across = vec2(-flowDir.y, flowDir.x);
  vec2 flow = (flowDir + across * 0.35) * influence * uPointerDisplacement
            * (0.45 + 0.55 * uMotion);

  // Incommensurate drift rates: the composition never repeats.
  vec2 driftA = vec2(t * 0.0125, t * -0.0088);
  vec2 driftB = vec2(t * -0.0069, t * 0.0104);

  vec2 warpField = vec2(
    fbm(p * 1.15 + driftA),
    fbm(p * 1.15 + vec2(5.2, 1.3) + driftB)
  ) - 0.5;

  float warpAmount = 0.55 + 0.15 * uMotion;
  vec2 warp = warpField * warpAmount + flow;

  vec2 pw = p + warp;

  float fieldA = fbm(pw * 1.25 + driftA * 0.85);
  float fieldB = fbm(pw * 2.30 - driftB * 1.10 + vec2(3.1, 8.7));
  float fieldC = fbm(pw * 0.78 + vec2(1.7, -4.2) + driftB * 0.55);

  float haze   = smoothstep(0.30, 0.98, fieldA * 0.70 + fieldB * 0.42);
  float light  = smoothstep(0.36, 1.04, fieldC * 0.85 + fieldB * 0.32);
  float warmth = smoothstep(0.44, 1.06, fieldB * 0.90 + fieldA * 0.34);

  vec3 color = BASE;
  color = mix(color, SLATE * 1.18, haze * 0.42);
  color = mix(color, LAVENDER, light * 0.24);
  color = mix(color, WARM, warmth * 0.14);

  // One soft column of light near the top of the viewport.
  float topDistance = length((uv - vec2(0.52, 0.02)) * vec2(0.80, 1.30));
  color += LAVENDER * (1.0 - smoothstep(0.0, 0.92, topDistance)) * 0.035;

  // Local colour displacement: where the field is being deformed the light is
  // pulled slightly toward lavender, so the movement reads as colour flowing
  // through the glass rather than a warp applied on top of it.
  color = mix(color, LAVENDER, influence * 0.09);

  // Vignette keeps the glass panels legible over the atmosphere.
  float vignette = 1.0 - smoothstep(0.30, 1.30, length(p * vec2(0.94, 1.06)));
  color *= mix(0.70, 1.0, vignette);

  // Static dither removes banding in the dark ramp without any shimmer.
  color += (hash12(gl_FragCoord.xy) - 0.5) * 0.006;

  fragColor = vec4(clamp(color, 0.0, 1.0), 1.0);
}`;

const FALLBACK_BACKGROUND =
  "radial-gradient(115% 85% at 52% 4%, rgba(126,110,158,0.22) 0%, rgba(126,110,158,0) 62%)," +
  "radial-gradient(95% 80% at 16% 82%, rgba(70,62,90,0.26) 0%, rgba(70,62,90,0) 64%)," +
  "radial-gradient(90% 78% at 86% 66%, rgba(94,82,120,0.18) 0%, rgba(94,82,120,0) 60%)," +
  "linear-gradient(180deg, #14121A 0%, #0C0B10 58%, #0A090D 100%)";

const clamp = (value: number, min: number, max: number) =>
  value < min ? min : value > max ? max : value;

export default function FluidBackdrop({
  motion = 1,
  paused = false,
  respectReducedMotion = true,
  interactive = true,
  cursorRadius = 0.95,
  cursorStrength = 0.24,
  cursorSensitivity = 1,
  cursorInertia = 0.9,
  maxDpr = 1.5,
  fps = 30,
  className,
  style,
}: FluidBackdropProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [fallback, setFallback] = useState(false);

  // Latest props, read by the render loop without rebuilding the GL pipeline.
  // Everything cursor-related is a uniform or a time constant, so tuning never
  // recompiles the shader.
  const settingsRef = useRef({
    motion,
    paused,
    respectReducedMotion,
    interactive,
    cursorRadius,
    cursorStrength,
    cursorSensitivity,
    cursorInertia,
    maxDpr,
    fps,
  });
  const syncRef = useRef<() => void>(() => {});

  useEffect(() => {
    settingsRef.current = {
      motion,
      paused,
      respectReducedMotion,
      interactive,
      cursorRadius,
      cursorStrength,
      cursorSensitivity,
      cursorInertia,
      maxDpr,
      fps,
    };
  });

  useEffect(() => {
    syncRef.current();
  }, [
    motion,
    paused,
    respectReducedMotion,
    interactive,
    cursorRadius,
    cursorStrength,
    cursorSensitivity,
    cursorInertia,
    maxDpr,
    fps,
  ]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const context = canvas.getContext("webgl2", {
      alpha: false,
      antialias: false,
      depth: false,
      stencil: false,
      premultipliedAlpha: false,
      preserveDrawingBuffer: false,
      powerPreference: "low-power",
    });

    if (!context) {
      setFallback(true);
      return;
    }

    const gl = context;
    let program: WebGLProgram | null = null;
    let buffer: WebGLBuffer | null = null;
    let locations: Record<string, WebGLUniformLocation | null> = {};

    const compile = (type: number, source: string): WebGLShader | null => {
      const shader = gl.createShader(type);
      if (!shader) return null;
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        console.warn("[FluidBackdrop] shader compile failed:", gl.getShaderInfoLog(shader));
        gl.deleteShader(shader);
        return null;
      }
      return shader;
    };

    const buildProgram = (): boolean => {
      const vertex = compile(gl.VERTEX_SHADER, VERTEX_SOURCE);
      const fragment = compile(gl.FRAGMENT_SHADER, FRAGMENT_SOURCE);
      if (!vertex || !fragment) {
        if (vertex) gl.deleteShader(vertex);
        if (fragment) gl.deleteShader(fragment);
        return false;
      }

      const next = gl.createProgram();
      if (!next) {
        gl.deleteShader(vertex);
        gl.deleteShader(fragment);
        return false;
      }

      gl.attachShader(next, vertex);
      gl.attachShader(next, fragment);
      gl.linkProgram(next);
      gl.deleteShader(vertex);
      gl.deleteShader(fragment);

      if (!gl.getProgramParameter(next, gl.LINK_STATUS)) {
        console.warn("[FluidBackdrop] program link failed:", gl.getProgramInfoLog(next));
        gl.deleteProgram(next);
        return false;
      }

      if (program) gl.deleteProgram(program);
      program = next;
      gl.useProgram(program);

      locations = {
        resolution: gl.getUniformLocation(program, "uResolution"),
        time: gl.getUniformLocation(program, "uTime"),
        pointer: gl.getUniformLocation(program, "uPointer"),
        velocity: gl.getUniformLocation(program, "uPointerVelocity"),
        strength: gl.getUniformLocation(program, "uPointerStrength"),
        radius: gl.getUniformLocation(program, "uPointerRadius"),
        displacement: gl.getUniformLocation(program, "uPointerDisplacement"),
        sensitivity: gl.getUniformLocation(program, "uPointerSensitivity"),
        motion: gl.getUniformLocation(program, "uMotion"),
      };

      if (!buffer) {
        buffer = gl.createBuffer();
      }
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
      gl.bufferData(
        gl.ARRAY_BUFFER,
        new Float32Array([-1, -1, 3, -1, -1, 3]),
        gl.STATIC_DRAW,
      );

      const positionLocation = gl.getAttribLocation(program, "aPosition");
      if (positionLocation >= 0) {
        gl.enableVertexAttribArray(positionLocation);
        gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);
      }

      gl.disable(gl.DEPTH_TEST);
      gl.disable(gl.BLEND);
      return true;
    };

    if (!buildProgram()) {
      if (program) gl.deleteProgram(program);
      if (buffer) gl.deleteBuffer(buffer);
      setFallback(true);
      return;
    }

    // --- render state -------------------------------------------------------
    let running = false;
    let rafId = 0;
    let lastDrawAt = 0;
    let clock = 0; // seconds of ambient time already elapsed
    let lost = false;
    let needsResize = true;
    const size = { width: 0, height: 0, rawDpr: 0 };

    const pointer = {
      targetX: 0.5,
      targetY: 0.5,
      x: 0.5,
      y: 0.5,
      vx: 0,
      vy: 0,
      strength: 0,
      lastMove: 0,
      active: false,
    };

    const syncSize = () => {
      const rawDpr = window.devicePixelRatio || 1;
      const dpr = clamp(rawDpr, 0.5, Math.max(1, settingsRef.current.maxDpr));
      if (!needsResize && size.rawDpr === rawDpr) return;

      const cssWidth = canvas.clientWidth || window.innerWidth || 1;
      const cssHeight = canvas.clientHeight || window.innerHeight || 1;
      const width = Math.max(1, Math.round(cssWidth * dpr));
      const height = Math.max(1, Math.round(cssHeight * dpr));

      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
      }

      gl.viewport(0, 0, width, height);
      size.width = width;
      size.height = height;
      size.rawDpr = rawDpr;
      needsResize = false;
    };

    const stepPointer = (dtMs: number, now: number) => {
      const settings = settingsRef.current;
      const follow = 1 - Math.exp(-dtMs / 150);
      const previousX = pointer.x;
      const previousY = pointer.y;

      pointer.x += (pointer.targetX - pointer.x) * follow;
      pointer.y += (pointer.targetY - pointer.y) * follow;

      const inverse = 1000 / Math.max(dtMs, 1);
      const instVx = (pointer.x - previousX) * inverse;
      const instVy = (pointer.y - previousY) * inverse;

      // Asymmetric smoothing: the field picks up speed immediately but releases
      // it slowly. That difference is the inertia - the movement keeps going for
      // a moment after the cursor stops, then settles into the ambient drift.
      const inertia = clamp(settings.cursorInertia, 0.05, 3);
      const rising =
        Math.hypot(instVx, instVy) > Math.hypot(pointer.vx, pointer.vy);
      const damping = 1 - Math.exp(-dtMs / (rising ? 120 : inertia * 900));
      pointer.vx += (instVx - pointer.vx) * damping;
      pointer.vy += (instVy - pointer.vy) * damping;

      // The mask fades slightly behind the velocity so the deformation decays
      // rather than switching off.
      const resting = !pointer.active || now - pointer.lastMove > 220;
      const goal = resting ? 0 : 1;
      pointer.strength +=
        (goal - pointer.strength) *
        (1 - Math.exp(-dtMs / (resting ? inertia * 1000 : 180)));
    };

    const drawFrame = () => {
      if (!program || lost) return;
      syncSize();
      if (size.width === 0 || size.height === 0) return;

      const settings = settingsRef.current;
      gl.useProgram(program);
      gl.uniform2f(locations.resolution, size.width, size.height);
      gl.uniform1f(locations.time, clock);
      gl.uniform2f(locations.pointer, pointer.x, pointer.y);
      // Normalised cursor velocity, soft-saturated so a fast flick approaches 1
      // but never clips.
      gl.uniform2f(
        locations.velocity,
        Math.tanh(pointer.vx * 0.6),
        Math.tanh(pointer.vy * 0.6),
      );
      gl.uniform1f(locations.strength, pointer.strength);
      gl.uniform1f(locations.radius, Math.max(settings.cursorRadius, 0.05));
      gl.uniform1f(locations.displacement, Math.max(settings.cursorStrength, 0));
      gl.uniform1f(locations.sensitivity, Math.max(settings.cursorSensitivity, 0));
      gl.uniform1f(locations.motion, clamp(settings.motion, 0, 1));
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    };

    const loop = (now: number) => {
      if (!running) return;
      rafId = requestAnimationFrame(loop);

      const interval = 1000 / clamp(settingsRef.current.fps, 12, 60);
      if (now - lastDrawAt < interval - 1) return;

      const dtMs = Math.min(now - lastDrawAt, 120);
      lastDrawAt = now;
      if (dtMs <= 0) return;

      if (Math.abs((window.devicePixelRatio || 1) - size.rawDpr) > 0.01) {
        needsResize = true;
      }

      // Time, not amplitude, carries the intensity: switching modes never jumps.
      clock += (dtMs / 1000) * clamp(settingsRef.current.motion, 0, 1);

      if (settingsRef.current.interactive) stepPointer(dtMs, now);

      drawFrame();
    };

    const start = () => {
      if (running || lost) return;
      running = true;
      lastDrawAt = performance.now();
      rafId = requestAnimationFrame(loop);
    };

    const stop = () => {
      running = false;
      if (rafId) cancelAnimationFrame(rafId);
      rafId = 0;
    };

    const sync = () => {
      const settings = settingsRef.current;
      const reduced =
        settings.respectReducedMotion &&
        window.matchMedia("(prefers-reduced-motion: reduce)").matches;

      const shouldRun =
        !lost && !settings.paused && !reduced && !document.hidden;

      if (shouldRun) {
        start();
        return;
      }

      stop();
      // Keep a correct, fully composed still frame on screen.
      needsResize = true;
      drawFrame();
    };

    // --- events -------------------------------------------------------------
    const onPointerMove = (event: PointerEvent) => {
      if (!settingsRef.current.interactive) return;
      pointer.targetX = event.clientX / Math.max(window.innerWidth, 1);
      pointer.targetY = event.clientY / Math.max(window.innerHeight, 1);
      pointer.lastMove = performance.now();
      pointer.active = true;
    };

    const onContextLost = (event: Event) => {
      event.preventDefault();
      lost = true;
      stop();
    };

    const onContextRestored = () => {
      lost = false;
      needsResize = true;
      if (buildProgram()) sync();
      else setFallback(true);
    };

    const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const resizeObserver =
      typeof ResizeObserver !== "undefined"
        ? new ResizeObserver(() => {
            needsResize = true;
            if (!running) drawFrame();
          })
        : null;

    resizeObserver?.observe(canvas);
    window.addEventListener("pointermove", onPointerMove, { passive: true });
    document.addEventListener("visibilitychange", sync);
    motionQuery.addEventListener("change", sync);
    canvas.addEventListener("webglcontextlost", onContextLost);
    canvas.addEventListener("webglcontextrestored", onContextRestored);

    syncRef.current = sync;
    sync();

    return () => {
      syncRef.current = () => {};
      window.removeEventListener("pointermove", onPointerMove);
      document.removeEventListener("visibilitychange", sync);
      motionQuery.removeEventListener("change", sync);
      canvas.removeEventListener("webglcontextlost", onContextLost);
      canvas.removeEventListener("webglcontextrestored", onContextRestored);
      resizeObserver?.disconnect();
      stop();

      if (program) gl.deleteProgram(program);
      if (buffer) gl.deleteBuffer(buffer);
      program = null;
      buffer = null;
      locations = {};

      // Release the GPU context eagerly instead of waiting for GC.
      gl.getExtension("WEBGL_lose_context")?.loseContext();
    };
  }, []);

  return (
    <div
      className={className}
      aria-hidden="true"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: -1,
        overflow: "hidden",
        pointerEvents: "none",
        contain: "strict",
        background: "#0B0A0E",
        ...style,
      }}
    >
      {fallback ? (
        <div
          style={{ position: "absolute", inset: 0, backgroundImage: FALLBACK_BACKGROUND }}
        />
      ) : (
        <canvas ref={canvasRef} style={{ display: "block", width: "100%", height: "100%" }} />
      )}
    </div>
  );
}
