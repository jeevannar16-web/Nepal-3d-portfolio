export type WeatherKind = 'clear' | 'rain' | 'fog'

function fromWeatherCode(code: number): WeatherKind {
  if (code === 45 || code === 48) return 'fog'
  if (code >= 51 && code <= 57) return 'fog' // drizzle / misty
  if ((code >= 61 && code <= 67) || (code >= 80 && code <= 82)) return 'rain'
  if (code >= 95 && code <= 99) return 'rain' // thunderstorm
  return 'clear'
}

/**
 * Best-effort current weather for Kathmandu via Open-Meteo (no key needed).
 * Always resolves to 'clear' on any failure so the scene is never blocked.
 */
export async function fetchKathmanduWeather(timeoutMs = 3000): Promise<WeatherKind> {
  const url =
    'https://api.open-meteo.com/v1/forecast?latitude=27.7172&longitude=85.3240&current_weather=true'
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const res = await fetch(url, { signal: controller.signal })
    if (!res.ok) return 'clear'
    const json = (await res.json()) as { current_weather?: { weathercode?: number } }
    const code = json.current_weather?.weathercode
    return typeof code === 'number' ? fromWeatherCode(code) : 'clear'
  } catch {
    return 'clear'
  } finally {
    clearTimeout(timer)
  }
}
