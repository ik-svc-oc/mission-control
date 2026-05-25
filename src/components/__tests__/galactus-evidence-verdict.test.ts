/**
 * Unit tests for GalactusEvidencePanel's pure helpers.
 * Spec: MC-DASHBOARD-SPEC.md §Panel 2 — Verdict computation.
 *
 * Tests assert the two exported helpers from GalactusEvidencePanel.tsx:
 *   - computeVerdict()  → never returns "artifact attached"; only pass | fail | pending
 *   - isStale()         → true when entry.scope_epoch < run.scope_epoch
 */

import { describe, expect, it } from 'vitest'
import {
  computeVerdict,
  isStale,
  type EvidenceEntry,
} from '@/components/GalactusEvidencePanel'

function entry(over: Partial<EvidenceEntry>): EvidenceEntry {
  return {
    id: 'evt-1',
    kind: 'test_result',
    verification_status: 'machine_verified',
    storage_ref: 'evidence/test.txt',
    content_hash: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    produced_at: new Date().toISOString(),
    scope_epoch: 1,
    ...over,
  }
}

describe('computeVerdict', () => {
  it('returns "pass" for machine_verified + conclusion=success', () => {
    expect(
      computeVerdict(entry({ verification_status: 'machine_verified', payload: { conclusion: 'success' } })),
    ).toBe('pass')
  })

  it('returns "fail" for machine_verified + conclusion=failure', () => {
    expect(
      computeVerdict(entry({ verification_status: 'machine_verified', payload: { conclusion: 'failure' } })),
    ).toBe('fail')
  })

  it('returns "fail" for machine_verified + payload.fail=2', () => {
    expect(
      computeVerdict(entry({ verification_status: 'machine_verified', payload: { fail: 2 } })),
    ).toBe('fail')
  })

  it('returns "pass" for machine_verified + payload.pass=true', () => {
    expect(
      computeVerdict(entry({ verification_status: 'machine_verified', payload: { pass: true } })),
    ).toBe('pass')
  })

  it('returns "pending" for machine_verified with empty payload (no signal)', () => {
    expect(
      computeVerdict(entry({ verification_status: 'machine_verified', payload: {} })),
    ).toBe('pending')
  })

  it('returns "pass" for human_verified regardless of payload', () => {
    expect(
      computeVerdict(entry({ verification_status: 'human_verified', payload: undefined })),
    ).toBe('pass')
  })

  it('returns "pending" for self_reported', () => {
    expect(
      computeVerdict(entry({ verification_status: 'self_reported', payload: { conclusion: 'success' } })),
    ).toBe('pending')
  })

  it('never returns the literal string "artifact attached"', () => {
    const verdicts = [
      computeVerdict(entry({ verification_status: 'machine_verified' })),
      computeVerdict(entry({ verification_status: 'human_verified' })),
      computeVerdict(entry({ verification_status: 'self_reported' })),
    ]
    for (const v of verdicts) {
      expect(v).not.toBe('artifact attached')
      expect(['pass', 'fail', 'pending']).toContain(v)
    }
  })
})

describe('isStale', () => {
  it('returns true when entry.scope_epoch < currentScopeEpoch', () => {
    expect(isStale(entry({ scope_epoch: 0 }), 1)).toBe(true)
  })

  it('returns false when entry.scope_epoch === currentScopeEpoch', () => {
    expect(isStale(entry({ scope_epoch: 1 }), 1)).toBe(false)
  })

  it('returns false when entry.scope_epoch > currentScopeEpoch (future evidence)', () => {
    expect(isStale(entry({ scope_epoch: 2 }), 1)).toBe(false)
  })
})
