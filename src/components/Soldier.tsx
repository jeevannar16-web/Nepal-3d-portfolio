import { useEffect, useMemo, useRef, type JSX } from 'react'
import { useFrame } from '@react-three/fiber'
import { useGLTF } from '@react-three/drei'
import * as THREE from 'three'
import { clone as cloneScene } from 'three/addons/utils/SkeletonUtils.js'
import { assetUrl } from '../utils/assetUrl'
import { retargetClips } from '../utils/retargetAnimations'
import { feetLocalY } from '../store/walkState'
import BlobShadow from './BlobShadow'

/**
 * The player character is avaturn.glb (a meter-scale, Y-up humanoid avatar),
 * driven by the soldier.glb Mixamo clips. The two rigs share the same Mixamo
 * hierarchy but their local bone frames differ, so the soldier's clips are
 * baked through world space and re-projected onto the avatar's bones by
 * retargetClips — the avatar then plays the soldier's Idle/Walk/Run/Jump with
 * the same poses, facing and scale (no model rescale needed).
 */
const SOLDIER_SCALE = 1

interface Motion {
  moving: boolean
  running: boolean
  crouching: boolean
  jump: 'anticipate' | 'airborne' | 'land' | null
  /** Current forward speed in m/s, used to pace the gait animation. */
  speed: number
}

const IDLE_MOTION: Motion = {
  moving: false,
  running: false,
  crouching: false,
  jump: null,
  speed: 0,
}

// Design (full-stride) forward speeds of the retargeted Walk/Run clips at
// timeScale 1, measured from their authored stride cadence. The active action
// is played at timeScale = currentSpeed / designSpeed so the legs never cycle
// faster (or slower) than the physics capsule is actually moving.
const WALK_DESIGN_SPEED = 1.6
const RUN_DESIGN_SPEED = 2.7

const CATEGORIES: Array<{ key: string; re: RegExp }> = [
  { key: 'jump', re: /jump|airborne|anticipate|land/i },
  { key: 'run', re: /run|sprint/i },
  { key: 'walk', re: /walk/i },
  { key: 'idle', re: /idle|standing|stand|stiff/i },
]

const categoryOf = (name: string) =>
  CATEGORIES.find((c) => c.re.test(name))?.key ?? 'idle'

/** First keyframe value of a named track on a clip (null if absent). */
const firstTrackValue = (
  clip: THREE.AnimationClip,
  name: string,
): number[] | null => {
  const track = clip.tracks.find((t) => t.name === name)
  if (!track) return null
  return Array.from(track.values.slice(0, track.getValueSize()))
}

/**
 * The retargeted Walk/Run clips keep the soldier's authored root motion on the
 * Hips bone: the position track still slides along x/z per stride, so the
 * whole avatar would drift around relative to the physics capsule every gait
 * cycle. Pin the root's x/z to the Idle standing pose (the capsule drives
 * forward motion), keeping the natural vertical bounce (y) intact.
 */
function neutralizeRootSlip(
  clip: THREE.AnimationClip,
  standPos: number[],
): THREE.AnimationClip {
  const out = clip.clone()
  for (const track of out.tracks) {
    if (track.name !== 'Hips.position') continue
    const size = track.getValueSize()
    const v = track.values
    for (let i = 0; i < v.length; i += size) {
      v[i] = standPos[0]
      v[i + 1] = standPos[1]
      v[i + 2] = standPos[2]
    }
  }
  return out
}

/**
 * The Jump clip in soldier.glb is authored with its root (mixamorigHips) at
 * the origin with an identity-ish rotation, while the standing clips put the
 * pelvis at z ≈ 98 cm with its standing quaternion. After retargeting the Jump
 * root still sits at the origin, so playing it as-is snaps the whole body flat
 * to the ground. Re-anchor the clip to the standing pose taken from the Idle
 * clip's first frame, keeping the jump's relative root motion and pose intact.
 */
function normalizeJumpClip(
  animations: THREE.AnimationClip[],
  standPos: number[] | null,
  standRot: number[] | null,
): THREE.AnimationClip | null {
  const jump = animations.find((c) => /jump/i.test(c.name))
  if (!jump) return null
  const jumpPos = firstTrackValue(jump, 'Hips.position')
  const jumpRot = firstTrackValue(jump, 'Hips.quaternion')
  if (!standPos || !standRot || !jumpPos || !jumpRot) return jump
  const clip = jump.clone()
  const standQ = new THREE.Quaternion(
    standRot[0],
    standRot[1],
    standRot[2],
    standRot[3],
  )
  const jumpQ0 = new THREE.Quaternion(
    jumpRot[0],
    jumpRot[1],
    jumpRot[2],
    jumpRot[3],
  )
  const anchorQ = standQ.clone().multiply(jumpQ0.clone().invert())
  for (const track of clip.tracks) {
    if (track.name === 'Hips.position') {
      const size = track.getValueSize()
      const v = track.values
      for (let i = 0; i < v.length; i += size) {
        v[i] = standPos[0] + v[i] - jumpPos[0]
        v[i + 1] = standPos[1] + v[i + 1] - jumpPos[1]
        v[i + 2] = standPos[2] + v[i + 2] - jumpPos[2]
      }
    } else if (track.name === 'Hips.quaternion') {
      const size = track.getValueSize()
      const v = track.values
      for (let i = 0; i < v.length; i += size) {
        const q = new THREE.Quaternion(v[i], v[i + 1], v[i + 2], v[i + 3])
        anchorQ.clone().multiply(q).normalize().toArray(v, i)
      }
    }
  }
  return clip
}

