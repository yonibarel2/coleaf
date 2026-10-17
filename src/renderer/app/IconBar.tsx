import { Files, RefreshCw, Settings } from 'lucide-react'
import type { JSX, ReactNode } from 'react'
import type { AccountState } from '../../preload/contract'
import { Account } from './Account'

export type SidebarView = 'explorer' | 'sync'

interface IconBarProps {
  /** The sidebar view shown, or null while the sidebar is hidden. */
  view: SidebarView | null
  /** Sync needs a project: without one only the Explorer icon shows. */
  hasProject: boolean
  /** Files changed since the last Sync: the badge on the Sync icon. */
  changeCount: number
  account: AccountState
  onSelect: (view: SidebarView) => void
}

/** The left icon bar: one view at a time at the top, account and settings at the bottom. */
export function IconBar({
  view,
  hasProject,
  changeCount,
  account,
  onSelect
}: IconBarProps): JSX.Element {
  return (
    <nav className="icon-bar" aria-label="Views">
      <ViewButton name="explorer" title="Explorer" view={view} onSelect={onSelect}>
        <Files />
      </ViewButton>
      {hasProject && (
        <ViewButton name="sync" title="Sync" view={view} onSelect={onSelect}>
          <RefreshCw />
          {changeCount > 0 && (
            <span className="icon-button__badge" aria-label={`${changeCount} changed files`}>
              {changeCount > 99 ? '99+' : changeCount}
            </span>
          )}
        </ViewButton>
      )}
      <div className="icon-bar__spacer" />
      <Account state={account} />
      <button type="button" className="icon-button" title="Settings (coming soon)" disabled>
        <Settings />
      </button>
    </nav>
  )
}

interface ViewButtonProps {
  name: SidebarView
  title: string
  view: SidebarView | null
  onSelect: (view: SidebarView) => void
  children: ReactNode
}

// Clicking the active view's icon hides the sidebar; clicking another switches to it.
function ViewButton({ name, title, view, onSelect, children }: ViewButtonProps): JSX.Element {
  const active = view === name
  return (
    <button
      type="button"
      className={`icon-button${active ? ' icon-button--active' : ''}`}
      title={title}
      aria-pressed={active}
      onClick={() => onSelect(name)}
    >
      {children}
    </button>
  )
}
