import { useMemo, type JSX } from 'react'
import * as THREE from 'three'
import { blobShadowTexture } from '../utils/textures'

interface BlobShadowProps {
  radius?: number
  y?: number
  opacity?: number
}

export default function BlobShadow({
  radius = 1,
  y = 0.01,
  opacity = 0.55,
}: BlobShadowProps): JSX.Element {
  const material = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        map: blobShadowTexture(),
        transparent: true,
        depthWrite: false,
        opacity,
      }),
    [opacity],
  )

  return (
    <mesh
      position={[0, y, 0]}
      rotation={[-Math.PI / 2, 0, 0]}
      material={material}
    >
      <planeGeometry args={[radius * 2.4, radius * 2.4]} />
    </mesh>
  )
}
