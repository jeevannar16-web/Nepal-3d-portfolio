import { useRef, type JSX } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import type { RapierRigidBody } from '@react-three/rapier'
import * as THREE from 'three'

interface FollowCameraProps {
  target: React.RefObject<RapierRigidBody | null>
}

export default function FollowCamera({ target }: FollowCameraProps): JSX.Element {
  const { camera } = useThree()
  const offset = useRef(
    new THREE.Vector3(6, 5, 6).setLength(7).setY(5),
  )

  useFrame((_, delta) => {
    const body = target.current
    if (!body) return
    const pos = body.translation()

    const desired = new THREE.Vector3(
      pos.x + offset.current.x,
      offset.current.y,
      pos.z + offset.current.z,
    )

    const smooth = 1 - Math.pow(2, -delta * 4)
    camera.position.lerp(desired, smooth)
    camera.lookAt(pos.x, pos.y + 0.5, pos.z)
  })

  return <></>
}
