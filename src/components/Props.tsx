import type { JSX } from 'react'
import { useGLTF } from '@react-three/drei'
import { assetUrl } from '../utils/assetUrl'

interface PropPlacement {
  /** Filename inside public/models/. */
  model: string
  position: [number, number, number]
  rotationY?: number
  scale: number
  castShadow?: boolean
}

/**
 * Hand-placed world props loaded from the real downloaded .glb models
 * (cottages, huts, shrines, bridges, a parked airplane, ...). Every model is
 * measured with scripts/inspect-glb.mjs so `position.y` and `scale` ground
 * the asset's base on the flat world floor (y = 0) and keep it proportional.
 */
function Prop({ placement }: { placement: PropPlacement }): JSX.Element {
  const gltf = useGLTF(assetUrl(`/models/${placement.model}`))
  return (
    <primitive
      object={gltf.scene}
      position={placement.position}
      rotation={[0, placement.rotationY ?? 0, 0]}
      scale={placement.scale}
    />
  )
}

/**
 * Shared scene filler: downloaded models arranged around the valley without
 * colliding with the road network (world.ts roadPaths) or the landmarks.
 */
export default function Props(): JSX.Element {
  return (
    <group>
      {PROPS.map((placement, i) => (
        <Prop key={i} placement={placement} />
      ))}
      <Runway />
    </group>
  )
}

const PROPS: PropPlacement[] = [
  // Wooden bridge across the temple pond (-84, -92).
  {
    model: 'woodbridge.glb',
    position: [-84, -2.204, -92],
    rotationY: 0.7,
    scale: 0.01,
  },

  // Small village on the southern plain.
  { model: 'cottage.glb', position: [-20, 0, -58], rotationY: 0.6, scale: 10 },
  { model: 'cottage.glb', position: [-14, 0, -66], rotationY: 2.4, scale: 10 },
  { model: 'well.glb', position: [-18, 0.55, -63], rotationY: 1.2, scale: 2.2 },

  // Shrine beside the temple landmark.
  { model: 'shrine.glb', position: [-86, 0.92, -72], rotationY: 0.4, scale: 2 },

  // Pagoda + thatched hut flanking the stupa landmark (45, -5).
  { model: 'pagoda.glb', position: [38, 0, 14], rotationY: 0.8, scale: 1.05 },
  { model: 'hut.glb', position: [56, 1.53, 10], rotationY: -1.2, scale: 2.5 },

  // Lanterns along the roads between landmarks.
  { model: 'lantern.glb', position: [-76, 0, -52], scale: 1.4 },
  { model: 'lantern.glb', position: [-28, 0, -92], scale: 1.4 },
  { model: 'lantern.glb', position: [72, 0, 18], scale: 1.4 },

  // Rocks near the mountain landmark.
  { model: 'rock.glb', position: [70, 1.3, 55], rotationY: 0.5, scale: 2.2 },
  { model: 'rock.glb', position: [85, 1.3, 50], rotationY: 1.9, scale: 2.2 },

  // Hedge clusters along the valley floor.
  { model: 'bush.glb', position: [30, 0.86, -25], rotationY: 0.3, scale: 1.5 },
  { model: 'bush.glb', position: [25, 0.86, -60], rotationY: 0.9, scale: 1.5 },

  // Fence segments flanking the gate landmark entrance.
  { model: 'fence.glb', position: [-78, 0.2, 92], rotationY: 0.3, scale: 0.7 },
  { model: 'fence.glb', position: [-102, 0.2, 92], rotationY: -0.3, scale: 0.7 },

  // Parked airplane on the north runway (nose +X).
  {
    model: 'plane.glb',
    position: [0, 0.865, 78],
    rotationY: Math.PI / 2,
    scale: 0.004,
  },
]

/** Flat asphalt strip + edge lines so the parked plane reads as an airstrip. */
function Runway(): JSX.Element {
  return (
    <group>
      <mesh position={[0, 0.02, 78]} receiveShadow>
        <boxGeometry args={[36, 0.04, 8]} />
        <meshStandardMaterial color="#3b3b44" roughness={0.95} />
      </mesh>
      {[74.6, 81.4].map((z) => (
        <mesh key={z} position={[0, 0.045, z]}>
          <boxGeometry args={[36, 0.02, 0.5]} />
          <meshStandardMaterial color="#e8e8ec" roughness={0.8} />
        </mesh>
      ))}
    </group>
  )
}
