import { useEffect, useRef } from 'react'
import { Canvas } from '@react-three/fiber'
import { Physics } from '@react-three/rapier'
import type { RapierRigidBody } from '@react-three/rapier'
import { useStore } from '../store/useStore'
import { detectCountry } from '../utils/geo'
import { getTimeOfDay, DAY_THEMES } from '../utils/timeOfDay'
import { fetchKathmanduWeather } from '../utils/weather'
import Ground from './Ground'
import Roads from './Roads'
import Decorations from './Decorations'
import MountainRange from './MountainRange'
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
import ProgressTracker from './ProgressTracker'
import LoadingScreen from './LoadingScreen'
import SoundManager from './SoundManager'
import IntroOverlay from './IntroOverlay'
import Speedometer from './Speedometer'
import HonkButton from './HonkButton'

function Scene3D() {
  const playerBody = useRef<RapierRigidBody>(null)
  const introDone = useStore((s) => s.introDone)
  const setGeo = useStore((s) => s.setGeo)
  const timeOfDay = useStore((s) => s.timeOfDay)
  const setTimeOfDay = useStore((s) => s.setTimeOfDay)
  const weather = useStore((s) => s.weather)
  const setWeather = useStore((s) => s.setWeather)

  // Best-effort visitor geolocation. Never blocks the scene: on failure or
  // timeout the standard intro plays instead.
  useEffect(() => {
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

  const theme = DAY_THEMES[timeOfDay]
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
    <div className="relative h-full w-full">
      <Canvas camera={{ position: [0, 26, 42], fov: 60 }}>
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
        <Decorations />
        <TireTracks target={playerBody} />
        {weather === 'rain' && <Rain target={playerBody} />}
        {!introDone ? (
          <IntroSequence />
        ) : (
          <FollowCamera target={playerBody} />
        )}
        <FlyCamera />
      </Canvas>
      <NavBar />
      <Hud />
      <Minimap />
      <Speedometer />
      <HonkButton />
      <ProgressTracker />
      <TravelingIndicator />
      <IntroOverlay />
      <ContentPanel />
      <LoadingScreen />
      <SoundManager />
    </div>
  )
}

export default Scene3D
