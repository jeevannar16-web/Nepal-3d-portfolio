import { type JSX } from 'react'
import { useGLTF } from '@react-three/drei'
import { RigidBody, CuboidCollider } from '@react-three/rapier'
import { assetUrl } from '../utils/assetUrl'
import { useStore } from '../store/useStore'
import Helicopter from './Helicopter'

interface ColliderSpec {
  /** Half-extents of the box collider around the model. */
  half: [number, number, number]
  /** Vertical center of the collider above the model's base (y = 0). */
  y?: number
}

interface PropPlacement {
  /** Filename inside public/models/. */
  model: string
  position: [number, number, number]
  rotationY?: number
  scale: number
  /** Optional solid hitbox so walkers and vehicles stop at the object. */
  collider?: ColliderSpec
}

/**
 * Hand-placed world props loaded from the real downloaded .glb models.
 * Every model is measured with scripts/inspect-glb.mjs so `position.y` and
 * `scale` ground the asset's base on the flat world floor (y = 0) and keep it
 * proportional. Placements are grouped by their real-world location: a
 * riverside village, the temple entrance with a stone path, cliffs on the
 * valley rim, and fences flanking the gate. Larger, solid objects get a box
 * collider so you can't walk or drive straight through them.
 */
function Prop({ placement }: { placement: PropPlacement }): JSX.Element {
  const gltf = useGLTF(assetUrl(`/models/${placement.model}`))
  const c = placement.collider
  const mesh = (
    <primitive
      object={gltf.scene}
      position={placement.position}
      rotation={[0, placement.rotationY ?? 0, 0]}
      scale={placement.scale}
    />
  )
  if (!c) return mesh
  return (
    <RigidBody
      type="fixed"
      position={placement.position}
      rotation={[0, placement.rotationY ?? 0, 0]}
      colliders={false}
    >
      <CuboidCollider args={c.half} position={[0, c.y ?? c.half[1], 0]} />
      <primitive object={gltf.scene} scale={placement.scale} />
    </RigidBody>
  )
}

/**
 * Shared scene filler: downloaded models arranged around the valley without
 * colliding with the road network, the river, or the landmarks.
 */
export default function Props(): JSX.Element {
  return (
    <group>
      {PROPS.map((placement, i) => (
        <Prop key={i} placement={placement} />
      ))}
      <Bridge />
      <Airport />
      <AmbientPlane />
    </group>
  )
}

const PROPS: PropPlacement[] = [
  // ---- Riverside village on the north bank of the river, by the bridge ----
  {
    model: 'cottage.glb',
    position: [46, 0, -28],
    rotationY: 0.9,
    scale: 10,
    collider: { half: [1.5, 1.4, 2.35], y: 1.4 },
  },
  {
    model: 'cottage.glb',
    position: [36, 0, -22],
    rotationY: -0.3,
    scale: 10,
    collider: { half: [1.5, 1.4, 2.35], y: 1.4 },
  },
  {
    model: 'logcabin.glb',
    position: [56, -0.5, -16],
    rotationY: 0.7,
    scale: 0.008,
    collider: { half: [6, 2.9, 5.7], y: 2.9 },
  },
  {
    model: 'well.glb',
    position: [43, 0.55, -25],
    rotationY: 0.5,
    scale: 2.2,
    collider: { half: [0.73, 1.37, 1.1], y: 1.37 },
  },
  { model: 'roses.glb', position: [49, 2.22, -24], rotationY: 0.4, scale: 1 },
  { model: 'plant.glb', position: [40, 0, -27], scale: 1.4 },
  // Dock reaching out from the south bank into the river.
  { model: 'dock.glb', position: [21.5, 0.08, -53.5], rotationY: -0.23, scale: 0.35 },

  // ---- Temple entrance with a stone path up to the temple landmark ----
  // The gate is an archway you're meant to walk through, so no collider.
  { model: 'templeentrance.glb', position: [-84, 1.52, -62], rotationY: 0.6, scale: 1.2 },
  { model: 'shrine.glb', position: [-82, 0.92, -78], rotationY: 0.4, scale: 2 },
  { model: 'pathway.glb', position: [-85, 0, -63], rotationY: -2.6, scale: 2.2 },
  { model: 'pathway.glb', position: [-86.9, 0, -66.1], rotationY: -2.6, scale: 2.2 },
  { model: 'pathway.glb', position: [-88.8, 0, -69.1], rotationY: -2.6, scale: 2.2 },
  { model: 'pathway.glb', position: [-90.6, 0, -72.2], rotationY: -2.6, scale: 2.2 },
  { model: 'pathway.glb', position: [-92.5, 0, -75.3], rotationY: -2.6, scale: 2.2 },
  { model: 'pathway.glb', position: [-94.4, 0, -78.4], rotationY: -2.6, scale: 2.2 },

  // ---- Pagoda + thatched hut flanking the stupa landmark ----
  {
    model: 'pagoda.glb',
    position: [38, 0, 14],
    rotationY: 0.8,
    scale: 1.05,
    collider: { half: [2.4, 2.75, 2.52], y: 2.75 },
  },
  {
    model: 'hut.glb',
    position: [56, 1.53, 10],
    rotationY: -1.2,
    scale: 2.5,
    collider: { half: [2.1, 1.96, 2.1], y: 1.96 },
  },

  // ---- Lanterns lighting the roads between landmarks ----
  { model: 'lantern.glb', position: [-76, 0, -52], scale: 1.4 },
  { model: 'lantern.glb', position: [-28, 0, -92], scale: 1.4 },
  { model: 'lantern.glb', position: [72, 0, 18], scale: 1.4 },

  // ---- Rocks and cliffs at the mountain, valley rim ----
  {
    model: 'rock.glb',
    position: [70, 1.3, 55],
    rotationY: 0.5,
    scale: 2.2,
    collider: { half: [1.54, 1.73, 1.63], y: 1.73 },
  },
  {
    model: 'rock.glb',
    position: [85, 1.3, 50],
    rotationY: 1.9,
    scale: 2.2,
    collider: { half: [1.54, 1.73, 1.63], y: 1.73 },
  },
  {
    model: 'cliff.glb',
    position: [-132, 26.4, -124],
    rotationY: 0.5,
    scale: 0.035,
    collider: { half: [23.7, 38.9, 13.5], y: 38.9 },
  },
  {
    model: 'cliff.glb',
    position: [134, 26.4, 122],
    rotationY: 2.0,
    scale: 0.035,
    collider: { half: [23.7, 38.9, 13.5], y: 38.9 },
  },

  // ---- Hedge clusters along the valley floor ----
  {
    model: 'bush.glb',
    position: [30, 0.86, -25],
    rotationY: 0.3,
    scale: 1.5,
    collider: { half: [4.93, 1.1, 1.34], y: 1.1 },
  },
  {
    model: 'bush.glb',
    position: [16, 0.86, -66],
    rotationY: 0.9,
    scale: 1.5,
    collider: { half: [4.93, 1.1, 1.34], y: 1.1 },
  },

  // ---- Fence segments flanking the gate landmark entrance ----
  {
    model: 'fence.glb',
    position: [-78, 0.2, 92],
    rotationY: 0.3,
    scale: 0.7,
    collider: { half: [2.6, 2.03, 0.17], y: 2.03 },
  },
  {
    model: 'fence.glb',
    position: [-102, 0.2, 92],
    rotationY: -0.3,
    scale: 0.7,
    collider: { half: [2.6, 2.03, 0.17], y: 2.03 },
  },
]

