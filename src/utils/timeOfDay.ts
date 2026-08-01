export type TimeOfDay = 'morning' | 'day' | 'dusk' | 'night'

/** Infer time of day from the visitor's local browser clock. */
export function getTimeOfDay(): TimeOfDay {
  const h = new Date().getHours()
  if (h >= 5 && h < 8) return 'morning'
  if (h >= 8 && h < 17) return 'day'
  if (h >= 17 && h < 20) return 'dusk'
  return 'night'
}

export interface DayTheme {
  skyTop: string
  skyHorizon: string
  skyZenith: string
  fog: string
  fogNear: number
  fogFar: number
  ambient: number
  sunColor: string
  sunIntensity: number
}

export const DAY_THEMES: Record<TimeOfDay, DayTheme> = {
  morning: {
    skyTop: '#5b7cc2',
    skyHorizon: '#f7c59f',
    skyZenith: '#f0a585',
    fog: '#f2c29e',
    fogNear: 90,
    fogFar: 320,
    ambient: 0.55,
    sunColor: '#ffe6c4',
    sunIntensity: 1.1,
  },
  day: {
    skyTop: '#3f5b8c',
    skyHorizon: '#f0a585',
    skyZenith: '#e88f74',
    fog: '#f0a585',
    fogNear: 90,
    fogFar: 320,
    ambient: 0.5,
    sunColor: '#ffffff',
    sunIntensity: 1,
  },
  dusk: {
    skyTop: '#2c2a5e',
    skyHorizon: '#ff9e64',
    skyZenith: '#c86b5a',
    fog: '#d98a68',
    fogNear: 80,
    fogFar: 300,
    ambient: 0.4,
    sunColor: '#ffb27a',
    sunIntensity: 0.85,
  },
  night: {
    skyTop: '#0b1026',
    skyHorizon: '#2a3a5c',
    skyZenith: '#3f4a6e',
    fog: '#182238',
    fogNear: 60,
    fogFar: 240,
    ambient: 0.28,
    sunColor: '#9db4cc',
    sunIntensity: 0.5,
  },
}
