import { useEffect, useMemo, useRef, type JSX } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { useGLTF } from '@react-three/drei'
import * as THREE from 'three'
import { assetUrl } from '../utils/assetUrl'
import BlobShadow from './BlobShadow'

/** soldier.glb is ~32 world units tall; 0.056 makes the man ~1.8 tall. */
export const SOLDIER_SCALE = 0.056
// The model's base sits at y = -0.01, effectively at the origin.
export const SOLDIER_BASE_OFFSET = 0

const SWING_BONES = [
  'uplegL', 'uplegR', 'legL', 'legR',
  'shoulderL', 'shoulderR', 'armL', 'armR', 'forearmL', 'forearmR',
  'spine', 'chest',
] as const

// Sign conventions (model faces +Z): upleg +X swings the foot forward, leg -X
// folds the shin, shoulder +X swings the arm back, arm -X folds the elbow,
// spine +X leans the torso forward. Verified against the baked idle pose.
const WALK_AMP = 0.42
const RUN_AMP = 0.75
const KNEE_BEND = 0.75
const ARM_SWING = 0.35
const ELBOW_FOLD = 0.22
const WALK_RATE = 8
const RUN_RATE = 12.5
const LEAN = 0.08
const BOB = 0.07

// The run cycle is a distinctly more aggressive gait: higher knee drive,
// deeper shin fold, arms bent well up and pumping, a forward torso lean and
// a bigger body bob, all at a faster cadence.
const RUN_KNEE_BEND = 1.05
const RUN_ARM_SWING = 0.5
const RUN_ELBOW_FOLD = 0.42
const RUN_LEAN = 0.16
const RUN_BOB = 0.13

interface JumpPose {
  upleg: number
  leg: number
  shoulder: number
  arm: number
  forearm: number
  spine: number
  chest: number
}

// Static pose offsets (radians) per jump phase, added on top of the standing
// base. Anticipate crouches deep to load the legs, airborne tucks knees and
// curls the torso, land absorbs the impact through bent knees.
const JUMP_POSES: Record<string, JumpPose> = {
  anticipate: { upleg: 0.38, leg: -1.15, shoulder: 0.45, arm: -0.3, forearm: -0.2, spine: -0.22, chest: -0.3 },
  airborne: { upleg: 0.9, leg: -1.2, shoulder: 0.7, arm: -0.5, forearm: -0.35, spine: -0.12, chest: -0.18 },
  land: { upleg: 0.2, leg: -0.6, shoulder: 0.2, arm: -0.15, forearm: -0.1, spine: -0.08, chest: -0.12 },
}

const CROUCH_POSE: JumpPose = {
  upleg: 0.55,
  leg: -1.35,
  shoulder: -0.15,
  arm: -0.85,
  forearm: -0.6,
  spine: -0.32,
  chest: -0.45,
}

type JumpPhase = 'anticipate' | 'airborne' | 'land' | null

interface Motion {
  moving: boolean
  running: boolean
  crouching: boolean
  jump: JumpPhase
}

const IDLE_MOTION: Motion = {
  moving: false,
  running: false,
  crouching: false,
  jump: null,
}

interface SoldierProps {
  ref?: React.RefObject<THREE.Group | null>
  motionRef?: React.RefObject<Motion>
}

/**
 * The player character: the downloaded Soldier model, scaled to a real person.
 * Nose faces +Z to match heading math. Only a static "Standing" clip ships with
 * the asset, so a walk cycle is driven procedurally on the rig's bones, blended
 * against the baked standing pose by a smooth weight.
 */
