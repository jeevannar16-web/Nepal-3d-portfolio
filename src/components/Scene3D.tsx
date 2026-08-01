import { useRef } from 'react'
import { Canvas } from '@react-three/fiber'
import { Physics } from '@react-three/rapier'
import type { RapierRigidBody } from '@react-three/rapier'
import { useStore } from '../store/useStore'
import Ground from './Ground'
import Roads from './Roads'
import Decorations from './Decorations'
import MountainRange from './MountainRange'
import GradientSky from './GradientSky'
import Player from './Player'
import IntroCamera from './IntroCamera'
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

function Scene3D() {
  const playerBody = useRef<RapierRigidBody>(null)
  const introDone = useStore((s) => s.introDone)
  const skipIntro = useStore((s) => s.skipIntro)

  return (
    <div className="relative h-full w-full">
      <Canvas camera={{ position: [0, 26, 42], fov: 60 }}>
        <fog attach="fog" args={['#f0a585', 90, 320]} />
        <GradientSky />
        <ambientLight intensity={0.5} />
        <directionalLight position={[10, 15, 10]} intensity={1} />
        <Physics gravity={[0, -9.81, 0]}>
          <Ground />
          <Roads />
          <Player bodyRef={playerBody} />
          <Landmarks playerRef={playerBody} />
        </Physics>
        <MountainRange />
        <Decorations />
        {!introDone ? (
          <IntroCamera duration={3} onComplete={skipIntro} />
        ) : (
          <FollowCamera target={playerBody} />
        )}
        <FlyCamera />
      </Canvas>
      <NavBar />
      <Hud />
      <Minimap />
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
