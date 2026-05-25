/**
 * /api/galactus/runs/[run_id]/cost
 *
 * Returns the cost snapshot for a Galactus run. Source-of-truth lives in
 * the Managed Agents API; this route is a bridge-snapshot stub that returns
 * a zeroed snapshot so the Budget/Cost panel renders without errors.
 *
 * TODO(p3-2): Proxy through to `${MANAGED_AGENTS_BASE}/runs/{run_id}/cost`
 *             and propagate the upstream `X-State-Source` header verbatim.
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth'
import { logger } from '@/lib/logger'

const log = logger.child({ name: 'api/galactus/runs/cost' })

interface RoleCost {
  tokens: number
  cost_usd: number
  calls: number
}

interface AnomalyAlert {
  lane_id: string
  pct_of_total: number
  severity: 'warn' | 'critical'
}

interface CostSnapshot {
  total_cost_usd: number
  budget_usd: number
  cost_pct: number
  breakdown: Record<string, RoleCost>
  anomalies: AnomalyAlert[]
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ run_id: string }> },
) {
  const auth = requireRole(request, 'viewer')
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const { run_id } = await params
  log.info({ run_id }, 'cost snapshot requested (bridge snapshot stub)')

  const body: CostSnapshot = {
    total_cost_usd: 0,
    budget_usd: 0,
    cost_pct: 0,
    breakdown: {},
    anomalies: [],
  }
  return NextResponse.json(body, {
    headers: { 'X-State-Source': 'bridge snapshot' },
  })
}
