import { useEffect, useMemo, useRef, type JSX } from 'react'
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
import { hideAirplaneGlitch, PLANE_SCALE, PLANE_BASE_OFFSET } from '../utils/airplane'

const MAX_SPEED = 35
const MIN_SPEED = 8
const CRUISE_ALT = 30
const ALT_BAND = 6
const THROTTLE_RAMP = 1.8
const YAW_RATE = 1.4
const ROLL_GAIN = 0.6
const TURN_BANK = 0.45
const MAX_PITCH = 0.5
const LIFT_SMOOTH = 3
const MIN_ALT = 4

export type PlaneSlot = 'airplane' | 'airplane2'

interface PlaneConfig {
  model: string
  scale: number
  baseOffset: number
  /** Yaw applied to the model primitive so its nose faces +Z (matching the
   *  heading math where W = forward). */
  modelRotY: number
  collider: { args: [number, number, number]; y: number }
  park: TransportPose
}

/**
 * Per-slot plane tuning. airplane = the nice intro aircraft (airplane.glb),
 * airplane2 = the low-poly runway plane (plane.glb) parked at the second
 * airstrip. plane.glb's nose already faces +Z in model space (verified: tall
 * tail fin at -Z, nose at +Z), so it needs no model rotation; it is 1566 units
 * long, so it uses a tiny scale and a base offset so the wheels rest on the
 * ground (its bbox bottom is y=-216.2 at scale 1).
 */
const PLANE_CONFIGS: Record<PlaneSlot, PlaneConfig> = {
  airplane: {
    model: '/models/airplane.glb',
    scale: PLANE_SCALE,
    baseOffset: PLANE_BASE_OFFSET,
    modelRotY: Math.PI,
    collider: { args: [1.6, 1.7, 4.4], y: 2.1 },
    park: { x: -12, z: 88, y: 0, heading: -Math.PI / 2 },
  },
  airplane2: {
    model: '/models/plane.glb',
    scale: 0.005,
    baseOffset: 1.081,
    modelRotY: 0,
    collider: { args: [1.4, 1.2, 3.8], y: 1.2 },
    park: { x: -30, z: 72, y: 0, heading: Math.PI / 2 },
  },
}

interface Keys {
  throttleUp: boolean
  throttleDown: boolean
  yawLeft: boolean
  yawRight: boolean
  rollLeft: boolean
  rollRight: boolean
}

const keyMap: Record<string, keyof Keys> = {
  KeyW: 'throttleUp',
  ArrowUp: 'throttleUp',
  KeyS: 'throttleDown',
  ArrowDown: 'throttleDown',
  KeyA: 'yawLeft',
  ArrowLeft: 'yawLeft',
  KeyD: 'yawRight',
  ArrowRight: 'yawRight',
  KeyQ: 'rollLeft',
  KeyE: 'rollRight',
}

const keys: Keys = {
  throttleUp: false,
  throttleDown: false,
  yawLeft: false,
  yawRight: false,
  rollLeft: false,
  rollRight: false,
}

const clamp = (v: number, min: number, max: number) => Math.min(Math.max(v, min), max)

