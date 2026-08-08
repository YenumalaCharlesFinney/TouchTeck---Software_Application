import React, { useMemo, useRef } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';

/* ============================================================
   Lane water + hardware.

   The water is a 40k-point field displaced entirely in a vertex shader (GPU),
   so it stays smooth at that density. Sitting in it is the gear TouchTeck
   actually talks to: a bulkhead wall, eight touchpads, and Omega-style
   starting blocks above them.

   The surface is rotated flat (-90°) rather than part-tilted, which is what
   lets the blocks and pads be positioned in plain world coordinates instead of
   being projected onto an angled plane.

   Click anywhere: the water throws a start pulse AND every touchpad fires,
   the same way a start signal reaches the whole wall at once.
   ============================================================ */

/* GRID² points are drawn every frame. 200² = 40,000 was enough to make weaker
   GPUs drop frames; 150² = 22,500 looks near-identical at this camera distance
   and roughly halves the fill cost. */
const GRID = 150;
const SIZE = 90;
const LANES = 8;
const LANE_W = SIZE / LANES;

const WALL_Z = -SIZE / 2;          // far end of the pool
const TILT = -Math.PI / 2;         // water lies flat

const YELLOW = '#fff500';
const CYAN = '#06b6d4';

/* ---------------- looks ----------------

   Each preset is a complete look, not a single knob, so switching between them
   in the picker gives an obvious change rather than a subtle one. */

export type PoolPreset = {
  id: string;
  label: string;
  hint: string;
  swell: number;      // base surface movement
  wake: number;       // ripple that follows the cursor
  shock: number;      // click / start-pulse ring
  speed: number;      // wave clock multiplier
  pointScale: number; // droplet size
  tint: number;       // 0 = Omega cyan, 1 = TouchTeck gold
  dim: number;        // overall brightness
  fog: [number, number];
  camY: number;
  camZ: number;
  drift: number;      // how much the camera follows the pointer
  caustics: boolean;  // moving light pattern on the pool floor
  flags: boolean;     // backstroke flags strung across
};

export const POOL_PRESETS: PoolPreset[] = [
  { id: 'calm', label: 'Calm', hint: 'Gentle water, Omega cyan',
    swell: 1, wake: 1.25, shock: 2.6, speed: 1, pointScale: 1, tint: 0, dim: 1,
    fog: [40, 105], camY: 11, camZ: 34, drift: 4, caustics: false, flags: false },

  { id: 'race', label: 'Race Day', hint: 'Livelier surface, stronger pulse',
    swell: 2.1, wake: 2.6, shock: 6.5, speed: 1.35, pointScale: 1.05, tint: 0, dim: 1.12,
    fog: [44, 112], camY: 10, camZ: 32, drift: 5, caustics: false, flags: false },

  { id: 'arena', label: 'Arena', hint: 'Flags, caustics, wider view',
    swell: 1.2, wake: 1.5, shock: 3.4, speed: 1.05, pointScale: 1, tint: 0.25, dim: 1.05,
    fog: [50, 130], camY: 13, camZ: 44, drift: 5, caustics: true, flags: true },
];

/* ---------------- water ---------------- */

