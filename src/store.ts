import { DEFAULT_THEME, isThemeId, resolveTheme, type ThemeAdapter, type ThemeId } from './core.js'
import { ThemeSync } from './sync.js'

export type ThemeStatus = 'loading' | 'saving' | 'idle' | 'error'
export interface ThemeAccount { id: string; adapter: ThemeAdapter }
export interface ThemePersistence {
  read(key: string): unknown
  write(key: string, theme: ThemeId): void
}
export interface ThemeSnapshot {
  readonly theme: ThemeId
  readonly status: ThemeStatus
  readonly accountId: string | null
  readonly syncEnabled: boolean
  readonly pendingTheme: ThemeId | null
}
export const themeStorageKey = (id?: string) => id === undefined ? 'theme' : `unicorp-theme:user:${id}`

/** No browser access or requests until start(). dispose() permits reconnecting (e.g. StrictMode). */
export function createThemeStore(options: {
  initialTheme?: ThemeId
  account?: ThemeAccount
  persistence?: ThemePersistence
} = {}) {
  let account = options.account
  let active = false
  let initialized = false
  let controller: ThemeSync | undefined
  let snapshot: ThemeSnapshot = Object.freeze({
    theme: resolveTheme(options.initialTheme), status: 'idle',
    accountId: account?.id ?? null, syncEnabled: !!account, pendingTheme: null,
  })
  const serverSnapshot = snapshot
  const listeners = new Set<() => void>()
  const key = () => themeStorageKey(account?.id)
  function publish(patch: Partial<ThemeSnapshot>) {
    const next = { ...snapshot, ...patch }
    if (Object.keys(next).every(k => next[k as keyof ThemeSnapshot] === snapshot[k as keyof ThemeSnapshot])) return
    snapshot = Object.freeze(next)
    for (const listener of listeners) listener()
  }
  function read(): ThemeId {
    try { return resolveTheme(options.persistence?.read(key())) }
    catch { return DEFAULT_THEME }
  }
  function apply(theme: ThemeId) {
    try { options.persistence?.write(key(), theme) } catch { /* Storage is optional. */ }
    publish({ theme })
  }
  function connect() {
    if (!active || !account) return
    controller = new ThemeSync(account.adapter, value => apply(value ?? DEFAULT_THEME), status => {
      publish({ status, ...(status === 'idle' ? { pendingTheme: null } : {}) })
    })
    if (snapshot.pendingTheme) controller.select(snapshot.pendingTheme)
    else void controller.refresh()
  }
  return {
    getSnapshot: () => snapshot,
    getServerSnapshot: () => serverSnapshot,
    subscribe(listener: () => void) {
      listeners.add(listener)
      return () => { listeners.delete(listener) }
    },
    start() {
      if (active) return
      active = true
      if (!initialized) {
        initialized = true
        // The SSR seed wins once; later account changes use that account's cache.
        if (!isThemeId(options.initialTheme)) publish({ theme: read() })
      }
      connect()
    },
    setAccount(next?: ThemeAccount) {
      if (account?.id === next?.id && account?.adapter === next?.adapter) return
      const sameIdentity = account?.id === next?.id && !!account === !!next
      controller?.dispose()
      controller = undefined
      account = next
      if (!sameIdentity) {
        initialized = true
        publish({ theme: read(), pendingTheme: null, status: 'idle', accountId: next?.id ?? null, syncEnabled: !!next })
      }
      connect()
    },
    select(theme: ThemeId) {
      if (!isThemeId(theme)) return
      initialized = true
      publish({ pendingTheme: account ? theme : null })
      if (controller) controller.select(theme)
      else apply(theme)
    },
    refresh() { return controller?.refresh() },
    retry() { controller?.retry() },
    storageChanged(changedKey: string | null) {
      if (changedKey !== null && changedKey !== key()) return
      if (account) void controller?.refresh()
      else publish({ theme: read() })
    },
    dispose() {
      active = false
      controller?.dispose()
      controller = undefined
    },
  }
}
export type ThemeStore = ReturnType<typeof createThemeStore>
