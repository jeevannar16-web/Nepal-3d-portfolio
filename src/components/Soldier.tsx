import type { JSX } from 'react'
import { useGLTF } from '@react-three/drei'
import * as THREE from 'three'
import { assetUrl } from '../utils/assetUrl'
import BlobShadow from './BlobShadow'

/** soldier.glb is ~32 world units tall; 0.056 makes the man ~1.8 tall. */
export const SOLDIER_SCALE = 0.056
// The model's base sits at y = -0.01, effectively at the origin.
export const SOLDIER_BASE_OFFSET = 0

interface SoldierProps {
  ref?: React.RefObject<THREE.Group | null>
}

/**
 * The player character: the downloaded Soldier model, scaled to a real person.
 * Nose faces +Z to match heading math.
 */
export default function Soldier({ ref }: SoldierProps): JSX.Element {
  const gltf = useGLTF(assetUrl('/models/soldier.glb'))
  return (
    <group ref={ref}>
      <group position={[0, SOLDIER_BASE_OFFSET, 0]}>
        <primitive object={gltf.scene} scale={SOLDIER_SCALE} />
      </group>
      <BlobShadow radius={0.8} y={0.01} />
    </group>
  )
}
