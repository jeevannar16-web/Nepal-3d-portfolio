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

const DESCENT_SPEED = 5.5 // steady controlled fall, not a free-fall
const FLARE_SPEED = 2.2 // holding W flares the canopy (slower)
const DIVE_SPEED = 8.5 // holding S dives (faster)
const DRIFT_SPEED = 3.2 // forward glide speed while descending
const YAW_RATE = 1.2
const CAPSULE_HALF_LEN = 0.55 + 0.32
// The capsule body sits this high when the soldier's feet touch the ground.
const LAND_Y = 0.91
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

    // A/D steer the canopy (same yaw convention as the other vehicles).
    const steer = (inputState.right ? 1 : 0) - (inputState.left ? 1 : 0)
    if (steer !== 0) {
      heading.current += -steer * YAW_RATE * dt
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

    // Land: touch down and hand control back to the walker.
    if (pos.y <= LAND_Y) {
      rb.setTranslation({ x: pos.x, y: LAND_Y, z: pos.z }, true)
      rb.setLinvel({ x: 0, y: 0, z: 0 }, true)
      transportState.walk = {
        x: pos.x,
        z: pos.z,
        y: LAND_Y,
        heading: heading.current,
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
