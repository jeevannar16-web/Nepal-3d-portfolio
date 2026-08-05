import { useRef, useEffect, type JSX } from 'react'
import { useFrame } from '@react-three/fiber'
import { useGLTF } from '@react-three/drei'
import { RigidBody, CuboidCollider, type RapierRigidBody } from '@react-three/rapier'
import * as THREE from 'three'
import { minimapState } from '../store/minimapState'
import { driveState, type EngineState, type GearLabel } from '../store/driveState'
import { useStore } from '../store/useStore'
import { transportState } from '../store/transportState'
import { glowTexture } from '../utils/textures'
import { assetUrl } from '../utils/assetUrl'
import BlobShadow from './BlobShadow'

// ---- Real-car powertrain (engine, gearbox, torque — not arcade force) ----
export const MAX_SPEED = 24 // top forward speed in units/second
export const REVERSE_MAX_SPEED = 6 // top reverse speed in units/second
export const KMH_FACTOR = 8 // world units/sec -> km/h (MAX_SPEED = 192 km/h)

// Engine
export const IDLE_RPM = 900
export const REDLINE_RPM = 6200
const CRANK_TIME = 0.7 // seconds of cranking before the engine catches
const THROTTLE_RAMP_TIME = 0.35 // seconds to reach full throttle from rest
const THROTTLE_DECAY = 0.15 // throttle let-off speed (fraction of ramp time)

// Gearbox: automatic 4-speed in D. Each gear tops out at GEAR_TOPS[u/s];
// up/down shifts happen near those limits, redline sits at the gear top.
// Shift hysteresis (downshift point < previous gear's upshift point) stops the
// box hunting between gears at the same speed.
const GEAR_TOPS = [0, 4.5, 9.5, 16, MAX_SPEED]
const UPSHIFT_SPEED = [0, 3.8, 8.2, 14, Infinity]
const DOWNSHIFT_SPEED = [0, 0, 3.2, 7.2, 13.2]

// Forces (u/s² applied to a unit-mass body)
const THROTTLE_FORCE = 70 // peak drive force at full throttle in the power band
const REVERSE_FORCE = 20 // reverse drive force
const BRAKE_DECEL = 34 // brake force opposing current motion
const ENGINE_BRAKE = 3.5 // engine braking when coasting in gear
const ROLLING_DECEL = 1.4 // rolling resistance
const AERO_DRAG = 0.02 // aerodynamic drag (v²)
const MIN_FORCE_FRAC = 0.22 // force floor near gear top, so the final gear can
// actually reach top speed instead of fizzling out against drag
const LATERAL_GRIP = 0.86 // per-frame@60fps decay of sideways slip (planted feel)

// Steering
const BASE_TURN_RATE = 2.4 // turn rate (rad/s) at standstill
const STEER_TORQUE = 9 // how quickly yaw rate builds toward its target
const STEER_DAMPING = 0.92 // per-frame decay of yaw rate after release (@60fps)
const STEER_SPEED_FALLOFF = 0.5 // fraction of turn rate lost at top speed

interface Keys {
  forward: boolean
  backward: boolean
  left: boolean
  right: boolean
}

