'use client'

import { createContext, useContext, useLayoutEffect, useState, useSyncExternalStore, type ReactNode } from 'react'
import { THEMES, type ThemeId } from './index.js'
import { createThemeStore, type ThemeAccount, type ThemeStatus } from './store.js'
import { connectThemeBrowser, createBrowserPersistence } from './browser.js'

const Context = createContext<{
  theme: ThemeId
  setTheme: (id: ThemeId) => void
  status: ThemeStatus
  retry: () => void
  syncEnabled: boolean
  /** Compatibility alias for syncEnabled; does not indicate save completion. */
  synced: boolean
} | null>(null)

/** Mount once. Account id must come from the app's verified session. */
export function ThemeProvider({ children, account, initialTheme, persistCookie = false }: {
  children: ReactNode
  account?: ThemeAccount
  /** Validated server-rendered theme. A seed, not a controlled prop. */
  initialTheme?: ThemeId
  persistCookie?: boolean
}) {
  const [store] = useState(() => createThemeStore({ initialTheme, account, persistence: createBrowserPersistence() }))
  const state = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getServerSnapshot)
  useLayoutEffect(() => {
    store.setAccount(account)
  }, [store, account?.id, account?.adapter])
  useLayoutEffect(() => connectThemeBrowser(store, { persistCookie }), [store, persistCookie])
  return <Context.Provider value={{
    theme: state.theme, status: state.status, setTheme: store.select, retry: store.retry,
    syncEnabled: state.syncEnabled, synced: state.syncEnabled,
  }}>{children}</Context.Provider>
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