/**
 * Driveable low bridge where the gate<->tower highway crosses the river at
 * (42, -42). The deck is flush with the road surface (car drives straight
 * over the water at ground level — no ramp physics needed), railings and legs
 * make it read as a bridge over the water.
 */
function Bridge(): JSX.Element {
  return (
    <group position={[42, 0, -42]} rotation={[0, (Math.PI * 3) / 4, 0]}>
      <mesh position={[0, 0.03, 0]}>
        <boxGeometry args={[5.4, 0.06, 17]} />
        <meshStandardMaterial color="#8a6b4f" flatShading />
      </mesh>
      {[-2.55, 2.55].map((x) => (
        <mesh key={x} position={[x, 0.45, 0]}>
          <boxGeometry args={[0.14, 0.9, 17]} />
          <meshStandardMaterial color="#5c4633" flatShading />
        </mesh>
      ))}
      {[-6, 6].map((z) => (
        <group key={z}>
          {[-1.6, 1.6].map((x) => (
            <mesh key={x} position={[x, 0.7, z]}>
              <boxGeometry args={[0.28, 1.4, 0.28]} />
              <meshStandardMaterial color="#4a3a2a" flatShading />
            </mesh>
          ))}
        </group>
      ))}
    </group>
  )
}

/** Runway + helipad on the north plain, just off the northern ring road. */
function Airport(): JSX.Element {
  const introDone = useStore((s) => s.introDone)
  const parkedPlane = useStore((s) => s.parkedPlane)
  const playerMode = useStore((s) => s.playerMode)
  const parkedPlaneScene = useGLTF(assetUrl('/models/plane.glb')).scene
  return (
    <group>
      {/* Asphalt runway with edge lines */}
      <mesh position={[0, 0.02, 88]}>
        <boxGeometry args={[36, 0.04, 8]} />
        <meshStandardMaterial color="#3b3b44" roughness={0.95} />
      </mesh>
      {[84.6, 91.4].map((z) => (
        <mesh key={z} position={[0, 0.045, z]}>
          <boxGeometry args={[36, 0.02, 0.5]} />
          <meshStandardMaterial color="#e8e8ec" roughness={0.8} />
        </mesh>
      ))}
      {/* Parked plane (nose +X) — hidden while the user is flying so the runway
          never holds two planes. */}
      {introDone && !parkedPlane && playerMode !== 'airplane' && (
        <RigidBody type="fixed" position={[0, 1.08, 88]} colliders={false}>
          <CuboidCollider args={[1.45, 1.45, 4.2]} position={[0, 1.45, 0]} />
          <primitive
            object={parkedPlaneScene}
            rotation={[0, Math.PI / 2, 0]}
            scale={0.005}
          />
        </RigidBody>
      )}
      {/* Helipad beside the runway */}
      <mesh position={[-10, 0.02, 80]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[3.2, 24]} />
        <meshStandardMaterial color="#3b3b44" roughness={0.95} />
      </mesh>
      <mesh position={[-10, 0.035, 80]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[2.7, 2.95, 24]} />
        <meshStandardMaterial color="#e8e8ec" roughness={0.8} />
      </mesh>
      <Helicopter />
    </group>
  )
}

/**
 * Ambient air traffic: the real airplane model circles the valley high above
 * after the intro, so the airplane is always visible wherever you drive.
 */
function AmbientPlane(): JSX.Element | null {
  return null
}
