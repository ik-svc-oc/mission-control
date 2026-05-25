/**
 * galactus-state-source.ts
 *
 * Classifies the data-source tier for each Managed Agents API response and
 * provides colour coding for the State Source badge that appears on every
 * Galactus dashboard panel.
 *
 * Authoritative spec: MC-DASHBOARD-SPEC.md §State Source Legend
 */

export type StateSource = 'canonical' | 'SSS projection' | 'bridge snapshot'

export interface StateFreshness {
  source: StateSource
  fetched_at: Date
  /** Round-trip latency in milliseconds, when available */
  lag_ms?: number
}

/**
 * Inspect the `X-State-Source` response header and return the appropriate
 * StateSource tier.
 *
 * Header values:
 *   "managed-agents-canonical" → "canonical"
 *   "sss-projection"           → "SSS projection"
 *   anything else (or absent)  → "bridge snapshot"
 */
export function classifySource(headers: Headers): StateSource {
  const raw = headers.get('X-State-Source') ?? ''
  if (raw === 'managed-agents-canonical') return 'canonical'
  if (raw === 'sss-projection') return 'SSS projection'
  return 'bridge snapshot'
}

/** Hex colour for the State Source badge. */
export function sourceColor(source: StateSource): string {
  const colors: Record<StateSource, string> = {
    canonical: '#2ea043',
    'SSS projection': '#e3b341',
    'bridge snapshot': '#e07b2e',
  }
  return colors[source]
}

/**
 * Build a StateFreshness record from a completed fetch response.
 * Pass `start` as the timestamp taken just before the fetch() call so
 * lag_ms can be computed accurately.
 */
export function buildFreshness(headers: Headers, start: Date): StateFreshness {
  return {
    source: classifySource(headers),
    fetched_at: new Date(),
    lag_ms: Date.now() - start.getTime(),
  }
}

/** Format the "as of X" freshness string shown inside the badge. */
export function formatFreshness(freshness: StateFreshness): string {
  const now = Date.now()
  const diffMs = now - freshness.fetched_at.getTime()
  if (diffMs < 5_000) return 'as of just now'
  if (diffMs < 60_000) return `as of ${Math.round(diffMs / 1_000)}s ago`
  if (diffMs < 3_600_000) return `as of ${Math.round(diffMs / 60_000)}m ago`
  return `as of ${freshness.fetched_at.toLocaleTimeString()}`
}
