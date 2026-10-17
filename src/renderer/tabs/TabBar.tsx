import { X } from 'lucide-react'
import type { JSX } from 'react'
import './tabs.css'

/** One tab: a document, or the conflict pages of a file. */
export interface TabItem {
  key: string
  name: string
  title: string
  dirty: boolean
  /** The tab holds a conflict waiting for choices. */
  conflict?: boolean
}

interface TabBarProps {
  items: TabItem[]
  activeKey: string | null
  onActivate: (key: string) => void
  onClose: (key: string) => void
}

/** One tab per open document; a dot marks unsaved changes. */
export function TabBar({ items, activeKey, onActivate, onClose }: TabBarProps): JSX.Element {
  return (
    <div className="tabs" role="tablist">
      {items.map((tab) => {
        const active = tab.key === activeKey
        return (
          <div
            key={tab.key}
            role="tab"
            aria-selected={active}
            className={`tab${active ? ' tab--active' : ''}${tab.conflict ? ' tab--conflict' : ''}`}
            data-tip={tab.title}
            onClick={() => onActivate(tab.key)}
          >
            <span className="tab__name">{tab.name}</span>
            <button
              type="button"
              className={`tab__close${tab.dirty ? ' tab__close--dirty' : ''}`}
              data-tip={tab.dirty ? 'Unsaved changes. Close' : 'Close'}
              aria-label={`Close ${tab.name}`}
              onClick={(event) => {
                event.stopPropagation()
                onClose(tab.key)
              }}
            >
              <X />
            </button>
          </div>
        )
      })}
    </div>
  )
}
