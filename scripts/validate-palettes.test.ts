import { expect, test } from 'bun:test'
import palettes from '../palettes.json'
import { validatePalettes } from './validate-palettes.js'

test('palette validation accepts reordered source and rejects broken catalogue contracts', () => {
  expect(() => validatePalettes([...palettes].reverse())).not.toThrow()
  for (const mutate of [
    (p: any[]) => { p[0].id = 'invalid id' },
    (p: any[]) => { p[1].id = p[0].id },
    (p: any[]) => { p[0].mode = 'auto' },
    (p: any[]) => { p[0].label = '' },
    (p: any[]) => { delete p[0].tokens.background },
    (p: any[]) => { p[0].tokens.primary = 'red; color: blue' },
    (p: any[]) => { p.shift() },
  ]) {
    const input = structuredClone(palettes)
    mutate(input)
    expect(() => validatePalettes(input)).toThrow()
  }
})
