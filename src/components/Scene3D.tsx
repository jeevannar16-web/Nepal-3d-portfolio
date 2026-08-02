import { useEffect, useMemo, useRef } from 'react'
import { Canvas } from '@react-three/fiber'
import { Physics } from '@react-three/rapier'
import {
  EffectComposer,
  Bloom,
  SSAOPass,
  SMAAPass,
} from '@react-three/postprocessing'
import { Environment } from '@react-three/drei'
import type { RapierRigidBody } from '@react-three/rapier'
import * as THREE from 'three'
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
import Clouds from './Clouds'
import Player from './Player'
import WalkController from './WalkController'
import BikeController from './BikeController'
import HorseController from './HorseController'
import IntroSequence from './IntroSequence'
import FollowCamera from './FollowCamera'
import FlyCamera from './FlyCamera'
import Landmarks from './Landmarks'
import ContentPanel from './ContentPanel'
import NavBar from './NavBar'
import Hud from './Hud'
import TransportPrompt from './TransportPrompt'
import TravelingIndicator from './TravelingIndicator'
import Minimap from './Minimap'
import LoadingScreen from './LoadingScreen'
import SoundManager from './SoundManager'
import EngineSound from './EngineSound'
import HorseSound from './HorseSound'
import PlaneSound from './PlaneSound'
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
  const playerMode = useStore((s) => s.playerMode)
  const setGeo = useStore((s) => s.setGeo)
  const timeOfDay = useStore((s) => s.timeOfDay)
  const setTimeOfDay = useStore((s) => s.setTimeOfDay)
  const weather = useStore((s) => s.weather)
  const setWeather = useStore((s) => s.setWeather)
  const lowGraphics = useStore((s) => s.settings.lowGraphics)
  const setWebglFailed = useStore((s) => s.setWebglFailed)
  const weakDevice = useMemo(() => shouldReduceGraphics(), [])

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
        background={theme.skyTop}
      >
        <fog attach="fog" args={[theme.fog, fogNear, fogFar]} />
        <GradientSky />
        {!introDone && <Clouds />}

        <ambientLight intensity={theme.ambient} />
        <hemisphereLight args={['#ffffff', '#c9a07c', 0.4]} />
        <directionalLight
          position={[10, 15, 10]}
          intensity={theme.sunIntensity}
          color={theme.sunColor}
          castShadow
          shadow-mapSize-width={1024}
          shadow-mapSize-height={1024}
          shadow-camera-near={0.5}
          shadow-camera-far={100}
          shadow-camera-left={-15}
          shadow-camera-right={15}
          shadow-camera-top={15}
          shadow-camera-bottom={-15}
        />

        <Environment
          files="/hdr/dawn_mountain_2k.hdr"
          background={false}
          intensity={0.6}
        />

        <Physics gravity={[0, -9.81, 0]}>
          <Ground />
          <Roads />
          {introDone && (
            <>
              <WalkController active={playerMode === 'walk'} bodyRef={playerBody} />
              <Player active={playerMode === 'car'} bodyRef={playerBody} />
              <BikeController active={playerMode === 'bike'} bodyRef={playerBody} />
              <HorseController active={playerMode === 'horse'} bodyRef={playerBody} />
            </>
          )}
          <Landmarks playerRef={playerBody} />
          <Props />
        </Physics>

        <MountainRange />
        <WaterPond />
        <WaterRiver />
        <Decorations />
        <TireTracks target={playerBody} />
        {weather === 'rain' && <Rain target={playerBody} />}

        {!introDone ? (
          <IntroSequence />
        ) : (
          <FollowCamera target={playerBody} />
        )}

        <FlyCamera />

        {!lowGraphics && (
          <EffectComposer>
            <Bloom
              mipmapBlur
              intensity={0.5}
              luminanceThreshold={0.8}
              luminanceSmoothing={0.25}
              radius={0.7}
            />
            <SSAOPass
              kernelRadius={16}
              minDistance={0.005}
              maxDistance={0.1}
            />
            <SMAAPass />
          </EffectComposer>
        )}
      </Canvas>

      <NavBar />
      <Hud />
      <TransportPrompt />
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
      <HorseSound />
      <PlaneSound />
    </div>
  )
}

export default Scene3D