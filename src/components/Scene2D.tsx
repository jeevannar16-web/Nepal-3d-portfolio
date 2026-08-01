import type { JSX } from 'react'
import { identity, zones } from '../data'
import { ZoneIcon } from './icons'
import Reveal from './Reveal'
import { useStore } from '../store/useStore'

/**
 * Lightweight inline illustration referencing the 3D world — layered mountain
 * silhouettes, a setting sun and a small temple. No image asset, no JS, just
 * an SVG so the simple page stays cheap on low-end devices.
 */
function HeroVisual(): JSX.Element {
  return (
    <div className="mx-auto mt-8 w-full max-w-2xl" aria-hidden="true">
      <svg viewBox="0 0 640 200" className="h-auto w-full" role="presentation">
        <defs>
          <linearGradient id="hero-sky" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#fbbf24" stopOpacity="0.28" />
            <stop offset="0.55" stopColor="#38bdf8" stopOpacity="0.12" />
            <stop offset="1" stopColor="#0f172a" stopOpacity="0" />
          </linearGradient>
        </defs>
        <rect x="0" y="0" width="640" height="200" fill="url(#hero-sky)" />
        <circle cx="320" cy="64" r="30" fill="#fbbf24" opacity="0.4" />
        <path
          d="M0 200 74 104 138 156 214 88 296 168 368 112 452 178 538 120 640 176 640 200Z"
          fill="#334155"
          opacity="0.55"
        />
        <path
          d="M0 200 96 138 168 186 258 124 344 192 428 150 520 196 640 158 640 200Z"
          fill="#1e293b"
        />
        <path d="M0 200 640 200 640 196 0 196Z" fill="#0f172a" />
        <g fill="#0f172a">
          <rect x="282" y="146" width="76" height="50" />
          <polygon points="320,104 274,146 366,146" />
          <polygon points="320,88 290,108 350,108" />
          <rect x="310" y="146" width="20" height="22" />
        </g>
      </svg>
    </div>
  )
}

export default function Scene2D(): JSX.Element {
  const setPrefersSimple = useStore((s) => s.setPrefersSimple)

  return (
    <div className="relative h-full overflow-y-auto bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 text-slate-100">
      {/* Ambient background glows — pure CSS, no images. */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden" aria-hidden="true">
        <div className="absolute -top-40 left-1/2 h-96 w-[46rem] -translate-x-1/2 rounded-full bg-amber-500/10 blur-3xl" />
        <div className="absolute -left-24 bottom-0 h-80 w-80 rounded-full bg-sky-500/10 blur-3xl" />
        <div className="absolute right-0 bottom-0 h-80 w-80 rounded-full bg-indigo-500/10 blur-3xl" />
      </div>

      <div className="relative">
        <header className="px-6 pt-8 text-center">
          <h1 className="text-3xl font-bold text-white">{identity.name}</h1>
          <p className="mt-2 text-slate-300">
            {identity.role} · {identity.location}
          </p>
          <button
            type="button"
            onClick={() => setPrefersSimple(false)}
            className="mt-5 inline-flex items-center gap-1.5 text-xs font-medium text-amber-300/90 underline decoration-amber-300/40 underline-offset-4 transition hover:text-amber-200 hover:decoration-amber-300"
          >
            <ZoneIcon zone="contact" className="h-3.5 w-3.5" />
            Prefer the 3D experience?
          </button>
          <HeroVisual />
        </header>

        <main className="mx-auto max-w-2xl space-y-6 px-6 py-8">
          {zones.map((zone, i) => (
            <Reveal key={zone.key} delay={i * 90}>
              <section className="rounded-2xl border border-white/10 bg-white/5 p-6">
                <div className="flex items-center gap-2.5">
                  <span className="text-amber-400">
                    <ZoneIcon zone={zone.key} className="h-5 w-5" />
                  </span>
                  <h2 className="text-xl font-bold text-white">{zone.title}</h2>
                </div>
                <p className="mt-1 text-xs font-semibold uppercase tracking-widest text-amber-400/90">
                  {zone.subtitle}
                </p>
                <p className="mt-3 text-sm leading-relaxed text-slate-300">
                  {zone.body}
                </p>

                {zone.skills && (
                  <div className="mt-4 flex flex-wrap gap-2">
                    {zone.skills.map((skill) => (
                      <span
                        key={skill}
                        className="rounded-full bg-amber-400/15 px-3 py-1 text-xs font-medium text-amber-300"
                      >
                        {skill}
                      </span>
                    ))}
                  </div>
                )}

                {zone.projects && (
                  <ul className="mt-4 space-y-3">
                    {zone.projects.map((project) => (
                      <li
                        key={project.id}
                        className="rounded-xl border border-white/10 border-l-2 border-l-amber-400/80 bg-slate-800/50 p-4 shadow-lg transition duration-200 hover:-translate-y-0.5 hover:bg-slate-800/80 hover:shadow-xl"
                      >
                        <div className="mb-1 flex items-center justify-between gap-3">
                          <h3 className="font-semibold text-white">
                            {project.title}
                          </h3>
                          <div className="flex gap-2">
                            <a
                              href={project.liveUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="rounded-lg bg-amber-500 px-3 py-1 text-xs font-semibold text-slate-900 transition hover:bg-amber-400"
                            >
                              Live
                            </a>
                            <a
                              href={project.repoUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="rounded-lg bg-white/10 px-3 py-1 text-xs font-semibold text-white transition hover:bg-white/20"
                            >
                              Code
                            </a>
                          </div>
                        </div>
                        <p className="text-sm text-slate-400">{project.description}</p>
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {project.tech.map((tech) => (
                            <span
                              key={tech}
                              className="rounded bg-white/10 px-2 py-0.5 text-xs text-slate-300"
                            >
                              {tech}
                            </span>
                          ))}
                        </div>
                      </li>
                    ))}
                  </ul>
                )}

                {zone.contact && (
                  <div className="mt-4 space-y-3">
                    <a
                      href={`mailto:${zone.contact.email}`}
                      className="block rounded-xl bg-white/5 p-4 transition hover:bg-white/10"
                    >
                      <div className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                        Email
                      </div>
                      <div className="mt-1 text-sm font-medium text-amber-300">
                        {zone.contact.email}
                      </div>
                    </a>
                    <div className="grid grid-cols-2 gap-3">
                      <a
                        href={zone.contact.github}
                        target="_blank"
                        rel="noreferrer"
                        className="rounded-xl bg-white/5 p-4 text-center transition hover:bg-white/10"
                      >
                        <div className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                          GitHub
                        </div>
                        <div className="mt-1 truncate text-sm font-medium text-amber-300">
                          jeevannar16-web
                        </div>
                      </a>
                      <a
                        href={zone.contact.leetcode}
                        target="_blank"
                        rel="noreferrer"
                        className="rounded-xl bg-white/5 p-4 text-center transition hover:bg-white/10"
                      >
                        <div className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                          LeetCode
                        </div>
                        <div className="mt-1 truncate text-sm font-medium text-amber-300">
                          jeevannar16-web
                        </div>
                      </a>
                    </div>
                  </div>
                )}
              </section>
            </Reveal>
          ))}
        </main>

        <footer className="border-t border-white/10 px-6 py-6 text-center text-xs text-slate-500">
          Tip: on desktop, switch to the 3D experience to drive through Kathmandu.
        </footer>
      </div>
    </div>
  )
}
