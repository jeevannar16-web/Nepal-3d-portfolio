/** Resolves an absolute public-asset path against the app's base URL (e.g. the
 *  GitHub Pages `/Nepal-3d-portfolio/` subpath), so models and sounds load no
 *  matter where the site is hosted. Falls back to the root path on a plain
 *  `/` base (local dev, Vercel, Netlify). */
export const assetUrl = (path: string): string =>
  `${import.meta.env.BASE_URL}${path.replace(/^\//, '')}`
