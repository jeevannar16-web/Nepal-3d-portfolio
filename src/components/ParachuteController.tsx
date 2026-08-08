import { useRef, type JSX } from 'react'
import { useFrame } from '@react-three/fiber'
import { RigidBody, type RapierRigidBody } from '@react-three/rapier'
import * as THREE from 'three'
import { useGLTF } from '@react-three/drei'
import { assetUrl } from '../utils/assetUrl'
import { useStore } from '../store/useStore'
import { transportState } from '../store/transportState'
import { minimapState } from '../store/minimapState'
import { inputState, feetLocalY } from '../store/walkState'
import Soldier from './Soldier'
import { clampXZ, LAND_LIMIT } from '../utils/bounds'
import { WORLD_EDGE } from './Ground'

const DESCENT_SPEED = 5.5 // steady controlled fall, not a free-fall
const FLARE_SPEED = 2.2 // holding W flares the canopy (slower)
const DIVE_SPEED = 8.5 // holding S dives (faster)
const DRIFT_SPEED = 3.2 // forward glide speed while descending
const YAW_RATE = 1.2
const CAPSULE_HALF_LEN = 0.55 + 0.32
// The capsule body sits this high when the soldier's feet touch the ground.
const LAND_Y = 0.91
// Landings inside this radius keep the camera over the valley; any closer to
// the rim and the soldier is re-faced toward the centre so the view never
// points out past the walls into the empty void (a flat blue screen).
const SAFE_LAND_RADIUS = WORLD_EDGE - 30
// The parachute's harness point (model-local y=0) is placed at the soldier's
// chest, so the canopy opens high above and the suspension lines run down to
// the hanging rider.
const HARNESS_Y = 1.35

interface ParachuteControllerProps {
  bodyRef: React.RefObject<RapierRigidBody | null>
  /** True while the player descends after bailing out of a flying vehicle. */
  active: boolean
}

/**
 * Parachute descent: mounted forever (like the other bodies, so rapier never
 * removes a physics body mid-contact). When active the player hangs under the
 * real downloaded parachute model, drifting forward and steering with A/D, and
 * glides down to the ground where they switch to walking. W flares (slower),
 * S dives (faster). Inactive, the body hides far below the world.
 */
