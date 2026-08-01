import { useEffect, useState } from 'react'
import { useStore, type DeviceType } from '../store/useStore'

const MOBILE_BREAKPOINT = 768

function detectDevice(): DeviceType {
  if (typeof window === 'undefined') return 'desktop'
  const coarsePointer = window.matchMedia('(pointer: coarse)').matches
  const smallScreen = window.innerWidth < MOBILE_BREAKPOINT
  return coarsePointer || smallScreen ? 'mobile' : 'desktop'
}

export function useDeviceType(): DeviceType {
  const setDeviceType = useStore((s) => s.setDeviceType)
  const [device, setDevice] = useState<DeviceType>(() => detectDevice())

  useEffect(() => {
    setDeviceType(device)
  }, [device, setDeviceType])

  useEffect(() => {
    const onResize = () => setDevice(detectDevice())
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  return device
}
