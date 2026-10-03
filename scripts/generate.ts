import palettes from '../palettes.json'
import { DEFAULT_THEME_ID } from '../src/defaults.js'
import { validatePalettes } from './validate-palettes.js'

validatePalettes(palettes)
const block = (selector: string, p: (typeof palettes)[number]) =>
  `${selector} {\n  color-scheme: ${p.mode};\n${Object.entries(p.tokens).map(([k, v]) => `  --${k}: ${v};`).join('\n')}\n}`
// Root defaults come first so explicit classes win regardless of catalogue ordering.
const defaultPalette = palettes.find(p => p.id === DEFAULT_THEME_ID)!
const css = [block(':root', defaultPalette), ...palettes.map(p => block(`.${p.id}`, p))].join('\n\n')
await Bun.write(new URL('../dist/themes.css', import.meta.url), css + '\n')
const metadata = palettes.map(({ id, label, mode, tokens: t }) => ({
  id, label, mode, bg: t.background, card: t.card, sidebar: t.sidebar,
  text: t.foreground, accent: t.primary, border: t.border,
}))
await Bun.write(new URL('../src/themes.generated.ts', import.meta.url),
  '// Generated from palettes.json. Do not edit.\nexport const THEMES = ' + JSON.stringify(metadata, null, 2) + ' as const\n')
