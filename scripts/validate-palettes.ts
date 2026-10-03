import { DEFAULT_THEME_ID } from '../src/defaults.js'

const requiredTokens = [
  "background",
  "foreground",
  "card",
  "card-foreground",
  "popover",
  "popover-foreground",
  "primary",
  "primary-foreground",
  "secondary",
  "secondary-foreground",
  "muted",
  "muted-foreground",
  "accent",
  "accent-foreground",
  "destructive",
  "destructive-foreground",
  "border",
  "input",
  "ring",
  "chart-1",
  "chart-2",
  "chart-3",
  "chart-4",
  "chart-5",
  "sidebar",
  "sidebar-foreground",
  "sidebar-primary",
  "sidebar-primary-foreground",
  "sidebar-accent",
  "sidebar-accent-foreground",
  "sidebar-border",
  "sidebar-ring",
  "text-secondary",
  "text-muted",
  "amber",
  "amber-hover",
  "amber-subtle",
  "success",
  "info",
  "surface-dark",
  "card-dark",
  "shadow-color",
  "border-strong",
  "type-note",
  "type-exam",
  "type-exercise"
] as const
export interface Palette {
  id: string
  label: string
  mode: 'light' | 'dark'
  tokens: Record<string, string>
}

export function validatePalettes(input: unknown): asserts input is Palette[] {
  if (!Array.isArray(input) || input.length === 0) throw new Error('Expected a nonempty palette array')
  const ids = new Set<string>()
  for (const palette of input) {
    if (!palette || typeof palette.id !== 'string' || !/^theme-[a-z0-9]+(?:-[a-z0-9]+)*$/.test(palette.id)) {
      throw new Error('Invalid palette id')
    }
    if (ids.has(palette.id)) throw new Error(`Duplicate palette: ${palette.id}`)
    ids.add(palette.id)
    if (typeof palette.label !== 'string' || !palette.label.trim()) throw new Error(`Missing label: ${palette.id}`)
    if (palette.mode !== 'light' && palette.mode !== 'dark') throw new Error(`Invalid mode: ${palette.id}`)
    const tokens = palette.tokens
    if (!tokens || typeof tokens !== 'object' || Array.isArray(tokens)) throw new Error(`Invalid tokens: ${palette.id}`)
    for (const token of requiredTokens) {
      if (!(token in tokens)) throw new Error(`Missing token ${token}: ${palette.id}`)
    }
    for (const [key, value] of Object.entries(tokens)) {
      if (!/^[a-z][a-z0-9-]*$/.test(key) || typeof value !== 'string' || !value.trim() || /[;{}]/.test(value)) {
        throw new Error(`Invalid token ${key}: ${palette.id}`)
      }
    }
    const expected = Object.keys(input[0].tokens).sort().join(',')
    if (Object.keys(tokens).sort().join(',') !== expected) throw new Error(`Inconsistent tokens: ${palette.id}`)
  }
  if (!ids.has(DEFAULT_THEME_ID)) throw new Error(`Missing default palette: ${DEFAULT_THEME_ID}`)
}
