'use client'

/**
 * GalactusBudgetCostPanel — Panel 6: Budget / Cost Monitor
 *
 * Authoritative spec: MC-DASHBOARD-SPEC.md §Panel 6
 *
 * Rules:
 *  - Source: /api/galactus/runs/{run_id}/cost
 *  - Refresh every 30s
 *  - Progress bar colours: green <60%, yellow 60–80%, red >80%
 *  - At cost_pct ≥ 80 show red banner "Budget exceeded 80% — Claude Code interrupt armed"
 *  - Anomaly = single lane consuming > 30% of total budget (yellow); > 50% (red/critical)
 */

import { useCallback, useEffect, useState } from 'react'
import { createClientLogger } from '@/lib/client-logger'
import {
  classifySource,
  formatFreshness,
  sourceColor,
  type StateFreshness,
} from '@/lib/galactus-state-source'

const log = createClientLogger('GalactusBudgetCostPanel')

// ─── Types ────────────────────────────────────────────────────────────────────

export interface RoleCost {
  tokens: number
  cost_usd: number
  calls: number
}

export interface AnomalyAlert {
  lane_id: string
  pct_of_total: number // 0–1
  severity: 'warn' | 'critical'
}

export interface CostSnapshot {
  total_cost_usd: number
  budget_usd: number
  cost_pct: number // 0–100
  breakdown: Record<string, RoleCost>
  anomalies?: AnomalyAlert[]
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function barColor(pct: number): string {
  if (pct < 60) return '#2ea043'
  if (pct < 80) return '#e3b341'
  return '#da3633'
}

function anomalyColor(severity: AnomalyAlert['severity']): string {
  return severity === 'critical' ? '#da3633' : '#e3b341'
}

function fmtUsd(n: number): string {
  return `$${n.toFixed(4)}`
}

function fmtTokens(n: number): string {
  return n.toLocaleString()
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StateSourceBadge({ freshness }: { freshness: StateFreshness | null }) {
  if (!freshness) return null
  return (
    <span
      style={{
        fontSize: '0.72rem',
        color: '#fff',
        background: sourceColor(freshness.source),
        borderRadius: '4px',
        padding: '2px 7px',
      }}
    >
      {freshness.source} · {formatFreshness(freshness)}
    </span>
  )
}

function ProgressBar({ pct }: { pct: number }) {
  const clamped = Math.max(0, Math.min(100, pct))
  return (
    <div
      style={{
        width: '100%',
        height: '10px',
        background: '#21262d',
        borderRadius: '4px',
        overflow: 'hidden',
        marginTop: '4px',
      }}
    >
      <div
        style={{
          width: `${clamped}%`,
          height: '100%',
          background: barColor(clamped),
          transition: 'width 0.4s ease',
        }}
      />
    </div>
  )
}

function BudgetExceededBanner() {
  return (
    <div
      style={{
        background: '#1c0a0a',
        border: '1px solid #da3633',
        borderRadius: '4px',
        padding: '8px 12px',
        color: '#da3633',
        marginBottom: '10px',
        fontWeight: 600,
        fontSize: '0.82rem',
      }}
    >
      ⚠ Budget exceeded 80% — Claude Code interrupt armed
    </div>
  )
}

interface BreakdownTableProps {
  breakdown: Record<string, RoleCost>
}

function BreakdownTable({ breakdown }: BreakdownTableProps) {
  const rows = Object.entries(breakdown)
  if (rows.length === 0) {
    return (
      <div style={{ color: '#6e7681', fontStyle: 'italic', fontSize: '0.78rem', marginTop: '8px' }}>
        No per-role cost breakdown yet.
      </div>
    )
  }
  return (
    <div style={{ marginTop: '12px' }}>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1.2fr 1fr 1fr 0.8fr',
          gap: '10px',
          color: '#6e7681',
          fontSize: '0.72rem',
          textTransform: 'uppercase',
          paddingBottom: '4px',
          borderBottom: '1px solid #30363d',
        }}
      >
        <span>Role</span>
        <span>Tokens</span>
        <span>Cost (USD)</span>
        <span>Calls</span>
      </div>
      {rows.map(([role, cost]) => (
        <div
          key={role}
          style={{
            display: 'grid',
            gridTemplateColumns: '1.2fr 1fr 1fr 0.8fr',
            gap: '10px',
            padding: '5px 0',
            borderBottom: '1px solid #21262d',
            fontSize: '0.82rem',
            color: '#c9d1d9',
          }}
        >
          <span>{role}</span>
          <span>{fmtTokens(cost.tokens)}</span>
          <span>{fmtUsd(cost.cost_usd)}</span>
          <span>{cost.calls}</span>
        </div>
      ))}
    </div>
  )
}

