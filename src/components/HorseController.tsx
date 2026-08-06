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
import { HorseModel } from './VehicleModels'
import BlobShadow from './BlobShadow'
import Rider from './Rider'

const MAX_SPEED = 13
const KMH_FACTOR = 8
const GALLOP_ACCEL = 18
const TURN_RATE = 1.9
const STEER_SMOOTH = 7
const STEER_DAMPING = 0.9
const LATERAL_GRIP = 0.86
const ROLLING_DECEL = 2

const clamp = (v: number, min: number, max: number) => Math.min(Math.max(v, min), max)

interface HorseControllerProps {
  bodyRef: React.RefObject<RapierRigidBody | null>
  /** When false the horse stands fixed at its saved spot. */
  active: boolean
}

/**
 * The horse: a natural ride through the valley. Hold W to gallop, A/D to steer,
 * S to slow, X to dismount. The gallop rocks the horse up and down as it runs.
 * Its body stays mounted forever, flipping between dynamic (ridden) and fixed
 * (parked), so mode switches never remove a physics body mid-contact.
 */
export default function HorseController({
  bodyRef,
  active,
}: HorseControllerProps): JSX.Element {
  const setPlayerMode = useStore((s) => s.setPlayerMode)
  const body = useRef<RapierRigidBody>(null)
  const visual = useRef<THREE.Group>(null)
  const heading = useRef(transportState.horse.heading)
  const yawVel = useRef(0)
  const bobTime = useRef(0)
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
      } else if (e.code === 'KeyZ' || e.code === 'Escape') {
        e.preventDefault()
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
      if (visual.current) {
        visual.current.position.y = 0
        visual.current.rotation.x = 0
        visual.current.rotation.y = heading.current
      }
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
      const rate = TURN_RATE * (1 - 0.5 * clamp(absSpeed / MAX_SPEED, 0, 1))
      yawVel.current += (steer * rate - yawVel.current) * (1 - Math.exp(-dt * STEER_SMOOTH))
    } else {
      yawVel.current *= Math.pow(STEER_DAMPING, dt * 60)
    }
    heading.current += yawVel.current * dt

    let applied = 0
    if (keys.current.fwd) applied = GALLOP_ACCEL
    else if (keys.current.back) applied = -ROLLING_DECEL * 2.5
    applied -= Math.sign(fwdVel) * ROLLING_DECEL

    const newFwd = clamp(fwdVel + applied * dt, 0, MAX_SPEED)
    const newLat = (right.x * lin.x + right.z * lin.z) * Math.pow(LATERAL_GRIP, dt * 60)
    const nx = dir.x * newFwd + right.x * newLat
    const nz = dir.z * newFwd + right.z * newLat
    rb.setLinvel({ x: nx, y: lin.y, z: nz }, true)
    speed.current = newFwd

    transportState.horse = {
      x: pos.x,
      z: pos.z,
      y: pos.y,
      heading: heading.current,
    }
    minimapState.x = pos.x
    minimapState.z = pos.z
    minimapState.heading = heading.current
    driveState.speedKmh = absSpeed * KMH_FACTOR
    driveState.reverse = false
    driveState.engineState = 'off'
    driveState.gear = 'OFF'
    driveState.rpm = 0
    driveState.throttle = 0

    if (visual.current) {
      visual.current.rotation.y = heading.current
      // Enhanced horse gait: speed-based phases, body sway, head bob
      if (newFwd > 0.5) {
        const speedRatio = Math.min(newFwd / MAX_SPEED, 1)
        // Vertical bob with speed-dependent frequency/amplitude
        const baseFreq = 2.5 + newFwd * 0.8 // faster at higher speeds
        const amplitude = 0.12 + speedRatio * 0.1 // more bounce at speed
        bobTime.current += dt * baseFreq
        visual.current.position.y = Math.abs(Math.sin(bobTime.current)) * amplitude
        // dynamic neck pitch based on acceleration/deceleration
        const targetPitch = newFwd > 2.0 ? -0.15 : newFwd > 0.5 ? -0.08 : 0
        visual.current.rotation.x = THREE.MathUtils.lerp(visual.current.rotation.x, targetPitch, 0.2)
        // body sway (side-to-side) with speed-dependent frequency and amplitude
        const swayFreq = 3.0 + newFwd * 0.5 // sway faster at speed
        const swayAmp = 0.05 + speedRatio * 0.08 // more sway at speed
        visual.current.position.x = Math.sin(bobTime.current * swayFreq + Math.PI / 4) * swayAmp
        // head bob with independent timing offset for realism
        const headBobFreq = 3.5 + newFwd * 0.7
        const headBobAmp = 0.06 + speedRatio * 0.07
        visual.current.position.y += Math.abs(Math.sin(bobTime.current * headBobFreq + Math.PI / 2)) * headBobAmp * 0.6
        // realistic gaits based on speed for UI/debugging
        let gaitState = 'standing'
        if (newFwd < 1.0) gaitState = 'walk'
        else if (newFwd < 3.0) gaitState = 'trot'
        else if (newFwd < 6.0) gaitState = 'canter'
        else gaitState = 'gallop'
        visual.current.userData.gait = gaitState
      } else {
        visual.current.position.y = 0
        visual.current.rotation.x = THREE.MathUtils.lerp(visual.current.rotation.x, 0, 0.2)
        visual.current.position.x = 0
        visual.current.userData.gait = 'standing'
      }
      ;(window as any).__horse = {
        speed: speed.current,
        yawVel: yawVel.current,
        bobTime: bobTime.current,
        gait: visual.current.userData.gait,
      }
    }
  })

  return (
    <RigidBody
      ref={body}
      type={active ? 'dynamic' : 'fixed'}
      position={[transportState.horse.x, transportState.horse.y, transportState.horse.z]}
      rotation={[0, transportState.horse.heading, 0]}
      colliders={false}
      lockRotations
      ccd
    >
      <CuboidCollider args={[0.55, 0.8, 1.05]} friction={0.3} />
      <group ref={visual}>
        <HorseModel />
        {active && <Rider seat={[0, 1.05, 0]} lean={0.2} />}
        <BlobShadow radius={1.2} y={0.01} />
      </group>
    </RigidBody>
  )
}
