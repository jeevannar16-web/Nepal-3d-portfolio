import { useMemo, type JSX } from 'react'
import { useGLTF } from '@react-three/drei'
import { CuboidCollider, RigidBody } from '@react-three/rapier'
import { assetUrl } from '../utils/assetUrl'
import { useStore } from '../store/useStore'
import {
  PLANE_SCALE,
  PLANE_BASE_OFFSET,
  hideAirplaneGlitch,
} from '../utils/airplane'

/**
 * The airplane the intro just landed, kept parked on the runway once the intro
 * hands over to free-roam. A fixed collider makes it solid and explorable
 * (walk up to it, but not through it). Only the one landed plane exists: the
 * world's own parked plane (Props) is hidden while this pose is set.
 */
export default function ParkedArrivalPlane(): JSX.Element | null {
  const introDone = useStore((s) => s.introDone)
  const parkedPlane = useStore((s) => s.parkedPlane)
  const playerMode = useStore((s) => s.playerMode)
  const gltf = useGLTF(assetUrl('/models/airplane.glb'))
  useMemo(() => hideAirplaneGlitch(gltf.scene), [gltf])

  // Hide the intro landed plane; the default airplane to board is the one
  // already on the runway (Airport), so we don't show two parked planes.
  if (!introDone || !parkedPlane || playerMode === 'airplane') return null

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
