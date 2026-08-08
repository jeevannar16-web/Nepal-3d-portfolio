import { useEffect, useRef, type JSX } from 'react'
import { useFrame } from '@react-three/fiber'
import { RigidBody, CuboidCollider, type RapierRigidBody } from '@react-three/rapier'
import * as THREE from 'three'
import { useGLTF } from '@react-three/drei'
import { assetUrl } from '../utils/assetUrl'
import { useStore } from '../store/useStore'
import { transportState, type TransportPose } from '../store/transportState'
import { autopilot } from '../store/autoPilot'
import { minimapState } from '../store/minimapState'
import BlobShadow from './BlobShadow'
import Rider from './Rider'
import { clampXZ } from '../utils/bounds'

const RISE_SPEED = 9
const FALL_SPEED = 3.5
const DRIFT_SPEED = 4.5
const YAW_RATE = 1.2
const MIN_ALT = 3
const MAX_ALT = 80
// hotairballoon.glb is 68 wide × 83 tall (a blimp-sized model), which swamps
// the third-person chase frame. Scaled down so the whole envelope + gondola
// fit the FollowCamera balloon offset (see MODE_OFFSETS.balloon). A touch
// smaller than before so the rider seated in the basket reads clearly.
const BALLOON_SCALE = 0.27
// The gondola basket occupies model-local y 0..~2.8 (floor to rim), so at this
// scale a rider's hips rest just inside the basket, below the rim — the upper
// body rises above the rim while the legs stay hidden inside.
const GONDOLA_SEAT_Y = 2 * BALLOON_SCALE

interface Keys {
  up: boolean
  down: boolean
  left: boolean
  right: boolean
}

const keyMap: Record<string, keyof Keys> = {
  KeyW: 'up',
  ArrowUp: 'up',
  KeyS: 'down',
  ArrowDown: 'down',
  KeyA: 'left',
  ArrowLeft: 'left',
  KeyD: 'right',
  ArrowRight: 'right',
}

const keys: Keys = { up: false, down: false, left: false, right: false }

const clamp = (v: number, min: number, max: number) => Math.min(Math.max(v, min), max)

