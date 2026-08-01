import { useRef, type JSX } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { glossyMatcapTexture } from '../utils/textures'

/**
 * Low-poly arrival helicopter. Nose points along +Z; positioned and animated
 * by IntroSequence. The main and tail rotors spin continuously (visual only).
 */
export default function ArrivalHelicopter({
  ref,
}: {
  ref: React.RefObject<THREE.Group | null>
}): JSX.Element {
  const mainRotor = useRef<THREE.Mesh>(null)
  const tailRotor = useRef<THREE.Mesh>(null)

  useFrame((_, delta) => {
    if (mainRotor.current) mainRotor.current.rotation.y += delta * 10
    if (tailRotor.current) tailRotor.current.rotation.x += delta * 14
  })

  return (
    <group ref={ref} visible={false}>
      {/* Fuselage */}
      <mesh position={[0, 0.1, 0]}>
        <boxGeometry args={[0.8, 0.6, 1.6]} />
        <meshMatcapMaterial color="#e8e8e8" matcap={glossyMatcapTexture()} flatShading />
      </mesh>
      {/* Cabin glass */}
      <mesh position={[0, 0.22, 0.55]}>
        <boxGeometry args={[0.7, 0.4, 0.5]} />
        <meshMatcapMaterial color="#101820" matcap={glossyMatcapTexture()} flatShading />
      </mesh>
      {/* Tail boom */}
      <mesh position={[0, 0.35, -1.1]}>
        <boxGeometry args={[0.22, 0.22, 1.3]} />
        <meshMatcapMaterial color="#a90f1b" matcap={glossyMatcapTexture()} flatShading />
      </mesh>
      {/* Tail fin */}
      <mesh position={[0, 0.78, -1.65]}>
        <boxGeometry args={[0.08, 0.6, 0.4]} />
        <meshMatcapMaterial color="#a90f1b" matcap={glossyMatcapTexture()} flatShading />
      </mesh>
      {/* Tail rotor */}
      <mesh ref={tailRotor} position={[0, 0.55, -1.82]}>
        <boxGeometry args={[0.05, 0.5, 0.12]} />
        <meshMatcapMaterial color="#26262c" matcap={glossyMatcapTexture()} flatShading />
      </mesh>
      {/* Skids */}
      {[0.3, -0.3].map((z, i) => (
        <mesh key={`skid-${i}`} position={[0, -0.34, z]}>
          <boxGeometry args={[0.06, 0.08, 1.3]} />
          <meshMatcapMaterial color="#26262c" matcap={glossyMatcapTexture()} flatShading />
        </mesh>
      ))}
      {/* Rotor mast */}
      <mesh position={[0, 0.62, 0]}>
        <boxGeometry args={[0.08, 0.16, 0.08]} />
        <meshMatcapMaterial color="#26262c" matcap={glossyMatcapTexture()} flatShading />
      </mesh>
      {/* Main rotor */}
      <mesh ref={mainRotor} position={[0, 0.78, 0]}>
        <boxGeometry args={[2.3, 0.04, 0.28]} />
        <meshMatcapMaterial color="#26262c" matcap={glossyMatcapTexture()} flatShading />
      </mesh>
    </group>
  )
}
