import type { JSX } from 'react'

const paths: Record<string, JSX.Element> = {
  about: (
    <>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21c0-4 4-6 8-6s8 2 8 6" />
    </>
  ),
  skills: (
    <path d="M14.7 6.3a4.5 4.5 0 0 0-6 6L3 18v3h3l5.7-5.7a4.5 4.5 0 0 0 6-6L15 12l-3-3 2.7-2.7Z" />
  ),
  projects: (
    <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2v11Z" />
  ),
  contact: (
    <>
      <rect x="2" y="4" width="20" height="16" rx="2" />
      <path d="m22 7-10 6L2 7" />
    </>
  ),
}

/**
 * Shared zone icon so the 3D NavBar and the Scene2D fallback stay visually
 * consistent (same stroke-line icons, same 24px viewBox).
 */
export function ZoneIcon({
  zone,
  className = 'h-4 w-4',
}: {
  zone: string
  className?: string
}): JSX.Element {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths[zone] ?? null}
    </svg>
  )
}