const vertexShader = /* glsl */ `
  uniform float uTime;
  uniform vec2  uMouse;
  uniform float uClickTime;
  uniform float uIntro;
  uniform float uLaneW;
  uniform float uSwell;
  uniform float uWake;
  uniform float uShock;
  uniform float uSpeed;
  uniform float uPointScale;

  varying float vH;
  varying float vD;
  varying float vLane;

  void main() {
    vec3 p = position;

    float lp   = p.x / uLaneW;
    float edge = abs(fract(lp + 0.5) - 0.5) * 2.0;
    vLane = 1.0 - smoothstep(0.0, 0.10, edge);

    // Baseline amplitudes read as a calm pool; each preset scales them.
    // Wave phase runs on its own clock so speed changes don't jump the
    // click pulse, which is timed in real seconds.
    float tt = uTime * uSpeed;

    float w = (
        sin(p.x * 0.10 + tt * 0.32) * 0.42
      + sin(p.y * 0.14 - tt * 0.24) * 0.40
      + sin((p.x + p.y) * 0.06 + tt * 0.55) * 0.22
      + sin(p.y * 0.55 - tt * 1.2) * 0.05
    ) * uSwell;

    float d = distance(p.xy, uMouse);
    vD = d;
    float wake = exp(-d * 0.08) * sin(d * 0.40 - tt * 2.2) * uWake;

    float age = uTime - uClickTime;
    float shock = 0.0;
    if (age > 0.0 && age < 2.8) {
      float radius = age * 26.0;
      shock = exp(-abs(d - radius) * 0.22) * (1.0 - age / 2.8) * uShock;
    }

    float h = (w + wake + shock) * uIntro;
    vH = h;

    vec4 mv = modelViewMatrix * vec4(p.x, p.y, h, 1.0);
    // crest colour and point size are driven by height, so both scale up to
    // match the smaller range — otherwise calming the water flattens the look
    gl_PointSize = (150.0 / -mv.z) * uPointScale * (0.5 + clamp(h, 0.0, 2.2) * 0.40 + vLane * 0.55);
    gl_Position = projectionMatrix * mv;
  }
`;

const fragmentShader = /* glsl */ `
  precision mediump float;
  uniform float uTint;
  uniform float uDim;
  varying float vH;
  varying float vD;
  varying float vLane;

  void main() {
    vec2 c = gl_PointCoord - 0.5;
    float r = length(c);
    if (r > 0.5) discard;
    float alpha = smoothstep(0.5, 0.02, r);

    // uTint slides the whole pool from Omega cyan toward TouchTeck gold
    vec3 deep = mix(vec3(0.012, 0.161, 0.298), vec3(0.140, 0.105, 0.010), uTint);
    vec3 mid  = mix(vec3(0.024, 0.714, 0.831), vec3(0.870, 0.780, 0.040), uTint);
    vec3 foam = mix(vec3(0.870, 0.960, 1.000), vec3(1.000, 0.980, 0.780), uTint);
    vec3 rope = vec3(1.000, 0.961, 0.000);

    float t = clamp(vH * 0.42 + 0.30, 0.0, 1.0);
    vec3 col = mix(deep, mid, smoothstep(0.0, 0.62, t));
    col = mix(col, foam, smoothstep(0.68, 1.0, t));
    col = mix(col, rope, vLane * 0.85);

    float distFade = 1.0 - smoothstep(30.0, 66.0, vD);
    float a = alpha * (0.26 + t * 0.74) * (0.30 + distFade * 0.70);
    a = max(a, alpha * vLane * 0.55 * (0.30 + distFade * 0.70));

    gl_FragColor = vec4(col * uDim, a);
  }
`;

