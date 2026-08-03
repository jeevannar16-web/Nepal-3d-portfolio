import { useEffect, useRef, useState, type JSX } from 'react'
import { useStore } from '../store/useStore'
import { useDeviceType } from '../hooks/useDeviceType'
import { inputState, walkHud } from '../store/walkState'

const STICK_RADIUS = 56
const DEADZONE = 0.22
const RUN_PUSH = 0.72

interface StickState {
  id: number
  ox: number
  oy: number
  x: number
  y: number
}

/**
 * On-screen glass touch controls for the on-foot soldier on touch devices:
 * a dynamic joystick (appears wherever the finger lands on the left side) that
 * drives the same movement input as WASD, plus jump/sprint and a contextual
 * "get in" button (the E key). Vehicles keep their own HUD, so these only show
 * while walking. Glass styling matches the rest of the HUD (HudCluster,
 * ExitVehicleButton).
 */
export default function TouchControls(): JSX.Element | null {
  const deviceType = useDeviceType()
  const introDone = useStore((s) => s.introDone)
  const playerMode = useStore((s) => s.playerMode)

  const zoneRef = useRef<HTMLDivElement>(null)
  const stickRef = useRef<StickState | null>(null)
  const [stick, setStick] = useState<StickState | null>(null)
  const [nearVehicle, setNearVehicle] = useState(false)

  const visible = deviceType === 'mobile' && introDone && playerMode === 'walk'

  useEffect(() => {
    if (!visible) {
      inputState.fwd = inputState.back = inputState.left = inputState.right = inputState.run = false
      stickRef.current = null
      setStick(null)
    }
  }, [visible])

  useEffect(() => {
    let raf = 0
    const tick = () => {
      setNearVehicle((prev) => (prev === walkHud.nearVehicle ? prev : walkHud.nearVehicle))
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => {
      cancelAnimationFrame(raf)
      inputState.fwd = inputState.back = inputState.left = inputState.right = inputState.run = false
    }
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
    inputState.fwd = ny < -DEADZONE
    inputState.back = ny > DEADZONE
    inputState.left = nx < -DEADZONE
    inputState.right = nx > DEADZONE
    inputState.run = len > STICK_RADIUS * RUN_PUSH
    const next = { ...s, x: s.ox + dx, y: s.oy + dy }
    stickRef.current = next
    setStick(next)
  }

  const endStick = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!stickRef.current || stickRef.current.id !== e.pointerId) return
    inputState.fwd = inputState.back = inputState.left = inputState.right = inputState.run = false
    stickRef.current = null
    setStick(null)
  }

  const glassBtn =
    'pointer-events-auto flex items-center justify-center rounded-full border border-white/15 bg-black/40 shadow-lg shadow-black/40 backdrop-blur transition active:scale-95 select-none'

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

      {/* Action buttons: stacked above the bottom-right HUD cluster. The jump
          and sprint buttons shift up when the contextual "Get in" button is
          present so they never overlap. */}
      {nearVehicle && (
        <button
          type="button"
          onPointerDown={(e) => {
            e.preventDefault()
            inputState.interact = true
          }}
          onPointerUp={(e) => {
            e.preventDefault()
            inputState.interact = false
          }}
          onPointerCancel={() => {
            inputState.interact = false
          }}
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

      <button
        type="button"
        onPointerDown={(e) => {
          e.preventDefault()
          inputState.jump = true
        }}
        onPointerUp={(e) => {
          e.preventDefault()
          inputState.jump = false
        }}
        onPointerCancel={() => {
          inputState.jump = false
        }}
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

      <button
        type="button"
        onPointerDown={(e) => {
          e.preventDefault()
          inputState.run = true
        }}
        onPointerUp={(e) => {
          e.preventDefault()
          inputState.run = false
        }}
        onPointerCancel={() => {
          inputState.run = false
        }}
        onPointerLeave={() => {
          inputState.run = false
        }}
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
    </div>
  )
}
