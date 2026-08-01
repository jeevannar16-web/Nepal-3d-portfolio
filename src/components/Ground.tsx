import type { JSX } from 'react'
import { RigidBody, CuboidCollider } from '@react-three/rapier'

export default function Ground(): JSX.Element {
  return (
    <RigidBody type="fixed" colliders={false}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
        <planeGeometry args={[100, 100]} />
        <meshStandardMaterial color="#7cb98c" />
      </mesh>
      <CuboidCollider args={[50, 0.5, 50]} position={[0, -0.5, 0]} />
    </RigidBody>
  )
}
