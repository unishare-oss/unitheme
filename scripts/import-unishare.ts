// One-time importer. Subsequent palette edits belong in palettes.json, not UniShare.
const source = Bun.argv[2]
if (!source) throw new Error('Usage: bun scripts/import-unishare.ts <themes.css>')
const css = await Bun.file(source).text()
const labels: Record<string, string> = {
  unishare: 'UniShare', 'catppuccin-mocha': 'Catppuccin Mocha',
  'catppuccin-latte': 'Catppuccin Latte', nord: 'Nord', arctic: 'Arctic',
  'tokyo-night': 'Tokyo Night', dracula: 'Dracula', 'gruvbox-dark': 'Gruvbox Dark',
  'midnight-library': 'Midnight Library', parchment: 'Parchment',
  'ocean-depth': 'Ocean Depth', sakura: 'Sakura',
}
const light = new Set(['unishare', 'catppuccin-latte', 'arctic', 'parchment', 'sakura'])
const palettes = [...css.matchAll(/\.theme-([\w-]+)\s*\{([^}]+)\}/g)].map(([, name, body]) => ({
  id: `theme-${name}`, label: labels[name!], mode: light.has(name!) ? 'light' : 'dark',
  tokens: Object.fromEntries([...body!.matchAll(/--([\w-]+):\s*([^;]+);/g)].map(([, k, v]) => [k, v!.trim()])),
}))
if (palettes.length !== 12) throw new Error('Expected all 12 UniShare palettes')
await Bun.write(new URL('../palettes.json', import.meta.url), JSON.stringify(palettes, null, 2) + '\n')