/**
 * The player character: loads the avaturn avatar with the soldier's Mixamo
 * clips retargeted onto its rig, and drives it from the motionRef published by
 * WalkController. The actions are crossfaded by activity (walk -> run as the
 * player sprints, the full Jump clip during a jump, idle when stationary).
 */
export default function Soldier({
  motionRef,
}: {
  motionRef?: React.RefObject<Motion>
}): JSX.Element {
  const avatar = useGLTF(assetUrl('/models/boy.glb'))
  const soldier = useGLTF(assetUrl('/models/soldier.glb'))
  // Clone the avatar scene per Soldier instance. The walking soldier
  // (WalkController) and the rider (Rider, on bike/horse) mount at the same
  // time; useGLTF returns the same cached scene object to both, and a THREE
  // Object3D can only have one parent — so the rider would steal the avatar
  // from the walker and leave him invisible after dismounting.
  const avatarScene = useMemo(
    () => cloneScene(avatar.scene) as THREE.Scene,
    [avatar],
  )
  const mixer = useMemo(
    () => new THREE.AnimationMixer(avatarScene),
    [avatarScene],
  )
  const current = useRef<THREE.AnimationAction | null>(null)

  const clips = useMemo(
    () => retargetClips(soldier.animations, soldier.scene, avatarScene),
    [soldier, avatarScene],
  )

  useEffect(() => {
    avatarScene.traverse((o) => {
      const mesh = o as THREE.Mesh
      const mat = mesh.material as THREE.MeshStandardMaterial | undefined
      if (mat && 'envMapIntensity' in mat) mat.envMapIntensity = 1.5
    })
  }, [avatarScene])

  const actions = useMemo(() => {
    const map = new Map<string, THREE.AnimationAction>()
    const idle = clips.find((c) => /idle/i.test(c.name))
    const standPos = idle ? firstTrackValue(idle, 'Hips.position') : null
    const standRot = idle
      ? firstTrackValue(idle, 'Hips.quaternion')
      : null
    const jumpClip = normalizeJumpClip(clips, standPos, standRot)
    for (const clip of clips) {
      const key = categoryOf(clip.name)
      if (map.has(key)) continue
      let chosen = clip
      if (key === 'jump' && jumpClip) chosen = jumpClip
      else if ((key === 'walk' || key === 'run') && standPos)
        chosen = neutralizeRootSlip(clip, standPos)
      const act = mixer.clipAction(chosen)
      if (key === 'jump') {
        act.loop = THREE.LoopOnce
        act.clampWhenFinished = true
      }
      // Every action starts disabled (weight 0): a paused action still
      // accumulates its frozen pose at weight 1 in three.js, so playing all of
      // them at once would permanently blend the Walk/Run/Jump t=0 poses into
      // whatever is active. Each is (re)enabled by reset()/play() when the
      // frame loop selects it.
      act.enabled = false
      map.set(key, act)
    }
    // Settle the avatar into the Idle pose at t=0 so the very first rendered
    // frame is upright and standing (no bind-pose T-flash), then measure the
    // skinned mesh's lowest local Y there so the WalkController can rest the
    // feet exactly on the capsule bottom. Detach while measuring so the
    // physics body's world offset can't leak into the local box.
    const idleAct = map.get('idle')
    if (idle && idleAct) {
      const parent = avatarScene.parent
      if (parent) parent.remove(avatarScene)
      idleAct.reset()
      idleAct.play()
      mixer.update(0)
      feetLocalY.current = new THREE.Box3().setFromObject(avatarScene, true).min.y
      idleAct.paused = true
      if (parent) parent.add(avatarScene)
    }
    return map
  }, [clips, mixer])

  useEffect(() => {
    return () => {
      mixer.stopAllAction()
    }
  }, [mixer])

  useFrame((_, delta) => {
    const motion = motionRef?.current ?? IDLE_MOTION
    const want = motion.jump
      ? 'jump'
      : motion.running
        ? 'run'
        : motion.moving
          ? 'walk'
          : 'idle'
    const action = actions.get(want) ?? actions.get('idle')
    if (action && action !== current.current) {
      current.current?.fadeOut(0.2)
      if (current.current) {
        action.reset().fadeIn(0.2).play()
      } else if (action === actions.get('idle')) {
        // First frame and already settled at Idle weight 1 — just unpause so
        // it keeps playing, instead of re-fading from 0 (which would show a
        // brief T-pose while the weight ramps up).
        action.play()
      } else {
        // First frame but already moving: fade the settled Idle out while the
        // desired action fades in.
        actions.get('idle')?.fadeOut(0.2)
        action.reset().fadeIn(0.2).play()
      }
      current.current = action
    }
    // Pace the gait to the actual movement speed so the legs always match the
    // capsule: idle/jump play at natural speed, walk/run scale to the current
    // forward speed (0 -> a standstill posture, not a frantic cycle).
    if (action) {
      const speed = motion.speed ?? 0
      const ts =
        want === 'walk'
          ? Math.max(0.15, speed / WALK_DESIGN_SPEED)
          : want === 'run'
            ? Math.max(0.25, speed / RUN_DESIGN_SPEED)
            : 1
      if (action.timeScale !== ts) action.timeScale = ts
    }
    mixer.update(delta)
    ;(window as any).__soldier = {
      clips: [...actions.keys()],
      active: current.current?.getClip().name ?? null,
      want,
    }
    ;(window as any).__soldierScene = avatarScene
  })

  return (
    <group>
      <primitive object={avatarScene} scale={SOLDIER_SCALE} />
      <BlobShadow radius={0.8} y={feetLocalY.current + 0.01} />
    </group>
  )
}
