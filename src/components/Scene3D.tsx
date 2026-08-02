import { useEffect, useMemo, useRef } from 'react'
import { Canvas } from '@react-three/fiber'
import { Physics } from '@react-three/rapier'
import { EffectComposer, Bloom } from '@react-three/postprocessing'
import type { RapierRigidBody } from '@react-three/rapier'
import { useStore } from '../store/useStore'
import { detectCountry } from '../utils/geo'
import { getTimeOfDay, DAY_THEMES, INTRO_THEME } from '../utils/timeOfDay'
import { fetchKathmanduWeather } from '../utils/weather'
import { shouldReduceGraphics } from '../utils/webgl'
import Ground from './Ground'
import Roads from './Roads'
import Decorations from './Decorations'
import Props from './Props'
import MountainRange from './MountainRange'
import WaterPond from './WaterPond'
import WaterRiver from './WaterRiver'
import Rain from './Rain'
import TireTracks from './TireTracks'
import GradientSky from './GradientSky'
import Player from './Player'
import IntroSequence from './IntroSequence'
import FollowCamera from './FollowCamera'
import FlyCamera from './FlyCamera'
import Landmarks from './Landmarks'
import ContentPanel from './ContentPanel'
import NavBar from './NavBar'
import Hud from './Hud'
import TravelingIndicator from './TravelingIndicator'
import Minimap from './Minimap'
import LoadingScreen from './LoadingScreen'
import SoundManager from './SoundManager'
import EngineSound from './EngineSound'
import IntroOverlay from './IntroOverlay'
import Toast from './Toast'
import WelcomeCard from './WelcomeCard'
import Menu from './Menu'
import HudCluster from './HudCluster'
import Wayfinder from './Wayfinder'

function Scene3D() {
  const playerBody = useRef<RapierRigidBody>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const introDone = useStore((s) => s.introDone)
  const setGeo = useStore((s) => s.setGeo)
  const timeOfDay = useStore((s) => s.timeOfDay)
  const setTimeOfDay = useStore((s) => s.setTimeOfDay)
  const weather = useStore((s) => s.weather)
  const setWeather = useStore((s) => s.setWeather)
  const lowGraphics = useStore((s) => s.settings.lowGraphics)
  const setWebglFailed = useStore((s) => s.setWebglFailed)
  const weakDevice = useMemo(() => shouldReduceGraphics(), [])

  // Best-effort visitor geolocation. Never blocks the scene: on failure or
  // timeout the standard intro plays instead. A ?intro=air|local|standard
  // query param overrides the lookup so a specific intro path can be tested
  // without real geo data — normal visitors are unaffected.
  useEffect(() => {
    const forced = new URLSearchParams(window.location.search).get('intro')
    if (forced === 'air' || forced === 'local' || forced === 'standard') {
      setGeo(forced === 'local' ? 'Nepal (test)' : 'International (test)', forced)
      return
    }
    let mounted = true
    void detectCountry().then((res) => {
      if (!mounted) return
      const variant = res.iso === 'NP' ? 'local' : res.country ? 'air' : 'standard'
      setGeo(res.country, variant)
    })
    return () => {
      mounted = false
    }
  }, [setGeo])

  // Time-of-day from the visitor's local clock; real Kathmandu weather, which
  // fails silently to 'clear'. Both set the initial sky/lighting state.
  useEffect(() => {
    setTimeOfDay(getTimeOfDay())
    let mounted = true
    void fetchKathmanduWeather().then((kind) => {
      if (mounted) setWeather(kind)
    })
    return () => {
      mounted = false
    }
  }, [setTimeOfDay, setWeather])

  // If the GPU drops the WebGL context (driver reset, VRAM exhaustion) give the
  // browser a moment to restore it; if it doesn't come back, swap to the 2D
  // view instead of leaving a dead canvas.
  useEffect(() => {
    let timer: number | undefined
    const onLost = (event: Event) => {
      event.preventDefault()
      if (timer) window.clearTimeout(timer)
      timer = window.setTimeout(() => setWebglFailed(true), 2500)
    }
    const onRestored = () => {
      if (timer) {
        window.clearTimeout(timer)
        timer = undefined
      }
    }
    window.addEventListener('webglcontextlost', onLost, true)
    window.addEventListener('webglcontextrestored', onRestored, true)
    return () => {
      if (timer) window.clearTimeout(timer)
      window.removeEventListener('webglcontextlost', onLost, true)
      window.removeEventListener('webglcontextrestored', onRestored, true)
    }
  }, [setWebglFailed])

  const theme = introDone ? DAY_THEMES[timeOfDay] : INTRO_THEME
  let fogNear = theme.fogNear
  let fogFar = theme.fogFar
  if (weather === 'rain') {
    fogNear += 10
    fogFar -= 60
  } else if (weather === 'fog') {
    fogNear += 25
    fogFar -= 110
  }

  return (
    <div ref={containerRef} className="relative h-full w-full">
      <Canvas
        camera={{ position: [0, 26, 42], fov: 70 }}
        dpr={lowGraphics || weakDevice ? [1, 1.5] : [1, 2]}
      >
        <fog attach="fog" args={[theme.fog, fogNear, fogFar]} />
        <GradientSky />
        <ambientLight intensity={theme.ambient} />
        <directionalLight
          position={[10, 15, 10]}
          intensity={theme.sunIntensity}
          color={theme.sunColor}
        />
        <Physics gravity={[0, -9.81, 0]}>
          <Ground />
          <Roads />
          <Player bodyRef={playerBody} />
          <Landmarks playerRef={playerBody} />
        </Physics>
        <MountainRange />
        <WaterPond />
        <WaterRiver />
        <Decorations />
        <Props />
        <TireTracks target={playerBody} />
        {weather === 'rain' && <Rain target={playerBody} />}
        {!introDone ? (
          <IntroSequence />
        ) : (
          <FollowCamera target={playerBody} />
        )}
        <FlyCamera />
        {/* Subtle bloom so bright/emissive elements (headlight beams, prayer
            flag glows, the golden horizon) bleed light. Threshold is high
            enough that the sky and plain lit geometry mostly stay untouched.
            Tune intensity/threshold/radius here if it reads too hot. Disabled
            by the reduced-graphics toggle. */}
        {!lowGraphics && (
          <EffectComposer>
            <Bloom
              mipmapBlur
              intensity={0.5}
              luminanceThreshold={0.8}
              luminanceSmoothing={0.25}
              radius={0.7}
            />
          </EffectComposer>
        )}
      </Canvas>
      <NavBar />
      <Hud />
      <Menu />
      <Minimap />
      <HudCluster />
      <Wayfinder />
      <TravelingIndicator />
      <IntroOverlay />
      <ContentPanel />
      <Toast />
      <WelcomeCard />
      <LoadingScreen />
      <SoundManager />
      <EngineSound />
    </div>
  )
}

export default Scene3D
