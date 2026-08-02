import { Component, type ErrorInfo, type ReactNode } from 'react'
import FallbackView from './FallbackView'

interface SceneErrorBoundaryProps {
  children: ReactNode
}

interface SceneErrorBoundaryState {
  failed: boolean
}

/**
 * Catches any runtime error thrown while mounting the 3D scene (a broken GLB,
 * a shader the GPU rejects, a physics failure, ...) and swaps to the 2D view
 * so visitors never stare at a blank page.
 */
export default class SceneErrorBoundary extends Component<
  SceneErrorBoundaryProps,
  SceneErrorBoundaryState
> {
  state: SceneErrorBoundaryState = { failed: false }

  static getDerivedStateFromError(): SceneErrorBoundaryState {
    return { failed: true }
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('[Scene3D] crashed, showing simplified view:', error, info)
  }

  render(): ReactNode {
    if (this.state.failed) {
      return (
        <FallbackView notice="The 3D view ran into a problem, so the simplified view is shown instead." />
      )
    }
    return this.props.children
  }
}
