import type { JSX } from 'react'
import type { RapierRigidBody } from '@react-three/rapier'
import Landmark from './Landmark'
import { landmarks } from '../data'

interface LandmarksProps {
  playerRef: React.RefObject<RapierRigidBody | null>
}

export default function Landmarks({ playerRef }: LandmarksProps): JSX.Element {
  return (
    <>
      {landmarks.map((config) => (
        <Landmark key={config.id} config={config} playerRef={playerRef} />
      ))}
    </>
  )
}
