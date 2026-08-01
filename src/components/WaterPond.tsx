import { useMemo, useRef, type JSX } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { POND } from '../world'
import { PALETTE } from '../utils/palette'

/**
 * Small atmospheric pond near the temple. A single animated shader quad:
 * subtle sine-wave distortion across a deep-teal base with a bright fresnel
 * rim, so it glints as a light source for the bloom pass. Purely decorative —
 * no physics, no water simulation.
 */
export default function WaterPond(): JSX.Element {
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

            // Slow crossing waves — subtle distortion, not a storm.
            float wave = sin(p.x * 11.0 + uTime * 1.3) * sin(p.y * 9.0 - uTime * 1.05);
            wave += 0.5 * sin(d * 20.0 - uTime * 2.0);
            wave = wave * 0.5 + 0.5;

            vec3 deep = vec3(0.059, 0.227, 0.235); // waterDeep
            vec3 shallow = vec3(0.247, 0.490, 0.490); // waterShallow
            vec3 col = mix(deep, shallow, wave * 0.85);

            // Bright rim near the shore so the pond reads as a light shape.
            float edge = smoothstep(0.30, 0.5, d);
            col += vec3(0.25, 0.45, 0.42) * edge * 0.55;

            // Fresnel sheen against the camera — light catches the near side.
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

  useFrame((_, delta) => {
    matRef.current.uniforms.uTime.value += delta
  })

  return (
    <group position={[POND.x, 0, POND.z]}>
      {/* Damp shore ring so the water reads as a dip in the grass. */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.012, 0]}>
        <circleGeometry args={[POND.radius + 0.7, 32]} />
        <meshStandardMaterial color={PALETTE.waterDeep} roughness={1} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]} material={material}>
        <circleGeometry args={[POND.radius, 40]} />
      </mesh>
    </group>
  )
}
