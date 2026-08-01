import type { JSX } from 'react'
import { identity, zones } from '../data'

export default function Scene2D(): JSX.Element {
  return (
    <div className="min-h-screen overflow-y-auto bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900 text-slate-100">
      <header className="border-b border-white/10 px-6 py-10 text-center">
        <h1 className="text-3xl font-bold text-white">{identity.name}</h1>
        <p className="mt-2 text-slate-300">
          {identity.role} · {identity.location}
        </p>
      </header>

      <main className="mx-auto max-w-2xl space-y-8 px-6 py-10">
        {zones.map((zone) => (
          <section
            key={zone.key}
            className="rounded-2xl border border-white/10 bg-white/5 p-6"
          >
            <p className="text-xs font-semibold uppercase tracking-widest text-amber-400">
              {zone.subtitle}
            </p>
            <h2 className="mt-1 text-xl font-bold text-white">{zone.title}</h2>
            <p className="mt-2 text-sm leading-relaxed text-slate-300">
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
                  <li key={project.id} className="rounded-xl bg-white/5 p-4">
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
        ))}
      </main>

      <footer className="border-t border-white/10 px-6 py-6 text-center text-xs text-slate-500">
        Tip: open on desktop to drive through the 3D Kathmandu world.
      </footer>
    </div>
  )
}
