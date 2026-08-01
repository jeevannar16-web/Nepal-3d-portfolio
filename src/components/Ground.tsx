import type { JSX } from 'react'
import { RigidBody, CuboidCollider } from '@react-three/rapier'
import { grassTexture } from '../utils/textures'

const EDGE = 50
const WALL_HEIGHT = 2

export default function Ground(): JSX.Element {
  return (
    <>
      <RigidBody type="fixed" colliders={false}>
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]}>
          <planeGeometry args={[100, 100]} />
          <meshStandardMaterial map={grassTexture()} color="#79b383" />
        </mesh>
        <CuboidCollider args={[EDGE, 0.5, EDGE]} position={[0, -0.5, 0]} />
      </RigidBody>

      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider args={[EDGE, WALL_HEIGHT / 2, 0.5]} position={[0, WALL_HEIGHT / 2, EDGE]} />
      </RigidBody>
      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider args={[EDGE, WALL_HEIGHT / 2, 0.5]} position={[0, WALL_HEIGHT / 2, -EDGE]} />
      </RigidBody>
      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider args={[0.5, WALL_HEIGHT / 2, EDGE]} position={[EDGE, WALL_HEIGHT / 2, 0]} />
      </RigidBody>
      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider args={[0.5, WALL_HEIGHT / 2, EDGE]} position={[-EDGE, WALL_HEIGHT / 2, 0]} />
      </RigidBody>
    </>
  )
}
