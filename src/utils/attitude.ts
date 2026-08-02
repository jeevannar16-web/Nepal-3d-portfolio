import * as THREE from 'three'

const WORLD_UP = new THREE.Vector3(0, 1, 0)

/** Where the aircraft should sit in screen space (-1..1) for cinematic framing. */
export interface AimNdc {
  x: number
  y: number
}

/**
 * Smooth pseudo-noise in [-1, 1] at ~1-2 Hz, for wind buffeting and turbulence.
 * Deterministic and cheap — a few summed sines instead of a proper simplex.
 */
export function wobble(t: number): number {
  return (
    Math.sin(t * 2.7) * 0.55 +
    Math.sin(t * 5.1 + 1.7) * 0.3 +
    Math.sin(t * 9.3 + 4.2) * 0.15
  )
}

/**
 * Orient `group` so its local +Z (the plane's nose) points along `forward`
 * with a roll around it. `bank` is in radians; positive banks right (right
 * wing dips down). Builds the rotation from the right/up/forward basis so the
 * attitude is exact regardless of Euler order.
 */
export function orientAircraft(
  group: THREE.Object3D,
  forward: THREE.Vector3,
  bank: number,
): void {
  const zAxis = forward.clone().normalize()
  if (zAxis.lengthSq() < 1e-6) return
  const refUp =
    Math.abs(zAxis.y) > 0.999 ? new THREE.Vector3(0, 0, 1) : WORLD_UP
  const right = new THREE.Vector3().crossVectors(refUp, zAxis)
  if (right.lengthSq() < 1e-8) return
  right.normalize()
  right.applyQuaternion(new THREE.Quaternion().setFromAxisAngle(zAxis, -bank))
  const up = new THREE.Vector3().crossVectors(zAxis, right)
  group.quaternion.setFromRotationMatrix(
    new THREE.Matrix4().makeBasis(right, up, zAxis),
  )
}

/**
 * Return a unit vector along the same horizontal heading as `forward` with its
 * pitch clamped to `maxPitch` radians either side of level. Keeps the nose from
 * pointing straight up/down on extreme cinematic paths.
 */
export function clampPitch(
  forward: THREE.Vector3,
  maxPitch: number,
): THREE.Vector3 {
  const horiz = Math.hypot(forward.x, forward.z)
  if (horiz < 1e-6) return forward.clone().normalize()
  const pitch = Math.asin(
    Math.max(-1, Math.min(1, forward.y / forward.length())),
  )
  const clamped = Math.max(-maxPitch, Math.min(maxPitch, pitch))
  const s = Math.cos(clamped)
  return new THREE.Vector3(
    (forward.x / horiz) * s,
    Math.sin(clamped),
    (forward.z / horiz) * s,
  )
}

/** Signed shortest angular difference, wrapped to [-PI, PI]. */
export function angleDelta(from: number, to: number): number {
  let d = to - from
  while (d > Math.PI) d -= Math.PI * 2
  while (d < -Math.PI) d += Math.PI * 2
  return d
}

/**
 * Re-aim `lookAt` (pitched around the camera's right axis and yawed around its
 * up axis) so the aircraft's center lands at `ndc` in screen space. The camera
 * keeps its own orbit; only the gaze pivots. Default (0, 0.55) keeps the plane
 * clear of centered title text; cinematic shots pass other framings (wing
 * close-up, hero silhouette) via `ndc`.
 */
export function aimAircraft(
  acPos: THREE.Vector3,
  camPos: THREE.Vector3,
  lookAt: THREE.Vector3,
  cam: THREE.PerspectiveCamera,
  ndc: AimNdc = { x: 0, y: 0.55 },
): THREE.Vector3 {
  const arm = camPos.distanceTo(lookAt)
  if (arm < 1e-4) return lookAt
  const fwd = lookAt.clone().sub(camPos).normalize()
  const right = new THREE.Vector3().crossVectors(fwd, WORLD_UP)
  if (right.lengthSq() < 1e-6) return lookAt
  right.normalize()
  const upV = new THREE.Vector3().crossVectors(right, fwd)
  const d = acPos.clone().sub(camPos)
  const fovRad = (cam.fov * Math.PI) / 360
  const aspect = Math.max(cam.aspect, 1e-3)

  // Pitch: align the aircraft's vertical offset from the gaze line.
  const thetaY = Math.atan2(d.dot(upV), d.dot(fwd))
  const targetY = Math.atan(ndc.y * Math.tan(fovRad))
  const qY = new THREE.Quaternion().setFromAxisAngle(right, thetaY - targetY)
  fwd.applyQuaternion(qY)

  // Yaw: align its horizontal offset (aspect-aware so X is truly fraction of
  // screen width, not of the vertical FOV).
  const thetaX = Math.atan2(d.dot(right), d.dot(fwd))
  const targetX = Math.atan(ndc.x * Math.tan(fovRad) * aspect)
  const qX = new THREE.Quaternion().setFromAxisAngle(upV, thetaX - targetX)
  fwd.applyQuaternion(qX)

  return camPos.clone().addScaledVector(fwd, arm)
}