function Water({
  pulse,
  preset,
  backdrop = false,
}: {
  pulse: React.MutableRefObject<number>;
  preset: PoolPreset;
  backdrop?: boolean;
}) {
  const introRef = useRef(0);

  const geometry = useMemo(() => {
    const g = new THREE.BufferGeometry();
    const positions = new Float32Array(GRID * GRID * 3);
    let i = 0;
    for (let y = 0; y < GRID; y++) {
      for (let x = 0; x < GRID; x++) {
        positions[i++] = (x / (GRID - 1) - 0.5) * SIZE;
        positions[i++] = (y / (GRID - 1) - 0.5) * SIZE;
        positions[i++] = 0;
      }
    }
    g.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    return g;
  }, []);

  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uMouse: { value: new THREE.Vector2(0, 0) },
      uClickTime: { value: -100 },
      uIntro: { value: 0 },
      uLaneW: { value: LANE_W },
      uSwell: { value: 1 },
      uWake: { value: 1.25 },
      uShock: { value: 2.6 },
      uSpeed: { value: 1 },
      uPointScale: { value: 1 },
      uTint: { value: 0 },
      uDim: { value: 1 },
    }),
    []
  );

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    uniforms.uTime.value = t;
    uniforms.uClickTime.value = pulse.current;
    introRef.current += (1 - introRef.current) * 0.02;
    uniforms.uIntro.value = introRef.current;

    // Ease toward the preset instead of snapping, so switching looks in the
    // picker reads as the pool changing rather than a hard cut.
    const k = 0.06;
    uniforms.uSwell.value += (preset.swell - uniforms.uSwell.value) * k;
    uniforms.uWake.value += (preset.wake - uniforms.uWake.value) * k;
    uniforms.uShock.value += (preset.shock - uniforms.uShock.value) * k;
    uniforms.uSpeed.value += (preset.speed - uniforms.uSpeed.value) * k;
    uniforms.uPointScale.value += (preset.pointScale - uniforms.uPointScale.value) * k;
    uniforms.uTint.value += (preset.tint - uniforms.uTint.value) * k;
    uniforms.uDim.value += (preset.dim - uniforms.uDim.value) * k;
  });

  return (
    <>
      <points geometry={geometry} rotation={[TILT, 0, 0]}>
        <shaderMaterial
          uniforms={uniforms}
          vertexShader={vertexShader}
          fragmentShader={fragmentShader}
          transparent
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </points>

      {/* pointer catcher — flat plane means a direct x/z mapping. Omitted in
          backdrop mode so it can never sit between the operator and a control. */}
      {!backdrop && (
        <mesh
          rotation={[TILT, 0, 0]}
          onPointerMove={(e) => {
            e.stopPropagation();
            uniforms.uMouse.value.set(e.point.x, -e.point.z);
          }}
          onPointerDown={(e) => {
            e.stopPropagation();
            pulse.current = uniforms.uTime.value;
          }}
        >
          <planeGeometry args={[SIZE, SIZE]} />
          <meshBasicMaterial transparent opacity={0} depthWrite={false} />
        </mesh>
      )}
    </>
  );
}

/* ---------------- lane ropes ---------------- */

/** Ambient swell only — same formula the water shader uses, minus the cursor
 *  wake and click pulse, so the floats ride the surface instead of sitting flat. */
function swellAt(x: number, y: number, t: number) {
  return (
    Math.sin(x * 0.1 + t * 0.5) * 1.0 +
    Math.sin(y * 0.14 - t * 0.38) * 0.95 +
    Math.sin((x + y) * 0.06 + t * 0.85) * 0.5 +
    Math.sin(y * 0.55 - t * 1.9) * 0.12
  );
}

/**
 * The physical lane ropes — discs threaded along a cable, alternating white and
 * yellow like a real competition pool.
 *
 * All ~1,300 floats live in a single InstancedMesh. As individual meshes this
 * would be over a thousand draw calls a frame; instanced it is one.
 */
