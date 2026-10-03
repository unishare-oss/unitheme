import { expect, test } from 'bun:test'
import { createThemeStore, DEFAULT_THEME, type ThemeId, type ThemePersistence } from './index.js'

const tick = async () => { await Promise.resolve(); await Promise.resolve(); await Promise.resolve() }
function memory(values: Record<string, string> = {}): ThemePersistence {
  return { read: key => values[key], write: (key, value) => { values[key] = value } }
}
function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (error: Error) => void
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no })
  return { promise, resolve, reject }
}

test('construction is inert, snapshots stable, SSR seed wins over browser storage once', () => {
  let reads = 0
  const store = createThemeStore({ initialTheme: 'theme-nord', persistence: {
    read: () => { reads++; return 'theme-sakura' }, write: () => {},
  } })
  const server = store.getServerSnapshot()
  expect(reads).toBe(0)
  expect(store.getSnapshot()).toBe(server)
  store.start()
  expect(store.getSnapshot().theme).toBe('theme-nord')
  store.select('theme-dracula')
  store.dispose()
  store.start()
  expect(store.getSnapshot().theme).toBe('theme-dracula')
  expect(store.getServerSnapshot()).toBe(server)
  expect(server.theme).toBe('theme-nord')
  store.dispose()
})

test('legacy migration, selection, external changes and storage clear share one policy', () => {
  const values = { theme: 'theme-sakura' }
  const store = createThemeStore({ persistence: memory(values) })
  let notifications = 0
  const unsubscribe = store.subscribe(() => { notifications++ })
  store.start()
  expect(store.getSnapshot().theme).toBe('theme-sakura')
  const snapshot = store.getSnapshot()
  store.select('theme-sakura')
  expect(store.getSnapshot()).toBe(snapshot)
  store.select('theme-nord')
  expect(values.theme).toBe('theme-nord')
  values.theme = 'theme-dracula'
  store.storageChanged('unrelated')
  expect(store.getSnapshot().theme).toBe('theme-nord')
  store.storageChanged('theme')
  expect(store.getSnapshot().theme).toBe('theme-dracula')
  values.theme = ''
  store.storageChanged(null)
  expect(store.getSnapshot().theme).toBe(DEFAULT_THEME)
  unsubscribe()
  const count = notifications
  store.select('theme-nord')
  expect(notifications).toBe(count)
  store.dispose()
})

test('blocked persistence does not prevent selection', () => {
  const store = createThemeStore({ persistence: {
    read: () => { throw new Error('blocked') }, write: () => { throw new Error('blocked') },
  } })
  store.start()
  expect(store.getSnapshot().theme).toBe(DEFAULT_THEME)
  store.select('theme-nord')
  expect(store.getSnapshot().theme).toBe('theme-nord')
  store.dispose()
})

test('account switches isolate caches, cancel old reads and restore guest choice on logout', async () => {
  const oldRead = deferred<ThemeId | null>()
  const nextRead = deferred<ThemeId | null>()
  let oldSignal: AbortSignal | undefined
  const values = { theme: 'theme-sakura', 'unicorp-theme:user:b': 'theme-dracula' }
  const store = createThemeStore({ persistence: memory(values) })
  store.start()
  store.setAccount({ id: 'a', adapter: { load: signal => { oldSignal = signal; return oldRead.promise }, save: async () => {} } })
  expect(store.getSnapshot().theme).toBe(DEFAULT_THEME)
  store.setAccount({ id: 'b', adapter: { load: () => nextRead.promise, save: async () => {} } })
  expect(oldSignal?.aborted).toBe(true)
  expect(store.getSnapshot().theme).toBe('theme-dracula')
  oldRead.resolve('theme-nord')
  await tick()
  expect(store.getSnapshot().theme).toBe('theme-dracula')
  nextRead.resolve(null)
  await tick()
  expect(store.getSnapshot().theme).toBe(DEFAULT_THEME)
  expect(values['unicorp-theme:user:b']).toBe(DEFAULT_THEME)
  store.setAccount()
  expect(store.getSnapshot()).toMatchObject({ theme: 'theme-sakura', accountId: null, syncEnabled: false, pendingTheme: null })
  store.dispose()
})

test('failed latest intent survives lifecycle reconnect and is retried before reading', async () => {
  const write = deferred<void>()
  const writes: ThemeId[] = []
  let reads = 0
  const store = createThemeStore({ account: { id: 'a', adapter: {
    load: async () => { reads++; return null },
    save: async theme => { writes.push(theme); if (writes.length === 1) await write.promise },
  } } })
  store.start()
  await tick()
  store.select('theme-nord')
  store.select('theme-sakura')
  write.reject(new Error('offline'))
  await tick()
  expect(store.getSnapshot()).toMatchObject({ theme: 'theme-sakura', pendingTheme: 'theme-sakura', status: 'error' })
  store.dispose()
  store.start()
  await tick()
  expect(writes).toEqual(['theme-nord', 'theme-sakura'])
  expect(reads).toBe(1)
  expect(store.getSnapshot()).toMatchObject({ pendingTheme: null, status: 'idle' })
  store.dispose()
})

test('switching accounts drops pending intent without writing it to the new account', async () => {
  const writes: ThemeId[] = []
  const store = createThemeStore({ account: { id: 'a', adapter: { load: async () => null, save: () => new Promise(() => {}) } } })
  store.start()
  store.select('theme-nord')
  store.setAccount({ id: 'b', adapter: { load: async () => null, save: async t => { writes.push(t) } } })
  await tick()
  expect(writes).toEqual([])
  expect(store.getSnapshot()).toMatchObject({ theme: DEFAULT_THEME, pendingTheme: null, accountId: 'b' })
  store.dispose()
})

test('adapter replacement for the same identity preserves intent and ignores disposed completions', async () => {
  const oldWrite = deferred<void>()
  const nextWrite = deferred<void>()
  const writes: ThemeId[] = []
  const store = createThemeStore({ account: { id: 'a', adapter: {
    load: async () => null, save: () => oldWrite.promise,
  } } })
  store.start()
  store.select('theme-nord')
  store.setAccount({ id: 'a', adapter: {
    load: async () => null,
    save: theme => { writes.push(theme); return nextWrite.promise },
  } })
  oldWrite.resolve()
  await tick()
  expect(store.getSnapshot()).toMatchObject({ theme: 'theme-nord', status: 'saving', pendingTheme: 'theme-nord' })
  expect(writes).toEqual(['theme-nord'])
  nextWrite.resolve()
  await tick()
  expect(store.getSnapshot()).toMatchObject({ status: 'idle', pendingTheme: null })
  store.dispose()
})
