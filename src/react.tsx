'use client'

import { createContext, useContext, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { DEFAULT_THEME, THEMES, THEME_IDS, isThemeId, isDarkTheme, resolveTheme, serializeThemeCookie, type ThemeAdapter, type ThemeId } from './index.js'
import { ThemeSync } from './sync.js'

type State = 'loading' | 'saving' | 'idle' | 'error'
const Context = createContext<{ theme: ThemeId; setTheme: (id: ThemeId) => void; status: State; retry: () => void; synced: boolean } | null>(null)
const storageKey = (id?: string) => id ? `unicorp-theme:user:${id}` : 'theme'
function stored(key: string, fallback: ThemeId = DEFAULT_THEME) {
  try { const value = localStorage.getItem(key); return isThemeId(value) ? value : fallback }
  catch { return fallback }
}
function persist(key: string, theme: ThemeId) { try { localStorage.setItem(key, theme) } catch { /* private browsing */ } }

/** Mount once. Account id must come from the app's verified session, never URL input. */
export function ThemeProvider({ children, account, initialTheme, persistCookie = false }: {
  children: ReactNode
  account?: { id: string; adapter: ThemeAdapter }
  /** Validated server-rendered theme. A seed, not a controlled prop. */
  initialTheme?: ThemeId
  /** Mirror the displayed theme to a host-only cookie for the next server render. */
  persistCookie?: boolean
}) {
  const [theme, update] = useState<ThemeId>(() => resolveTheme(initialTheme))
  const [status, setStatus] = useState<State>('idle')
  const sync = useRef<ThemeSync | null>(null)
  const previousKey = useRef<string | undefined>(undefined)
  const key = storageKey(account?.id)
  useLayoutEffect(() => {
    // The first client render must preserve the server seed even if localStorage disagrees.
    // Guard by key so StrictMode effect replay/router refresh can't reset a user's selection.
    if (previousKey.current === key) return
    const first = previousKey.current === undefined
    previousKey.current = key
    update(current => first && isThemeId(initialTheme) ? initialTheme : stored(key, account ? current : DEFAULT_THEME))
  }, [key, initialTheme])
  useLayoutEffect(() => {
    const root = document.documentElement
    root.classList.remove(...THEME_IDS)
    root.classList.add(theme)
    root.classList.toggle('dark', isDarkTheme(theme))
    if (persistCookie) {
      try { document.cookie = serializeThemeCookie(theme, window.location.protocol === 'https:') }
      catch { /* Cookies may be blocked; local/account theme selection still works. */ }
    }
  }, [theme, persistCookie])
  useEffect(() => {
    setStatus('idle')
    const apply = (value: ThemeId | null) => { const next = value ?? DEFAULT_THEME; update(next); persist(key, next) }
    const controller = account ? new ThemeSync(account.adapter, apply, setStatus) : null
    sync.current = controller
    void controller?.refresh()
    const refresh = () => { if (document.visibilityState === 'visible') void controller?.refresh() }
    const storage = (event: StorageEvent) => { if (!controller && event.key === key) update(stored(key)); else refresh() }
    window.addEventListener('focus', refresh)
    window.addEventListener('storage', storage)
    document.addEventListener('visibilitychange', refresh)
    const timer = controller ? window.setInterval(refresh, 60_000) : undefined
    return () => {
      controller?.dispose(); sync.current = null
      window.removeEventListener('focus', refresh); window.removeEventListener('storage', storage)
      document.removeEventListener('visibilitychange', refresh); window.clearInterval(timer)
    }
  }, [key, account?.adapter])
  function setTheme(id: ThemeId) {
    if (!isThemeId(id)) return
    if (sync.current) sync.current.select(id)
    else { update(id); persist(key, id) }
  }
  return <Context.Provider value={{ theme, setTheme, status, retry: () => sync.current?.retry(), synced: !!account }}>{children}</Context.Provider>
}

export function useTheme() {
  const context = useContext(Context)
  if (!context) throw new Error('useTheme must be inside @unishare-oss/unitheme ThemeProvider')
  return context
}

export function ThemePicker({ label = 'Theme' }: { label?: string }) {
  const { theme, setTheme, status, retry, synced } = useTheme()
  return <fieldset className="unicorp-theme-picker">
    <legend>{label}</legend>
    <div className="unicorp-theme-grid">
      {THEMES.map(t => <button key={t.id} type="button" aria-pressed={theme === t.id} onClick={() => setTheme(t.id)} className="unicorp-theme-option">
        <span className="unicorp-theme-preview" aria-hidden="true" style={{ background: t.bg, borderColor: t.border }}>
          <span className="unicorp-theme-sidebar" style={{ background: t.sidebar, borderColor: t.border }}>
            {[1, .5, .7].map((opacity, i) => <span key={i} style={{ background: t.accent, opacity }} />)}
          </span>
          <span className="unicorp-theme-content">
            <span style={{ background: t.text, opacity: .6 }} /><span style={{ background: t.text, opacity: .3 }} /><span style={{ background: t.accent }} />
          </span>
        </span>
        <span className="unicorp-theme-label">{t.label}<span aria-hidden="true" className="unicorp-theme-dot" /></span>
      </button>)}
    </div>
    <p role="status" className="unicorp-theme-status">{status === 'error' ? <>Could not sync your theme. <button type="button" onClick={retry}>Retry</button></> : status === 'saving' ? 'Saving your theme…' : status === 'loading' ? 'Loading your account theme…' : synced ? 'Saved across your UniCorp apps.' : 'Saved in this browser. Sign in to sync across apps.'}</p>
  </fieldset>
}
