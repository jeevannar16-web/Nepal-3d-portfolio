import { useMemo, type JSX, type RefObject } from 'react'
import { useGLTF } from '@react-three/drei'
import * as THREE from 'three'
import { assetUrl } from '../utils/assetUrl'
import {
  PLANE_SCALE,
  PLANE_BASE_OFFSET,
  hideAirplaneGlitch,
} from '../utils/airplane'

/**
 * Detailed B737 airplane model (airplane.glb). The model's nose faces local
 * -Z, so it is yawed 180° to point along +Z and match the intro flight-path
 * heading math; purely visual, positioned and animated by IntroSequence.
 * The wheels rest on the runway (offset from the real tyre height) and the
 * stray wingtip spike is dropped at load.
 */
export default function ArrivalPlane({
  ref,
}: {
  ref: RefObject<THREE.Group | null>
}): JSX.Element {
  const gltf = useGLTF(assetUrl('/models/airplane.glb'))
  useMemo(() => hideAirplaneGlitch(gltf.scene), [gltf])
  ;(window as any).__planeScene = gltf.scene
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