function LaneRopes() {
  const ref = useRef<THREE.InstancedMesh>(null);
  const SPACING = 0.62;

  const { geometry, slots, count } = useMemo(() => {
    // cylinder axis along Z so each disc threads onto a rope running down the pool
    const g = new THREE.CylinderGeometry(0.14, 0.14, 0.5, 10);
    g.rotateX(Math.PI / 2);

    // three.js only applies instanceColor through the USE_COLOR path, which the
    // material's `vertexColors` flag switches on — and that path also reads a
    // per-vertex `color` attribute. Without one the shader samples an undefined
    // attribute and every float renders black, so seed it to white here and let
    // the per-instance colour do the tinting.
    const vc = new Float32Array(g.attributes.position.count * 3).fill(1);
    g.setAttribute('color', new THREE.BufferAttribute(vc, 3));

    const s: { x: number; z: number; yellow: boolean }[] = [];
    for (let r = 0; r <= LANES; r++) {
      const x = (r - LANES / 2) * LANE_W;
      let n = 0;
      for (let z = -SIZE / 2 + 0.4; z < SIZE / 2; z += SPACING) {
        s.push({ x, z, yellow: n % 2 === 1 });
        n++;
      }
    }
    return { geometry: g, slots: s, count: s.length };
  }, []);

  // per-instance colour, set once
  const colors = useMemo(() => {
    const arr = new Float32Array(count * 3);
    const white = new THREE.Color('#e9f4ff');
    const yellow = new THREE.Color(YELLOW);
    slots.forEach((s, i) => {
      const c = s.yellow ? yellow : white;
      arr[i * 3] = c.r;
      arr[i * 3 + 1] = c.g;
      arr[i * 3 + 2] = c.b;
    });
    return arr;
  }, [slots, count]);

  const dummy = useMemo(() => new THREE.Object3D(), []);

  useFrame(({ clock }) => {
    if (!ref.current) return;
    const t = clock.getElapsedTime();
    for (let i = 0; i < count; i++) {
      const { x, z } = slots[i];
      // water local y is -worldZ; displacement maps to world Y
      dummy.position.set(x, swellAt(x, -z, t) + 0.12, z);
      dummy.updateMatrix();
      ref.current.setMatrixAt(i, dummy.matrix);
    }
    ref.current.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh ref={ref} args={[geometry, undefined, count]}>
      <meshStandardMaterial
        vertexColors
        roughness={0.45}
        metalness={0.1}
        emissiveIntensity={0.25}
      />
      <instancedBufferAttribute attach="instanceColor" args={[colors, 3]} />
    </instancedMesh>
  );
}

/* ---------------- touchpad ---------------- */

function TouchPad({ x, pulse }: { x: number; pulse: React.MutableRefObject<number> }) {
  const mat = useRef<THREE.MeshStandardMaterial>(null);

  useFrame(({ clock }) => {
    if (!mat.current) return;
    const age = clock.getElapsedTime() - pulse.current;
    // sharp flash on contact, then settle back to the resting glow
    const target = age >= 0 && age < 0.55 ? 3.2 * (1 - age / 0.55) + 0.45 : 0.45;
    mat.current.emissiveIntensity += (target - mat.current.emissiveIntensity) * 0.18;
  });

  return (
    <group position={[x, 0, WALL_Z + 0.62]}>
      {/* pad face — Omega pads read yellow on deck, and it keeps the hit flash
          in the brand colour instead of fighting the cyan lighting */}
      <mesh position={[0, 0.55, 0]}>
        <boxGeometry args={[LANE_W * 0.86, 2.4, 0.16]} />
        <meshStandardMaterial
          ref={mat}
          color="#d8cc00"
          emissive={YELLOW}
          emissiveIntensity={0.45}
          metalness={0.35}
          roughness={0.45}
        />
      </mesh>
      {/* cyan trim line — reads against the yellow face the way the old yellow
          trim no longer would */}
      <mesh position={[0, 1.55, 0.1]}>
        <boxGeometry args={[LANE_W * 0.86, 0.1, 0.04]} />
        <meshStandardMaterial color={CYAN} emissive={CYAN} emissiveIntensity={0.75} />
      </mesh>
    </group>
  );
}

/* ---------------- starting block ---------------- */

function StartBlock({ x, index }: { x: number; index: number }) {
  return (
    <group position={[x, 0, WALL_Z - 1.6]}>
      {/* pedestal */}
      <mesh position={[0, 1.5, 0]}>
        <boxGeometry args={[LANE_W * 0.62, 3, 1.5]} />
        <meshStandardMaterial color="#0d1521" metalness={0.6} roughness={0.4} />
      </mesh>

      {/* angled top plate the swimmer stands on */}
      <mesh position={[0, 3.08, 0.06]} rotation={[-0.13, 0, 0]}>
        <boxGeometry args={[LANE_W * 0.7, 0.18, 1.7]} />
        <meshStandardMaterial color="#12203a" metalness={0.35} roughness={0.55} />
      </mesh>

      {/* rear kick plate */}
      <mesh position={[0, 2.55, -0.78]} rotation={[0.32, 0, 0]}>
        <boxGeometry args={[LANE_W * 0.6, 0.9, 0.12]} />
        <meshStandardMaterial color={YELLOW} emissive={YELLOW} emissiveIntensity={0.28} roughness={0.5} />
      </mesh>

      {/* grab bar at the front lip */}
      <mesh position={[0, 2.86, 0.82]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.07, 0.07, LANE_W * 0.55, 10]} />
        <meshStandardMaterial color="#dfe8f5" metalness={0.85} roughness={0.25} />
      </mesh>

      {/* lane number panel facing the water */}
      <mesh position={[0, 1.7, 0.77]}>
        <boxGeometry args={[LANE_W * 0.4, 0.75, 0.05]} />
        <meshStandardMaterial
          color="#f4f8ff"
          emissive="#9fd8ff"
          emissiveIntensity={0.18 + (index % 2) * 0.05}
          roughness={0.6}
        />
      </mesh>
    </group>
  );
}

