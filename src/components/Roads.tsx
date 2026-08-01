import { useMemo, type JSX } from 'react'
import * as THREE from 'three'
import { landmarks } from '../data'

interface RoadProps {
  a: [number, number]
  b: [number, number]
  width?: number
  color?: string
}

function Road({ a, b, width = 3.2, color = '#c2a06e' }: RoadProps): JSX.Element {
  const { length, angle, x, z } = useMemo(() => {
    const dx = b[0] - a[0]
    const dz = b[1] - a[1]
    return {
      length: Math.sqrt(dx * dx + dz * dz),
      angle: Math.atan2(dx, dz),
      x: (a[0] + b[0]) / 2,
      z: (a[1] + b[1]) / 2,
    }
  }, [a, b])

  const material = useMemo(
    () => new THREE.MeshStandardMaterial({ color, flatShading: true }),
    [color],
  )

  return (
    <mesh position={[x, 0.02, z]} rotation={[0, angle, 0]} material={material}>
      <boxGeometry args={[width, 0.05, length]} />
    </mesh>
  )
}

export default function Roads(): JSX.Element {
  const positions = useMemo(
    () =>
      landmarks.map((l) => [l.position[0], l.position[2]] as [number, number]),
    [],
  )

  const pairs = useMemo(
    () =>
      positions.map(
        (pos, i) =>
          [
            pos,
            positions[(i + 1) % positions.length],
          ] as [[number, number], [number, number]],
      ),
    [positions],
  )

  const centerPlaza = useMemo(
    () =>
      new THREE.MeshStandardMaterial({ color: '#b4915f', flatShading: true }),
    [],
  )

  return (
    <>
      {pairs.map(([a, b], i) => (
        <Road key={i} a={a} b={b} />
      ))}
      <mesh position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]} material={centerPlaza}>
        <circleGeometry args={[3.4, 24]} />
      </mesh>
    </>
  )
}
