import * as THREE from 'three'

/**
 * Shared constants + load-time cleanup for airplane.glb (the intro's arrival
 * aircraft). Values verified against the model's actual geometry:
 *  - the main-gear tyres bottom out at model-local y=0.27 (scale 0.25);
 *  - the "-5.07" the model also carries is a stray 4-vertex spike under the
 *    right wingtip, so it is removed at load (it would punch through the
 *    runway once the wheels are grounded).
 */
export const PLANE_SCALE = 0.25
// 0.04 = runway top. Offset so the tyres rest exactly on the tarmac.
export const PLANE_BASE_OFFSET = 0.04 - PLANE_SCALE * 0.27

/** Remove the stray wingtip spike (any mesh dipping below model-local y=-3). */
export function hideAirplaneGlitch(scene: THREE.Object3D): void {
  scene.traverse((obj) => {
    if (!(obj as THREE.Mesh).isMesh) return
    const mesh = obj as THREE.Mesh
    if (!mesh.geometry) return
    if (!mesh.geometry.boundingBox) mesh.geometry.computeBoundingBox()
    if (mesh.geometry.boundingBox && mesh.geometry.boundingBox.min.y < -3) {
      mesh.visible = false
    }
  })
}