export default function Soldier({ ref, motionRef }: SoldierProps): JSX.Element {
  const gltf = useGLTF(assetUrl('/models/soldier.glb'))
  const bones = useRef<Partial<Record<(typeof SWING_BONES)[number], THREE.Object3D>>>({})
  const base = useRef<Partial<Record<(typeof SWING_BONES)[number], THREE.Quaternion>>>({})
  const phase = useRef(0)
  const weight = useRef(0)
  const crouchWeight = useRef(0)
  const jumpWeight = useRef(0)
  const applied = useRef<Record<string, number>>({})
  const ready = useRef(false)
  const bobRef = useRef<THREE.Group>(null)
  const { camera } = useThree()

  const mixer = useMemo(() => new THREE.AnimationMixer(gltf.scene), [gltf])
  const action = useMemo(() => {
    const clip =
      gltf.animations.find((a) => /standing|idle/i.test(a.name)) ?? gltf.animations[0]
    if (!clip) return null
    const act = mixer.clipAction(clip)
    act.play()
    return act
  }, [gltf, mixer])

  useEffect(() => {
    for (const name of SWING_BONES) {
      const bone = gltf.scene.getObjectByName(name)
      if (bone) bones.current[name] = bone
    }
    if (action) {
      action.time = 0
      mixer.update(1 / 60)
      for (const name of SWING_BONES) {
        const bone = bones.current[name]
        if (bone) base.current[name] = bone.quaternion.clone()
      }
    }
    ready.current = true
  }, [gltf, mixer, action])

  useFrame((_, delta) => {
    if (!ready.current) return
    const motion = motionRef?.current ?? IDLE_MOTION
    const { moving, running, crouching, jump } = motion
    const target = moving && !jump ? 1 : 0
    weight.current += (target - weight.current) * Math.min(1, delta * 8)
    const w = weight.current

    // Smooth state weights so pose changes ease instead of snapping.
    crouchWeight.current +=
      ((crouching ? 1 : 0) - crouchWeight.current) * Math.min(1, delta * 10)
    jumpWeight.current +=
      ((jump ? 1 : 0) - jumpWeight.current) * Math.min(1, delta * 14)
    const cw = crouchWeight.current
    const jw = jumpWeight.current

    if ((window as any).__gaitRequested) {
      const gp = new THREE.Vector3()
      if (ref && ref.current) ref.current.getWorldPosition(gp)
      ;(window as any).__gait = {
        y: gp.y,
        camY: camera.position.y,
        camX: camera.position.x,
        camZ: camera.position.z,
        w,
        cw,
        jw,
        uplegL: applied.current.uplegL ?? 0,
        legL: applied.current.legL ?? 0,
        shoulderL: applied.current.shoulderL ?? 0,
        armL: applied.current.armL ?? 0,
        spine: applied.current.spine ?? 0,
        chest: applied.current.chest ?? 0,
        bobY: bobRef.current ? bobRef.current.position.y : 0,
      }
    }

    if (action) {
      if (w > 0.02 || crouching || jump) {
        if (!action.paused) {
          action.paused = true
          action.time = 0
        }
      } else {
        action.paused = false
        mixer.update(delta)
      }
    }
    if (w < 0.01 && !crouching && !jump) return

    if (!jump) phase.current += delta * (running ? RUN_RATE : WALK_RATE)
    const p = phase.current
    const amp = crouching ? 0.18 : running ? RUN_AMP : WALK_AMP
    const kneeBend = crouching ? 0.6 : running ? RUN_KNEE_BEND : KNEE_BEND
    const armSwing = running ? RUN_ARM_SWING : ARM_SWING
    const elbowFold = running ? RUN_ELBOW_FOLD : ELBOW_FOLD
    const lean = running ? RUN_LEAN : LEAN

    // Walk/run cycle weight: halved into a shuffling gait while crouched, and
    // cancelled entirely mid-jump so the airborne pose owns the body.
    const walkW = w * (1 - jw) * (crouching ? 0.5 : 1)
    const crouchW = cw * (1 - jw) * (moving ? 0.5 : 1)
    const jp: JumpPose | null = jump ? (JUMP_POSES[jump] ?? null) : null
    const jx = (name: keyof JumpPose) => (jp ? jp[name] * jw : 0)

    const swing = amp * Math.sin(p)
    const swingR = amp * Math.sin(p + Math.PI)
    const kneeL = -kneeBend * Math.max(0, Math.sin(p))
    const kneeR = -kneeBend * Math.max(0, Math.sin(p + Math.PI))

    const swingBone = (name: (typeof SWING_BONES)[number], x: number) => {
      const bone = bones.current[name]
      const q = base.current[name]
      if (!bone || !q) return
      bone.quaternion.copy(q)
      if (x !== 0) {
        bone.quaternion.multiply(
          new THREE.Quaternion().setFromEuler(new THREE.Euler(x, 0, 0)),
        )
      }
      applied.current[name] = x
    }

    swingBone('uplegL', swing * walkW + CROUCH_POSE.upleg * crouchW + jx('upleg'))
    swingBone('uplegR', swingR * walkW + CROUCH_POSE.upleg * crouchW + jx('upleg'))
    swingBone('legL', kneeL * walkW + CROUCH_POSE.leg * crouchW + jx('leg'))
    swingBone('legR', kneeR * walkW + CROUCH_POSE.leg * crouchW + jx('leg'))
    swingBone(
      'shoulderL',
      armSwing * Math.sin(p) * walkW + CROUCH_POSE.shoulder * crouchW + jx('shoulder'),
    )
    swingBone(
      'shoulderR',
      armSwing * Math.sin(p + Math.PI) * walkW +
        CROUCH_POSE.shoulder * crouchW +
        jx('shoulder'),
    )
    swingBone(
      'armL',
      (-elbowFold - 0.08 * Math.max(0, Math.sin(p))) * walkW +
        CROUCH_POSE.arm * crouchW +
        jx('arm'),
    )
    swingBone(
      'armR',
      (-elbowFold - 0.08 * Math.max(0, Math.sin(p + Math.PI))) * walkW +
        CROUCH_POSE.arm * crouchW +
        jx('arm'),
    )
    swingBone(
      'forearmL',
      -elbowFold * 0.6 * walkW + CROUCH_POSE.forearm * crouchW + jx('forearm'),
    )
    swingBone(
      'forearmR',
      -elbowFold * 0.6 * walkW + CROUCH_POSE.forearm * crouchW + jx('forearm'),
    )
    swingBone('spine', lean * walkW + CROUCH_POSE.spine * crouchW + jx('spine'))
    swingBone('chest', lean * 0.5 * walkW + CROUCH_POSE.chest * crouchW + jx('chest'))

    if (bobRef.current) {
      const bobAmp = crouching ? 0.03 : running ? RUN_BOB : BOB
      bobRef.current.position.y = bobAmp * walkW * Math.abs(Math.sin(p))
    }
  })

  return (
    <group ref={ref}>
      <group ref={bobRef} position={[0, SOLDIER_BASE_OFFSET, 0]}>
        <primitive object={gltf.scene} scale={SOLDIER_SCALE} />
      </group>
      <BlobShadow radius={0.8} y={0.01} />
    </group>
  )
}
