/**
 * Unit tests for galactus-state-source.ts
 * Spec: MC-DASHBOARD-SPEC.md §State Source Legend
 */

import { describe, expect, it } from 'vitest'
import {
  classifySource,
  sourceColor,
  type StateSource,
} from '@/lib/galactus-state-source'

function withHeader(value?: string): Headers {
  const h = new Headers()
  if (value !== undefined) h.set('X-State-Source', value)
  return h
}

describe('classifySource', () => {
  it('returns "canonical" for "managed-agents-canonical"', () => {
    expect(classifySource(withHeader('managed-agents-canonical'))).toBe('canonical')
  })

  it('returns "SSS projection" for "sss-projection"', () => {
    expect(classifySource(withHeader('sss-projection'))).toBe('SSS projection')
  })

  it('returns "bridge snapshot" when header is absent', () => {
    expect(classifySource(withHeader(undefined))).toBe('bridge snapshot')
  })

  it('returns "bridge snapshot" for an unrecognised value', () => {
    expect(classifySource(withHeader('something-else'))).toBe('bridge snapshot')
  })
})

describe('sourceColor', () => {
  const cases: Array<[StateSource, string]> = [
    ['canonical', '#2ea043'],
    ['SSS projection', '#e3b341'],
    ['bridge snapshot', '#e07b2e'],
  ]
  for (const [src, hex] of cases) {
    it(`maps ${src} → ${hex}`, () => {
      expect(sourceColor(src)).toBe(hex)
    })
  }
})
