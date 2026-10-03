import { expect, test } from 'bun:test'
import { connectThemeBrowser, createBrowserPersistence, createThemeStore } from './index.js'

test('browser binding applies classes/cookies, handles events and fully cleans up on reconnect', async () => {
  const originals = ['window', 'document', 'localStorage'].map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)] as const)
  const classes = new Set(['app-root'])
  const values = new Map([['theme', 'theme-nord']])
  const storage = { getItem: (key: string) => values.get(key), setItem: (key: string, value: string) => { values.set(key, value) } }
  let poll: (() => void) | undefined
  const win = Object.assign(new EventTarget(), {
    localStorage: storage, location: { protocol: 'https:' },
    setInterval: (callback: () => void) => { poll = callback; timers++; return 1 }, clearInterval: () => { timers-- },
  })
  const doc = Object.assign(new EventTarget(), {
    visibilityState: 'visible', cookie: '',
    documentElement: { classList: {
      remove: (...names: string[]) => { names.forEach(name => classes.delete(name)) },
      add: (name: string) => { classes.add(name) },
      toggle: (name: string, on: boolean) => { if (on) classes.add(name); else classes.delete(name) },
    } },
  })
  let timers = 0
  let cleanup: (() => void) | undefined
  try {
    Object.defineProperties(globalThis, {
      window: { value: win, configurable: true }, document: { value: doc, configurable: true },
      localStorage: { value: storage, configurable: true },
    })
    const store = createThemeStore({ persistence: createBrowserPersistence() })
    cleanup = connectThemeBrowser(store, { persistCookie: true })
    expect(classes).toEqual(new Set(['app-root', 'theme-nord', 'dark']))
    expect(doc.cookie).toContain('unicorp-theme=theme-nord;')
    expect(doc.cookie).toContain('; Secure')
    store.select('theme-sakura')
    expect(classes).toEqual(new Set(['app-root', 'theme-sakura']))
    expect(values.get('theme')).toBe('theme-sakura')
    cleanup()
    expect(timers).toBe(0)
    values.set('theme', 'theme-dracula')
    win.dispatchEvent(Object.assign(new Event('storage'), { key: 'theme', storageArea: storage }))
    expect(store.getSnapshot().theme).toBe('theme-sakura')
    cleanup = connectThemeBrowser(store, { persistCookie: true })
    expect(timers).toBe(1)
    expect(store.getSnapshot().theme).toBe('theme-sakura')
    win.dispatchEvent(Object.assign(new Event('storage'), { key: 'theme', storageArea: storage }))
    expect(classes.has('theme-dracula')).toBe(true)
    let reads = 0
    store.setAccount({ id: 'account', adapter: {
      load: async () => { reads++; return null }, save: async () => {},
    } })
    await Promise.resolve()
    expect(reads).toBe(1)
    doc.visibilityState = 'hidden'
    win.dispatchEvent(new Event('focus'))
    poll?.()
    expect(reads).toBe(1)
    doc.visibilityState = 'visible'
    doc.dispatchEvent(new Event('visibilitychange'))
    await Promise.resolve()
    expect(reads).toBe(2)
    poll?.()
    await Promise.resolve()
    expect(reads).toBe(3)
    cleanup()
    win.dispatchEvent(new Event('focus'))
    doc.dispatchEvent(new Event('visibilitychange'))
    expect(reads).toBe(3)
    cleanup = undefined
    expect(timers).toBe(0)
  } finally {
    cleanup?.()
    for (const [key, descriptor] of originals) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor)
      else Reflect.deleteProperty(globalThis, key)
    }
  }
})
