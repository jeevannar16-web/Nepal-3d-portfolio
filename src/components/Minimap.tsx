import { useEffect, useRef, useState, type JSX } from 'react'
import { landmarks } from '../data'
import { roadPaths, RIVER, POND, AIRPORT } from '../world'
import { minimapState } from '../store/minimapState'
import { useStore } from '../store/useStore'
import { playClick } from '../utils/sounds'
import { shouldReduceGraphics } from '../utils/webgl'

const WORLD = 300 // world spans (-150..150) in both x and z
const V = 100 // svg viewBox size
const PAD = 8.5
const S = (V - PAD * 2) / WORLD // world-units -> svg units
const toPx = (x: number, z: number): [number, number] => [
  PAD + (x + WORLD / 2) * S,
  PAD + (z + WORLD / 2) * S,
]

function polylinePts(path: [number, number][]) {
  return path.map(([x, z]) => toPx(x, z).join(',')).join(' ')
}

/**
 * A single transparent, illustrative "real map" of the valley (roads, river,
 * pond, airport, landmark pins and the player marker). Rendered once as the
 * compact top-left minimap and again, larger, in the full-view overlay — same
 * drawing, no duplication of logic.
 */
function MapArt({
  markerRef,
  showLabels,
  interactive,
  onPick,
}: {
  markerRef: React.RefObject<SVGGElement | null>
  showLabels: boolean
  interactive?: boolean
  onPick?: (id: string) => void
}): JSX.Element {
  const visited = useStore.getState().visitedZones
  const riverW = Math.max(0.6, (RIVER.width / WORLD) * (V - PAD * 2))

  return (
    <svg viewBox={`0 0 ${V} ${V}`} className="h-full w-full [font-family:sans-serif]">
      <defs>
        <linearGradient id="map-paper" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#f7f0dd" />
          <stop offset="100%" stopColor="#eddfc9" />
        </linearGradient>
      </defs>

      {/* Paper background (translucent so the scene breathes through) */}
      <rect x="0" y="0" width={V} height={V} fill="url(#map-paper)" opacity={0.82} />

      {/* Faint survey grid */}
      {Array.from({ length: 6 }).map((_, i) => {
        const p = PAD + ((i + 1) / 6) * (V - PAD * 2)
        return (
          <g key={i} stroke="#cdae7d" strokeWidth={0.2} opacity={0.3}>
            <line x1={PAD} y1={p} x2={V - PAD} y2={p} />
            <line x1={p} y1={PAD} x2={p} y2={V - PAD} />
          </g>
        )
      })}

      {/* River */}
      <polyline
        points={polylinePts(RIVER.path)}
        fill="none"
        stroke="#9ec6e8"
        strokeWidth={riverW * 1.6}
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity={0.85}
      />
      <polyline
        points={polylinePts(RIVER.path)}
        fill="none"
        stroke="#cfe8fc"
        strokeWidth={riverW * 0.7}
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity={0.7}
      />

      {/* Pond */}
      {(() => {
        const [cx, cz] = toPx(POND.x, POND.z)
        const r = Math.max(0.5, (POND.radius / WORLD) * (V - PAD * 2))
        return (
          <g>
            <ellipse cx={cx} cy={cz} rx={r} ry={r * 0.85} fill="#9ec6e8" opacity={0.9} />
            <ellipse
              cx={cx}
              cy={cz}
              rx={r * 0.5}
              ry={r * 0.45}
              fill="#cfe8fc"
              opacity={0.7}
            />
          </g>
        )
      })()}

      {/* Airport runway */}
      {(() => {
        const [cx, cz] = toPx(AIRPORT.x, AIRPORT.z)
        const w = (AIRPORT.rx / WORLD) * (V - PAD * 2)
        const h = (AIRPORT.rz / WORLD) * (V - PAD * 2)
        return (
          <g>
            <rect
              x={cx - w / 2}
              y={cz - h / 2}
              width={w}
              height={h}
              rx={0.8}
              fill="#e6d7b6"
              stroke="#a8935f"
              strokeWidth={0.4}
            />
            <line
              x1={cx - w / 2}
              y1={cz}
              x2={cx + w / 2}
              y2={cz}
              stroke="#a8935f"
              strokeWidth={0.35}
              strokeDasharray="0.5 0.7"
            />
            <text
              x={cx}
              y={cz + h / 2 + 1.4}
              textAnchor="middle"
              fontSize={3}
              fontWeight={700}
              fill="#8b7450"
            >
              AIRPORT
            </text>
          </g>
        )
      })()}

      {/* Roads: dark casing under a lighter core */}
      {roadPaths.map((path, i) => {
        const pts = polylinePts(path)
        return (
          <g key={i}>
            <polyline
              points={pts}
              fill="none"
              stroke="#7a5c35"
              strokeWidth={1.3}
              strokeLinecap="round"
              strokeLinejoin="round"
              opacity={0.7}
            />
            <polyline
              points={pts}
              fill="none"
              stroke="#f8f1dc"
              strokeWidth={0.6}
              strokeLinecap="round"
              strokeLinejoin="round"
              opacity={0.95}
            />
          </g>
        )
      })}

      {/* Landmark pins */}
      {landmarks.map((lm) => {
        const [lx, lz] = toPx(lm.position[0], lm.position[2])
        const hit = interactive
        const onClick = () => onPick?.(lm.id)
        return (
          <g key={lm.id} onClick={hit ? onClick : undefined} className={hit ? 'cursor-pointer' : ''}>
            <circle cx={lx} cy={lz} r={3} fill="#fff" stroke="#7a5c35" strokeWidth={0.4} />
            <circle
              cx={lx}
              cy={lz}
              r={1.8}
              fill={lm.color}
              opacity={visited.includes(lm.contentKey) ? 1 : 0.55}
            />
            {showLabels && (
              <text
                x={lx}
                y={lz - 3.6}
                textAnchor="middle"
                fontSize={3}
                fontWeight={700}
                fill="#8b7450"
              >
                {lm.label.split(' — ')[0]}
              </text>
            )}
          </g>
        )
      })}

      {/* Player marker: updated live by the parent via markerRef */}
      <g ref={markerRef}>
        <circle cx={0} cy={0} r={2} fill="#fff" stroke="#7a5c35" strokeWidth={0.4} />
        <path d="M0 -3.2 L0.9 -1 L0 1 L-0.9 -1 Z" fill="#e5484d" />
        {showLabels && (
          <text x={4} y={-3} fontSize={2.6} fontWeight={800} fill="#e5484d">
            YOU
          </text>
        )}
      </g>

      {/* Compass rose */}
      <g transform={`translate(${V - 8}, ${7})`}>
        <circle r={4} fill="#fff" stroke="#7a5c35" strokeWidth={0.35} opacity={0.9} />
        <path d="M0 -2.6 L0.7 0 L0 0.9 L-0.7 0 Z" fill="#e5484d" />
        <text x={0} y={-3.8} textAnchor="middle" fontSize={2.4} fontWeight={800} fill="#8b7450">
          N
        </text>
      </g>

      {/* Border frame */}
      <rect
        x={PAD - 1}
        y={PAD - 1}
        width={V - (PAD - 1) * 2}
        height={V - (PAD - 1) * 2}
        fill="none"
        stroke="#a8935f"
        strokeWidth={0.6}
        opacity={0.7}
      />
    </svg>
  )
}

