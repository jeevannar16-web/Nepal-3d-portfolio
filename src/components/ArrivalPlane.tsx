import type { JSX } from 'react'
import * as THREE from 'three'
import { glossyMatcapTexture } from '../utils/textures'

/**
 * Low-poly arrival plane. Nose points along +Z; purely visual, positioned and
 * animated by IntroSequence.
 */
export default function ArrivalPlane({ ref }: { ref: React.RefObject<THREE.Group | null> }): JSX.Element {
  return (
    <group ref={ref} visible={false}>
      {/* Fuselage */}
      <mesh position={[0, 0, 0]}>
        <boxGeometry args={[0.7, 0.7, 2.6]} />
        <meshMatcapMaterial color="#f2f2f2" matcap={glossyMatcapTexture()} flatShading />
      </mesh>
      {/* Nose cone */}
      <mesh position={[0, 0.05, 1.45]} rotation={[-Math.PI / 2, 0, 0]}>
        <coneGeometry args={[0.35, 0.7, 6]} />
        <meshMatcapMaterial color="#f2f2f2" matcap={glossyMatcapTexture()} flatShading />
      </mesh>
      {/* Wings */}
      <mesh position={[0, -0.02, 0]}>
        <boxGeometry args={[4.4, 0.1, 1.2]} />
        <meshMatcapMaterial color="#a90f1b" matcap={glossyMatcapTexture()} flatShading />
      </mesh>
      {/* Tail fin */}
      <mesh position={[0, 0.62, -1.25]}>
        <boxGeometry args={[0.1, 0.7, 0.55]} />
        <meshMatcapMaterial color="#a90f1b" matcap={glossyMatcapTexture()} flatShading />
      </mesh>
      {/* Horizontal stabilizers */}
      <mesh position={[0, 0.02, -1.3]}>
        <boxGeometry args={[1.7, 0.08, 0.5]} />
        <meshMatcapMaterial color="#a90f1b" matcap={glossyMatcapTexture()} flatShading />
      </mesh>
    </group>
  )
}
