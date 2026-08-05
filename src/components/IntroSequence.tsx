import { useEffect, useMemo, useRef, type JSX } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { useStore, type IntroStage } from '../store/useStore'
import {
  orientAircraft,
  aimAircraft,
  wobble,
  angleDelta,
} from '../utils/attitude'
import { transportState } from '../store/transportState'
import { landmarks } from '../data'
import ArrivalPlane from './ArrivalPlane'
import Airport from './Airport'

interface Stage {
  key: IntroStage
  duration: number
}

/**
 * Journey timeline per variant. Both international and Nepal visitors now
 * share the same cinematic flight: taxi on the runway, climb out, then a long
 * slow circuit of the whole sky over the valley and the mountain ring, before
 * turning onto final and touching down back where they started. One minute
 * plus, so the airplane actually reads like an airplane rounding the sky.
 * Geo failure falls back to a short orbit. Every stage is skippable.
 */
const STAGES: Record<string, Stage[]> = {
  air: [
    { key: 'taxi', duration: 9 },
    { key: 'climb', duration: 7 },
    { key: 'circuit', duration: 39 },
    { key: 'approach', duration: 7 },
    { key: 'landing', duration: 8 },
  ],
  local: [
    { key: 'taxi', duration: 9 },
    { key: 'climb', duration: 7 },
    { key: 'circuit', duration: 39 },
    { key: 'approach', duration: 7 },
    { key: 'landing', duration: 8 },
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

// ---------------------------------------------------------------------------
// Flight path: a Catmull-Rom spline through the whole journey, so the airplane
// follows one continuous curve — taxi, climb-out, a long circuit of the sky,
// a descending turn onto final, touchdown and a decelerating rollout. The
// spline's tangent gives the plane's heading/pitch every frame, so it banks
// into every curve exactly like a real airplane.
// ---------------------------------------------------------------------------

// The flight path ends at the FLARE START (18, 1.5, 88), right on the north
// runway's east threshold (z=88, x ∈ [-18, 18]). The plane arrives low and
// slow: a long steady descent on final, then the explicit landing trajectory
// (flare, touchdown, rollout) plays out from the end of this spline.
const SPLINE_POINTS = [
  // Slow taxi on the runway (z=88, x ∈ [-18, 18]) then a gradually eased
  // takeoff roll along the north runway before rotation and climb-out. Ground
  // y=0: the wheels rest on the runway top (y=0.04) via PLANE_BASE_OFFSET.
  new THREE.Vector3(-14, 0, 88),
  new THREE.Vector3(-2, 0, 88),
  new THREE.Vector3(10, 0, 88),
  new THREE.Vector3(18, 0, 88),
  new THREE.Vector3(30, 1.8, 88),
  new THREE.Vector3(44, 6, 88),
  new THREE.Vector3(58, 11, 89),
  new THREE.Vector3(72, 12, 90),
  new THREE.Vector3(104, 40, 56),
  new THREE.Vector3(120, 82, -18),
  new THREE.Vector3(120, 97, -60),
  new THREE.Vector3(80, 99, -112),
  new THREE.Vector3(-70, 99, -112),
  new THREE.Vector3(-120, 97, 20),
  new THREE.Vector3(-76, 94, 112),
  new THREE.Vector3(24, 66, 112),
  // The circuit now clears ALL ring geometry, not just the NE cliff. Over the
  // far ring (radii 205-235, far-peak tips up to y≈50) the aircraft holds ≥56;
  // it stays above the near-ring giants (tips up to ~52) while rounding the
  // east side, then a base-to-final turn passes south of the tall NE near peak
  // (93, 96) — which sits only ~7.8 units off the z=88 runway line, so a
  // straight final would clip its flanks — before lining up on the runway.
  new THREE.Vector3(60, 62, 152),
  new THREE.Vector3(110, 62, 158),
  new THREE.Vector3(145, 62, 158),
  new THREE.Vector3(168, 62, 150),
  new THREE.Vector3(190, 60, 144),
  new THREE.Vector3(198, 56, 128),
  new THREE.Vector3(196, 50, 112),
  new THREE.Vector3(186, 46, 92),
  new THREE.Vector3(176, 38, 72),
  new THREE.Vector3(160, 30, 50),
  new THREE.Vector3(140, 24, 40),
  new THREE.Vector3(116, 19, 36),
  new THREE.Vector3(92, 15, 42),
  new THREE.Vector3(70, 11, 52),
  new THREE.Vector3(50, 8, 64),
  new THREE.Vector3(40, 6, 78),
  new THREE.Vector3(30, 4, 84),
  new THREE.Vector3(18, 1.5, 88),
]

const SEG_LENGTH_SAMPLES = 12

/**
 * Centripetal Catmull-Rom (alpha 0.5) flight path. Unlike uniform Catmull-Rom
 * this parameterization is affine-invariant, so runway segments drawn through
 * collinear control points stay exactly straight and level (uniform CR weaves
 * off-line by up to ~8 units and dips below the runway). Cruise sits at ~97,
 * well above the mountain ring (~52 near / ~58 far), so the plane visibly
 * rounds the sky. The spline's tangent gives the plane's heading/pitch every
 * frame, so it banks into every curve like a real airplane.
 */
class FlightPath {
  private cum: number[] = []
  private tau: Array<[number, number, number]> = []
  private total = 0

  constructor(points: THREE.Vector3[]) {
    const n = points.length
    for (let i = 0; i < n - 1; i++) {
      const p0 = this.getPoint(points, i - 1)
      const p1 = points[i]
      const p2 = points[i + 1]
      const p3 = this.getPoint(points, i + 2)
      const t0 = 0
      const t1 = t0 + Math.sqrt(p1.distanceTo(p0))
      const t2 = t1 + Math.sqrt(p2.distanceTo(p1))
      const t3 = t2 + Math.sqrt(p3.distanceTo(p2))
      this.tau.push([t1, t2, t3])
    }
    this.cum = [0]
    for (let i = 0; i < n - 1; i++) {
      this.cum.push(this.cum[i] + this.segmentLength(points, i))
    }
    this.total = this.cum[n - 1]
  }

  private getPoint(points: THREE.Vector3[], i: number): THREE.Vector3 {
    const n = points.length
    if (i < 0) {
      // Virtual mirrored control point so the takeoff run keeps the runway
      // tangent instead of bending toward the origin.
      return points[0].clone().multiplyScalar(2).sub(points[1])
    }
    if (i >= n) {
      return points[n - 1].clone().multiplyScalar(2).sub(points[n - 2])
    }
    return points[i]
  }

  private static lerpV(
    a: THREE.Vector3,
    b: THREE.Vector3,
    ta: number,
    tb: number,
    t: number,
  ): THREE.Vector3 {
    const w = (tb - t) / (tb - ta)
    return a.clone().multiplyScalar(w).addScaledVector(b, 1 - w)
  }

  private evalSeg(i: number, t: number): THREE.Vector3 {
    const points = SPLINE_POINTS
    const p0 = this.getPoint(points, i - 1)
    const p1 = points[i]
    const p2 = points[i + 1]
    const p3 = this.getPoint(points, i + 2)
    const [t1, t2, t3] = this.tau[i]
    const A = FlightPath.lerpV(p0, p1, 0, t1, t)
    const B = FlightPath.lerpV(p1, p2, t1, t2, t)
    const C = FlightPath.lerpV(p2, p3, t2, t3, t)
    const AB = FlightPath.lerpV(A, B, t1, t2, t)
    const BC = FlightPath.lerpV(B, C, t2, t3, t)
    return FlightPath.lerpV(AB, BC, t1, t2, t)
  }

  private evalSegTangent(i: number, t: number): THREE.Vector3 {
    const h = 1e-4
    return this.evalSeg(i, t + h).sub(this.evalSeg(i, t - h)).multiplyScalar(0.5 / h)
  }

  private segmentLength(points: THREE.Vector3[], i: number): number {
    const [t1, t2] = this.tau[i]
    const prev = points[i].clone()
    let len = 0
    for (let k = 1; k <= SEG_LENGTH_SAMPLES; k++) {
      const t = t1 + (t2 - t1) * (k / SEG_LENGTH_SAMPLES)
      const cur = this.evalSeg(i, t)
      len += cur.distanceTo(prev)
      prev.copy(cur)
    }
    return len
  }

  /** Position + tangent (unnormalized) at arc distance s along the spline. */
  sample(s: number): { pos: THREE.Vector3; tangent: THREE.Vector3 } {
    let i = 0
    while (i < this.cum.length - 2 && s >= this.cum[i + 1]) i++
    const segLen = this.cum[i + 1] - this.cum[i]
    const u = segLen > 0 ? (s - this.cum[i]) / segLen : 0
    const [t1, t2] = this.tau[i]
    const t = t1 + (t2 - t1) * u
    return {
      pos: this.evalSeg(i, t),
      tangent: this.evalSegTangent(i, t),
    }
  }

  /** Time (seconds) -> arc distance along the spline, with a slow taxi, a
   *  gradually eased takeoff roll, cruise, then a long decelerating final
   *  approach so the airplane slows like a real landing. */
  toArc(t: number): number {
    const tc = Math.min(Math.max(t, 0), SPLINE_TIME)
    if (tc <= TAXI_T) return TAXI_SPEED * tc
    if (tc <= TAXI_T + ROLL_T) {
      // Eased takeoff roll: speed ramps TAXI_SPEED -> ROLL_SPEED (easeInQuad),
      // so the airplane visibly accelerates down the runway before rotation.
      const u = (tc - TAXI_T) / ROLL_T
      return (
        TAXI_DIST +
        TAXI_SPEED * (tc - TAXI_T) +
        (ROLL_SPEED - TAXI_SPEED) * ROLL_T * (u * u * u) / 3
      )
    }
    if (tc <= TAXI_T + ROLL_T + CLIMB_T) {
      // Initial climb: ease ROLL_SPEED -> V0 (smoothstep) while pitching up.
      const u = (tc - TAXI_T - ROLL_T) / CLIMB_T
      const s = u * u * u - u * u * u * u / 2
      return (
        TAXI_DIST + ROLL_DIST +
        ROLL_SPEED * (tc - TAXI_T - ROLL_T) +
        (V0 - ROLL_SPEED) * CLIMB_T * s
      )
    }
    if (tc <= DECEL_T1) {
      const cruiseStart = TAXI_T + ROLL_T + CLIMB_T
      return (
        TAXI_DIST + ROLL_DIST + CLIMB_DIST(V0) +
        V0 * (tc - cruiseStart)
      )
    }
    const tau = tc - DECEL_T1
    return (
      TAXI_DIST + ROLL_DIST + CLIMB_DIST(V0) +
      V0 * (DECEL_T1 - (TAXI_T + ROLL_T + CLIMB_T)) +
      V0 * tau - 0.5 * DECEL_A * tau * tau
    )
  }

  get length(): number {
    return this.total
  }
}

const flightPath = new FlightPath(SPLINE_POINTS)

// ---------------------------------------------------------------------------
// Approach / landing speed profile.
//
// The spline is flown in 62s (taxi + climb + circuit + approach). Cruise at a
// constant V0, then over the last DECEL_DIST units of final approach decelerate
// to APPROACH_SPEED, arriving at the flare point exactly at t=62. V0 is solved
// so that V0·62 − DECEL_DIST(Δv terms) = total spline length.
// ---------------------------------------------------------------------------

const SPLINE_TIME = 62
const APPROACH_SPEED = 7 // speed at the flare point (~135 m/s full scale)
const DECEL_DIST = 100 // units of decelerating final approach

// Takeoff profile: a slow taxi (TAXI_SPEED for TAXI_T seconds), then a
// gradually eased takeoff roll (speed ramps TAXI_SPEED -> ROLL_SPEED over
// ROLL_T seconds so the airplane visibly accelerates down the runway before
// rotation), an initial climb easing on to cruise speed V0, steady cruise,
// then the long decelerating final approach. V0 is solved so the whole spline
// is traversed in exactly SPLINE_TIME seconds.
const TAXI_T = 4
const TAXI_SPEED = 1.5
const ROLL_T = 5
const ROLL_SPEED = 12
const CLIMB_T = 4

const TAXI_DIST = TAXI_SPEED * TAXI_T
const ROLL_DIST =
  TAXI_SPEED * ROLL_T + ((ROLL_SPEED - TAXI_SPEED) * ROLL_T) / 3
const CLIMB_DIST = (v: number) =>
  ROLL_SPEED * CLIMB_T + ((v - ROLL_SPEED) * CLIMB_T) / 2

// total(V0) = taxi + roll + climb + V0·(cruise time) + DECEL_DIST = spline
// length. Monotone in V0, so bisect for the exact cruise speed.
const V0 = (() => {
  const cruiseStart = TAXI_T + ROLL_T + CLIMB_T
  const total = (v: number) => {
    const decelDt = (2 * DECEL_DIST) / (v + APPROACH_SPEED)
    const decelT1 = SPLINE_TIME - decelDt
    return (
      TAXI_DIST +
      ROLL_DIST +
      CLIMB_DIST(v) +
      v * (decelT1 - cruiseStart) +
      DECEL_DIST
    )
  }
  let lo = APPROACH_SPEED + 0.01
  let hi = 80
  for (let i = 0; i < 100; i++) {
    const mid = (lo + hi) / 2
    if (total(mid) > flightPath.length) hi = mid
    else lo = mid
  }
  return (lo + hi) / 2
})()
const DECEL_DT = (V0 - APPROACH_SPEED) / ((V0 * V0 - APPROACH_SPEED * APPROACH_SPEED) / (2 * DECEL_DIST))
const DECEL_T1 = SPLINE_TIME - DECEL_DT
const DECEL_A = (V0 - APPROACH_SPEED) / DECEL_DT

// ---------------------------------------------------------------------------
// Landing trajectory (flare, touchdown, rollout) — explicit, not spline, so
// the plane's pitch and sink are fully controlled for a realistic landing:
//   1. FLARE      — 2s over the runway threshold (x 18 -> 7), nose pitches
//                   1.5° -> 6° and the descent rate eases from ~1.4 to ~0 u/s
//                   (rounding out, main gear low)
//   2. TOUCHDOWN  — at pitch 6° the main gear (a touch ahead of the group
//                   centre) contacts the tarmac first, then a short settle
//                   drops the nose (pitch -> 0) with a tiny bounce
//   3. ROLLOUT    — smooth deceleration to a stop (x = 7 -> -12)
// ---------------------------------------------------------------------------

const easeOutQuad = (t: number) => 1 - Math.pow(1 - t, 2)
const DEG = Math.PI / 180

function landingTrajectory(
  tau: number,
): { x: number; y: number; z: number; pitchRad: number } {
  if (tau < 2) {
    // FLARE
    const u = tau / 2
    return {
      x: 18 - 5.5 * tau,
      // y'' = -2·0.3475 (constant reduction of sink); sink 1.38 -> ~0 u/s,
      // ending at y=0.13 so the main gear meets the runway at 6° nose-up.
      y: 1.5 - 1.38 * tau + 0.3475 * tau * tau,
      z: 88,
      pitchRad: (1.5 + 4.5 * easeOutQuad(u)) * DEG,
    }
  }
  // ROLLOUT (+ nose-gear settle + subtle bounce)
  const u = Math.min((tau - 2) / 6, 1)
  const e = easeOutQuad(u)
  const n = Math.min(u / 0.13, 1)
  let y = 0.13 - 0.13 * easeOutQuad(n) + 0.04 * Math.sin(Math.PI * n)
  if (y < 0) y = 0
  return {
    x: 7 - 19 * e,
    y,
    z: 88,
    pitchRad: 6 * (1 - n) * DEG,
  }
}

const MAX_BANK = 0.15
const BANK_GAIN = 0.5
const FORWARD_SMOOTH = 2.4
const BANK_SMOOTH = 3.5

/**
 * Per-stage wind turbulence strength: invisible on the runway, gentle in
 * cruise, moderate on the descent. Kept low on final approach so the landing
 * stays wings-level and steady (the flare is fully controlled).
 */
const TURB_STRENGTH: Record<IntroStage, number> = {
  taxi: 0.06,
  climb: 0.5,
  circuit: 0.45,
  approach: 0.3,
  landing: 0.08,
  orbit: 0,
}

/** Total length of the 70s airplane journey, used for arc-length timing. */
const TOTAL_TIME = STAGES.air.reduce((a, s) => a + s.duration, 0)

/** Length of the current variant's stage list (may be much shorter). */
const totalFor = (stages: Stage[]) => stages.reduce((a, s) => a + s.duration, 0)

/**
 * Cinematic arrival intro. Waits for IP geolocation, then plays the shared
 * journey: taxi, a slow full circuit of the sky over the valley and mountain
 * ring, then a real approach, touchdown and rollout on the airport runway.
 * The same airplane model reads identically close-up and far away. Skip is
 * always available.
 */
export default function IntroSequence(): JSX.Element {
  const { camera } = useThree()
  const geoResolved = useStore((s) => s.geoResolved)
  const variant = useStore((s) => s.introVariant)
  const skipIntro = useStore((s) => s.skipIntro)
  const setIntroStage = useStore((s) => s.setIntroStage)
  const setIntroCaption = useStore((s) => s.setIntroCaption)
  const setParkedPlane = useStore((s) => s.setParkedPlane)
  const planeRef = useRef<THREE.Group>(null)
  const elapsed = useRef(0)
  const done = useRef(false)
  const started = useRef(false)
  const currentStage = useRef<IntroStage>('orbit')
  const planeHeading = useRef(0)
  const flightForward = useRef(new THREE.Vector3(0, 0, 1))
  const bankRef = useRef(0)
  const prevHeading = useRef(0)
  const passIdx = useRef(0)
  const captionTimer = useRef<number | undefined>(undefined)
  const landingLog = useRef<Set<number>>(new Set())
  const lastPlaneY = useRef<number | null>(null)
  const smoothLook = useRef<THREE.Vector3 | null>(null)

  const stages = STAGES[variant] ?? STAGES.standard

  /**
   * The instant (in flight seconds) at which the plane flies closest to each
   * landmark, so the intro can caption "Below: …" as it passes. Computed once
   * by sampling the whole spline in time; only passes within 85m count, and
   * they're spaced ≥7s apart so captions never overlap.
   */
  const passes = useMemo(() => {
    if (variant === 'standard') return []
    const out: { t: number; label: string }[] = []
    const N = 600
    for (const lm of landmarks) {
      let bestT = 0
      let bestD = Infinity
      for (let i = 0; i <= N; i++) {
        const t = i / N
        const s = flightPath.toArc(t * SPLINE_TIME)
        const { pos } = flightPath.sample(s)
        const d = Math.hypot(pos.x - lm.position[0], pos.z - lm.position[2])
        if (d < bestD) {
          bestD = d
          bestT = t
        }
      }
      if (bestD < 85) out.push({ t: bestT * SPLINE_TIME, label: lm.label })
    }
    out.sort((a, b) => a.t - b.t)
    const spaced: typeof out = []
    let last = -10
    for (const p of out) {
      if (p.t - last >= 7) {
        spaced.push(p)
        last = p.t
      }
    }
    return spaced
  }, [variant])

  useEffect(() => {
    // StrictMode in dev unmounts/remounts the intro; the cleanup sets
    // done.current, so reset it on (re)mount or the flight never starts.
    done.current = false
    started.current = false
    elapsed.current = 0
    camera.position.set(0, 26, 42)
    camera.lookAt(0, 0, 0)
    return () => {
      done.current = true
      setIntroStage('orbit')
      setIntroCaption(null)
      if (captionTimer.current) window.clearTimeout(captionTimer.current)
    }
  }, [camera, setIntroStage, setIntroCaption])

  useFrame((_, delta) => {
    if (done.current || !geoResolved) return
    if (!started.current) {
      started.current = true
      const t0 = flightPath.sample(0).tangent.clone().normalize()
      planeHeading.current = Math.atan2(t0.x, t0.z)
      prevHeading.current = planeHeading.current
      flightForward.current.copy(t0)
    } else {
      elapsed.current += delta
    }

    const { key, eased } = stageInfo(elapsed.current, stages)
    if (key !== currentStage.current) {
      currentStage.current = key
      setIntroStage(key)
    }

    const snap = elapsed.current === 0
    let posTarget = new THREE.Vector3(0, 26, 42)
    let lookAt = new THREE.Vector3(0, 0, 0)
    let aircraftPos: THREE.Vector3 | null = null
    // Where the aircraft should sit in screen space for this shot (see
    // attitude.aimAircraft). Kept on the plane so the name/role never overlap.
    let ndc = { x: 0, y: 0.55 }

    if (variant === 'standard') {
      // ---- Default orbit (geo failed/timed out) ----
      const angle = eased * Math.PI * 1.8
      posTarget.set(Math.sin(angle) * 46, 26 - eased * 14, Math.cos(angle) * 46)
      lookAt.set(0, 0, 0)
    } else {
      // ---- Shared airplane journey along the spline, then the explicit
      // landing trajectory (flare -> touchdown -> rollout) once the spline is
      // exhausted at t = SPLINE_TIME. ----
      const tFlight = Math.min(elapsed.current, TOTAL_TIME)
      let planePos: THREE.Vector3
      let desired: THREE.Vector3

      if (tFlight <= SPLINE_TIME) {
        const s = flightPath.toArc(tFlight)
        const { pos, tangent } = flightPath.sample(s)
        planePos = pos.clone()

        // Wind buffeting: a gentle deterministic shake in altitude and bank that
        // grows with airspeed so the airplane visibly fights the air instead of
        // sliding along a fixed rail. Silent on the runway, calm on final.
        const turb = TURB_STRENGTH[key] ?? 0
        if (turb > 0) planePos.y += wobble(elapsed.current * 1.35) * turb * 0.45

        desired = tangent.clone().normalize()
        // Rolling out onto final: level the wings and raise the nose slightly
        // (a real approach flies nose-up into a shallow descent, it does not
        // dive along the flight path). Blends in as the heading settles on -X.
        if (key === 'approach') {
          const h = Math.atan2(desired.x, desired.z)
          const prox = 1 - Math.min(Math.abs(angleDelta(h, -Math.PI / 2)) / 0.5, 1)
          if (prox > 0.001) {
            const p = 1.5 * prox * DEG
            desired.set(
              Math.sin(h) * Math.cos(p),
              Math.sin(p),
              Math.cos(h) * Math.cos(p),
            )
          }
        }
      } else {
        const st = landingTrajectory(tFlight - SPLINE_TIME)
        planePos = new THREE.Vector3(st.x, st.y, st.z)
        desired = new THREE.Vector3(
          -Math.cos(st.pitchRad),
          Math.sin(st.pitchRad),
          0,
        )
      }
      aircraftPos = planePos

      const tgt = desired.clone()
      // Roll out crisply: as the flight path swings around onto final (heading
      // converging on -X) ease the heading-settle rate up, so the aircraft is
      // dead-straight on the runway line before the "Final approach…" caption.
      const proxFinal =
        1 -
        Math.min(
          Math.abs(angleDelta(Math.atan2(desired.x, desired.z), -Math.PI / 2)) / 1.2,
          1,
        )
      const fwdRate = FORWARD_SMOOTH + (5 - FORWARD_SMOOTH) * proxFinal
      flightForward.current
        .lerp(tgt, smooth(delta, fwdRate))
        .normalize()
      planeHeading.current = Math.atan2(
        flightForward.current.x,
        flightForward.current.z,
      )
      const turnRate =
        Math.atan2(
          Math.sin(planeHeading.current - prevHeading.current),
          Math.cos(planeHeading.current - prevHeading.current),
        ) / Math.max(delta, 1e-4)
      prevHeading.current = planeHeading.current
      const turb = TURB_STRENGTH[key] ?? 0
      const bankTarget = THREE.MathUtils.clamp(
        turnRate * BANK_GAIN + wobble(elapsed.current * 1.9) * turb * 0.18,
        -MAX_BANK - 0.06,
        MAX_BANK + 0.06,
      )
      bankRef.current +=
        (bankTarget - bankRef.current) * smooth(delta, BANK_SMOOTH)
      if (planeRef.current) {
        planeRef.current.visible = true
        planeRef.current.position.copy(planePos)
        orientAircraft(planeRef.current, flightForward.current, bankRef.current)
      }

      // ---- Landing flight-data log: pitch attitude + sink rate at key
      // moments, so the flare reads in the numbers (pitch rises, sink drops). ----
      const pitchNow =
        (Math.asin(
          Math.max(-1, Math.min(1, flightForward.current.y)),
        ) * 180) / Math.PI
      const sinkNow =
        lastPlaneY.current === null
          ? 0
          : (lastPlaneY.current - planePos.y) / Math.max(delta, 1e-4)
      lastPlaneY.current = planePos.y
      const logT = elapsed.current
      if (logT >= 53.5 && !landingLog.current.has(1)) {
        landingLog.current.add(1)
        console.log(
          `[landing] FINAL APPROACH START t=${logT.toFixed(1)}s  pitch=${pitchNow.toFixed(2)}°  sink=${sinkNow.toFixed(2)} u/s`,
        )
      }
      if (logT >= 58 && !landingLog.current.has(2)) {
        landingLog.current.add(2)
        console.log(
          `[landing] MID-APPROACH          t=${logT.toFixed(1)}s  pitch=${pitchNow.toFixed(2)}°  sink=${sinkNow.toFixed(2)} u/s`,
        )
      }
      if (logT >= 62 && !landingLog.current.has(3)) {
        landingLog.current.add(3)
        console.log(
          `[landing] FLARE START           t=${logT.toFixed(1)}s  pitch=${pitchNow.toFixed(2)}°  sink=${sinkNow.toFixed(2)} u/s`,
        )
      }
      if (logT >= 64.1 && !landingLog.current.has(4)) {
        landingLog.current.add(4)
        console.log(
          `[landing] TOUCHDOWN             t=${logT.toFixed(1)}s  pitch=${pitchNow.toFixed(2)}°  sink=${sinkNow.toFixed(2)} u/s`,
        )
      }
      if (logT >= 66 && !landingLog.current.has(5)) {
        landingLog.current.add(5)
        console.log(
          `[landing] ROLLOUT               t=${logT.toFixed(1)}s  pitch=${pitchNow.toFixed(2)}°  sink=${sinkNow.toFixed(2)} u/s`,
        )
      }
      ;(window as any).__landingProbe = {
        t: elapsed.current,
        pitch: pitchNow,
        sink: sinkNow,
        y: planePos.y,
        x: planePos.x,
      }
      if ((window as any).__probeRequested) {
        ;(window as any).__probe = {
          t: elapsed.current,
          planeY: planePos.y,
          planeX: planePos.x,
          planeZ: planePos.z,
          planeHeading: (planeHeading.current * 180) / Math.PI,
          camY: camera.position.y,
          camX: camera.position.x,
          camZ: camera.position.z,
        }
      }
      const chase = (backDist: number, up: number, aheadDist: number, down: number) => {
        const back = new THREE.Vector3(
          -Math.sin(planeHeading.current),
          0,
          -Math.cos(planeHeading.current),
        )
        posTarget.copy(planePos).addScaledVector(back, backDist).add(new THREE.Vector3(0, up, 0))
        const ahead = new THREE.Vector3(
          Math.sin(planeHeading.current),
          0,
          Math.cos(planeHeading.current),
        )
        lookAt.copy(planePos).addScaledVector(ahead, aheadDist).add(new THREE.Vector3(0, -down, 0))
      }
      if (key === 'taxi') {
        // Tracking side-front shot: hangs beside the runway as the airplane
        // taxis slowly, then visibly accelerates down the runway and rotates
        // into the climb (the passing runway + nose pitch-up read the speed).
        ndc = { x: 0, y: 0.5 }
        posTarget.copy(planePos).add(new THREE.Vector3(24, 3.4, 18))
        lookAt.copy(planePos).add(new THREE.Vector3(0, -3, 0))
      } else if (key === 'climb') {
        chase(15, 3, 20, -18)
      } else if (key === 'circuit') {
        // One steady chase for the whole circuit — level, gentle bank, the
        // plane framed center with the valley sweeping below. Pulls back a
        // touch for the second half so the sky view never quite repeats.
        if (eased < 0.45) chase(16, 4, 22, -22)
        else chase(24, 6, 28, -24)
      } else if (key === 'approach') {
        chase(13, 2, 16, -14)
      } else {
        // Landing: chase behind the plane but keep it framed in the distance —
        // far enough back and looking level-ish along the runway that the
        // white fuselage can never fill the screen when the nose settles.
        ndc = { x: 0, y: 0.4 }
        chase(18, 3, 16, 6)
      }

      // Caption the landmarks the plane passes beneath on the circuit.
      while (
        passIdx.current < passes.length &&
        elapsed.current >= passes[passIdx.current].t
      ) {
        const p = passes[passIdx.current]
        passIdx.current++
        setIntroCaption(p.label)
        if (captionTimer.current) window.clearTimeout(captionTimer.current)
        captionTimer.current = window.setTimeout(
          () => setIntroCaption(null),
          4200,
        )
      }
    }

    if (snap) camera.position.copy(posTarget)
    else camera.position.lerp(posTarget, smooth(delta))
    if (aircraftPos) {
      const cam = camera as THREE.PerspectiveCamera
      lookAt = aimAircraft(aircraftPos, camera.position, lookAt, cam, ndc)
    }
    // Ease the gaze so a stage/camera change (flare -> touchdown) never whips
    // the view across the aircraft mid-settle.
    if (smoothLook.current) smoothLook.current.lerp(lookAt, smooth(delta, 5))
    else smoothLook.current = lookAt.clone()
    camera.lookAt(smoothLook.current)

    const stageTotal = totalFor(stages)
    if (elapsed.current >= stageTotal) {
      done.current = true
      // The plane rolls to a stop at the end of the runway facing -Z; the
      // soldier climbs out there and steps a few paces before the player
      // takes over.
      const parked = planeRef.current
      setParkedPlane(
        parked
          ? {
              x: parked.position.x,
              y: parked.position.y,
              z: parked.position.z,
              heading: planeHeading.current,
            }
          : { x: -12, y: 0, z: 88, heading: -Math.PI / 2 },
      )
      transportState.spawnWalk = {
        from: { x: -12, z: 88 },
        to: { x: -8, z: 90 },
      }
      transportState.walk = {
        x: -8,
        z: 90,
        y: 0.91,
        heading: Math.PI,
      }
      skipIntro()
    }
  })

  return (
    <>
      {variant !== 'standard' && <Airport />}
      <ArrivalPlane ref={planeRef} />
    </>
  )
}
