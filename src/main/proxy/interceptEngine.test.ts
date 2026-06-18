// src/main/proxy/interceptEngine.test.ts
import { test, expect } from 'bun:test'
import { InterceptEngine } from './interceptEngine'
import type { InterceptedRequest } from './requestModel'

function req(id: string): InterceptedRequest {
  return { id, method: 'GET', url: 'http://x/'+id, host: 'x', port: 80, protocol: 'http', path: '/'+id, headers: [], body: '' }
}

test('passes through immediately when disarmed and still captures', async () => {
  const e = new InterceptEngine()
  let captured = ''
  e.onCapture = (r) => { captured = r.id }
  const res = await e.handle(req('a'), 1000)
  expect(res.action).toBe('forward')
  expect(captured).toBe('a')
})

test('parks when armed and forwards on resolve', async () => {
  const e = new InterceptEngine()
  e.armed = true
  let paused = ''
  e.onPause = (r) => { paused = r.id }
  const p = e.handle(req('b'), 5000)
  await Promise.resolve() // let handle register the pending entry
  expect(paused).toBe('b')
  expect(e.pendingCount()).toBe(1)
  e.resolve('b', { action: 'drop' })
  const res = await p
  expect(res.action).toBe('drop')
  expect(e.pendingCount()).toBe(0)
})

test('auto-forwards a parked request after timeout', async () => {
  const e = new InterceptEngine()
  e.armed = true
  const res = await e.handle(req('c'), 20)
  expect(res.action).toBe('forward')
})
