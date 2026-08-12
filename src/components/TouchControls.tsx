import { useCallback, useEffect, useRef, useState, type JSX } from 'react'
import { useStore } from '../store/useStore'
import { useControls, primaryCode } from '../store/controlsStore'
import { useDeviceType } from '../hooks/useDeviceType'

function keyEvent(type: 'keydown' | 'keyup', code: string) {
  window.dispatchEvent(
    new KeyboardEvent(type, { code, key: code === 'Escape' ? 'Escape' : code, bubbles: true }),
  )
}

export default function TouchControls(): JSX.Element | null {
  const deviceType = useDeviceType()
  const introDone = useStore((s) => s.introDone)
  const isPanelOpen = useStore((s) => s.isPanelOpen)
  const playerMode = useStore((s) => s.playerMode)
  const uiScale = useStore((s) => s.settings.uiScale)
  const bindings = useControls((s) => s.bindings)

  const heldRef = useRef<Set<string>>(new Set())
  const [pressedSet, setPressedSet] = useState<Set<string>>(new Set())
  const [runLatched, setRunLatched] = useState(false)
  const runLatch = useRef(false)
  const flashRef = useRef<Record<string, number>>({})
  const rotLastX = useRef(0)
  const [rotating, setRotating] = useState(false)

  const visible = deviceType === 'mobile' && introDone && !isPanelOpen
  const isWalk = playerMode === 'walk'

  const firstSpec = (a: (typeof bindings)[keyof typeof bindings]) => a[0] ?? ''
  const KEY_UP = firstSpec(bindings.forward)
  const KEY_RUN = primaryCode('run')
  const KEY_JUMP = primaryCode('jump')
  const KEY_EXIT = primaryCode('exit')

  const buzz = () => {
    try {
      if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(12)
    } catch {
      /* no-op */
    }
  }

  const markDown = (code: string) => {
    buzz()
    setPressedSet((prev) => {
      if (prev.has(code)) return prev
      const n = new Set(prev)
      n.add(code)
      return n
    })
  }

  const markUp = (code: string) => {
    setPressedSet((prev) => {
      if (!prev.has(code)) return prev
      const n = new Set(prev)
      n.delete(code)
      return n
    })
  }

  const release = useCallback((code: string) => {
    markUp(code)
    if (!heldRef.current.has(code)) return
    heldRef.current.delete(code)
    keyEvent('keyup', code)
  }, [])

  const press = useCallback(
    (code: string) => {
      if (heldRef.current.has(code)) return
      heldRef.current.add(code)
      keyEvent('keydown', code)
    },
    [],
  )

  const releaseAll = useCallback(() => {
    setPressedSet((prev) => (prev.size ? new Set() : prev))
    runLatch.current = false
    setRunLatched(false)
    heldRef.current.forEach((code) => keyEvent('keyup', code))
    heldRef.current.clear()
  }, [])

  const modeRef = useRef(playerMode)
  useEffect(() => {
    if (modeRef.current !== playerMode) runLatch.current = false
    if (modeRef.current !== playerMode) setRunLatched(false)
    if (modeRef.current !== playerMode) modeRef.current = playerMode
    releaseAll()
  }, [visible, playerMode, releaseAll])

  useEffect(() => {
    return () => {
      releaseAll()
    }
  }, [releaseAll])

  useEffect(() => {
    let raf = 0
    const tick = () => {
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [])

  if (!visible) return null

  const pressed = (code: string) => pressedSet.has(code)

  const glassBtn =
    'pointer-events-auto flex items-center justify-center rounded-full border border-white/15 bg-black/40 shadow-lg shadow-black/40 backdrop-blur transition select-none'

  const pressedCls =
    '!border-amber-300 !bg-amber-400/30 text-amber-100 scale-90 !shadow-[0_0_18px_rgba(251,191,36,0.55)]'

  const tapKey = (code: string) => (e: React.PointerEvent<HTMLButtonElement>) => {
    e.preventDefault()
    markDown(code)
    window.clearTimeout(flashRef.current[code])
    keyEvent('keydown', code)
    setTimeout(() => {
      keyEvent('keyup', code)
      markUp(code)
    }, 60)
  }
  const holdStart = (code: string) => (e: React.PointerEvent<HTMLButtonElement>) => {
    e.preventDefault()
    markDown(code)
    press(code)
  }
  const holdEnd = (code: string) => () => release(code)

  // Run is a latch on mobile: one press starts running forward, press again to
  // stop. Mirrors the desktop Shift+S sprint latch.
  const toggleRun = (e: React.PointerEvent<HTMLButtonElement>) => {
    e.preventDefault()
    if (runLatch.current) {
      runLatch.current = false
      setRunLatched(false)
      holdEnd(KEY_UP)()
      release(KEY_RUN)
    } else {
      runLatch.current = true
      setRunLatched(true)
      holdStart(KEY_UP)(e)
      if (!heldRef.current.has(KEY_RUN)) press(KEY_RUN)
    }
  }

  const onRotDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.target instanceof HTMLElement && e.target.closest('button')) return
    const x = e.clientX
    const mid = window.innerWidth / 2
    if (x < mid) return
    rotLastX.current = x
    setRotating(true)
    window.dispatchEvent(new CustomEvent('touch-look', { detail: { active: true } }))
    e.currentTarget.setPointerCapture(e.pointerId)
  }
  const onRotMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!rotating) return
    const dx = e.clientX - rotLastX.current
    if (Math.abs(dx) < 1) return
    window.dispatchEvent(new CustomEvent('touch-rotate', { detail: { delta: dx * 0.005 } }))
    rotLastX.current = e.clientX
  }
  const onRotUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!rotating) return
    setRotating(false)
    window.dispatchEvent(new CustomEvent('touch-look', { detail: { active: false } }))
    e.currentTarget.releasePointerCapture(e.pointerId)
  }

  const showExit = playerMode !== 'walk' && playerMode !== 'parachute'

  // Responsive sizes: scale down on small/medium phones so controls stay
  // compact, and cap large-screen sizes so they never feel oversized.
  const vw = Math.min(window.innerWidth, 480)
  const vh = Math.min(window.innerHeight, 900)
  const fit = Math.min(vw / 380, vh / 820, 1.1)
  const runBtn = Math.round(Math.min(64, 84 * fit) * uiScale)
  const bigBtn = Math.round(40 * uiScale)
  const jumpBtn = Math.round(Math.min(52, 68 * fit) * uiScale)
  const icon = Math.round(Math.min(22, 28 * fit) * uiScale)
  const iconSm = Math.round(16 * uiScale)
  const gap = Math.round(12 * uiScale)

  return (
    <div
      className="pointer-events-none fixed inset-0 z-20 [-webkit-touch-callout:none]"
      onContextMenu={(e) => e.preventDefault()}
      onPointerDown={onRotDown}
      onPointerMove={onRotMove}
      onPointerUp={onRotUp}
      onPointerCancel={onRotUp}
    >
      {/* Direction pad — bottom-left. A single Run button (hold) moves the
          player forward while running. The separate walk button is removed:
          forward already auto-runs, so one control is enough. */}
      <div
        className="pointer-events-auto absolute bottom-[calc(2.5rem+env(safe-area-inset-bottom))] left-4 flex touch-none select-none flex-col items-center gap-3"
        style={{ width: runBtn }}
      >
        <button
          type="button"
          onPointerDown={toggleRun}
          className={`${glassBtn} touch-none${runLatched ? pressedCls : ''}`}
          style={{ width: runBtn, height: runBtn }}
          aria-label="Run forward"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.4"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="text-amber-300"
            style={{ width: icon, height: icon }}
            aria-hidden="true"
          >
            <path d="M13 3l-1 6 4 3-4 3-1 6" />
            <path d="M4 14l6-3M8 5l2 6" />
          </svg>
        </button>
      </div>

      {/* Right-side action dock — Jump, Exit. All other controls (look,
          steering, grow/snap) happen via the right-side drag rotation zone.
          Get-in prompts are handled by the floating TransportPrompt overlay. */}
      <div
        className="absolute right-4 flex flex-col items-center pb-[env(safe-area-inset-bottom)]"
        style={{ gap, bottom: 40 }}
      >
        {isWalk && (
          <button
            type="button"
            onPointerDown={tapKey(KEY_JUMP)}
            className={`${glassBtn} touch-none${pressed(KEY_JUMP) ? pressedCls : ''}`}
            style={{ width: jumpBtn, height: jumpBtn }}
            aria-label="Jump"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" className="text-white/90" style={{ width: icon, height: icon }} aria-hidden="true">
              <path d="M12 19V6" />
              <path d="M5 12l7-7 7 7" />
            </svg>
          </button>
        )}

        {showExit && (
          <button
            type="button"
            onPointerDown={tapKey(KEY_EXIT)}
            className={`${glassBtn} gap-2 px-5 text-xs font-bold text-red-300${
              pressed(KEY_EXIT) ? pressedCls : ''
            }`}
            style={{ height: bigBtn }}
            aria-label={
              playerMode === 'airplane' || playerMode === 'balloon'
                ? 'Exit the vehicle (bail out)'
                : 'Exit the vehicle'
            }
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ width: iconSm, height: iconSm }} aria-hidden="true">
              <path d="M12 4v10" />
              <path d="M7 9l5 5 5-9" />
              <path d="M4 20h16" />
            </svg>
            Exit
          </button>
        )}
      </div>
    </div>
  )
}
