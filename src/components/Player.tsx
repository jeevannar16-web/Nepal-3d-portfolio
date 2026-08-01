import { useRef, useEffect, type JSX } from 'react'
import { useFrame } from '@react-three/fiber'
import { RigidBody, CuboidCollider, type RapierRigidBody } from '@react-three/rapier'
import * as THREE from 'three'
import { minimapState } from '../store/minimapState'

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

    const turn = delta * 2.4
    if (keys.left) heading.current += turn
    if (keys.right) heading.current -= turn

    const dir = new THREE.Vector3(
      Math.sin(heading.current),
      0,
      Math.cos(heading.current),
    )
    // Force-based movement: impulse = force * dt, applied each frame.
    // Frame-rate independent and handled entirely by the physics engine.
    const forceMag = keys.forward ? 26 : keys.backward ? -16 : 0
    if (forceMag !== 0) {
      rb.applyImpulse(
        { x: dir.x * forceMag * delta, y: 0, z: dir.z * forceMag * delta },
        true,
      )
    }

    const lin = rb.linvel()
    rb.setLinvel({ x: lin.x * 0.97, y: lin.y, z: lin.z * 0.97 }, true)

    if (visual.current) {
      visual.current.rotation.y = heading.current
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
        <mesh castShadow>
          <boxGeometry args={[1, 1, 1]} />
          <meshStandardMaterial color="#d95d39" />
        </mesh>
      </group>
    </RigidBody>
  )
}
