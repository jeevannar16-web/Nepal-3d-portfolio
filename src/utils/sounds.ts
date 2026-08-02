import { Howl } from 'howler'
import { useStore } from '../store/useStore'
import { assetUrl } from './assetUrl'

let click: Howl | null = null
let whoosh: Howl | null = null
let honk: Howl | null = null

function ensureSounds() {
  if (click && whoosh && honk) return
  click = new Howl({ src: [assetUrl('/sounds/click.wav')], volume: 0.15 })
  whoosh = new Howl({ src: [assetUrl('/sounds/whoosh.wav')], volume: 0.12 })
  honk = new Howl({ src: [assetUrl('/sounds/honk.wav')], volume: 0.4 })
}

function guardPlay(sound: Howl | null) {
  if (!sound) return
  if (useStore.getState().settings.muted) return
  try {
    sound.play()
  } catch {
    // ignore audio failures (e.g. before user gesture)
  }
}

export function playClick() {
  ensureSounds()
  guardPlay(click)
}

export function playWhoosh() {
  ensureSounds()
  guardPlay(whoosh)
}

export function playHonk() {
  ensureSounds()
  guardPlay(honk)
}
