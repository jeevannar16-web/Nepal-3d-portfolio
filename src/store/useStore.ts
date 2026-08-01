import { create } from 'zustand'
import type { TimeOfDay } from '../utils/timeOfDay'
import type { WeatherKind } from '../utils/weather'

export type DeviceType = 'desktop' | 'mobile'

export type IntroVariant = 'air' | 'local' | 'standard'

export type IntroStage =
  | 'airport'
  | 'flight'
  | 'descent'
  | 'takeoff'
  | 'flyover'
  | 'landing'
  | 'orbit'

interface PortfolioState {
  activeZone: string | null
  isPanelOpen: boolean
  deviceType: DeviceType
  introDone: boolean
  introVariant: IntroVariant
  introStage: IntroStage
  visitorCountry: string | null
  geoResolved: boolean
  timeOfDay: TimeOfDay
  weather: WeatherKind
  visitedZones: string[]
  prefersSimple: boolean
  flyTarget: { x: number; z: number } | null
  toast: string | null
  welcomeDismissed: boolean
  settings: { muted: boolean; lowGraphics: boolean }
  targetLandmark: string | null
  setActiveZone: (zone: string | null) => void
  setIsPanelOpen: (open: boolean) => void
  setDeviceType: (device: DeviceType) => void
  skipIntro: () => void
  setGeo: (country: string | null, variant: IntroVariant) => void
  setIntroStage: (stage: IntroStage) => void
  setTimeOfDay: (time: TimeOfDay) => void
  setWeather: (weather: WeatherKind) => void
  markZoneVisited: (zone: string) => boolean
  setPrefersSimple: (prefer: boolean) => void
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
  introDone: false,
  introVariant: 'standard',
  introStage: 'orbit',
  visitorCountry: null,
  geoResolved: false,
  timeOfDay: 'day',
  weather: 'clear',
  visitedZones: [],
  prefersSimple: false,
  flyTarget: null,
  toast: null,
  welcomeDismissed: false,
  setActiveZone: (zone) => set({ activeZone: zone }),
  setIsPanelOpen: (open) => set({ isPanelOpen: open }),
  setDeviceType: (device) => set({ deviceType: device }),
  skipIntro: () => set({ introDone: true }),
  setGeo: (country, variant) =>
    set({ visitorCountry: country, introVariant: variant, geoResolved: true }),
  setIntroStage: (stage) => set({ introStage: stage }),
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
  flyTo: (x, z) => set({ flyTarget: { x, z } }),
  clearFly: () => set({ flyTarget: null }),
  showToast: (text) => set({ toast: text }),
  clearToast: () => set({ toast: null }),
  dismissWelcome: () => set({ welcomeDismissed: true }),
  settings: { muted: false, lowGraphics: false },
  targetLandmark: null,
  toggleMuted: () =>
    set((s) => ({ settings: { ...s.settings, muted: !s.settings.muted } })),
  toggleLowGraphics: () =>
    set((s) => ({ settings: { ...s.settings, lowGraphics: !s.settings.lowGraphics } })),
  setTargetLandmark: (id) => set({ targetLandmark: id }),
}))
