import type { JSX } from 'react'
import { useGLTF } from '@react-three/drei'
import { assetUrl } from '../utils/assetUrl'

// car.glb: origin off-center, recentered on the physics pivot at scale 0.005.
const CAR_SCALE = 0.005
const CAR_CENTER_X = ((-134.64 + 95.56) / 2) * CAR_SCALE
const CAR_CENTER_Z = ((-271.77 + 217.67) / 2) * CAR_SCALE

// bike.glb is 127.5 long, 67 tall, base at origin. The nose (tallest vertex,
// the handlebars) faces local -Z, so the model is yawed 180° to face +Z and
// match the car/heading convention (W = forward).
const BIKE_SCALE = 0.0157

// horse.glb is 6.4 long, base at y = -2.63. The head (highest vertex) faces
// local -Z, so the model is yawed 180° to face +Z like the other vehicles.
const HORSE_SCALE = 0.31
const HORSE_BASE_OFFSET = 2.63 * HORSE_SCALE

/** The downloaded car model, recentered on its physics pivot. */
export function CarModel(): JSX.Element {
  const gltf = useGLTF(assetUrl('/models/car.glb'))
  return (
    <primitive
      object={gltf.scene}
      scale={CAR_SCALE}
      position={[CAR_CENTER_X, -0.5, CAR_CENTER_Z]}
    />
  )
}

/** The downloaded motorcycle model (yawed to face +Z). */
export function BikeModel(): JSX.Element {
  const gltf = useGLTF(assetUrl('/models/bike.glb'))
  return <primitive object={gltf.scene} scale={BIKE_SCALE} rotation={[0, Math.PI, 0]} />
}

/** The downloaded mechanical horse model (yawed to face +Z). */
export function HorseModel(): JSX.Element {
  const gltf = useGLTF(assetUrl('/models/horse.glb'))
  return (
    <primitive
      object={gltf.scene}
      scale={HORSE_SCALE}
      rotation={[0, Math.PI, 0]}
      position={[0, HORSE_BASE_OFFSET, 0]}
    />
  )
}
