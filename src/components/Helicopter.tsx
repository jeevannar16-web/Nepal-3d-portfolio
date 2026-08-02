import { useRef, type JSX } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import BlobShadow from './BlobShadow'

const BODY = '#e8e8ec'
const DARK = '#33333c'
const ACCENT = '#c9442e'

/**
 * Stylized low-poly helicopter parked on the airport helipad, built from
 * primitives to match the world's painterly look (no helicopter .glb was in
 * the downloads folder). Nose faces +X; the main rotor spins slowly.
 */
export default function Helicopter(): JSX.Element {
  const rotor = useRef<THREE.Group>(null)

  useFrame((_, dt) => {
    if (rotor.current) rotor.current.rotation.y += dt * 6
  })

  return (
    <group position={[-10, 0, 70]} rotation={[0, Math.PI / 2, 0]}>
      {/* Skids */}
      <mesh position={[-0.6, 0.14, 0.7]} rotation={[0.12, 0, 0]}>
        <boxGeometry args={[0.12, 0.12, 2.6]} />
        <meshStandardMaterial color={DARK} flatShading />
      </mesh>
      <mesh position={[0.6, 0.14, 0.7]} rotation={[0.12, 0, 0]}>
        <boxGeometry args={[0.12, 0.12, 2.6]} />
        <meshStandardMaterial color={DARK} flatShading />
      </mesh>

      {/* Fuselage */}
      <mesh position={[0, 0.9, 0.4]}>
        <boxGeometry args={[1.0, 0.75, 2.6]} />
        <meshStandardMaterial color={BODY} flatShading />
      </mesh>
      {/* Cockpit nose + glass */}
      <mesh position={[0, 0.95, 1.7]}>
        <boxGeometry args={[0.85, 0.6, 1.0]} />
        <meshStandardMaterial color={ACCENT} flatShading />
      </mesh>
      <mesh position={[0, 1.0, 2.05]}>
        <boxGeometry args={[0.7, 0.38, 0.38]} />
        <meshStandardMaterial color="#1b3b52" flatShading />
      </mesh>
      {/* Tail boom + fin + tail rotor */}
      <mesh position={[0, 1.05, -1.5]}>
        <boxGeometry args={[0.28, 0.28, 2.2]} />
        <meshStandardMaterial color={BODY} flatShading />
      </mesh>
      <mesh position={[0, 1.55, -2.4]}>
        <boxGeometry args={[0.08, 0.7, 0.55]} />
        <meshStandardMaterial color={ACCENT} flatShading />
      </mesh>
      <mesh position={[0, 1.3, -2.55]}>
        <boxGeometry args={[0.8, 0.08, 0.08]} />
        <meshStandardMaterial color={DARK} flatShading />
      </mesh>
      {/* Rotor mast */}
      <mesh position={[0, 1.6, 0.1]}>
        <cylinderGeometry args={[0.07, 0.07, 0.5, 6]} />
        <meshStandardMaterial color={DARK} flatShading />
      </mesh>

      {/* Spinning main rotor */}
      <group ref={rotor} position={[0, 1.9, 0.1]}>
        <mesh>
          <boxGeometry args={[4.2, 0.06, 0.2]} />
          <meshStandardMaterial color={DARK} flatShading />
        </mesh>
        <mesh rotation={[0, Math.PI / 2, 0]}>
          <boxGeometry args={[0.2, 0.06, 4.2]} />
          <meshStandardMaterial color={DARK} flatShading />
        </mesh>
      </group>

      <BlobShadow radius={1.5} />
    </group>
  )
}
