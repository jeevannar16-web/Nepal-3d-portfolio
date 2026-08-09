import type { JSX } from 'react'
import { useGLTF } from '@react-three/drei'
import { assetUrl } from '../utils/assetUrl'

// bike.glb is 127.5 long, 67 tall, base at origin. The nose (tallest vertex,
// the handlebars) faces local -Z, so the model is yawed 180° to face +Z and
// match the car/heading convention (W = forward).
const BIKE_SCALE = 0.0157

// The "Horse by Poly by Google" model: base at y = 0, head faces +Z, roughly
// 14.6 units long / 12.8 tall at scale 1. Scaled down to match the other
// vehicles (~2.2 long, ~1.9 tall) and already faces +Z, so no yaw is needed.
const HORSE_SCALE = 0.15
const HORSE_BASE_OFFSET = 0

/** The downloaded mechanical horse model (yawed to face +Z). */
export function HorseModel(): JSX.Element {
  const gltf = useGLTF(assetUrl('/models/horse.glb'))
  return (
    <primitive
      object={gltf.scene}
      scale={HORSE_SCALE}
      rotation={[0, 0, 0]}
      position={[0, HORSE_BASE_OFFSET, 0]}
    />
  )
}

/** The downloaded motorcycle model (yawed to face +Z). */
export function BikeModel(): JSX.Element {
  const gltf = useGLTF(assetUrl('/models/bike.glb'))
  return <primitive object={gltf.scene} scale={BIKE_SCALE} rotation={[0, Math.PI, 0]} />
}
