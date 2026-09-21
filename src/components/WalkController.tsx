import { useEffect, useRef, type JSX } from 'react'
import { useFrame } from '@react-three/fiber'
import {
  RigidBody,
  CapsuleCollider,
  type RapierRigidBody,
} from '@react-three/rapier'
import * as THREE from 'three'
import { minimapState } from '../store/minimapState'
import { useStore } from '../store/useStore'
import { transportState, type TransportPose } from '../store/transportState'
import { walkState, inputState, walkHud, feetLocalY, walkDebug } from '../store/walkState'
import { useControls, matchesAction, chordMatches } from '../store/controlsStore'
import Soldier from './Soldier'

const WALK_SPEED = 3.0
const SPRINT_SPEED = 5.2
const CROUCH_SPEED = 1.4
// "Big" mode (Ctrl+Home) scales the avatar up and makes every pace slower, so
// the oversized model still feels deliberate instead of blasting around.
const BIG_SPEED_MULT = 0.55
const ACCEL = 24 // snappy acceleration so the gait stays in phase with the body
const JUMP_VEL = 5.5 // takeoff impulse — applied once per jump, never re-applied
const GRAVITY = 9.81 // rapier world gravity, used for the extra fall pull below
const FALL_GRAVITY_MULT = 1.45 // extra downward accel while falling → decisive descent
const MAX_FALL_SPEED = -9 // terminal fall speed, clamped every frame
const ENTER_RADIUS = 3.6
const ANTICIPATE_TIME = 0.12 // brief load-up before the impulse (the jump clip's crouch fades in)
const LAND_TIME = 0.28 // landing recovery window before control resumes
// Jump forgiveness: a press slightly off a ledge (coyote) or just before
// landing (buffer) still fires, but OS key auto-repeat and held touch can never
// stack jumps — each jump impulse is single-shot.
const COYOTE_TIME = 0.09
const JUMP_BUFFER_TIME = 0.13
// Grounded detection: the capsule's feet sit ~CAPSULE_HALF_LEN below the body
// centre and the walkable ground (valley floor + runway) is near-flat at y≈0,
// so a small feet-height band + multi-frame confirm debounce the reading (no
// slope/fall flicker), and the airborne/landed edges drive a coyote timer.
const GROUND_PROBE = 0.12
const GROUND_TICKS = 3
// Sprint latch: Shift+S toggles running on/off (press once → run until pressed
// again), independent of the plain-Shift hold-to-run. Only while on foot.
const RUN_TOGGLE_CHORD = 'Shift+KeyS'
// Physics capsule is CapsuleCollider[0.55, 0.32]; its bottom (and the soldier
// model's feet, which sit at the visual group origin) hangs this far below the
// body centre, so the visual rides the capsule's bottom.
const CAPSULE_HALF_LEN = 0.55 + 0.32
// Runway top; the intro's scripted exit walk stays on the tarmac (z 84..92).
const RUNWAY_TOP = 0.04
// Walking turns: while a turn key is held the soldier rotates steadily in
// that direction (TURN_HOLD_RATE), so aiming at anything is smooth and easy.
// A single continuous hold is capped at TURN_HOLD_MAX — it can never swing a
// full 360° on its own — and releasing resets the cap. Quick taps give small,
// precise nudges. Direction flips when "Invert turn direction" is on.
const TURN_HOLD_RATE = 2.2 // rad/s sustained turn while a turn key is held (~1/4 turn per second)
const TURN_HOLD_MAX = THREE.MathUtils.degToRad(270) // max rotation per single hold (< 360°)

interface WalkControllerProps {
  bodyRef: React.RefObject<RapierRigidBody | null>
  /** When false the soldier is hidden away (riding inside a vehicle). */
  active: boolean
}

/**
 * On-foot player: the soldier walks, runs and jumps around the valley with
 * WASD relative to the camera, and presses E near the car, motorcycle or horse
 * to climb in. Right after the intro he steps out of the landed plane (a short
 * scripted walk) before the player takes control. His body stays mounted for
 * the whole session — hidden far below the world when not walking — so mode
 * switches never remove a physics body (which rapier can panic on).
 */
