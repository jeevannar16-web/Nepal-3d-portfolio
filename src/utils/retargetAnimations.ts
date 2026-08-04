import * as THREE from 'three'

/**
 * Animation retargeting from the soldier's Mixamo rig onto a meter-scale
 * humanoid avatar (avaturn.glb).
 *
 * soldier.glb's rig is authored in centimetres with its character root rotated
 * -90° about X (local +Z is up) so the whole scene stands upright at 0.01
 * scale. The avatar rig is authored in metres, Y-up, identity root. Both are
 * the same Mixamo hierarchy, but the bone local frames differ, so a raw
 * prefix-rename of the clips would leave the avatar's limbs pointing every
 * which way.
 *
 * We therefore bake every frame through WORLD space: for each clip we compute
 * each bone's world pose using the soldier's hierarchy + root transform,
 * then re-project it into the avatar's local frames via the avatar's own
 * hierarchy. The result is a set of clips (tracks named after the avatar's
 * bones) that reproduce the soldier's motion exactly, facing and all.
 */

const UP_ROT = new THREE.Quaternion().setFromAxisAngle(
  new THREE.Vector3(1, 0, 0),
  -Math.PI / 2,
)
const UNIT = new THREE.Quaternion()

const stripPrefix = (name: string) => name.replace(/^mixamorig[:]?/i, '')

interface Rig {
  /** Normalised bone name -> the bone Object3D under the scene root. */
  bones: Map<string, THREE.Object3D>
  /** Normalised bone name -> local bind translation. */
  bindT: Map<string, THREE.Vector3>
  /** Normalised bone name -> local bind quaternion. */
  bindQ: Map<string, THREE.Quaternion>
  /** Normalised bone name -> normalised parent bone name ('' for scene root child). */
  parent: Map<string, string>
}

function collectRig(root: THREE.Object3D): Rig {
  const bones = new Map<string, THREE.Object3D>()
  const bindT = new Map<string, THREE.Vector3>()
  const bindQ = new Map<string, THREE.Quaternion>()
  const parent = new Map<string, string>()
  root.traverse((o) => {
    if (!(o as THREE.Bone).isBone) return
    const name = stripPrefix(o.name)
    bones.set(name, o)
    bindT.set(name, o.position.clone())
    bindQ.set(name, o.quaternion.clone())
    const p = o.parent
    parent.set(
      name,
      p && p !== root && (p as THREE.Bone).isBone ? stripPrefix(p.name) : '',
    )
  })
  return { bones, bindT, bindQ, parent }
}

/**
 * Sample one clip's local pose arrays per bone. Returns a map from normalised
 * bone name to { position: number[], quaternion: number[] } sampled at each
 * frame (all soldier tracks share one frame count).
 */
function samplePoses(
  clip: THREE.AnimationClip,
  rig: Rig,
): Map<string, { pos: number[][]; rot: number[][] }> {
  const out = new Map<
    string,
    { pos: number[][]; rot: number[][] }
  >()
  const frameCount = clip.tracks.length
    ? Math.max(...clip.tracks.map((t) => t.times.length))
    : 0
  for (const track of clip.tracks) {
    const dot = track.name.lastIndexOf('.')
    const raw = track.name.slice(0, dot)
    const prop = track.name.slice(dot + 1)
    const name = stripPrefix(raw)
    if (prop !== 'position' && prop !== 'quaternion') continue
    if (!rig.bones.has(name)) continue
    let entry = out.get(name)
    if (!entry) {
      entry = { pos: [], rot: [] }
      out.set(name, entry)
    }
    const size = track.getValueSize()
    const arr = entry[prop === 'position' ? 'pos' : 'rot']
    for (let i = 0; i < track.times.length; i++) {
      const row: number[] = []
      for (let c = 0; c < size; c++) row.push(track.values[i * size + c])
      arr[i] = row
    }
  }
  for (const [name, entry] of out) {
    while (entry.pos.length < frameCount) entry.pos.push(entry.pos.length ? entry.pos[entry.pos.length - 1] : rig.bindT.get(name)!.toArray())
    while (entry.rot.length < frameCount) entry.rot.push(entry.rot.length ? entry.rot[entry.rot.length - 1] : rig.bindQ.get(name)!.toArray())
  }
  return out
}

