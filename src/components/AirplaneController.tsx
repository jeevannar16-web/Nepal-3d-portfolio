import { useEffect, useMemo, useRef, type JSX } from 'react'
import { useFrame } from '@react-three/fiber'
import { RigidBody, CuboidCollider, type RapierRigidBody } from '@react-three/rapier'
import * as THREE from 'three'
import { useGLTF } from '@react-three/drei'
import { assetUrl } from '../utils/assetUrl'
import { useStore } from '../store/useStore'
import { transportState } from '../store/transportState'
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
const LIFT_SMOOTH = 3
const MIN_ALT = 4

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

export default function AirplaneController({
  bodyRef,
  active,
}: {
  bodyRef?: React.RefObject<RapierRigidBody | null>
  active: boolean
}): JSX.Element {
  const { scene: planeScene } = useGLTF(assetUrl('/models/airplane.glb'))
  useMemo(() => hideAirplaneGlitch(planeScene), [planeScene])
  const setPlayerMode = useStore((s) => s.setPlayerMode)
  const body = useRef<RapierRigidBody>(null)
  const visual = useRef<THREE.Group>(null)
  const heading = useRef(transportState.airplane.heading)
  const throttleLevel = useRef(0.5)
  const rollAngle = useRef(0)
  const activeRef = useRef(active)
  activeRef.current = active

  useEffect(() => {
    const isExit = (e: KeyboardEvent) =>
      e.key === 'z' || e.key === 'Z' || e.code === 'KeyZ' || e.key === 'Escape' || e.code === 'Escape'
    const down = (e: KeyboardEvent) => {
      if (!activeRef.current) return
      if (isExit(e)) {
        const rb = body.current
        if (!rb) return
        const p = rb.translation()
        transportState.walk = {
          x: p.x + 3,
          z: p.z + 3,
          y: 0.91,
          heading: heading.current + Math.PI,
        }
        setPlayerMode('walk')
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
  }, [setPlayerMode])

  useFrame((_, delta) => {
    const rb = body.current
    if (!rb) return

    if (!active) {
      rb.setTranslation(
        { x: transportState.airplane.x, y: transportState.airplane.y, z: transportState.airplane.z },
        true,
      )
      rb.setLinvel({ x: 0, y: 0, z: 0 }, true)
      rb.setAngvel({ x: 0, y: 0, z: 0 }, true)
      if (visual.current) {
        visual.current.rotation.y = transportState.airplane.heading
        visual.current.rotation.z = 0
      }
      return
    }

    if (bodyRef && bodyRef.current !== rb) {
      bodyRef.current = rb
    }

    const dt = Math.min(delta, 0.05)

    // Throttle
    if (keys.throttleUp) throttleLevel.current = Math.min(1, throttleLevel.current + THROTTLE_RAMP * dt)
    if (keys.throttleDown) throttleLevel.current = Math.max(0, throttleLevel.current - THROTTLE_RAMP * dt)

    const speed = MIN_SPEED + throttleLevel.current * (MAX_SPEED - MIN_SPEED)

    // Yaw
    if (keys.yawLeft) heading.current += YAW_RATE * dt
    if (keys.yawRight) heading.current -= YAW_RATE * dt
    heading.current = Math.atan2(Math.sin(heading.current), Math.cos(heading.current))

    // Roll
    const targetRoll = (keys.rollLeft ? 1 : 0) - (keys.rollRight ? 1 : 0)
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
    transportState.airplane = {
      x: pos.x,
      z: pos.z,
      y: pos.y,
      heading: heading.current,
    }
    minimapState.x = pos.x
    minimapState.z = pos.z
    minimapState.heading = heading.current

    // Visual banking
    if (visual.current) {
      visual.current.rotation.y = heading.current
      visual.current.rotation.z = rollAngle.current
    }
  })

  return (
    <RigidBody
      ref={body}
      type={active ? 'dynamic' : 'fixed'}
      position={[transportState.airplane.x, transportState.airplane.y, transportState.airplane.z]}
      colliders={false}
      lockRotations
      ccd
      mass={500}
    >
      <CuboidCollider args={[1.6, 1.7, 4.4]} position={[0, 2.1, 0]} />
      {/* The model's nose faces local -Z, so it is yawed 180° on the primitive
          (like ArrivalPlane) to point along +Z and match the heading math. It
          lives on the model, not the visual group, because useFrame sets
          rotation.y/rotation.z on the group every frame. */}
      <group ref={visual} position={[0, PLANE_BASE_OFFSET, 0]}>
        <primitive object={planeScene} scale={PLANE_SCALE} rotation={[0, Math.PI, 0]} />
      </group>
      <BlobShadow radius={2.5} y={-2.1} />
    </RigidBody>
  )
}
