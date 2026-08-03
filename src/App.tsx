import { useState } from 'react'
import Scene3D from './components/Scene3D'
import Scene2D from './components/Scene2D'
import SceneErrorBoundary from './components/SceneErrorBoundary'
import FallbackView from './components/FallbackView'
import { useStore } from './store/useStore'
import { supportsWebGL } from './utils/webgl'

function App() {
  const prefersSimple = useStore((s) => s.prefersSimple)
  const webglFailed = useStore((s) => s.webglFailed)
  const [webglOk] = useState(() => supportsWebGL())

  // Touch devices are welcome in the 3D world: the on-screen glass controls
  // (TouchControls) make walking playable without a keyboard. The simplified
  // 2D view is kept only for people who opt in via "Prefer a simple page?".
  const showSimple = prefersSimple

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
