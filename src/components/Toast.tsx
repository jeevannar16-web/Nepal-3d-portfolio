import { useEffect, type JSX } from 'react'
import { useStore } from '../store/useStore'

const TOAST_MS = 2800

export default function Toast(): JSX.Element {
  const toast = useStore((s) => s.toast)
  const clearToast = useStore((s) => s.clearToast)

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(clearToast, TOAST_MS)
    return () => clearTimeout(t)
  }, [toast, clearToast])

  return (
    <div className="pointer-events-none absolute left-1/2 top-20 z-30 -translate-x-1/2">
      {toast && (
        <div
          key={toast}
          className="animate-toast rounded-full border border-white/15 bg-black/40 px-4 py-2 text-sm font-medium text-white/90 shadow-lg shadow-black/40 backdrop-blur"
        >
          {toast}
        </div>
      )}
    </div>
  )
}
