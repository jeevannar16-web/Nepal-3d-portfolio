import { useEffect, useRef, type JSX } from 'react'
import { useStore } from '../store/useStore'
import { planeState } from '../store/planeState'

const IDLE_FREQ = 55 // low prop beat while the takeoff roll begins
const TOP_FREQ = 170 // cruise drone at full thrust
const MAX_GAIN = 0.15

interface PlaneNodes {
  ctx: AudioContext
  master: GainNode
  osc1: OscillatorNode
  osc2: OscillatorNode
  filter: BiquadFilterNode
  propDepth: GainNode
  propLfo: OscillatorNode
}

/**
 * Player-driven airplane soundtrack (no asset needed): a dual-oscillator prop
 * drone whose pitch, brightness and gain all follow the plane's live thrust
 * (planeState.throttle, which includes the takeoff spool), so boarding and
 * throttling up is audible the moment you fly. Only plays while the player is
 * in the airplane, respects the mute toggle, and becomes audible after the
 * intro hands control over.
 */
export default function PlayerPlaneSound(): JSX.Element {
  const muted = useStore((s) => s.settings.muted)
  const introDone = useStore((s) => s.introDone)
  const playerMode = useStore((s) => s.playerMode)
  const started = useRef(false)
  const nodes = useRef<PlaneNodes | null>(null)

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
      osc2.frequency.value = IDLE_FREQ * 2.1

      const filter = ctx.createBiquadFilter()
      filter.type = 'lowpass'
      filter.frequency.value = 240
      filter.Q.value = 1.1

      const g1 = ctx.createGain()
      g1.gain.value = 0.55
      const g2 = ctx.createGain()
      g2.gain.value = 0.18
      osc1.connect(g1).connect(filter)
      osc2.connect(g2).connect(filter)

      // Propeller beat: an amplitude pulse whose depth and rate follow the
      // throttle, so the drone putt-putts faster and harder as it speeds up.
      const propDepth = ctx.createGain()
      propDepth.gain.value = 0
      const propLfo = ctx.createOscillator()
      propLfo.type = 'sine'
      propLfo.frequency.value = 9
      propLfo.connect(propDepth.gain)
      filter.connect(propDepth).connect(master)

      osc1.start()
      osc2.start()
      propLfo.start()
      nodes.current = { ctx, master, osc1, osc2, filter, propDepth, propLfo }
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
          n.propLfo.stop()
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
        const audible = introDone && playerMode === 'airplane' && !muted
        const throttle = audible ? planeState.throttle : 0

        const freq = IDLE_FREQ + (TOP_FREQ - IDLE_FREQ) * throttle
        const prop = 9 + 21 * throttle
        n.osc1.frequency.setTargetAtTime(freq, now, 0.2)
        n.osc2.frequency.setTargetAtTime(freq * 2.1, now, 0.2)
        n.propLfo.frequency.setTargetAtTime(prop, now, 0.2)
        n.filter.frequency.setTargetAtTime(200 + 1100 * throttle, now, 0.2)
        n.propDepth.gain.setTargetAtTime(0.35 * throttle, now, 0.2)
        n.master.gain.setTargetAtTime(MAX_GAIN * (0.25 + 0.75 * throttle), now, 0.15)
        ;(window as unknown as { __planeAudio?: unknown }).__planeAudio = {
          running: n.ctx.state,
          gain: +n.master.gain.value.toFixed(3),
          freq: +n.osc1.frequency.value.toFixed(0),
        }
      }
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [introDone, muted, playerMode])

  return <></>
}
