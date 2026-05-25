/**
 * /api/mem0/[id]
 *
 * PATCH { action: 'approve' | 'reject' | 'defer' }
 *
 * Records a trajectory decision for a mem0 candidate identified by [id].
 * Decisions must be written back to mem0 via mcp__mem0__add so they persist
 * across sessions. Mission Control never modifies Managed Agents run state;
 * this endpoint is the sole write path and touches only mem0.
 *
 * Returns: { ok: true, action, id, recorded_at } once MCP writing is wired.
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth'
import { logger } from '@/lib/logger'

const log = logger.child({ name: 'api/mem0/[id]' })

export type TrajectoryAction = 'approve' | 'reject' | 'defer'

interface PatchBody {
  action: TrajectoryAction
}

interface PatchResponse {
  ok: true
  action: TrajectoryAction
  id: string
  recorded_at: string
}

/**
 * Thin wrapper around mcp__mem0__add.
 *
 * In production, this invokes the MCP tool via the installed MCP client
 * (e.g. `@modelcontextprotocol/sdk`). For now we define the interface and
 * log the call; the real implementation is wired up when the MCP server is
 * available in the deployment environment.
 *
 * The memory text written encodes the decision so it can be retrieved by
 * querying mem0 with the candidate id or action keyword.
 */
async function mcpMem0Add(id: string, action: TrajectoryAction): Promise<boolean> {
  // TODO(p6-3): Wire to real mcp__mem0__add when MCP client is available.
  // The interface contract:
  //   mcp__mem0__add({
  //     messages: [{ role: 'system', content: `trajectory:${action}:${id}` }]
  //   }) → { id: string }
  log.info({ action, candidateIdLength: id.length }, 'mcpMem0Add unavailable')
  return false
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = requireRole(request, 'operator')
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const { id: rawId } = await params
  const id = rawId.trim()

  if (!id || id.length > 200 || /[\x00-\x1F\x7F]/.test(id)) {
    return NextResponse.json({ error: 'missing id' }, { status: 400 })
  }

  let body: PatchBody
  try {
    body = (await request.json()) as PatchBody
  } catch {
    return NextResponse.json({ error: 'invalid JSON body' }, { status: 400 })
  }

  const { action } = body
  if (action !== 'approve' && action !== 'reject' && action !== 'defer') {
    return NextResponse.json(
      { error: `invalid action "${action}"; must be approve | reject | defer` },
      { status: 422 }
    )
  }

  try {
    const recorded = await mcpMem0Add(id, action)
    if (!recorded) {
      return NextResponse.json({ error: 'mem0 MCP write is not configured' }, { status: 501 })
    }

    const recorded_at = new Date().toISOString()
    log.info({ action, recorded_at, candidateIdLength: id.length }, 'trajectory decision recorded')
    const response: PatchResponse = { ok: true, action, id, recorded_at }
    return NextResponse.json(response)
  } catch (err) {
    log.error({ err, action, candidateIdLength: id.length }, 'mem0 add failed')
    return NextResponse.json({ error: 'mem0 update failed' }, { status: 500 })
  }
}
