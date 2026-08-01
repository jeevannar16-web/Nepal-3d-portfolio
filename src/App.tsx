import Scene3D from './components/Scene3D'
import Scene2D from './components/Scene2D'
import { useDeviceType } from './hooks/useDeviceType'
import { useStore } from './store/useStore'

function App() {
  const deviceType = useDeviceType()
  const prefersSimple = useStore((s) => s.prefersSimple)

  const showSimple = prefersSimple || deviceType === 'mobile'

  return showSimple ? <Scene2D /> : <Scene3D />
}

export default App
