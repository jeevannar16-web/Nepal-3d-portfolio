import type { JSX, RefObject } from 'react'
import { useGLTF } from '@react-three/drei'
import * as THREE from 'three'
import { assetUrl } from '../utils/assetUrl'

const PLANE_SCALE = 0.004
// plane.glb base (landing gear) sits at model-local y=-216; offset so the
// wheels rest on the intro flight path's altitude.
const PLANE_BASE_OFFSET = 216 * PLANE_SCALE

/**
 * Real low-poly airplane model (plane.glb). Nose points along +Z to match the
 * intro flight-path heading math; purely visual, positioned and animated by
 * IntroSequence. Landing gear included so it reads correctly on the runway
 * during the airport stage.
 */
export default function ArrivalPlane({
  ref,
}: {
  ref: RefObject<THREE.Group | null>
}): JSX.Element {
  const gltf = useGLTF(assetUrl('/models/plane.glb'))
  return (
    <group ref={ref} visible={false}>
      <primitive
        object={gltf.scene}
        scale={PLANE_SCALE}
        position={[0, PLANE_BASE_OFFSET, 0]}
      />
    </group>
  )
}
