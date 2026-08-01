import { useRef, useEffect, type JSX } from 'react'
import { useFrame } from '@react-three/fiber'
import { RigidBody, CuboidCollider, type RapierRigidBody } from '@react-three/rapier'
import * as THREE from 'three'
import { minimapState } from '../store/minimapState'
import { driveState } from '../store/driveState'
import { useStore } from '../store/useStore'
import { matcapTexture, glossyMatcapTexture, glowTexture } from '../utils/textures'
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

export default function Player({ bodyRef }: PlayerProps): JSX.Element {
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

      const wheelSpin = delta * mag * 1.8
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
        {/* Low, wide chassis */}
        <mesh position={[0, 0.06, -0.05]}>
          <boxGeometry args={[1.6, 0.12, 2.3]} />
          <meshMatcapMaterial color="#16161c" matcap={glossyMatcapTexture()} flatShading />
        </mesh>
        {/* Main body shell — low and wide */}
        <mesh position={[0, 0.22, -0.05]}>
          <boxGeometry args={[1.52, 0.24, 2.25]} />
          <meshMatcapMaterial color="#c1121f" matcap={glossyMatcapTexture()} flatShading />
        </mesh>
        {/* Wedge nose — hood tapers down and forward */}
        <mesh position={[0, 0.34, 1.06]} rotation={[0.18, 0, 0]}>
          <boxGeometry args={[1.36, 0.2, 0.55]} />
          <meshMatcapMaterial color="#c1121f" matcap={glossyMatcapTexture()} flatShading />
        </mesh>
        {/* Front splitter/lip */}
        <mesh position={[0, 0.16, 1.28]}>
          <boxGeometry args={[1.3, 0.1, 0.3]} />
          <meshMatcapMaterial color="#16161c" matcap={glossyMatcapTexture()} flatShading />
        </mesh>
        {/* Wide rear haunches */}
        <mesh position={[0, 0.24, -0.72]}>
          <boxGeometry args={[1.62, 0.24, 0.7]} />
          <meshMatcapMaterial color="#a90f1b" matcap={glossyMatcapTexture()} flatShading />
        </mesh>
        {/* Compact rear fascia */}
        <mesh position={[0, 0.2, -1.1]}>
          <boxGeometry args={[1.5, 0.2, 0.24]} />
          <meshMatcapMaterial color="#16161c" matcap={glossyMatcapTexture()} flatShading />
        </mesh>
        {/* Low swept-back cabin */}
        <mesh position={[0, 0.46, -0.18]} rotation={[-0.22, 0, 0]}>
          <boxGeometry args={[0.92, 0.3, 0.95]} />
          <meshMatcapMaterial color="#a90f1b" matcap={glossyMatcapTexture()} flatShading />
        </mesh>
        {/* Aggressively raked windshield */}
        <mesh position={[0, 0.52, 0.2]} rotation={[-0.85, 0, 0]}>
          <boxGeometry args={[0.84, 0.26, 0.03]} />
          <meshMatcapMaterial color="#101820" matcap={glossyMatcapTexture()} flatShading />
        </mesh>
        {/* Raked rear glass */}
        <mesh position={[0, 0.52, -0.5]} rotation={[0.35, 0, 0]}>
          <boxGeometry args={[0.84, 0.2, 0.03]} />
          <meshMatcapMaterial color="#101820" matcap={glossyMatcapTexture()} flatShading />
        </mesh>
        {/* Rear spoiler with supports */}
        {[
          [-0.58, 0.42, -1.0],
          [0.58, 0.42, -1.0],
        ].map(([x, y, z], i) => (
          <mesh key={`sp-${i}`} position={[x, y, z]}>
            <boxGeometry args={[0.06, 0.14, 0.05]} />
            <meshMatcapMaterial color="#16161c" matcap={glossyMatcapTexture()} flatShading />
          </mesh>
        ))}
        <mesh position={[0, 0.58, -1.0]} rotation={[0.18, 0, 0]}>
          <boxGeometry args={[1.3, 0.05, 0.3]} />
          <meshMatcapMaterial color="#c1121f" matcap={glossyMatcapTexture()} flatShading />
        </mesh>
        {/* Slim angular headlight slits */}
        {[
          [-0.48, 0.34, 1.28, 0.35],
          [0.48, 0.34, 1.28, -0.35],
        ].map(([x, y, z, ry], i) => (
          <mesh key={`hl-${i}`} position={[x, y, z]} rotation={[0, ry, 0]}>
            <boxGeometry args={[0.42, 0.05, 0.03]} />
            <meshBasicMaterial color="#fff8d8" />
          </mesh>
        ))}
        {/* Slim angular taillight slits */}
        {[
          [-0.56, 0.3, -1.08, -0.2],
          [0.56, 0.3, -1.08, 0.2],
        ].map(([x, y, z, ry], i) => (
          <mesh key={`tl-${i}`} position={[x, y, z]} rotation={[0, ry, 0]}>
            <boxGeometry args={[0.5, 0.05, 0.03]} />
            <meshBasicMaterial color="#ff2a2a" />
          </mesh>
        ))}
        {/* Headlight glow pools on the ground + soft fill light at dusk/night */}
        {lightsOn && (
          <>
            {[-0.42, 0.42].map((x) => (
              <mesh key={`beam-${x}`} position={[x, -0.42, 1.8]} rotation={[-Math.PI / 2, 0, 0]}>
                <planeGeometry args={[1.5, 2.6]} />
                <meshBasicMaterial
                  map={glowTexture()}
                  color="#ffe9a8"
                  transparent
                  opacity={0.6}
                  blending={THREE.AdditiveBlending}
                  depthWrite={false}
                />
              </mesh>
            ))}
            <pointLight
              position={[0, 0.35, 1.9]}
              color="#ffe3a0"
              intensity={6}
              distance={11}
              decay={2}
            />
          </>
        )}
        {[
          [-0.6, 0.22, 0.75],
          [0.6, 0.22, 0.75],
          [-0.6, 0.22, -0.75],
          [0.6, 0.22, -0.75],
        ].map(([x, y, z], i) => (
          <group
            key={i}
            ref={(el) => {
              wheels.current[i] = el
            }}
            position={[x, y, z]}
          >
            <mesh rotation={[0, 0, Math.PI / 2]}>
              <cylinderGeometry args={[0.22, 0.22, 0.18, 10]} />
              <meshMatcapMaterial color="#15151a" matcap={matcapTexture()} flatShading />
            </mesh>
            <mesh rotation={[0, 0, Math.PI / 2]}>
              <cylinderGeometry args={[0.1, 0.1, 0.19, 8]} />
              <meshMatcapMaterial color="#8a8a92" matcap={matcapTexture()} flatShading />
            </mesh>
          </group>
        ))}
      </group>
      <BlobShadow radius={1.3} y={-0.49} />
    </RigidBody>
  )
}
