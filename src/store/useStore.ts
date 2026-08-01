import { create } from 'zustand'

export type DeviceType = 'desktop' | 'mobile'

interface PortfolioState {
  activeZone: string | null
  isPanelOpen: boolean
  deviceType: DeviceType
  introDone: boolean
  visitedZones: string[]
  prefersSimple: boolean
  flyTarget: { x: number; z: number } | null
  setActiveZone: (zone: string | null) => void
  setIsPanelOpen: (open: boolean) => void
  setDeviceType: (device: DeviceType) => void
  skipIntro: () => void
  markZoneVisited: (zone: string) => void
  setPrefersSimple: (prefer: boolean) => void
  flyTo: (x: number, z: number) => void
  clearFly: () => void
}

export const useStore = create<PortfolioState>((set) => ({
  activeZone: null,
  isPanelOpen: false,
  deviceType: 'desktop',
  introDone: false,
  visitedZones: [],
  prefersSimple: false,
  flyTarget: null,
  setActiveZone: (zone) => set({ activeZone: zone }),
  setIsPanelOpen: (open) => set({ isPanelOpen: open }),
  setDeviceType: (device) => set({ deviceType: device }),
  skipIntro: () => set({ introDone: true }),
  markZoneVisited: (zone) =>
    set((state) =>
      state.visitedZones.includes(zone)
        ? state
        : { visitedZones: [...state.visitedZones, zone] },
    ),
  setPrefersSimple: (prefer) => set({ prefersSimple: prefer }),
  flyTo: (x, z) => set({ flyTarget: { x, z } }),
  clearFly: () => set({ flyTarget: null }),
}))
