import { useRef, type JSX } from 'react'

interface SidebarResizerProps {
  /** The width while dragging. */
  onResize: (width: number) => void
  /** The width to keep, once the pointer is released. */
  onDone: (width: number) => void
}

/** The thin strip at the sidebar's right edge: drag it to make the sidebar wider or narrower. */
export function SidebarResizer({ onResize, onDone }: SidebarResizerProps): JSX.Element {
  const last = useRef<number | null>(null)
  return (
    <div
      className="frame__resizer"
      role="separator"
      aria-orientation="vertical"
      aria-label="Resize the sidebar"
      onPointerDown={(event) => {
        event.preventDefault()
        event.currentTarget.setPointerCapture(event.pointerId)
        last.current = null
      }}
      onPointerMove={(event) => {
        if (!event.currentTarget.hasPointerCapture(event.pointerId)) return
        const width = clamp(event.clientX - tokenPx('--icon-bar-width'))
        last.current = width
        onResize(width)
      }}
      onPointerUp={(event) => {
        event.currentTarget.releasePointerCapture(event.pointerId)
        if (last.current !== null) onDone(last.current)
      }}
    />
  )
}

// Between the smallest and largest width the tokens allow.
function clamp(width: number): number {
  const min = tokenPx('--sidebar-width-min')
  const max = tokenPx('--sidebar-width-max')
  return Math.round(Math.min(max, Math.max(min, width)))
}

function tokenPx(name: string): number {
  return parseFloat(getComputedStyle(document.documentElement).getPropertyValue(name)) || 0
}
