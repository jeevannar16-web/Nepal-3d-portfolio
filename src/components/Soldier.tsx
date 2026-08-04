import { useEffect, useMemo, useRef, type JSX } from 'react'
import { useFrame } from '@react-three/fiber'
import { useGLTF } from '@react-three/drei'
import * as THREE from 'three'
import { assetUrl } from '../utils/assetUrl'
import BlobShadow from './BlobShadow'

/**
 * soldier.glb is a Mixamo-rigged "vanguard" soldier (three.js example asset)
 * ~1.83 world units tall with real Idle/Walk/Run/Jump clips — already
 * human-scale, so it renders 1:1 (no rescale needed).
 */
const SOLDIER_SCALE = 1

interface Motion {
  moving: boolean
  running: boolean
  crouching: boolean
  jump: 'anticipate' | 'airborne' | 'land' | null
}

const IDLE_MOTION: Motion = {
  moving: false,
  running: false,
  crouching: false,
  jump: null,
}

const CATEGORIES: Array<{ key: string; re: RegExp }> = [
  { key: 'jump', re: /jump|airborne|anticipate|land/i },
  { key: 'run', re: /run|sprint/i },
  { key: 'walk', re: /walk/i },
  { key: 'idle', re: /idle|standing|stand|stiff/i },
]

const categoryOf = (name: string) =>
  CATEGORIES.find((c) => c.re.test(name))?.key ?? 'idle'

/**
 * The Jump clip in soldier.glb is authored with its root (mixamorigHips) in a
 * different space than Idle/Walk/Run: the Hips track sits at the origin with
 * an identity rotation (z ≈ 0 cm), while the standing clips put it at z ≈ 98 cm
 * with the pelvis's standing quaternion. Playing Jump as-is snaps the whole
 * body flat to the ground — the diving/sliding pose. Re-anchor the clip to the
 * standing pose taken from the Idle clip's first frame, keeping the jump's
 * relative root motion and its pose animation intact.
 */

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
 * The Walk/Run clips are authored with root motion on the Hips bone: their
 * position track slides several units along x/z per stride, so the whole
 * soldier mesh drifts around relative to the physics capsule every gait cycle
 * — the on-foot movement reads jittery and the model sits offset from its
 * collider/shadow. Pin the root's x/z to the Idle standing pose (the capsule
 * drives forward motion), keeping the natural vertical bounce (y) intact.
 */
function neutralizeRootSlip(
   clip: THREE.AnimationClip,
   standPos: number[],
 ): THREE.AnimationClip {
   const out = clip.clone()
   for (const track of out.tracks) {
     if (track.name !== 'mixamorigHips.position') continue
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

function normalizeJumpClip(
   animations: THREE.AnimationClip[],
   standPos: number[] | null,
   standRot: number[] | null,
 ): THREE.AnimationClip | null {
   const jump = animations.find((c) => /jump/i.test(c.name))
   if (!jump) return null
   const jumpPos = firstTrackValue(jump, 'mixamorigHips.position')
   if (!standPos || !standRot || !jumpPos) return jump
   const clip = jump.clone()
   const standQ = new THREE.Quaternion(standRot[0], standRot[1], standRot[2], standRot[3])
   for (const track of clip.tracks) {
     if (track.name === 'mixamorigHips.position') {
       const size = track.getValueSize()
       const v = track.values
       for (let i = 0; i < v.length; i += size) {
         v[i] = standPos[0] + v[i] - jumpPos[0]
         v[i + 1] = standPos[1] + v[i + 1] - jumpPos[1]
         v[i + 2] = standPos[2] + v[i + 2] - jumpPos[2]
       }
     } else if (track.name === 'mixamorigHips.quaternion') {
       const size = track.getValueSize()
       const v = track.values
       for (let i = 0; i < v.length; i += size) {
         const q = new THREE.Quaternion(v[i], v[i + 1], v[i + 2], v[i + 3])
         standQ.clone().multiply(q).normalize().toArray(v, i)
       }
     }
   }
   return clip
 }

import { standingHipsY } from '../store/walkState'

/**
 * The player character: loads a rigged soldier GLB and drives it from the
 * motionRef published by WalkController. The model ships real Idle/Walk/Run/
 * Jump clips which are crossfaded by activity (walk -> run as the player
 * sprints, the full Jump clip during a jump, idle when stationary).
 */
export default function Soldier({
  motionRef,
}: {
  motionRef?: React.RefObject<Motion>
}): JSX.Element {
  const gltf = useGLTF(assetUrl('/models/soldier.glb'))
  const mixer = useMemo(() => new THREE.AnimationMixer(gltf.scene), [gltf])
  const current = useRef<THREE.AnimationAction | null>(null)

  const actions = useMemo(() => {
    const map = new Map<string, THREE.AnimationAction>()
    const idle = gltf.animations.find((c) => /idle/i.test(c.name))
    const standPos = idle ? firstTrackValue(idle, 'mixamorigHips.position') : null
    const standRot = idle ? firstTrackValue(idle, 'mixamorigHips.quaternion') : null
    if (standPos && standPos.length >= 1) {
      standingHipsY.current = standPos[1]
    }
    const jumpClip = normalizeJumpClip(gltf.animations, standPos, standRot)
    for (const clip of gltf.animations) {
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
      act.paused = true
      act.play()
      map.set(key, act)
    }
    return map
  }, [gltf, mixer])

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
      action.reset().fadeIn(0.2).play()
      current.current = action
    }
    mixer.update(delta)
    ;(window as any).__soldier = {
      clips: [...actions.keys()],
      active: current.current?.getClip().name ?? null,
      want,
    }
    ;(window as any).__soldierScene = gltf.scene
  })

  return (
    <group>
      <primitive object={gltf.scene} scale={SOLDIER_SCALE} />
      <BlobShadow radius={0.8} y={0.01} />
    </group>
  )
}
