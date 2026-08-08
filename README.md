# Nepal 3D Portfolio

An interactive 3D portfolio set in a stylised low-poly Kathmandu Valley. Walk,
drive, ride and fly through a mountain-ringed world — get around by sports car,
motorcycle, horse, airplane or hot-air balloon (and bail out under a parachute)
— and approach landmarks to explore the **About**, **Skills**, **Projects**,
**Contact** and **My Story** sections. Everything is content-driven from a single
data file, making it a flexible, easy-to-maintain alternative to traditional
scrolling portfolio sites.

## Highlights

- **3D world** — a ~300×300 valley with a winding road network, a central
  plaza, five landmarks and a low-poly Himalayan backdrop surrounding Kathmandu.
- **Full transport system** — start on foot as a soldier, then hop between a
  sports car (real powertrain: engine, RPM, automatic gearbox, gear selector),
  a motorcycle, a horse, two flyable airplanes (one at the airport, one at a
  second airstrip) and a hot-air balloon with a seated rider. In the plane or
  balloon, press **Z / Esc** to bail out and parachute down while the vehicle
  auto-lands itself back at its parking spot. The **Transport** menu tab hops
  you into any vehicle you've parked from anywhere on foot.
- **Five landmarks** (pagoda temple, Dharahara tower, city gate, mountain,
  stupa) load from real `.glb` models with soft blob shadows and proximity glow
  rings — click or tap any landmark to open its portfolio section, and a halo
  ring highlights it on hover.
- **Touch-friendly everywhere** — on mobile, an on-screen joystick + action
  buttons drive every mode (walk, car, bike, horse, plane, balloon, parachute),
  not just walking.
- **Navigation** — WASD to drive, click-to-fly on the minimap, and a top bar
  that flies the camera between sections with a travelling indicator. The
  minimap tracks your position and heading in every mode.
- **Scenery** — instanced trees, houses and prayer flags line the roads so
  travelling between zones feels like passing through a small town, without the
  draw-call cost of individual meshes.
- **Cinematic intro** — the airplane arrival sequence (taxi, takeoff, valley
  flyover, landing) auto-skips when you're ready, and the variant is chosen by
  your IP region.
- **Live atmosphere** — day/dusk/night lighting and real Kathmandu weather
  (rain, fog) are fetched live and applied to the scene; both are overridable
  from the Settings tab.
- **Sound** — procedural engine, horse-gait and airplane soundtracks, honk,
  and UI clicks, all respecting the mute toggle.
- **Persistent preferences** — settings (sound, reduced graphics, camera
  sensitivity) and unlocked zones survive reloads via localStorage.
- **Adaptive performance** — a GPU/RAM tier check runs reduced graphics (lower
  DPR, no HDRI bloom/SSAO, smaller shadows) on weak hardware, and a WebGL
  context-loss handler swaps to the 2D view instead of going blank.
- **Responsive fallback** — low-end devices and mobile get a clean 2D page
  driven by the same content file.

## Stack

- Vite + React + TypeScript
- @react-three/fiber, @react-three/drei, @react-three/rapier (physics)
- zustand (state), Tailwind CSS (UI overlays)
- Deployed to **GitHub Pages** via GitHub Actions (`push` to `main`)

## Project structure

```
├─ .github/workflows/deploy.yml   # GitHub Pages CI (build + deploy on push)
├─ public/
│  ├─ models/                     # all .glb models (vehicles, landmarks, soldier…)
│  └─ hdr/                        # HDRI environment map
├─ scripts/                       # asset build/sound/inspect helpers
├─ src/
│  ├─ data.ts                     # ALL portfolio content + landmark layout (edit this)
│  ├─ world.ts                    # road network polylines + seeded-random helpers
│  ├─ components/                 # 3D scene + UI overlays
│  │  ├─ Scene3D.tsx              # the 3D world: canvas, sky, physics, overlays
│  │  ├─ Scene2D.tsx              # plain scrollable page (mobile / low-end)
│  │  ├─ Player.tsx               # the sports car + powertrain physics
│  │  ├─ WalkController.tsx       # on-foot soldier (walk/run/jump, boarding)
│  │  ├─ BikeController.tsx       # motorcycle
│  │  ├─ HorseController.tsx      # horse (gallop, gait-matched sound)
│  │  ├─ AirplaneController.tsx   # flyable airplane (two slots: airport + airstrip)
│  │  ├─ HotAirBalloonController.tsx # balloon with seated rider
│  │  ├─ ParachuteController.tsx  # bail-out parachute descent
│  │  ├─ Soldier.tsx / Rider.tsx  # the avatar + seated-rider positioning
│  │  ├─ Landmarks.tsx / Landmark.tsx # landmark triggers + visuals
│  │  └─ …                        # HUD, minimap, nav, sounds, overlays
│  ├─ store/                      # zustand store + mutable runtime state
│  │  ├─ useStore.ts              # central store (playerMode, intro, settings…)
│  │  ├─ transportState.ts        # vehicle/walker poses, active plane
│  │  ├─ autoPilot.ts             # vehicle auto-land flags after bailing out
│  │  ├─ walkState.ts             # walk inputs + HUD
│  │  ├─ driveState.ts            # car engine/RPM/gear for the speedometer
│  │  └─ minimapState.ts          # live player position for the minimap
│  ├─ utils/                      # helpers (assetUrl, weather, timeOfDay, geo…)
│  └─ hooks/
└─ vite.config.ts                 # Vite base configured for the Pages subpath
```

## Controls

| Input | Action |
| --- | --- |
| **WASD / Arrow keys** | Move the current vehicle (car, bike, horse, plane, balloon, walk) |
| **E** | Board the nearest vehicle |
| **Z / Esc** | Get out — in the airplane/balloon this bails you out under a parachute |
| **Space** | Jump (on foot) |
| **G / R** | Car: ignition / D-R gear selector |
| **Q / E** | Airplane: bank left / right |
| **Minimap** | Click a landmark to fly the camera to it |
| **Nav menu** | Explore / Transport / Settings / About tabs |
| **Click / tap a landmark** | Open its portfolio panel |
| **Touch** | On-screen joystick + action buttons in every mode (mobile) |

The top-right menu has four tabs: **Explore** (the portfolio sections),
**Transport** (hop straight into any vehicle you've parked), **Settings** (sound,
reduced graphics, camera sensitivity, time of day, weather) and **About**.

## Tuning the driving feel

Vehicle handling lives as named constants at the top of each controller
(`Player.tsx`, `BikeController.tsx`, `HorseController.tsx`,
`AirplaneController.tsx`, `HotAirBalloonController.tsx`): `MAX_SPEED`,
`THROTTLE_ACCEL`, `TURN_RATE`, `LATERAL_GRIP`, `CRUISE_ALT`, and so on — so the
handling can be tuned by feel without digging through physics code.

## Adding or replacing models

1. Export a `.glb` from Blender into `public/models/`.
2. Reference it by path in the relevant controller (e.g. `useGLTF(assetUrl('/models/plane.glb'))`).
3. For landmarks, point `modelPath` on the matching entry in `src/data.ts`.

## Run locally

```bash
npm install
npm run dev
```

## Deploy

Pushing to `main` runs `.github/workflows/deploy.yml`, which builds and deploys
to GitHub Pages automatically. The live site is:

**https://jeevannar16-web.github.io/Nepal-3d-portfolio/**

If you don't see the latest changes, hard-refresh (Ctrl+Shift+R / Cmd+Shift+R)
or open the site in a private window — the browser caches the previous build.
