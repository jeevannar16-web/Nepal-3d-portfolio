import { useEffect, useRef, type JSX } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import type { RapierRigidBody } from '@react-three/rapier'
import * as THREE from 'three'
import { useStore } from '../store/useStore'
import { MAX_SPEED } from './Player'

const BASE_FOV = 70 // matches the Canvas camera; wide enough to see the road ahead
const FOV_SPEED_GAIN = 6 // degrees added at top speed
const LOOK_DRAG_SENSITIVITY = 0.006 // radians of orbit per pixel of right-drag
const LOOK_KEY_RATE = 0.7 // orbit radians/second while Q/E is held
const Y_AXIS = new THREE.Vector3(0, 1, 0)

interface FollowCameraProps {
  target: React.RefObject<RapierRigidBody | null>
}

export default function FollowCamera({ target }: FollowCameraProps): JSX.Element {
  const { camera, gl } = useThree()
  const flyTarget = useStore((s) => s.flyTarget)
  const offset = useRef(
    new THREE.Vector3(6, 5, 6).setLength(9.5).setY(5.5),
  )
  const bobTime = useRef(0)
  // Free-look: orbit the camera around the car with right-click drag or Q/E.
  // The yaw springs back to 0 (the normal follow angle) when released, and
  // the default chase behavior is untouched while no look input is active.
  const yaw = useRef(0)
  const yawTarget = useRef(0)
  const looking = useRef(false)
  const lastX = useRef(0)
  const orbitKeys = useRef({ left: false, right: false })

  useEffect(() => {
    const el = gl.domElement

    const onDown = (e: MouseEvent) => {
      if (e.button === 2) {
        e.preventDefault() // suppress the context menu during a look
        looking.current = true
        lastX.current = e.clientX
      }
    }
    const onMove = (e: MouseEvent) => {
      if (!looking.current) return
      yawTarget.current += (e.clientX - lastX.current) * LOOK_DRAG_SENSITIVITY
      lastX.current = e.clientX
    }
    const onUp = (e: MouseEvent) => {
      if (e.button === 2) looking.current = false
    }
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'KeyQ') orbitKeys.current.left = true
      if (e.code === 'KeyE') orbitKeys.current.right = true
    }
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'KeyQ') orbitKeys.current.left = false
      if (e.code === 'KeyE') orbitKeys.current.right = false
    }
    const onCtx = (e: MouseEvent) => e.preventDefault()

    el.addEventListener('mousedown', onDown)
    el.addEventListener('contextmenu', onCtx)
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    return () => {
      el.removeEventListener('mousedown', onDown)
      el.removeEventListener('contextmenu', onCtx)
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
    }
  }, [gl])

  useFrame((_, delta) => {
    if (flyTarget) return
    const body = target.current
    if (!body) return
    const pos = body.translation()
    const lin = body.linvel()
    const speed = Math.hypot(lin.x, lin.z)

    // Speed-based FOV — widens with speed for a sense of velocity, eased back
    // to base when coasting or flying. The single trick that makes it feel fast.
    const fovTarget = BASE_FOV + FOV_SPEED_GAIN * Math.min(speed / MAX_SPEED, 1)
    const cam = camera as THREE.PerspectiveCamera
    cam.fov += (fovTarget - cam.fov) * (1 - Math.pow(2, -delta * 3))
    cam.updateProjectionMatrix()

    // Free-look yaw: Q/E add a steady rate, right-drag adds per-pixel. With no
    // look input the target eases back to 0 so the chase cam re-centers itself.
    const keys = orbitKeys.current
    if (keys.left) yawTarget.current -= LOOK_KEY_RATE * delta
    if (keys.right) yawTarget.current += LOOK_KEY_RATE * delta
    if (!looking.current && !keys.left && !keys.right) yawTarget.current = 0
    const active = looking.current || keys.left || keys.right
    const settle = 1 - Math.pow(2, -delta * (active ? 12 : 4))
    yaw.current += (yawTarget.current - yaw.current) * settle

    bobTime.current += delta * (1 + speed * 0.25)

    // Keep bob/sway off while free-looking so an orbit stays steady.
    const bob = !active ? Math.min(speed, 4) : 0
    const sway = Math.sin(bobTime.current * 2.2) * 0.045 * bob
    const bobY = Math.sin(bobTime.current * 4.4) * 0.035 * bob

    const rotated = offset.current.clone().applyAxisAngle(Y_AXIS, yaw.current)

    const desired = new THREE.Vector3(
      pos.x + rotated.x + sway,
      rotated.y + bobY,
      pos.z + rotated.z,
    )

    const smooth = 1 - Math.pow(2, -delta * 4)
    camera.position.lerp(desired, smooth)
    camera.lookAt(pos.x, pos.y + 0.5, pos.z)
  })

  return <></>
}
