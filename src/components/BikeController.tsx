import { useEffect, useRef, type JSX } from 'react'
import { useFrame } from '@react-three/fiber'
import {
  RigidBody,
  CuboidCollider,
  type RapierRigidBody,
} from '@react-three/rapier'
import * as THREE from 'three'
import { minimapState } from '../store/minimapState'
import { driveState } from '../store/driveState'
import { useStore } from '../store/useStore'
import { transportState } from '../store/transportState'
import { BikeModel } from './VehicleModels'
import BlobShadow from './BlobShadow'

const MAX_SPEED = 20
const REVERSE_MAX_SPEED = 5
const KMH_FACTOR = 8

const THROTTLE_ACCEL = 26
const BRAKE_DECEL = 30
const REVERSE_ACCEL = 12
const ROLLING_DECEL = 1.6
const LATERAL_GRIP = 0.88
const TURN_RATE = 3.2
const STEER_SMOOTH = 9
const STEER_DAMPING = 0.9
const SPEED_FALLOFF = 0.55

const clamp = (v: number, min: number, max: number) => Math.min(Math.max(v, min), max)

interface BikeControllerProps {
  bodyRef: React.RefObject<RapierRigidBody | null>
  /** When false the motorcycle sits fixed at its saved spot. */
  active: boolean
}

/**
 * The motorcycle: a lighter, nimbler ride than the car. W/S throttle and
 * brake (S reverses when stopped), A/D lean into turns, F gets off and walks.
 * Leans into corners and sounds like a revving engine via EngineSound. The
 * body stays mounted forever and only flips between dynamic (driven) and fixed
 * (parked), so mode switches never remove a physics body mid-contact.
 */
export default function BikeController({
  bodyRef,
  active,
}: BikeControllerProps): JSX.Element {
  const setPlayerMode = useStore((s) => s.setPlayerMode)
  const body = useRef<RapierRigidBody>(null)
  const visual = useRef<THREE.Group>(null)
  const heading = useRef(transportState.bike.heading)
  const yawVel = useRef(0)
  const lean = useRef(0)
  const speed = useRef(0)
  const keys = useRef({ fwd: false, back: false, left: false, right: false })
  const activeRef = useRef(active)
  activeRef.current = active

  const exit = () => {
    const rb = body.current
    if (!rb) return
    const pos = rb.translation()
    const rightX = Math.cos(heading.current)
    const rightZ = -Math.sin(heading.current)
    transportState.walk = {
      x: pos.x + rightX * 2.2,
      z: pos.z + rightZ * 2.2,
      y: 0.87,
      heading: heading.current,
    }
    setPlayerMode('walk')
  }

  useEffect(() => {
    const keyMap: Record<string, 'fwd' | 'back' | 'left' | 'right'> = {
      KeyW: 'fwd',
      ArrowUp: 'fwd',
      KeyS: 'back',
      ArrowDown: 'back',
      KeyA: 'left',
      ArrowLeft: 'left',
      KeyD: 'right',
      ArrowRight: 'right',
    }
    const down = (e: KeyboardEvent) => {
      if (!activeRef.current) return
      const k = keyMap[e.code]
      if (k) {
        keys.current[k] = true
        e.preventDefault()
      } else if (e.code === 'KeyF') {
        exit()
      }
    }
    const up = (e: KeyboardEvent) => {
      const k = keyMap[e.code]
      if (k) keys.current[k] = false
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
      if (visual.current) visual.current.rotation.y = heading.current
      return
    }

    const pos = rb.translation()
    if (bodyRef && bodyRef.current !== rb) bodyRef.current = rb
    if (pos.y < -10) {
      rb.setTranslation({ x: 0, y: 0.5, z: 0 }, true)
      rb.setLinvel({ x: 0, y: 0, z: 0 }, true)
      heading.current = 0
      yawVel.current = 0
      return
    }

    const dir = new THREE.Vector3(
      Math.sin(heading.current),
      0,
      Math.cos(heading.current),
    )
    const right = new THREE.Vector3(-dir.z, 0, dir.x)
    const lin = rb.linvel()
    const fwdVel = dir.x * lin.x + dir.z * lin.z
    const absSpeed = Math.abs(fwdVel)

    const steer = (keys.current.left ? 1 : 0) - (keys.current.right ? 1 : 0)
    if (steer !== 0) {
      const rate = TURN_RATE * (1 - SPEED_FALLOFF * clamp(absSpeed / MAX_SPEED, 0, 1))
      yawVel.current += (steer * rate - yawVel.current) * (1 - Math.exp(-dt * STEER_SMOOTH))
    } else {
      yawVel.current *= Math.pow(STEER_DAMPING, dt * 60)
    }
    heading.current += yawVel.current * dt

    let applied = 0
    if (keys.current.fwd) applied = THROTTLE_ACCEL
    else if (keys.current.back) {
      if (fwdVel > 0.3) applied = -BRAKE_DECEL
      else applied = -REVERSE_ACCEL
    }
    applied -= Math.sign(fwdVel) * ROLLING_DECEL
    if (Math.abs(applied) < 0.01 && Math.abs(fwdVel) < 0.05) applied = 0

    const newFwd = clamp(fwdVel + applied * dt, -REVERSE_MAX_SPEED, MAX_SPEED)
    const newLat = (right.x * lin.x + right.z * lin.z) * Math.pow(LATERAL_GRIP, dt * 60)
    const nx = dir.x * newFwd + right.x * newLat
    const nz = dir.z * newFwd + right.z * newLat
    rb.setLinvel({ x: nx, y: lin.y, z: nz }, true)
    speed.current = newFwd

    // Persist pose + publish telemetry for the HUD + engine sound.
    transportState.bike = {
      x: pos.x,
      z: pos.z,
      y: pos.y,
      heading: heading.current,
    }
    minimapState.x = pos.x
    minimapState.z = pos.z
    minimapState.heading = heading.current
    driveState.speedKmh = Math.abs(newFwd) * KMH_FACTOR
    driveState.reverse = newFwd < -0.1
    driveState.engineState = 'on'
    driveState.gear = '1'
    driveState.rpm = Math.round(1200 + (absSpeed / MAX_SPEED) * 4800)
    driveState.throttle = keys.current.fwd ? 1 : 0

    if (visual.current) {
      visual.current.rotation.y = heading.current
      const targetLean = -yawVel.current * 0.5
      lean.current += (targetLean - lean.current) * (1 - Math.exp(-dt * 8))
      visual.current.rotation.z = lean.current
    }
  })

  return (
    <RigidBody
      ref={body}
      type={active ? 'dynamic' : 'fixed'}
      position={[transportState.bike.x, transportState.bike.y, transportState.bike.z]}
      rotation={[0, transportState.bike.heading, 0]}
      colliders={false}
      lockRotations
      ccd
    >
      <CuboidCollider args={[0.42, 0.6, 1.05]} friction={0.3} />
      <group ref={visual}>
        <BikeModel />
        <BlobShadow radius={1} y={0.01} />
      </group>
    </RigidBody>
  )
}
