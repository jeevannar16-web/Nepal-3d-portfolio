import { useEffect, useRef, type JSX } from 'react'
import { Howl, Howler } from 'howler'
import { useStore } from '../store/useStore'

export default function SoundManager(): JSX.Element {
  const started = useRef(false)
  const ambient = useRef<Howl | null>(null)
  const muted = useStore((s) => s.settings.muted)

  useEffect(() => {
    ambient.current = new Howl({
      src: ['/sounds/ambient.wav'],
      loop: true,
      volume: 0.25,
      html5: false,
    })

    const resume = () => {
      if (started.current) return
      started.current = true
      void Howler.ctx?.resume()
      ambient.current?.play()
      window.removeEventListener('pointerdown', resume)
      window.removeEventListener('keydown', resume)
    }

    window.addEventListener('pointerdown', resume)
    window.addEventListener('keydown', resume)

    return () => {
      window.removeEventListener('pointerdown', resume)
      window.removeEventListener('keydown', resume)
      ambient.current?.stop()
      ambient.current?.unload()
      ambient.current = null
    }
  }, [])

  useEffect(() => {
    ambient.current?.mute(muted)
  }, [muted])

  return <></>
}
