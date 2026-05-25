import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const requireRole = vi.hoisted(() => vi.fn())

vi.mock('@/lib/auth', () => ({ requireRole }))

vi.mock('@/lib/logger', () => ({
  logger: {
    child: () => ({
      error: vi.fn(),
      info: vi.fn(),
    }),
  },
}))

describe('Galactus mem0 bridge routes', () => {
  beforeEach(() => {
    vi.resetModules()
    requireRole.mockReset()
    requireRole.mockReturnValue({ user: { id: 1, username: 'operator', role: 'operator', workspace_id: 1 } })
  })

  it('requires operator access for trajectory decisions', async () => {
    requireRole.mockReturnValue({ error: 'Requires operator role or higher', status: 403 })
    const { PATCH } = await import('@/app/api/mem0/[id]/route')
    const request = new NextRequest('http://localhost/api/mem0/candidate-1', {
      method: 'PATCH',
      body: JSON.stringify({ action: 'approve' }),
      headers: { 'content-type': 'application/json' },
    })

    const response = await PATCH(request, { params: Promise.resolve({ id: 'candidate-1' }) })

    expect(response.status).toBe(403)
    expect(requireRole).toHaveBeenCalledWith(request, 'operator')
  })

  it('does not claim trajectory decisions are persisted while MCP writing is unavailable', async () => {
    const { PATCH } = await import('@/app/api/mem0/[id]/route')
    const request = new NextRequest('http://localhost/api/mem0/candidate-1', {
      method: 'PATCH',
      body: JSON.stringify({ action: 'approve' }),
      headers: { 'content-type': 'application/json' },
    })

    const response = await PATCH(request, { params: Promise.resolve({ id: 'candidate-1' }) })
    const payload = await response.json() as { error?: string }

    expect(response.status).toBe(501)
    expect(requireRole).toHaveBeenCalledWith(request, 'operator')
    expect(payload.error).toContain('mem0 MCP write is not configured')
  })

  it('rejects unsupported trajectory actions', async () => {
    const { PATCH } = await import('@/app/api/mem0/[id]/route')
    const request = new NextRequest('http://localhost/api/mem0/candidate-1', {
      method: 'PATCH',
      body: JSON.stringify({ action: 'promote' }),
      headers: { 'content-type': 'application/json' },
    })

    const response = await PATCH(request, { params: Promise.resolve({ id: 'candidate-1' }) })
    const payload = await response.json() as { error?: string }

    expect(response.status).toBe(422)
    expect(requireRole).toHaveBeenCalledWith(request, 'operator')
    expect(payload.error).toContain('invalid action')
  })

  it('returns a typed empty search result while MCP wiring is stubbed', async () => {
    const { GET } = await import('@/app/api/mem0/search/route')
    const request = new NextRequest('http://localhost/api/mem0/search?query=promoted%3Afalse')

    const response = await GET(request)
    const payload = await response.json() as { results?: unknown[]; bridge_snapshot?: boolean }

    expect(response.status).toBe(200)
    expect(requireRole).toHaveBeenCalledWith(request, 'viewer')
    expect(payload.results).toEqual([])
    expect(payload.bridge_snapshot).toBe(true)
  })

  it('rejects unsupported mem0 search queries', async () => {
    const { GET } = await import('@/app/api/mem0/search/route')
    const request = new NextRequest('http://localhost/api/mem0/search?query=secret')

    const response = await GET(request)
    const payload = await response.json() as { error?: string }

    expect(response.status).toBe(400)
    expect(payload.error).toContain('unsupported')
    expect(requireRole).toHaveBeenCalledWith(request, 'viewer')
  })
})
