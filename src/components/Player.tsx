import { useRef, useEffect, type JSX } from 'react'
import { useFrame } from '@react-three/fiber'
import { RigidBody, CuboidCollider, type RapierRigidBody } from '@react-three/rapier'
import * as THREE from 'three'
import { minimapState } from '../store/minimapState'
import { useStore } from '../store/useStore'
import { matcapTexture } from '../utils/textures'
import BlobShadow from './BlobShadow'

// ---- Driving feel (tune these by feel, no physics hunting needed) ----
export const MAX_SPEED = 15 // top speed in units/second
const ACCEL_RAMP_TIME = 0.5 // seconds to reach full throttle from rest
const THROTTLE_DECAY = 0.15 // throttle let-off speed (fraction of ACCEL_RAMP_TIME)
const THROTTLE_FORCE = 46 // forward force at full throttle
const REVERSE_FORCE = 24 // reverse force
const BRAKE_FORCE = 28 // opposing force while braking
const DAMPING_COAST = 0.99 // per-frame drag while coasting (@60fps)
const DAMPING_BRAKE = 0.962 // per-frame drag while braking/reversing (@60fps)
const BASE_TURN_RATE = 2.6 // turn rate (rad/s) at standstill
const STEER_FALLOFF = 0.55 // fraction of turn rate lost at max speed

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
  const introDone = useStore((s) => s.introDone)

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
      return
    }

    if (!introDone) return

    const lin = rb.linvel()

    // Speed-based steering: sharp at low speed, wide sweeping at high speed.
    const speed = Math.hypot(lin.x, lin.z)
    const speedNorm = Math.min(speed / MAX_SPEED, 1)
    const turnRate = BASE_TURN_RATE * (1 - STEER_FALLOFF * speedNorm)
    const turn = delta * turnRate
    if (keys.left) heading.current += turn
    if (keys.right) heading.current -= turn

    const dir = new THREE.Vector3(
      Math.sin(heading.current),
      0,
      Math.cos(heading.current),
    )
    const signedSpeed = dir.x * lin.x + dir.z * lin.z

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
        applied = -BRAKE_FORCE
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
    if (mag > MAX_SPEED) {
      const s = MAX_SPEED / mag
      vel.x *= s
      vel.z *= s
    }
    rb.setLinvel({ x: vel.x, y: vel.y, z: vel.z }, true)

    if (visual.current) {
      visual.current.rotation.y = heading.current

      const wheelSpin = delta * mag * 1.8
      for (const w of wheels.current) {
        if (w) w.rotation.x -= wheelSpin
      }

      const targetRoll = (keys.left ? -0.1 : 0) + (keys.right ? 0.1 : 0)
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
        <mesh position={[0, -0.06, -0.45]}>
          <boxGeometry args={[1.2, 0.42, 0.9]} />
          <meshMatcapMaterial color="#d95d39" matcap={matcapTexture()} flatShading />
        </mesh>
        <mesh position={[0, -0.16, 0.5]}>
          <boxGeometry args={[1.1, 0.32, 0.85]} />
          <meshMatcapMaterial color="#c94f2f" matcap={matcapTexture()} flatShading />
        </mesh>
        <mesh position={[0, 0.22, -0.55]}>
          <boxGeometry args={[0.95, 0.38, 0.8]} />
          <meshMatcapMaterial color="#f2e6d0" matcap={matcapTexture()} flatShading />
        </mesh>
        <mesh position={[0, 0.3, -0.1]} rotation={[-0.55, 0, 0]}>
          <boxGeometry args={[0.88, 0.3, 0.05]} />
          <meshMatcapMaterial color="#bcd8e8" matcap={matcapTexture()} flatShading />
        </mesh>
        <mesh position={[0, -0.06, -0.88]}>
          <boxGeometry args={[1.2, 0.25, 0.18]} />
          <meshMatcapMaterial color="#8a5a3b" matcap={matcapTexture()} flatShading />
        </mesh>
        {[
          [-0.42, -0.14, 0.9],
          [0.42, -0.14, 0.9],
        ].map(([x, y, z], i) => (
          <mesh key={`hl-${i}`} position={[x, y, z]}>
            <boxGeometry args={[0.18, 0.12, 0.06]} />
            <meshBasicMaterial color="#fff3c4" />
          </mesh>
        ))}
        {[
          [-0.5, -0.02, -0.9],
          [0.5, -0.02, -0.9],
        ].map(([x, y, z], i) => (
          <mesh key={`tl-${i}`} position={[x, y, z]}>
            <boxGeometry args={[0.22, 0.12, 0.06]} />
            <meshBasicMaterial color="#ff4d4d" />
          </mesh>
        ))}
        {[
          [-0.55, -0.35, 0.7],
          [0.55, -0.35, 0.7],
          [-0.55, -0.35, -0.7],
          [0.55, -0.35, -0.7],
        ].map(([x, y, z], i) => (
          <group
            key={i}
            ref={(el) => {
              wheels.current[i] = el
            }}
            position={[x, y, z]}
          >
            <mesh rotation={[0, 0, Math.PI / 2]}>
              <cylinderGeometry args={[0.18, 0.18, 0.16, 10]} />
              <meshMatcapMaterial color="#2b2b2b" matcap={matcapTexture()} flatShading />
            </mesh>
          </group>
        ))}
      </group>
      <BlobShadow radius={1.2} y={-0.49} />
    </RigidBody>
  )
}
