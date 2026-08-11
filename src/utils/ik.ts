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
const _rigFinger = new THREE.Vector3()
const _rigPalm = new THREE.Vector3()
const _rigW = new THREE.Vector3()
const _fingerT = new THREE.Vector3()
const _widthT = new THREE.Vector3()
const _palmT = new THREE.Vector3()
const _gripUp = new THREE.Vector3()
const _A3 = new THREE.Matrix3()
const _B3 = new THREE.Matrix3()
const _R4 = new THREE.Matrix4()
const _dq = new THREE.Quaternion()
const _bendX = new THREE.Vector3(1, 0, 0)
const _bendZ = new THREE.Vector3(0, 0, 1)

/**
 * The rig's hand-local grip geometry (pose-invariant) plus the finger bones to
 * curl, captured once at bind time so the per-frame grip pose is a pure read of
 * cached axes. Built by measureGripAxes + a GripRig collector.
 */
export interface GripRig {
  /** Distal finger direction, in the hand's local frame. */
  finger: THREE.Vector3
  /** Index→pinky width, in the hand's local frame. */
  width: THREE.Vector3
  /** Palm-out normal, in the hand's local frame (left = width×finger, right = its negation). */
  palm: THREE.Vector3
  /** Phalanx bones (bend order, base→tip) with the curl angle per joint. */
  fingers: Array<{ bones: THREE.Bone[]; angles: number[] }>
  /** Thumb phalanges + angles; sign flips the bend plane (left −, right +). */
  thumb: { bones: THREE.Bone[]; angles: number[]; sign: number }
}

export interface ArmChain {
  /** Clavicle (e.g. LeftShoulder) — root of the arm, child of chest. */
  clavicle: THREE.Bone
  /** Upper arm (e.g. LeftArm) — pivots at the shoulder. */
  shoulder: THREE.Bone
  /** Forearm (e.g. LeftForeArm) — pivots at the elbow. */
  elbow: THREE.Bone
  /** Hand (e.g. LeftHand) — the effector, pivots at the wrist. */
  hand: THREE.Bone
  /** Grip geometry + finger bones for the riding hand pose (optional — absent
      when the avatar has no finger bones). */
  grip?: GripRig
}

