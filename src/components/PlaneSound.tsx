import { useEffect, useRef, type JSX } from 'react'
import { useStore, type IntroStage } from '../store/useStore'

const IDLE_FREQ = 45 // Hz while idling on the runway
const TOP_FREQ = 150 // Hz at full throttle
const IDLE_PROP = 9 // prop-beat pulse at idle
const TOP_PROP = 30 // prop-beat pulse at cruise
const MAX_GAIN = 0.16 // master ceiling for the drone + wind mix
const WIND_GAIN = 0.05 // bandpassed-noise roar, scales with airspeed
const DIVE_WIND_GAIN = 0.05 // extra roar when the nose is down

/** Per-stage throttle target: spool up to cruise, back off on the descent. */
const STAGE_THROTTLE: Record<IntroStage, number> = {
  airport: 0.3,
  takeoff: 0.3,
  flight: 0.95,
  flyover: 0.95,
  descent: 0.8,
  landing: 0.75,
  orbit: 0,
}

interface PlaneNodes {
  ctx: AudioContext
  master: GainNode
  osc1: OscillatorNode
  osc2: OscillatorNode
  filter: BiquadFilterNode
  propDepth: GainNode
  propLfo: OscillatorNode
  windGain: GainNode
  windSource: AudioBufferSourceNode
  windFilter: BiquadFilterNode
}

function makeNoiseBuffer(ctx: AudioContext): AudioBuffer {
  const length = Math.floor(ctx.sampleRate * 2)
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate)
  const data = buffer.getChannelData(0)
  for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1
  return buffer
}

/**
 * Procedural single-engine airplane soundtrack for the intro journey (no asset
 * needed): a dual-oscillator engine drone with a low-frequency prop-beat pulse
 * and a bandpassed wind roar that scales with throttle. The throttle target
 * follows the intro stage — idling at the airport/takeoff, cruising during the
 * flyover, easing back while descending — so the aircraft sounds like it is
 * actually spooling up, levelling off and diving. It only becomes audible once
 * the user has interacted (browser autoplay gate), respects the mute toggle,
 * and fades out when the intro ends and the plane leaves.
 */
export default function PlaneSound(): JSX.Element {
  const muted = useStore((s) => s.settings.muted)
  const introStage = useStore((s) => s.introStage)
  const introDone = useStore((s) => s.introDone)
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

      // Propeller beat: a slow amplitude pulse whose depth and rate follow
      // the throttle, so the drone "putt-putts" faster and stronger as it
      // speeds up, like a real prop plane.
      const propDepth = ctx.createGain()
      propDepth.gain.value = 0
      const propLfo = ctx.createOscillator()
      propLfo.type = 'sine'
      propLfo.frequency.value = IDLE_PROP
      propLfo.connect(propDepth.gain)
      filter.connect(propDepth).connect(master)

      // Wind roar: looped white noise through a bandpass, louder with speed.
      const windFilter = ctx.createBiquadFilter()
      windFilter.type = 'bandpass'
      windFilter.frequency.value = 620
      windFilter.Q.value = 0.5
      const windGain = ctx.createGain()
      windGain.gain.value = 0
      const windSource = ctx.createBufferSource()
      windSource.buffer = makeNoiseBuffer(ctx)
      windSource.loop = true
      windSource.connect(windFilter).connect(windGain).connect(master)

      osc1.start()
      osc2.start()
      propLfo.start()
      windSource.start()
      nodes.current = { ctx, master, osc1, osc2, filter, propDepth, propLfo, windGain, windSource, windFilter }
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
          n.windSource.stop()
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
        const audible = !introDone && !muted
        const throttle = audible ? STAGE_THROTTLE[introStage] ?? 0 : 0

        const freq = IDLE_FREQ + (TOP_FREQ - IDLE_FREQ) * throttle
        const prop = IDLE_PROP + (TOP_PROP - IDLE_PROP) * throttle
        const wind =
          (WIND_GAIN + (introStage === 'descent' || introStage === 'landing'
            ? DIVE_WIND_GAIN
            : 0)) *
          throttle

        n.osc1.frequency.setTargetAtTime(freq, now, 0.2)
        n.osc2.frequency.setTargetAtTime(freq * 2.1, now, 0.2)
        n.propLfo.frequency.setTargetAtTime(prop, now, 0.2)
        n.filter.frequency.setTargetAtTime(200 + 1100 * throttle, now, 0.2)
        n.propDepth.gain.setTargetAtTime(0.35 * throttle, now, 0.2)
        n.windGain.gain.setTargetAtTime(wind, now, 0.2)
        n.master.gain.setTargetAtTime(MAX_GAIN * throttle, now, 0.2)

        if (introDone && n.master.gain.value < 0.001) {
          try {
            n.osc1.stop()
            n.osc2.stop()
            n.propLfo.stop()
            n.windSource.stop()
          } catch {
            // already stopped
          }
          void n.ctx.close()
          nodes.current = null
          cancelAnimationFrame(raf)
          return
        }
      }
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [introStage, introDone, muted])

  return <></>
}