function AnomalyList({ anomalies }: { anomalies: AnomalyAlert[] }) {
  if (anomalies.length === 0) return null
  return (
    <div style={{ marginTop: '12px' }}>
      <div
        style={{
          color: '#6e7681',
          fontSize: '0.72rem',
          textTransform: 'uppercase',
          marginBottom: '4px',
        }}
      >
        Anomalies
      </div>
      {anomalies.map((a) => (
        <div
          key={a.lane_id}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '3px 0',
            fontSize: '0.82rem',
            color: '#c9d1d9',
          }}
        >
          <span
            aria-hidden
            style={{
              display: 'inline-block',
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              background: anomalyColor(a.severity),
            }}
          />
          <code style={{ color: '#c9d1d9', background: '#010409', padding: '1px 4px', borderRadius: '3px' }}>
            {a.lane_id}
          </code>
          <span style={{ color: '#8b949e' }}>
            consuming {Math.round(a.pct_of_total * 100)}% of total ({a.severity})
          </span>
        </div>
      ))}
    </div>
  )
}

// ─── Main Panel ───────────────────────────────────────────────────────────────

interface GalactusBudgetCostPanelProps {
  runId: string
  apiBase?: string
}

const EMPTY_SNAPSHOT: CostSnapshot = {
  total_cost_usd: 0,
  budget_usd: 0,
  cost_pct: 0,
  breakdown: {},
  anomalies: [],
}

export function GalactusBudgetCostPanel({ runId, apiBase = '' }: GalactusBudgetCostPanelProps) {
  const [snapshot, setSnapshot] = useState<CostSnapshot>(EMPTY_SNAPSHOT)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [freshness, setFreshness] = useState<StateFreshness | null>(null)

  const fetchCost = useCallback(async () => {
    const start = new Date()
    try {
      const res = await fetch(`${apiBase}/api/galactus/runs/${encodeURIComponent(runId)}/cost`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = (await res.json()) as CostSnapshot
      setSnapshot({
        total_cost_usd: data.total_cost_usd ?? 0,
        budget_usd: data.budget_usd ?? 0,
        cost_pct: data.cost_pct ?? 0,
        breakdown: data.breakdown ?? {},
        anomalies: data.anomalies ?? [],
      })
      setFreshness({
        source: classifySource(res.headers),
        fetched_at: new Date(),
        lag_ms: Date.now() - start.getTime(),
      })
      setError(null)
    } catch (err) {
      log.error('fetch cost failed', err)
      setSnapshot(EMPTY_SNAPSHOT)
      setFreshness(null)
      setError(String(err))
    } finally {
      setLoading(false)
    }
  }, [runId, apiBase])

  useEffect(() => {
    setSnapshot(EMPTY_SNAPSHOT)
    setFreshness(null)
    setError(null)
    setLoading(true)
    void fetchCost()
    const interval = setInterval(fetchCost, 30_000)
    return () => clearInterval(interval)
  }, [fetchCost])

  const exceeded = snapshot.cost_pct >= 80
  const isBridgeSnapshot = freshness?.source === 'bridge snapshot'

  return (
    <div
      style={{
        background: '#161b22',
        border: '1px solid #30363d',
        borderRadius: '6px',
        padding: '16px',
        fontFamily: "'SF Mono', 'Fira Code', monospace",
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '12px',
        }}
      >
        <h3 style={{ color: '#79c0ff', fontSize: '0.95rem', margin: 0 }}>
          Panel 6: Budget / Cost Monitor
        </h3>
        <StateSourceBadge freshness={freshness} />
      </div>

      {/* Budget banner */}
      {exceeded && <BudgetExceededBanner />}

      {/* Loading / error states */}
      {loading && <div style={{ color: '#8b949e' }}>Loading cost…</div>}
      {error && <div style={{ color: '#da3633' }}>Error: {error}</div>}
      {!loading && !error && isBridgeSnapshot && (
        <div style={{ color: '#8b949e', fontStyle: 'italic', fontSize: '0.82rem', marginBottom: '10px' }}>
          Bridge snapshot stub active; upstream budget telemetry is not wired yet.
        </div>
      )}

      {/* Main summary */}
      {!loading && !error && (
        <div>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'baseline',
              fontSize: '0.85rem',
              color: '#c9d1d9',
            }}
          >
            <span>
              <span style={{ color: '#8b949e' }}>Total:</span>{' '}
              <strong>{fmtUsd(snapshot.total_cost_usd)}</strong>
            </span>
            <span>
              <span style={{ color: '#8b949e' }}>Budget:</span>{' '}
              <strong>{fmtUsd(snapshot.budget_usd)}</strong>
            </span>
            <span style={{ color: barColor(snapshot.cost_pct), fontWeight: 600 }}>
              {snapshot.cost_pct.toFixed(1)}%
            </span>
          </div>
          <ProgressBar pct={snapshot.cost_pct} />

          <BreakdownTable breakdown={snapshot.breakdown} />
          <AnomalyList anomalies={snapshot.anomalies ?? []} />
        </div>
      )}
    </div>
  )
}
