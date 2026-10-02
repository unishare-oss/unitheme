import { expect, test } from 'bun:test'
import palettes from '../palettes.json'
import { DEFAULT_THEME, THEMES, THEME_IDS, isThemeId, isDarkTheme, createThemeAdapter } from './index'

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
