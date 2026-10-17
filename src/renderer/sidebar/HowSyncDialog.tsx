import type { JSX } from 'react'

interface HowSyncDialogProps {
  onClose: () => void
}

/**
 * "Learn more" next to Sync: how sharing works, in plain words. This text moves into
 * Help › User Guide when the guide is built.
 */
export function HowSyncDialog({ onClose }: HowSyncDialogProps): JSX.Element {
  return (
    <div className="dialog-backdrop" onClick={onClose}>
      <div
        className="dialog"
        role="dialog"
        aria-labelledby="how-sync-title"
        onClick={(event) => event.stopPropagation()}
      >
        <h2 className="dialog__title" id="how-sync-title">
          How Sync works
        </h2>
        <div className="dialog__body how-sync">
          <p>
            Your project lives in two places: on this computer, and in an online copy on GitHub that
            your whole team shares. Sync keeps the two the same.
          </p>
          <p>
            <strong>A version.</strong> Each Sync first saves a version of the ticked files, with
            your note on what changed. Versions are never lost: History shows every one.
          </p>
          <p>
            <strong>Others&rsquo; changes, then yours.</strong> Sync then brings in what others have
            shared since your last Sync, and sends your version up. With nothing ticked, it only
            brings in the latest.
          </p>
          <p>
            <strong>Conflicts.</strong> When someone changed the same part of a file as you, Sync
            stops and shows both versions side by side. Pick Mine, Theirs or Both for each part,
            press Done, then Finish sync. Nothing is sent until you have chosen.
          </p>
          <p>
            <strong>Signing in.</strong> Sharing on GitHub needs your GitHub account: the button at
            the bottom left signs you in with a short code. Your version is always saved on this
            computer first, signed in or not.
          </p>
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