/**
 * Bake `source` clips (soldier) into `target` (avatar) space. Returns new
 * AnimationClips whose tracks reference the avatar's bone names, plus a map of
 * the standing Hips Y height (first frame of the idle clip) used to park the
 * model's feet on the physics capsule.
 */
export function retargetClips(
  sourceClips: THREE.AnimationClip[],
  sourceRoot: THREE.Object3D,
  targetRoot: THREE.Object3D,
): THREE.AnimationClip[] {
  const src = collectRig(sourceRoot)
  const dst = collectRig(targetRoot)

  return sourceClips.map((clip) => {
    const poses = samplePoses(clip, src)

    const srcWorld = new Map<string, { t: THREE.Vector3; q: THREE.Quaternion }>()
    const dstWorld = new Map<string, { t: THREE.Vector3; q: THREE.Quaternion }>()
    const frameCount = Math.max(
      0,
      ...[...poses.values()].map((p) => Math.max(p.pos.length, p.rot.length)),
    )
    if (frameCount === 0) return clip.clone()

    const trackPos: { name: string; arr: number[]; times: number[] }[] = []
    const trackRot: { name: string; arr: number[]; times: number[] }[] = []
    const times = clip.tracks.length ? Array.from(clip.tracks[0].times) : []

    for (let f = 0; f < frameCount; f++) {
      srcWorld.clear()
      dstWorld.clear()
      for (const [name, bone] of src.bones) {
        const p = src.parent.get(name)!
        const locT = new THREE.Vector3()
        const locQ = new THREE.Quaternion().copy(bone.quaternion)
        const pose = poses.get(name)
        if (pose && pose.pos[f]) locT.fromArray(pose.pos[f])
        if (pose && pose.rot[f]) locQ.fromArray(pose.rot[f])
        if (p === '') {
          // scene root: soldier root carries the -90° X + 0.01 scale
          srcWorld.set(name, {
            t: locT.multiplyScalar(0.01).applyQuaternion(UP_ROT),
            q: new THREE.Quaternion().copy(UP_ROT).multiply(locQ),
          })
        } else {
          const pw = srcWorld.get(p)!
          const t = locT
            .multiplyScalar(0.01)
            .applyQuaternion(pw.q)
            .add(pw.t)
          srcWorld.set(name, {
            t,
            q: new THREE.Quaternion().copy(pw.q).multiply(locQ),
          })
        }
      }
      for (const [name] of dst.bones) {
        if (!src.bones.has(name)) continue
        const sw = srcWorld.get(name)
        if (!sw) continue
        // source and target worlds coincide (both stand in the game world),
        // so the avatar's world pose equals the soldier's world pose.
        dstWorld.set(name, { t: sw.t.clone(), q: sw.q.clone() })
      }
      for (const [name, bone] of dst.bones) {
        if (!src.bones.has(name)) continue
        const lw = dstWorld.get(name)
        if (!lw) continue
        const p = dst.parent.get(name)!
        let lt: THREE.Vector3
        let lq: THREE.Quaternion
        if (p === '') {
          lt = lw.t.clone()
          lq = lw.q.clone()
        } else {
          const pw = dstWorld.get(p)!
          const inv = new THREE.Quaternion().copy(pw.q).invert()
          lt = new THREE.Vector3().copy(lw.t).sub(pw.t).applyQuaternion(inv)
          lq = new THREE.Quaternion().copy(inv).multiply(lw.q)
        }
        const tName = `${bone.name}.position`
        let tp = trackPos.find((x) => x.name === tName)
        if (!tp) {
          tp = { name: tName, arr: [], times }
          trackPos.push(tp)
        }
        tp.arr.push(lt.x, lt.y, lt.z)
        const rName = `${bone.name}.quaternion`
        let tr = trackRot.find((x) => x.name === rName)
        if (!tr) {
          tr = { name: rName, arr: [], times }
          trackRot.push(tr)
        }
        tr.arr.push(lq.x, lq.y, lq.z, lq.w)
      }
    }

    const tracks: THREE.KeyframeTrack[] = []
    for (const tp of trackPos)
      tracks.push(new THREE.VectorKeyframeTrack(tp.name, times, tp.arr))
    for (const tr of trackRot)
      tracks.push(
        new THREE.QuaternionKeyframeTrack(tr.name, times, tr.arr),
      )
    return new THREE.AnimationClip(clip.name, clip.duration, tracks)
  })
}