/* ---------------- pool floor caustics ---------------- */

const causticsFragment = /* glsl */ `
  precision mediump float;
  uniform float uTime;
  varying vec2 vUv;

  void main() {
    vec2 p = vUv * 13.0;
    // three drifting wave sets crossing each other give the woven net pattern
    float a =
        sin(p.x * 1.1 + uTime * 0.55)
      + sin(p.y * 1.4 - uTime * 0.42)
      + sin((p.x + p.y) * 0.85 + uTime * 0.70)
      + sin((p.x - p.y) * 1.15 - uTime * 0.33);

    float c = smoothstep(1.35, 2.85, a);
    float fade = 1.0 - smoothstep(0.25, 0.5, distance(vUv, vec2(0.5)));
    gl_FragColor = vec4(vec3(0.45, 0.88, 1.0) * c, c * 0.42 * fade);
  }
`;

const causticsVertex = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

function Caustics() {
  const uniforms = useMemo(() => ({ uTime: { value: 0 } }), []);
  useFrame(({ clock }) => {
    uniforms.uTime.value = clock.getElapsedTime();
  });

  return (
    <mesh rotation={[TILT, 0, 0]} position={[0, -3.4, 0]}>
      <planeGeometry args={[SIZE, SIZE]} />
      <shaderMaterial
        uniforms={uniforms}
        vertexShader={causticsVertex}
        fragmentShader={causticsFragment}
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </mesh>
  );
}

/* ---------------- backstroke flags ---------------- */

function Flags() {
  const group = useRef<THREE.Group>(null);
  const count = 22;
  const span = SIZE * 0.92;

  // strung 5m out from the wall, the way real backstroke flags sit
  const flags = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => ({
        x: (i / (count - 1) - 0.5) * span,
        colour: i % 2 === 0 ? YELLOW : '#e9f4ff',
        phase: i * 0.4,
      })),
    [span],
  );

  useFrame(({ clock }) => {
    if (!group.current) return;
    const t = clock.getElapsedTime();
    group.current.children.forEach((child, i) => {
      // gentle flutter, offset per flag so the line ripples along
      child.rotation.x = Math.sin(t * 1.6 + flags[i].phase) * 0.22;
    });
  });

  return (
    <group ref={group} position={[0, 7.5, WALL_Z + 12]}>
      {flags.map((f, i) => (
        <mesh key={i} position={[f.x, 0, 0]}>
          <planeGeometry args={[1.1, 1.5]} />
          <meshStandardMaterial
            color={f.colour}
            emissive={f.colour}
            emissiveIntensity={0.35}
            side={THREE.DoubleSide}
            roughness={0.7}
          />
        </mesh>
      ))}
    </group>
  );
}

