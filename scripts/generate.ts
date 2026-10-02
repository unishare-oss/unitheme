import palettes from '../palettes.json'
const css = palettes.map((p, i) => `${i === 0 ? ':root, ' : ''}.${p.id} {\n  color-scheme: ${p.mode};\n${Object.entries(p.tokens).map(([k, v]) => `  --${k}: ${v};`).join('\n')}\n}`).join('\n\n')
await Bun.write(new URL('../dist/themes.css', import.meta.url), css + '\n')
const metadata = palettes.map(({ id, label, mode, tokens: t }) => ({
  id, label, mode, bg: t.background, card: t.card, sidebar: t.sidebar,
  text: t.foreground, accent: t.primary, border: t.border,
}))
await Bun.write(new URL('../src/themes.generated.ts', import.meta.url),
  '// Generated from palettes.json. Do not edit.\nexport const THEMES = ' + JSON.stringify(metadata, null, 2) + ' as const\n')
