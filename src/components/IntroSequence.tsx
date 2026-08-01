import { useEffect, useRef, type JSX } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { useStore, type IntroStage } from '../store/useStore'
import ArrivalPlane from './ArrivalPlane'
import ArrivalHelicopter from './ArrivalHelicopter'
import Airport from './Airport'

interface Stage {
  key: IntroStage
  duration: number
}

/**
 * Journey timeline per variant. International visitors get a full
 * airport -> flight over the Himalayas -> descent; Nepal visitors get a
 * parallel takeoff -> flyover -> landing by helicopter; geo failure falls
 * back to a short orbit. Every stage is skippable.
 */
const STAGES: Record<string, Stage[]> = {
  air: [
    { key: 'airport', duration: 2 },
    { key: 'flight', duration: 4 },
    { key: 'descent', duration: 5 },
  ],
  local: [
    { key: 'takeoff', duration: 2 },
    { key: 'flyover', duration: 4 },
    { key: 'landing', duration: 5 },
  ],
  standard: [{ key: 'orbit', duration: 3 }],
}

/** Cubic ease, same as FlyCamera. */
const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3)

const smooth = (delta: number, rate = 5) => 1 - Math.pow(2, -delta * rate)

function stageInfo(
  elapsed: number,
  stages: Stage[],
): { key: IntroStage; eased: number } {
  let acc = 0
  for (const st of stages) {
    if (elapsed < acc + st.duration) {
      const t = Math.min((elapsed - acc) / st.duration, 1)
      return { key: st.key, eased: easeOutCubic(t) }
    }
    acc += st.duration
  }
  return { key: stages[stages.length - 1].key, eased: 1 }
}

const AIR_STAGE_1_HEADING = Math.atan2(-42.4, 42.4)
const LOCAL_STAGE_1_HEADING = Math.atan2(-4, 4)

/**
 * Cinematic arrival intro. Waits for IP geolocation, then plays the matching
 * journey: international visitors depart from a low-poly airport, fly over the
 * Himalayan ring and the valley, then descend into the orbit; Nepal visitors
 * take off from Kathmandu, soar over the range, then land. Default orbit as
 * fallback. Skip is always available.
 */
