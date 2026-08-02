import * as THREE from 'three'

const WORLD_UP = new THREE.Vector3(0, 1, 0)

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
