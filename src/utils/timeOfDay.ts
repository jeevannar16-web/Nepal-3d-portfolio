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
    skyTop: '#5f88c8',
    skyHorizon: '#e6eef7',
    skyZenith: '#c7d9ef',
    fog: '#d7e2ef',
    fogNear: 90,
    fogFar: 320,
    ambient: 0.55,
    sunColor: '#ffe6c4',
    sunIntensity: 1.1,
  },
  day: {
    skyTop: '#4a76b8',
    skyHorizon: '#dbe7f4',
    skyZenith: '#b8d1ec',
    fog: '#ccdcec',
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

/**
 * Fixed, attractive sky used ONLY during the arrival intro so the first
 * impression never depends on the visitor's local clock (a flat orange dusk
 * or near-black night reads poorly). Golden-hour tones with a clear blue
 * zenith — not a flat orange wash. The scene hands back to the real
 * DAY_THEMES[timeOfDay] once the intro completes.
 */
export const INTRO_THEME: DayTheme = {
  skyTop: '#3d7bbf',
  skyHorizon: '#ffd9a8',
  skyZenith: '#f2a874',
  fog: '#f0c9a2',
  fogNear: 95,
  fogFar: 330,
  ambient: 0.6,
  sunColor: '#ffeccb',
  sunIntensity: 1.15,
}