export default function HotAirBalloonController({
  bodyRef,
  active,
}: {
  bodyRef?: React.RefObject<RapierRigidBody | null>
  active: boolean
}): JSX.Element {
  const { scene: balloonScene } = useGLTF(assetUrl('/models/hotairballoon.glb'))
  const setPlayerMode = useStore((s) => s.setPlayerMode)
  const body = useRef<RapierRigidBody>(null)
  const visual = useRef<THREE.Group>(null)
  const heading = useRef(transportState.balloon.heading)
  const activeRef = useRef(active)
  activeRef.current = active
  const activePrev = useRef(active)
  const descendT = useRef(0)

  const exitToParachute = () => {
    const rb = body.current
    if (!rb) return
    const p = rb.translation()
    const pose: TransportPose = {
      x: p.x,
      z: p.z,
      y: p.y,
      heading: heading.current,
    }
    transportState.parachute = { ...pose }
    // The balloon lets go of its hot air and sinks to a parked altitude while
    // the player glides down, so it can be boarded again where it lands.
    autopilot.balloon = {
      active: true,
      from: pose,
      to: { x: p.x, z: p.z, y: MIN_ALT, heading: heading.current },
      duration: clamp((p.y - MIN_ALT) / 3, 3, 12),
    }
    setPlayerMode('parachute')
  }

  useEffect(() => {
    const isExit = (e: KeyboardEvent) =>
      e.key === 'z' || e.key === 'Z' || e.code === 'KeyZ' || e.key === 'Escape' || e.code === 'Escape'
    const down = (e: KeyboardEvent) => {
      if (!activeRef.current) return
      if (isExit(e)) {
        e.preventDefault()
        exitToParachute()
        return
      }
      const k = keyMap[e.code]
      if (k) {
        keys[k] = true
        e.preventDefault()
      }
    }
    const up = (e: KeyboardEvent) => {
      const k = keyMap[e.code]
      if (k) keys[k] = false
    }
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    return () => {
      window.removeEventListener('keydown', down)
      window.removeEventListener('keyup', up)
    }
  })

  useFrame((_, delta) => {
    const rb = body.current
    if (!rb) return
    const dt = Math.min(delta, 0.05)

    if (!active) {
      // Bail-out autopilot: the balloon sinks to its parked altitude while the
      // player parachutes down.
      const ap = autopilot.balloon
      if (ap.active) {
        descendT.current += dt
        const t = Math.min(descendT.current / ap.duration, 1)
        const ease = 1 - Math.pow(1 - t, 2)
        const y = ap.from.y + (ap.to.y - ap.from.y) * ease
        rb.setTranslation({ x: ap.from.x, y, z: ap.from.z }, true)
        rb.setLinvel({ x: 0, y: 0, z: 0 }, true)
        if (visual.current) {
          visual.current.rotation.y = ap.from.heading
          visual.current.rotation.z = Math.sin(t * 20) * 0.02
        }
        if (t >= 1) {
          transportState.balloon = { ...ap.to }
          ap.active = false
          descendT.current = 0
        }
        return
      }

      rb.setTranslation(
        { x: transportState.balloon.x, y: transportState.balloon.y, z: transportState.balloon.z },
        true,
      )
      rb.setLinvel({ x: 0, y: 0, z: 0 }, true)
      rb.setAngvel({ x: 0, y: 0, z: 0 }, true)
      if (visual.current) {
        visual.current.rotation.y = transportState.balloon.heading
      }
      return
    }

    if (bodyRef && bodyRef.current !== rb) {
      bodyRef.current = rb
    }

    if (!activePrev.current) {
      heading.current = transportState.balloon.heading
    }
    activePrev.current = true

    // Vertical movement
    const vy = keys.up ? RISE_SPEED : keys.down ? -FALL_SPEED : 0

    // Horizontal drift
    const dir = new THREE.Vector3(Math.sin(heading.current), 0, Math.cos(heading.current))
    const right = new THREE.Vector3(-dir.z, 0, dir.x)
    const hInput = (keys.right ? 1 : 0) - (keys.left ? 1 : 0)
    const drift = dir.clone().multiplyScalar(DRIFT_SPEED * 0.5).addScaledVector(right, hInput * DRIFT_SPEED * 0.5)

    // Yaw
    if (keys.left) heading.current += YAW_RATE * dt
    if (keys.right) heading.current -= YAW_RATE * dt
    heading.current = Math.atan2(Math.sin(heading.current), Math.cos(heading.current))

    const cur = rb.linvel()
    const nvx = THREE.MathUtils.lerp(cur.x, drift.x, 1 - Math.exp(-dt * 2))
    const nvy = THREE.MathUtils.lerp(cur.y, vy, 1 - Math.exp(-dt * 2))
    const nvz = THREE.MathUtils.lerp(cur.z, drift.z, 1 - Math.exp(-dt * 2))

    rb.setLinvel({ x: nvx, y: nvy, z: nvz }, true)

    // Clamp altitude
    const pos = rb.translation()
    const clampedY = THREE.MathUtils.clamp(pos.y, MIN_ALT, MAX_ALT)
    if (pos.y !== clampedY) {
      rb.setTranslation({ x: pos.x, y: clampedY, z: pos.z }, true)
    }

    // Keep the balloon over the valley floor: slow drift, so clamping the
    // position (and nudging the velocity back inward) gently holds it inside
    // the world instead of letting it sail over the perimeter walls.
    const [bx, bz] = clampXZ(pos.x, pos.z)
    if (bx !== pos.x || bz !== pos.z) {
      rb.setTranslation({ x: bx, y: pos.y, z: bz }, true)
      const vel = rb.linvel()
      rb.setLinvel(
        {
          x: bx !== pos.x ? -Math.sign(pos.x) * Math.min(Math.abs(vel.x), 1) : vel.x,
          y: vel.y,
          z: bz !== pos.z ? -Math.sign(pos.z) * Math.min(Math.abs(vel.z), 1) : vel.z,
        },
        true,
      )
      pos.x = bx
      pos.z = bz
    }

    // Persist pose
    transportState.balloon = {
      x: pos.x,
      z: pos.z,
      y: pos.y,
      heading: heading.current,
    }
    minimapState.x = pos.x
    minimapState.z = pos.z
    minimapState.heading = heading.current

    // Visual
    if (visual.current) {
      visual.current.rotation.y = heading.current
      // Gentle sway
      const sway = Math.sin(delta * 2 + pos.x) * 0.02
      visual.current.rotation.z = sway
    }
  })

  return (
    <RigidBody
      ref={body}
      type={active ? 'dynamic' : 'fixed'}
      position={[transportState.balloon.x, transportState.balloon.y, transportState.balloon.z]}
      colliders={false}
      lockRotations
      ccd
      mass={50}
    >
      <CuboidCollider args={[1.2, 2.5, 1.2]} position={[0, 2.5, 0]} />
      <group ref={visual} position={[0, 0, 0]}>
        <primitive object={balloonScene} scale={BALLOON_SCALE} />
        {active && <Rider seat={[0, GONDOLA_SEAT_Y, 0]} />}
      </group>
      <BlobShadow radius={1.5} y={0.01} />
    </RigidBody>
  )
}
