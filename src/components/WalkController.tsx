import { useEffect, useRef, type JSX } from 'react'
import { useFrame } from '@react-three/fiber'
import {
  RigidBody,
  CapsuleCollider,
  type RapierRigidBody,
} from '@react-three/rapier'
import * as THREE from 'three'
import { minimapState } from '../store/minimapState'
import { useStore } from '../store/useStore'
import { transportState, type TransportPose } from '../store/transportState'
import { walkState, inputState, walkHud, feetLocalY } from '../store/walkState'
import Soldier from './Soldier'

const WALK_SPEED = 3.0
const SPRINT_SPEED = 5.2
const CROUCH_SPEED = 1.4
const ACCEL = 24 // snappy acceleration so the gait stays in phase with the body
const JUMP_VEL = 5.5
const ENTER_RADIUS = 3.6
const ANTICIPATE_TIME = 0.15
const LAND_TIME = 0.32
// Physics capsule is CapsuleCollider[0.55, 0.32]; its bottom (and the soldier
// model's feet, which sit at the visual group origin) hangs this far below the
// body centre, so the visual rides the capsule's bottom.
const CAPSULE_HALF_LEN = 0.55 + 0.32
// Runway top; the intro's scripted exit walk stays on the tarmac (z 84..92).
const RUNWAY_TOP = 0.04

const keyMap: Record<string, 'fwd' | 'back' | 'left' | 'right' | 'run'> = {
  KeyW: 'fwd',
  ArrowUp: 'fwd',
  KeyS: 'back',
  ArrowDown: 'back',
  KeyA: 'left',
  ArrowLeft: 'left',
  KeyD: 'right',
  ArrowRight: 'right',
  ShiftLeft: 'run',
  ShiftRight: 'run',
}

interface WalkControllerProps {
  bodyRef: React.RefObject<RapierRigidBody | null>
  /** When false the soldier is hidden away (riding inside a vehicle). */
  active: boolean
}

/**
 * On-foot player: the soldier walks, runs and jumps around the valley with
 * WASD relative to the camera, and presses E near the car, motorcycle or horse
 * to climb in. Right after the intro he steps out of the landed plane (a short
 * scripted walk) before the player takes control. His body stays mounted for
 * the whole session — hidden far below the world when not walking — so mode
 * switches never remove a physics body (which rapier can panic on).
 */
