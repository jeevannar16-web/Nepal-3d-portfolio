# Nepal 3D Portfolio

An interactive 3D portfolio set in a stylised low-poly Kathmandu Valley. Drive a
sports car through a mountain-ringed world and approach landmarks to explore the
**About**, **Skills**, **Projects** and **Contact** sections. Everything is
content-driven from a single data file, making it a flexible, easy-to-maintain
alternative to traditional scrolling portfolio sites.

## Highlights

- **3D world** — a ~300×300 valley with a winding road network, a central
  plaza, and a low-poly Himalayan backdrop surrounding Kathmandu.
- **Drivable vehicle** with sports-car physics: ramped throttle, speed-based
  steering with angular damping, smooth braking, and a speed-widening camera FOV
  that sells the sense of velocity.
- **Four landmarks** (pagoda temple, Dharahara tower, city gate, mountain)
  load from real `.glb` models with soft blob shadows and proximity glow rings.
- **Navigation** — WASD driving, click-to-fly on the minimap, and a top bar that
  flies the camera between sections with a travelling indicator.
- **Scenery** — instanced trees, houses and prayer flags line the roads so
  driving between zones feels like passing through a small town, without the
  draw-call cost of individual meshes.
- **Intro sequence** — a cinematic camera orbit with a skip button, plus UI
  sound effects (clicks, whooshes) and a loading screen.
- **Responsive fallback** — low-end devices and mobile get a clean 2D page
  driven by the same content file.

## Stack

- Vite + React + TypeScript
- @react-three/fiber, @react-three/drei, @react-three/rapier (physics)
- zustand (state), Tailwind CSS (UI overlays), howler (sound)
- Deployed on Vercel

## Architecture

| Path | Purpose |
| --- | --- |
| `src/data.ts` | All portfolio content (identity, skills, projects, contact) and landmark layout. Edit this file to change content — no 3D code changes needed. |
| `src/world.ts` | World geometry: the curved road network (polylines) and seeded-random helpers shared by roads, scenery and mountains. |
| `src/components/Scene3D.tsx` | The desktop 3D world: canvas, sky, fog, physics, and all overlays. |
| `src/components/Scene2D.tsx` | Plain scrollable page for mobile / low-end devices, driven by the same `data.ts`. |
| `src/components/Player.tsx` | The drivable vehicle and its physics feel — tuning constants live at the top of the file. |
| `src/components/Landmark.tsx` | Reusable landmark: invisible physics trigger (Rapier sensor) + separate visual mesh. |
| `src/components/Decorations.tsx` | Instanced trees, houses and prayer flags along the roads. |
| `src/components/MountainRange.tsx` | Instanced low-poly Himalayan ring around the valley (visual only). |
| `src/store/useStore.ts` | Central zustand store: `activeZone`, `isPanelOpen`, `deviceType`, `introDone`, `prefersSimple`, fly targets. |

## Controls

| Input | Action |
| --- | --- |
| **WASD / Arrow keys** | Drive |
| **Minimap dot** | Fly the camera to a landmark |
| **Nav bar buttons** | Fly between sections |
| **Esc / Skip** | Close the intro |

## Driving feel

All tuning is exposed as named constants at the top of `src/components/Player.tsx`
(`MAX_SPEED`, `THROTTLE_FORCE`, `STEER_TORQUE`, `STEER_DAMPING`,
`MAX_STEER_SPEED_FALLOFF`, …) so the handling can be tuned by feel without
digging through physics code.

## Swapping in your own Blender models

Procedural placeholders are used by default, but you can drop in real models:

1. Export a `.glb` from Blender into `public/models/`.
2. Set `modelPath` on the matching entry in `src/data.ts` (e.g. `/models/temple.glb`).
3. The `LandmarkModel` component loads it automatically; the physics trigger
   stays separate and unchanged.

## Run locally

```bash
npm install
npm run dev
```

## Deploy

Push to GitHub and import the repo on Vercel (Vite preset). `vercel.json` is
already configured.
