import { useRef, type JSX } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import type { RapierRigidBody } from '@react-three/rapier'
import * as THREE from 'three'
import { useStore } from '../store/useStore'
import { MAX_SPEED } from './Player'

const BASE_FOV = 60 // matches the Canvas camera
const FOV_SPEED_GAIN = 7 // degrees added at top speed (+5-8 suggested)

interface FollowCameraProps {
  target: React.RefObject<RapierRigidBody | null>
}

export default function FollowCamera({ target }: FollowCameraProps): JSX.Element {
  const { camera } = useThree()
  const flyTarget = useStore((s) => s.flyTarget)
  const offset = useRef(
    new THREE.Vector3(6, 5, 6).setLength(7).setY(5),
  )
  const bobTime = useRef(0)

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

    bobTime.current += delta * (1 + speed * 0.25)

    const bob = Math.min(speed, 4)
    const sway = Math.sin(bobTime.current * 2.2) * 0.045 * bob
    const bobY = Math.sin(bobTime.current * 4.4) * 0.035 * bob

    const desired = new THREE.Vector3(
      pos.x + offset.current.x + sway,
      offset.current.y + bobY,
      pos.z + offset.current.z,
    )

    const smooth = 1 - Math.pow(2, -delta * 4)
    camera.position.lerp(desired, smooth)
    camera.lookAt(pos.x, pos.y + 0.5, pos.z)
  })

  return <></>
}
