import { useMemo, useRef, type JSX } from 'react'
import { useFrame } from '@react-three/fiber'
import type { RapierRigidBody } from '@react-three/rapier'
import * as THREE from 'three'
import { mulberry32 } from '../world'

const COUNT = 500
const HEIGHT = 24

interface RainProps {
  target: React.RefObject<RapierRigidBody | null>
}

/** Subtle rain: a pool of falling points that follows the player. */
export default function Rain({ target }: RainProps): JSX.Element {
  const points = useRef<THREE.Points>(null)
  const speeds = useRef<Float32Array>(new Float32Array(COUNT))

  const geometry = useMemo(() => {
    const rng = mulberry32(99)
    const positions = new Float32Array(COUNT * 3)
    for (let i = 0; i < COUNT; i++) {
      positions[i * 3] = (rng() * 2 - 1) * 70
      positions[i * 3 + 1] = rng() * HEIGHT
      positions[i * 3 + 2] = (rng() * 2 - 1) * 70
      speeds.current[i] = 8 + rng() * 8
    }
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    return g
  }, [])

  useFrame((_, delta) => {
    const attr = geometry.attributes.position as THREE.BufferAttribute
    const arr = attr.array as Float32Array
    for (let i = 0; i < COUNT; i++) {
      arr[i * 3 + 1] -= speeds.current[i] * delta
      if (arr[i * 3 + 1] < 0) arr[i * 3 + 1] = HEIGHT
    }
    attr.needsUpdate = true
    if (points.current && target.current) {
      const p = target.current.translation()
      points.current.position.set(p.x, 0, p.z)
    }
  })

  return (
    <points ref={points} geometry={geometry}>
      <pointsMaterial
        color="#9db4cc"
        size={0.12}
        transparent
        opacity={0.5}
        depthWrite={false}
      />
    </points>
  )
}
