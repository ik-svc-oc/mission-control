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

describe('Galactus bridge API routes', () => {
  beforeEach(() => {
    vi.resetModules()
    requireRole.mockReset()
    requireRole.mockReturnValue({ user: { id: 1, username: 'viewer', role: 'viewer', workspace_id: 1 } })
  })

  it.each([
    ['approval ledger', () => import('@/app/api/galactus/runs/[run_id]/approval-ledger/route')],
    ['cost', () => import('@/app/api/galactus/runs/[run_id]/cost/route')],
    ['evidence', () => import('@/app/api/galactus/runs/[run_id]/evidence/route')],
    ['lanes', () => import('@/app/api/galactus/runs/[run_id]/lanes/route')],
  ])('requires viewer access and marks %s as a bridge snapshot', async (_name, loadRoute) => {
    const { GET } = await loadRoute()
    const request = new NextRequest('http://localhost/api/galactus/runs/run-1')

    const response = await GET(request, { params: Promise.resolve({ run_id: 'run-1' }) })

    expect(response.status).toBe(200)
    expect(response.headers.get('X-State-Source')).toBe('bridge snapshot')
    expect(requireRole).toHaveBeenCalledWith(request, 'viewer')
  })

  it('rejects unauthenticated Galactus bridge reads', async () => {
    requireRole.mockReturnValue({ error: 'Authentication required', status: 401 })
    const { GET } = await import('@/app/api/galactus/runs/[run_id]/lanes/route')
    const request = new NextRequest('http://localhost/api/galactus/runs/run-1/lanes')

    const response = await GET(request, { params: Promise.resolve({ run_id: 'run-1' }) })

    expect(response.status).toBe(401)
    expect(requireRole).toHaveBeenCalledWith(request, 'viewer')
  })
})