/* ---------------- scene ---------------- */

function Scene({
  pulse,
  preset,
  backdrop = false,
}: {
  pulse: React.MutableRefObject<number>;
  preset: PoolPreset;
  backdrop?: boolean;
}) {
  const xs = useMemo(
    () => Array.from({ length: LANES }, (_, i) => (i - (LANES - 1) / 2) * LANE_W),
    []
  );

  return (
    <>
      <ambientLight intensity={0.4 * preset.dim} />
      <directionalLight position={[8, 16, 10]} intensity={0.75 * preset.dim} color="#cfe9ff" />
      <pointLight position={[0, 7, WALL_Z + 8]} intensity={40 * preset.dim} distance={40} color={CYAN} />
      <pointLight position={[0, 5, 18]} intensity={16 * preset.dim} distance={38} color="#0a3550" />

      <Water pulse={pulse} preset={preset} backdrop={backdrop} />
      <LaneRopes />
      {preset.caustics && <Caustics />}
      {preset.flags && <Flags />}

      {/* bulkhead the pads are mounted on */}
      <mesh position={[0, 0.4, WALL_Z]}>
        <boxGeometry args={[SIZE + 4, 5, 1.2]} />
        <meshStandardMaterial color="#070d16" metalness={0.45} roughness={0.6} />
      </mesh>

      {/* deck behind the wall */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 2.9, WALL_Z - 6]}>
        <planeGeometry args={[SIZE + 24, 12]} />
        <meshStandardMaterial color="#060b13" roughness={0.95} />
      </mesh>

      {xs.map((x, i) => (
        <React.Fragment key={x}>
          <TouchPad x={x} pulse={pulse} />
          <StartBlock x={x} index={i} />
        </React.Fragment>
      ))}
    </>
  );
}

function CameraRig({ preset }: { preset: PoolPreset }) {
  const { camera, pointer } = useThree();
  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    const drift = preset.drift;
    camera.position.x += (pointer.x * drift + Math.sin(t * 0.07) * 1.6 - camera.position.x) * 0.035;
    camera.position.y += (preset.camY - pointer.y * 2.5 - camera.position.y) * 0.035;
    camera.position.z += (preset.camZ - camera.position.z) * 0.035;
    camera.lookAt(0, 1.5, WALL_Z + 14);
  });
  return null;
}

// fog is a scene object, so it has to be mutated rather than re-created to
// animate between presets
function FogRig({ preset }: { preset: PoolPreset }) {
  const { scene } = useThree();
  useFrame(() => {
    const fog = scene.fog as THREE.Fog | null;
    if (!fog) return;
    fog.near += (preset.fog[0] - fog.near) * 0.05;
    fog.far += (preset.fog[1] - fog.far) * 0.05;
  });
  return null;
}

export default function LaneWater({
  preset = POOL_PRESETS[0],
  backdrop = false,
}: {
  preset?: PoolPreset;
  backdrop?: boolean;
}) {
  const pulse = useRef(-100);

  return (
    <Canvas
      // behind a working screen this is decoration, so it renders at a low
      // pixel ratio and drops antialiasing rather than costing frames mid-race
      dpr={backdrop ? [0.5, 0.85] : [1, 1.75]}
      camera={{ position: [0, 11, 34], fov: 50 }}
      gl={{ antialias: !backdrop, powerPreference: backdrop ? 'low-power' : 'high-performance', alpha: false }}
    >
      <color attach="background" args={['#02060d']} />
      <fog attach="fog" args={['#02060d', 40, 105]} />
      <Scene pulse={pulse} preset={preset} backdrop={backdrop} />
      <CameraRig preset={preset} />
      <FogRig preset={preset} />
    </Canvas>
  );
}