export default function WalkController({
  bodyRef,
  active,
}: WalkControllerProps): JSX.Element {
  const setPlayerMode = useStore((s) => s.setPlayerMode)
  const body = useRef<RapierRigidBody>(null)
  const visual = useRef<THREE.Group>(null)
  const heading = useRef(transportState.walk.heading)
  const holdTurn = useRef(0)
  const grounded = useRef(true)
  const crouching = useRef(false)
  const jumpState = useRef<'anticipate' | 'airborne' | 'land' | null>(null)
  const jumpTimer = useRef(0)
  const coyote = useRef(0) // seconds still allowed to jump after leaving the ground
  const jumpBuffer = useRef(0) // remaining window for a buffered jump press
  const groundedTicks = useRef(0) // consecutive frames inside the ground band
  const airborneTicks = useRef(0) // consecutive frames outside the ground band
  const scriptTime = useRef(-1)
  const motionRef = useRef({
    moving: false,
    running: false,
    crouching: false,
    jump: null as 'anticipate' | 'airborne' | 'land' | null,
    speed: 0,
  })
  const activeRef = useRef(active)
  activeRef.current = active
  const activePrev = useRef(active)

  // Reactivation must run in a parent effect so it flushes AFTER the child
  // RigidBody's mutable-options effect. That library effect re-syncs the body
  // to the (stale) matrixWorld of the parked object3D on type/position changes,
  // which would otherwise stomp any teleport done from useFrame — leaving the
  // soldier buried at the hidden stash. Running last guarantees we win, so we
  // always re-place the body when the walker activates (mount + each reactivate).
  useEffect(() => {
    const rb = body.current
    if (!rb) return
    if (active) {
      const tx = transportState.walk
      rb.setTranslation({ x: tx.x, y: tx.y, z: tx.z }, true)
      rb.setLinvel({ x: 0, y: 0, z: 0 }, true)
      heading.current = tx.heading
      holdTurn.current = 0
    }
  }, [active])

  const nearVehicle = (pos: { x: number; z: number }) => {
    for (const kind of ['car', 'bike', 'horse'] as const) {
      const p = transportState[kind]
      if (Math.hypot(pos.x - p.x, pos.z - p.z) < ENTER_RADIUS) return true
    }
    for (const plane of ['airplane', 'airplane2'] as const) {
      const ap = transportState[plane]
      if (Math.hypot(pos.x - ap.x, pos.z - ap.z) < ENTER_RADIUS * 1.5) return true
    }
    const bl = transportState.balloon
    if (Math.hypot(pos.x - bl.x, pos.z - bl.z) < ENTER_RADIUS * 1.5) return true
    return false
  }

  const enterVehicle = () => {
    const rb = body.current
    if (!rb) return
    const pos = rb.translation()
    for (const kind of ['car', 'bike', 'horse'] as const) {
      const p = transportState[kind]
      if (Math.hypot(pos.x - p.x, pos.z - p.z) < ENTER_RADIUS) {
        p.heading = heading.current
        setPlayerMode(kind)
        return
      }
    }
    for (const plane of ['airplane', 'airplane2'] as const) {
      const ap = transportState[plane]
      if (Math.hypot(pos.x - ap.x, pos.z - ap.z) < ENTER_RADIUS * 1.5) {
        ap.heading = heading.current
        transportState.activePlane = plane
        setPlayerMode('airplane')
        return
      }
    }
    const bl = transportState.balloon
    if (Math.hypot(pos.x - bl.x, pos.z - bl.z) < ENTER_RADIUS * 1.5) {
      bl.heading = heading.current
      setPlayerMode('balloon')
      return
    }
  }

  // Physical keys currently acting as forward. Tracked by code so that when S
  // doubles as forward (it always does — the soldier never walks backward),
  // holding W + S and releasing one never drops the other.
  const fwdCodes = useRef(new Set<string>())

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      // Movement keys are tracked even while the soldier is riding (hidden), so
      // a held W/S/A/D from the vehicle carries straight over the moment the
      // player steps out — no need to release and re-press the key after
      // dismounting. Everything resolves through the shared control bindings.
      // Run is matched before forward/back so Shift+ArrowUp / Shift+ArrowDown /
      // Shift+S sprint chords resolve to running instead of being swallowed by
      // the plain up/down forward bindings. Those keys are forward keys, so a
      // run chord must ALSO set forward — otherwise the sprint would run in
      // place and never advance.
      //
      // Shift+S is a pure toggle: press once → sprint ON (keeps moving forward
      // automatically), press again → sprint OFF. Releasing the chord or the
      // Shift key alone does NOT cancel it — the latch survives until the same
      // chord is pressed a second time. The S key code is tracked in fwdCodes
      // so releasing it never accidentally clears forward movement while the
      // latch is active.
      if (
        activeRef.current &&
        !e.repeat &&
        chordMatches(e, RUN_TOGGLE_CHORD)
      ) {
        inputState.runToggle = !inputState.runToggle
        if (!inputState.runToggle) {
          inputState.run = false
          fwdCodes.current.clear()
          inputState.fwd = false
        } else {
          fwdCodes.current.add(e.code)
          inputState.fwd = true
        }
        e.preventDefault()
        return
      }
      if (matchesAction(e, 'run')) {
        inputState.run = true
        if (matchesAction(e, 'forward') || matchesAction(e, 'back')) {
          fwdCodes.current.add(e.code)
          inputState.fwd = true
        }
        e.preventDefault()
        return
      }
      if (matchesAction(e, 'forward')) {
        fwdCodes.current.add(e.code)
        inputState.fwd = true
        e.preventDefault()
        return
      }
      if (matchesAction(e, 'back')) {
        // The back binding (S / ArrowDown) ALWAYS moves the soldier forward —
        // the walk cycle never plays backward and the model never walks away
        // from the camera. S is simply a second forward key.
        e.preventDefault()
        fwdCodes.current.add(e.code)
        inputState.fwd = true
        return
      }
      if (matchesAction(e, 'left')) {
        inputState.left = true
        e.preventDefault()
        return
      }
      if (matchesAction(e, 'right')) {
        inputState.right = true
        e.preventDefault()
        return
      }
      if (!activeRef.current) return
      if (matchesAction(e, 'jump')) {
        // OS auto-repeat (holding Space) must not re-request the jump every
        // tick — jump is edge-triggered through the shared inputState, so only
        // a resolved physical press starts a jump.
        if (e.repeat) return
        e.preventDefault()
        inputState.jump = true
        return
      }
      if (matchesAction(e, 'crouch')) {
        if (e.repeat) return
        e.preventDefault()
        crouching.current = !crouching.current
        return
      }
      if (matchesAction(e, 'interact')) {
        e.preventDefault()
        inputState.interact = true
      }
    }
    const up = (e: KeyboardEvent) => {
      if (matchesAction(e, 'forward') || matchesAction(e, 'back')) {
        fwdCodes.current.delete(e.code)
        if (!inputState.runToggle) {
          inputState.fwd = fwdCodes.current.size > 0
        }
      }
      if (matchesAction(e, 'left')) inputState.left = false
      if (matchesAction(e, 'right')) inputState.right = false
      // Releasing the Shift+S chord must NOT clear the sprint hold — the latch
      // keeps running until Shift+S is pressed a second time. Releasing a plain
      // Shift key also leaves an active latch intact; only clear the plain-Shift
      // hold when there's no active latch (normal hold-to-run release).
      if (
        matchesAction(e, 'run') &&
        !chordMatches(e, RUN_TOGGLE_CHORD) &&
        !inputState.runToggle
      ) {
        inputState.run = false
      }
    }
  const onBlur = () => {
    fwdCodes.current.clear()
    inputState.fwd = false
    inputState.left = false
    inputState.right = false
    inputState.run = false
    inputState.runToggle = false
  }
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    window.addEventListener('blur', onBlur)
    return () => {
      window.removeEventListener('keydown', down)
      window.removeEventListener('keyup', up)
      window.removeEventListener('blur', onBlur)
    }
  }, [])

  useFrame((_, delta) => {
    const rb = body.current
    if (!rb) return
    ;(window as any).__walkBody = rb

    if (!active) {
      // Riding a vehicle: park the soldier far below the world, hidden. Clear
      // any active sprint latch so it can't carry over from on-foot.
      inputState.runToggle = false
      rb.setTranslation({ x: 0, y: -500, z: 0 }, true)
      rb.setLinvel({ x: 0, y: 0, z: 0 }, true)
      if (visual.current) visual.current.visible = false
      activePrev.current = false
      return
    }
    if (visual.current) visual.current.visible = true
    // Stepping out of a vehicle: place the soldier where the exit handler
    // decided, in case the physics body was parked at the hidden stash. The
    // exit handler set transportState.walk.heading to the vehicle's facing, so
    // re-sync the walker's heading ref here too — it only ever sees the pose
    // written by exit handlers, never the soldier's pre-mount direction.
    if (!activePrev.current) {
      rb.setTranslation(
        { x: transportState.walk.x, y: transportState.walk.y, z: transportState.walk.z },
        true,
      )
      rb.setLinvel({ x: 0, y: 0, z: 0 }, true)
      heading.current = transportState.walk.heading
    }
    activePrev.current = true

    const pos = rb.translation()
    if (bodyRef && bodyRef.current !== rb) bodyRef.current = rb

  const visualOffset = -CAPSULE_HALF_LEN - feetLocalY.current

  // ---- Scripted exit from the landed plane ----
  if (transportState.spawnWalk && scriptTime.current < 0) {
    scriptTime.current = 0
  }
  if (scriptTime.current >= 0) {
    const sw = transportState.spawnWalk
    if (sw) {
      scriptTime.current += delta
      const t = Math.min(scriptTime.current / 1.6, 1)
      const ease = 1 - Math.pow(1 - t, 3)
      const nx = sw.from.x + (sw.to.x - sw.from.x) * ease
      const nz = sw.from.z + (sw.to.z - sw.from.z) * ease
      rb.setTranslation({ x: nx, y: RUNWAY_TOP + CAPSULE_HALF_LEN, z: nz }, true)
      rb.setLinvel({ x: 0, y: 0, z: 0 }, true)
      heading.current = Math.atan2(sw.to.x - sw.from.x, sw.to.z - sw.from.z)
      transportState.walk = {
        x: nx,
        z: nz,
        y: RUNWAY_TOP + CAPSULE_HALF_LEN,
        heading: heading.current,
      } as TransportPose
      if (t >= 1) {
        transportState.spawnWalk = null
        scriptTime.current = -1
      }
    } else {
      scriptTime.current = -1
    }
    if (visual.current) {
      visual.current.position.set(0, visualOffset, 0)
      visual.current.rotation.y = heading.current
    }
    motionRef.current = {
      moving: true,
      running: false,
      crouching: false,
      jump: null,
      speed: WALK_SPEED,
    }
    minimapState.x = pos.x
    minimapState.z = pos.z
    minimapState.heading = heading.current
    return
  }

  // ---- Consume edge-triggered input (keyboard E or the touch interact
  // button both land here) ----
  // Keep the soldier's feet on the physics capsule's bottom now that the
  // scripted exit walk is over (the scripted walk set its own offset).
  if (visual.current) visual.current.position.set(0, visualOffset, 0)
    if (inputState.interact) {
      inputState.interact = false
      enterVehicle()
    }
    walkHud.nearVehicle = nearVehicle(pos)

    // ---- Grounded check + jump state machine ----
    // Ground contact is a debounced feet-height reading: the capsule bottom
    // must sit inside the flat-ground band for GROUND_TICKS consecutive frames
    // to count as landing (and outside it for as many to count as airborne),
    // which removes threshold/slope flicker. The grounded→airborne edge feeds
    // a coyote window, and a jump press is buffered so it fires just after the
    // hero lands. The impulse is applied exactly once, when 'anticipate' ends;
    // gravity does the rest of the arc (parabola), with a fall-speed boost so
    // the descent reads as weight rather than a slow hover.
    const vel = rb.linvel()
    const feetY = pos.y - CAPSULE_HALF_LEN
    const touching = feetY <= GROUND_PROBE
    if (touching) {
      groundedTicks.current = Math.min(groundedTicks.current + 1, GROUND_TICKS)
      airborneTicks.current = 0
    } else {
      airborneTicks.current = Math.min(airborneTicks.current + 1, GROUND_TICKS)
      groundedTicks.current = 0
    }
    const wasGrounded = grounded.current
    const groundedNow = grounded.current
      ? airborneTicks.current < GROUND_TICKS
      : groundedTicks.current >= GROUND_TICKS
    grounded.current = groundedNow
    if (groundedNow) coyote.current = COYOTE_TIME
    else coyote.current = Math.max(0, coyote.current - delta)

    if (inputState.jump) {
      inputState.jump = false
      walkDebug.jumpPulse = performance.now()
      jumpBuffer.current = JUMP_BUFFER_TIME
    }
    jumpBuffer.current = Math.max(0, jumpBuffer.current - delta)
    if (!jumpState.current && (groundedNow || coyote.current > 0)) {
      jumpBuffer.current = 0
      jumpState.current = 'anticipate'
      jumpTimer.current = 0
    }

    switch (jumpState.current) {
      case 'anticipate':
        jumpTimer.current += delta
        if (jumpTimer.current >= ANTICIPATE_TIME) {
          // Single upward impulse — never re-applied while airborne.
          rb.applyImpulse({ x: 0, y: JUMP_VEL, z: 0 }, true)
          jumpState.current = 'airborne'
          jumpTimer.current = 0
        }
        break
      case 'airborne': {
        // Extra downward pull while falling plus a terminal-speed cap, applied
        // through the body (never by editing pos/vel directly), so the arc is
        // a parabola with a decisive landing instead of a weightless drop.
        if (vel.y < 0) {
          rb.applyImpulse(
            { x: 0, y: -GRAVITY * (FALL_GRAVITY_MULT - 1) * delta, z: 0 },
            true,
          )
          if (vel.y < MAX_FALL_SPEED) {
            rb.setLinvel({ x: vel.x, y: MAX_FALL_SPEED, z: vel.z }, true)
          }
        }
        if (groundedNow && !wasGrounded) {
          // A jump press buffered right before landing fires immediately on
          // contact (classic pre-landing → hop); otherwise a landing recovery
          // plays. Either way the next press can't stack: the buffer is
          // consumed exactly once here.
          if (jumpBuffer.current > 0) {
            jumpBuffer.current = 0
            jumpState.current = 'anticipate'
            jumpTimer.current = 0
          } else {
            jumpState.current = 'land'
            jumpTimer.current = 0
          }
        }
        break
      }
      case 'land':
        // Kill any tiny residual bounce so the settle is a clean contact, then
        // recover. Never zeroes a real upward/downward velocity.
        if (Math.abs(vel.y) < 0.8) {
          rb.setLinvel({ x: vel.x, y: 0, z: vel.z }, true)
        }
        jumpTimer.current += delta
        if (jumpTimer.current >= LAND_TIME) jumpState.current = null
        break
    }

    // ---- Movement (character-relative: W/S along heading, A/D turn) ----
    const bigMode = useControls.getState().bigMode
    const speedMult = bigMode ? BIG_SPEED_MULT : 1
    const fwdInput = inputState.fwd ? 1 : 0
    const speed =
      (crouching.current
        ? CROUCH_SPEED
        : inputState.run || inputState.runToggle
          ? SPRINT_SPEED
          : WALK_SPEED) * speedMult

    // ---- Character-relative control (like the vehicles): W/S move along the
    // soldier's own forward; holding a turn key rotates him steadily so any
    // direction is reachable. One continuous hold is capped below a full
    // circle (release and re-press to keep going), so it can never spin 360°
    // on its own. "Invert turn direction" reverses the A/D + arrow sense.
    const invertTurn = useStore.getState().settings.invertTurn
    const holdDir = (inputState.right ? 1 : 0) - (inputState.left ? 1 : 0)
    if (holdDir !== 0) {
      const dir = invertTurn ? -holdDir : holdDir
      const applied =
        THREE.MathUtils.clamp(
          holdTurn.current + dir * TURN_HOLD_RATE * delta,
          -TURN_HOLD_MAX,
          TURN_HOLD_MAX,
        ) - holdTurn.current
      heading.current += applied
      holdTurn.current += applied
    } else {
      holdTurn.current = 0
    }
    heading.current = Math.atan2(Math.sin(heading.current), Math.cos(heading.current))

    const targetVel = new THREE.Vector3()
    let moveMag = 0
    if (fwdInput !== 0) {
      moveMag = Math.abs(fwdInput)
      const dir = new THREE.Vector3(
        Math.sin(heading.current),
        0,
        Math.cos(heading.current),
      )
      targetVel.copy(dir).multiplyScalar(fwdInput * speed)
    }
    // Body always faces where it moves: W and S both advance along the current
    // heading, so the walk cycle never plays backward. Heading is only turned
    // by A/D; targetVel is built from heading, so there is nothing to snap.
    const faceAngle = heading.current

    const curVel = rb.linvel()
    const nvx = THREE.MathUtils.lerp(curVel.x, targetVel.x, 1 - Math.exp(-delta * ACCEL))
    const nvz = THREE.MathUtils.lerp(curVel.z, targetVel.z, 1 - Math.exp(-delta * ACCEL))

    // ---- Ground friction: when the player isn't giving any input, drain the
    // horizontal speed to a hard stop instead of letting the lerp decay into a
    // slow slide. The slide made the soldier shuffle-to-a-halt (legs creeping)
    // and caused a walk/idle animation pop as |vel| crossed the moving
    // threshold. ----
    const stopThreshold = 0.06
    let finalVx = nvx
    let finalVz = nvz
    if (moveMag === 0) {
      finalVx = THREE.MathUtils.lerp(curVel.x, 0, 1 - Math.exp(-delta * 8))
      finalVz = THREE.MathUtils.lerp(curVel.z, 0, 1 - Math.exp(-delta * 8))
    }
    // Snap to exactly zero just before it would creep, so `moving` stays stable.
    if (moveMag === 0 && Math.hypot(finalVx, finalVz) < stopThreshold) {
      finalVx = 0
      finalVz = 0
    }
    rb.setLinvel({ x: finalVx, y: curVel.y, z: finalVz }, true)

    const moveSpeed = Math.hypot(finalVx, finalVz)

    // ---- Persist pose + minimap ----
    transportState.walk = {
      x: pos.x,
      z: pos.z,
      y: pos.y,
      heading: heading.current,
    } as TransportPose
    minimapState.x = pos.x
    minimapState.z = pos.z
    minimapState.heading = heading.current

    // ---- Visual: point the body at the travel direction (faceAngle). When W is
    // held the nose leads; when S is held the back leads, so the walk/run clip
    // animates cleanly with no foot slide. Heading (the A/D turn accumulator)
    // is separate and only changed by turning. ----
    const moving = moveSpeed > 0.1
    if (visual.current) {
      visual.current.rotation.y = faceAngle
    }
    motionRef.current = {
      moving,
      running: moving && (inputState.run || inputState.runToggle) && !crouching.current,
      crouching: crouching.current,
      jump: jumpState.current,
      // Free Fire-style: pace the gait to the INTENT (how hard W/S is pressed),
      // not the lagging actual velocity — so the legs lead the body the instant
      // you press, with no stride catching up. A threshold floor keeps idle
      // stable (no 0.x creeping legs) at the standstill.
      speed: moveMag * speed,
    }
    walkState.crouching = crouching.current
    // Publish the canonical action state for the ?debug=1 overlay — the exact
    // flags the bottom on-screen controls and the keyboard both drive.
    walkDebug.forward = inputState.fwd
    walkDebug.left = inputState.left
    walkDebug.right = inputState.right
    walkDebug.jumpState = jumpState.current
    walkDebug.grounded = groundedNow
    walkDebug.moving = moving
    walkDebug.speed = moveMag * speed
    walkDebug.vy = vel.y
    walkDebug.heading = heading.current
    ;(window as any).__body = {
      x: pos.x,
      y: pos.y,
      z: pos.z,
      vy: vel.y,
      groundedNow,
      feetY,
      type: active ? 'dynamic' : 'fixed',
    }
    ;(window as any).__motion = {
      moving: motionRef.current.moving,
      running: motionRef.current.running,
      crouching: motionRef.current.crouching,
      jump: motionRef.current.jump,
    }
    ;(window as any).__heading = heading.current
    ;(window as any).__visualRot = visual.current?.rotation.y ?? null
    ;(window as any).__input = inputState
    if (visual.current) visual.current.rotation.y = heading.current
  })

  return (
    <RigidBody
      ref={body}
      type={active ? 'dynamic' : 'fixed'}
      position={[transportState.walk.x, transportState.walk.y, transportState.walk.z]}
      colliders={false}
      lockRotations
      ccd
    >
      <CapsuleCollider args={[0.55, 0.32]} friction={0.4} />
      <group ref={visual}>
        <Soldier motionRef={motionRef} />
      </group>
    </RigidBody>
  )
}
