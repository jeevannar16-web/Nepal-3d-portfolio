import { useMemo, type JSX } from 'react'
import * as THREE from 'three'
import { useStore } from '../store/useStore'
import { DAY_THEMES, INTRO_THEME } from '../utils/timeOfDay'

export default function GradientSky(): JSX.Element {
  const timeOfDay = useStore((s) => s.timeOfDay)
  const introDone = useStore((s) => s.introDone)
  const theme = introDone ? DAY_THEMES[timeOfDay] : INTRO_THEME

  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        side: THREE.BackSide,
        depthWrite: false,
        fog: false,
        uniforms: {
          topColor: { value: new THREE.Color(theme.skyTop) },
          horizonColor: { value: new THREE.Color(theme.skyHorizon) },
          zenithColor: { value: new THREE.Color(theme.skyZenith) },
        },
        vertexShader: `
          varying vec3 vWorldPosition;
          void main() {
            vec4 wp = modelMatrix * vec4(position, 1.0);
            vWorldPosition = wp.xyz;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `,
        fragmentShader: `
          uniform vec3 topColor;
          uniform vec3 horizonColor;
          uniform vec3 zenithColor;
          varying vec3 vWorldPosition;
          void main() {
            float h = normalize(vWorldPosition).y;
            float t = clamp(pow(max(h, 0.0), 0.45), 0.0, 1.0);
            vec3 lower = mix(horizonColor, zenithColor, smoothstep(0.0, 0.25, h));
            vec3 color = mix(lower, topColor, t);
            gl_FragColor = vec4(color, 1.0);
          }
        `,
      }),
    [theme],
  )

  return (
    <mesh material={material}>
      <sphereGeometry args={[400, 24, 16]} />
    </mesh>
  )
}
