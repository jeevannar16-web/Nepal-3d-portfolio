import { useMemo, useRef, type JSX } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { RIVER, type Point } from '../world'
import { PALETTE } from '../utils/palette'

/** Build a flat ribbon of triangles along a polyline in the XZ plane. */
function stripGeometry(points: Point[], width: number): THREE.BufferGeometry {
  const verts: number[] = []
  const idx: number[] = []
  for (let i = 0; i < points.length - 1; i++) {
    const [ax, az] = points[i]
    const [bx, bz] = points[i + 1]
    const dx = bx - ax
    const dz = bz - az
    const len = Math.hypot(dx, dz) || 1
    const px = (-dz / len) * (width / 2)
    const pz = (dx / len) * (width / 2)
    const base = verts.length / 3
    verts.push(ax + px, 0, az + pz)
    verts.push(ax - px, 0, az - pz)
    verts.push(bx - px, 0, bz - pz)
    verts.push(bx + px, 0, bz + px)
    idx.push(base, base + 1, base + 2, base, base + 2, base + 3)
  }
  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3))
  geo.setIndex(idx)
  geo.computeVertexNormals()
  return geo
}

/**
 * Wide animated river flowing across the valley. A darker bank ribbon sits
 * just below the animated water strip, so the river reads as a dip in the
 * grass like the pond. The gate<->tower highway crosses it on a bridge at
 * (42, -42). Purely visual — the ground collider stays intact underneath.
 */
export default function WaterRiver(): JSX.Element {
  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: { uTime: { value: 0 } },
        vertexShader: `
          varying vec2 vUv;
          varying vec3 vWorldNormal;
          varying vec3 vWorldPos;
          void main() {
            vUv = uv;
            vWorldNormal = normalize(mat3(modelMatrix) * normal);
            vWorldPos = (modelMatrix * vec4(position, 1.0)).xyz;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `,
        fragmentShader: `
          uniform float uTime;
          varying vec2 vUv;
          varying vec3 vWorldNormal;
          varying vec3 vWorldPos;
          void main() {
            vec2 p = vUv - 0.5;
            float d = length(p);

            float wave = sin(p.x * 11.0 + uTime * 1.3) * sin(p.y * 9.0 - uTime * 1.05);
            wave += 0.5 * sin(d * 20.0 - uTime * 2.0);
            wave = wave * 0.5 + 0.5;

            vec3 deep = vec3(0.059, 0.227, 0.235);
            vec3 shallow = vec3(0.247, 0.490, 0.490);
            vec3 col = mix(deep, shallow, wave * 0.85);

            float edge = smoothstep(0.30, 0.5, d);
            col += vec3(0.25, 0.45, 0.42) * edge * 0.55;

            vec3 viewDir = normalize(cameraPosition - vWorldPos);
            float fres = pow(1.0 - abs(dot(normalize(vWorldNormal), viewDir)), 2.5);
            col += vec3(0.45, 0.65, 0.6) * fres * 0.5;

            gl_FragColor = vec4(col, 1.0);
          }
        `,
      }),
    [],
  )
  const matRef = useRef(material)

  const bankGeo = useMemo(() => stripGeometry(RIVER.path, RIVER.width + 1.8), [])
  const waterGeo = useMemo(() => stripGeometry(RIVER.path, RIVER.width), [])

  useFrame((_, delta) => {
    matRef.current.uniforms.uTime.value += delta
  })

  return (
    <group>
      <mesh geometry={bankGeo} position={[0, 0.012, 0]}>
        <meshStandardMaterial color={PALETTE.waterDeep} roughness={1} />
      </mesh>
      <mesh geometry={waterGeo} position={[0, 0.02, 0]} material={material} />
    </group>
  )
}
