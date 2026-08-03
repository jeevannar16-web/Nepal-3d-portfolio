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
    for (const clip of gltf.animations) {
      const key = categoryOf(clip.name)
      if (!map.has(key)) {
        const act = mixer.clipAction(clip)
        act.paused = true
        act.play()
        map.set(key, act)
      }
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