export default function WalkController({
  bodyRef,
  active,
}: WalkControllerProps): JSX.Element {
  const setPlayerMode = useStore((s) => s.setPlayerMode)
  const body = useRef<RapierRigidBody>(null)
  const visual = useRef<THREE.Group>(null)
  const heading = useRef(transportState.walk.heading)
  const grounded = useRef(true)
  const crouching = useRef(false)
  const jumpState = useRef<'anticipate' | 'airborne' | 'land' | null>(null)
  const jumpTimer = useRef(0)
  const scriptTime = useRef(-1)
  const motionRef = useRef({
    moving: false,
    running: false,
    crouching: false,
    jump: null as 'anticipate' | 'airborne' | 'land' | null,
    speed: 0,
  })
  const activeRef = useRef(active)
  activeRef.current = active
  const activePrev = useRef(active)

  const nearVehicle = (pos: { x: number; z: number }) => {
    for (const kind of ['car', 'bike', 'horse'] as const) {
      const p = transportState[kind]
      if (Math.hypot(pos.x - p.x, pos.z - p.z) < ENTER_RADIUS) return true
    }
    for (const plane of ['airplane', 'airplane2'] as const) {
      const ap = transportState[plane]
      if (Math.hypot(pos.x - ap.x, pos.z - ap.z) < ENTER_RADIUS * 1.5) return true
    }
    const bl = transportState.balloon
    if (Math.hypot(pos.x - bl.x, pos.z - bl.z) < ENTER_RADIUS * 1.5) return true
    return false
  }

  const enterVehicle = () => {
    const rb = body.current
    if (!rb) return
    const pos = rb.translation()
    for (const kind of ['car', 'bike', 'horse'] as const) {
      const p = transportState[kind]
      if (Math.hypot(pos.x - p.x, pos.z - p.z) < ENTER_RADIUS) {
        p.heading = heading.current
        setPlayerMode(kind)
        return
      }
    }
    for (const plane of ['airplane', 'airplane2'] as const) {
      const ap = transportState[plane]
      if (Math.hypot(pos.x - ap.x, pos.z - ap.z) < ENTER_RADIUS * 1.5) {
        ap.heading = heading.current
        transportState.activePlane = plane
        setPlayerMode('airplane')
        return
      }
    }
    const bl = transportState.balloon
    if (Math.hypot(pos.x - bl.x, pos.z - bl.z) < ENTER_RADIUS * 1.5) {
      bl.heading = heading.current
      setPlayerMode('balloon')
      return
    }
  }

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      // Movement keys are tracked even while the soldier is riding (hidden), so
      // a held W/S/A/D from the vehicle carries straight over the moment the
      // player steps out — no need to release and re-press the key after
      // dismounting.
      const k = keyMap[e.code]
      if (k) {
        inputState[k] = true
        e.preventDefault()
        return
      }
      if (!activeRef.current) return
      if (e.code === 'Space') {
        e.preventDefault()
        inputState.jump = true
        return
      }
      if (e.code === 'ControlLeft' || e.code === 'ControlRight' || e.code === 'KeyC') {
        e.preventDefault()
        crouching.current = !crouching.current
        return
      }
      if (e.code === 'KeyE') {
        e.preventDefault()
        inputState.interact = true
      }
    }
    const up = (e: KeyboardEvent) => {
      const k = keyMap[e.code]
      if (k) inputState[k] = false
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

    if (!active) {
      // Riding a vehicle: park the soldier far below the world, hidden.
      rb.setTranslation({ x: 0, y: -500, z: 0 }, true)
      rb.setLinvel({ x: 0, y: 0, z: 0 }, true)
      if (visual.current) visual.current.visible = false
      activePrev.current = false
      return
    }
    if (visual.current) visual.current.visible = true
    // Stepping out of a vehicle: place the soldier where the exit handler
    // decided, in case the physics body was parked at the hidden stash. The
    // exit handler set transportState.walk.heading to the vehicle's facing, so
    // re-sync the walker's heading ref here too — it only ever sees the pose
    // written by exit handlers, never the soldier's pre-mount direction.
    if (!activePrev.current) {
      rb.setTranslation(
        { x: transportState.walk.x, y: transportState.walk.y, z: transportState.walk.z },
        true,
      )
      rb.setLinvel({ x: 0, y: 0, z: 0 }, true)
      heading.current = transportState.walk.heading
    }
    activePrev.current = true

    const pos = rb.translation()
    if (bodyRef && bodyRef.current !== rb) bodyRef.current = rb

  const visualOffset = -CAPSULE_HALF_LEN - feetLocalY.current

  // ---- Scripted exit from the landed plane ----
  if (transportState.spawnWalk && scriptTime.current < 0) {
    scriptTime.current = 0
  }
  if (scriptTime.current >= 0) {
    const sw = transportState.spawnWalk
    if (sw) {
      scriptTime.current += delta
      const t = Math.min(scriptTime.current / 1.6, 1)
      const ease = 1 - Math.pow(1 - t, 3)
      const nx = sw.from.x + (sw.to.x - sw.from.x) * ease
      const nz = sw.from.z + (sw.to.z - sw.from.z) * ease
      rb.setTranslation({ x: nx, y: RUNWAY_TOP + CAPSULE_HALF_LEN, z: nz }, true)
      rb.setLinvel({ x: 0, y: 0, z: 0 }, true)
      heading.current = Math.atan2(sw.to.x - sw.from.x, sw.to.z - sw.from.z)
      transportState.walk = {
        x: nx,
        z: nz,
        y: RUNWAY_TOP + CAPSULE_HALF_LEN,
        heading: heading.current,
      } as TransportPose
      if (t >= 1) {
        transportState.spawnWalk = null
        scriptTime.current = -1
      }
    } else {
      scriptTime.current = -1
    }
    if (visual.current) {
      visual.current.position.set(0, visualOffset, 0)
      visual.current.rotation.y = heading.current
    }
    motionRef.current = {
      moving: true,
      running: false,
      crouching: false,
      jump: null,
      speed: WALK_SPEED,
    }
    minimapState.x = pos.x
    minimapState.z = pos.z
    minimapState.heading = heading.current
    return
  }

  // ---- Consume edge-triggered input (keyboard E or the touch interact
  // button both land here) ----
  // Keep the soldier's feet on the physics capsule's bottom now that the
  // scripted exit walk is over (the scripted walk set its own offset).
  if (visual.current) visual.current.position.set(0, visualOffset, 0)
    if (inputState.interact) {
      inputState.interact = false
      enterVehicle()
    }
    walkHud.nearVehicle = nearVehicle(pos)

    // ---- Grounded check + jump state machine ----
    if (inputState.jump) {
      inputState.jump = false
      if (grounded.current && !jumpState.current) {
        jumpState.current = 'anticipate'
        jumpTimer.current = 0
      }
    }
    const vel = rb.linvel()
    const groundedPhys = pos.y < 1.35 && Math.abs(vel.y) < 0.4
    switch (jumpState.current) {
      case 'anticipate':
        jumpTimer.current += delta
        if (jumpTimer.current >= ANTICIPATE_TIME) {
          rb.applyImpulse({ x: 0, y: JUMP_VEL, z: 0 }, true)
          jumpState.current = 'airborne'
          jumpTimer.current = 0
        }
        break
      case 'airborne':
        if (groundedPhys) {
          jumpState.current = 'land'
          jumpTimer.current = 0
        }
        break
      case 'land':
        jumpTimer.current += delta
        if (jumpTimer.current >= LAND_TIME) jumpState.current = null
        break
    }
    grounded.current = groundedPhys

    // ---- Movement (character-relative: W/S along heading, A/D turn) ----
    const fwdInput = (inputState.fwd ? 1 : 0) - (inputState.back ? 1 : 0)
    const sideInput = (inputState.right ? 1 : 0) - (inputState.left ? 1 : 0)
    const speed = crouching.current
      ? CROUCH_SPEED
      : inputState.run
        ? SPRINT_SPEED
        : WALK_SPEED

    // ---- Character-relative control (like the vehicles): W/S move along the
    // soldier's own forward, A/D turn it left/right. S is the exact mirror of W:
    // same clean walk cycle, same facing, just velocity reversed. No heading
    // flips, no 360, no extra world motion. ----
    const turnInput = sideInput // A/D turn the heading, -1/+1
    const turnRate = 4 // rad/s (controlled, never a full swing per press)
    // Clamp the per-frame delta so a single keypress or a big delta frame can
    // never spin the model a full turn in one step.
    const maxTurn = THREE.MathUtils.degToRad(30) // 30 deg/frame cap @ 60fps-ish
    const rawTurn = turnInput * turnRate * delta
    heading.current += Math.max(-maxTurn, Math.min(maxTurn, rawTurn))
    heading.current = Math.atan2(Math.sin(heading.current), Math.cos(heading.current))

    const targetVel = new THREE.Vector3()
    let moveMag = 0
    if (fwdInput !== 0) {
      moveMag = Math.abs(fwdInput)
      const dir = new THREE.Vector3(
        Math.sin(heading.current),
        0,
        Math.cos(heading.current),
      )
      targetVel.copy(dir).multiplyScalar(fwdInput * speed)
    }
    // Body faces where we move. W and S share the SAME facing (current heading)
    // so the walk cycle never flips 180 / never shows a second flickering
    // image — S is simply W with reversed velocity. Heading is only turned by
    // A/D; targetVel is built from heading, so there is nothing to snap here.
    const faceAngle = heading.current

    const curVel = rb.linvel()
    const nvx = THREE.MathUtils.lerp(curVel.x, targetVel.x, 1 - Math.exp(-delta * ACCEL))
    const nvz = THREE.MathUtils.lerp(curVel.z, targetVel.z, 1 - Math.exp(-delta * ACCEL))

    // ---- Ground friction: when the player isn't giving any input, drain the
    // horizontal speed to a hard stop instead of letting the lerp decay into a
    // slow slide. The slide made the soldier shuffle-to-a-halt (legs creeping)
    // and caused a walk/idle animation pop as |vel| crossed the moving
    // threshold. ----
    const stopThreshold = 0.06
    let finalVx = nvx
    let finalVz = nvz
    if (moveMag === 0) {
      finalVx = THREE.MathUtils.lerp(curVel.x, 0, 1 - Math.exp(-delta * 8))
      finalVz = THREE.MathUtils.lerp(curVel.z, 0, 1 - Math.exp(-delta * 8))
    }
    // Snap to exactly zero just before it would creep, so `moving` stays stable.
    if (moveMag === 0 && Math.hypot(finalVx, finalVz) < stopThreshold) {
      finalVx = 0
      finalVz = 0
    }
    rb.setLinvel({ x: finalVx, y: curVel.y, z: finalVz }, true)

    const moveSpeed = Math.hypot(finalVx, finalVz)

    // ---- Persist pose + minimap ----
    transportState.walk = {
      x: pos.x,
      z: pos.z,
      y: pos.y,
      heading: heading.current,
    } as TransportPose
    minimapState.x = pos.x
    minimapState.z = pos.z
    minimapState.heading = heading.current

    // ---- Visual: point the body at the travel direction (faceAngle). When W is
    // held the nose leads; when S is held the back leads, so the walk/run clip
    // animates cleanly with no foot slide. Heading (the A/D turn accumulator)
    // is separate and only changed by turning. ----
    const moving = moveSpeed > 0.1
    if (visual.current) {
      visual.current.rotation.y = faceAngle
    }
    motionRef.current = {
      moving,
      running: moving && inputState.run && !crouching.current,
      crouching: crouching.current,
      jump: jumpState.current,
      // Free Fire-style: pace the gait to the INTENT (how hard W/S is pressed),
      // not the lagging actual velocity — so the legs lead the body the instant
      // you press, with no stride catching up. A threshold floor keeps idle
      // stable (no 0.x creeping legs) at the standstill.
      speed: moveMag * speed,
    }
    walkState.crouching = crouching.current
    ;(window as any).__body = {
      x: pos.x,
      y: pos.y,
      z: pos.z,
      vy: vel.y,
      groundedPhys,
       feetY: pos.y - CAPSULE_HALF_LEN,
      type: active ? 'dynamic' : 'fixed',
    }
    ;(window as any).__motion = {
      moving: motionRef.current.moving,
      running: motionRef.current.running,
      crouching: motionRef.current.crouching,
      jump: motionRef.current.jump,
    }
    if (visual.current) visual.current.rotation.y = heading.current
  })

  return (
    <RigidBody
      ref={body}
      type={active ? 'dynamic' : 'fixed'}
      position={[transportState.walk.x, transportState.walk.y, transportState.walk.z]}
      colliders={false}
      lockRotations
      ccd
    >
      <CapsuleCollider args={[0.55, 0.32]} friction={0.4} />
      <group ref={visual}>
        <Soldier motionRef={motionRef} />
      </group>
    </RigidBody>
  )
}
