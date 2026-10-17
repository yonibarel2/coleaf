import { useEffect, useLayoutEffect, useRef, useState, type JSX } from 'react'

interface Tip {
  text: string
  /** The middle of the element, in window coordinates. */
  x: number
  y: number
  below: boolean
}

// A short wait, so moving across buttons does not flash tips.
const delayMs = 350
const gap = 6
const edge = 8

/**
 * The one tooltip of the window, styled like the rest of the app: any element with a
 * `data-tip` shows it on hover or focus. Mount once, in App.
 */
export function Tooltip(): JSX.Element | null {
  const [tip, setTip] = useState<Tip | null>(null)
  const bubble = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let timer: number | undefined
    let current: Element | null = null

    const hide = (): void => {
      window.clearTimeout(timer)
      current = null
      setTip(null)
    }
    const show = (element: Element): void => {
      const text = element.getAttribute('data-tip')
      if (!text || !element.isConnected) return
      const box = element.getBoundingClientRect()
      const below = box.bottom + 48 < window.innerHeight
      setTip({
        text,
        x: box.left + box.width / 2,
        y: below ? box.bottom + gap : box.top - gap,
        below
      })
    }
    const enter = (event: Event): void => {
      const target = event.target instanceof Element ? event.target : null
      const element = target?.closest('[data-tip]') ?? null
      if (element === current) return
      window.clearTimeout(timer)
      current = element
      setTip(null)
      if (element) timer = window.setTimeout(() => show(element), delayMs)
    }
    const leave = (event: PointerEvent | FocusEvent): void => {
      const to = event.relatedTarget instanceof Element ? event.relatedTarget : null
      if (current && !(to && current.contains(to))) hide()
    }

    document.addEventListener('pointerover', enter)
    document.addEventListener('pointerout', leave)
    document.addEventListener('focusin', enter)
    document.addEventListener('focusout', leave)
    document.addEventListener('pointerdown', hide)
    document.addEventListener('keydown', hide)
    window.addEventListener('blur', hide)
    return () => {
      window.clearTimeout(timer)
      document.removeEventListener('pointerover', enter)
      document.removeEventListener('pointerout', leave)
      document.removeEventListener('focusin', enter)
      document.removeEventListener('focusout', leave)
      document.removeEventListener('pointerdown', hide)
      document.removeEventListener('keydown', hide)
      window.removeEventListener('blur', hide)
    }
  }, [])

  // Keeps the bubble inside the window once its width is known.
  useLayoutEffect(() => {
    const element = bubble.current
    if (!element || !tip) return
    const half = element.offsetWidth / 2
    const x = Math.min(Math.max(tip.x, edge + half), window.innerWidth - edge - half)
    element.style.left = `${x}px`
  }, [tip])

  if (!tip) return null
  return (
    <div
      ref={bubble}
      className={`tooltip${tip.below ? '' : ' tooltip--above'}`}
      style={{ left: tip.x, top: tip.y }}
      role="tooltip"
    >
      {tip.text}
    </div>
  )
}
