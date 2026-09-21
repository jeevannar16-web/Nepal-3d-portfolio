import { useEffect, useState } from 'react'
import type { PortfolioData, Profile, ZoneContent } from '../types/portfolio'
import { assetUrl } from '../utils/assetUrl'
import { zones as INLINE_ZONES, identity as INLINE_IDENTITY } from '../data'

// Resolved against the site's base (GitHub Pages mounts under
// /Nepal-3d-portfolio/, where a bare '/data/...' would 404).
const FALLBACK_URL = assetUrl('/data/portfolio.json')

export function usePortfolio() {
  const [data, setData] = useState<PortfolioData | null>(null)
  const [activeProfile, setActiveProfile] = useState<string>('default')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let mounted = true

    async function load() {
      try {
        setLoading(true)
        const res = await fetch(FALLBACK_URL, { cache: 'no-store' })
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const json = await res.json()
        if (mounted) {
          setData(json)
          setError(null)
        }
      } catch (e) {
        if (mounted) {
          setError(e instanceof Error ? e.message : 'Failed to load portfolio')
          // The portfolio JSON is missing or unreachable (e.g. subpath hosting):
          // fall back to the site's bundled content so every section still
          // opens with real text instead of an empty panel.
          setData({
            profiles: [
              {
                key: 'default',
                name: INLINE_IDENTITY.name,
                identity: INLINE_IDENTITY,
                zones: INLINE_ZONES,
              },
            ],
          })
        }
      } finally {
        if (mounted) setLoading(false)
      }
    }

    load()
    return () => { mounted = false }
  }, [])

  // Switch profile via query param or programmatically
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const profileParam = params.get('profile')
    if (profileParam && data?.profiles.some(p => p.key === profileParam)) {
      setActiveProfile(profileParam)
    }
  }, [data])

  const getActiveProfile = (): Profile | undefined => {
    return data?.profiles.find(p => p.key === activeProfile)
  }

  const getZones = (): ZoneContent[] => {
    return getActiveProfile()?.zones ?? []
  }

  const getIdentity = () => {
    return getActiveProfile()?.identity
  }

  const switchProfile = (key: string) => {
    if (data?.profiles.some(p => p.key === key)) {
      setActiveProfile(key)
      // Update URL without reload
      const url = new URL(window.location.href)
      url.searchParams.set('profile', key)
      window.history.replaceState({}, '', url)
    }
  }

  return {
    data,
    activeProfile,
    loading,
    error,
    profiles: data?.profiles ?? [],
    getZones,
    getIdentity,
    switchProfile,
  }
}