export default function AirplaneController({
  bodyRef,
  active,
  slot = 'airplane',
}: {
  bodyRef?: React.RefObject<RapierRigidBody | null>
  active: boolean
  slot?: PlaneSlot
}): JSX.Element {
  const cfg = PLANE_CONFIGS[slot]
  const { scene: planeScene } = useGLTF(assetUrl(cfg.model))
  useMemo(() => {
    if (slot === 'airplane') hideAirplaneGlitch(planeScene)
  }, [slot, planeScene])
  const setPlayerMode = useStore((s) => s.setPlayerMode)
  const body = useRef<RapierRigidBody>(null)
  const visual = useRef<THREE.Group>(null)
  const heading = useRef(transportState[slot].heading)
  const throttleLevel = useRef(0.5)
  const rollAngle = useRef(0)
  const activeRef = useRef(active)
  activeRef.current = active
  const activePrev = useRef(active)
  const landingT = useRef(0)

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
    const dist = Math.hypot(pose.x - cfg.park.x, pose.z - cfg.park.z)
    autopilot[slot] = {
      active: true,
      from: pose,
      to: { ...cfg.park },
      duration: clamp(3 + dist / 30, 4, 12),
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
      // Bail-out autopilot: fly the plane home while the player parachutes.
      const ap = autopilot[slot]
      if (ap.active) {
        landingT.current += dt
        const t = Math.min(landingT.current / ap.duration, 1)
        const ease = 1 - Math.pow(1 - t, 3) // fast early, flares into the spot
        const to = ap.to
        const from = ap.from
        const nx = from.x + (to.x - from.x) * ease
        const nz = from.z + (to.z - from.z) * ease
        const ny = from.y + (to.y - from.y) * ease
        rb.setTranslation({ x: nx, y: ny, z: nz }, true)
        rb.setLinvel({ x: 0, y: 0, z: 0 }, true)
        if (visual.current) {
          const turn = Math.atan2(Math.sin(to.heading - from.heading), Math.cos(to.heading - from.heading))
          visual.current.rotation.y = from.heading + turn * ease
          // Nose-down on the way in, flare level at the end.
          const pitch = t < 0.7 ? THREE.MathUtils.lerp(-0.1, 0, t / 0.7) : 0
          visual.current.rotation.x = pitch
          visual.current.rotation.z = t < 0.4 ? -turn * 0.35 * (1 - t / 0.4) : 0
        }
        if (t >= 1) {
          transportState[slot] = { ...to }
          ap.active = false
          landingT.current = 0
        }
        return
      }

      rb.setTranslation(
        { x: transportState[slot].x, y: transportState[slot].y, z: transportState[slot].z },
        true,
      )
      rb.setLinvel({ x: 0, y: 0, z: 0 }, true)
      rb.setAngvel({ x: 0, y: 0, z: 0 }, true)
      if (visual.current) {
        visual.current.rotation.y = transportState[slot].heading
        visual.current.rotation.z = 0
        visual.current.rotation.x = 0
      }
      return
    }

    if (bodyRef && bodyRef.current !== rb) {
      bodyRef.current = rb
    }

    // Re-boarding an already-parked plane: pick up the heading the player
    // chose at the moment they walked up (stored in transportState by the
    // enter handler) instead of a stale mount-time value.
    if (!activePrev.current) {
      heading.current = transportState[slot].heading
    }
    activePrev.current = true

    // Throttle
    if (keys.throttleUp) throttleLevel.current = Math.min(1, throttleLevel.current + THROTTLE_RAMP * dt)
    if (keys.throttleDown) throttleLevel.current = Math.max(0, throttleLevel.current - THROTTLE_RAMP * dt)

    const speed = MIN_SPEED + throttleLevel.current * (MAX_SPEED - MIN_SPEED)

    // Yaw
    if (keys.yawLeft) heading.current += YAW_RATE * dt
    if (keys.yawRight) heading.current -= YAW_RATE * dt
    heading.current = Math.atan2(Math.sin(heading.current), Math.cos(heading.current))

    // Roll: bank into turns and auto-level when the stick is centred, so the
    // plane stays stable without the player constantly correcting it.
    const turnBank = (keys.yawRight ? 1 : 0) - (keys.yawLeft ? 1 : 0)
    const inputRoll = (keys.rollLeft ? 1 : 0) - (keys.rollRight ? 1 : 0)
    const targetRoll = clamp(inputRoll + turnBank * TURN_BANK, -1, 1)
    rollAngle.current += (targetRoll * ROLL_GAIN - rollAngle.current) * (1 - Math.pow(2, -dt * 4))

    // Direction
    const dir = new THREE.Vector3(Math.sin(heading.current), 0, Math.cos(heading.current))
    const targetVel = dir.clone().multiplyScalar(speed)

    const cur = rb.linvel()
    const nvx = THREE.MathUtils.lerp(cur.x, targetVel.x, 1 - Math.exp(-dt * LIFT_SMOOTH))
    const nvz = THREE.MathUtils.lerp(cur.z, targetVel.z, 1 - Math.exp(-dt * LIFT_SMOOTH))

    // Gentle altitude hold
    const pos = rb.translation()
    const altError = (CRUISE_ALT + Math.sin(heading.current) * ALT_BAND) - pos.y
    const targetVy = altError * 2.5
    const finalVy = THREE.MathUtils.clamp(targetVy, -3, 10)

    rb.setLinvel({ x: nvx, y: finalVy, z: nvz }, true)

    // Enforce minimum altitude
    if (pos.y < MIN_ALT) {
      rb.setTranslation({ x: pos.x, y: MIN_ALT, z: pos.z }, true)
      rb.setLinvel({ x: nvx, y: Math.max(finalVy, 0), z: nvz }, true)
    }

    // Persist pose
    transportState[slot] = {
      x: pos.x,
      z: pos.z,
      y: pos.y,
      heading: heading.current,
    }
    minimapState.x = pos.x
    minimapState.z = pos.z
    minimapState.heading = heading.current

    // Visual banking + gentle pitch tied to climb rate (clamped so the nose
    // never dives/stalls visually).
    const visualPitch = clamp(finalVy * 0.03, -MAX_PITCH, MAX_PITCH)
    if (visual.current) {
      visual.current.rotation.y = heading.current
      visual.current.rotation.z = rollAngle.current
      visual.current.rotation.x = visualPitch
    }
  })

  return (
    <RigidBody
      ref={body}
      type={active ? 'dynamic' : 'fixed'}
      position={[transportState[slot].x, transportState[slot].y, transportState[slot].z]}
      colliders={false}
      lockRotations
      ccd
      mass={500}
    >
      <CuboidCollider args={cfg.collider.args} position={[0, cfg.collider.y, 0]} />
      {/* The model is yawed on the primitive (not the visual group) so the
          nose points +Z, because useFrame sets rotation.y/rotation.z on the
          group every frame. */}
      <group ref={visual} position={[0, cfg.baseOffset, 0]}>
        <primitive object={planeScene} scale={cfg.scale} rotation={[0, cfg.modelRotY, 0]} />
      </group>
      <BlobShadow radius={2.5} y={-2.1} />
    </RigidBody>
  )
}