export default function Minimap(): JSX.Element | null {
  const introDone = useStore((s) => s.introDone)
  const flyTo = useStore((s) => s.flyTo)
  const compactRef = useRef<SVGGElement>(null)
  const fullRef = useRef<SVGGElement>(null)
  const [open, setOpen] = useState(false)
  const weakDevice = useRef(shouldReduceGraphics())

  useEffect(() => {
    if (!open && weakDevice.current) return
    const interval = weakDevice.current ? 64 : 1000 / 30
    let id = setInterval(() => {
      for (const g of [compactRef.current, fullRef.current]) {
        if (!g) continue
        const [px, pz] = toPx(minimapState.x, minimapState.z)
        g.setAttribute('transform', `translate(${px.toFixed(2)} ${pz.toFixed(2)})`)
        const arrow = g.querySelector('path')
        if (arrow)
          arrow.setAttribute('transform', `rotate(${(minimapState.heading * 180) / Math.PI})`)
      }
    }, interval)
    return () => clearInterval(id)
  }, [open, weakDevice])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  if (!introDone) return null

  return (
    <>
      <div className="pointer-events-auto absolute left-5 top-5 z-20 flex flex-col gap-1">
        <button
          type="button"
          onClick={() => {
            playClick()
            setOpen(true)
          }}
          title="Open the full map"
          aria-label="Open the full map"
          className="relative h-32 w-32 rounded-lg border border-[#a8935f]/40 bg-white/10 shadow-xl shadow-black/40 backdrop-blur transition-transform duration-200 hover:scale-105 sm:h-40 sm:w-40"
        >
          <MapArt markerRef={compactRef} showLabels={false} />
        <span
            aria-hidden
            className="pointer-events-none absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full border border-[#7a5c35]/40 bg-[#f8f1dc]/80 text-[11px] font-bold text-[#5a4a2e] opacity-80"
          >
            ⤢
          </span>
        </button>
        <span className="rounded-full border border-[#a8935f]/40 bg-[#f8f1dc]/90 px-2 py-0.5 text-center text-[9px] font-bold uppercase tracking-widest text-[#5a4a2e] shadow">
          Map
        </span>
      </div>

      {open && (
        <div
          className="pointer-events-auto fixed inset-0 z-40 flex items-center justify-center bg-black/55 p-4 backdrop-blur-sm"
          onClick={() => setOpen(false)}
        >
          <div
            className="relative w-full max-w-2xl overflow-hidden rounded-2xl border-4 border-[#a8935f] bg-[#f6f0dd] text-[#5a4a2e] shadow-2xl shadow-black/60"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-[#a8935f]/50 bg-[#ededed]/80 px-4 py-2">
              <h2 className="text-sm font-black uppercase tracking-widest">
                Kathmandu Valley
              </h2>
              <span className="text-[10px] font-semibold">click a pin to fly</span>
            </div>
            <div className="aspect-square w-full">
              <MapArt
                markerRef={fullRef}
                showLabels
                interactive
                onPick={(id) => {
                  const lm = landmarks.find((l) => l.id === id)
                  if (!lm) return
                  playClick()
                  setOpen(false)
                  flyTo(lm.position[0], lm.position[2])
                }}
              />
            </div>
            <div className="flex flex-wrap gap-x-3 gap-y-2 border-t border-[#a8935f]/50 bg-[#ededed]/80 px-4 py-2 text-[11px] font-semibold">
              {landmarks.map((lm) => (
                <span key={lm.id} className="flex items-center gap-1.5">
                  <span
                    className="inline-block h-2.5 w-2.5 rounded-full border border-[#7a5c35]"
                    style={{ backgroundColor: lm.color }}
                  />
                  {lm.label.split(' — ')[0]}
                </span>
              ))}
              <span className="flex items-center gap-1.5">
                <span className="inline-block h-2.5 w-2.5 rounded-full bg-[#e5484d] border border-white" />
                You
              </span>
              <button
                type="button"
                onClick={() => {
                  playClick()
                  setOpen(false)
                }}
                className="ml-auto rounded-full bg-[#5a4a2e] px-3 py-1 text-[10px] font-bold uppercase text-[#f8f1dc] transition hover:bg-[#3f331f]"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
