import { test, expect } from 'bun:test'
import { mkdtempSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { loadOrCreateCa } from './ca'

test('loadOrCreateCa creates then reuses CA material', () => {
  const dir = mkdtempSync(join(tmpdir(), 'zr-ca-'))
  const first = loadOrCreateCa(dir)
  expect(existsSync(join(dir, 'ca-cert.pem'))).toBe(true)
  const second = loadOrCreateCa(dir)
  expect(second.caCertPem).toBe(first.caCertPem) // reused, not regenerated
})
