import { useRef } from 'react'
import { Canvas } from '@react-three/fiber'
import { Physics } from '@react-three/rapier'
import type { RapierRigidBody } from '@react-three/rapier'
import Ground from './Ground'
import Roads from './Roads'
import GradientSky from './GradientSky'
import Player from './Player'
import FollowCamera from './FollowCamera'
import Landmarks from './Landmarks'
import ContentPanel from './ContentPanel'
import Hud from './Hud'
import Minimap from './Minimap'
import LoadingScreen from './LoadingScreen'
import SoundManager from './SoundManager'

function Scene3D() {
  const playerBody = useRef<RapierRigidBody>(null)

  return (
    <div className="relative h-full w-full">
      <Canvas camera={{ position: [8, 6, 8], fov: 60 }}>
        <fog attach="fog" args={['#f0a585', 40, 90]} />
        <GradientSky />
        <ambientLight intensity={0.5} />
        <directionalLight position={[10, 15, 10]} intensity={1} />
        <Physics gravity={[0, -9.81, 0]}>
          <Ground />
          <Roads />
          <Player bodyRef={playerBody} />
          <Landmarks playerRef={playerBody} />
        </Physics>
        <FollowCamera target={playerBody} />
      </Canvas>
      <Hud />
      <Minimap />
      <ContentPanel />
      <LoadingScreen />
      <SoundManager />
    </div>
  )
}

export default Scene3D
