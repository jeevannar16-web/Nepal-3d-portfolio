import { useRef, useEffect, type JSX } from 'react'
import { useFrame } from '@react-three/fiber'
import { useGLTF } from '@react-three/drei'
import { RigidBody, CuboidCollider, type RapierRigidBody } from '@react-three/rapier'
import * as THREE from 'three'
import { minimapState } from '../store/minimapState'
import { driveState } from '../store/driveState'
import { useStore } from '../store/useStore'
import { glowTexture } from '../utils/textures'
import BlobShadow from './BlobShadow'

// ---- Driving feel (tune these by feel, no physics hunting needed) ----
export const MAX_SPEED = 15 // top forward speed in units/second
export const REVERSE_MAX_SPEED = 6.5 // top reverse speed in units/second
const ACCEL_RAMP_TIME = 0.5 // seconds to reach full throttle from rest
const THROTTLE_DECAY = 0.15 // throttle let-off speed (fraction of ACCEL_RAMP_TIME)
const THROTTLE_FORCE = 46 // forward force at full throttle
const REVERSE_FORCE = 20 // reverse force
const BRAKE_DECEL = 30 // opposing force while braking against forward motion
const DAMPING_COAST = 0.99 // per-frame drag while coasting (@60fps)
const DAMPING_BRAKE = 0.962 // per-frame drag while braking (@60fps)
const BASE_TURN_RATE = 2.6 // turn rate (rad/s) at standstill
const STEER_TORQUE = 10 // how quickly yaw rate builds toward its target
const STEER_DAMPING = 0.92 // per-frame decay of yaw rate after release (@60fps)
const STEER_SPEED_FALLOFF = 0.6 // fraction of turn rate lost at top speed
export const KMH_FACTOR = 8 // world units/sec -> km/h (MAX_SPEED = 120 km/h)

interface Keys {
  forward: boolean
  backward: boolean
  left: boolean
  right: boolean
}

interface PlayerProps {
  bodyRef?: React.RefObject<RapierRigidBody | null>
}

const keyMap: Record<string, keyof Keys> = {
  KeyW: 'forward',
  ArrowUp: 'forward',
  KeyS: 'backward',
  ArrowDown: 'backward',
  KeyA: 'left',
  ArrowLeft: 'left',
  KeyD: 'right',
  ArrowRight: 'right',
}

const keys: Keys = { forward: false, backward: false, left: false, right: false }

// car.glb placement. The model's origin sits off the body's center (world bbox
// min[-134.64,0.04,-271.77] max[95.56,117.59,217.67]), so it is recentered in
// x/z at scale CAR_SCALE to sit on the rigid-body pivot like the old car did.
const CAR_SCALE = 0.005
const CAR_CENTER_X = ((-134.64 + 95.56) / 2) * CAR_SCALE // recenter to origin
const CAR_CENTER_Z = ((-271.77 + 217.67) / 2) * CAR_SCALE
// Wheel bboxes: x is the thin axle axis (~30 wide vs ~69 tall/deep) and each
// wheel mesh is offset from its node's origin, so wheels are reparented into a
// pivot placed at the wheel's geometry center (see setupWheelPivots).
const WHEEL_RADIUS = 0.345
const WHEEL_NAMES = [
  'Lamborghini_Aventador_Wheel_FL',
  'Lamborghini_Aventador_Wheel_FR',
  'Lamborghini_Aventador_Wheel_RL',
  'Lamborghini_Aventador_Wheel_RR',
]

