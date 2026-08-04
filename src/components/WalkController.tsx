import { useEffect, useRef, type JSX } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import {
  RigidBody,
  CapsuleCollider,
  type RapierRigidBody,
} from '@react-three/rapier'
import * as THREE from 'three'
import { minimapState } from '../store/minimapState'
import { useStore } from '../store/useStore'
import { transportState, type TransportPose } from '../store/transportState'
import { walkState, inputState, walkHud } from '../store/walkState'
import { angleDelta } from '../utils/attitude'
import Soldier from './Soldier'

const WALK_SPEED = 3.4
const SPRINT_SPEED = 6
const CROUCH_SPEED = 1.6
const ACCEL = 10
const JUMP_VEL = 4.6
const ENTER_RADIUS = 3.6
const ANTICIPATE_TIME = 0.15
const LAND_TIME = 0.32
const TURN_RATE = 14 // radians/s the soldier rotates toward the movement heading
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
  const { camera } = useThree()
  const setPlayerMode = useStore((s) => s.setPlayerMode)
  const body = useRef<RapierRigidBody>(null)
  const visual = useRef<THREE.Group>(null)
  const heading = useRef(transportState.walk.heading)
  const facing = useRef(transportState.walk.heading)
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
  })
  const activeRef = useRef(active)
  activeRef.current = active
  const activePrev = useRef(active)

  const nearVehicle = (pos: { x: number; z: number }) => {
    for (const kind of ['car', 'bike', 'horse'] as const) {
      const p = transportState[kind]
      if (Math.hypot(pos.x - p.x, pos.z - p.z) < ENTER_RADIUS) return true
    }
    return false
  }

  const enterVehicle = () => {
    const rb = body.current
    if (!rb) return
    const pos = rb.translation()
    for (const kind of ['car', 'bike', 'horse'] as const) {
      const p = transportState[kind]
      if (Math.hypot(pos.x - p.x, pos.z - p.z) < ENTER_RADIUS) {
        setPlayerMode(kind)
        return
      }
    }
  }

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (!activeRef.current) return
      const k = keyMap[e.code]
      if (k) {
        inputState[k] = true
        e.preventDefault()
        return
      }
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
    // decided, in case the physics body was parked at the hidden stash.
    if (!activePrev.current) {
      rb.setTranslation(
        { x: transportState.walk.x, y: transportState.walk.y, z: transportState.walk.z },
        true,
      )
      rb.setLinvel({ x: 0, y: 0, z: 0 }, true)
    }
    activePrev.current = true

    const pos = rb.translation()
    if (bodyRef && bodyRef.current !== rb) bodyRef.current = rb

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
        visual.current.position.set(0, -CAPSULE_HALF_LEN, 0)
        facing.current = heading.current
        visual.current.rotation.y = heading.current
      }
      motionRef.current = {
        moving: true,
        running: false,
        crouching: false,
        jump: null,
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
    if (visual.current) visual.current.position.set(0, -CAPSULE_HALF_LEN, 0)
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

    // ---- Movement relative to camera ----
    const camDir = new THREE.Vector3()
    camera.getWorldDirection(camDir)
    const camYaw = Math.atan2(camDir.x, camDir.z)
    const fwdInput = (inputState.fwd ? 1 : 0) - (inputState.back ? 1 : 0)
    const sideInput = (inputState.right ? 1 : 0) - (inputState.left ? 1 : 0)
    const speed = crouching.current
      ? CROUCH_SPEED
      : inputState.run
        ? SPRINT_SPEED
        : WALK_SPEED

    const targetVel = new THREE.Vector3()
    if (fwdInput !== 0 || sideInput !== 0) {
      const dx = Math.sin(camYaw) * fwdInput + Math.cos(camYaw) * sideInput
      const dz = Math.cos(camYaw) * fwdInput - Math.sin(camYaw) * sideInput
      const len = Math.hypot(dx, dz)
      targetVel.set((dx / len) * speed, 0, (dz / len) * speed)
      heading.current = Math.atan2(targetVel.x, targetVel.z)
    }

    const nvx = THREE.MathUtils.lerp(vel.x, targetVel.x, 1 - Math.exp(-delta * ACCEL))
    const nvz = THREE.MathUtils.lerp(vel.z, targetVel.z, 1 - Math.exp(-delta * ACCEL))
    const vyNow = rb.linvel().y
    rb.setLinvel({ x: nvx, y: vyNow, z: nvz }, true)

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

    // ---- Visual: rotate smoothly toward the movement heading, then hand the
    // walk cycle to Soldier. Turning in place (input held while standing)
    // pivots the soldier, so side/back inputs read instantly. ----
    const moving = Math.hypot(nvx, nvz) > 0.5
    const turning = fwdInput !== 0 || sideInput !== 0
    if (moving || turning) {
      const d = angleDelta(heading.current, facing.current)
      const step = Math.min(1, TURN_RATE * Math.max(delta, 1e-4))
      facing.current += d * step
    }
    motionRef.current = {
      moving,
      running: moving && inputState.run && !crouching.current,
      crouching: crouching.current,
      jump: jumpState.current,
    }
    walkState.crouching = crouching.current
    ;(window as any).__body = {
      x: pos.x,
      y: pos.y,
      z: pos.z,
      vy: vel.y,
      groundedPhys,
      feetY: pos.y + (visual.current ? visual.current.position.y : 0),
      type: active ? 'dynamic' : 'fixed',
    }
    ;(window as any).__motion = {
      moving: motionRef.current.moving,
      running: motionRef.current.running,
      crouching: motionRef.current.crouching,
      jump: motionRef.current.jump,
    }
    if (visual.current) visual.current.rotation.y = facing.current
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
