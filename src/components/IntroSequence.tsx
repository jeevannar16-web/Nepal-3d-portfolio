import { useEffect, useRef, type JSX } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { useStore } from '../store/useStore'
import ArrivalPlane from './ArrivalPlane'

const DURATION: Record<string, number> = {
  air: 5,
  local: 2.5,
  standard: 3,
}

/**
 * Cinematic arrival intro. Waits for IP geolocation, then plays the matching
 * sequence: an air arrival with a plane flying in for international visitors,
 * a short grounded welcome for Nepal, or the default orbit as fallback.
 */
export default function IntroSequence(): JSX.Element {
  const { camera } = useThree()
  const geoResolved = useStore((s) => s.geoResolved)
  const variant = useStore((s) => s.introVariant)
  const skipIntro = useStore((s) => s.skipIntro)
  const planeRef = useRef<THREE.Group>(null)
  const elapsed = useRef(0)
  const done = useRef(false)

  const duration = DURATION[variant] ?? 3

  useEffect(() => {
    camera.position.set(0, 26, 42)
    camera.lookAt(0, 0, 0)
    return () => {
      done.current = true
    }
  }, [camera])

  useFrame((_, delta) => {
    if (done.current || !geoResolved) return
    elapsed.current += delta

    const t = Math.min(elapsed.current / duration, 1)
    const eased = 1 - Math.pow(1 - t, 3)

    if (variant === 'air') {
      // Plane descends from high/far toward the car.
      const px = -95 + 115 * eased
      const pz = -80 + 85 * eased
      const py = 42 - 40 * eased
      const heading = Math.atan2(115, 85)
      if (planeRef.current) {
        planeRef.current.visible = true
        planeRef.current.position.set(px, py, pz)
        planeRef.current.rotation.set(-0.16, heading, -0.12)
      }

      const planePos = new THREE.Vector3(px, py, pz)
      if (eased < 0.55) {
        // Chase cam behind/above the plane.
        const back = new THREE.Vector3(-Math.sin(heading), 0, -Math.cos(heading))
        camera.position
          .copy(planePos)
          .addScaledVector(back, 14)
          .add(new THREE.Vector3(0, 3, 0))
        const ahead = new THREE.Vector3(Math.sin(heading), 0, Math.cos(heading))
        camera.lookAt(planePos.clone().addScaledVector(ahead, 16))
      } else {
        // Blend into the standard orbit as the plane settles.
        const ch = (eased - 0.55) / 0.45
        const angle = ch * Math.PI * 1.8
        const target = new THREE.Vector3(
          Math.sin(angle) * 46,
          26 - ch * 14,
          Math.cos(angle) * 46,
        )
        const smooth = 1 - Math.pow(2, -delta * 3)
        camera.position.lerp(target, smooth)
        camera.lookAt(0, 0, 0)
      }
    } else if (variant === 'local') {
      // Grounded arrival: start low beside the car, pull back into the orbit.
      const sx = 5
      const sy = 2.4
      const sz = 8
      const angle = eased * Math.PI * 1.8
      camera.position.set(
        sx + (Math.sin(angle) * 46 - sx) * eased,
        sy + (26 - eased * 14 - sy) * eased,
        sz + (Math.cos(angle) * 46 - sz) * eased,
      )
      camera.lookAt(0, 0, 0)
    } else {
      // Default orbit (geo failed/timed out).
      const angle = eased * Math.PI * 1.8
      camera.position.set(
        Math.sin(angle) * 46,
        26 - eased * 14,
        Math.cos(angle) * 46,
      )
      camera.lookAt(0, 0, 0)
    }

    if (t >= 1) {
      done.current = true
      skipIntro()
    }
  })

  return <ArrivalPlane ref={planeRef} />
}