export default function ParachuteController({
  bodyRef,
  active,
}: ParachuteControllerProps): JSX.Element {
  const { scene: chuteScene } = useGLTF(assetUrl('/models/parachute.glb'))
  const setPlayerMode = useStore((s) => s.setPlayerMode)
  const body = useRef<RapierRigidBody>(null)
  const visual = useRef<THREE.Group>(null)
  const heading = useRef(transportState.parachute.heading)
  const swingT = useRef(0)
  const activePrev = useRef(active)
  const motionRef = useRef({
    moving: false,
    running: false,
    crouching: false,
    jump: null as 'anticipate' | 'airborne' | 'land' | null,
    speed: 0,
  })

  useFrame((_, delta) => {
    const rb = body.current
    if (!rb) return
    const dt = Math.min(delta, 0.05)

    if (!active) {
      rb.setTranslation({ x: 0, y: -500, z: 0 }, true)
      rb.setLinvel({ x: 0, y: 0, z: 0 }, true)
      if (visual.current) visual.current.visible = false
      activePrev.current = false
      return
    }
    if (visual.current) visual.current.visible = true

    if (!activePrev.current) {
      rb.setTranslation(
        {
          x: transportState.parachute.x,
          y: transportState.parachute.y,
          z: transportState.parachute.z,
        },
        true,
      )
      rb.setLinvel({ x: 0, y: 0, z: 0 }, true)
      heading.current = transportState.parachute.heading
    }
    activePrev.current = true

    const pos = rb.translation()
    if (bodyRef && bodyRef.current !== rb) bodyRef.current = rb

    // Glide back inside the ground plane if a bail happened at the world edge
    // (or the canopy's drift carried the player out), so landing is always on
    // solid floor — never over the void where the walker would fall forever.
    const [cx, cz] = clampXZ(pos.x, pos.z, LAND_LIMIT)
    if (cx !== pos.x || cz !== pos.z) {
      rb.setTranslation({ x: cx, y: pos.y, z: cz }, true)
      pos.x = cx
      pos.z = cz
    }

    // A/D steer the canopy (same yaw convention as the other vehicles).
    const steer = (inputState.right ? 1 : 0) - (inputState.left ? 1 : 0)
    if (steer !== 0) {
      heading.current += -steer * YAW_RATE * dt
      heading.current = Math.atan2(Math.sin(heading.current), Math.cos(heading.current))
    }

    // Near the rim, gently steer the canopy back toward the valley centre so the
    // drift — and the follow camera behind it — always looks over the world,
    // never out past the walls where the screen fills with the empty blue void.
    // The pull ramps in over the outer ~35 units and is absolute by the landing
    // ring, so the descent view swings back inside long before touchdown.
    const radial = Math.hypot(pos.x, pos.z)
    const rimPull = THREE.MathUtils.clamp((radial - (WORLD_EDGE - 55)) / 35, 0, 1)
    if (rimPull > 0) {
      const centerAngle = Math.atan2(-pos.x, -pos.z)
      const delta = Math.atan2(
        Math.sin(centerAngle - heading.current),
        Math.cos(centerAngle - heading.current),
      )
      heading.current += delta * rimPull * (1 - Math.exp(-dt * 3))
      heading.current = Math.atan2(Math.sin(heading.current), Math.cos(heading.current))
    }

    // W flares (slower), S dives (faster), otherwise a steady descent.
    const descend = inputState.back ? DIVE_SPEED : inputState.fwd ? FLARE_SPEED : DESCENT_SPEED

    const dir = new THREE.Vector3(Math.sin(heading.current), 0, Math.cos(heading.current))
    const drift = dir.clone().multiplyScalar(DRIFT_SPEED)

    const cur = rb.linvel()
    const nvx = THREE.MathUtils.lerp(cur.x, drift.x, 1 - Math.exp(-dt * 2.5))
    const nvy = THREE.MathUtils.lerp(cur.y, -descend, 1 - Math.exp(-dt * 2.5))
    const nvz = THREE.MathUtils.lerp(cur.z, drift.z, 1 - Math.exp(-dt * 2.5))
    rb.setLinvel({ x: nvx, y: nvy, z: nvz }, true)

    // Land: touch down and hand control back to the walker. The landing spot is
    // kept inside the ground plane, and if the canopy settled near the world's
    // rim the soldier is re-faced toward the centre — so the follow camera
    // looks back over the valley instead of out past the walls into the empty
    // void, which reads as a solid blue screen on any device.
    if (pos.y <= LAND_Y) {
      const [lx, lz] = clampXZ(pos.x, pos.z, LAND_LIMIT)
      let landHeading = heading.current
      if (Math.hypot(lx, lz) > SAFE_LAND_RADIUS) {
        landHeading = Math.atan2(-lx, -lz)
      }
      rb.setTranslation({ x: lx, y: LAND_Y, z: lz }, true)
      rb.setLinvel({ x: 0, y: 0, z: 0 }, true)
      transportState.walk = {
        x: lx,
        z: lz,
        y: LAND_Y,
        heading: landHeading,
      }
      setPlayerMode('walk')
      return
    }

    // Persist pose + minimap
    minimapState.x = pos.x
    minimapState.z = pos.z
    minimapState.heading = heading.current

    // Visual: the canopy hangs above, the soldier dangles below; gentle swing.
    swingT.current += dt * 1.6
    if (visual.current) {
      visual.current.rotation.y = heading.current
      visual.current.rotation.z = Math.sin(swingT.current) * 0.05
      visual.current.rotation.x = -0.06
    }
  })

  return (
    <RigidBody
      ref={body}
      type={active ? 'dynamic' : 'fixed'}
      position={[
        transportState.parachute.x,
        transportState.parachute.y,
        transportState.parachute.z,
      ]}
      colliders={false}
      gravityScale={0}
      lockRotations
      ccd
      mass={80}
    >
      <group ref={visual}>
        {/* Soldier hanging from the harness (feet at the capsule bottom). */}
        <group position={[0, -CAPSULE_HALF_LEN - feetLocalY.current, 0]}>
          <Soldier motionRef={motionRef} />
        </group>
        {/* Canopy above, harness meeting the rider's chest. */}
        <primitive object={chuteScene} position={[0, HARNESS_Y, 0]} />
      </group>
    </RigidBody>
  )
}
