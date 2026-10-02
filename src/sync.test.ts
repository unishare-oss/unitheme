import { expect, test } from 'bun:test'
import { ThemeSync } from './sync'
import type { ThemeAdapter, ThemeId } from './index'

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (error: Error) => void
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no })
  return { promise, resolve, reject }
}
const tick = () => new Promise(resolve => queueMicrotask(resolve))

test('a stale account read cannot overwrite a new local selection', async () => {
  const read = deferred<ThemeId | null>()
  const applied: (ThemeId | null)[] = []
  const sync = new ThemeSync({ load: () => read.promise, save: async () => {} }, t => applied.push(t), () => {})
  const refresh = sync.refresh()
  sync.select('theme-nord')
  read.resolve('theme-sakura')
  await refresh
  expect(applied).toEqual(['theme-nord'])
})

test('serial writes coalesce rapid selections so newest intent wins', async () => {
  const first = deferred<void>()
  const writes: ThemeId[] = []
  const sync = new ThemeSync({ load: async () => null, save: async t => {
    writes.push(t)
    if (writes.length === 1) await first.promise
  } }, () => {}, () => {})
  sync.select('theme-nord'); sync.select('theme-sakura'); sync.select('theme-dracula')
  expect(writes).toEqual(['theme-nord'])
  first.resolve()
  await tick(); await tick()
  expect(writes).toEqual(['theme-nord', 'theme-dracula'])
})

test('failed writes keep the latest selection for retry, not a stale read', async () => {
  let fail = true
  const states: string[] = []
  const writes: ThemeId[] = []
  const sync = new ThemeSync({ load: async () => 'theme-sakura', save: async t => {
    writes.push(t); if (fail) throw new Error('offline')
  } }, () => {}, s => states.push(s))
  sync.select('theme-nord')
  await tick()
  expect(states.at(-1)).toBe('error')
  await sync.refresh()
  expect(states.at(-1)).toBe('error')
  fail = false
  sync.retry()
  await tick(); await tick()
  expect(writes).toEqual(['theme-nord', 'theme-nord'])
  expect(states.at(-1)).toBe('idle')
})

test('account switch/unmount aborts sync and ignores old responses', async () => {
  const read = deferred<ThemeId | null>()
  const applied: unknown[] = []
  let signal: AbortSignal | undefined
  const adapter: ThemeAdapter = { load: s => { signal = s; return read.promise }, save: async () => {} }
  const sync = new ThemeSync(adapter, t => applied.push(t), () => {})
  const loading = sync.refresh()
  sync.dispose()
  read.resolve('theme-nord')
  await loading
  expect(signal?.aborted).toBe(true)
  expect(applied).toEqual([])
})
