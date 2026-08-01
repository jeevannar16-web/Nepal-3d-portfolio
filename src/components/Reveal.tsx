import { useEffect, useRef, useState, type JSX, type ReactNode } from 'react'

/**
 * Fades + slides its children up when they scroll into view. Uses a single
 * IntersectionObserver (no animation library); the actual motion is pure CSS
 * via .reveal / .reveal-visible, so it stays cheap on low-end devices.
 */
export default function Reveal({
  children,
  delay = 0,
}: {
  children: ReactNode
  delay?: number
}): JSX.Element {
  const ref = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (!('IntersectionObserver' in window)) {
      setVisible(true)
      return
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          setVisible(true)
          io.disconnect()
        }
      },
      { threshold: 0.12, rootMargin: '0px 0px -40px 0px' },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [])

  return (
    <div
      ref={ref}
      className={`reveal ${visible ? 'reveal-visible' : ''}`}
      style={delay ? { transitionDelay: `${delay}ms` } : undefined}
    >
      {children}
    </div>
  )
}