interface PlayerProps {
  bodyRef?: React.RefObject<RapierRigidBody | null>
  /** When false the car body sits fixed and parked at its saved spot. */
  active: boolean
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

const clamp = (v: number, min: number, max: number) => Math.min(Math.max(v, min), max)

/** Torque curve over normalized rpm (0 = idle, 1 = redline): weak just off
 *  idle, peaks through the mid band, tapers toward redline. */
function torqueFactor(n: number): number {
  if (n <= 0.1) return 0.35
  if (n <= 0.45) return 0.35 + (0.65 * (n - 0.1)) / 0.35
  if (n <= 0.8) return 1.0
  return 1.0 - (0.35 * (n - 0.8)) / 0.2
}

export default function Player({ bodyRef, active }: PlayerProps): JSX.Element {
  const { scene: carScene } = useGLTF(assetUrl('/models/car.glb'))
  const setPlayerMode = useStore((s) => s.setPlayerMode)
  const body = useRef<RapierRigidBody>(null)
  const heading = useRef(transportState.car.heading)
  const activeRef = useRef(active)
  activeRef.current = active
  const visual = useRef<THREE.Group>(null)
  const wheels = useRef<Array<THREE.Group | null>>([])
  const roll = useRef(0)
  const yawVel = useRef(0)
  const throttleTime = useRef(0)
  const engineState = useRef<EngineState>('off')
  const crank = useRef(0)
  const gear = useRef<'D' | 'R'>('D')
  const autoGear = useRef(1)
  const rpmSmooth = useRef(0)
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
      if (!activeRef.current) return
      const k = keyMap[e.code]
      if (k) {
        keys[k] = true
        e.preventDefault()
        return
      }
      if (e.code === 'KeyG') {
        // Ignition: off -> starting -> on; a second press cuts the engine.
        if (!useStore.getState().introDone) return
        if (engineState.current === 'off') {
          engineState.current = 'starting'
          crank.current = 0
        } else {
          engineState.current = 'off'
        }
      } else if (e.code === 'KeyR') {
        // Gear selector D/R, only while (nearly) stopped like a real automatic.
        if (!useStore.getState().introDone) return
        const lin = body.current?.linvel()
        const speed = lin ? Math.hypot(lin.x, lin.z) : 0
        if (speed < 1.5) {
          gear.current = gear.current === 'D' ? 'R' : 'D'
          throttleTime.current = 0
          autoGear.current = 1
        }
      } else if (e.code === 'KeyF') {
        // Get out and walk. The soldier appears beside the door.
        const rb = body.current
        if (!rb) return
        const p = rb.translation()
        const rightX = Math.cos(heading.current)
        const rightZ = -Math.sin(heading.current)
        transportState.walk = {
          x: p.x + rightX * 2.2,
          z: p.z + rightZ * 2.2,
          y: 0.87,
          heading: heading.current,
        }
        setPlayerMode('walk')
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

    // Parked: the body is fixed at its saved pose; keep the model facing the
    // right way but don't run the powertrain or claim the shared player ref.
    if (!active) {
      if (visual.current) {
        visual.current.rotation.y = heading.current
        visual.current.rotation.z = 0
      }
      return
    }

    if (bodyRef && bodyRef.current !== rb) {
      bodyRef.current = rb
    }

    const pos = rb.translation()
    minimapState.x = pos.x
    minimapState.z = pos.z
    minimapState.heading = heading.current
    transportState.car = {
      x: pos.x,
      z: pos.z,
      y: pos.y,
      heading: heading.current,
    }

    if (pos.y < -10) {
      rb.setTranslation({ x: 0, y: 0.5, z: 0 }, true)
      rb.setLinvel({ x: 0, y: 0, z: 0 }, true)
      heading.current = 0
      yawVel.current = 0
      engineState.current = 'off'
      rpmSmooth.current = 0
      return
    }

    if (!introDone) return

    const dt = Math.min(delta, 0.05)
    const lin = rb.linvel()

    // ---- Pedals ----
    // In D: W = throttle, S = brake. In R the pedals swap (S accelerates
    // backward), exactly like a real automatic.
    const inReverse = gear.current === 'R'
    const dir = new THREE.Vector3(
      Math.sin(heading.current),
      0,
      Math.cos(heading.current),
    )
    const right = new THREE.Vector3(-dir.z, 0, dir.x)
    const fwdVel = dir.x * lin.x + dir.z * lin.z
    const absSpeed = Math.abs(fwdVel)
    const fwdKey = inReverse ? keys.backward : keys.forward
    const brkKey = inReverse ? keys.forward : keys.backward

    // ---- Engine state machine ----
    // Auto-start: the moment the driver presses the accelerator while the
    // engine is off, fire the ignition so the car always answers W — no hidden
    // prerequisite. G still starts/stops the engine manually.
    if (engineState.current === 'off' && fwdKey && !brkKey) {
      engineState.current = 'starting'
      crank.current = 0
    }
    if (engineState.current === 'starting') {
      crank.current += dt
      if (crank.current >= CRANK_TIME) engineState.current = 'on'
    }
    const engineOn = engineState.current === 'on'

    // ---- Automatic gearbox ----
    if (gear.current === 'D' && engineOn) {
      if (autoGear.current < 4 && absSpeed > UPSHIFT_SPEED[autoGear.current]) {
        autoGear.current += 1
      } else if (autoGear.current > 1 && absSpeed < DOWNSHIFT_SPEED[autoGear.current]) {
        autoGear.current -= 1
      }
    }
    const gearTop = inReverse ? REVERSE_MAX_SPEED : GEAR_TOPS[autoGear.current]

    // ---- Throttle pedal ----
    if (engineOn && fwdKey && !brkKey) {
      throttleTime.current = Math.min(throttleTime.current + dt, THROTTLE_RAMP_TIME)
    } else {
      throttleTime.current = Math.max(
        throttleTime.current - dt * (THROTTLE_RAMP_TIME / THROTTLE_DECAY),
        0,
      )
    }
    const throttle = (throttleTime.current / THROTTLE_RAMP_TIME) * (2 - throttleTime.current / THROTTLE_RAMP_TIME)

    // ---- RPM ----
    let rpmTarget = 0
    if (engineState.current === 'starting') {
      // Cranking: brief fire pulses as the cylinders catch.
      rpmTarget = crank.current % 0.5 < 0.28 ? 0 : 260
    } else if (engineOn) {
      const speedNormInGear = clamp(absSpeed / gearTop, 0, 1)
      let rpmFromSpeed = IDLE_RPM + (REDLINE_RPM - IDLE_RPM) * speedNormInGear
      // Torque-converter slip: revs build above speed-matched rpm while
      // throttling from low speed (the engine briefly out-runs the wheels).
      const slip = throttle > 0 ? throttle * 1500 * (1 - speedNormInGear) : 0
      rpmFromSpeed = clamp(rpmFromSpeed + slip, IDLE_RPM, REDLINE_RPM)
      if (throttle === 0) rpmFromSpeed = clamp(rpmFromSpeed, IDLE_RPM, REDLINE_RPM)
      rpmTarget = rpmFromSpeed
    }
    rpmSmooth.current += (rpmTarget - rpmSmooth.current) * (1 - Math.exp(-dt * 10))
    const rpm = rpmSmooth.current

    // ---- Steering ----
    const speed = Math.hypot(lin.x, lin.z)
    const speedNorm = clamp(speed / MAX_SPEED, 0, 1)
    const steerInput = (keys.left ? 1 : 0) - (keys.right ? 1 : 0)
    const effectiveSteer = inReverse ? -steerInput : steerInput
    if (effectiveSteer !== 0) {
      const turnRate = BASE_TURN_RATE * (1 - STEER_SPEED_FALLOFF * speedNorm)
      const response = 1 - Math.pow(2, -dt * STEER_TORQUE)
      yawVel.current += (effectiveSteer * turnRate - yawVel.current) * response
    } else {
      yawVel.current *= Math.pow(STEER_DAMPING, dt * 60)
    }
    heading.current += yawVel.current * dt

    // ---- Drive force (torque curve over rpm) ----
    let applied = 0
    if (engineOn) {
      const rpmNorm = clamp((rpm - IDLE_RPM) / (REDLINE_RPM - IDLE_RPM), 0, 1)
      const tf = torqueFactor(rpmNorm)
      const falloff = Math.max(MIN_FORCE_FRAC, 1 - absSpeed / gearTop)
      if (throttle > 0) {
        applied =
          (inReverse ? -1 : 1) *
          (inReverse ? REVERSE_FORCE : THROTTLE_FORCE) *
          tf *
          throttle *
          falloff
      } else if (brkKey) {
        // Brake against current motion only.
        if (fwdVel > 0.3) applied = -BRAKE_DECEL
        else if (fwdVel < -0.3) applied = BRAKE_DECEL
      }
      if (throttle === 0 && !brkKey) {
        // Engine braking while coasting; the car stays still at idle.
        if (Math.abs(fwdVel) >= 1.2) {
          applied = -Math.sign(fwdVel) * ENGINE_BRAKE
        }
      }
    }

    // ---- Resistances: rolling + aerodynamic drag, both opposing motion ----
    applied -= Math.sign(fwdVel) * ROLLING_DECEL
    applied -= Math.sign(fwdVel) * AERO_DRAG * fwdVel * fwdVel

    // ---- Integrate with planted lateral grip ----
    // Solve the car as forward + lateral components: drive/brake/resistance
    // act along the heading, and any sideways slip is damped hard so the car
    // tracks where it points instead of sliding.
    const fwd = dir.x * lin.x + dir.z * lin.z
    const lat = right.x * lin.x + right.z * lin.z
    const newFwd = clamp(fwd + applied * dt, -REVERSE_MAX_SPEED, MAX_SPEED)
    const newLat = lat * Math.pow(LATERAL_GRIP, dt * 60)
    const nx = dir.x * newFwd + right.x * newLat
    const nz = dir.z * newFwd + right.z * newLat
    rb.setLinvel({ x: nx, y: lin.y, z: nz }, true)

    // ---- Publish for DOM overlays ----
    driveState.speedKmh = Math.abs(newFwd) * KMH_FACTOR
    driveState.reverse = inReverse
    driveState.rpm = Math.round(rpm)
    driveState.throttle = throttle
    driveState.engineState = engineState.current
    driveState.gear = (
      engineState.current === 'off'
        ? 'OFF'
        : engineState.current === 'starting'
          ? 'ON'
          : inReverse
            ? 'R'
            : String(autoGear.current)
    ) as GearLabel

    if (visual.current) {
      visual.current.rotation.y = heading.current

      const wheelSpin = (dt * absSpeed) / WHEEL_RADIUS
      for (const w of wheels.current) {
        if (w) w.rotation.x -= wheelSpin
      }

      // Body lean scales with actual yaw rate, so it eases in and out with the
      // turn instead of snapping on/off with the key state.
      const targetRoll = -yawVel.current * 0.08
      roll.current += (targetRoll - roll.current) * 0.15
      visual.current.rotation.z = roll.current

      // Squat under acceleration, dive under braking: pitch the body off the
      // longitudinal force (positive = driving forward, negative = braking).
      const targetPitch = -THREE.MathUtils.clamp(applied * 0.02, -0.06, 0.06)
      visual.current.rotation.x += (targetPitch - visual.current.rotation.x) * 0.12
    }
  })

  return (
    <RigidBody
      ref={body}
      type={active ? 'dynamic' : 'fixed'}
      position={[transportState.car.x, transportState.car.y, transportState.car.z]}
      colliders={false}
      lockRotations
      ccd
    >
      <CuboidCollider args={[0.5, 0.5, 0.5]} friction={0.2} />
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
