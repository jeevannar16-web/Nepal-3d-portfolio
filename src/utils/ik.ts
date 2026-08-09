import * as THREE from 'three'

const _jPos = new THREE.Vector3()
const _toEff = new THREE.Vector3()
const _toTgt = new THREE.Vector3()
const _effPos = new THREE.Vector3()
const _axis = new THREE.Vector3()
const _qa = new THREE.Quaternion()
const _qb = new THREE.Quaternion()
const _handPos = new THREE.Vector3()
const _fwdPt = new THREE.Vector3()

export interface ArmChain {
  /** Clavicle (e.g. LeftShoulder) — root of the arm, child of chest. */
  clavicle: THREE.Bone
  /** Upper arm (e.g. LeftArm) — pivots at the shoulder. */
  shoulder: THREE.Bone
  /** Forearm (e.g. LeftForeArm) — pivots at the elbow. */
  elbow: THREE.Bone
  /** Hand (e.g. LeftHand) — the effector, pivots at the wrist. */
  hand: THREE.Bone
}

/**
 * Apply a rotation about a *world-space* axis to a bone, then re-derive that
 * bone's local quaternion so it stacks correctly under its parent. Descendants
 * (including the hand effector) get their world matrices refreshed.
 */
export function rotateOnWorldAxis(
  bone: THREE.Bone,
  worldAxis: THREE.Vector3,
  angle: number,
): void {
  const worldQ = bone.getWorldQuaternion(_qa)
  const dq = new THREE.Quaternion().setFromAxisAngle(worldAxis, angle)
  const newWorldQ = dq.clone().multiply(worldQ)
  const parent = bone.parent as THREE.Bone | null
  const parentWorldQ = parent ? parent.getWorldQuaternion(_qb) : new THREE.Quaternion()
  bone.quaternion.copy(parentWorldQ).invert().multiply(newWorldQ)
  bone.updateWorldMatrix(true, true)
}

/**
 * CCD IK: swing the elbow/shoulder/clavicle joints so the hand reaches
 * `target`, then orient the hand to grip along `barForward` (world, horizontal)
 * with the palm pronated. `clampRoot` limits how aggressively the clavicle
 * (root of the chain) twists, keeping shoulders from popping.
 */
export function solveArmCCD(
  chain: ArmChain,
  target: THREE.Vector3,
  barForward: THREE.Vector3,
  iterations = 12,
  clampRoot = 0.4,
): void {
  const joints = [chain.elbow, chain.shoulder, chain.clavicle] // tip -> root
  const eff = chain.hand

  for (let it = 0; it < iterations; it++) {
    const effPos = eff.getWorldPosition(_effPos)
    if (effPos.distanceTo(target) < 1e-4) break

    for (let i = 0; i < joints.length; i++) {
      const joint = joints[i]
      joint.getWorldPosition(_jPos)
      _toEff.copy(effPos).sub(_jPos) // joint -> effector
      _toTgt.copy(target).sub(_jPos) // joint -> target
      if (_toEff.lengthSq() < 1e-8 || _toTgt.lengthSq() < 1e-8) continue
      _axis.crossVectors(_toEff, _toTgt)
      if (_axis.lengthSq() < 1e-10) continue
      _axis.normalize()
      const angle = _toEff.angleTo(_toTgt)
      if (angle < 1e-4) continue
      const clamped = i === joints.length - 1 ? Math.min(angle, clampRoot) : angle
      rotateOnWorldAxis(joint, _axis, clamped)
      eff.getWorldPosition(_effPos) // refresh effector for the next joint
    }
  }

  // Orient the hand to grip the bar: fingers point along barForward, palm
  // pronated ~-35° so the grip reads as holding (not waving).
  const handPos = eff.getWorldPosition(_handPos)
  const up = new THREE.Vector3(0, 1, 0)
  const f = new THREE.Vector3().copy(barForward).normalize()
  if (Math.abs(f.dot(up)) > 0.999) up.set(0, 0, 1)
  const roll = new THREE.Quaternion().setFromAxisAngle(f, -0.6)
  _fwdPt.copy(handPos).add(f)
  const des = new THREE.Quaternion().setFromRotationMatrix(
    new THREE.Matrix4().lookAt(handPos, _fwdPt, up),
  )
  des.multiply(roll).normalize()
  const parentWorldQ = (eff.parent as THREE.Bone).getWorldQuaternion(_qb)
  eff.quaternion.copy(parentWorldQ).invert().multiply(des)
  eff.updateWorldMatrix(true, true)
}
