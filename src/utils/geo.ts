export interface GeoResult {
  country: string | null
  iso: string | null
}

async function fetchJson(url: string, timeoutMs: number): Promise<Record<string, unknown>> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const res = await fetch(url, { signal: controller.signal })
    if (!res.ok) throw new Error(`geo ${res.status}`)
    return (await res.json()) as Record<string, unknown>
  } finally {
    clearTimeout(timer)
  }
}

/**
 * Best-effort IP geolocation with a per-source timeout. Returns null on any
 * failure so callers never block the scene on this.
 */
export async function detectCountry(timeoutMs = 1500): Promise<GeoResult> {
  const sources: Array<{ url: string; parse: (j: Record<string, unknown>) => GeoResult }> = [
    {
      url: 'https://ipapi.co/json/',
      parse: (j) => ({
        country: typeof j.country_name === 'string' ? j.country_name : null,
        iso: typeof j.country_code === 'string' ? j.country_code : null,
      }),
    },
    {
      url: 'https://ip-api.com/json/?fields=country,countryCode',
      parse: (j) => ({
        country: typeof j.country === 'string' ? j.country : null,
        iso: typeof j.countryCode === 'string' ? j.countryCode : null,
      }),
    },
  ]

  for (const source of sources) {
    try {
      const json = await fetchJson(source.url, timeoutMs)
      const result = source.parse(json)
      if (result.country) return result
    } catch {
      // try the next source
    }
  }
  return { country: null, iso: null }
}
