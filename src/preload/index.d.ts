import type { CoLeafApi } from './index'

declare global {
  interface Window {
    coleaf: CoLeafApi
  }
}
