import { useState, type JSX } from 'react'
import { messageOf } from '../app/useGit'

interface IdentityFormProps {
  onSaved: () => void
}

/** Asked once, before the first Sync: the name and email Git puts on every version. */
export function IdentityForm({ onSaved }: IdentityFormProps): JSX.Element {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const canSave = !busy && name.trim() !== '' && email.trim() !== ''

  async function save(): Promise<void> {
    setBusy(true)
    setError(null)
    try {
      await window.coleaf.git.setIdentity({ name: name.trim(), email: email.trim() })
      onSaved()
    } catch (cause) {
      setError(messageOf(cause))
      setBusy(false)
    }
  }

  return (
    <form
      className="sync__identity"
      onSubmit={(event) => {
        event.preventDefault()
        if (canSave) void save()
      }}
    >
      <p className="sync__note">
        Before your first Sync, tell Git who you are. Every version you save shows this name and
        email. Asked once.
      </p>
      <input
        className="sync__input"
        placeholder="Name"
        aria-label="Name"
        value={name}
        disabled={busy}
        autoFocus
        onChange={(event) => setName(event.target.value)}
      />
      <input
        className="sync__input"
        type="email"
        placeholder="Email"
        aria-label="Email"
        value={email}
        disabled={busy}
        onChange={(event) => setEmail(event.target.value)}
      />
      <button type="submit" className="button button--primary sync__button" disabled={!canSave}>
        Save
      </button>
      {error && <p className="sync__outcome sync__outcome--error">{error}</p>}
    </form>
  )
}
