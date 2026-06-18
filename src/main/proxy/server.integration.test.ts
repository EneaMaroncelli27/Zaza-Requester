// src/main/proxy/server.integration.test.ts
import { test, expect, afterEach } from 'bun:test'
import http from 'node:http'
import { loadOrCreateCa } from './ca'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { InterceptEngine } from './interceptEngine'
import { MitmProxy } from './server'

let proxy: MitmProxy
let origin: http.Server

afterEach(async () => {
  await proxy?.stop()
  origin?.close()
})

test('captures and forwards a plain HTTP request through the proxy', async () => {
  // Upstream origin that echoes the path
  origin = http.createServer((req, res) => res.end('hit:' + req.url))
  const originPort: number = await new Promise((r) => origin.listen(0, () => r((origin.address() as any).port)))

  const ca = loadOrCreateCa(mkdtempSync(join(tmpdir(), 'zr-ca-')))
  const engine = new InterceptEngine()
  let capturedUrl = ''
  engine.onCapture = (req) => { capturedUrl = req.url }

  proxy = new MitmProxy({ ca, engine, timeoutMs: 30000 })
  const proxyPort = await proxy.start()

  // Make a request THROUGH the proxy (absolute-form URL, like a browser proxy client)
  const body: string = await new Promise((resolve, reject) => {
    const r = http.request({
      host: '127.0.0.1', port: proxyPort, method: 'GET',
      path: `http://127.0.0.1:${originPort}/hello`,
      headers: { Host: `127.0.0.1:${originPort}` }
    }, (res) => {
      let d = ''
      res.on('data', (c) => (d += c))
      res.on('end', () => resolve(d))
    })
    r.on('error', reject)
    r.end()
  })

  expect(body).toBe('hit:/hello')
  expect(capturedUrl).toContain('/hello')
})
