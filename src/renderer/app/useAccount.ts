import { useEffect, useState } from 'react'
import type { AccountState } from '../../preload/contract'

const signedOut: AccountState = { account: null, signIn: null, error: null }

/** The GitHub account, mirrored from the background. */
export function useAccount(): AccountState {
  const [state, setState] = useState<AccountState>(signedOut)

  useEffect(() => {
    let live = true
    const off = window.coleaf.account.onChanged((next) => {
      if (live) setState(next)
    })
    void window.coleaf.account.getCurrent().then((current) => {
      if (live) setState(current)
    })
    return () => {
      live = false
      off()
    }
  }, [])

  return state
}
