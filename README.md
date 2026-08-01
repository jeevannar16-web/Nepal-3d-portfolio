# Nepal 3D Portfolio

Interactive 3D portfolio inspired by Kathmandu, Nepal. Drive a vehicle around a
low-poly world and approach landmarks to explore About, Skills, Projects and
Contact sections. Built to be a flexible, content-driven alternative to sites
like bruno-simon.com.

## Stack

- Vite + React + TypeScript
- @react-three/fiber, @react-three/drei, @react-three/rapier (physics)
- zustand (state), Tailwind CSS (UI overlays), howler (sound)
- Deployed on Vercel

## Architecture

- **`src/data.ts`** — all portfolio content (identity, skills, projects, contact,
  landmark layout). Fully decoupled from 3D rendering. Edit this file to change
  content; no 3D code changes needed.
- **`src/components/Scene3D.tsx`** — the desktop 3D world.
- **`src/components/Scene2D.tsx`** — plain scrollable page for mobile / low-end
  devices, driven by the same `data.ts`.
- **`src/store/useStore.ts`** — central zustand store: `activeZone`,
  `isPanelOpen`, `deviceType`.
- **`src/components/Landmark.tsx`** — reusable landmark: invisible physics
  trigger (Rapier sensor) + separate visual mesh. Add a new landmark by appending
  one entry to `landmarks` in `data.ts`.
- **`src/hooks/useDeviceType.ts`** — device detection switching Scene3D / Scene2D.

## Controls

- **WASD / Arrow keys** to drive
- Drive into a landmark to open its content panel

## Swapping in Blender models

Keep procedural placeholders, or drop in your own models:

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
