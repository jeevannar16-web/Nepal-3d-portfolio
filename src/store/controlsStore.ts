import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'

/**
 * Remappable control bindings, the single source of truth for every input
 * path in the app: the walking soldier (WalkController), all vehicle
 * controllers (car / bike / horse / airplane / balloon) and the on-screen
 * touch controls all translate physical keys through these actions, so a
 * rebind here takes effect everywhere at once.
 *
 * Key specs: either a plain KeyboardEvent.code ('KeyW', 'Space', 'ShiftLeft')
 * or a chord of modifiers + code ('Control+Home', 'Shift+KeyS'). A plain code
 * matches whenever that physical key is down regardless of held modifiers; a
 * chord matches only when the listed modifiers are exactly held.
 */
export type ControlAction =
  | 'forward'
  | 'back'
  | 'left'
  | 'right'
  | 'run'
  | 'jump'
  | 'interact'
  | 'exit'
  | 'crouch'
  | 'sizeToggle'

export const ACTION_ORDER: ControlAction[] = [
  'forward',
  'back',
  'left',
  'right',
  'run',
  'jump',
  'interact',
  'exit',
  'crouch',
  'sizeToggle',
]

export const ACTION_LABELS: Record<ControlAction, string> = {
  forward: 'Move forward',
  back: 'Move back',
  left: 'Turn / strafe left',
  right: 'Turn / strafe right',
  run: 'Run (hold)',
  jump: 'Jump',
  interact: 'Interact / get in',
  exit: 'Exit vehicle / bail out',
  crouch: 'Crouch',
  sizeToggle: 'Grow / shrink model',
}

export const DEFAULT_BINDINGS: Record<ControlAction, string[]> = {
  forward: ['KeyW', 'ArrowUp'],
  back: ['KeyS', 'ArrowDown'],
  left: ['KeyA', 'ArrowLeft'],
  right: ['KeyD', 'ArrowRight'],
  run: ['ShiftLeft', 'ShiftRight', 'Shift+KeyS'],
  jump: ['Space'],
  interact: ['KeyE'],
  exit: ['Escape', 'KeyZ'],
  crouch: ['ControlLeft', 'ControlRight', 'KeyC'],
  sizeToggle: ['Control+Home'],
}

interface ControlsState {
  bindings: Record<ControlAction, string[]>
  bigMode: boolean
  /** Incremented whenever the player asks to snap the camera behind them. */
  cameraSnapTick: number
  setBinding: (action: ControlAction, spec: string) => void
  resetBindings: () => void
  toggleBigMode: () => void
  setBigMode: (on: boolean) => void
  requestCameraSnap: () => void
}

const isChord = (spec: string) => spec.includes('+')

/**
 * Exact chord match: the event's modifiers must equal the spec's modifiers and
 * the code must equal the spec's final code (so 'Control+Home' does not fire
 * on a bare Home press).
 */
export function chordMatches(e: KeyboardEvent, spec: string): boolean {
  const parts = spec.split('+')
  const code = parts[parts.length - 1]
  if (e.code !== code) return false
  const wantsCtrl = parts.includes('Control')
  const wantsShift = parts.includes('Shift')
  const wantsAlt = parts.includes('Alt')
  return e.ctrlKey === wantsCtrl && e.shiftKey === wantsShift && e.altKey === wantsAlt
}

/**
 * Does any of the action's bound specs match this event? Plain codes match on
 * the physical key alone (so Shift+W still drives "forward"); chords require
 * the exact modifier combination (so Ctrl+Home never fires from a bare Home).
 */
export function matchesAction(e: KeyboardEvent, action: ControlAction): boolean {
  const specs = useControls.getState().bindings[action]
  return specs.some((spec) => (isChord(spec) ? chordMatches(e, spec) : e.code === spec))
}

/** First non-chord spec of an action, for synthetic dispatch (touch controls). */
export function primaryCode(action: ControlAction): string {
  const specs = useControls.getState().bindings[action]
  return specs.find((s) => !isChord(s)) ?? specs[0]
}

/** Human-readable label for a key spec (used in the controls UI). */
export function keyLabel(spec: string): string {
  const parts = spec.split('+')
  const mods = parts.slice(0, -1)
  const code = parts[parts.length - 1]
  const modLabel: Record<string, string> = {
    Control: 'Ctrl',
    Shift: 'Shift',
    Alt: 'Alt',
  }
  const codeLabel: Record<string, string> = {
    Space: 'Space',
    Escape: 'Esc',
    ArrowUp: 'Up',
    ArrowDown: 'Down',
    ArrowLeft: 'Left',
    ArrowRight: 'Right',
    ShiftLeft: 'Shift',
    ShiftRight: 'Shift',
    ControlLeft: 'Ctrl',
    ControlRight: 'Ctrl',
    Home: 'Home',
    KeyW: 'W',
    KeyA: 'A',
    KeyS: 'S',
    KeyD: 'D',
    KeyC: 'C',
    KeyE: 'E',
    KeyG: 'G',
    KeyQ: 'Q',
    KeyR: 'R',
    KeyZ: 'Z',
  }
  const main = codeLabel[code] ?? code.replace('Key', '').replace(/^Digit/, '')
  return [...mods.map((m) => modLabel[m] ?? m), main].join('+')
}

export const useControls = create<ControlsState>()(
  persist(
    (set) => ({
      bindings: DEFAULT_BINDINGS,
      bigMode: false,
      cameraSnapTick: 0,
      setBinding: (action, spec) =>
        set((s) => ({
          bindings: {
            ...s.bindings,
            [action]: [spec],
          },
        })),
      resetBindings: () => set({ bindings: DEFAULT_BINDINGS }),
      toggleBigMode: () => set((s) => ({ bigMode: !s.bigMode })),
      setBigMode: (on) => set({ bigMode: on }),
      requestCameraSnap: () => set((s) => ({ cameraSnapTick: s.cameraSnapTick + 1 })),
    }),
    {
      name: 'nepal-portfolio-controls',
      storage: createJSONStorage(() => localStorage),
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<ControlsState>
        return {
          ...current,
          ...p,
          // Older saved bindings may miss actions added later; always fill
          // every action from the current defaults.
          bindings: {
            ...current.bindings,
            ...(p.bindings ?? {}),
          },
        }
      },
      partialize: (s) => ({
        bindings: s.bindings,
        bigMode: s.bigMode,
      }),
    },
  ),
)
