import { useEffect, useMemo, useRef, type JSX } from 'react'
import { useFrame } from '@react-three/fiber'
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
const RUN_AMP = 0.62
const KNEE_BEND = 0.75
const ARM_SWING = 0.35
const ELBOW_FOLD = 0.22
const WALK_RATE = 8
const RUN_RATE = 12.5
const LEAN = 0.08
const BOB = 0.07

interface Motion {
  moving: boolean
  running: boolean
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
  const ready = useRef(false)
  const bobRef = useRef<THREE.Group>(null)

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
    const motion = motionRef?.current ?? { moving: false, running: false }
    const target = motion.moving ? 1 : 0
    weight.current += (target - weight.current) * Math.min(1, delta * 8)
    const w = weight.current

    if (action) {
      if (w > 0.02) {
        if (!action.paused) {
          action.paused = true
          action.time = 0
        }
      } else {
        action.paused = false
        mixer.update(delta)
      }
    }
    if (w < 0.01) return

    phase.current += delta * (motion.running ? RUN_RATE : WALK_RATE)
    const p = phase.current
    const amp = motion.running ? RUN_AMP : WALK_AMP
    const swing = amp * Math.sin(p)
    const swingR = amp * Math.sin(p + Math.PI)

    const swingBone = (name: (typeof SWING_BONES)[number], x: number) => {
      const bone = bones.current[name]
      const q = base.current[name]
      if (!bone || !q) return
      bone.quaternion.copy(q)
      if (x !== 0) {
        bone.quaternion.multiply(
          new THREE.Quaternion().setFromEuler(new THREE.Euler(x * w, 0, 0)),
        )
      }
    }

    swingBone('uplegL', swing)
    swingBone('uplegR', swingR)
    swingBone('legL', -KNEE_BEND * Math.max(0, Math.sin(p)))
    swingBone('legR', -KNEE_BEND * Math.max(0, Math.sin(p + Math.PI)))
    swingBone('shoulderL', ARM_SWING * Math.sin(p))
    swingBone('shoulderR', ARM_SWING * Math.sin(p + Math.PI))
    swingBone('armL', -ELBOW_FOLD - 0.08 * Math.max(0, Math.sin(p)))
    swingBone('armR', -ELBOW_FOLD - 0.08 * Math.max(0, Math.sin(p + Math.PI)))
    swingBone('forearmL', -ELBOW_FOLD * 0.6)
    swingBone('forearmR', -ELBOW_FOLD * 0.6)
    swingBone('spine', LEAN)
    swingBone('chest', LEAN * 0.5)

    if (bobRef.current) {
      bobRef.current.position.y = BOB * w * Math.abs(Math.sin(p))
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
