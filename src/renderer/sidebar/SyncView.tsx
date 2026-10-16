import { useEffect, useMemo, useState, type JSX } from 'react'
import type { ChangeKind, ChangedFile, GitStatus } from '../../preload/contract'
import { messageOf } from '../app/useGit'
import { IdentityForm } from './IdentityForm'
import './sidebar.css'

interface SyncViewProps {
  status: GitStatus | null
  /** Open documents with unsaved edits: listed too, and saved first when Sync is pressed. */
  unsavedPaths: string[]
  onBeforeSync: () => Promise<void>
}

interface Row {
  path: string
  kind: ChangeKind | 'unsaved'
}

// What the row says on the right; an edited file needs no word.
const kindLabels: Record<Row['kind'], string> = {
  new: 'new',
  modified: '',
  deleted: 'deleted',
  renamed: 'renamed',
  conflict: 'Conflict',
  unsaved: 'unsaved'
}

/**
 * The Sync view: the files changed since the last Sync, each with a tick, a required message
 * and the Sync button. See docs/ui/sync-and-conflict.png. Mounted once per project.
 */
export function SyncView({ status, unsavedPaths, onBeforeSync }: SyncViewProps): JSX.Element {
  const [unticked, setUnticked] = useState<ReadonlySet<string>>(() => new Set())
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const [outcome, setOutcome] = useState<{ ok: boolean; text: string } | null>(null)
  // Whether Git knows who saves the versions; null until looked up.
  const [hasIdentity, setHasIdentity] = useState<boolean | null>(null)
  const repo = status?.repo ?? false

  useEffect(() => {
    if (!repo) return
    let live = true
    void window.coleaf.git
      .identity()
      .then((identity) => {
        if (live) setHasIdentity(identity.name !== '' && identity.email !== '')
      })
      .catch(() => {})
    return () => {
      live = false
    }
  }, [repo])

  const rows = useMemo(() => listRows(status?.changes ?? [], unsavedPaths), [status, unsavedPaths])
  const tickedCount = rows.filter((row) => !unticked.has(row.path)).length
  const canSync = !busy && repo && hasIdentity === true && tickedCount > 0 && message.trim() !== ''

  function toggle(path: string, ticked: boolean): void {
    setUnticked((current) => {
      const next = new Set(current)
      if (ticked) next.delete(path)
      else next.add(path)
      return next
    })
  }

  // Saves the open documents first, then a version with the ticked files as they are on disk.
  async function sync(): Promise<void> {
    setBusy(true)
    setOutcome(null)
    try {
      await onBeforeSync()
      const fresh = await window.coleaf.git.status()
      const chosen = fresh.changes.filter((change) => !unticked.has(change.path))
      const paths = chosen.flatMap((change) =>
        change.from ? [change.from, change.path] : [change.path]
      )
      await window.coleaf.git.commit(paths, message.trim())
      setMessage('')
      setOutcome({ ok: true, text: 'Version saved.' })
    } catch (error) {
      setOutcome({ ok: false, text: messageOf(error) })
    } finally {
      setBusy(false)
    }
  }

  return (
    <aside className="sidebar">
      <div className="sidebar__header">
        Sync
        {status?.branch && <span className="sidebar__branch">{status.branch}</span>}
      </div>
      {status === null ? null : !status.repo ? (
        <p className="sync__note">
          This folder is not a Git repository, so there is nothing to sync yet.
        </p>
      ) : (
        <div className="sync">
          <div className="sync__label">Changed files</div>
          {rows.length === 0 ? (
            <p className="sync__note">No changes since the last Sync.</p>
          ) : (
            <ul className="sync__files">
              {rows.map((row) => (
                <li key={row.path} className="sync__file">
                  <label className="sync__tick" title={row.path}>
                    <input
                      type="checkbox"
                      checked={!unticked.has(row.path)}
                      onChange={(event) => toggle(row.path, event.target.checked)}
                    />
                    <span className="sync__path">{row.path}</span>
                  </label>
                  {kindLabels[row.kind] && (
                    <span className={`sync__kind sync__kind--${row.kind}`}>
                      {kindLabels[row.kind]}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}
          {hasIdentity === false ? (
            <IdentityForm onSaved={() => setHasIdentity(true)} />
          ) : (
            <>
              <label className="sync__label" htmlFor="sync-message">
                What did you change? (required)
              </label>
              <textarea
                id="sync-message"
                className="sync__message"
                rows={3}
                placeholder="e.g. Added the Stage 1 design"
                value={message}
                disabled={busy}
                onChange={(event) => setMessage(event.target.value)}
              />
              <button
                type="button"
                className="button button--primary sync__button"
                disabled={!canSync}
                onClick={() => void sync()}
              >
                {busy ? 'Syncing…' : 'Sync'}
              </button>
              <p className="sync__caption">Saves a version with the ticked files.</p>
            </>
          )}
          {outcome && (
            <p className={`sync__outcome${outcome.ok ? '' : ' sync__outcome--error'}`}>
              {outcome.text}
            </p>
          )}
        </div>
      )}
    </aside>
  )
}

// The changed files on disk, plus open documents whose edits are not saved yet.
function listRows(changes: ChangedFile[], unsavedPaths: string[]): Row[] {
  const rows: Row[] = changes.map(({ path, kind }) => ({ path, kind }))
  const listed = new Set(rows.map((row) => row.path))
  for (const path of unsavedPaths) {
    if (!listed.has(path)) rows.push({ path, kind: 'unsaved' })
  }
  return rows.sort((a, b) => a.path.localeCompare(b.path, undefined, { sensitivity: 'base' }))
}
