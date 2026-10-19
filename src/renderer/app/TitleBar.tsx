import { useEffect, useState, type JSX } from 'react'
import logo from '../../../build/icon.png'

/**
 * The row along the top, as in VS Code (docs/ui/project-view.png): the app icon, the menus and,
 * drawn by the system over its right end, the window controls. No title text: the taskbar has
 * it. The row is the window's drag handle; the menus are the native ones, opened from here.
 */
export function TitleBar(): JSX.Element {
  const [menus, setMenus] = useState<string[]>([])
  const [opened, setOpened] = useState<string | null>(null)

  useEffect(() => {
    void window.coleaf.app.menus().then(setMenus)
  }, [])

  // The system's window controls take their colors and height from the tokens, like the rest.
  // Their background is see-through: the title bar shows beneath, dimmed along with the page
  // while a dialog is open.
  useEffect(() => {
    const style = getComputedStyle(document.documentElement)
    const token = (name: string): string => style.getPropertyValue(name).trim()
    window.coleaf.app.setTitleBarOverlay({
      color: token('--color-window-controls'),
      symbolColor: token('--color-ink'),
      height: parseInt(token('--title-bar-height'), 10)
    })
  }, [])

  // The menu drops down from its label and the label stays pressed until it closes.
  async function open(label: string, button: HTMLElement): Promise<void> {
    const box = button.getBoundingClientRect()
    setOpened(label)
    await window.coleaf.app.openMenu(label, Math.round(box.left), Math.round(box.bottom))
    setOpened(null)
  }

  return (
    <header className="title-bar">
      <img className="title-bar__logo" src={logo} alt="" />
      <nav className="title-bar__menus" aria-label="Menu">
        {menus.map((label) => (
          <button
            key={label}
            type="button"
            className={`title-bar__menu${opened === label ? ' title-bar__menu--open' : ''}`}
            aria-haspopup="menu"
            aria-expanded={opened === label}
            onClick={(event) => void open(label, event.currentTarget)}
          >
            {label}
          </button>
        ))}
      </nav>
    </header>
  )
}
