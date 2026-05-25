/**
 * /api/mem0/search
 *
 * GET ?query=promoted:false
 *
 * Server-side proxy to mcp__mem0__search. Mission Control never calls mem0
 * directly from the client; this server route isolates the MCP dependency.
 *
 * Returns: { results: TrajectoryCandidate[], bridge_snapshot: boolean }
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth'
import { logger } from '@/lib/logger'

const log = logger.child({ name: 'api/mem0/search' })
const TRAJECTORY_PENDING_QUERY = 'promoted:false'

/**
 * Thin wrapper around mcp__mem0__search.
 *
 * In production, this would invoke the MCP tool via the installed MCP client
 * (e.g. `@modelcontextprotocol/sdk`). For now we define the interface and
 * return a typed empty result so the panel compiles and behaves correctly;
 * the real implementation is wired up when the MCP server is available in
 * the deployment environment.
 */
async function mcpMem0Search(query: string): Promise<unknown[]> {
  // TODO(p6-3): Wire to real mcp__mem0__search when MCP client is available.
  // The interface contract:
  //   mcp__mem0__search({ query }) → { results: Array<{ id, memory, metadata }> }
  log.info({ filter: 'trajectory-pending' }, 'mcpMem0Search called')
  return []
}

export async function GET(request: NextRequest) {
  const auth = requireRole(request, 'viewer')
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const query = request.nextUrl.searchParams.get('query')?.trim() || TRAJECTORY_PENDING_QUERY
  if (query !== TRAJECTORY_PENDING_QUERY) {
    return NextResponse.json({ error: 'unsupported mem0 search query' }, { status: 400 })
  }

  try {
    const raw = await mcpMem0Search(query)
    // Normalise mem0 result shape into TrajectoryCandidate shape
    const results = raw.map((item: any) => ({
      id: item.id ?? item.memory_id ?? '',
      category: item.metadata?.category ?? 'pattern',
      description: item.memory ?? item.text ?? '',
      supporting_run_ids: item.metadata?.supporting_run_ids ?? [],
      recurrence_count: item.metadata?.recurrence_count ?? 1,
      suggested_action: item.metadata?.suggested_action ?? null,
      promoted: item.metadata?.promoted ?? false,
      rejected: item.metadata?.rejected ?? false,
    }))
    return NextResponse.json(
      { results, bridge_snapshot: true },
      { headers: { 'X-State-Source': 'bridge snapshot' } },
    )
  } catch (err) {
    log.error({ err }, 'mem0 search failed')
    return NextResponse.json({ error: 'mem0 search failed' }, { status: 500 })
  }
}