export interface LegChain {
  /** Thigh (e.g. LeftUpLeg) — pivots at the hip, root of the leg chain. */
  thigh: THREE.Bone
  /** Shin (e.g. LeftLeg) — pivots at the knee. */
  shin: THREE.Bone
  /** Foot (e.g. LeftFoot) — the effector, pivots at the ankle. */
  foot: THREE.Bone
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

/**
 * Measure the hand's local grip axes from rest-pose geometry. The axes are
 * pose-invariant (rigid bone attachments, expressed in the hand's own frame),
 * so they can be captured once at bind time and reused every frame.
 *
 * `finger` = Index4 − Index1 (distal), `width` = Index1 − Pinky1, and the
 * palm-out normal = width×finger for the left hand, its negation for the right
 * (the two hands are mirror images, so one cross keeps both on the palm side).
 */
export function measureGripAxes(
  hand: THREE.Bone,
  getBone: (name: string) => THREE.Bone | null,
  side: 'Left' | 'Right',
): { finger: THREE.Vector3; width: THREE.Vector3; palm: THREE.Vector3 } | null {
  const idx1 = getBone(`${side}HandIndex1`)
  const idx4 = getBone(`${side}HandIndex4`)
  const pinky1 = getBone(`${side}HandPinky1`)
  if (!idx1 || !idx4 || !pinky1) return null
  const invQ = hand.getWorldQuaternion(_qa).invert()
  const finger = idx4.getWorldPosition(_toEff).sub(idx1.getWorldPosition(_jPos))
  const width = idx1.getWorldPosition(_toTgt).sub(pinky1.getWorldPosition(_effPos))
  if (finger.lengthSq() < 1e-8 || width.lengthSq() < 1e-8) return null
  const palm = new THREE.Vector3().crossVectors(width, finger)
  if (side === 'Right') palm.negate()
  finger.applyQuaternion(invQ).normalize()
  width.applyQuaternion(invQ).normalize()
  palm.applyQuaternion(invQ).normalize()
  return { finger, width, palm }
}

/**
 * Pose a mounted rider's hand into a real grip: the fingers run along the bar
 * (`barForward`), the palm lies flat on the bar (down), the width (index→pinky)
 * maps to the vehicle's left, and the fingers/thumb curl so the tips wrap under
 * the bar. Orientation is solved in the rig's own frame via R = B·Aᵀ, so it
 * works for any humanoid hand no matter its local bone axes.
 */
export function poseGripHand(chain: ArmChain, barForward: THREE.Vector3): void {
  const grip = chain.grip
  if (!grip) return
  const hand = chain.hand
  // Rig axes (cached, pose-invariant), orthonormalized: finger exact, palm
  // projected perpendicular, width = -cross(finger, palm) (palm-out × finger).
  const f = _rigFinger.copy(grip.finger)
  const p = _rigPalm.copy(grip.palm).addScaledVector(f, -grip.palm.dot(f)).normalize()
  const w = _rigW.crossVectors(f, p).negate()
  // Target world axes: fingers along the bar, palm down, width = vehicle left.
  const fingerT = _fingerT.copy(barForward).normalize()
  const up = _gripUp.set(0, 1, 0)
  if (Math.abs(fingerT.dot(up)) > 0.999) up.set(0, 0, 1)
  const widthT = _widthT.crossVectors(fingerT, up).normalize()
  const palmT = _palmT.copy(up).negate()
  // R = B · Aᵀ (A = rig axes as columns, B = target axes as columns).
  _A3.set(f.x, w.x, p.x, f.y, w.y, p.y, f.z, w.z, p.z)
  _B3.set(
    fingerT.x, widthT.x, palmT.x,
    fingerT.y, widthT.y, palmT.y,
    fingerT.z, widthT.z, palmT.z,
  )
  _B3.multiply(_A3.transpose())
  _R4.set(
    _B3.elements[0], _B3.elements[3], _B3.elements[6], 0,
    _B3.elements[1], _B3.elements[4], _B3.elements[7], 0,
    _B3.elements[2], _B3.elements[5], _B3.elements[8], 0,
    0, 0, 0, 1,
  )
  const parentWorldQ = (hand.parent as THREE.Bone).getWorldQuaternion(_qb)
  hand.quaternion.copy(parentWorldQ).invert().multiply(_dq.setFromRotationMatrix(_R4))
  // Curl: fingers bend in the rig's local X plane, the thumb in local Z
  // (sign flips the plane for the mirrored hand).
  for (const finger of grip.fingers) {
    for (let i = 0; i < finger.bones.length; i++) {
      finger.bones[i].quaternion.premultiply(_dq.setFromAxisAngle(_bendX, finger.angles[i]))
    }
  }
  const sign = grip.thumb.sign
  for (let i = 0; i < grip.thumb.bones.length; i++) {
    grip.thumb.bones[i].quaternion.premultiply(
      _dq.setFromAxisAngle(_bendZ, grip.thumb.angles[i] * sign),
    )
  }
  hand.updateWorldMatrix(true, true)
}

/**
 * CCD IK for a seated rider's leg: swing the knee and hip joints so the ankle
 * (`chain.foot`) reaches the foot peg/stirrup `target`, keeping the hip on the
 * seat. The knee naturally bends toward the target; `clampHip` limits how
 * aggressively the thigh twists so the hip doesn't pop out of the saddle. The
 * foot keeps the pose the active clip authored (toes forward, sole down), so
 * resting the ankle on the peg reads as "foot on the peg".
 */
export function solveLegCCD(
  chain: LegChain,
  target: THREE.Vector3,
  iterations = 10,
  clampHip = 0.6,
): void {
  const joints = [chain.shin, chain.thigh] // tip -> root
  const eff = chain.foot

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
      const clamped = i === joints.length - 1 ? Math.min(angle, clampHip) : angle
      rotateOnWorldAxis(joint, _axis, clamped)
      eff.getWorldPosition(_effPos) // refresh effector for the next joint
    }
  }
}