export default function IntroSequence(): JSX.Element {
  const { camera } = useThree()
  const geoResolved = useStore((s) => s.geoResolved)
  const variant = useStore((s) => s.introVariant)
  const skipIntro = useStore((s) => s.skipIntro)
  const setIntroStage = useStore((s) => s.setIntroStage)
  const planeRef = useRef<THREE.Group>(null)
  const heliRef = useRef<THREE.Group>(null)
  const elapsed = useRef(0)
  const done = useRef(false)
  const started = useRef(false)
  const currentStage = useRef<IntroStage>('orbit')
  const planeHeading = useRef(0)
  const heliHeading = useRef(0)

  const stages = STAGES[variant] ?? STAGES.standard
  const totalDuration = stages.reduce((a, s) => a + s.duration, 0)

  useEffect(() => {
    camera.position.set(0, 26, 42)
    camera.lookAt(0, 0, 0)
    return () => {
      done.current = true
      setIntroStage('orbit')
    }
  }, [camera, setIntroStage])

  useFrame((_, delta) => {
    if (done.current || !geoResolved) return
    if (!started.current) {
      started.current = true
      planeHeading.current = AIR_STAGE_1_HEADING
      heliHeading.current = LOCAL_STAGE_1_HEADING
    } else {
      elapsed.current += delta
    }

    const { key, eased } = stageInfo(elapsed.current, stages)
    if (key !== currentStage.current) {
      currentStage.current = key
      setIntroStage(key)
    }

    const snap = elapsed.current === 0
    const posTarget = new THREE.Vector3()
    let lookAt = new THREE.Vector3(0, 0, 0)

    if (variant === 'air') {
      // ---- Airplane journey ----
      let tx = 0
      let tz = 0
      let ty = 0
      let targetHeading = AIR_STAGE_1_HEADING
      if (key === 'airport') {
        // Taxi down the runway and lift off toward the valley.
        tx = 140.7 - 42.4 * eased
        tz = -140.7 + 42.4 * eased
        ty = 0.42 + 16 * eased
        targetHeading = AIR_STAGE_1_HEADING
      } else if (key === 'flight') {
        // Climb high over the Himalayan ring toward the valley.
        tx = 98.3 - 98.3 * eased
        tz = -98.3 + 98.3 * eased
        ty = 16.42 + 40 * eased
        targetHeading = Math.atan2(-98.3, 98.3)
      } else {
        // Descent toward the car, then settle into the orbit.
        tx = 10 * eased
        tz = 8 * eased
        ty = 56.42 - 53.92 * eased
        targetHeading = Math.atan2(10, 8)
      }
      planeHeading.current +=
        (targetHeading - planeHeading.current) * smooth(delta, 4)
      if (planeRef.current) {
        planeRef.current.visible = true
        planeRef.current.position.set(tx, ty, tz)
        planeRef.current.rotation.set(-0.16, planeHeading.current, -0.12)
      }
      const planePos = new THREE.Vector3(tx, ty, tz)

      if (key === 'airport') {
        // Fixed shot beside the runway, gently rising as the plane takes off.
        posTarget.lerpVectors(
          new THREE.Vector3(137, 6, -116),
          new THREE.Vector3(118, 13, -106),
          eased,
        )
        lookAt.copy(planePos)
      } else if (key === 'flight') {
        // Chase behind/above the plane for the aerial view of the valley.
        const back = new THREE.Vector3(-Math.sin(planeHeading.current), 0, -Math.cos(planeHeading.current))
        posTarget.copy(planePos).addScaledVector(back, 16).add(new THREE.Vector3(0, 4, 0))
        const ahead = new THREE.Vector3(Math.sin(planeHeading.current), 0, Math.cos(planeHeading.current))
        lookAt.copy(planePos).addScaledVector(ahead, 22)
      } else if (eased < 0.5) {
        // Chase as the plane comes down.
        const back = new THREE.Vector3(-Math.sin(planeHeading.current), 0, -Math.cos(planeHeading.current))
        posTarget.copy(planePos).addScaledVector(back, 13).add(new THREE.Vector3(0, 2, 0))
        const ahead = new THREE.Vector3(Math.sin(planeHeading.current), 0, Math.cos(planeHeading.current))
        lookAt.copy(planePos).addScaledVector(ahead, 16)
      } else {
        // Blend into the standard orbit as the plane settles.
        const ch = (eased - 0.5) / 0.5
        const angle = ch * Math.PI * 1.8
        posTarget.set(Math.sin(angle) * 46, 26 - ch * 14, Math.cos(angle) * 46)
        lookAt.set(0, 0, 0)
      }
    } else if (variant === 'local') {
      // ---- Helicopter journey (grounded, local framing) ----
      let hx = 0
      let hz = 0
      let hy = 0
      let targetHeading = LOCAL_STAGE_1_HEADING
      if (key === 'takeoff') {
        // Lift off from near the city center.
        hx = 14 - 4 * eased
        hz = 10 + 4 * eased
        hy = 0.4 + 17.6 * eased
        targetHeading = LOCAL_STAGE_1_HEADING
      } else if (key === 'flyover') {
        // Climb out over the valley and the mountain ring.
        hx = 10 - 130 * eased
        hz = 14 + 76 * eased
        hy = 18 + 27 * eased
        targetHeading = Math.atan2(-130, 76)
      } else {
        // Swoop back over the ring and descend to the center.
        hx = -120 + 130 * eased
        hz = 90 - 100 * eased
        hy = 45 - 41 * eased
        targetHeading = Math.atan2(130, -100)
      }
      heliHeading.current +=
        (targetHeading - heliHeading.current) * smooth(delta, 4)
      if (heliRef.current) {
        heliRef.current.visible = true
        heliRef.current.position.set(hx, hy, hz)
        heliRef.current.rotation.set(0, heliHeading.current, -0.06)
      }
      const heliPos = new THREE.Vector3(hx, hy, hz)

      if (key === 'takeoff') {
        // Fixed shot watching the helicopter rise.
        posTarget.lerpVectors(
          new THREE.Vector3(26, 4, 24),
          new THREE.Vector3(20, 12, 18),
          eased,
        )
        lookAt.copy(heliPos)
      } else if (key === 'flyover') {
        const back = new THREE.Vector3(-Math.sin(heliHeading.current), 0, -Math.cos(heliHeading.current))
        posTarget.copy(heliPos).addScaledVector(back, 11).add(new THREE.Vector3(0, 2.5, 0))
        const ahead = new THREE.Vector3(Math.sin(heliHeading.current), 0, Math.cos(heliHeading.current))
        lookAt.copy(heliPos).addScaledVector(ahead, 14)
      } else if (eased < 0.6) {
        const back = new THREE.Vector3(-Math.sin(heliHeading.current), 0, -Math.cos(heliHeading.current))
        posTarget.copy(heliPos).addScaledVector(back, 9).add(new THREE.Vector3(0, 1.5, 0))
        const ahead = new THREE.Vector3(Math.sin(heliHeading.current), 0, Math.cos(heliHeading.current))
        lookAt.copy(heliPos).addScaledVector(ahead, 12)
      } else {
        const ch = (eased - 0.6) / 0.4
        const angle = ch * Math.PI * 1.8
        posTarget.set(Math.sin(angle) * 46, 26 - ch * 14, Math.cos(angle) * 46)
        lookAt.set(0, 0, 0)
      }
    } else {
      // ---- Default orbit (geo failed/timed out) ----
      const angle = eased * Math.PI * 1.8
      posTarget.set(Math.sin(angle) * 46, 26 - eased * 14, Math.cos(angle) * 46)
      lookAt.set(0, 0, 0)
    }

    if (snap) camera.position.copy(posTarget)
    else camera.position.lerp(posTarget, smooth(delta))
    camera.lookAt(lookAt)

    if (elapsed.current >= totalDuration) {
      done.current = true
      skipIntro()
    }
  })

  return (
    <>
      {variant === 'air' && <Airport />}
      <ArrivalPlane ref={planeRef} />
      <ArrivalHelicopter ref={heliRef} />
    </>
  )
}
