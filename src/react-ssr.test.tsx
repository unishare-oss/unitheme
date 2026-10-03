import { expect, test } from 'bun:test'
import { renderToString } from 'react-dom/server'
import { ThemeProvider, useTheme } from './react.js'

function SelectedTheme() {
  const { theme } = useTheme()
  return <span>{theme}</span>
}

test('server rendering uses the supplied theme without a browser or bootstrap script', () => {
  expect(renderToString(<ThemeProvider initialTheme="theme-nord" persistCookie><SelectedTheme /></ThemeProvider>)).toBe('<span>theme-nord</span>')
})

test('existing browser-only integrations still server-render the default', () => {
  expect(renderToString(<ThemeProvider><SelectedTheme /></ThemeProvider>)).toBe('<span>theme-unishare</span>')
})
