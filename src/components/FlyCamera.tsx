import { useEffect, useRef, type JSX } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { useStore } from '../store/useStore'

interface FlyCameraProps {
  duration?: number
}

export default function FlyCamera({ duration = 1.6 }: FlyCameraProps): JSX.Element {
  const { camera } = useThree()
  const flyTarget = useStore((s) => s.flyTarget)
  const clearFly = useStore((s) => s.clearFly)

  const from = useRef(new THREE.Vector3())
  const to = useRef(new THREE.Vector3())
  const elapsed = useRef(0)
  const flying = useRef(false)

  useEffect(() => {
    if (!flyTarget) return
    flying.current = true
    elapsed.current = 0
    from.current.copy(camera.position)
    to.current.set(flyTarget.x + 6, 6, flyTarget.z + 6)
  }, [flyTarget, camera])

  useFrame((_, delta) => {
    if (!flying.current || !flyTarget) return
    elapsed.current += delta
    const t = Math.min(elapsed.current / duration, 1)
    const eased = 1 - Math.pow(1 - t, 3)

    camera.position.lerpVectors(from.current, to.current, eased)
    camera.lookAt(flyTarget.x, 1, flyTarget.z)

    if (t >= 1) {
      flying.current = false
      clearFly()
    }
  })

  return <></>
}
