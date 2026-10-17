import { User } from 'lucide-react'
import { useEffect, useRef, useState, type JSX } from 'react'
import type { AccountState } from '../../preload/contract'

interface AccountProps {
  state: AccountState
}

/**
 * The account button at the bottom of the icon bar: "Sign in with GitHub" when signed out,
 * the GitHub picture when signed in. Its card shows the code to enter while signing in.
 */
export function Account({ state }: AccountProps): JSX.Element {
  const [open, setOpen] = useState(false)
  const holder = useRef<HTMLDivElement>(null)
  const { account, signIn, error } = state
  // The card stays up while a sign-in runs, so the code is never lost.
  const shown = open || signIn !== null

  // A click elsewhere closes the card.
  useEffect(() => {
    if (!shown) return
    const close = (event: MouseEvent): void => {
      if (!holder.current?.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [shown])

  return (
    <div className="account" ref={holder}>
      <button
        type="button"
        className={`icon-button${shown ? ' icon-button--active' : ''}`}
        title={account ? `Signed in to GitHub as ${account.login}` : 'Sign in with GitHub'}
        aria-haspopup="dialog"
        aria-expanded={shown}
        onClick={() => setOpen((value) => !value)}
      >
        {account ? <img className="account__picture" src={account.avatarUrl} alt="" /> : <User />}
      </button>
      {shown && (
        <div className="account__card" role="dialog" aria-label="GitHub account">
          {signIn ? (
            <>
              <p className="account__text">Enter this code on GitHub, then come back:</p>
              <p className="account__code">{signIn.userCode}</p>
              <div className="account__actions">
                <button
                  type="button"
                  className="button button--primary"
                  onClick={() => {
                    void navigator.clipboard.writeText(signIn.userCode).catch(() => {})
                    window.open(signIn.verificationUri)
                  }}
                >
                  Open GitHub
                </button>
                <button
                  type="button"
                  className="button"
                  onClick={() => {
                    void window.coleaf.account.cancelSignIn()
                    setOpen(false)
                  }}
                >
                  Cancel
                </button>
              </div>
              <p className="account__hint">The code is copied when GitHub opens.</p>
            </>
          ) : account ? (
            <>
              <p className="account__text">
                Signed in as <strong>{account.login}</strong>
              </p>
              <div className="account__actions">
                <button
                  type="button"
                  className="button"
                  onClick={() => {
                    void window.coleaf.account.signOut()
                    setOpen(false)
                  }}
                >
                  Sign out
                </button>
              </div>
            </>
          ) : (
            <>
              <p className="account__text">Sign in to share your changes on GitHub.</p>
              <div className="account__actions">
                <button
                  type="button"
                  className="button button--primary"
                  onClick={() => void window.coleaf.account.signIn()}
                >
                  Sign in with GitHub
                </button>
              </div>
              {error && <p className="account__error">{error}</p>}
            </>
          )}
        </div>
      )}
    </div>
  )
}
