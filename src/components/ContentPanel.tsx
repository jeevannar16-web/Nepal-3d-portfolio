import type { JSX } from 'react'
import { useStore } from '../store/useStore'
import { zones } from '../data'

export default function ContentPanel(): JSX.Element | null {
  const activeZone = useStore((s) => s.activeZone)
  const isPanelOpen = useStore((s) => s.isPanelOpen)
  const setIsPanelOpen = useStore((s) => s.setIsPanelOpen)

  if (!isPanelOpen || !activeZone) return null

  const zone = zones.find((z) => z.key === activeZone)
  if (!zone) return null

  return (
    <div className="pointer-events-none absolute inset-0 z-10 flex items-end justify-center p-6 sm:items-center">
      <div className="pointer-events-auto w-full max-w-lg rounded-2xl border border-white/20 bg-slate-900/85 p-6 text-slate-100 shadow-2xl backdrop-blur">
        <div className="mb-1 text-xs font-semibold uppercase tracking-widest text-amber-400">
          {zone.subtitle}
        </div>
        <div className="mb-4 flex items-start justify-between gap-4">
          <h2 className="text-2xl font-bold text-white">{zone.title}</h2>
          <button
            type="button"
            onClick={() => setIsPanelOpen(false)}
            className="rounded-lg px-2 py-1 text-sm text-slate-300 transition hover:bg-white/10 hover:text-white"
            aria-label="Close panel"
          >
            ✕
          </button>
        </div>

        <p className="mb-4 text-sm leading-relaxed text-slate-300">{zone.body}</p>

        {zone.skills && (
          <div className="flex flex-wrap gap-2">
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
          <ul className="space-y-3">
            {zone.projects.map((project) => (
              <li key={project.id} className="rounded-xl bg-white/5 p-4">
                <div className="mb-1 flex items-center justify-between gap-3">
                  <h3 className="font-semibold text-white">{project.title}</h3>
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
          <div className="space-y-3">
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
      </div>
    </div>
  )
}
