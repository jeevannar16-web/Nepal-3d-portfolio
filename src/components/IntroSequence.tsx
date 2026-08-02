import { useEffect, useMemo, useRef, type JSX } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { useStore, type IntroStage } from '../store/useStore'
import { orientAircraft, aimAircraft, wobble } from '../utils/attitude'
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
    { key: 'taxi', duration: 4 },
    { key: 'climb', duration: 7 },
    { key: 'circuit', duration: 42 },
    { key: 'approach', duration: 9 },
    { key: 'landing', duration: 8 },
  ],
  local: [
    { key: 'taxi', duration: 4 },
    { key: 'climb', duration: 7 },
    { key: 'circuit', duration: 42 },
    { key: 'approach', duration: 9 },
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

const SPLINE_POINTS = [
  new THREE.Vector3(-14, 0.06, 88),
  new THREE.Vector3(14, 0.06, 88),
  new THREE.Vector3(42, 2.5, 88),
  new THREE.Vector3(72, 12, 90),
  new THREE.Vector3(104, 40, 56),
  new THREE.Vector3(120, 82, -18),
  new THREE.Vector3(120, 97, -60),
  new THREE.Vector3(80, 99, -112),
  new THREE.Vector3(-70, 99, -112),
  new THREE.Vector3(-120, 97, 20),
  new THREE.Vector3(-76, 94, 112),
  new THREE.Vector3(24, 92, 112),
  new THREE.Vector3(96, 55, 88),
  new THREE.Vector3(55, 8, 88),
  new THREE.Vector3(18, 0.06, 88),
  new THREE.Vector3(-16, 0.06, 88),
]

const SEG_LENGTH_SAMPLES = 12

/**
 * Centripetal Catmull-Rom (alpha 0.5) flight path. Unlike uniform Catmull-Rom
 * this parameterization is affine-invariant, so runway segments drawn through
 * collinear control points stay exactly straight and level (uniform CR weaves
 * off-line by up to ~8 units and dips below the runway). Cruise sits at ~100,
 * well above the mountain ring (~52 near / ~58 far), so the plane visibly
 * rounds the sky. The spline's tangent gives the plane's heading/pitch every
 * frame, so it banks into every curve like a real airplane.
 */
class FlightPath {
  private cum: number[] = []
  private tau: Array<[number, number, number]> = []
  private total = 0
  readonly rollout: number

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
    this.rollout = this.cum[n - 1] - this.cum[n - 2]
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

  /** Time (0..1) -> arc distance, with a decelerating rollout on the last run. */
  toArc(t: number, totalTime: number): number {
    const lr = this.rollout
    const v = (this.total + lr) / totalTime
    const t2 = (2 * lr) / v
    const t1 = totalTime - t2
    if (t <= t1) return v * t
    const u = Math.min((t - t1) / t2, 1)
    return this.total - lr + lr * (u * (2 - u))
  }

  get length(): number {
    return this.total
  }
}

const flightPath = new FlightPath(SPLINE_POINTS)

const MAX_BANK = 0.15
const BANK_GAIN = 0.5
const FORWARD_SMOOTH = 2.4
const BANK_SMOOTH = 3.5

/**
 * Per-stage wind turbulence strength: invisible on the runway, gentle in
 * cruise, strongest on the descent where airspeed is highest.
 */
const TURB_STRENGTH: Record<IntroStage, number> = {
  taxi: 0.06,
  climb: 0.5,
  circuit: 0.45,
  approach: 0.7,
  landing: 0.12,
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
        const s = flightPath.toArc(t * TOTAL_TIME, TOTAL_TIME)
        const { pos } = flightPath.sample(s)
        const d = Math.hypot(pos.x - lm.position[0], pos.z - lm.position[2])
        if (d < bestD) {
          bestD = d
          bestT = t
        }
      }
      if (bestD < 85) out.push({ t: bestT * TOTAL_TIME, label: lm.label })
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
      // ---- Shared airplane journey along the spline ----
      // toArc takes elapsed *seconds* (its internal t1/t2 thresholds are in
      // seconds); passing the 0..1 fraction would stall the plane near the
      // runway for the entire intro.
      const s = flightPath.toArc(
        Math.min(elapsed.current, TOTAL_TIME),
        TOTAL_TIME,
      )
      const { pos, tangent } = flightPath.sample(s)
      const planePos = pos.clone()
      aircraftPos = planePos

      // Wind buffeting: a gentle deterministic shake in altitude and bank that
      // grows with airspeed so the airplane visibly fights the air instead of
      // sliding along a fixed rail.
      const turb = TURB_STRENGTH[key] ?? 0
      if (turb > 0) planePos.y += wobble(elapsed.current * 1.35) * turb * 0.45

      const tgt = tangent.clone().normalize()
      flightForward.current
        .lerp(tgt, smooth(delta, FORWARD_SMOOTH))
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
        // Fixed shot beside the runway watching the ground roll and rotation.
        ndc = { x: 0, y: 0.5 }
        posTarget.lerpVectors(
          new THREE.Vector3(24, 3, 102),
          new THREE.Vector3(26, 5, 96),
          eased,
        )
        lookAt.copy(planePos).add(new THREE.Vector3(0, -2, 0))
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
        // Landing: low chase behind the plane on the runway roll-out.
        chase(10, 1.5, 12, -8)
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
    camera.lookAt(lookAt)

    const stageTotal = totalFor(stages)
    if (elapsed.current >= stageTotal) {
      done.current = true
      // The plane rolls to a stop at the end of the runway facing -Z; the
      // soldier climbs out there and steps a few paces before the player
      // takes over.
      transportState.spawnWalk = {
        from: { x: -12, z: 88 },
        to: { x: -8, z: 90 },
      }
      transportState.walk = {
        x: -8,
        z: 90,
        y: 0.5,
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