export default function Player({ bodyRef }: PlayerProps): JSX.Element {
  const { scene: carScene } = useGLTF('/models/car.glb')
  const body = useRef<RapierRigidBody>(null)
  const heading = useRef(0)
  const visual = useRef<THREE.Group>(null)
  const wheels = useRef<Array<THREE.Group | null>>([])
  const roll = useRef(0)
  const throttleTime = useRef(0)
  const yawVel = useRef(0)
  const introDone = useStore((s) => s.introDone)
  const timeOfDay = useStore((s) => s.timeOfDay)
  const lightsOn = timeOfDay === 'dusk' || timeOfDay === 'night'

  useEffect(() => {
    // Reparent each wheel mesh into a pivot placed at its geometry center so
    // rotation.x spins the wheel around its own axle (the raw nodes' origins
    // are far from the wheel centers, so rotating them directly would orbit
    // the wheel around the car's origin). Idempotent across remounts.
    WHEEL_NAMES.forEach((name, i) => {
      const wheel = carScene.getObjectByName(name)
      if (!wheel) return
      let pivot = wheel.userData.spinPivot as THREE.Group | undefined
      if (!pivot) {
        const geometry = (wheel as THREE.Mesh).geometry
        geometry.computeBoundingBox()
        const center = geometry.boundingBox
          ? geometry.boundingBox.getCenter(new THREE.Vector3())
          : new THREE.Vector3()
        pivot = new THREE.Group()
        pivot.position.copy(center)
        wheel.parent!.add(pivot)
        pivot.attach(wheel)
        wheel.userData.spinPivot = pivot
      }
      wheels.current[i] = pivot
    })
  }, [carScene])

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
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
  }, [])

  useFrame((_, delta) => {
    const rb = body.current
    if (!rb) return

    if (bodyRef && bodyRef.current !== rb) {
      bodyRef.current = rb
    }

    const pos = rb.translation()
    minimapState.x = pos.x
    minimapState.z = pos.z
    minimapState.heading = heading.current

    if (pos.y < -10) {
      rb.setTranslation({ x: 0, y: 0.5, z: 0 }, true)
      rb.setLinvel({ x: 0, y: 0, z: 0 }, true)
      heading.current = 0
      yawVel.current = 0
      return
    }

    if (!introDone) return

    const lin = rb.linvel()

    // Continuous steering: yaw is an angular velocity that builds toward a
    // target turn rate (torque feel) instead of an instant rotation snap, and
    // settles smoothly via angular damping once the key is released.
    const speed = Math.hypot(lin.x, lin.z)
    const speedNorm = Math.min(speed / MAX_SPEED, 1)
    const dir = new THREE.Vector3(
      Math.sin(heading.current),
      0,
      Math.cos(heading.current),
    )
    const signedSpeed = dir.x * lin.x + dir.z * lin.z
    const isReversing = signedSpeed < -0.5
    // Reversing steers inverted, like a real car.
    const steerInput = (keys.left ? 1 : 0) - (keys.right ? 1 : 0)
    const effectiveSteer = isReversing ? -steerInput : steerInput
    if (effectiveSteer !== 0) {
      // Speed-dependent target: tight turns at low speed, wide sweeps at speed.
      const turnRate = BASE_TURN_RATE * (1 - STEER_SPEED_FALLOFF * speedNorm)
      const response = 1 - Math.pow(2, -delta * STEER_TORQUE)
      yawVel.current += (effectiveSteer * turnRate - yawVel.current) * response
    } else {
      // Angular damping: decay yaw rate so the car settles, doesn't spin on.
      yawVel.current *= Math.pow(STEER_DAMPING, delta * 60)
    }
    heading.current += yawVel.current * delta

    // Throttle ramp — smoothstep over the first ACCEL_RAMP_TIME: slow launch,
    // strong mid-range pull, and quick (but not instant) let-off on release.
    if (keys.forward && !keys.backward) {
      throttleTime.current = Math.min(throttleTime.current + delta, ACCEL_RAMP_TIME)
    } else {
      throttleTime.current = Math.max(
        throttleTime.current - delta * (ACCEL_RAMP_TIME / THROTTLE_DECAY),
        0,
      )
    }
    const t = throttleTime.current / ACCEL_RAMP_TIME
    const throttle = t * t * (3 - 2 * t)

    const braking = keys.backward
    let damping = braking ? DAMPING_BRAKE : DAMPING_COAST
    let applied = 0

    if (keys.forward && !braking) {
      // Force fades toward zero as we approach MAX_SPEED, so top speed is
      // reached asymptotically — it climbs gradually instead of snapping.
      applied = THROTTLE_FORCE * throttle * Math.max(0, 1 - speedNorm)
    } else if (braking) {
      if (signedSpeed > 0.5) {
        // Braking against forward motion: hard opposing bite, then smooth
        // linear damping continues the deceleration.
        applied = -BRAKE_DECEL
      } else {
        // Reversing: gentler force, same falloff as forward.
        applied = -REVERSE_FORCE * Math.max(0, 1 - speedNorm)
      }
    }

    if (applied !== 0) {
      rb.applyImpulse(
        { x: dir.x * applied * delta, y: 0, z: dir.z * applied * delta },
        true,
      )
    }

    // Frame-rate independent linear damping; coasts smoothly on release.
    const vel = rb.linvel()
    const damp = Math.pow(damping, delta * 60)
    vel.x *= damp
    vel.z *= damp
    const mag = Math.hypot(vel.x, vel.z)
    const topSpeed = isReversing ? REVERSE_MAX_SPEED : MAX_SPEED
    if (mag > topSpeed) {
      const s = topSpeed / mag
      vel.x *= s
      vel.z *= s
    }
    rb.setLinvel({ x: vel.x, y: vel.y, z: vel.z }, true)

    driveState.speedKmh = Math.hypot(vel.x, vel.z) * KMH_FACTOR
    driveState.reverse = isReversing

    if (visual.current) {
      visual.current.rotation.y = heading.current

      const wheelSpin = (delta * mag) / WHEEL_RADIUS
      for (const w of wheels.current) {
        if (w) w.rotation.x -= wheelSpin
      }

      // Body lean scales with actual yaw rate, so it eases in and out with the
      // turn instead of snapping on/off with the key state.
      const targetRoll = -yawVel.current * 0.08
      roll.current += (targetRoll - roll.current) * 0.15
      visual.current.rotation.z = roll.current
    }
  })

  return (
    <RigidBody
      ref={body}
      position={[0, 0.5, 0]}
      colliders={false}
      lockRotations
      ccd
    >
      <CuboidCollider args={[0.5, 0.5, 0.5]} />
      <group ref={visual}>
        {/* Real low-poly car model (car.glb). Nose faces +Z to match the
            heading math; recentered on the physics pivot. Wheels are reparented
            into spin pivots by the effect above. */}
        <primitive
          object={carScene}
          scale={CAR_SCALE}
          position={[CAR_CENTER_X, -0.5, CAR_CENTER_Z]}
        />
        {/* Headlight glow pools on the ground + soft fill light at dusk/night */}
        {lightsOn && (
          <>
            {[-0.45, 0.45].map((x) => (
              <mesh key={`beam-${x}`} position={[x, -0.42, 1.3]} rotation={[-Math.PI / 2, 0, 0]}>
                {/* Small focused pool right in front of the car, kept below the
                    bloom threshold so it reads as light on the ground — not a
                    giant diffuse blob that swallows the scenery. */}
                <planeGeometry args={[1.1, 2.0]} />
                <meshBasicMaterial
                  map={glowTexture()}
                  color="#ffedbe"
                  transparent
                  opacity={0.35}
                  blending={THREE.AdditiveBlending}
                  depthWrite={false}
                />
              </mesh>
            ))}
            <pointLight
              position={[0, 0.05, 1.2]}
              color="#ffe3a0"
              intensity={2.2}
              distance={8}
              decay={2}
            />
          </>
        )}
      </group>
      <BlobShadow radius={1.3} y={-0.49} />
    </RigidBody>
  )
}
