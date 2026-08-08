import { useCallback, useEffect, useRef, useState, type JSX } from 'react'
import { useStore } from '../store/useStore'
import { useDeviceType } from '../hooks/useDeviceType'
import { walkHud } from '../store/walkState'

const STICK_RADIUS = 56
const DEADZONE = 0.22
const RUN_PUSH = 0.72

// Every vehicle controller maps the SAME physical keys — W/S/A/D — and reads
// them from window keydown/keyup listeners gated on their own active state
// (WalkController even mirrors W/S/A/D into inputState unconditionally). So a
// single joystick can drive every mode by dispatching synthetic key events;
// each controller interprets the codes in its own way (throttle vs forward,
// yaw vs strafe, rise vs flare...). Exit buttons dispatch Escape so the
// airplane/balloon bail-out path (parachute) fires exactly like the keyboard.
const KEY_UP = 'KeyW'
const KEY_DOWN = 'KeyS'
const KEY_LEFT = 'KeyA'
const KEY_RIGHT = 'KeyD'
const KEY_RUN = 'ShiftLeft'
const KEY_JUMP = 'Space'
const KEY_INTERACT = 'KeyE'
const KEY_EXIT = 'Escape'

function keyEvent(type: 'keydown' | 'keyup', code: string) {
  window.dispatchEvent(new KeyboardEvent(type, { code, key: code === KEY_EXIT ? 'Escape' : code, bubbles: true }))
}

interface StickState {
  id: number
  ox: number
  oy: number
  x: number
  y: number
}

/**
 * On-screen glass touch controls for touch devices, shown in EVERY mode (not
 * just walking): a dynamic joystick (appears wherever the finger lands on the
 * left side) plus a contextual action button. The joystick maps to W/S/A/D so
 * it drives the on-foot soldier, the car, bike, horse, airplane (throttle +
 * yaw), balloon (rise + drift) and parachute (flare/dive + steer) with the
 * same gesture. "Exit" fires Escape, so bailing out of a plane or balloon
 * opens the parachute just like pressing Z.
 */
