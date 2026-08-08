import { useEffect, useRef, type JSX } from 'react'
import { useFrame } from '@react-three/fiber'
import { RigidBody, CuboidCollider, type RapierRigidBody } from '@react-three/rapier'
import * as THREE from 'three'
import { useGLTF } from '@react-three/drei'
import { assetUrl } from '../utils/assetUrl'
import { useStore } from '../store/useStore'
import { transportState } from '../store/transportState'
import { minimapState } from '../store/minimapState'
import BlobShadow from './BlobShadow'

const RISE_SPEED = 6
const FALL_SPEED = 2
const DRIFT_SPEED = 4
const YAW_RATE = 1.2
const MIN_ALT = 3
const MAX_ALT = 50

interface Keys {
  up: boolean
  down: boolean
  left: boolean
  right: boolean
}

const keyMap: Record<string, keyof Keys> = {
  KeyW: 'up',
  ArrowUp: 'up',
  KeyS: 'down',
  ArrowDown: 'down',
  KeyA: 'left',
  ArrowLeft: 'left',
  KeyD: 'right',
  ArrowRight: 'right',
}

const keys: Keys = { up: false, down: false, left: false, right: false }

export default function HotAirBalloonController({
  bodyRef,
  active,
}: {
  bodyRef?: React.RefObject<RapierRigidBody | null>
  active: boolean
}): JSX.Element {
  const { scene: balloonScene } = useGLTF(assetUrl('/models/hotairballoon.glb'))
  const setPlayerMode = useStore((s) => s.setPlayerMode)
  const body = useRef<RapierRigidBody>(null)
  const visual = useRef<THREE.Group>(null)
  const heading = useRef(transportState.balloon.heading)
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
          x: p.x + 2,
          z: p.z + 2,
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
        { x: transportState.balloon.x, y: transportState.balloon.y, z: transportState.balloon.z },
        true,
      )
      rb.setLinvel({ x: 0, y: 0, z: 0 }, true)
      rb.setAngvel({ x: 0, y: 0, z: 0 }, true)
      if (visual.current) {
        visual.current.rotation.y = transportState.balloon.heading
      }
      return
    }

    if (bodyRef && bodyRef.current !== rb) {
      bodyRef.current = rb
    }

    const dt = Math.min(delta, 0.05)

    // Vertical movement
    const vy = keys.up ? RISE_SPEED : keys.down ? -FALL_SPEED : 0

    // Horizontal drift
    const dir = new THREE.Vector3(Math.sin(heading.current), 0, Math.cos(heading.current))
    const right = new THREE.Vector3(-dir.z, 0, dir.x)
    const hInput = (keys.right ? 1 : 0) - (keys.left ? 1 : 0)
    const drift = dir.clone().multiplyScalar(DRIFT_SPEED * 0.5).addScaledVector(right, hInput * DRIFT_SPEED * 0.5)

    // Yaw
    if (keys.left) heading.current += YAW_RATE * dt
    if (keys.right) heading.current -= YAW_RATE * dt
    heading.current = Math.atan2(Math.sin(heading.current), Math.cos(heading.current))

    const cur = rb.linvel()
    const nvx = THREE.MathUtils.lerp(cur.x, drift.x, 1 - Math.exp(-dt * 2))
    const nvy = THREE.MathUtils.lerp(cur.y, vy, 1 - Math.exp(-dt * 2))
    const nvz = THREE.MathUtils.lerp(cur.z, drift.z, 1 - Math.exp(-dt * 2))

    rb.setLinvel({ x: nvx, y: nvy, z: nvz }, true)

    // Clamp altitude
    const pos = rb.translation()
    const clampedY = THREE.MathUtils.clamp(pos.y, MIN_ALT, MAX_ALT)
    if (pos.y !== clampedY) {
      rb.setTranslation({ x: pos.x, y: clampedY, z: pos.z }, true)
    }

    // Persist pose
    transportState.balloon = {
      x: pos.x,
      z: pos.z,
      y: pos.y,
      heading: heading.current,
    }
    minimapState.x = pos.x
    minimapState.z = pos.z
    minimapState.heading = heading.current

    // Visual
    if (visual.current) {
      visual.current.rotation.y = heading.current
      // Gentle sway
      const sway = Math.sin(delta * 2 + pos.x) * 0.02
      visual.current.rotation.z = sway
    }
  })

  return (
    <RigidBody
      ref={body}
      type={active ? 'dynamic' : 'fixed'}
      position={[transportState.balloon.x, transportState.balloon.y, transportState.balloon.z]}
      colliders={false}
      lockRotations
      ccd
      mass={50}
    >
      <CuboidCollider args={[1.2, 2.5, 1.2]} position={[0, 2.5, 0]} />
      <group ref={visual} position={[0, 0, 0]}>
        <primitive object={balloonScene} scale={1} />
      </group>
      <BlobShadow radius={1.5} y={0.01} />
    </RigidBody>
  )
}
