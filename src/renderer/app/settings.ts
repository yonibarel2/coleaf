// Small per-window preferences (a hidden ribbon, later a collapsed section) kept in the
// window's local storage. Nothing here is ever written to the project.

const prefix = 'coleaf.'

export function readFlag(name: string, fallback = false): boolean {
  try {
    const value = localStorage.getItem(prefix + name)
    return value === null ? fallback : value === 'true'
  } catch {
    return fallback
  }
}

export function writeFlag(name: string, value: boolean): void {
  try {
    localStorage.setItem(prefix + name, String(value))
  } catch {
    // Storage may be unavailable; the flag then lasts for this window only.
  }
}

export function readNumber(name: string, fallback: number): number {
  try {
    const value = Number(localStorage.getItem(prefix + name))
    return Number.isFinite(value) && value > 0 ? value : fallback
  } catch {
    return fallback
  }
}

export function writeNumber(name: string, value: number): void {
  try {
    localStorage.setItem(prefix + name, String(value))
  } catch {
    // Storage may be unavailable; the value then lasts for this window only.
  }
}
