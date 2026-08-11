import {
  EffectComposer,
  Bloom,
  SSAO,
  SMAA,
} from '@react-three/postprocessing'

export default function PostFX() {
  return (
    <EffectComposer>
      <Bloom
        mipmapBlur
        intensity={0.5}
        luminanceThreshold={0.8}
        luminanceSmoothing={0.25}
        radius={0.7}
      />
      <SSAO
        samples={16}
        radius={0.3}
        intensity={3}
        bias={0.1}
      />
      <SMAA />
    </EffectComposer>
  )
}
