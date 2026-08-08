import { create } from 'zustand'
import type { TimeOfDay } from '../utils/timeOfDay'
import type { WeatherKind } from '../utils/weather'
import { detectGraphicsTier } from '../utils/webgl'

export type DeviceType = 'desktop' | 'mobile'

export type IntroVariant = 'air' | 'local' | 'standard'

export type PlayerMode = 'walk' | 'car' | 'bike' | 'horse' | 'airplane' | 'balloon' | 'parachute'

export type IntroStage =
  | 'taxi'
  | 'climb'
  | 'circuit'
  | 'approach'
  | 'landing'
  | 'orbit'

interface PortfolioState {
  activeZone: string | null
  isPanelOpen: boolean
  deviceType: DeviceType
  introDone: boolean
  introVariant: IntroVariant
  introStage: IntroStage
  /** Landing spot of the intro aircraft after it rolls out; set at handoff.
   *  The landed plane then stays parked as a solid, explorable object, and the
   *  world's own parked plane is hidden so there is never a duplicate. */
  parkedPlane: { x: number; y: number; z: number; heading: number } | null
  /** Landmark the intro is currently spotlighting (caption shown over the sky). */
  introCaption: string | null
  visitorCountry: string | null
  geoResolved: boolean
  timeOfDay: TimeOfDay
  weather: WeatherKind
  visitedZones: string[]
  prefersSimple: boolean
  /** Set when the WebGL context is lost and cannot be restored, so the app can
      gracefully swap the 3D canvas for the 2D view instead of going blank. */
  webglFailed: boolean
  flyTarget: { x: number; z: number } | null
  toast: string | null
  welcomeDismissed: boolean
  settings: { muted: boolean; lowGraphics: boolean }
  targetLandmark: string | null
  playerMode: PlayerMode
  setActiveZone: (zone: string | null) => void
  setIsPanelOpen: (open: boolean) => void
  setDeviceType: (device: DeviceType) => void
  skipIntro: () => void
  replayIntro: () => void
  setGeo: (country: string | null, variant: IntroVariant) => void
  setIntroStage: (stage: IntroStage) => void
  setIntroCaption: (caption: string | null) => void
  setParkedPlane: (
    pose: { x: number; y: number; z: number; heading: number } | null,
  ) => void
  setPlayerMode: (mode: PlayerMode) => void
  setTimeOfDay: (time: TimeOfDay) => void
  setWeather: (weather: WeatherKind) => void
  markZoneVisited: (zone: string) => boolean
  setPrefersSimple: (prefer: boolean) => void
  setWebglFailed: (failed: boolean) => void
  flyTo: (x: number, z: number) => void
  clearFly: () => void
  showToast: (text: string) => void
  clearToast: () => void
  dismissWelcome: () => void
  toggleMuted: () => void
  toggleLowGraphics: () => void
  setTargetLandmark: (id: string | null) => void
}

export const useStore = create<PortfolioState>((set) => ({
  activeZone: null,
  isPanelOpen: false,
  deviceType: 'desktop',
  introDone: true,
  introVariant: 'air',
  introStage: 'orbit',
  parkedPlane: null,
  introCaption: null,
  visitorCountry: null,
  geoResolved: false,
  timeOfDay: 'day',
  weather: 'clear',
  visitedZones: [],
  prefersSimple: false,
  webglFailed: false,
  flyTarget: null,
  toast: null,
  welcomeDismissed: false,
  setActiveZone: (zone) => set({ activeZone: zone }),
  setIsPanelOpen: (open) => set({ isPanelOpen: open }),
  setDeviceType: (device) => set({ deviceType: device }),
  skipIntro: () => set({ introDone: true }),
  replayIntro: () => set({ introDone: false }),
  setGeo: (country, variant) =>
    set({ visitorCountry: country, introVariant: variant, geoResolved: true }),
  setIntroStage: (stage) => set({ introStage: stage }),
  setIntroCaption: (caption) => set({ introCaption: caption }),
  setParkedPlane: (pose) => set({ parkedPlane: pose }),
  setPlayerMode: (mode) => set({ playerMode: mode }),
  setTimeOfDay: (time) => set({ timeOfDay: time }),
  setWeather: (weather) => set({ weather }),
  // Returns true only the first time a zone is marked, so callers can fire a
  // one-time "Zone unlocked!" toast without double-toasting.
  markZoneVisited: (zone) => {
    const state = useStore.getState()
    if (state.visitedZones.includes(zone)) return false
    set({ visitedZones: [...state.visitedZones, zone] })
    return true
  },
  setPrefersSimple: (prefer) => set({ prefersSimple: prefer }),
  setWebglFailed: (failed) => set({ webglFailed: failed }),
  flyTo: (x, z) => set({ flyTarget: { x, z } }),
  clearFly: () => set({ flyTarget: null }),
  showToast: (text) => set({ toast: text }),
  clearToast: () => set({ toast: null }),
  dismissWelcome: () => set({ welcomeDismissed: true }),
  settings: { muted: false, lowGraphics: detectGraphicsTier() === 'low' },
  targetLandmark: null,
  playerMode: 'walk',
  toggleMuted: () =>
    set((s) => ({ settings: { ...s.settings, muted: !s.settings.muted } })),
  toggleLowGraphics: () =>
    set((s) => ({ settings: { ...s.settings, lowGraphics: !s.settings.lowGraphics } })),
  setTargetLandmark: (id) => set({ targetLandmark: id }),
}))
