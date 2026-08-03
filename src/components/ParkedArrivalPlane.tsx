import type { JSX } from 'react'
import { useGLTF } from '@react-three/drei'
import { CuboidCollider, RigidBody } from '@react-three/rapier'
import { assetUrl } from '../utils/assetUrl'
import { useStore } from '../store/useStore'

const PLANE_SCALE = 0.25
// airplane.glb (B737) base (landing gear) sits at model-local y=-5.07; offset
// so the wheels rest on the ground — same numbers as the intro ArrivalPlane.
const PLANE_BASE_OFFSET = 5.07 * PLANE_SCALE

/**
 * The airplane the intro just landed, kept parked on the runway once the intro
 * hands over to free-roam. A fixed collider makes it solid and explorable
 * (walk up to it, but not through it). Only the one landed plane exists: the
 * world's own parked plane (Props) is hidden while this pose is set.
 */
export default function ParkedArrivalPlane(): JSX.Element | null {
  const introDone = useStore((s) => s.introDone)
  const parkedPlane = useStore((s) => s.parkedPlane)
  const gltf = useGLTF(assetUrl('/models/airplane.glb'))

  if (!introDone || !parkedPlane) return null

  return (
    <RigidBody
      type="fixed"
      position={[parkedPlane.x, parkedPlane.y, parkedPlane.z]}
      rotation={[0, parkedPlane.heading, 0]}
      colliders={false}
    >
      {/* Fuselage-sized box so walkers/vehicles can't drive through it. */}
      <CuboidCollider args={[1.6, 1.7, 4.4]} position={[0, 2.1, 0]} />
      <primitive
        object={gltf.scene}
        scale={PLANE_SCALE}
        rotation={[0, Math.PI, 0]}
        position={[0, PLANE_BASE_OFFSET, 0]}
      />
    </RigidBody>
  )
}
