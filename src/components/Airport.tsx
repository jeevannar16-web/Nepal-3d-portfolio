import type { JSX } from 'react'

const RUNWAY_LENGTH = 60

/**
 * Low-poly airport at the south-east corner of the map — runway, terminal and
 * control tower. Purely decorative; the arrival plane taxis down the runway
 * during the intro's airport stage. Rendered inside IntroSequence so it
 * disappears once the intro ends.
 */
export default function Airport(): JSX.Element {
  return (
    <group position={[119.5, 0, -119.5]}>
      {/* Runway — long axis aligned with the takeoff heading (-0.707, 0.707) */}
      <mesh position={[0, 0.03, 0]} rotation={[0, (3 * Math.PI) / 4, 0]}>
        <boxGeometry args={[RUNWAY_LENGTH, 0.06, 9]} />
        <meshStandardMaterial color="#3a3f45" flatShading />
      </mesh>
      <mesh position={[0, 0.07, 0]} rotation={[0, (3 * Math.PI) / 4, 0]}>
        <boxGeometry args={[RUNWAY_LENGTH, 0.02, 0.6]} />
        <meshStandardMaterial color="#d7dde4" flatShading />
      </mesh>

      {/* Terminal building beside the runway */}
      <mesh position={[11.3, 1.75, 11.3]}>
        <boxGeometry args={[12, 3.5, 7]} />
        <meshStandardMaterial color="#e8dcc8" flatShading />
      </mesh>
      <mesh position={[11.3, 3.75, 11.3]}>
        <boxGeometry args={[12.8, 0.5, 7.8]} />
        <meshStandardMaterial color="#8a3b2e" flatShading />
      </mesh>

      {/* Control tower on the far side */}
      <mesh position={[-15, 3.5, -8]}>
        <boxGeometry args={[1.6, 7, 1.6]} />
        <meshStandardMaterial color="#e0e0e6" flatShading />
      </mesh>
      <mesh position={[-15, 8.1, -8]}>
        <boxGeometry args={[4.5, 2.2, 4.5]} />
        <meshStandardMaterial color="#101820" flatShading />
      </mesh>
      <mesh position={[-15, 9.4, -8]}>
        <boxGeometry args={[1.2, 0.4, 1.2]} />
        <meshStandardMaterial color="#8a3b2e" flatShading />
      </mesh>

      {/* Windsock */}
      <mesh position={[7, 2, -12]}>
        <boxGeometry args={[0.15, 4, 0.15]} />
        <meshStandardMaterial color="#6b7280" flatShading />
      </mesh>
      <mesh position={[7, 4.2, -12]} rotation={[Math.PI / 2, 0, 0]}>
        <coneGeometry args={[0.5, 0.9, 4]} />
        <meshStandardMaterial color="#e63946" flatShading />
      </mesh>
    </group>
  )
}
