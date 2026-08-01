import { Howl } from 'howler'

let click: Howl | null = null
let whoosh: Howl | null = null

function ensureSounds() {
  if (click && whoosh) return
  click = new Howl({ src: ['/sounds/click.wav'], volume: 0.15 })
  whoosh = new Howl({ src: ['/sounds/whoosh.wav'], volume: 0.12 })
}

function guardPlay(sound: Howl | null) {
  if (!sound) return
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
