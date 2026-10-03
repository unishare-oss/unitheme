import { THEME_IDS, isDarkTheme, serializeThemeCookie } from './core.js'
import type { ThemePersistence, ThemeStore } from './store.js'

/** Access is deferred and failures are handled by the store. */
export function createBrowserPersistence(): ThemePersistence {
  return {
    read: key => localStorage.getItem(key),
    write: (key, theme) => localStorage.setItem(key, theme),
  }
}

/** Bind presentation and browser refresh events; returns a complete lifecycle cleanup. */
export function connectThemeBrowser(store: ThemeStore, { persistCookie = false } = {}) {
  let displayed: string | undefined
  const render = () => {
    const { theme } = store.getSnapshot()
    if (theme === displayed) return
    displayed = theme
    const root = document.documentElement
    root.classList.remove(...THEME_IDS)
    root.classList.add(theme)
    root.classList.toggle('dark', isDarkTheme(theme))
    if (persistCookie) {
      try { document.cookie = serializeThemeCookie(theme, window.location.protocol === 'https:') }
      catch { /* Cookies are an optional display cache. */ }
    }
  }
  const refresh = () => {
    if (document.visibilityState === 'visible') void store.refresh()
  }
  const storage = (event: StorageEvent) => {
    // Ignore sessionStorage events; access may itself throw in restricted browsers.
    try { if (event.storageArea && event.storageArea !== window.localStorage) return } catch { return }
    store.storageChanged(event.key)
  }
  const unsubscribe = store.subscribe(render)
  store.start()
  render()
  window.addEventListener('focus', refresh)
  window.addEventListener('storage', storage)
  document.addEventListener('visibilitychange', refresh)
  const timer = window.setInterval(refresh, 60_000)
  return () => {
    unsubscribe()
    window.removeEventListener('focus', refresh)
    window.removeEventListener('storage', storage)
    document.removeEventListener('visibilitychange', refresh)
    window.clearInterval(timer)
    store.dispose()
  }
}
