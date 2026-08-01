import { useEffect, useRef, type JSX } from 'react'
import { useStore } from '../store/useStore'
import { driveState } from '../store/driveState'
import { REDLINE_RPM } from './Player'

const IDLE_FREQ = 55 // Hz at idle rpm
const TOP_FREQ = 155 // Hz at redline
const IDLE_GAIN = 0.03 // gentle idle when parked
const TOP_GAIN = 0.1 // full swell at redline
const CRANK_FREQ = 24 // low thump while cranking the starter

interface EngineNodes {
  ctx: AudioContext
  master: GainNode
  osc1: OscillatorNode
  osc2: OscillatorNode
  filter: BiquadFilterNode
}

/**
 * Procedural engine loop (no asset needed): a dual-oscillator drone whose
 * pitch, low-pass brightness and gain all scale with the engine's rpm and
 * state, read from driveState each frame. Silent while the engine is off,
 * thumps through the cranking phase, then idles/revs once running. Respects
 * the settings mute toggle and only becomes audible once the intro hands
 * control to the player.
 */
export default function EngineSound(): JSX.Element {
  const muted = useStore((s) => s.settings.muted)
  const introDone = useStore((s) => s.introDone)
  const started = useRef(false)
  const nodes = useRef<EngineNodes | null>(null)

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
      const master = ctx.createGain()
      master.gain.value = 0
      master.connect(ctx.destination)

      const osc1 = ctx.createOscillator()
      osc1.type = 'sawtooth'
      osc1.frequency.value = IDLE_FREQ

      const osc2 = ctx.createOscillator()
      osc2.type = 'square'
      osc2.frequency.value = IDLE_FREQ * 2

      const filter = ctx.createBiquadFilter()
      filter.type = 'lowpass'
      filter.frequency.value = 220
      filter.Q.value = 1.2

      const g1 = ctx.createGain()
      g1.gain.value = 0.7
      const g2 = ctx.createGain()
      g2.gain.value = 0.22
      osc1.connect(g1).connect(filter)
      osc2.connect(g2).connect(filter)
      filter.connect(master)

      osc1.start()
      osc2.start()
      nodes.current = { ctx, master, osc1, osc2, filter }
    }

    window.addEventListener('pointerdown', resume)
    window.addEventListener('keydown', resume)

    return () => {
      window.removeEventListener('pointerdown', resume)
      window.removeEventListener('keydown', resume)
      const n = nodes.current
      if (n) {
        try {
          n.osc1.stop()
          n.osc2.stop()
        } catch {
          // already stopped
        }
        void n.ctx.close()
        nodes.current = null
      }
    }
  }, [])

  useEffect(() => {
    let raf = 0
    const loop = () => {
      const n = nodes.current
      if (n) {
        const now = n.ctx.currentTime
        const state = driveState.engineState
        const audible = introDone && !muted

        if (state === 'starting' && audible) {
          // Starter motor: a slow, thumping cranking chug until it catches.
          const pulse = 0.5 + 0.5 * Math.sin(now * 25)
          const f = CRANK_FREQ + 10 * pulse
          n.osc1.frequency.setTargetAtTime(f, now, 0.03)
          n.osc2.frequency.setTargetAtTime(f * 2, now, 0.03)
          n.filter.frequency.setTargetAtTime(160, now, 0.03)
          n.master.gain.setTargetAtTime(0.09 * pulse, now, 0.02)
        } else if (state === 'on' && audible) {
          const rpmNorm = Math.min(Math.max(driveState.rpm / REDLINE_RPM, 0), 1)
          const freq = IDLE_FREQ + (TOP_FREQ - IDLE_FREQ) * rpmNorm
          n.osc1.frequency.setTargetAtTime(freq, now, 0.08)
          n.osc2.frequency.setTargetAtTime(freq * 2, now, 0.08)
          n.filter.frequency.setTargetAtTime(180 + 460 * rpmNorm, now, 0.08)
          const gain = IDLE_GAIN + (TOP_GAIN - IDLE_GAIN) * rpmNorm
          n.master.gain.setTargetAtTime(gain, now, 0.06)
        } else {
          // Engine off or muted: silence.
          n.master.gain.setTargetAtTime(0, now, 0.06)
          n.osc1.frequency.setTargetAtTime(IDLE_FREQ, now, 0.08)
          n.osc2.frequency.setTargetAtTime(IDLE_FREQ * 2, now, 0.08)
        }
      }
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [introDone, muted])

  return <></>
}
