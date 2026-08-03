import type { JSX, RefObject } from 'react'
import { useGLTF } from '@react-three/drei'
import * as THREE from 'three'
import { assetUrl } from '../utils/assetUrl'

const PLANE_SCALE = 0.25
// airplane.glb (B737) base (landing gear) sits at model-local y=-5.07; offset
// so the wheels rest on the intro flight path's altitude.
const PLANE_BASE_OFFSET = 5.07 * PLANE_SCALE

/**
 * Detailed B737 airplane model (airplane.glb). The model's nose faces local
 * -Z, so it is yawed 180° to point along +Z and match the intro flight-path
 * heading math; purely visual, positioned and animated by IntroSequence.
 * Landing gear included so it reads correctly on the runway.
 */
export default function ArrivalPlane({
  ref,
}: {
  ref: RefObject<THREE.Group | null>
}): JSX.Element {
  const gltf = useGLTF(assetUrl('/models/airplane.glb'))
  return (
    <group ref={ref} visible={false}>
      <primitive
        object={gltf.scene}
        scale={PLANE_SCALE}
        rotation={[0, Math.PI, 0]}
        position={[0, PLANE_BASE_OFFSET, 0]}
      />
    </group>
  )
}
