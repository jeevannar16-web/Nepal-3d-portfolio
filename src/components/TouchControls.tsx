import { useCallback, useEffect, useRef, useState, type JSX } from 'react'
import { useStore } from '../store/useStore'
import { useControls, primaryCode } from '../store/controlsStore'
import { useDeviceType } from '../hooks/useDeviceType'
import { walkHud } from '../store/walkState'

// Every vehicle controller maps the SAME physical keys as the walking soldier
// — and reads them from the shared control bindings in controlsStore, gated on
// their own active state. So a single direction pad can drive every mode by
// dispatching synthetic key events with the bound codes; each controller
// interprets the action in its own way (throttle vs forward, yaw vs strafe,
// rise vs flare...). Exit buttons dispatch the bound exit key so the
// airplane/balloon bail-out path (parachute) fires exactly like the keyboard.

function keyEvent(type: 'keydown' | 'keyup', code: string) {
  window.dispatchEvent(
    new KeyboardEvent(type, { code, key: code === 'Escape' ? 'Escape' : code, bubbles: true }),
  )
}

/**
 * On-screen glass touch controls for touch devices, shown in EVERY mode (not
 * just walking): a fixed direction pad (forward/back/left/right) plus a Run
 * button on the left, and a vertical dock of action buttons on the right. The
 * pad maps to the bound forward/back/left/right actions so it drives the
 * on-foot soldier, the car, bike, horse, airplane (throttle + yaw), balloon
 * (rise + drift) and parachute (flare/dive + steer). The dock holds
 * Jump/Interact while walking and Exit while riding, plus a camera-snap and a
 * grow/shrink toggle that work in every mode. Button sizes follow the
 * persisted uiScale setting in Settings → Touch & UI.
 */
