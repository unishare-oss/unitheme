import { THEMES } from './themes.generated.js'
export { THEMES }
export type ThemeId = (typeof THEMES)[number]['id']
export type ThemeOption = (typeof THEMES)[number]
export const DEFAULT_THEME: ThemeId = 'theme-unishare'
export const THEME_IDS = THEMES.map((t) => t.id)
export function isThemeId(value: unknown): value is ThemeId {
  return typeof value === 'string' && THEMES.some((t) => t.id === value)
}
export function isDarkTheme(value: unknown): boolean {
  return THEMES.some((t) => t.id === value && t.mode === 'dark')
}

/** Insert in the document head before paint. Only fixed catalogue values are interpolated. */
export const THEME_BOOTSTRAP = `try{var t=localStorage.getItem('theme');var ids=${JSON.stringify(THEME_IDS)};if(!ids.includes(t))t='${DEFAULT_THEME}';var r=document.documentElement;r.classList.remove(...ids);r.classList.add(t);r.classList.toggle('dark',${JSON.stringify(THEMES.filter(t => t.mode === 'dark').map(t => t.id))}.includes(t))}catch{}`

export interface ThemeAdapter {
  load(signal: AbortSignal): Promise<ThemeId | null>
  save(theme: ThemeId, signal: AbortSignal): Promise<void>
}

/** Same-origin only: apps proxy to UniAuth using their server-held OAuth credentials. */
export function createThemeAdapter(endpoint: string, envelope = false): ThemeAdapter {
  if (!endpoint.startsWith('/') || endpoint.startsWith('//')) throw new Error('Use a same-origin theme endpoint')
  async function request(signal: AbortSignal, theme?: ThemeId) {
    const response = await fetch(endpoint, {
      method: theme ? 'POST' : 'GET', credentials: 'same-origin', cache: 'no-store', signal,
      ...(theme ? { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ theme }) } : {}),
    })
    if (!response.ok) throw new Error('Could not sync your theme. Try again.')
    const json = await response.json()
    const data = envelope ? json.data : json
    if (!data || (data.theme !== null && !isThemeId(data.theme))) throw new Error('Invalid theme response')
    return data.theme as ThemeId | null
  }
  return { load: (signal) => request(signal), save: async (theme, signal) => { await request(signal, theme) } }
}
