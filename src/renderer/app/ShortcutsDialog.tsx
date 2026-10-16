import { useEffect, type JSX } from 'react'
import { keysLabel, shortcuts, type ShortcutGroup } from '../editor/shortcuts'

const groups: ShortcutGroup[] = ['Edit', 'Styles', 'Text', 'Paragraph', 'Insert', 'File']

/** Help › Keyboard Shortcuts: every shortcut, by ribbon group. Rebinding comes later. */
export function ShortcutsDialog({ onClose }: { onClose: () => void }): JSX.Element {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  return (
    <div className="dialog-backdrop" onMouseDown={onClose}>
      <div
        className="dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="shortcuts-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <h2 id="shortcuts-title" className="dialog__title">
          Keyboard Shortcuts
        </h2>
        <div className="dialog__body">
          {groups.map((group) => (
            <section key={group} className="shortcuts__group">
              <h3 className="shortcuts__heading">{group}</h3>
              <table className="shortcuts__table">
                <tbody>
                  {shortcuts
                    .filter((shortcut) => shortcut.group === group)
                    .map((shortcut) => (
                      <tr key={shortcut.id}>
                        <td>{shortcut.label}</td>
                        <td>
                          <kbd>{keysLabel(shortcut.keys)}</kbd>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </section>
          ))}
        </div>
        <div className="dialog__actions">
          <button type="button" className="button button--primary" onClick={onClose} autoFocus>
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
