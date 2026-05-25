/**
 * /api/galactus/runs/[run_id]/lanes
 *
 * Returns the lane roster for a Galactus run. Source-of-truth lives in the
 * Managed Agents API; this route is a bridge-snapshot stub that returns an
 * empty roster so the Active Lanes panel renders without errors.
 *
 * TODO(p3-2): Proxy through to `${MANAGED_AGENTS_BASE}/runs/{run_id}/lanes`
 *             and propagate the upstream `X-State-Source` header verbatim.
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth'
import { logger } from '@/lib/logger'

const log = logger.child({ name: 'api/galactus/runs/lanes' })

interface Lane {
  lane_id: string
  worktree_id?: string
  role: 'triager' | 'author' | 'reviewer' | 'orchestrator'
  current_slice_goal: string
  last_updated: string
  status:
    | 'in_progress'
    | 'complete'
    | 'blocked'
    | 'soft_block'
    | 'hard_block'
    | 'needs_operator'
    | 'timed_out'
    | 'abandoned'
  model?: string
}

interface LanesResponse {
  lanes: Lane[]
  scope_epoch: number
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ run_id: string }> },
) {
  const auth = requireRole(request, 'viewer')
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const { run_id } = await params
  log.info({ run_id }, 'lanes roster requested (bridge snapshot stub)')

  const body: LanesResponse = { lanes: [], scope_epoch: 1 }
  return NextResponse.json(body, {
    headers: { 'X-State-Source': 'bridge snapshot' },
  })
}
