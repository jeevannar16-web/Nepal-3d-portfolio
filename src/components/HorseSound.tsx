import { useEffect, useRef, type JSX } from 'react'
import { useStore } from '../store/useStore'
import { driveState } from '../store/driveState'

const MAX_KMH = 80 // matches the horse's speedKmh scaling
const MIN_INTERVAL = 0.22 // galloping cadence
const MAX_INTERVAL = 0.55 // walking cadence

/**
 * Procedural hoof sounds for the horse ride: a lookahead scheduler that fires
 * short noise "clops" through a band-pass at a cadence tied to the current
 * speed. Fast enough and it gallops with a doubled, brighter second beat.
 * Only audible while riding the horse and never while muted.
 */
export default function HorseSound(): JSX.Element {
  const muted = useStore((s) => s.settings.muted)
  const introDone = useStore((s) => s.introDone)
  const playerMode = useStore((s) => s.playerMode)
  const started = useRef(false)
  const ctxRef = useRef<AudioContext | null>(null)
  const noiseBuf = useRef<AudioBuffer | null>(null)
  const nextClop = useRef(0)

  useEffect(() => {
    const resume = () => {
      if (started.current) return
      started.current = true
      window.removeEventListener('pointerdown', resume)
      window.removeEventListener('keydown', resume)

      const Ctor =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext })
          .webkitAudioContext
      if (!Ctor) return

      const ctx = new Ctor()
      const len = Math.floor(ctx.sampleRate * 0.05)
      const buf = ctx.createBuffer(1, len, ctx.sampleRate)
      const data = buf.getChannelData(0)
      for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1

      ctxRef.current = ctx
      noiseBuf.current = buf
      nextClop.current = ctx.currentTime + 0.2
    }

    window.addEventListener('pointerdown', resume)
    window.addEventListener('keydown', resume)

    return () => {
      window.removeEventListener('pointerdown', resume)
      window.removeEventListener('keydown', resume)
      const ctx = ctxRef.current
      if (ctx) {
        void ctx.close()
        ctxRef.current = null
        noiseBuf.current = null
      }
    }
  }, [])

  useEffect(() => {
    let raf = 0
    const loop = () => {
      const ctx = ctxRef.current
      if (ctx && noiseBuf.current) {
        const audible = introDone && playerMode === 'horse' && !muted
        const now = ctx.currentTime
        const speed = Math.abs(driveState.speedKmh)
        if (audible && speed > 2 && now >= nextClop.current) {
          const norm = Math.min(speed / MAX_KMH, 1)
          const interval = MAX_INTERVAL - (MAX_INTERVAL - MIN_INTERVAL) * norm
          nextClop.current = now + interval
          clop(ctx, noiseBuf.current, now, norm)
          if (norm > 0.55) {
            // Gallop: a brighter doubled beat for the 2-2 stride rhythm.
            clop(ctx, noiseBuf.current, now + interval * 0.42, norm, 1.35)
          }
        }
      }
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [introDone, muted, playerMode])

  return <></>
}

function clop(
  ctx: AudioContext,
  buf: AudioBuffer,
  t: number,
  speedNorm: number,
  pitchMul = 1,
): void {
  const src = ctx.createBufferSource()
  src.buffer = buf
  const bp = ctx.createBiquadFilter()
  bp.type = 'bandpass'
  bp.frequency.value = 300 + speedNorm * 260
  bp.Q.value = 1.1
  const g = ctx.createGain()
  g.gain.setValueAtTime((0.05 + speedNorm * 0.03) / pitchMul, t)
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.12)
  src.connect(bp).connect(g).connect(ctx.destination)
  src.start(t)
  src.stop(t + 0.15)
}
