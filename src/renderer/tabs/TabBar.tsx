import { X } from 'lucide-react'
import type { JSX } from 'react'
import type { Tab } from './useTabs'
import './tabs.css'

interface TabBarProps {
  tabs: Tab[]
  active: Tab | null
  onActivate: (path: string) => void
  onClose: (path: string) => void
}

/** One tab per open document; a dot marks unsaved changes. */
export function TabBar({ tabs, active, onActivate, onClose }: TabBarProps): JSX.Element {
  return (
    <div className="tabs" role="tablist">
      {tabs.map((tab) => (
        <div
          key={tab.path}
          role="tab"
          aria-selected={tab === active}
          className={`tab${tab === active ? ' tab--active' : ''}`}
          title={tab.path}
          onClick={() => onActivate(tab.path)}
        >
          <span className="tab__name">{tab.name}</span>
          <button
            type="button"
            className={`tab__close${tab.dirty ? ' tab__close--dirty' : ''}`}
            title={tab.dirty ? 'Unsaved changes. Close' : 'Close'}
            aria-label={`Close ${tab.name}`}
            onClick={(event) => {
              event.stopPropagation()
              onClose(tab.path)
            }}
          >
            <X />
          </button>
        </div>
      ))}
    </div>
  )
}
