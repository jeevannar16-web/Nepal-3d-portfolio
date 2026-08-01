import { useMemo, type JSX } from 'react'
import { Instances, Instance } from '@react-three/drei'
import { mulberry32 } from '../world'
import { PALETTE } from '../utils/palette'

interface Peak {
  x: number
  z: number
  h: number
  s: number
  r: number
  color: string
  snow: boolean
}

/** Warm slate / mauve hues so peaks aren't all identical and catch golden light. */
const ROCK_COLORS = PALETTE.rock
const SNOW_COLORS = PALETTE.snow

/** Warm-haze palette for the far layer (faked atmospheric perspective). */
const HAZE_COLORS = PALETTE.haze

/**
 * Low-poly Himalayan ring around the valley — purely atmospheric, no physics.
 * Two layers: a detailed near ring with a few dramatic "Everest-like" peaks,
 * and a distant, hazier, lower-detail ring that fades into the scene fog.
 */
export default function MountainRange(): JSX.Element {
  const { peaks, farPeaks, farSnowPeaks } = useMemo(() => {
    const rng = mulberry32(7)
    const peaks: Peak[] = []
    const farPeaks: Peak[] = []

    // Near ring — dramatic height spread with a few giants.
    const COUNT = 48
    for (let i = 0; i < COUNT; i++) {
      const angle = (i / COUNT) * Math.PI * 2 + (rng() - 0.5) * 0.35
      const radius = 128 + rng() * 18
      const giant = rng() < 0.12
      const h = giant ? 55 + rng() * 15 : 12 + rng() * 30
      const s = giant ? 1.8 + rng() * 1.2 : 1.2 + rng() * 0.9
      peaks.push({
        x: Math.cos(angle) * radius,
        z: Math.sin(angle) * radius,
        h,
        s,
        r: rng() * Math.PI * 2,
        color: ROCK_COLORS[Math.floor(rng() * ROCK_COLORS.length)],
        snow: giant ? true : h > 30 && rng() < 0.55,
      })
    }

    // Distant ring further out — fewer, simpler peaks in hazy tones.
    const FAR_COUNT = 30
    for (let i = 0; i < FAR_COUNT; i++) {
      const angle = (i / FAR_COUNT) * Math.PI * 2 + (rng() - 0.5) * 0.5
      const radius = 205 + rng() * 30
      const h = 24 + rng() * 46
      farPeaks.push({
        x: Math.cos(angle) * radius,
        z: Math.sin(angle) * radius,
        h,
        s: 1.6 + rng() * 1.4,
        r: rng() * Math.PI * 2,
        color: HAZE_COLORS[Math.floor(rng() * HAZE_COLORS.length)],
        snow: h > 58,
      })
    }

    return {
      peaks,
      farPeaks,
      farSnowPeaks: farPeaks.filter((p) => p.snow),
    }
  }, [])

  const snowPeaks = useMemo(() => peaks.filter((p) => p.snow), [peaks])

  return (
    <>
      {/* ---- Near ring ---- */}
      <Instances limit={peaks.length} frustumCulled={false}>
        <coneGeometry args={[1, 1, 7]} />
        <meshStandardMaterial color="#ffffff" flatShading />
        {peaks.map((p, i) => (
          <Instance
            key={`peak-${i}`}
            position={[p.x, p.h * 0.5, p.z]}
            rotation={[0, p.r, 0]}
            scale={[p.s * 1.5, p.h, p.s * 1.5]}
            color={p.color}
          />
        ))}
      </Instances>
      <Instances limit={snowPeaks.length} frustumCulled={false}>
        <coneGeometry args={[1, 1, 7]} />
        <meshStandardMaterial color="#f4f8fc" flatShading />
        {snowPeaks.map((p, i) => (
          <Instance
            key={`snow-${i}`}
            position={[p.x, p.h * 0.62, p.z]}
            rotation={[0, p.r, 0]}
            scale={[p.s * 0.75, p.h * 0.38, p.s * 0.75]}
            color={SNOW_COLORS[i % SNOW_COLORS.length]}
          />
        ))}
      </Instances>

      {/* ---- Distant layer: hazier, lower detail, sinks below the horizon ---- */}
      <Instances limit={farPeaks.length} frustumCulled={false}>
        <coneGeometry args={[1, 1, 6]} />
        <meshStandardMaterial color="#c5b8a8" flatShading />
        {farPeaks.map((p, i) => (
          <Instance
            key={`far-${i}`}
            position={[p.x, p.h * 0.5 - 8, p.z]}
            rotation={[0, p.r, 0]}
            scale={[p.s * 1.4, p.h, p.s * 1.4]}
            color={p.color}
          />
        ))}
      </Instances>
      <Instances limit={farSnowPeaks.length} frustumCulled={false}>
        <coneGeometry args={[1, 1, 6]} />
        <meshStandardMaterial color="#e8edf4" flatShading />
        {farSnowPeaks.map((p, i) => (
          <Instance
            key={`farSnow-${i}`}
            position={[p.x, p.h * 0.62 - 8, p.z]}
            rotation={[0, p.r, 0]}
            scale={[p.s * 0.7, p.h * 0.38, p.s * 0.7]}
            color={SNOW_COLORS[i % SNOW_COLORS.length]}
          />
        ))}
      </Instances>
    </>
  )
}
