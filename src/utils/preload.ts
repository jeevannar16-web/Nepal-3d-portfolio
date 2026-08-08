import { useGLTF } from '@react-three/drei'
import { assetUrl } from './assetUrl'

/**
 * Start fetching every .glb up front, the moment the bundle runs, instead of
 * letting each component request its model when it first mounts. Without this
 * the world renders first and the soldier/vehicles/landmarks pop in one by one
 * ("maps first, models later"); with it, by the time the loading overlay lifts
 * every asset is already cached, so the intro handoff and mode switches are
 * instant. Loading all of them is cheap on the CDN: models load in parallel.
 *
 * This is a side-effect module: import it once from main.tsx.
 */
export function preloadAllModels(): void {
  const modelPaths = [
    // Player + vehicles + flying machines
    '/models/boy.glb',
    '/models/soldier.glb',
    '/models/car.glb',
    '/models/bike.glb',
    '/models/horse.glb',
    '/models/airplane.glb',
    '/models/plane.glb',
    '/models/hotairballoon.glb',
    '/models/parachute.glb',
    '/models/helicopter.glb',
    // Landmarks
    '/models/temple.glb',
    '/models/dharahara.glb',
    '/models/gate.glb',
    '/models/mountain.glb',
    // Scatter props
    '/models/cottage.glb',
    '/models/logcabin.glb',
    '/models/well.glb',
    '/models/roses.glb',
    '/models/plant.glb',
    '/models/dock.glb',
    '/models/templeentrance.glb',
    '/models/shrine.glb',
    '/models/pathway.glb',
    '/models/pagoda.glb',
    '/models/hut.glb',
    '/models/lantern.glb',
    '/models/rock.glb',
    '/models/cliff.glb',
    '/models/bush.glb',
    '/models/fence.glb',
  ]
  for (const path of modelPaths) {
    useGLTF.preload(assetUrl(path))
  }
}

preloadAllModels()