export default function TouchControls(): JSX.Element | null {
  const deviceType = useDeviceType()
  const introDone = useStore((s) => s.introDone)
  const playerMode = useStore((s) => s.playerMode)

  const zoneRef = useRef<HTMLDivElement>(null)
  const stickRef = useRef<StickState | null>(null)
  const heldRef = useRef<Set<string>>(new Set())
  const [stick, setStick] = useState<StickState | null>(null)
  const [nearVehicle, setNearVehicle] = useState(false)

  const visible = deviceType === 'mobile' && introDone
  const isWalk = playerMode === 'walk'

  const release = useCallback((code: string) => {
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
    heldRef.current.forEach((code) => keyEvent('keyup', code))
    heldRef.current.clear()
  }, [])

  const applyStick = useCallback(
    (nx: number, ny: number, pushed: boolean, allowRun: boolean) => {
      const want = new Set<string>()
      if (ny < -DEADZONE) want.add(KEY_UP)
      else if (ny > DEADZONE) want.add(KEY_DOWN)
      if (nx < -DEADZONE) want.add(KEY_LEFT)
      else if (nx > DEADZONE) want.add(KEY_RIGHT)
      for (const held of [...heldRef.current]) {
        if (held !== KEY_RUN && !want.has(held)) release(held)
      }
      for (const code of want) {
        if (!heldRef.current.has(code)) press(code)
      }
      const runHeld = heldRef.current.has(KEY_RUN)
      if (allowRun && pushed && !runHeld) press(KEY_RUN)
      if ((!allowRun || !pushed) && runHeld) release(KEY_RUN)
    },
    [press, release],
  )

  // Never leave a key stuck: when the controls hide or the mode changes
  // (e.g. boarding a vehicle), release everything and re-apply the stick if it
  // is still being held.
  const modeRef = useRef(playerMode)
  useEffect(() => {
    releaseAll()
    if (modeRef.current !== playerMode) {
      modeRef.current = playerMode
      if (stickRef.current) {
        const s = stickRef.current
        applyStick(
          (s.x - s.ox) / STICK_RADIUS,
          (s.y - s.oy) / STICK_RADIUS,
          Math.hypot(s.x - s.ox, s.y - s.oy) > STICK_RADIUS * RUN_PUSH,
          playerMode === 'walk',
        )
      }
    }
  }, [visible, playerMode, releaseAll, applyStick])

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

  const startStick = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault()
    const zone = zoneRef.current
    if (!zone) return
    zone.setPointerCapture(e.pointerId)
    const s: StickState = {
      id: e.pointerId,
      ox: e.clientX,
      oy: e.clientY,
      x: e.clientX,
      y: e.clientY,
    }
    stickRef.current = s
    setStick(s)
  }

  const moveStick = (e: React.PointerEvent<HTMLDivElement>) => {
    const s = stickRef.current
    if (!s || s.id !== e.pointerId) return
    let dx = e.clientX - s.ox
    let dy = e.clientY - s.oy
    const len = Math.hypot(dx, dy)
    if (len > STICK_RADIUS) {
      dx = (dx / len) * STICK_RADIUS
      dy = (dy / len) * STICK_RADIUS
    }
    const nx = dx / STICK_RADIUS
    const ny = dy / STICK_RADIUS
    const pushed = len > STICK_RADIUS * RUN_PUSH
    applyStick(nx, ny, pushed, isWalk)
    const next = { ...s, x: s.ox + dx, y: s.oy + dy }
    stickRef.current = next
    setStick(next)
  }

  const endStick = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!stickRef.current || stickRef.current.id !== e.pointerId) return
    releaseAll()
    stickRef.current = null
    setStick(null)
  }

  const glassBtn =
    'pointer-events-auto flex items-center justify-center rounded-full border border-white/15 bg-black/40 shadow-lg shadow-black/40 backdrop-blur transition active:scale-95 select-none'

  // One-shot action buttons: tap dispatches a single keydown (jump/interact/
  // exit are edge-triggered or event-driven). Run is held while pressed.
  const tapKey = (code: string) => (e: React.PointerEvent<HTMLButtonElement>) => {
    e.preventDefault()
    keyEvent('keydown', code)
  }
  const holdStart = (code: string) => (e: React.PointerEvent<HTMLButtonElement>) => {
    e.preventDefault()
    press(code)
  }
  const holdEnd = (code: string) => () => release(code)

  const showExit = playerMode !== 'walk' && playerMode !== 'parachute'

  return (
    <div className="pointer-events-none fixed inset-0 z-20">
      {/* Dynamic joystick capture zone: left side, clear of the top HUD strip
          and the bottom-left minimap. */}
      <div
        ref={zoneRef}
        onPointerDown={startStick}
        onPointerMove={moveStick}
        onPointerUp={endStick}
        onPointerCancel={endStick}
        onContextMenu={(e) => e.preventDefault()}
        className="pointer-events-auto absolute bottom-[240px] left-0 top-[110px] w-1/2 touch-none select-none"
      />

      {stick && (
        <>
          <div
            className="pointer-events-none absolute h-[116px] w-[116px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/20 bg-black/30 backdrop-blur-sm"
            style={{ left: stick.ox, top: stick.oy }}
          />
          <div
            className="pointer-events-none absolute h-14 w-14 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/30 bg-white/25 backdrop-blur"
            style={{ left: stick.x, top: stick.y }}
          />
        </>
      )}

      {/* Get in — walk mode only, above the jump/sprint buttons. */}
      {isWalk && nearVehicle && (
        <button
          type="button"
          onPointerDown={tapKey(KEY_INTERACT)}
          className={`${glassBtn} absolute bottom-[150px] right-5 gap-2 px-4 py-3 text-xs font-bold text-amber-300`}
          aria-label="Get into the nearby vehicle"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-4 w-4"
            aria-hidden="true"
          >
            <path d="M12 3v12" />
            <path d="M7 10l5 5 5-5" />
            <path d="M4 20h16" />
          </svg>
          Get in
        </button>
      )}

      {/* Jump — walk mode only. */}
      {isWalk && (
        <button
          type="button"
          onPointerDown={tapKey(KEY_JUMP)}
          className={`${glassBtn} absolute right-5 h-16 w-16 touch-none ${
            nearVehicle ? 'bottom-[238px]' : 'bottom-[150px]'
          }`}
          aria-label="Jump"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.4"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-7 w-7 text-white/90"
            aria-hidden="true"
          >
            <path d="M12 19V6" />
            <path d="M5 12l7-7 7 7" />
          </svg>
        </button>
      )}

      {/* Sprint — walk mode only (joystick push also runs). */}
      {isWalk && (
        <button
          type="button"
          onPointerDown={holdStart(KEY_RUN)}
          onPointerUp={holdEnd(KEY_RUN)}
          onPointerCancel={holdEnd(KEY_RUN)}
          onPointerLeave={holdEnd(KEY_RUN)}
          className={`${glassBtn} absolute right-5 h-12 w-12 touch-none ${
            nearVehicle ? 'bottom-[326px]' : 'bottom-[238px]'
          }`}
          aria-label="Sprint"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.4"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-5 w-5 text-amber-300"
            aria-hidden="true"
          >
            <path d="M13 3l-1 6 4 3-4 3-1 6" />
            <path d="M4 14l6-3M8 5l2 6" />
          </svg>
        </button>
      )}

      {/* Exit / bail out — every vehicle. Dispatches Escape so plane/balloon
          exits go through the parachute bail-out path. */}
      {showExit && (
        <button
          type="button"
          onPointerDown={tapKey(KEY_EXIT)}
          className={`${glassBtn} absolute right-5 bottom-[150px] gap-2 px-4 py-3 text-xs font-bold text-red-300`}
          aria-label={
            playerMode === 'airplane' || playerMode === 'balloon' ? 'Exit the vehicle (bail out)' : 'Exit the vehicle'
          }
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-4 w-4"
            aria-hidden="true"
          >
            <path d="M12 4v10" />
            <path d="M7 9l5 5 5-5" />
            <path d="M4 20h16" />
          </svg>
          Exit
        </button>
      )}
    </div>
  )
}
