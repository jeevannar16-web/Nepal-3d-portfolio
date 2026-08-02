import { useState } from 'react'
import Scene3D from './components/Scene3D'
import Scene2D from './components/Scene2D'
import SceneErrorBoundary from './components/SceneErrorBoundary'
import FallbackView from './components/FallbackView'
import { useDeviceType } from './hooks/useDeviceType'
import { useStore } from './store/useStore'
import { supportsWebGL } from './utils/webgl'

function App() {
  const deviceType = useDeviceType()
  const prefersSimple = useStore((s) => s.prefersSimple)
  const webglFailed = useStore((s) => s.webglFailed)
  const [webglOk] = useState(() => supportsWebGL())

  const showSimple = prefersSimple || deviceType === 'mobile'

  if (showSimple) return <Scene2D />

  if (!webglOk) {
    return (
      <FallbackView notice="This browser/device doesn't support the WebGL the 3D view needs, so the simplified view is shown instead." />
    )
  }

  if (webglFailed) {
    return (
      <FallbackView notice="The 3D view stopped responding, so the simplified view is shown. Reload to try the 3D view again." />
    )
  }

  return (
    <SceneErrorBoundary>
      <Scene3D />
    </SceneErrorBoundary>
  )
}

export default App
