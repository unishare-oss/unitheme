import { expect, test } from 'bun:test'
import palettes from '../palettes.json'
import { DEFAULT_THEME, THEMES, THEME_IDS, THEME_COOKIE, isThemeId, isDarkTheme, resolveTheme, serializeThemeCookie, createThemeAdapter, type ThemeId } from './index'

test('catalogue contains all twelve unique palettes and preview values match tokens', () => {
  expect(THEMES).toHaveLength(12)
  expect(new Set(THEME_IDS).size).toBe(12)
  expect(isThemeId(DEFAULT_THEME)).toBe(true)
  for (const palette of palettes) {
    const theme = THEMES.find(t => t.id === palette.id)!
    expect(theme.bg).toBe(palette.tokens.background)
    expect(theme.accent).toBe(palette.tokens.primary)
    expect(isDarkTheme(theme.id)).toBe(palette.mode === 'dark')
    expect(Object.keys(palette.tokens).sort()).toEqual(Object.keys(palettes[0]!.tokens).sort())
  }
})
test('rejects unrecognised ids and cross-origin endpoints', () => {
  for (const id of ['dark', 'system', 'theme-missing', null, {}, '<script>']) expect(isThemeId(id)).toBe(false)
  expect(() => createThemeAdapter('https://auth.example.com/theme')).toThrow()
  expect(() => createThemeAdapter('//auth.example.com/theme')).toThrow()
})

test('server theme values are allowlisted rather than interpolated unchecked', () => {
  expect(resolveTheme('theme-nord')).toBe('theme-nord')
  for (const value of [undefined, 'dark', 'theme-fake', 'theme-nord dark', '<script>', null]) {
    expect(resolveTheme(value)).toBe(DEFAULT_THEME)
  }
})

test('display cookie is host-only, SameSite Lax and Secure on HTTPS', () => {
  const cookie = serializeThemeCookie('theme-nord', true)
  expect(cookie).toBe(`${THEME_COOKIE}=theme-nord; Path=/; Max-Age=31536000; SameSite=Lax; Secure`)
  expect(cookie).not.toContain('Domain=')
  expect(cookie).not.toContain('HttpOnly')
  expect(serializeThemeCookie('theme-sakura')).not.toContain('Secure')
  expect(() => serializeThemeCookie('theme-nord; Domain=example.com' as ThemeId)).toThrow()
})