export default function TouchControls(): JSX.Element | null {
  const deviceType = useDeviceType()
  const introDone = useStore((s) => s.introDone)
  const playerMode = useStore((s) => s.playerMode)
  const uiScale = useStore((s) => s.settings.uiScale)
  // Subscribe to the bindings so a rebind instantly re-targets the synthetic
  // keys (the pad then drives whatever the player assigned to each action).
  const bindings = useControls((s) => s.bindings)
  const requestCameraSnap = useControls((s) => s.requestCameraSnap)
  const toggleBigMode = useControls((s) => s.toggleBigMode)

  const heldRef = useRef<Set<string>>(new Set())
  const [pressedSet, setPressedSet] = useState<Set<string>>(new Set())
  const flashRef = useRef<Record<string, number>>({})
  const [nearVehicle, setNearVehicle] = useState(false)

  const visible = deviceType === 'mobile' && introDone
  const isMobile = deviceType === 'mobile'
  const isWalk = playerMode === 'walk'

  // Derive the synthetic key codes straight from the subscribed bindings so a
  // rebind re-renders here and instantly re-targets the pad + buttons.
  const firstSpec = (a: (typeof bindings)[keyof typeof bindings]) => a[0] ?? ''
  const KEY_UP = firstSpec(bindings.forward)
  const KEY_DOWN = firstSpec(bindings.back)
  // The on-screen LEFT arrow must turn the actor to screen-left. The "left"
  // action is bound to D/→/End (which the user chose to turn RIGHT on screen),
  // so the screen-left turn lives in the "right" action (A/←/Home) — dispatch
  // the opposite action on each side to match the arrow icon.
  const KEY_LEFT = firstSpec(bindings.right)
  const KEY_RIGHT = firstSpec(bindings.left)
  const KEY_RUN = primaryCode('run')
  const KEY_JUMP = primaryCode('jump')
  const KEY_INTERACT = primaryCode('interact')
  const KEY_EXIT = primaryCode('exit')

  // Light haptic tick so every press has tactile confirmation on phones that
  // support it; wrapped in try so a blocked Vibrate API never throws.
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
    heldRef.current.forEach((code) => keyEvent('keyup', code))
    heldRef.current.clear()
  }, [])

  // Never leave a key stuck: when the controls hide or the mode changes
  // (e.g. boarding a vehicle), release everything.
  const modeRef = useRef(playerMode)
  useEffect(() => {
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
      setNearVehicle((prev) => (prev === walkHud.nearVehicle ? prev : walkHud.nearVehicle))
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
    ' border-amber-400/70 bg-amber-400/20 text-amber-200 scale-95 shadow-amber-400/20'

  // One-shot action buttons: tap dispatches a single keydown (jump/interact/
  // exit are edge-triggered or event-driven) with a brief pressed flash.
  const tapKey = (code: string) => (e: React.PointerEvent<HTMLButtonElement>) => {
    e.preventDefault()
    markDown(code)
    window.clearTimeout(flashRef.current[code])
    flashRef.current[code] = window.setTimeout(() => markUp(code), 160)
    keyEvent('keydown', code)
  }
  const holdStart = (code: string) => (e: React.PointerEvent<HTMLButtonElement>) => {
    e.preventDefault()
    markDown(code)
    press(code)
  }
  const holdEnd = (code: string) => () => release(code)

  // On touch/mobile a sustained forward press should sprint (hold Run as well
  // as Forward), matching the desktop Shift+W behaviour — otherwise the forward
  // arrow only walks. Desktop keeps Forward alone so Shift can still be used as
  // a modifier.
  const startForward = isMobile
    ? (e: React.PointerEvent<HTMLButtonElement>) => {
        holdStart(KEY_UP)(e)
        press(KEY_RUN)
      }
    : holdStart(KEY_UP)
  const endForward = isMobile
    ? () => {
        holdEnd(KEY_UP)()
        release(KEY_RUN)
      }
    : holdEnd(KEY_UP)

  const showExit = playerMode !== 'walk' && playerMode !== 'parachute'

  // Sizes scale with the uiScale setting (0.75x..1.5x).
  const padBtn = Math.round(60 * uiScale)
  const runBtn = Math.round(64 * uiScale)
  const bigBtn = Math.round(46 * uiScale)
  const jumpBtn = Math.round(66 * uiScale)
  const icon = Math.round(24 * uiScale)
  const iconSm = Math.round(18 * uiScale)
  const gap = Math.round(12 * uiScale)

  return (
    <div
      className="pointer-events-none fixed inset-0 z-20 [-webkit-touch-callout:none]"
      onContextMenu={(e) => e.preventDefault()}
    >
      {/* Direction pad — fixed, bottom-left. Holds the bound direction keys;
          the center button is Run (hold to sprint while walking). */}
      <div
        className="pointer-events-auto absolute bottom-6 left-4 grid touch-none select-none grid-cols-3 gap-1"
        style={{ width: padBtn * 3 + gap * 2 }}
      >
        <div />
        <button
          type="button"
          onPointerDown={startForward}
          onPointerUp={endForward}
          onPointerCancel={endForward}
          onPointerLeave={endForward}
          className={`${glassBtn} touch-none${pressed(KEY_UP) ? pressedCls : ''}`}
          style={{ width: padBtn, height: padBtn }}
          aria-label="Forward"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.4"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="text-white/90"
            style={{ width: icon, height: icon }}
            aria-hidden="true"
          >
            <path d="M12 19V6" />
            <path d="M5 12l7-7 7 7" />
          </svg>
        </button>
        <div />
        <button
          type="button"
          onPointerDown={holdStart(KEY_LEFT)}
          onPointerUp={holdEnd(KEY_LEFT)}
          onPointerCancel={holdEnd(KEY_LEFT)}
          onPointerLeave={holdEnd(KEY_LEFT)}
          className={`${glassBtn} touch-none${pressed(KEY_LEFT) ? pressedCls : ''}`}
          style={{ width: padBtn, height: padBtn }}
          aria-label="Turn left"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.4"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="text-white/90"
            style={{ width: icon, height: icon }}
            aria-hidden="true"
          >
            <path d="M19 12H6" />
            <path d="M12 5l-7 7 7 7" />
          </svg>
        </button>
        <div className="relative flex items-center justify-center">
          {isWalk && (
            <button
              type="button"
              onPointerDown={holdStart(KEY_RUN)}
              onPointerUp={holdEnd(KEY_RUN)}
              onPointerCancel={holdEnd(KEY_RUN)}
              onPointerLeave={holdEnd(KEY_RUN)}
              className={`${glassBtn} absolute touch-none${pressed(KEY_RUN) ? pressedCls : ''}`}
              style={{ width: runBtn, height: runBtn }}
              aria-label="Run"
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
          )}
        </div>
        <button
          type="button"
          onPointerDown={holdStart(KEY_RIGHT)}
          onPointerUp={holdEnd(KEY_RIGHT)}
          onPointerCancel={holdEnd(KEY_RIGHT)}
          onPointerLeave={holdEnd(KEY_RIGHT)}
          className={`${glassBtn} touch-none${pressed(KEY_RIGHT) ? pressedCls : ''}`}
          style={{ width: padBtn, height: padBtn }}
          aria-label="Turn right"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.4"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="text-white/90"
            style={{ width: icon, height: icon }}
            aria-hidden="true"
          >
            <path d="M5 12h13" />
            <path d="M12 5l7 7-7 7" />
          </svg>
        </button>
        <div />
        <button
          type="button"
          onPointerDown={holdStart(KEY_DOWN)}
          onPointerUp={holdEnd(KEY_DOWN)}
          onPointerCancel={holdEnd(KEY_DOWN)}
          onPointerLeave={holdEnd(KEY_DOWN)}
          className={`${glassBtn} touch-none${pressed(KEY_DOWN) ? pressedCls : ''}`}
          style={{ width: padBtn, height: padBtn }}
          aria-label="Back"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.4"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="text-white/90"
            style={{ width: icon, height: icon }}
            aria-hidden="true"
          >
            <path d="M12 5v13" />
            <path d="M19 12l-7 7-7-7" />
          </svg>
        </button>
        <div />
      </div>

      {/* Right-side action dock, stacked bottom-up so nothing overlaps. When
          riding it sits above the bottom-right HUD cluster; when walking the
          bottom right is free so the dock drops lower. */}
      <div
        className="absolute right-4 flex flex-col items-center"
        style={{ gap, bottom: showExit ? 44 * uiScale + 96 : 96 * uiScale }}
      >
        {/* Grow / shrink — every mode (touch equivalent of Ctrl+Home). */}
        <button
          type="button"
          onPointerDown={(e) => {
            e.preventDefault()
            markDown('grow')
            window.clearTimeout(flashRef.current['grow'])
            flashRef.current['grow'] = window.setTimeout(() => markUp('grow'), 160)
            toggleBigMode()
          }}
          className={`${glassBtn} touch-none${pressed('grow') ? pressedCls : ''}`}
          style={{ width: bigBtn, height: bigBtn }}
          aria-label="Grow or shrink the model"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="text-sky-300"
            style={{ width: iconSm, height: iconSm }}
            aria-hidden="true"
          >
            <circle cx="12" cy="12" r="7" />
            <path d="M12 8v8M8 12h8" />
          </svg>
        </button>

        {/* Camera snap — reset free-look behind the actor, every mode. */}
        <button
          type="button"
          onPointerDown={(e) => {
            e.preventDefault()
            markDown('snap')
            window.clearTimeout(flashRef.current['snap'])
            flashRef.current['snap'] = window.setTimeout(() => markUp('snap'), 160)
            requestCameraSnap()
          }}
          className={`${glassBtn} touch-none${pressed('snap') ? pressedCls : ''}`}
          style={{ width: bigBtn, height: bigBtn }}
          aria-label="Snap the camera behind you"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="text-emerald-300"
            style={{ width: iconSm, height: iconSm }}
            aria-hidden="true"
          >
            <circle cx="12" cy="10" r="3" />
            <path d="M12 19v-6M8 3h8l-1 4H9l-1-4z" />
            <path d="M12 7v1" />
          </svg>
        </button>

        {/* Get in / Interact — walk mode only. Dispatches the bound interact
            key so it lands in the same enter-vehicle path as the keyboard. */}
        {isWalk && (
          <button
            type="button"
            onPointerDown={tapKey(KEY_INTERACT)}
            className={`${glassBtn} gap-2 px-5 text-xs font-bold ${
              pressed(KEY_INTERACT)
                ? pressedCls
                : nearVehicle
                  ? 'text-amber-300'
                  : 'text-white/80'
            }`}
            style={{ height: bigBtn }}
            aria-label={nearVehicle ? 'Get into the nearby vehicle' : 'Interact'}
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className=""
              style={{ width: iconSm, height: iconSm }}
              aria-hidden="true"
            >
              <path d="M12 3v12" />
              <path d="M7 10l5 5 5-5" />
              <path d="M4 20h16" />
            </svg>
            {nearVehicle ? 'Get in' : 'Interact'}
          </button>
        )}

        {/* Exit / bail out — every vehicle. Dispatches the bound exit key so
            plane/balloon exits go through the parachute bail-out path. */}
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
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{ width: iconSm, height: iconSm }}
              aria-hidden="true"
            >
              <path d="M12 4v10" />
              <path d="M7 9l5 5 5-5" />
              <path d="M4 20h16" />
            </svg>
            Exit
          </button>
        )}

        {/* Jump — walk mode only. */}
        {isWalk && (
          <button
            type="button"
            onPointerDown={tapKey(KEY_JUMP)}
            className={`${glassBtn} touch-none${pressed(KEY_JUMP) ? pressedCls : ''}`}
            style={{ width: jumpBtn, height: jumpBtn }}
            aria-label="Jump"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.4"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="text-white/90"
              style={{ width: icon, height: icon }}
              aria-hidden="true"
            >
              <path d="M12 19V6" />
              <path d="M5 12l7-7 7 7" />
            </svg>
          </button>
        )}
      </div>
    </div>
  )
}
