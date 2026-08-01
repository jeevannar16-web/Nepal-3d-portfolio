import { useEffect, useRef, type JSX } from 'react'
import { Howl, Howler } from 'howler'

export default function SoundManager(): JSX.Element {
  const started = useRef(false)

  useEffect(() => {
    const ambient = new Howl({
      src: ['/sounds/ambient.wav'],
      loop: true,
      volume: 0.25,
      html5: false,
    })

    const resume = () => {
      if (started.current) return
      started.current = true
      void Howler.ctx?.resume()
      ambient.play()
      window.removeEventListener('pointerdown', resume)
      window.removeEventListener('keydown', resume)
    }

    window.addEventListener('pointerdown', resume)
    window.addEventListener('keydown', resume)

    return () => {
      window.removeEventListener('pointerdown', resume)
      window.removeEventListener('keydown', resume)
      ambient.stop()
      ambient.unload()
    }
  }, [])

  return <></>
}
