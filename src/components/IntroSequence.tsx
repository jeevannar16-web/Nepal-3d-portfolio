import { useEffect, useRef, type JSX } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { useStore, type IntroStage } from '../store/useStore'
import { angleDelta, clampPitch, orientAircraft } from '../utils/attitude'
import ArrivalPlane from './ArrivalPlane'
import Airport from './Airport'

interface Stage {
  key: IntroStage
  duration: number
}

/**
 * Journey timeline per variant. International visitors get a full
 * airport -> flight over the Himalayas -> descent; Nepal visitors get a
 * parallel takeoff -> flyover -> landing. Both fly the same airplane model;
 * geo failure falls back to a short orbit. Every stage is skippable.
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

/** Keep the aircraft at this viewport height (above the centered title). */
const TARGET_NDC_Y = 0.55

const UP_VECTOR = new THREE.Vector3(0, 1, 0)

/**
 * Tilt the camera (pitch only, keeping its heading) so the aircraft's center
 * sits at TARGET_NDC_Y. Guarantees the aircraft stays clear of the centered
 * name/role text at every frame, regardless of stage, path or easing.
 */
function aimAircraft(
  acPos: THREE.Vector3,
  camPos: THREE.Vector3,
  lookAt: THREE.Vector3,
  fov: number,
): THREE.Vector3 {
  const arm = camPos.distanceTo(lookAt)
  if (arm < 1e-4) return lookAt
  const fwd = lookAt.clone().sub(camPos).normalize()
  const right = new THREE.Vector3().crossVectors(fwd, UP_VECTOR)
  if (right.lengthSq() < 1e-6) return lookAt
  right.normalize()
  const upV = new THREE.Vector3().crossVectors(right, fwd)
  const d = acPos.clone().sub(camPos)
  const theta = Math.atan2(d.dot(upV), d.dot(fwd))
  const targetRad = Math.atan(TARGET_NDC_Y * Math.tan((fov * Math.PI) / 360))
  const quat = new THREE.Quaternion().setFromAxisAngle(right, theta - targetRad)
  fwd.applyQuaternion(quat)
  return camPos.clone().addScaledVector(fwd, arm)
}

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

/** Realistic flight controls: the nose follows the path and banks into turns. */
const FORWARD_SMOOTH = 1.8
const BANK_SMOOTH = 3.0
const MAX_BANK = 0.7
const MAX_PITCH = 0.7
const BANK_GAIN = 0.9

/**
 * Cinematic arrival intro. Waits for IP geolocation, then plays the matching
 * journey: international visitors depart from a low-poly airport, fly over the
 * Himalayan ring and the valley, then descend into the orbit; Nepal visitors
 * take off from Kathmandu, soar over the range, then land. Both use the same
 * airplane model so the aircraft reads identically close-up and far away.
 * Default orbit as fallback. Skip is always available.
 */
