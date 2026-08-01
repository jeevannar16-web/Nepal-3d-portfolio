import Scene3D from './components/Scene3D'
import Scene2D from './components/Scene2D'
import { useDeviceType } from './hooks/useDeviceType'

function App() {
  const deviceType = useDeviceType()

  return deviceType === 'desktop' ? <Scene3D /> : <Scene2D />
}

export default App
