import { test, expect } from 'bun:test'
import { serializeRequestLineAndHeaders, toRequestData, type InterceptedRequest } from './requestModel'

const base: InterceptedRequest = {
  id: '1',
  method: 'POST',
  url: 'https://api.example.com/login',
  host: 'api.example.com',
  port: 443,
  protocol: 'https',
  path: '/login',
  headers: [['Host', 'api.example.com'], ['Content-Type', 'application/json'], ['Content-Length', '0']],
  body: '{"u":"x"}'
}

test('serialize rebuilds request line and recomputes Content-Length', () => {
  const raw = serializeRequestLineAndHeaders(base)
  expect(raw.startsWith('POST /login HTTP/1.1\r\n')).toBe(true)
  expect(raw).toContain('Content-Length: 9') // byte length of {"u":"x"}
  expect(raw.endsWith('\r\n\r\n')).toBe(true)
})

test('toRequestData maps to the shared RequestData shape', () => {
  const rd = toRequestData(base)
  expect(rd.method).toBe('POST')
  expect(rd.url).toBe('https://api.example.com/login')
  expect(rd.bodyType).toBe('json')
  expect(rd.headers.find((h) => h.key === 'Content-Type')?.value).toBe('application/json')
})
