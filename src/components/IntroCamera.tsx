import { useEffect, useRef, type JSX } from 'react'
import { useFrame, useThree } from '@react-three/fiber'

interface IntroCameraProps {
  duration?: number
  onComplete?: () => void
}

export default function IntroCamera({
  duration = 3,
  onComplete,
}: IntroCameraProps): JSX.Element {
  const { camera } = useThree()
  const elapsed = useRef(0)
  const done = useRef(false)

  useEffect(() => {
    camera.position.set(0, 26, 42)
    camera.lookAt(0, 0, 0)
    return () => {
      done.current = true
    }
  }, [camera])

  useFrame((_, delta) => {
    if (done.current) return
    elapsed.current += delta

    const t = Math.min(elapsed.current / duration, 1)
    const eased = 1 - Math.pow(1 - t, 3)

    const angle = eased * Math.PI * 1.8
    const radius = 46
    const x = Math.sin(angle) * radius
    const z = Math.cos(angle) * radius
    const y = 26 - eased * 14

    camera.position.set(x, y, z)
    camera.lookAt(0, 0, 0)

    if (t >= 1) {
      done.current = true
      onComplete?.()
    }
  })

  return <></>
}