export default function IntroSequence(): JSX.Element {
  const { camera } = useThree()
  const geoResolved = useStore((s) => s.geoResolved)
  const variant = useStore((s) => s.introVariant)
  const skipIntro = useStore((s) => s.skipIntro)
  const setIntroStage = useStore((s) => s.setIntroStage)
  const planeRef = useRef<THREE.Group>(null)
  const elapsed = useRef(0)
  const done = useRef(false)
  const started = useRef(false)
  const currentStage = useRef<IntroStage>('orbit')
  const planeHeading = useRef(0)
  const flightForward = useRef(new THREE.Vector3(0, 0, 1))
  const bankRef = useRef(0)
  const prevHeading = useRef(0)

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
      prevHeading.current = AIR_STAGE_1_HEADING
      flightForward.current.set(-42.4, 0, 42.4).normalize()
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
    let aircraftPos: THREE.Vector3 | null = null
    let targetForward: THREE.Vector3 | null = null

    if (variant === 'air') {
      // ---- Airplane journey ----
      let tx = 0
      let tz = 0
      let ty = 0
      if (key === 'airport') {
        // Taxi down the runway and lift off toward the valley; the nose starts
        // level and rotates up as it leaves the ground.
        tx = 140.7 - 42.4 * eased
        tz = -140.7 + 42.4 * eased
        ty = 0.42 + 16 * eased
        targetForward = clampPitch(
          new THREE.Vector3(-42.4, 16 * Math.min(eased * 3, 1), 42.4),
          MAX_PITCH,
        )
      } else if (key === 'flight') {
        // Climb high over the Himalayan ring toward the valley.
        tx = 98.3 - 98.3 * eased
        tz = -98.3 + 98.3 * eased
        ty = 16.42 + 40 * eased
        targetForward = clampPitch(new THREE.Vector3(-98.3, 40, 98.3), MAX_PITCH)
      } else {
        // Descent toward the car, then settle into the orbit. The plane lands
        // to the right of the valley center so it never sits on the intro text.
        tx = 20 * eased
        tz = 6 * eased
        ty = 56.42 - 50.42 * eased
        targetForward = clampPitch(new THREE.Vector3(20, -50.42, 6), MAX_PITCH)
      }
      if (planeRef.current) {
        planeRef.current.visible = true
        planeRef.current.position.set(tx, ty, tz)
      }
      const planePos = new THREE.Vector3(tx, ty, tz)
      aircraftPos = planePos

      if (key === 'airport') {
        // Fixed shot beside the runway, gently rising as the plane takes off.
        // Frame the plane in the upper part of the screen, clear of the
        // centered name/role text.
        posTarget.lerpVectors(
          new THREE.Vector3(137, 6, -116),
          new THREE.Vector3(118, 13, -106),
          eased,
        )
        lookAt.copy(planePos).add(new THREE.Vector3(0, -7, 0))
      } else if (key === 'flight') {
        // Chase behind/above the plane for the aerial view of the valley;
        // look below the plane so it stays in the upper third of the frame.
        const back = new THREE.Vector3(-Math.sin(planeHeading.current), 0, -Math.cos(planeHeading.current))
        posTarget.copy(planePos).addScaledVector(back, 16).add(new THREE.Vector3(0, 4, 0))
        const ahead = new THREE.Vector3(Math.sin(planeHeading.current), 0, Math.cos(planeHeading.current))
        lookAt.copy(planePos).addScaledVector(ahead, 22).add(new THREE.Vector3(0, -22, 0))
      } else {
        // Chase the plane all the way down (no orbit tail) so it stays framed
        // in the upper third, clear of the centered name/role text.
        const back = new THREE.Vector3(-Math.sin(planeHeading.current), 0, -Math.cos(planeHeading.current))
        posTarget.copy(planePos).addScaledVector(back, 13).add(new THREE.Vector3(0, 2, 0))
        const ahead = new THREE.Vector3(Math.sin(planeHeading.current), 0, Math.cos(planeHeading.current))
        lookAt.copy(planePos).addScaledVector(ahead, 16).add(new THREE.Vector3(0, -16, 0))
      }
    } else if (variant === 'local') {
      // ---- Airplane journey (grounded, local framing) ----
      let lx = 0
      let lz = 0
      let ly = 0
      if (key === 'takeoff') {
        // Lift off from near the city center; rotate up as it climbs away.
        lx = 14 - 4 * eased
        lz = 10 + 4 * eased
        ly = 0.4 + 17.6 * eased
        targetForward = clampPitch(
          new THREE.Vector3(-4, 17.6 * Math.min(eased * 3, 1), 4),
          MAX_PITCH,
        )
      } else if (key === 'flyover') {
        // Climb out over the valley and the mountain ring.
        lx = 10 - 130 * eased
        lz = 14 + 76 * eased
        ly = 18 + 27 * eased
        targetForward = clampPitch(new THREE.Vector3(-130, 27, 76), MAX_PITCH)
      } else {
        // Swoop back over the ring and descend toward the valley center. The
        // chase camera keeps it framed throughout — no orbit tail.
        lx = -120 + 124 * eased
        lz = 90 - 94 * eased
        ly = 45 - 42 * eased
        targetForward = clampPitch(new THREE.Vector3(124, -42, -94), MAX_PITCH)
      }
      if (planeRef.current) {
        planeRef.current.visible = true
        planeRef.current.position.set(lx, ly, lz)
      }
      const planePos = new THREE.Vector3(lx, ly, lz)
      aircraftPos = planePos

      if (key === 'takeoff') {
        // Fixed shot watching the helicopter rise; look below it so it stays
        // clear of the centered name/role text.
        posTarget.lerpVectors(
          new THREE.Vector3(26, 4, 24),
          new THREE.Vector3(20, 12, 18),
          eased,
        )
        lookAt.copy(planePos).add(new THREE.Vector3(0, -6, 0))
      } else if (key === 'flyover') {
        const back = new THREE.Vector3(-Math.sin(planeHeading.current), 0, -Math.cos(planeHeading.current))
        posTarget.copy(planePos).addScaledVector(back, 11).add(new THREE.Vector3(0, 2.5, 0))
        const ahead = new THREE.Vector3(Math.sin(planeHeading.current), 0, Math.cos(planeHeading.current))
        lookAt.copy(planePos).addScaledVector(ahead, 14).add(new THREE.Vector3(0, -14, 0))
      } else {
        // Chase the plane down to its landing spot so it stays centered
        // and fully in frame — no more edge clipping or tiny distant dot.
        const back = new THREE.Vector3(-Math.sin(planeHeading.current), 0, -Math.cos(planeHeading.current))
        posTarget.copy(planePos).addScaledVector(back, 9).add(new THREE.Vector3(0, 1.5, 0))
        const ahead = new THREE.Vector3(Math.sin(planeHeading.current), 0, Math.cos(planeHeading.current))
        lookAt.copy(planePos).addScaledVector(ahead, 12).add(new THREE.Vector3(0, -10, 0))
      }
    } else {
      // ---- Default orbit (geo failed/timed out) ----
      const angle = eased * Math.PI * 1.8
      posTarget.set(Math.sin(angle) * 46, 26 - eased * 14, Math.cos(angle) * 46)
      lookAt.set(0, 0, 0)
    }

    if (targetForward) {
      // Realistic flight controls: the nose follows the flight path (pitching
      // on climbs/descents) and banks into heading changes, smoothly.
      flightForward.current
        .lerp(targetForward, smooth(delta, FORWARD_SMOOTH))
        .normalize()
      planeHeading.current = Math.atan2(
        flightForward.current.x,
        flightForward.current.z,
      )
      const turnRate =
        angleDelta(prevHeading.current, planeHeading.current) /
        Math.max(delta, 1e-4)
      prevHeading.current = planeHeading.current
      const bankTarget = THREE.MathUtils.clamp(
        turnRate * BANK_GAIN,
        -MAX_BANK,
        MAX_BANK,
      )
      bankRef.current +=
        (bankTarget - bankRef.current) * smooth(delta, BANK_SMOOTH)
      if (planeRef.current) {
        orientAircraft(planeRef.current, flightForward.current, bankRef.current)
      }
    }

    if (snap) camera.position.copy(posTarget)
    else camera.position.lerp(posTarget, smooth(delta))
    if (aircraftPos) {
      const cam = camera as THREE.PerspectiveCamera
      lookAt = aimAircraft(aircraftPos, camera.position, lookAt, cam.fov)
    }
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
    </>
  )
}
