import { useEffect, useMemo, useState, type JSX } from 'react'
import type { ChangeKind, ChangedFile, GitStatus, SyncOutcome } from '../../preload/contract'
import { messageOf } from '../app/useGit'
import { isMarkdownPath } from '../editor/paths'
import { HowSyncDialog } from './HowSyncDialog'
import { IdentityForm } from './IdentityForm'
import './sidebar.css'

interface SyncViewProps {
  status: GitStatus | null
  /** Open documents with unsaved edits: listed too, and saved first when Sync is pressed. */
  unsavedPaths: string[]
  onBeforeSync: () => Promise<void>
  /** A Sync ended (or a conflict was settled): others' changes may be on disk now. */
  onSynced: (outcome: SyncOutcome) => void
  /** A conflicted Markdown file: the app opens it as Mine / Theirs pages. */
  onOpenConflict: (path: string) => void
}

interface Row {
  path: string
  kind: ChangeKind | 'unsaved'
}

interface Outcome {
  ok: boolean
  text: string
  /** The message offers "Sign in with GitHub". */
  signIn?: boolean
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
 * and the Sync button; while a Sync waits on conflicts, the choices per file and Finish sync.
 * See docs/ui/sync-and-conflict.png. Mounted once per project.
 */
export function SyncView({
  status,
  unsavedPaths,
  onBeforeSync,
  onSynced,
  onOpenConflict
}: SyncViewProps): JSX.Element {
  const [unticked, setUnticked] = useState<ReadonlySet<string>>(() => new Set())
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const [outcome, setOutcome] = useState<Outcome | null>(null)
  const [helpOpen, setHelpOpen] = useState(false)
  // Whether Git knows who saves the versions; null until looked up.
  const [hasIdentity, setHasIdentity] = useState<boolean | null>(null)
  // Pictures under md-images/ no document uses: offered for removal with the next Sync.
  const [unused, setUnused] = useState<string[]>([])
  const [removeUnused, setRemoveUnused] = useState(true)
  const repo = status?.repo ?? false
  const merging = status?.merging ?? false

  useEffect(() => {
    if (!repo) return
    let live = true
    void window.coleaf.images
      .unused()
      .then((paths) => {
        if (live) setUnused(paths)
      })
      .catch(() => {})
    return () => {
      live = false
    }
  }, [status, repo])

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
  const conflicts = rows.filter((row) => row.kind === 'conflict')
  const cleaning = removeUnused && unused.length > 0 && !merging
  const tickedCount = rows.filter((row) => !unticked.has(row.path)).length + (cleaning ? 1 : 0)
  const canSync =
    !busy && repo && hasIdentity === true && (tickedCount === 0 || message.trim() !== '')

  function toggle(path: string, ticked: boolean): void {
    setUnticked((current) => {
      const next = new Set(current)
      if (ticked) next.delete(path)
      else next.add(path)
      return next
    })
  }

  // Runs one of the Sync steps in the background and shows how it went.
  async function run(step: () => Promise<SyncOutcome>): Promise<void> {
    setBusy(true)
    setOutcome(null)
    try {
      const result = await step()
      setOutcome(describe(result))
      if (result.kind === 'synced' || result.kind === 'saved') setMessage('')
      onSynced(result)
    } catch (error) {
      setOutcome({ ok: false, text: messageOf(error) })
    } finally {
      setBusy(false)
    }
  }

  // Saves the open documents first (and drops the unused pictures, if ticked), then syncs with
  // the ticked files as they are on disk.
  function sync(): Promise<void> {
    return run(async () => {
      await onBeforeSync()
      if (cleaning) await window.coleaf.images.remove(await window.coleaf.images.unused())
      const fresh = await window.coleaf.git.status()
      const chosen = fresh.changes.filter((change) => !unticked.has(change.path))
      const paths = chosen.flatMap((change) =>
        change.from ? [change.from, change.path] : [change.path]
      )
      return window.coleaf.git.sync(paths, message.trim())
    })
  }

  async function settleFile(path: string, side: 'mine' | 'theirs'): Promise<void> {
    setOutcome(null)
    try {
      await window.coleaf.git.resolveFile(path, side)
      onSynced({ kind: 'conflicts', pulled: true })
    } catch (error) {
      setOutcome({ ok: false, text: messageOf(error) })
    }
  }

  return (
    <aside className="sidebar">
      <div className="sidebar__header">Sync</div>
      {status === null ? null : !status.repo ? (
        <p className="sync__note">
          This folder is not a Git repository, so there is nothing to sync yet.
        </p>
      ) : (
        <div className="sync">
          <div className="section__header section__header--static">
            <span className="section__title">Changed files</span>
          </div>
          {merging && (
            <p className="sync__note sync__note--attention">
              Others changed the same parts as you. Choose a version for each file marked Conflict,
              then press Finish sync.
            </p>
          )}
          {rows.length === 0 ? (
            <p className="sync__note">No changes since the last Sync.</p>
          ) : (
            <ul className="sync__files">
              {rows.map((row) => (
                <li key={row.path} className="sync__file">
                  {row.kind === 'conflict' ? (
                    <ConflictRow
                      path={row.path}
                      onOpen={() => onOpenConflict(row.path)}
                      onSettle={(side) => void settleFile(row.path, side)}
                    />
                  ) : (
                    <label className="sync__tick" data-tip={row.path}>
                      <input
                        type="checkbox"
                        checked={!unticked.has(row.path)}
                        disabled={merging}
                        onChange={(event) => toggle(row.path, event.target.checked)}
                      />
                      <span className="sync__path">{row.path}</span>
                    </label>
                  )}
                  {kindLabels[row.kind] && (
                    <span className={`sync__kind sync__kind--${row.kind}`}>
                      {kindLabels[row.kind]}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}
          {unused.length > 0 && !merging && (
            <label className="sync__tick sync__cleanup" data-tip={unused.join('\n')}>
              <input
                type="checkbox"
                checked={removeUnused}
                onChange={(event) => setRemoveUnused(event.target.checked)}
              />
              <span className="sync__path">
                Also remove {unused.length} unused {unused.length === 1 ? 'picture' : 'pictures'}
              </span>
            </label>
          )}
          {hasIdentity === false ? (
            <IdentityForm onSaved={() => setHasIdentity(true)} />
          ) : merging ? (
            <>
              <button
                type="button"
                className="button button--primary sync__button"
                disabled={busy || conflicts.length > 0}
                onClick={() => void run(() => window.coleaf.git.finishSync())}
              >
                {busy ? 'Syncing…' : 'Finish sync'}
              </button>
              <button
                type="button"
                className="button sync__button"
                disabled={busy}
                onClick={() =>
                  void run(async () => {
                    await window.coleaf.git.cancelSync()
                    return { kind: 'error', pulled: true, message: 'Sync cancelled.' }
                  })
                }
              >
                Cancel sync
              </button>
              <p className="sync__caption">
                {conflicts.length > 0
                  ? `${conflicts.length} ${conflicts.length === 1 ? 'file needs' : 'files need'} a choice. `
                  : 'Every conflict has its choice. '}
                <LearnMore onOpen={() => setHelpOpen(true)} />
              </p>
            </>
          ) : (
            <>
              <label className="sync__label" htmlFor="sync-message">
                What did you change? {tickedCount > 0 && '(required)'}
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
              <p className="sync__caption">
                {tickedCount > 0
                  ? "Saves a version, gets others' changes, then sends yours. "
                  : "Gets others' latest changes. "}
                <LearnMore onOpen={() => setHelpOpen(true)} />
              </p>
            </>
          )}
          {outcome && (
            <p className={`sync__outcome${outcome.ok ? '' : ' sync__outcome--error'}`}>
              {outcome.text}
              {outcome.signIn && (
                <>
                  {' '}
                  <button
                    type="button"
                    className="link-button"
                    onClick={() => void window.coleaf.account.signIn()}
                  >
                    Sign in with GitHub
                  </button>
                </>
              )}
            </p>
          )}
        </div>
      )}
      {helpOpen && <HowSyncDialog onClose={() => setHelpOpen(false)} />}
    </aside>
  )
}

interface ConflictRowProps {
  path: string
  onOpen: () => void
  onSettle: (side: 'mine' | 'theirs') => void
}

// A conflicted file: a Markdown one opens as Mine / Theirs pages; any other is kept whole.
function ConflictRow({ path, onOpen, onSettle }: ConflictRowProps): JSX.Element {
  if (isMarkdownPath(path)) {
    return (
      <button
        type="button"
        className="sync__conflict"
        data-tip={`Choose: ${path}`}
        aria-label={`Choose: ${path}`}
        onClick={onOpen}
      >
        <span className="sync__path">{path}</span>
      </button>
    )
  }
  return (
    <span className="sync__conflict" data-tip={path}>
      <span className="sync__path">{path}</span>
      <span className="sync__sides">
        <button type="button" className="link-button" onClick={() => onSettle('mine')}>
          Keep mine
        </button>
        <button type="button" className="link-button" onClick={() => onSettle('theirs')}>
          Keep theirs
        </button>
      </span>
    </span>
  )
}

function LearnMore({ onOpen }: { onOpen: () => void }): JSX.Element {
  return (
    <button type="button" className="link-button" onClick={onOpen}>
      Learn more
    </button>
  )
}

// How a Sync ended, in the Sync view's words; null when the view already says it.
function describe(outcome: SyncOutcome): Outcome | null {
  const latest = outcome.pulled ? " Others' changes were brought in." : ''
  switch (outcome.kind) {
    case 'synced':
      return {
        ok: true,
        text: outcome.pushed
          ? `Synced.${latest}`
          : outcome.pulled
            ? 'You have the latest.'
            : 'Up to date.'
      }
    case 'saved':
      return {
        ok: true,
        text: 'Version saved on this computer. This project has no online copy yet.'
      }
    case 'sign-in':
      return { ok: true, text: 'Version saved on this computer. To share it:', signIn: true }
    case 'ssh':
      return {
        ok: false,
        text: "Version saved on this computer. Its online copy is reached over SSH, which CoLeaf can't use yet."
      }
    case 'denied':
      return {
        ok: false,
        text: 'Version saved on this computer. GitHub did not allow the sharing: check that you can write to this repository and that the CoLeaf app is installed on it.'
      }
    case 'offline':
      return {
        ok: false,
        text: "Version saved on this computer. Couldn't reach GitHub; Sync again when you're online."
      }
    case 'conflicts':
      return null // the note above the list and the caption say what is needed
    default:
      return { ok: false, text: outcome.message ?? 'Sync failed.' }
  }
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
