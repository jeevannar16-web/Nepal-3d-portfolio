import { create } from 'zustand'

export type DeviceType = 'desktop' | 'mobile'

interface PortfolioState {
  activeZone: string | null
  isPanelOpen: boolean
  deviceType: DeviceType
  setActiveZone: (zone: string | null) => void
  setIsPanelOpen: (open: boolean) => void
  setDeviceType: (device: DeviceType) => void
}

export const useStore = create<PortfolioState>((set) => ({
  activeZone: null,
  isPanelOpen: false,
  deviceType: 'desktop',
  setActiveZone: (zone) => set({ activeZone: zone }),
  setIsPanelOpen: (open) => set({ isPanelOpen: open }),
  setDeviceType: (device) => set({ deviceType: device }),
}))
